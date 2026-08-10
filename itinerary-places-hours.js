/**
 * SoarVibe Itinerary Places Opening Hours + Final QA Gate (P0.5)
 * Pure scheduling logic is testable offline; live Places resolve is injected.
 */
(function (global) {
  'use strict';

  var DAY_MINUTES = 24 * 60;
  var MAX_POI_RESOLVES_PER_TRIP = 25;
  var SESSION_CACHE = Object.create(null);

  var TI = function () {
    return global.SOARVIBE_ITINERARY_TIME_INTEGRITY || null;
  };

  function hhmmToMinutes(hhmm) {
    var m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return NaN;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function minutesToHhmm(total) {
    var t = ((Number(total) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    var h = Math.floor(t / 60);
    var mi = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
  }

  function cacheKey(query, placeId, dateIso) {
    return [
      String(placeId || '').trim() || 'q:' + String(query || '').trim().toLowerCase(),
      String(dateIso || '').slice(0, 10)
    ].join('|');
  }

  function getCached(key) {
    return SESSION_CACHE[key] || null;
  }

  function setCached(key, value) {
    SESSION_CACHE[key] = value;
    return value;
  }

  function clearSessionCache() {
    Object.keys(SESSION_CACHE).forEach(function (k) {
      delete SESSION_CACHE[k];
    });
  }

  function haversineMeters(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return Infinity;
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var lat1 = a.lat * toRad;
    var lat2 = b.lat * toRad;
    var x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  function normalizeNameTokens(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^\u3040-\u30ff\u3400-\u9fff\uac00-\ud7afa-z0-9]+/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(function (t) {
        return t.length >= 2;
      });
  }

  function tokenOverlapScore(a, b) {
    var ta = normalizeNameTokens(a);
    var tb = normalizeNameTokens(b);
    if (!ta.length || !tb.length) return 0;
    var set = {};
    tb.forEach(function (t) {
      set[t] = true;
    });
    var hit = 0;
    ta.forEach(function (t) {
      if (set[t]) hit += 1;
    });
    return hit / Math.max(ta.length, 1);
  }

  /**
   * Match confidence: reject wrong-city / weak name matches.
   */
  function scorePlaceMatch(candidate, query, ctx) {
    ctx = ctx || {};
    var name = candidate.canonicalName || candidate.displayName || candidate.name || '';
    var address = candidate.formattedAddress || candidate.address || '';
    var nameScore = tokenOverlapScore(query, name);
    var city = String(ctx.city || ctx.destination || '');
    var country = String(ctx.country || '');
    var cityHit =
      !city ||
      address.indexOf(city) !== -1 ||
      name.indexOf(city) !== -1 ||
      (city === '北海道' && /札幌|小樽|函館|旭川|Sapporo|Hokkaido/i.test(address + name)) ||
      (city === '札幌' && /札幌|Sapporo/i.test(address + name));
    var countryHit =
      !country ||
      address.indexOf(country) !== -1 ||
      /日本|Japan|韓國|Korea|台灣|Taiwan|泰國|Thailand/i.test(address) ||
      !address;
    var dist = Infinity;
    if (ctx.center && candidate.lat != null && candidate.lng != null) {
      dist = haversineMeters(ctx.center, { lat: candidate.lat, lng: candidate.lng });
    }
    var radius = Number(ctx.searchRadiusM) || 40000;
    var geoOk = !ctx.center || dist <= radius;
    var confidence = nameScore;
    if (cityHit) confidence += 0.25;
    if (geoOk && dist < Infinity) confidence += Math.max(0, 0.3 - dist / radius / 4);
    if (!cityHit && address && city) confidence -= 0.5;
    if (!geoOk) confidence -= 0.6;
    var ok = confidence >= 0.35 && (cityHit || geoOk) && nameScore >= 0.15;
    if (/時計台|Clock\s*Tower/i.test(query) && /東京|大阪|京都|Seoul|Busan/i.test(address) && !/札幌|Sapporo/i.test(address)) {
      ok = false;
      confidence = 0;
    }
    return {
      ok: ok,
      confidence: Math.max(0, Math.min(1, confidence)),
      nameScore: nameScore,
      cityHit: cityHit,
      geoOk: geoOk,
      distMeters: dist
    };
  }

  /**
   * Parse Google Places regularOpeningHours / legacy opening_hours into
   * absolute-minute windows for a given weekday (0=Sun … 6=Sat).
   * Cross-midnight: close dayOffset +1 → endAbs > 1440.
   */
  function parseOpeningPeriods(hoursObj) {
    if (!hoursObj) return [];
    var periods = hoursObj.periods || hoursObj.openPeriods || [];
    var out = [];
    var i;
    for (i = 0; i < periods.length; i++) {
      var p = periods[i] || {};
      var open = p.open || {};
      var close = p.close || null;
      var openDay = open.day != null ? Number(open.day) : NaN;
      var openMin = timePartToMinutes(open);
      if (isNaN(openDay) || isNaN(openMin)) continue;
      if (!close) {
        // Open 24h starting that day
        out.push({
          openDay: openDay,
          openMin: openMin,
          closeDay: openDay,
          closeMin: openMin + DAY_MINUTES,
          crossesMidnight: true,
          open24h: true
        });
        continue;
      }
      var closeDay = close.day != null ? Number(close.day) : openDay;
      var closeMin = timePartToMinutes(close);
      if (isNaN(closeMin)) continue;
      var crosses = closeDay !== openDay || closeMin <= openMin;
      var closeAbs = crosses
        ? (closeDay === openDay ? DAY_MINUTES + closeMin : DAY_MINUTES + closeMin)
        : closeMin;
      // Normalize: if close day is next weekday relative to open
      if (closeDay !== openDay) {
        var dayDelta = (closeDay - openDay + 7) % 7;
        closeAbs = dayDelta * DAY_MINUTES + closeMin;
      } else if (closeMin <= openMin) {
        closeAbs = DAY_MINUTES + closeMin;
        crosses = true;
      } else {
        closeAbs = closeMin;
      }
      out.push({
        openDay: openDay,
        openMin: openMin,
        closeDay: closeDay,
        closeMin: closeMin,
        closeAbsFromOpenDay: closeAbs,
        crossesMidnight: !!crosses,
        open24h: false
      });
    }
    return out;
  }

  function timePartToMinutes(part) {
    if (!part) return NaN;
    if (part.hour != null || part.minute != null) {
      return Number(part.hour || 0) * 60 + Number(part.minute || 0);
    }
    if (part.time != null) {
      var t = String(part.time);
      if (/^\d{3,4}$/.test(t)) {
        var padded = ('0000' + t).slice(-4);
        return parseInt(padded.slice(0, 2), 10) * 60 + parseInt(padded.slice(2), 10);
      }
    }
    if (typeof part === 'string' && /^\d{1,2}:\d{2}$/.test(part)) {
      return hhmmToMinutes(part);
    }
    return NaN;
  }

  /**
   * Windows for a calendar weekday as list of {startAbs, endAbs} on that local day timeline
   * (startAbs may be 0..1440+, endAbs may exceed 1440 for overnight).
   */
  function periodToAbsWindow(p) {
    var startAbs = p.openMin;
    var endAbs;
    if (p.open24h) {
      endAbs = startAbs + DAY_MINUTES;
    } else if (p.crossesMidnight || (p.closeDay != null && p.closeDay !== p.openDay)) {
      var delta = p.closeDay != null ? (p.closeDay - p.openDay + 7) % 7 : 1;
      if (delta === 0 && p.closeMin <= p.openMin) delta = 1;
      endAbs = delta * DAY_MINUTES + p.closeMin;
    } else if (p.closeMin <= p.openMin) {
      endAbs = DAY_MINUTES + p.closeMin;
    } else {
      endAbs = p.closeMin;
    }
    if (endAbs <= startAbs) endAbs = startAbs + 60;
    return { startAbs: startAbs, endAbs: endAbs, openDay: p.openDay };
  }

  /**
   * Windows usable on calendar weekday `wd` (0=Sun).
   * Includes previous-day overnight spillover mapped onto this calendar day
   * (e.g. Mon 18:00–Tue 02:00 → Tue early morning uses startAbs 0..120).
   */
  function windowsForWeekday(periods, weekday) {
    var wd = Number(weekday);
    var windows = [];
    (periods || []).forEach(function (p) {
      var abs = periodToAbsWindow(p);
      if (p.openDay === wd) {
        windows.push({ startAbs: abs.startAbs, endAbs: abs.endAbs });
      }
      if (abs.endAbs > DAY_MINUTES) {
        var closeDay = p.closeDay != null ? p.closeDay : (p.openDay + 1) % 7;
        if (closeDay === wd || (p.openDay === (wd + 6) % 7 && abs.endAbs > DAY_MINUTES)) {
          windows.push({
            startAbs: 0,
            endAbs: abs.endAbs - DAY_MINUTES,
            spillover: true
          });
        }
      }
    });
    return windows;
  }

  function isClosedOnWeekday(periods, weekday) {
    if (!periods || !periods.length) return null; // unknown
    return windowsForWeekday(periods, weekday).length === 0;
  }

  /**
   * Does [startAbs, endAbs] fit entirely inside some open window?
   * Activity must finish before closing (not merely arrive before close).
   */
  function activityFitsWindows(startAbs, endAbs, windows, minStayBuffer) {
    minStayBuffer = minStayBuffer == null ? 0 : minStayBuffer;
    if (isNaN(startAbs) || isNaN(endAbs) || endAbs <= startAbs) {
      return { ok: false, reason: 'bad_span' };
    }
    var i;
    for (i = 0; i < (windows || []).length; i++) {
      var w = windows[i];
      if (startAbs >= w.startAbs && endAbs <= w.endAbs - minStayBuffer) {
        return { ok: true, window: w };
      }
    }
    // Also allow activity that starts previous evening into overnight window matching start day
    return { ok: false, reason: 'outside_hours' };
  }

  function findBestWindowForStay(windows, preferredStart, stayMinutes) {
    var best = null;
    (windows || []).forEach(function (w) {
      var capacity = w.endAbs - w.startAbs;
      if (capacity < stayMinutes + 10) return;
      var start = Math.max(w.startAbs, preferredStart);
      if (start + stayMinutes > w.endAbs - 5) {
        start = w.endAbs - 5 - stayMinutes;
      }
      if (start < w.startAbs) return;
      var score = Math.abs(start - preferredStart);
      if (!best || score < best.score) {
        best = { start: start, end: start + stayMinutes, window: w, score: score };
      }
    });
    return best;
  }

  function classifyPoiKind(title, types) {
    var t = String(title || '');
    var typesArr = types || [];
    var joined = typesArr.join(' ');
    if (/返回飯店|回飯店|休息|便利商店|藥妝|唐吉訶德|寄物|check-?in|機場|空港|入境|送機/i.test(t)) {
      return 'skip';
    }
    if (
      /restaurant|cafe|meal_takeaway|bakery|bar|food/i.test(joined) ||
      /午餐|晚餐|早餐|下午茶|拉麵|燒肉|壽司|餐廳|食堂|居酒屋|咖啡|甜點|美食|螃蟹|丼/i.test(t)
    ) {
      return 'restaurant';
    }
    if (/night_club|bar|nightlife/i.test(joined) || /夜景|夜市|酒吧|薄野|夜生活/i.test(t)) {
      return 'nightlife';
    }
    if (/shopping_mall|department_store|store/i.test(joined) || /商場|百貨|Outlet|藥妝|唐吉訶德|購物/i.test(t)) {
      return 'shopping';
    }
    if (/museum|art_gallery|tourist_attraction|park|shrine|temple|church|zoo|aquarium/i.test(joined)) {
      return 'attraction';
    }
    if (/博物館|美術館|神社|寺廟|公園|展望|塔|時計台|景點|觀景/i.test(t)) {
      return 'attraction';
    }
    return 'attraction';
  }

  function conservativeWindows(kind, styleKey) {
    if (kind === 'skip') return null;
    if (kind === 'nightlife' || styleKey === 'nightlife') {
      return [{ startAbs: 18 * 60, endAbs: DAY_MINUTES + 2 * 60 }];
    }
    if (kind === 'shopping') {
      return [{ startAbs: 10 * 60, endAbs: 21 * 60 }];
    }
    if (kind === 'restaurant') {
      return [
        { startAbs: 11 * 60 + 30, endAbs: 14 * 60 + 30 },
        { startAbs: 17 * 60 + 30, endAbs: 21 * 60 + 30 }
      ];
    }
    // attraction default
    return [{ startAbs: 9 * 60, endAbs: 17 * 60 }];
  }

  function weekdayFromDateIso(dateIso) {
    if (!dateIso) return null;
    var d = new Date(String(dateIso).slice(0, 10) + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    return d.getDay();
  }

  function stripEngineeringMetaForClone(item) {
    // Keep metadata on object for QA; render path ignores unknown fields.
    return item;
  }

  function isSkippableTitle(title) {
    return classifyPoiKind(title, []) === 'skip';
  }

  function normalizePlaceRecord(raw) {
    if (!raw) return null;
    var lat = raw.lat;
    var lng = raw.lng;
    if ((lat == null || lng == null) && raw.location) {
      if (typeof raw.location.lat === 'function') {
        lat = raw.location.lat();
        lng = raw.location.lng();
      } else {
        lat = raw.location.latitude != null ? raw.location.latitude : raw.location.lat;
        lng = raw.location.longitude != null ? raw.location.longitude : raw.location.lng;
      }
    }
    var hours =
      raw.regularOpeningHours ||
      raw.currentOpeningHours ||
      raw.opening_hours ||
      raw.regular_opening_hours ||
      null;
    var periods = parseOpeningPeriods(hours);
    var displayName =
      raw.canonicalName ||
      raw.displayName ||
      (raw.displayName && raw.displayName.text) ||
      raw.name ||
      '';
    if (typeof displayName === 'object') displayName = displayName.text || '';
    return {
      placeId: String(raw.placeId || raw.id || raw.place_id || '').replace(/^places\//, ''),
      canonicalName: String(displayName || ''),
      formattedAddress: raw.formattedAddress || raw.formatted_address || raw.address || '',
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      businessStatus: raw.businessStatus || raw.business_status || '',
      rating: typeof raw.rating === 'number' ? raw.rating : null,
      userRatingCount: raw.userRatingCount || raw.user_ratings_total || null,
      types: raw.types || [],
      regularOpeningHours: hours,
      weekdayDescriptions: (hours && hours.weekdayDescriptions) || raw.weekdayDescriptions || [],
      periods: periods,
      openingHoursKnown: periods.length > 0,
      raw: raw
    };
  }

  function attachPlacesMeta(item, place, matchInfo, source) {
    item.__places = {
      placeId: place.placeId || '',
      canonicalName: place.canonicalName || '',
      lat: place.lat,
      lng: place.lng,
      regularOpeningHours: place.regularOpeningHours || null,
      openingHoursKnown: !!place.openingHoursKnown,
      businessStatus: place.businessStatus || '',
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      types: place.types || [],
      periods: place.periods || [],
      weekdayDescriptions: place.weekdayDescriptions || [],
      matchConfidence: matchInfo ? matchInfo.confidence : null,
      source: source || 'places'
    };
    item.openingHoursKnown = !!place.openingHoursKnown;
    item.openingHoursUnknown = !place.openingHoursKnown;
    return item;
  }

  function validateItemAgainstPlaces(item, opt) {
    opt = opt || {};
    var issues = [];
    var title = item.title || '';
    if (isSkippableTitle(title)) return { ok: true, issues: issues };

    var kind = classifyPoiKind(title, (item.__places && item.__places.types) || []);
    var ti = TI();
    var tl = ti
      ? ti.normalizeItemTimeline(item)
      : {
          startAbs: hhmmToMinutes(item.startTime),
          endAbs: hhmmToMinutes(item.endTime)
        };
    // Overnight endAbs for same-day clock when end < start
    if (!ti && !isNaN(tl.startAbs) && !isNaN(tl.endAbs) && tl.endAbs < tl.startAbs) {
      tl.endAbs += DAY_MINUTES;
    }

    var weekday = opt.weekday;
    var windows = null;
    var known = false;

    if (item.__places && item.__places.businessStatus === 'CLOSED_PERMANENTLY') {
      issues.push({ type: 'permanently_closed', title: title });
      return { ok: false, issues: issues };
    }

    if (item.__places && item.__places.openingHoursKnown && item.__places.periods) {
      known = true;
      if (weekday == null) {
        issues.push({ type: 'missing_weekday', title: title });
        return { ok: false, issues: issues };
      }
      var closed = isClosedOnWeekday(item.__places.periods, weekday);
      if (closed) {
        issues.push({ type: 'closed_weekday', title: title, weekday: weekday });
        return { ok: false, issues: issues };
      }
      windows = windowsForWeekday(item.__places.periods, weekday);
    } else {
      // Catalog fallback via Time Integrity
      if (ti && typeof ti.lookupPoiHours === 'function') {
        var cat = ti.lookupPoiHours(title);
        if (cat) {
          known = true;
          windows = [{ startAbs: cat.openMin, endAbs: cat.closeMin }];
          item.openingHoursKnown = true;
          item.openingHoursUnknown = false;
          item.openingHoursSource = item.openingHoursSource || 'catalog:' + cat.id;
        }
      }
      if (!windows) {
        known = false;
        item.openingHoursKnown = false;
        item.openingHoursUnknown = true;
        windows = conservativeWindows(kind, opt.styleKey);
      }
    }

    if (!windows || !windows.length) {
      issues.push({ type: 'no_open_window', title: title });
      return { ok: false, issues: issues };
    }

    var fit = activityFitsWindows(tl.startAbs, tl.endAbs, windows, 0);
    if (!fit.ok) {
      issues.push({
        type: known ? 'outside_opening_hours' : 'outside_conservative_hours',
        title: title,
        startTime: item.startTime,
        endTime: item.endTime,
        known: known
      });
      return { ok: false, issues: issues, windows: windows, known: known };
    }
    return { ok: true, issues: issues, windows: windows, known: known };
  }

  function repairItemIntoWindows(item, windows, opt) {
    opt = opt || {};
    var ti = TI();
    var tl = ti ? ti.normalizeItemTimeline(item) : null;
    var stay = 60;
    if (tl && !isNaN(tl.startAbs) && !isNaN(tl.endAbs)) {
      stay = Math.max(30, tl.endAbs - tl.startAbs);
    }
    // Prefer shorten only if still reasonable (>= 35m) to fit
    var preferred = tl && !isNaN(tl.startAbs) ? tl.startAbs % DAY_MINUTES : 13 * 60;
    var attemptStay = stay;
    var slot = findBestWindowForStay(windows, preferred, attemptStay);
    if (!slot && attemptStay > 40) {
      attemptStay = Math.max(35, Math.min(attemptStay, 45));
      slot = findBestWindowForStay(windows, preferred, attemptStay);
    }
    if (!slot) return { ok: false, item: item };
    item.startTime = minutesToHhmm(slot.start % DAY_MINUTES);
    item.endTime = minutesToHhmm(slot.end % DAY_MINUTES);
    // If end wrapped
    if (slot.end >= DAY_MINUTES && slot.start < DAY_MINUTES) {
      item.endTime = minutesToHhmm(slot.end % DAY_MINUTES);
    }
    if (ti) {
      var fixed = ti.normalizeItemTimeline(item);
      item.startTime = fixed.startTime;
      item.endTime = fixed.endTime;
      item.startAbs = fixed.startAbs;
      item.endAbs = fixed.endAbs;
      item.crossesMidnight = fixed.crossesMidnight;
      item.timeLabel = item.startTime + ' - ' + item.endTime;
    } else {
      item.timeLabel = item.startTime + ' - ' + item.endTime;
    }
    return { ok: true, item: item, stay: attemptStay };
  }

  function collectUniquePoiQueries(hidden) {
    var seen = Object.create(null);
    var list = [];
    (hidden.days || []).forEach(function (day) {
      (day.phases || []).forEach(function (phase) {
        (phase.items || []).forEach(function (it) {
          var title = String(it.title || '').trim();
          if (!title || isSkippableTitle(title)) return;
          var key = title.toLowerCase();
          if (seen[key]) return;
          seen[key] = true;
          list.push({ title: title, item: it });
        });
      });
    });
    // Cost control: keep first MAX, prefer longer/more specific titles
    list.sort(function (a, b) {
      return b.title.length - a.title.length;
    });
    return list.slice(0, MAX_POI_RESOLVES_PER_TRIP);
  }

  function estimatePlacesRequests(dayCount) {
    // Final schedule only (not 50 Gemini candidates): ~3–5 POIs/day capped at 25
    var perDay = 4;
    var unique = Math.min(MAX_POI_RESOLVES_PER_TRIP, Math.max(8, dayCount * perDay));
    return {
      dayCount: dayCount,
      estimatedUniquePois: unique,
      estimatedSearchCalls: unique,
      estimatedDetailCalls: 0,
      note: 'Session cache dedupes repeats across days; wishlist anchors share cache.'
    };
  }

  function removeDuplicatePlaceIds(items) {
    var seen = Object.create(null);
    var fixes = [];
    var out = [];
    items.forEach(function (it) {
      var pid = it.__places && it.__places.placeId;
      if (pid && seen[pid]) {
        fixes.push({ type: 'remove_duplicate_placeId', title: it.title, placeId: pid });
        return;
      }
      if (pid) seen[pid] = true;
      out.push(it);
    });
    return { items: out, fixes: fixes };
  }

  function runDayPlacesQa(day, opt) {
    opt = opt || {};
    var ti = TI();
    var issues = [];
    var fixes = [];
    var items = [];
    (day.phases || []).forEach(function (p) {
      (p.items || []).forEach(function (it) {
        items.push(it);
      });
    });

    var dedupe = removeDuplicatePlaceIds(items);
    items = dedupe.items;
    fixes = fixes.concat(dedupe.fixes);

    var weekday = opt.weekday;
    if (weekday == null && day.dateLabel) {
      // try parse from meta dateStart + dayNum externally
    }

    items.forEach(function (it) {
      var res = validateItemAgainstPlaces(it, {
        weekday: weekday,
        styleKey: opt.styleKey
      });
      if (res.ok) return;
      issues = issues.concat(res.issues || []);
      if (res.windows && res.windows.length) {
        var repaired = repairItemIntoWindows(it, res.windows, opt);
        if (repaired.ok) {
          fixes.push({
            type: 'shift_into_places_hours',
            title: it.title,
            to: it.startTime + '-' + it.endTime
          });
        } else if ((res.issues || []).some(function (x) {
          return x.type === 'closed_weekday' || x.type === 'permanently_closed';
        })) {
          it.__qaReject = true;
          fixes.push({ type: 'reject_closed_poi', title: it.title });
        } else {
          it.__qaReject = true;
          fixes.push({ type: 'unrepairable_hours', title: it.title });
        }
      } else if ((res.issues || []).some(function (x) {
        return x.type === 'closed_weekday' || x.type === 'permanently_closed';
      })) {
        it.__qaReject = true;
      }
    });

    // Drop rejected closed POIs
    items = items.filter(function (it) {
      return !it.__qaReject;
    });

    if (ti && typeof ti.reconcileDayTimeline === 'function') {
      day.phases = [
        { label: '上午', items: [] },
        { label: '下午', items: [] },
        { label: '晚上', items: items }
      ];
      // Put all in one bucket then reconcile rebuilds periods
      var rebuilt = ti.reconcileDayTimeline(day, { styleKey: opt.styleKey });
      day = rebuilt.day;
      fixes = fixes.concat((rebuilt.report && rebuilt.report.fixes) || []);
      issues = issues.concat(
        ((rebuilt.report && rebuilt.report.issues) || []).filter(function (x) {
          return x.type === 'overlap' || x.type === 'negative_duration';
        })
      );
    }

    return { day: day, issues: issues, fixes: fixes };
  }

  /**
   * Final QA Gate — hard checks. User-facing render only if ok.
   */
  function finalQaGateDay(day, opt) {
    opt = opt || {};
    var ti = TI();
    var hard = [];
    var soft = [];
    var items = [];
    (day.phases || []).forEach(function (p) {
      (p.items || []).forEach(function (it) {
        items.push(it);
      });
    });

    if (!items.length) {
      hard.push({ type: 'empty_day', day: day.dayNum });
    }

    if (ti) {
      if (!ti.assertChronological(items)) {
        hard.push({ type: 'not_chronological', day: day.dayNum });
      }
      var conflicts = ti.detectTimeConflicts(items);
      (conflicts.issues || []).forEach(function (x) {
        if (x.type === 'overlap' || x.type === 'negative_duration') hard.push(x);
        else soft.push(x);
      });
    }

    var seenPid = Object.create(null);
    items.forEach(function (it) {
      var v = validateItemAgainstPlaces(it, {
        weekday: opt.weekday,
        styleKey: opt.styleKey
      });
      (v.issues || []).forEach(function (iss) {
        if (
          iss.type === 'outside_opening_hours' ||
          iss.type === 'closed_weekday' ||
          iss.type === 'permanently_closed' ||
          iss.type === 'outside_conservative_hours'
        ) {
          hard.push(iss);
        } else {
          soft.push(iss);
        }
      });
      var pid = it.__places && it.__places.placeId;
      if (pid) {
        if (seenPid[pid]) hard.push({ type: 'duplicate_placeId', placeId: pid, title: it.title });
        seenPid[pid] = true;
      }
      if (it.timeIntegrityFlags && it.timeIntegrityFlags.indexOf('late_dinner') !== -1) {
        soft.push({ type: 'late_dinner', title: it.title });
      }
      if (it.timeIntegrityFlags && it.timeIntegrityFlags.indexOf('past_day_end') !== -1) {
        if (opt.styleKey !== 'nightlife') soft.push({ type: 'past_day_end', title: it.title });
      }
    });

    // Meal label hard: 下午茶 after 17:00
    items.forEach(function (it) {
      var start = hhmmToMinutes(it.startTime);
      if (/下午茶/.test(String(it.title || '')) && !isNaN(start) && start >= 17 * 60) {
        hard.push({ type: 'meal_label_mismatch', title: it.title, startTime: it.startTime });
      }
    });

    if (opt.flightIssues && opt.flightIssues.length) {
      opt.flightIssues.forEach(function (fi) {
        if (fi.day === day.dayNum || fi.dayNum === day.dayNum) {
          hard.push(Object.assign({ type: fi.type || 'airport_constraint' }, fi));
        }
      });
    }

    return {
      ok: hard.length === 0,
      hard: hard,
      soft: soft,
      dayNum: day.dayNum
    };
  }

  function finalQaGateHidden(hidden, opt) {
    opt = opt || {};
    var dayResults = [];
    var allHard = [];
    (hidden.days || []).forEach(function (day, idx) {
      var weekday = opt.weekdayForDay
        ? opt.weekdayForDay(day, idx)
        : opt.weekday != null
          ? opt.weekday
          : null;
      var gate = finalQaGateDay(day, {
        weekday: weekday,
        styleKey: opt.styleKey,
        flightIssues: opt.flightIssues
      });
      dayResults.push(gate);
      if (!gate.ok) allHard = allHard.concat(gate.hard);
    });
    return {
      ok: allHard.length === 0,
      dayResults: dayResults,
      hard: allHard,
      failedDayNums: dayResults.filter(function (d) {
        return !d.ok;
      }).map(function (d) {
        return d.dayNum;
      })
    };
  }

  /**
   * Local deterministic repair for a day, then gate.
   */
  function localRepairDay(day, opt) {
    opt = opt || {};
    var pass = runDayPlacesQa(day, opt);
    day = pass.day;
    var gate = finalQaGateDay(day, opt);
    if (gate.ok) {
      return { day: day, ok: true, fixes: pass.fixes, issues: pass.issues, needsReplan: false };
    }
    // Second pass: drop remaining hard-fail attraction items that are still outside hours
    var items = [];
    (day.phases || []).forEach(function (p) {
      (p.items || []).forEach(function (it) {
        items.push(it);
      });
    });
    var kept = items.filter(function (it) {
      var v = validateItemAgainstPlaces(it, opt);
      if (!v.ok && (v.issues || []).some(function (x) {
        return (
          x.type === 'outside_opening_hours' ||
          x.type === 'closed_weekday' ||
          x.type === 'permanently_closed'
        );
      })) {
        return false;
      }
      return true;
    });
    if (kept.length >= Math.max(2, Math.ceil(items.length * 0.5))) {
      var ti = TI();
      if (ti) {
        day.phases = [{ label: '晚上', items: kept }];
        day = ti.reconcileDayTimeline(day, { styleKey: opt.styleKey }).day;
      }
      gate = finalQaGateDay(day, opt);
      if (gate.ok) {
        return {
          day: day,
          ok: true,
          fixes: pass.fixes.concat([{ type: 'drop_unrepairable_pois' }]),
          issues: pass.issues,
          needsReplan: false
        };
      }
    }
    return {
      day: day,
      ok: false,
      fixes: pass.fixes,
      issues: gate.hard,
      needsReplan: true
    };
  }

  /**
   * Async enrich: resolve places via injected resolver, attach meta, repair, gate.
   * resolvePlace(query, ctx) → place record or null
   * replanDay(dayNum, day, hidden) → updated day or null (optional)
   */
  async function enrichAndGateHidden(hidden, opt) {
    opt = opt || {};
    var styleKey = opt.styleKey || '';
    var meta = opt.meta || {};
    var resolvePlace = opt.resolvePlace;
    var replanDay = opt.replanDay;
    var city = meta.destination || opt.city || '';
    var center = opt.center || null;
    var searchRadiusM = opt.searchRadiusM || 40000;
    var country = opt.country || '';
    var stats = { resolveAttempts: 0, cacheHits: 0, matched: 0, rejectedMatch: 0 };

    if (typeof resolvePlace === 'function') {
      var queries = collectUniquePoiQueries(hidden);
      var q;
      for (q = 0; q < queries.length; q++) {
        var title = queries[q].title;
        var dateKey = opt.dateIso || '';
        var ck = cacheKey(title, '', dateKey);
        var cached = getCached(ck);
        var place = null;
        var matchInfo = null;
        if (cached) {
          stats.cacheHits += 1;
          place = cached.place;
          matchInfo = cached.matchInfo;
        } else {
          stats.resolveAttempts += 1;
          try {
            var raw = await resolvePlace(title, {
              city: city,
              destination: city,
              country: country,
              center: center,
              searchRadiusM: searchRadiusM
            });
            place = normalizePlaceRecord(raw);
            if (place) {
              matchInfo = scorePlaceMatch(place, title, {
                city: city,
                destination: city,
                country: country,
                center: center,
                searchRadiusM: searchRadiusM
              });
              if (!matchInfo.ok) {
                stats.rejectedMatch += 1;
                place = null;
                matchInfo = matchInfo;
              } else {
                stats.matched += 1;
              }
            }
            setCached(ck, { place: place, matchInfo: matchInfo });
            if (place && place.placeId) {
              setCached(cacheKey('', place.placeId, dateKey), { place: place, matchInfo: matchInfo });
            }
          } catch (e) {
            setCached(ck, { place: null, matchInfo: null, error: String(e && e.message) });
          }
        }
        // Attach to all items with same title
        (hidden.days || []).forEach(function (day) {
          (day.phases || []).forEach(function (phase) {
            (phase.items || []).forEach(function (it) {
              if (String(it.title || '').trim() !== title) return;
              if (place && matchInfo && matchInfo.ok) {
                attachPlacesMeta(it, place, matchInfo, 'places');
              } else {
                it.openingHoursUnknown = true;
                it.openingHoursKnown = false;
                it.__places = it.__places || {
                  openingHoursKnown: false,
                  matchRejected: !!(matchInfo && !matchInfo.ok)
                };
              }
            });
          });
        });
      }
    }

    var failedDays = [];
    var allFixes = [];
    var d;
    for (d = 0; d < (hidden.days || []).length; d++) {
      var day = hidden.days[d];
      var weekday = opt.weekdayForDay
        ? opt.weekdayForDay(day, d)
        : weekdayFromDateIso(opt.dateIso);
      if (opt.dateStart && day.dayNum) {
        var base = new Date(String(opt.dateStart).slice(0, 10) + 'T12:00:00');
        if (!isNaN(base.getTime())) {
          base.setDate(base.getDate() + (Number(day.dayNum) - 1));
          weekday = base.getDay();
        }
      }
      var repaired = localRepairDay(day, {
        weekday: weekday,
        styleKey: styleKey
      });
      hidden.days[d] = repaired.day;
      allFixes = allFixes.concat(repaired.fixes || []);
      if (!repaired.ok && repaired.needsReplan && typeof replanDay === 'function') {
        try {
          var fresh = await replanDay(day.dayNum || d + 1, repaired.day, hidden);
          if (fresh) {
            // Re-attach places lightly via catalog/time integrity only; avoid second full Places burst
            var again = localRepairDay(fresh, { weekday: weekday, styleKey: styleKey });
            hidden.days[d] = again.day;
            allFixes = allFixes.concat(again.fixes || []);
            if (!again.ok) failedDays.push(day.dayNum || d + 1);
          } else {
            failedDays.push(day.dayNum || d + 1);
          }
        } catch (replanErr) {
          failedDays.push(day.dayNum || d + 1);
        }
      } else if (!repaired.ok) {
        failedDays.push(day.dayNum || d + 1);
      }
    }

    var gate = finalQaGateHidden(hidden, {
      styleKey: styleKey,
      weekdayForDay: function (day, idx) {
        if (opt.dateStart && day.dayNum) {
          var base = new Date(String(opt.dateStart).slice(0, 10) + 'T12:00:00');
          if (!isNaN(base.getTime())) {
            base.setDate(base.getDate() + (Number(day.dayNum) - 1));
            return base.getDay();
          }
        }
        return opt.weekday != null ? opt.weekday : null;
      },
      flightIssues: opt.flightIssues || []
    });

    hidden.meta = hidden.meta || {};
    hidden.meta.placesHoursQa = {
      ok: gate.ok && failedDays.length === 0,
      stats: stats,
      fixCount: allFixes.length,
      failedDayNums: gate.failedDayNums,
      estimate: estimatePlacesRequests((hidden.days || []).length)
    };

    var renderOk = gate.ok && failedDays.length === 0;
    // Soft: if only soft issues remain and hard empty — ok
    if (!gate.ok && gate.failedDayNums && gate.failedDayNums.length) {
      renderOk = false;
    }

    return {
      hidden: hidden,
      renderOk: renderOk,
      gate: gate,
      failedDayNums: failedDays.length ? failedDays : gate.failedDayNums,
      fixes: allFixes,
      stats: stats
    };
  }

  // --- Test helpers / fixtures ---
  var SAPPORO_FIXTURES = {
    '札幌時計台': {
      placeId: 'fixture-clock-tower',
      canonicalName: '札幌市時計台',
      formattedAddress: '日本、〒060-0001 北海道札幌市中央区北1条西2丁目',
      lat: 43.0621,
      lng: 141.3535,
      types: ['tourist_attraction', 'museum'],
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: {
        periods: [
          {
            open: { day: 0, hour: 8, minute: 45 },
            close: { day: 0, hour: 17, minute: 10 }
          },
          {
            open: { day: 1, hour: 8, minute: 45 },
            close: { day: 1, hour: 17, minute: 10 }
          },
          {
            open: { day: 2, hour: 8, minute: 45 },
            close: { day: 2, hour: 17, minute: 10 }
          },
          {
            open: { day: 3, hour: 8, minute: 45 },
            close: { day: 3, hour: 17, minute: 10 }
          },
          {
            open: { day: 4, hour: 8, minute: 45 },
            close: { day: 4, hour: 17, minute: 10 }
          },
          {
            open: { day: 5, hour: 8, minute: 45 },
            close: { day: 5, hour: 17, minute: 10 }
          },
          {
            open: { day: 6, hour: 8, minute: 45 },
            close: { day: 6, hour: 17, minute: 10 }
          }
        ],
        weekdayDescriptions: ['Sunday: 8:45 AM – 5:10 PM']
      }
    },
    '白色戀人公園': {
      placeId: 'fixture-shiroi',
      canonicalName: '白い恋人パーク',
      formattedAddress: '日本、〒063-0052 北海道札幌市西区宮の沢2条2丁目',
      lat: 43.0892,
      lng: 141.2705,
      types: ['tourist_attraction', 'park'],
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: {
        periods: [0, 1, 2, 3, 4, 5, 6].map(function (d) {
          return {
            open: { day: d, hour: 10, minute: 0 },
            close: { day: d, hour: 18, minute: 0 }
          };
        })
      }
    },
    '札幌啤酒博物館': {
      placeId: 'fixture-beer-museum',
      canonicalName: 'サッポロビール博物館',
      formattedAddress: '日本、〒065-0007 北海道札幌市東区北7条東9丁目1-1',
      lat: 43.0712,
      lng: 141.3689,
      types: ['museum', 'tourist_attraction'],
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: {
        periods: [0, 1, 2, 3, 4, 5, 6].map(function (d) {
          return {
            open: { day: d, hour: 11, minute: 0 },
            close: { day: d, hour: 18, minute: 0 }
          };
        })
      }
    },
    // Closed Tuesdays museum fixture
    '火曜休館美術館': {
      placeId: 'fixture-tue-closed',
      canonicalName: '火曜休館美術館',
      formattedAddress: '北海道札幌市',
      lat: 43.06,
      lng: 141.35,
      types: ['museum'],
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: {
        periods: [0, 1, 3, 4, 5, 6].map(function (d) {
          return {
            open: { day: d, hour: 10, minute: 0 },
            close: { day: d, hour: 17, minute: 0 }
          };
        })
      }
    },
    // Split restaurant hours
    '分時段餐廳': {
      placeId: 'fixture-split-resto',
      canonicalName: '分時段餐廳',
      formattedAddress: '北海道札幌市',
      lat: 43.06,
      lng: 141.35,
      types: ['restaurant'],
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: {
        periods: [0, 1, 2, 3, 4, 5, 6].reduce(function (acc, d) {
          acc.push({
            open: { day: d, hour: 11, minute: 0 },
            close: { day: d, hour: 15, minute: 0 }
          });
          acc.push({
            open: { day: d, hour: 17, minute: 0 },
            close: { day: d, hour: 22, minute: 0 }
          });
          return acc;
        }, [])
      }
    },
    // Cross-midnight bar
    '跨午夜酒吧': {
      placeId: 'fixture-midnight-bar',
      canonicalName: '跨午夜酒吧',
      formattedAddress: '北海道札幌市',
      lat: 43.06,
      lng: 141.35,
      types: ['bar', 'night_club'],
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: {
        periods: [0, 1, 2, 3, 4, 5, 6].map(function (d) {
          return {
            open: { day: d, hour: 18, minute: 0 },
            close: { day: (d + 1) % 7, hour: 2, minute: 0 }
          };
        })
      }
    },
    // Wrong-city clock tower bait
    '東京時計台诱饵': {
      placeId: 'fixture-tokyo-clock',
      canonicalName: '某時計台',
      formattedAddress: '東京都千代田区',
      lat: 35.68,
      lng: 139.76,
      types: ['tourist_attraction'],
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: {
        periods: [
          {
            open: { day: 1, hour: 9, minute: 0 },
            close: { day: 1, hour: 21, minute: 0 }
          }
        ]
      }
    }
  };

  function fixtureResolver(query) {
    var q = String(query || '');
    var keys = Object.keys(SAPPORO_FIXTURES);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (q.indexOf(keys[i]) !== -1 || keys[i].indexOf(q) !== -1) {
        return normalizePlaceRecord(SAPPORO_FIXTURES[keys[i]]);
      }
    }
    if (/時計台/.test(q)) return normalizePlaceRecord(SAPPORO_FIXTURES['札幌時計台']);
    if (/白色戀人|白い恋人/.test(q)) return normalizePlaceRecord(SAPPORO_FIXTURES['白色戀人公園']);
    if (/啤酒博物館|ビール博物館/.test(q)) return normalizePlaceRecord(SAPPORO_FIXTURES['札幌啤酒博物館']);
    return null;
  }

  global.SOARVIBE_ITINERARY_PLACES_HOURS = Object.freeze({
    parseOpeningPeriods: parseOpeningPeriods,
    windowsForWeekday: windowsForWeekday,
    isClosedOnWeekday: isClosedOnWeekday,
    activityFitsWindows: activityFitsWindows,
    scorePlaceMatch: scorePlaceMatch,
    normalizePlaceRecord: normalizePlaceRecord,
    attachPlacesMeta: attachPlacesMeta,
    validateItemAgainstPlaces: validateItemAgainstPlaces,
    repairItemIntoWindows: repairItemIntoWindows,
    localRepairDay: localRepairDay,
    finalQaGateDay: finalQaGateDay,
    finalQaGateHidden: finalQaGateHidden,
    enrichAndGateHidden: enrichAndGateHidden,
    collectUniquePoiQueries: collectUniquePoiQueries,
    estimatePlacesRequests: estimatePlacesRequests,
    cacheKey: cacheKey,
    getCached: getCached,
    setCached: setCached,
    clearSessionCache: clearSessionCache,
    classifyPoiKind: classifyPoiKind,
    conservativeWindows: conservativeWindows,
    fixtureResolver: fixtureResolver,
    SAPPORO_FIXTURES: SAPPORO_FIXTURES,
    MAX_POI_RESOLVES_PER_TRIP: MAX_POI_RESOLVES_PER_TRIP,
    hhmmToMinutes: hhmmToMinutes,
    minutesToHhmm: minutesToHhmm
  });
})(typeof window !== 'undefined' ? window : globalThis);
