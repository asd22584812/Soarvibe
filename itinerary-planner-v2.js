/**
 * SoarVibe Planner v2 — deterministic schedule gate.
 *
 * Principle:
 *   AI proposes places / reasons.
 *   Planner owns timing, order, feasibility, and hard validation.
 *
 * Consumes existing hidden itinerary shape; does not rewrite Maps/Places/Gemini clients.
 */
(function (global) {
  'use strict';

  var DAY_MINUTES = 24 * 60;
  var MAX_FILLERS_PER_DAY = 2;
  var MAX_MAJOR_POI_SOFT = 6;

  var MEAL_WINDOWS = {
    breakfast: { min: 6 * 60, max: 10 * 60 + 30, label: '早餐' },
    lunch: { min: 11 * 60, max: 14 * 60 + 30, label: '午餐' },
    teatime: { min: 13 * 60 + 30, max: 18 * 60, label: '下午茶' },
    dinner: { min: 17 * 60, max: 22 * 60 + 30, label: '晚餐' },
    latenight: { min: 22 * 60 + 30, max: 26 * 60, label: '宵夜' }
  };

  function hhmmToMinutes(hhmm) {
    var m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return NaN;
    var h = parseInt(m[1], 10);
    var mi = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(mi) || h > 47 || mi > 59) return NaN;
    return h * 60 + mi;
  }

  function minutesToHhmm(total) {
    var t = ((Number(total) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    var h = Math.floor(t / 60);
    var mi = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
  }

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function titleOf(item) {
    return String((item && (item.title || item.name)) || '');
  }

  function classifyEventType(item) {
    var t = titleOf(item);
    var note = String((item && (item.note || item.transport || item.description || '')) || '');
    var blob = t + ' ' + note;
    var transferKind = classifyAirportTransfer(item);
    if (transferKind === 'ARRIVAL_TRANSFER' || /抵達機場|機場抵達|入境|提取行李|提領行李/i.test(blob)) {
      return 'arrival';
    }
    if (transferKind === 'DEPARTURE_TRANSFER' || /送機|前往機場|機場報到|辦理登機|出境手續/i.test(blob)) {
      return 'departure';
    }
    if (/移動|前往|搭乘|轉乘|步行至|transfer|transit/i.test(t) && !/餐廳|美食|景點/.test(t)) {
      return 'transport';
    }
    if (/返回飯店|回飯店|回住宿|check-?in|入住|飯店休息|酒店休息|休息整頓/i.test(blob)) {
      return 'rest';
    }
    if (/便利商店|超商|藥妝|唐吉訶德|Don\s*Quijote|7-?Eleven|全家|Lawson/i.test(blob)) {
      return 'optional';
    }
    if (/自由活動|自由時間|預留彈性/i.test(blob)) return 'optional';
    if (/早餐|午餐|晚餐|下午茶|宵夜|拉麵|壽司|咖啡|餐廳|食堂|美食|用餐/i.test(blob)) {
      return 'food';
    }
    if (/購物|Outlet|百貨|市場買/i.test(blob)) return 'shopping';
    if (/體驗|溫泉|SPA|夜景|觀景|酒吧|居酒屋|bar|nightlife/i.test(blob)) return 'experience';
    return 'attraction';
  }

  function isTransitionEvent(type) {
    return type === 'transport' || type === 'rest' || type === 'optional' || type === 'checkin';
  }

  /**
   * Direction-aware airport transfer classification.
   * ARRIVAL_TRANSFER = airport → city (must NOT arm departureLock)
   * DEPARTURE_TRANSFER = city → airport (arms departureLock)
   * UNKNOWN_TRANSFER = mentions Airport Express but direction unclear (do NOT lock)
   *
   * Prefer TITLE signals. Never let a long note span (前往城市 … 從機場) false-trigger departure.
   */
  function classifyAirportTransfer(item) {
    var t = titleOf(item);
    var note = String((item && (item.note || item.transport || item.description || item.highlight || '')) || '');
    var blob = t + ' ' + note;
    if (!/機場|空港|airport|CTS|NRT|HND|KIX|ITM|FUK|OKA/i.test(blob)) {
      return null;
    }

    function classifyText(text) {
      if (!text) return null;
      // Clear departure
      if (/送機|前往機場|赴機場|機場報到|辦理登機|出境手續|boarding|前往\s*CTS|前往\s*NRT|前往\s*HND/i.test(text)) {
        return 'DEPARTURE_TRANSFER';
      }
      if (
        /(札幌|東京|大阪|市區|住宿|飯店|Hotel|車站).{0,10}(→|->|至|往).{0,10}(機場|空港|CTS|NRT|HND|新千歲機場|成田)/i.test(
          text
        )
      ) {
        return 'DEPARTURE_TRANSFER';
      }
      if (/搭乘.{0,28}(Airport|機場快線).{0,20}(前往|到|至).{0,12}(機場|新千歲|成田|羽田|CTS|NRT|HND)/i.test(text)) {
        return 'DEPARTURE_TRANSFER';
      }
      if (/前往.{0,12}(新千歲|成田|羽田).{0,6}機場/i.test(text)) {
        return 'DEPARTURE_TRANSFER';
      }

      // Clear arrival: airport → city
      if (
        /(機場|空港|CTS|NRT|HND|新千歲|成田|羽田).{0,14}(→|->|至|往|前往|直達).{0,14}(札幌|東京|大阪|市區|住宿|飯店|車站)/i.test(
          text
        )
      ) {
        return 'ARRIVAL_TRANSFER';
      }
      if (/從.{0,10}(機場|空港|CTS|新千歲|成田).{0,28}(直達|前往|到|至).{0,14}(札幌|東京|市區|住宿|車站|飯店)/i.test(text)) {
        return 'ARRIVAL_TRANSFER';
      }
      if (/搭乘.{0,28}(Airport|機場快線).{0,20}(前往|直達|到|至).{0,12}(札幌|東京|大阪|市區|住宿|車站)/i.test(text)) {
        return 'ARRIVAL_TRANSFER';
      }
      if (/機場抵達|抵達.*機場|入境|提取行李|提領行李/i.test(text)) {
        return 'ARRIVAL_TRANSFER';
      }
      return null;
    }

    // Title wins when decisive
    var fromTitle = classifyText(t);
    if (fromTitle) return fromTitle;

    // Note only with short, clause-local patterns (avoid cross-sentence false locks)
    var fromNote = classifyText(note);
    if (fromNote) return fromNote;

    if (/Airport Express|機場快線|Airport號|JR快速Airport/i.test(blob)) {
      return 'UNKNOWN_TRANSFER';
    }
    return 'UNKNOWN_TRANSFER';
  }

  function isDepartureTransfer(item) {
    return classifyAirportTransfer(item) === 'DEPARTURE_TRANSFER';
  }

  function isArrivalTransfer(item) {
    return classifyAirportTransfer(item) === 'ARRIVAL_TRANSFER';
  }

  /** True airport → city transfer (excludes immigration/baggage still at airport). */
  function isAirportToCityTransfer(item) {
    if (!isArrivalTransfer(item)) return false;
    var t = titleOf(item);
    if (/入境|提取行李|提領行李|通關/.test(t) && !/(→|->|至|往|前往).{0,20}(札幌|東京|大阪|市區|車站|住宿)/.test(t)) {
      return false;
    }
    if (
      /(機場|空港|CTS|新千歲).{0,20}(→|->|至|往|前往).{0,20}(札幌|東京|大阪|市區|車站|住宿)/i.test(t) ||
      /Airport號|機場快線|Airport Express/i.test(t)
    ) {
      return true;
    }
    // Arrival transfer classified by direction patterns but not immigration
    return !/入境|提取行李|提領行李/.test(t);
  }

  function isAirportOrArrivalEvent(item) {
    var type = item.eventType || classifyEventType(item);
    if (type === 'arrival' || type === 'departure') return true;
    var kind = classifyAirportTransfer(item);
    if (kind === 'ARRIVAL_TRANSFER' || kind === 'DEPARTURE_TRANSFER') return true;
    // Do NOT treat bare "Airport Express" / unknown as locking airport event
    return /入境|送機|前往機場|機場報到|辦理登機/i.test(titleOf(item));
  }

  function isUserRequested(item) {
    return !!(item && (item.__userRequested || (item.__style && item.__style.userRequested)));
  }

  function recordUnfulfilledDrop(meta, item, reason, stage) {
    if (!meta) return;
    meta.unfulfilledUserRequest = meta.unfulfilledUserRequest || [];
    meta.unfulfilledUserRequest.push({
      request: titleOf(item),
      matchedItem: titleOf(item),
      reason: reason || 'hard_reality',
      stage: stage || 'planner',
      status: 'unfulfilled'
    });
  }

  /** Late-night eligibility for schedule repair (not a blanket midnight ban). */
  function lateNightEligibility(item) {
    var t = titleOf(item);
    var type = item.eventType || classifyEventType(item);
    var blob = t + ' ' + String((item && (item.note || item.description || '')) || '');
    if (isAirportOrArrivalEvent(item) || type === 'transport' || /移動|前往|搭乘|轉乘|步行/i.test(t)) {
      return { nightlifeEligible: false, lateMealEligible: false, transportEligible: true, hotelReturnEligible: false };
    }
    if (type === 'rest' || /返回住宿|返回飯店|回飯店|休息/i.test(t)) {
      return { nightlifeEligible: false, lateMealEligible: false, transportEligible: false, hotelReturnEligible: true };
    }
    if (/酒吧|bar|居酒屋|夜店|club|nightlife|薄野|歌舞伎町|黃金街|Golden Gai|Bar\s/i.test(blob)) {
      return { nightlifeEligible: true, lateMealEligible: true, transportEligible: false, hotelReturnEligible: false };
    }
    if (type === 'food' || /宵夜|拉麵|深夜|居酒屋|燒肉|酒吧/i.test(blob)) {
      return { nightlifeEligible: false, lateMealEligible: true, transportEligible: false, hotelReturnEligible: false };
    }
    // General daytime city POIs are NOT midnight-eligible
    return { nightlifeEligible: false, lateMealEligible: false, transportEligible: false, hotelReturnEligible: false };
  }

  function canOccupyDeepNight(item, startAbs) {
    if (isNaN(startAbs)) return true;
    var clock = ((startAbs % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    var crosses = startAbs >= DAY_MINUTES;
    // Same-day daytime / evening before midnight: always OK
    if (!crosses && clock >= 5 * 60) return true;

    // After midnight window (00:00–04:59)
    var el = lateNightEligibility(item);
    if (el.hotelReturnEligible || el.transportEligible) return clock <= 2 * 60; // ≤ 02:00
    if (el.nightlifeEligible) return clock <= 2 * 60 + 30; // ≤ 02:30
    if (el.lateMealEligible) return clock <= 60; // ≤ 01:00 only (no 03:xx cafe)
    return false;
  }

  function inferMealKind(item) {
    var t = titleOf(item);
    if (/早餐|breakfast/i.test(t)) return 'breakfast';
    if (/午餐|lunch/i.test(t)) return 'lunch';
    if (/下午茶|tea\s*time|甜點|咖啡廳/i.test(t)) return 'teatime';
    if (/宵夜|深夜食堂|酒吧|bar/i.test(t)) return 'latenight';
    if (/晚餐|dinner|居酒屋|燒肉|壽司/i.test(t)) return 'dinner';
    return null;
  }

  /**
   * Absolute timeline within a day schedule:
   * startAbs / endAbs measured from day local 00:00.
   * endDayOffset=1 means ends after midnight.
   */
  function normalizeItemTimeModel(item, dayIndex) {
    item = item || {};
    var startClock = hhmmToMinutes(item.startTime);
    var endClock = hhmmToMinutes(item.endTime);
    var startDayOffset = Number(item.startDayOffset) || 0;
    var endDayOffset = Number(item.endDayOffset) || 0;

    if (isNaN(startClock) && !isNaN(endClock)) startClock = endClock;
    if (!isNaN(startClock) && isNaN(endClock)) {
      endClock = startClock + 45;
      if (endClock >= DAY_MINUTES) {
        endDayOffset = 1;
        endClock = endClock - DAY_MINUTES;
      }
    }
    if (!isNaN(startClock) && !isNaN(endClock)) {
      if (endDayOffset === 0 && endClock < startClock) endDayOffset = 1;
      if (endClock === startClock && endDayOffset === 0) {
        endClock = startClock + 30;
        if (endClock >= DAY_MINUTES) {
          endDayOffset = 1;
          endClock = endClock - DAY_MINUTES;
        }
      }
    }

    var startAbs = isNaN(startClock) ? NaN : startDayOffset * DAY_MINUTES + startClock;
    var endAbs = isNaN(endClock) ? NaN : endDayOffset * DAY_MINUTES + endClock;
    if (!isNaN(startAbs) && !isNaN(endAbs) && endAbs <= startAbs) {
      endAbs = startAbs + 30;
      endDayOffset = Math.floor(endAbs / DAY_MINUTES);
      endClock = endAbs % DAY_MINUTES;
    }

    return {
      dayIndex: dayIndex || 0,
      startMinute: startClock,
      endMinute: endClock,
      startDayOffset: startDayOffset,
      endDayOffset: endDayOffset,
      startAbs: startAbs,
      endAbs: endAbs,
      crossesMidnight: endDayOffset > startDayOffset
    };
  }

  function applyTimeModel(item, model) {
    if (!item || !model) return item;
    item.startTime = isNaN(model.startMinute) ? item.startTime : minutesToHhmm(model.startMinute);
    item.endTime = isNaN(model.endMinute) ? item.endTime : minutesToHhmm(model.endMinute);
    item.startMinutes = model.startMinute;
    item.endMinutes = model.endMinute;
    item.startDayOffset = model.startDayOffset;
    item.endDayOffset = model.endDayOffset;
    item.startAbs = model.startAbs;
    item.endAbs = model.endAbs;
    item.crossesMidnight = !!model.crossesMidnight;
    if (item.startTime && item.endTime) {
      item.timeLabel = item.startTime + ' - ' + item.endTime + (model.crossesMidnight ? ' (+1)' : '');
    }
    return item;
  }

  function setAbsRange(item, startAbs, endAbs, dayIndex) {
    var s = Math.max(0, Math.round(startAbs));
    var e = Math.max(s + 20, Math.round(endAbs));
    var model = {
      dayIndex: dayIndex || 0,
      startMinute: s % DAY_MINUTES,
      endMinute: e % DAY_MINUTES,
      startDayOffset: Math.floor(s / DAY_MINUTES),
      endDayOffset: Math.floor(e / DAY_MINUTES),
      startAbs: s,
      endAbs: e,
      crossesMidnight: Math.floor(e / DAY_MINUTES) > Math.floor(s / DAY_MINUTES)
    };
    return applyTimeModel(item, model);
  }

  function flattenDay(day, dayIndex) {
    var out = [];
    (day && day.phases ? day.phases : []).forEach(function (phase) {
      (phase.items || []).forEach(function (it) {
        if (!it) return;
        var copy = Object.assign({}, it);
        copy.period = copy.period || phase.label || phase.period || '';
        copy.eventType = copy.eventType || classifyEventType(copy);
        var model = normalizeItemTimeModel(copy, dayIndex);
        applyTimeModel(copy, model);
        out.push(copy);
      });
    });
    return out;
  }

  function sortByAbs(items) {
    return (items || []).slice().sort(function (a, b) {
      var aa = isNaN(a.startAbs) ? Number.POSITIVE_INFINITY : a.startAbs;
      var bb = isNaN(b.startAbs) ? Number.POSITIVE_INFINITY : b.startAbs;
      if (aa !== bb) return aa - bb;
      var ea = isNaN(a.endAbs) ? aa : a.endAbs;
      var eb = isNaN(b.endAbs) ? bb : b.endAbs;
      return ea - eb;
    });
  }

  function rebuildDayPhases(day, items) {
    var buckets = { 上午: [], 下午: [], 晚上: [] };
    sortByAbs(items).forEach(function (it) {
      var m = isNaN(it.startMinutes) ? 12 * 60 : it.startMinutes;
      var label = m < 12 * 60 ? '上午' : m < 17 * 60 ? '下午' : '晚上';
      if (it.crossesMidnight && m < 5 * 60) label = '晚上';
      it.period = label;
      buckets[label].push(it);
    });
    var emoji = { 上午: '☀️', 下午: '🌤', 晚上: '🌙' };
    day.phases = ['上午', '下午', '晚上']
      .filter(function (k) {
        return buckets[k].length;
      })
      .map(function (k) {
        return { label: k, period: k, emoji: emoji[k], items: buckets[k] };
      });
    return day;
  }

  function getEarliestSightseeingMin(meta) {
    var buffers =
      (meta && meta.flightTimeEngine && meta.flightTimeEngine.buffers) ||
      (meta && meta.buffers) ||
      {};
    var hhmm =
      buffers.earliestSightseeingHhmm ||
      (meta && meta.earliestSightseeingHhmm) ||
      '';
    return hhmmToMinutes(hhmm);
  }

  function getLatestLeaveMin(meta) {
    var buffers =
      (meta && meta.flightTimeEngine && meta.flightTimeEngine.buffers) ||
      (meta && meta.buffers) ||
      {};
    var hhmm =
      buffers.latestLeaveForAirportHhmm ||
      (meta && meta.latestLeaveForAirportHhmm) ||
      '';
    return hhmmToMinutes(hhmm);
  }

  function estimateGapMinutes(a, b) {
    if (a && a.__routeToNext && typeof a.__routeToNext.estimatedMinutes === 'number') {
      return Math.max(10, a.__routeToNext.estimatedMinutes);
    }
    var engine = global.SOARVIBE_TRAVEL_TIME_ENGINE;
    if (engine && typeof engine.estimateTransferMinutes === 'function') {
      try {
        var est = engine.estimateTransferMinutes(titleOf(a), titleOf(b), 'transit');
        if (est && typeof est.estimatedMinutes === 'number') {
          return Math.max(10, est.estimatedMinutes);
        }
      } catch (e) {
        /* fall through */
      }
    }
    if (isTransitionEvent(a.eventType) || isTransitionEvent(b.eventType)) return 10;
    return 20;
  }

  function getPlacesHoursApi() {
    return global.SOARVIBE_ITINERARY_PLACES_HOURS || null;
  }

  function getRouteDurationApi() {
    return global.SOARVIBE_ROUTE_DURATION || null;
  }

  function getStyleEngineApi() {
    return global.SOARVIBE_STYLE_ENGINE || null;
  }

  function weekdayForDay(day, dayIndex, meta) {
    meta = meta || {};
    var dateStart = meta.dateStart || (meta.meta && meta.meta.dateStart) || '';
    if (dateStart && day && day.dayNum) {
      var base = new Date(String(dateStart).slice(0, 10) + 'T12:00:00');
      if (!isNaN(base.getTime())) {
        base.setDate(base.getDate() + (Number(day.dayNum) - 1));
        return base.getDay();
      }
    }
    if (typeof meta.weekday === 'number') return meta.weekday;
    return new Date().getDay();
  }

  /**
   * Sync Places hours gate using catalog / already-attached __places.
   */
  function applyPlacesHoursGateSync(hidden, meta, repairs) {
    var PH = getPlacesHoursApi();
    if (!PH) return { hidden: hidden, placesReport: null };
    repairs = repairs || [];
    var placesIssues = [];
    var days = hidden.days || [];
    days.forEach(function (day, dayIndex) {
      var weekday = weekdayForDay(day, dayIndex, meta);
      var repaired = PH.localRepairDay(day, {
        weekday: weekday,
        styleKey: (meta && meta.travelStyle) || ''
      });
      hidden.days[dayIndex] = repaired.day;
      (repaired.fixes || []).forEach(function (f) {
        repairs.push(Object.assign({ type: f.type || 'places_repair', day: day.dayNum || dayIndex + 1 }, f));
      });
      (repaired.issues || []).forEach(function (iss) {
        placesIssues.push(iss);
      });
      if (!repaired.ok) {
        placesIssues.push({
          type: 'places_day_failed',
          day: day.dayNum || dayIndex + 1,
          needsReplan: !!repaired.needsReplan
        });
      }
    });
    hidden.meta = hidden.meta || {};
    hidden.meta.placesHoursGate = {
      issueCount: placesIssues.length,
      issues: placesIssues.slice(0, 40)
    };
    return { hidden: hidden, placesReport: hidden.meta.placesHoursGate };
  }

  function validateRouteGaps(hidden, meta) {
    var issues = [];
    (hidden.days || []).forEach(function (day, dayIndex) {
      var items = sortByAbs(flattenDay(day, dayIndex));
      var i;
      for (i = 0; i < items.length - 1; i++) {
        var a = items[i];
        var b = items[i + 1];
        if (!a.__routeToNext || isNaN(a.endAbs) || isNaN(b.startAbs)) continue;
        var need = Math.max(10, a.__routeToNext.estimatedMinutes || 0);
        var gap = b.startAbs - a.endAbs;
        if (gap < need) {
          issues.push(
            issue('route_duration_shortfall', gap < 0 ? 'error' : 'error', {
              day: day.dayNum || dayIndex + 1,
              from: titleOf(a),
              to: titleOf(b),
              needMinutes: need,
              actualGap: gap,
              source: a.__routeToNext.source
            })
          );
        }
      }
    });
    return issues;
  }

  function repairRouteGaps(hidden, meta, repairs) {
    repairs = repairs || [];
    (hidden.days || []).forEach(function (day, dayIndex) {
      var dayNum = day.dayNum || dayIndex + 1;
      var items = sortByAbs(flattenDay(day, dayIndex));
      var i;
      for (i = 0; i < items.length - 1; i++) {
        var a = items[i];
        var b = items[i + 1];
        if (isNaN(a.endAbs) || isNaN(b.startAbs)) continue;
        var need = estimateGapMinutes(a, b);
        if (b.startAbs >= a.endAbs + need) continue;
        // GUARDRAIL: do not shift Gemini times — only record
        repairs.push({
          type: 'route_gap_flag',
          day: dayNum,
          title: titleOf(b),
          needMinutes: need,
          from: titleOf(a)
        });
      }
      rebuildDayPhases(day, items);
    });
    return hidden;
  }

  function mergeValidation(base, extraIssues) {
    var issues = (base.issues || []).concat(extraIssues || []);
    var blockers = issues.filter(function (x) {
      return x.severity === 'error';
    });
    return { ok: blockers.length === 0, issues: issues, blockers: blockers };
  }

  function issue(type, severity, payload) {
    return Object.assign({ type: type, severity: severity || 'error' }, payload || {});
  }

  /**
   * Hard validation — returns issues. Blockers = severity error.
   */
  function validateItinerary(hidden, meta) {
    hidden = hidden || {};
    meta = meta || {};
    var issues = [];
    var days = hidden.days || [];
    var earliest = getEarliestSightseeingMin(meta);
    var latest = getLatestLeaveMin(meta);

    days.forEach(function (day, dayIndex) {
      var items = sortByAbs(flattenDay(day, dayIndex));
      var fillers = 0;
      var majors = 0;
      var i;

      for (i = 0; i < items.length; i++) {
        var it = items[i];
        var type = it.eventType || classifyEventType(it);
        if (isTransitionEvent(type)) fillers += 1;
        else if (type === 'attraction' || type === 'experience' || type === 'food') majors += 1;

        if (dayIndex === 0 && !isNaN(earliest) && !isNaN(it.startAbs)) {
          if (!isAirportOrArrivalEvent(it) && it.startAbs < earliest) {
            issues.push(
              issue('before_arrival', 'error', {
                day: day.dayNum || dayIndex + 1,
                title: titleOf(it),
                startTime: it.startTime,
                earliestSightseeingHhmm: minutesToHhmm(earliest)
              })
            );
          }
          if (
            type === 'rest' &&
            /返回|回飯店|休息/i.test(titleOf(it)) &&
            it.startAbs < earliest
          ) {
            issues.push(
              issue('return_before_arrival', 'error', {
                day: day.dayNum || dayIndex + 1,
                title: titleOf(it),
                startTime: it.startTime
              })
            );
          }
        }

        if (dayIndex === days.length - 1 && !isNaN(latest) && !isNaN(it.endAbs)) {
          if (!isAirportOrArrivalEvent(it) && it.endAbs > latest && it.endAbs < DAY_MINUTES) {
            issues.push(
              issue('after_departure_buffer', 'error', {
                day: day.dayNum || dayIndex + 1,
                title: titleOf(it),
                endTime: it.endTime
              })
            );
          }
        }

        var meal = inferMealKind(it);
        if (meal && !isNaN(it.startMinutes)) {
          var win = MEAL_WINDOWS[meal];
          var startCmp = it.startAbs;
          if (win && !isNaN(startCmp)) {
            if (meal === 'teatime' && startCmp >= 19 * 60) {
              issues.push(
                issue('suspicious_meal_window', 'warn', {
                  day: day.dayNum || dayIndex + 1,
                  title: titleOf(it),
                  meal: meal,
                  startTime: it.startTime
                })
              );
            }
            if (meal === 'dinner' && (startCmp >= 24 * 60 || startCmp < 5 * 60)) {
              issues.push(
                issue('suspicious_meal_window', 'error', {
                  day: day.dayNum || dayIndex + 1,
                  title: titleOf(it),
                  meal: meal,
                  startTime: it.startTime
                })
              );
            }
            if (meal === 'dinner' && startCmp >= 22 * 60 + 30 && startCmp < 24 * 60) {
              issues.push(
                issue('suspicious_meal_window', 'warn', {
                  day: day.dayNum || dayIndex + 1,
                  title: titleOf(it),
                  meal: meal,
                  startTime: it.startTime
                })
              );
            }
          }
        }

        if (i > 0) {
          var prev = items[i - 1];
          if (!isNaN(prev.endAbs) && !isNaN(it.startAbs)) {
            if (it.startAbs < prev.startAbs) {
              issues.push(
                issue('chrono_order', 'error', {
                  day: day.dayNum || dayIndex + 1,
                  from: titleOf(prev),
                  to: titleOf(it)
                })
              );
            }
            if (it.startAbs < prev.endAbs) {
              issues.push(
                issue('overlap', 'error', {
                  day: day.dayNum || dayIndex + 1,
                  from: titleOf(prev),
                  to: titleOf(it),
                  fromRange: prev.startTime + '-' + prev.endTime,
                  toRange: it.startTime + '-' + it.endTime
                })
              );
            } else {
              var need = estimateGapMinutes(prev, it);
              if (it.startAbs - prev.endAbs < need && !isTransitionEvent(type)) {
                issues.push(
                  issue('travel_buffer', 'warn', {
                    day: day.dayNum || dayIndex + 1,
                    from: titleOf(prev),
                    to: titleOf(it),
                    needMinutes: need,
                    actualGap: it.startAbs - prev.endAbs
                  })
                );
              }
            }
          }
        }
      }

      if (fillers > MAX_FILLERS_PER_DAY) {
        issues.push(
          issue('excessive_filler', 'warn', {
            day: day.dayNum || dayIndex + 1,
            fillers: fillers,
            max: MAX_FILLERS_PER_DAY
          })
        );
      }
      if (majors > MAX_MAJOR_POI_SOFT + 2) {
        issues.push(
          issue('excessive_density', 'warn', {
            day: day.dayNum || dayIndex + 1,
            majors: majors
          })
        );
      }
    });

    var blockers = issues.filter(function (x) {
      return x.severity === 'error';
    });
    return {
      ok: blockers.length === 0,
      issues: issues,
      blockers: blockers
    };
  }

  function demoteOrDropFillers(items, repairs, dayNum) {
    var fillers = items.filter(function (it) {
      return isTransitionEvent(it.eventType || classifyEventType(it));
    });
    if (fillers.length <= MAX_FILLERS_PER_DAY) return items;
    // Keep at most one rest at end + optional convenience; drop extras
    var keptRest = false;
    var keptOptional = false;
    var next = [];
    items.forEach(function (it) {
      var type = it.eventType || classifyEventType(it);
      if (!isTransitionEvent(type)) {
        next.push(it);
        return;
      }
      if (isUserRequested(it)) {
        next.push(it);
        return;
      }
      if (type === 'rest' && !keptRest) {
        keptRest = true;
        next.push(it);
        return;
      }
      if (type === 'optional' && !keptOptional) {
        keptOptional = true;
        next.push(it);
        return;
      }
      // Keep arrival/departure transfers even if classified transport-like
      if (isArrivalTransfer(it) || isDepartureTransfer(it)) {
        next.push(it);
        return;
      }
      repairs.push({
        type: 'drop_filler',
        day: dayNum,
        title: titleOf(it)
      });
    });
    return next;
  }

  function stripMealPrefixes(title) {
    var t = String(title || '').trim();
    var prev;
    do {
      prev = t;
      t = t.replace(/^(早餐|早午餐|午餐|下午茶|晚餐|宵夜)[：:]\s*/i, '').trim();
    } while (t !== prev);
    return t;
  }

  function withMealPrefix(title, label) {
    var base = stripMealPrefixes(title);
    if (!base) return label + '：';
    return label + '：' + base;
  }

  function repairMealLabels(items, repairs, dayNum) {
    return items.map(function (it) {
      var meal = inferMealKind(it);
      if (!meal) return it;
      // Idempotent: collapse repeated meal prefixes first
      var cleaned = stripMealPrefixes(titleOf(it));
      if (cleaned !== titleOf(it) && /^(早餐|午餐|下午茶|晚餐|宵夜)/.test(titleOf(it))) {
        var labelMap = {
          breakfast: '早餐',
          lunch: '午餐',
          teatime: '下午茶',
          dinner: '晚餐',
          latenight: '宵夜'
        };
        var existingLabel = (titleOf(it).match(/^(早餐|午餐|下午茶|晚餐|宵夜)/) || [])[1];
        it.title = withMealPrefix(cleaned, existingLabel || labelMap[meal] || '晚餐');
        repairs.push({
          type: 'meal_prefix_idempotent',
          day: dayNum,
          to: it.title
        });
      }
      if (meal === 'teatime' && !isNaN(it.startAbs) && it.startAbs >= 19 * 60 && it.startAbs < 24 * 60) {
        var old = titleOf(it);
        it.title = withMealPrefix(old, '晚餐');
        it.eventType = 'food';
        repairs.push({
          type: 'relabel_meal',
          day: dayNum,
          from: old,
          to: it.title,
          reason: 'teatime_too_late'
        });
      }
      // Do NOT shift dinner times — Gemini owns schedule
      return it;
    });
  }

  function districtHint(title) {
    var t = String(title || '');
    if (/小樽|Otaru/i.test(t)) return 'otaru';
    if (/新千歲|CTS|機場|Airport/i.test(t)) return 'airport';
    if (/薄野|Susukino/i.test(t)) return 'susukino';
    if (/大通|電視塔|時計台|札幌站|狸小路|二条|北海道大學|札幌/i.test(t)) return 'sapporo';
    if (/秋葉原|淺草|澀谷|新宿|上野|原宿|東京/i.test(t)) return 'tokyo';
    return '';
  }

  function detectGeographicPingPong(items, repairs, dayNum) {
    var trail = [];
    items.forEach(function (it) {
      var d = districtHint(titleOf(it));
      if (!d || d === 'airport') return;
      if (trail.length && trail[trail.length - 1] === d) return;
      trail.push(d);
    });
    // A → B → A within same day without airport
    if (trail.length >= 3) {
      var i;
      for (i = 0; i < trail.length - 2; i++) {
        if (trail[i] === trail[i + 2] && trail[i] !== trail[i + 1]) {
          repairs.push({
            type: 'geographic_ping_pong',
            day: dayNum,
            path: trail.slice(i, i + 3).join('→'),
            severity: 'error'
          });
        }
      }
    }
  }

  function fixMidnightInMiddle(items, repairs, dayNum) {
    // If 00:xx–04:xx (offset 0) sits between two daytime clocks, it is INVALID UI order.
    var out = [];
    var i;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var clock = isNaN(it.startMinutes) ? NaN : it.startMinutes;
      var offset = Number(it.startDayOffset) || 0;
      var isDeep = offset === 0 && !isNaN(clock) && clock < 5 * 60;
      if (!isDeep) {
        out.push(it);
        continue;
      }
      var prev = out.length ? out[out.length - 1] : null;
      var next = items[i + 1] || null;
      var prevDay =
        prev &&
        !isNaN(prev.startMinutes) &&
        (Number(prev.startDayOffset) || 0) === 0 &&
        prev.startMinutes >= 8 * 60;
      var nextDay =
        next &&
        !isNaN(next.startMinutes) &&
        (Number(next.startDayOffset) || 0) === 0 &&
        next.startMinutes >= 8 * 60;
      if (prevDay && nextDay) {
        var type = it.eventType || classifyEventType(it);
        // Minimal repair: adjust ordering / shift time within same day — keep POI identity
        var parkStart = Math.max(
          type === 'rest' || /返回/.test(titleOf(it)) ? 21 * 60 : 22 * 60,
          (prev.endAbs || prev.startAbs || 21 * 60) + 15
        );
        var stayFix = Math.max(
          30,
          isNaN(it.endAbs) || isNaN(it.startAbs) ? 40 : Math.max(25, it.endAbs - it.startAbs)
        );
        setAbsRange(it, parkStart, parkStart + stayFix, 0);
        repairs.push({
          type:
            type === 'rest' || /返回/.test(titleOf(it))
              ? 'fix_midnight_in_middle_rest'
              : 'reorder_midnight_in_middle',
          day: dayNum,
          title: titleOf(it)
        });
        out.push(it);
        continue;
      }
      out.push(it);
    }
    return out;
  }

  function repairDayItems(items, dayIndex, dayCount, meta, repairs, dayNum) {
    var earliest = getEarliestSightseeingMin(meta);
    var i;

    // Arrival day: drop city/meal/rest that appear before the first airport presence
    // Only when this day actually contains an airport arrival event.
    if (dayNum === 1) {
      var hasAirportArrival = items.some(function (x) {
        return (
          isAirportOrArrivalEvent(x) ||
          /抵達.*機場|機場抵達|入境|新千歲|仁川|成田|羽田|CTS|NRT|HND/i.test(titleOf(x))
        );
      });
      if (hasAirportArrival) {
        var sawAirportPresence = false;
        var cleanedEarly = [];
        for (i = 0; i < items.length; i++) {
          var early = items[i];
          if (
            isAirportOrArrivalEvent(early) ||
            /抵達.*機場|機場抵達|入境|新千歲|仁川|成田|羽田|CTS|NRT|HND/i.test(titleOf(early))
          ) {
            sawAirportPresence = true;
            cleanedEarly.push(early);
            continue;
          }
          if (!sawAirportPresence) {
            var et = early.eventType || classifyEventType(early);
            if (
              et === 'rest' ||
              et === 'food' ||
              et === 'attraction' ||
              et === 'shopping' ||
              /早餐|午餐|晚餐|返回|休息|逛|公園|百貨/.test(titleOf(early))
            ) {
              repairs.push({
                type: 'drop_before_airport_arrival',
                day: dayNum,
                title: titleOf(early)
              });
              continue;
            }
          }
          cleanedEarly.push(early);
        }
        items = cleanedEarly;
      }
    }

    // Arrival day (Day 1): hotel/rest MUST NOT appear before airport→city transfer
    // Sequence: airport → immigration/baggage → transfer → hotel/city
    // Only activate when this day actually contains an airport→city transfer.
    if (dayNum === 1) {
      var hasCityTransfer = items.some(function (x) {
        return isAirportToCityTransfer(x);
      });
      if (hasCityTransfer) {
        var sawCityTransfer = false;
        var cleaned = [];
        for (i = 0; i < items.length; i++) {
          var it0 = items[i];
          if (isAirportToCityTransfer(it0)) {
            sawCityTransfer = true;
            cleaned.push(it0);
            continue;
          }
          if (
            !sawCityTransfer &&
            (/返回住宿|返回飯店|休息|check[- ]?in/i.test(titleOf(it0)) ||
              (it0.eventType || classifyEventType(it0)) === 'rest')
          ) {
            if (/入境|提取行李|提領行李|抵達/.test(titleOf(it0)) || isAirportOrArrivalEvent(it0)) {
              cleaned.push(it0);
              continue;
            }
            repairs.push({
              type: 'drop_hotel_return_before_arrival_transfer',
              day: dayNum,
              title: titleOf(it0)
            });
            continue;
          }
          cleaned.push(it0);
        }
        items = cleaned;
      }
    }

    items = repairMealLabels(items, repairs, dayNum);
    items = sortByAbs(items);
    items = fixMidnightInMiddle(items, repairs, dayNum);
    items = sortByAbs(items);

    // Departure lock only for true DEPARTURE_TRANSFER
    var departureLock = false;
    items = items.filter(function (it) {
      if (isDepartureTransfer(it)) {
        departureLock = true;
        return true;
      }
      if (isArrivalTransfer(it) || classifyAirportTransfer(it) === 'UNKNOWN_TRANSFER') {
        return true;
      }
      if (!departureLock) return true;
      if (isTransitionEvent(it.eventType || classifyEventType(it))) {
        if ((it.eventType || classifyEventType(it)) === 'rest') return false;
        return true;
      }
      if (isUserRequested(it)) {
        recordUnfulfilledDrop(meta, it, 'after_departure_airport_lock', 'planner');
      }
      repairs.push({
        type: 'drop_city_after_airport_transfer',
        day: dayNum,
        title: titleOf(it)
      });
      return false;
    });

    // Soft-drop duplicate major landmarks (not user-requested) — title-identical only
    var seenCanon = {};
    items = items.filter(function (it) {
      var type = it.eventType || classifyEventType(it);
      if (type === 'transport' || type === 'rest' || type === 'optional') return true;
      if (isAirportOrArrivalEvent(it)) return true;
      var canon = String(titleOf(it))
        .replace(/[（(].*$/, '')
        .replace(/\s+/g, '')
        .slice(0, 24);
      if (!canon) return true;
      if (seenCanon[canon]) {
        if (isUserRequested(it)) return true;
        repairs.push({ type: 'drop_duplicate_poi', day: dayNum, title: titleOf(it) });
        return false;
      }
      seenCanon[canon] = true;
      return true;
    });

    detectGeographicPingPong(items, repairs, dayNum);

    // Drop orphan early rest at day start (not day 0 arrival case already handled)
    if (dayIndex > 0 && items.length) {
      while (
        items.length &&
        /返回住宿|返回飯店|休息/.test(titleOf(items[0])) &&
        !isNaN(items[0].startAbs) &&
        items[0].startAbs < 8 * 60 &&
        (Number(items[0].startDayOffset) || 0) === 0
      ) {
        repairs.push({
          type: 'drop_orphan_early_rest',
          day: dayNum,
          title: titleOf(items[0])
        });
        items.shift();
      }
    }

    // Minimal repair only — never invent POI / restaurant / attraction / shopping
    return sortByAbs(items);
  }

  function canonicalPoiKey(title) {
    return String(title || '')
      .replace(/^(早餐|早午餐|午餐|下午茶|晚餐|宵夜)[：:]\s*/i, '')
      .replace(/[（(].*$/, '')
      .replace(/\s+/g, '')
      .slice(0, 28);
  }

  function isMeaningfulPoiItem(it) {
    var type = (it && it.eventType) || classifyEventType(it);
    if (type === 'transport' || type === 'rest' || type === 'optional') return false;
    if (isAirportOrArrivalEvent(it)) return false;
    if (isFillerTitle && isFillerTitle(titleOf(it))) return false;
    if (/返回住宿|返回飯店|休息|自由活動|便利商店|藥妝|移動/.test(titleOf(it))) return false;
    var key = canonicalPoiKey(titleOf(it));
    return !!(key && key.length >= 2);
  }

  function isFillerTitle(title) {
    return /返回住宿|返回飯店|休息|自由活動|便利商店|藥妝|移動前往|純移動/.test(String(title || ''));
  }

  /**
   * Compare Gemini raw vs final for intent preservation (14.1).
   * Success = legal schedule WITHOUT destroying Gemini travel intent.
   */
  function measureIntentPreservation(rawHidden, finalHidden, meta) {
    meta = meta || {};
    rawHidden = rawHidden || { days: [] };
    finalHidden = finalHidden || { days: [] };

    function collect(hidden) {
      var pois = [];
      var meals = [];
      var districts = {};
      var notes = [];
      var transports = [];
      (hidden.days || []).forEach(function (day) {
        flattenDay(day).forEach(function (it) {
          var t = titleOf(it);
          var note = String(it.note || it.highlight || it.transport || '');
          if (note) notes.push(note.slice(0, 80));
          if (/JR|機場|搭乘|步行|地鐵|巴士|→|->/.test(t) || (it.eventType || '') === 'transport') {
            transports.push(t);
          }
          if (inferMealKind(it) || /^(早餐|午餐|下午茶|晚餐|宵夜)/.test(t)) {
            meals.push(canonicalPoiKey(t) || t);
          }
          var d = districtHint(t);
          if (d) districts[d] = true;
          if (isMeaningfulPoiItem(it)) {
            pois.push(canonicalPoiKey(t));
          }
        });
      });
      return { pois: pois, meals: meals, districts: districts, notes: notes, transports: transports };
    }

    var raw = collect(rawHidden);
    var fin = collect(finalHidden);
    var rawSet = {};
    raw.pois.forEach(function (k) {
      if (k) rawSet[k] = true;
    });
    var preserved = fin.pois.filter(function (k) {
      return k && rawSet[k];
    });
    // unique preserved
    var preservedSet = {};
    preserved.forEach(function (k) {
      preservedSet[k] = true;
    });
    var preservedPoiCount = Object.keys(preservedSet).length;
    var rawPoiCount = Object.keys(rawSet).length;
    var finalSet = {};
    fin.pois.forEach(function (k) {
      if (k) finalSet[k] = true;
    });
    var finalPoiCount = Object.keys(finalSet).length;
    var poiPreservationRate = rawPoiCount ? preservedPoiCount / rawPoiCount : 1;

    var rawMeals = {};
    raw.meals.forEach(function (m) {
      rawMeals[m] = true;
    });
    var mealPreserved = fin.meals.filter(function (m) {
      return rawMeals[m];
    }).length;
    var mealPreservationRate = raw.meals.length ? mealPreserved / Object.keys(rawMeals).length : 1;

    var districtPreserved = 0;
    var rawDistricts = Object.keys(raw.districts);
    rawDistricts.forEach(function (d) {
      if (fin.districts[d]) districtPreserved += 1;
    });
    var districtPreservationRate = rawDistricts.length ? districtPreserved / rawDistricts.length : 1;

    var wishes = String(meta.customWishes || (finalHidden.meta && finalHidden.meta.customWishes) || '');
    var wishesOnFinal = String((finalHidden.meta && finalHidden.meta.customWishes) || wishes);
    var customWishesPreserved = !wishes || wishesOnFinal === wishes;

    var noteHits = 0;
    raw.notes.slice(0, 40).forEach(function (n) {
      if (
        fin.notes.some(function (f) {
          return f === n || (n.length > 12 && f.indexOf(n.slice(0, 12)) !== -1);
        })
      ) {
        noteHits += 1;
      }
    });
    var descriptionPreservationRate = raw.notes.length ? noteHits / Math.min(40, raw.notes.length) : 1;

    var transportHits = 0;
    raw.transports.forEach(function (t) {
      var key = canonicalPoiKey(t);
      if (
        fin.transports.some(function (f) {
          return canonicalPoiKey(f) === key || f === t;
        })
      ) {
        transportHits += 1;
      }
    });
    var transportPreservationRate = raw.transports.length
      ? transportHits / raw.transports.length
      : 1;

    var intentOk =
      poiPreservationRate >= 0.75 &&
      districtPreservationRate >= 0.6 &&
      mealPreservationRate >= 0.5 &&
      customWishesPreserved;

    return {
      rawPoiCount: rawPoiCount,
      finalPoiCount: finalPoiCount,
      preservedPoiCount: preservedPoiCount,
      poiPreservationRate: Math.round(poiPreservationRate * 1000) / 1000,
      mealPreservationRate: Math.round(mealPreservationRate * 1000) / 1000,
      districtPreservationRate: Math.round(districtPreservationRate * 1000) / 1000,
      descriptionPreservationRate: Math.round(descriptionPreservationRate * 1000) / 1000,
      transportPreservationRate: Math.round(transportPreservationRate * 1000) / 1000,
      customWishesPreserved: customWishesPreserved,
      intentOk: intentOk,
      threshold: { poi: 0.75, district: 0.6, meal: 0.5 }
    };
  }

  function deriveNeedsReplan(repairs, validation, preservation) {
    var reasons = [];
    var replanTypes = {
      geographic_ping_pong: 1,
      dayBoundaryInvalid: 1,
      mealTimingInvalid: 1,
      activity_after_end_of_day_return: 1,
      experienceRepeatWarning: 1,
      duplicatePoi: 1,
      midnight_in_middle_needs_replan: 1
    };
    (repairs || []).forEach(function (r) {
      if (r.needsReplan || replanTypes[r.type]) {
        reasons.push(r.replanReason || r.type + (r.path ? ':' + r.path : ''));
      }
    });
    (validation && validation.issues ? validation.issues : []).forEach(function (x) {
      if (replanTypes[x.type] || x.type === 'geographic_ping_pong') {
        reasons.push(x.type + (x.path ? ':' + x.path : ''));
      }
    });
    if (preservation && preservation.intentOk === false) {
      reasons.push(
        'intent_preservation_regression:poiRate=' +
          preservation.poiPreservationRate +
          ';districtRate=' +
          preservation.districtPreservationRate
      );
    }
    var uniq = [];
    reasons.forEach(function (r) {
      if (r && uniq.indexOf(r) === -1) uniq.push(r);
    });
    return {
      needsReplan: uniq.length > 0,
      replanReasons: uniq
    };
  }

  function finalizePlannerMeta(working, opt) {
    opt = opt || {};
    var geminiCandidate = opt.geminiCandidate || null;
    var repairs = opt.repairs || [];
    var validation = opt.validation || { ok: true, issues: [], blockers: [] };
    var preservation = measureIntentPreservation(geminiCandidate, working, opt.meta || {});
    var replan = deriveNeedsReplan(repairs, validation, preservation);

    working.meta = working.meta || {};
    if (geminiCandidate) {
      working.meta.geminiCandidate = geminiCandidate;
    }
    working.meta.intentPreservation = preservation;
    working.meta.needsReplan = replan.needsReplan;
    working.meta.replanReason = replan.replanReasons.join('; ');
    working.meta.replanReasons = replan.replanReasons;

    working.meta.plannerV2 = Object.assign({}, working.meta.plannerV2 || {}, {
      version: '2.4-intent-guardrail',
      role: 'validator_minimal_repair',
      policy: {
        allow: ['shift_time', 'adjust_ordering', 'remove_invalid_filler', 'remove_duplicate', 'mark_needsReplan'],
        deny: [
          'replace_poi_identity',
          'swap_district_poi',
          'invent_restaurant',
          'invent_attraction',
          'invent_shopping',
          'rewrite_whole_day'
        ],
        principle: 'FAIL_SAFELY_OVER_REWRITE_BADLY'
      },
      repairs: repairs,
      needsReplan: replan.needsReplan,
      replanReason: working.meta.replanReason,
      replanReasons: replan.replanReasons,
      intentPreservation: preservation,
      validation: {
        ok: validation.ok,
        issueCount: (validation.issues || []).length,
        blockerCount: (validation.blockers || []).length,
        issues: (validation.issues || []).slice(0, 50)
      }
    });

    return {
      preservation: preservation,
      needsReplan: replan.needsReplan,
      replanReasons: replan.replanReasons
    };
  }

  /**
   * Gemini-first audit path (no itinerary generation).
   * Allowed: idempotent meal-prefix cleanup, metadata sanitize, issue flags, needsGeminiReplan.
   * Forbidden: POI invent/replace, time rewrite, day moves, synthetic filler, density drops.
   */
  function auditGeminiItinerary(hidden, meta, opt) {
    opt = opt || {};
    meta = meta || {};
    var geminiCandidate = cloneDeep(hidden || { days: [] });
    var working = cloneDeep(hidden || { days: [] });
    var repairs = [];
    var flags = [];

    // Deterministic idempotent meal-prefix cleanup only
    (working.days || []).forEach(function (day, dayIndex) {
      var dayNum = day.dayNum || dayIndex + 1;
      var items = flattenDay(day, dayIndex);
      items = items.map(function (it) {
        var meal = inferMealKind(it);
        if (!meal) return it;
        var cleaned = stripMealPrefixes(titleOf(it));
        if (cleaned !== titleOf(it) && /^(早餐|午餐|下午茶|晚餐|宵夜)/.test(titleOf(it))) {
          var existingLabel = (titleOf(it).match(/^(早餐|午餐|下午茶|晚餐|宵夜)/) || [])[1];
          var labelMap = {
            breakfast: '早餐',
            lunch: '午餐',
            teatime: '下午茶',
            dinner: '晚餐',
            latenight: '宵夜'
          };
          it.title = withMealPrefix(cleaned, existingLabel || labelMap[meal] || '晚餐');
          repairs.push({ type: 'meal_prefix_idempotent', day: dayNum, to: it.title });
        }
        return it;
      });
      // Flag-only validators (no reorder / no drop)
      detectGeographicPingPong(items, flags, dayNum);
      detectMidnightInMiddle(items, flags, dayNum);
      detectMealTimingInvalid(items, flags, dayNum);
      detectReturnThenActivity(items, flags, dayNum);
      rebuildDayPhases(day, items);
    });

    detectExperienceRepeat(working, flags);
    detectTripDuplicates(working, flags);

    flags.forEach(function (f) {
      f.needsReplan = true;
      if (!f.replanReason) f.replanReason = f.type;
      repairs.push(f);
    });

    var validation = validateItinerary(working, meta);
    flags.forEach(function (f) {
      validation.issues.push(
        issue(f.type, 'error', {
          day: f.day,
          title: f.title,
          path: f.path,
          experience: f.experience
        })
      );
    });
    validation.blockers = validation.issues.filter(function (x) {
      return x.severity === 'error';
    });
    validation.ok = validation.blockers.length === 0;

    var SE = getStyleEngineApi();
    var styleReport = null;
    if (SE && typeof SE.applyStyleEngine === 'function' && opt.applyStyleEngine !== false) {
      // Style Engine is audit/score only (canMutateSchedule=false inside)
      var styleApplied = SE.applyStyleEngine(working, meta, {
        styleKey: opt.styleKey || meta.travelStyle || '',
        city: meta.destination || opt.city || '',
        customWishes: opt.customWishes || meta.customWishes || ''
      });
      working = styleApplied.hidden || working;
      styleReport = {
        styleKey: styleApplied.styleKey,
        quality: styleApplied.quality,
        needsStyleReplan: !!(styleApplied.hidden && styleApplied.hidden.meta && styleApplied.hidden.meta.styleEngine && styleApplied.hidden.meta.styleEngine.needsStyleReplan)
      };
      (styleApplied.repairs || []).forEach(function (r) {
        repairs.push(Object.assign({ type: r.type || 'style_audit' }, r));
      });
    }
    if (SE && typeof SE.sanitizeItineraryForRender === 'function') {
      SE.sanitizeItineraryForRender(working);
    }

    var fin = finalizePlannerMeta(working, {
      geminiCandidate: geminiCandidate,
      repairs: repairs,
      validation: validation,
      meta: meta
    });
    working.meta.plannerV2 = Object.assign({}, working.meta.plannerV2 || {}, {
      version: '3.0-gemini-first-audit',
      role: 'reality_validator_audit_only',
      mutationCount: repairs.filter(function (r) {
        return r.type === 'meal_prefix_idempotent';
      }).length,
      reality: {
        mode: 'audit_only',
        geminiRole: 'itinerary_authority',
        styleRole: 'score_audit_only',
        plannerRole: 'validator_flag_only',
        principle: 'FAIL_SAFELY_OVER_REWRITE_BADLY',
        styleEngine: styleReport
      }
    });
    working.meta.needsGeminiReplan = fin.needsReplan;
    if (styleReport && styleReport.needsStyleReplan) {
      working.meta.needsStyleReplan = true;
      working.meta.needsGeminiReplan = true;
    }

    return {
      hidden: working,
      repairs: repairs,
      validation: validation,
      needsReplan: fin.needsReplan,
      needsGeminiReplan: !!working.meta.needsGeminiReplan,
      replanReasons: fin.replanReasons,
      intentPreservation: fin.preservation,
      style: styleReport,
      mutationCount: working.meta.plannerV2.mutationCount,
      intercepted: fin.needsReplan || !validation.ok
    };
  }

  function detectMidnightInMiddle(items, flags, dayNum) {
    var i;
    for (i = 1; i < items.length - 1; i++) {
      var it = items[i];
      var prev = items[i - 1];
      var next = items[i + 1];
      var clock = isNaN(it.startMinutes) ? hhmmToMinutes(it.startTime) : it.startMinutes;
      var offset = Number(it.startDayOffset) || 0;
      var prevClock = isNaN(prev.startMinutes) ? hhmmToMinutes(prev.startTime) : prev.startMinutes;
      var nextClock = isNaN(next.startMinutes) ? hhmmToMinutes(next.startTime) : next.startMinutes;
      if (
        offset === 0 &&
        !isNaN(clock) &&
        clock < 5 * 60 &&
        !isNaN(prevClock) &&
        prevClock >= 8 * 60 &&
        !isNaN(nextClock) &&
        nextClock >= 8 * 60
      ) {
        flags.push({
          type: 'dayBoundaryInvalid',
          day: dayNum,
          title: titleOf(it),
          replanReason: 'midnight_between_daytime'
        });
      }
    }
  }

  function detectMealTimingInvalid(items, flags, dayNum) {
    items.forEach(function (it) {
      var meal = inferMealKind(it);
      if (!meal) return;
      var start = isNaN(it.startMinutes) ? hhmmToMinutes(it.startTime) : it.startMinutes;
      if (isNaN(start)) return;
      var ok = false;
      if (meal === 'breakfast') ok = start >= 6 * 60 && start <= 11 * 60 + 30;
      else if (meal === 'lunch') ok = start >= 11 * 60 && start <= 15 * 60;
      else if (meal === 'teatime') ok = start >= 13 * 60 && start <= 18 * 60;
      else if (meal === 'dinner') ok = start >= 17 * 60 && start <= 22 * 60 + 30;
      else if (meal === 'latenight') ok = start >= 21 * 60 || start <= 2 * 60;
      if (!ok) {
        flags.push({
          type: 'mealTimingInvalid',
          day: dayNum,
          title: titleOf(it),
          replanReason: 'meal_label_vs_clock:' + meal + '@' + (it.startTime || '')
        });
      }
    });
  }

  function detectReturnThenActivity(items, flags, dayNum) {
    var returned = false;
    items.forEach(function (it) {
      if (/返回住宿|返回飯店|返回市中心.*休息|結束行程/.test(titleOf(it))) {
        returned = true;
        return;
      }
      if (!returned) return;
      var type = it.eventType || classifyEventType(it);
      if (type === 'rest' || type === 'transport') return;
      if (isAirportOrArrivalEvent(it)) return;
      flags.push({
        type: 'activity_after_end_of_day_return',
        day: dayNum,
        title: titleOf(it),
        replanReason: 'return_hotel_then_city_activity'
      });
    });
  }

  function detectExperienceRepeat(hidden, flags) {
    var counts = {};
    (hidden.days || []).forEach(function (day, dayIndex) {
      flattenDay(day, dayIndex).forEach(function (it) {
        var exp = experienceFamily(titleOf(it));
        if (!exp) return;
        counts[exp] = (counts[exp] || 0) + 1;
      });
    });
    Object.keys(counts).forEach(function (exp) {
      if (counts[exp] >= 3) {
        flags.push({
          type: 'experienceRepeatWarning',
          experience: exp,
          count: counts[exp],
          replanReason: 'experience_repeat:' + exp + 'x' + counts[exp]
        });
      }
    });
  }

  function experienceFamily(title) {
    var t = String(title || '');
    if (/成吉思|ジンギスカン|jingisukan|Genghis|達摩|だるま/i.test(t)) return 'jingisukan';
    if (/拉麵|ラーメン|ramen/i.test(t)) return 'ramen';
    if (/湯咖哩|スープカレー|soup\s*curry/i.test(t)) return 'soup_curry';
    if (/壽司|寿司|sushi|花まる/i.test(t)) return 'sushi';
    return '';
  }

  function detectTripDuplicates(hidden, flags) {
    var seen = {};
    (hidden.days || []).forEach(function (day, dayIndex) {
      flattenDay(day, dayIndex).forEach(function (it) {
        if (!isMeaningfulPoiItem(it)) return;
        var key = canonicalPoiKey(titleOf(it));
        if (!key) return;
        if (seen[key]) {
          flags.push({
            type: 'duplicatePoi',
            day: day.dayNum || dayIndex + 1,
            title: titleOf(it),
            replanReason: 'duplicate_poi:' + key
          });
        } else {
          seen[key] = true;
        }
      });
    });
  }

  function repairItinerary(hidden, meta) {
    var working = cloneDeep(hidden || { days: [] });
    meta = meta || {};
    var repairs = [];
    var days = working.days || [];
    var tripVisited = Object.create(null);

    days.forEach(function (day, dayIndex) {
      var dayNum = day.dayNum || dayIndex + 1;
      var items = flattenDay(day, dayIndex);
      items = repairDayItems(items, dayIndex, days.length, meta, repairs, dayNum);
      // Trip-wide anti-repeat for major POIs (canonical title), allow hubs/hotel/user wishes
      items = items.filter(function (it) {
        var type = it.eventType || classifyEventType(it);
        if (type === 'transport' || type === 'rest' || type === 'optional') return true;
        if (isAirportOrArrivalEvent(it)) return true;
        if (/車站|駅|Station|JR |地鐵|捷運|巴士|機場/.test(titleOf(it))) return true;
        var canon = String(titleOf(it))
          .replace(/^(早餐|午餐|下午茶|晚餐|宵夜)[：:]\s*/i, '')
          .replace(/[（(].*$/, '')
          .replace(/\s+/g, '')
          .slice(0, 24);
        if (!canon || canon.length < 3) return true;
        if (tripVisited[canon]) {
          if (isUserRequested(it)) return true;
          repairs.push({
            type: 'drop_trip_duplicate_poi',
            day: dayNum,
            title: titleOf(it)
          });
          return false;
        }
        tripVisited[canon] = true;
        return true;
      });
      rebuildDayPhases(day, items);
    });

    working.meta = working.meta || {};
    var validation = validateItinerary(working, meta);
    // Attach geographic ping-pong as validation issues
    repairs.forEach(function (r) {
      if (r.type === 'geographic_ping_pong') {
        r.needsReplan = true;
        r.replanReason =
          r.replanReason ||
          'geographic_ping_pong_cannot_fix_without_replacing_poi_identity:' + (r.path || '');
        validation.issues.push(
          issue('geographic_ping_pong', 'error', {
            day: r.day,
            path: r.path
          })
        );
      }
      if (r.type === 'midnight_in_middle_needs_replan') {
        validation.issues.push(
          issue('midnight_in_middle', 'error', {
            day: r.day,
            title: r.title
          })
        );
      }
    });
    validation.blockers = validation.issues.filter(function (x) {
      return x.severity === 'error';
    });
    validation.ok = validation.blockers.length === 0;

    var geminiCandidate = meta.__geminiCandidate || null;
    finalizePlannerMeta(working, {
      geminiCandidate: geminiCandidate,
      repairs: repairs,
      validation: validation,
      meta: meta
    });

    return {
      hidden: working,
      repairs: repairs,
      validation: validation,
      needsReplan: !!(working.meta && working.meta.needsReplan),
      replanReasons: (working.meta && working.meta.replanReasons) || [],
      intentPreservation: (working.meta && working.meta.intentPreservation) || null
    };
  }

  /**
   * Sync gate (v2): validate → repair → places hours (catalog) → validate.
   * Prefer planHiddenItineraryAsync for full Reality Gate (places resolve + routes).
   */
  function planHiddenItinerary(hidden, meta, opt) {
    opt = opt || {};
    meta = meta || {};
    var geminiCandidate = cloneDeep(hidden || { days: [] });
    meta.__geminiCandidate = geminiCandidate;
    var initial = validateItinerary(hidden, meta);
    var repaired = repairItinerary(hidden, meta);
    var working = repaired.hidden;
    var repairs = (repaired.repairs || []).slice();

    applyPlacesHoursGateSync(working, meta, repairs);

    var SE = getStyleEngineApi();
    if (SE && typeof SE.applyStyleEngine === 'function' && opt.applyStyleEngine !== false) {
      var styleApplied = SE.applyStyleEngine(working, meta, {
        styleKey: opt.styleKey || meta.travelStyle || ''
      });
      working = styleApplied.hidden || working;
      (styleApplied.repairs || []).forEach(function (r) {
        repairs.push(Object.assign({ type: r.type || 'style_engine' }, r));
      });
    }

    // Re-apply core schedule repairs after places drops/shifts
    var again = repairItinerary(working, meta);
    working = again.hidden;
    repairs = repairs.concat(again.repairs || []);

    var validation = validateItinerary(working, meta);
    var routeIssues = validateRouteGaps(working, meta);
    validation = mergeValidation(validation, routeIssues);

    working.meta = working.meta || {};
    var fin = finalizePlannerMeta(working, {
      geminiCandidate: geminiCandidate,
      repairs: repairs,
      validation: validation,
      meta: meta
    });
    working.meta.plannerV2 = Object.assign({}, working.meta.plannerV2 || {}, {
      reality: {
        placesHours: true,
        routes: !!(working.meta && working.meta.routeDuration),
        mode: 'sync',
        styleEngine: working.meta.styleEngine || null
      }
    });

    return {
      hidden: working,
      initialValidation: initial,
      repairs: repairs,
      validation: validation,
      needsReplan: fin.needsReplan,
      replanReasons: fin.replanReasons,
      intentPreservation: fin.preservation,
      intercepted: !initial.ok || repairs.length > 0 || !validation.ok || fin.needsReplan,
      stats: {
        routesCalls: 0,
        routeMatrixElements: 0,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }

  function mergeRouteStats(a, b) {
    a = a || {};
    b = b || {};
    return {
      googleRouteCalls: (a.googleRouteCalls || 0) + (b.googleRouteCalls || 0),
      routesCalls: (a.routesCalls || 0) + (b.routesCalls || 0),
      cacheHits: (a.cacheHits || 0) + (b.cacheHits || 0),
      cacheMisses: (a.cacheMisses || 0) + (b.cacheMisses || 0),
      fallbackCalls: (a.fallbackCalls || 0) + (b.fallbackCalls || 0),
      routeMatrixElements: 0,
      routeCallCap: b.routeCallCap != null ? b.routeCallCap : a.routeCallCap,
      concurrency: b.concurrency != null ? b.concurrency : a.concurrency,
      resolveLatencyMs: (a.resolveLatencyMs || 0) + (b.resolveLatencyMs || 0),
      legs: (a.legs || []).concat(b.legs || [])
    };
  }

  /**
   * Async Reality Gate (v2.2):
   * normalize → places resolve/hours → adjacent Google routes → repair → final validate
   */
  async function planHiddenItineraryAsync(hidden, meta, opt) {
    opt = opt || {};
    meta = meta || {};
    var geminiCandidate = cloneDeep(hidden || { days: [] });
    meta.__geminiCandidate = geminiCandidate;
    var PH = getPlacesHoursApi();
    var RD = getRouteDurationApi();
    var mode = opt.mode || (meta.transport === 'self-drive' ? 'drive' : 'transit');

    var initial = validateItinerary(hidden, meta);
    var repaired = repairItinerary(hidden, meta);
    var working = repaired.hidden;
    var repairs = (repaired.repairs || []).slice();
    var placesStats = null;
    var routeStats = {
      googleRouteCalls: 0,
      routesCalls: 0,
      routeMatrixElements: 0,
      cacheHits: 0,
      cacheMisses: 0,
      fallbackCalls: 0
    };

    // Places resolve + opening hours (formal live gate)
    if (PH && typeof PH.enrichAndGateHidden === 'function') {
      var resolvePlace = opt.resolvePlace;
      if (!resolvePlace && opt.useFixtureResolver !== false && typeof PH.fixtureResolver === 'function') {
        // Safe offline/default: fixture + catalog; live can inject real Places resolver
        resolvePlace = function (query) {
          return Promise.resolve(PH.fixtureResolver(query));
        };
      }
      var enrich = await PH.enrichAndGateHidden(working, {
        resolvePlace: resolvePlace,
        meta: meta,
        styleKey: meta.travelStyle || opt.styleKey || '',
        dateStart: meta.dateStart || '',
        city: meta.destination || '',
        country: meta.country || ''
      });
      working = enrich.hidden || working;
      placesStats = enrich.stats || null;
      if (enrich.fixes) {
        enrich.fixes.forEach(function (f) {
          repairs.push(Object.assign({ type: f.type || 'places_enrich_fix' }, f));
        });
      }
      if (enrich.ok === false) {
        repairs.push({ type: 'places_gate_not_ok', failedDays: enrich.failedDays || [] });
      }
    } else {
      applyPlacesHoursGateSync(working, meta, repairs);
    }

    // Style Engine v1 — reshape toward STYLE_PROFILES (never overrides Reality Gate)
    var styleReport = null;
    var SE = getStyleEngineApi();
    if (SE && typeof SE.applyStyleEngine === 'function' && opt.applyStyleEngine !== false) {
      var styleApplied = SE.applyStyleEngine(working, meta, {
        styleKey: opt.styleKey || meta.travelStyle || '',
        city: meta.destination || opt.city || '',
        customWishes: opt.customWishes || meta.customWishes || ''
      });
      working = styleApplied.hidden || working;
      styleReport = {
        styleKey: styleApplied.styleKey,
        quality: styleApplied.quality,
        summary: styleApplied.summary,
        repairCount: (styleApplied.repairs || []).length
      };
      (styleApplied.repairs || []).forEach(function (r) {
        repairs.push(Object.assign({ type: r.type || 'style_engine' }, r));
      });
      // Architecture: Style is audit-only — do NOT re-run schedule mutation after style
    }

    // Adjacent-only route duration annotate (flag gaps; do not rewrite schedule)
    if (RD && typeof RD.annotateAdjacentLegs === 'function' && opt.annotateRoutes !== false) {
      var annotated = await RD.annotateAdjacentLegs(working, {
        mode: mode,
        fetchRouteDuration: opt.fetchRouteDuration,
        allowMapsJs: opt.allowMapsJs !== false,
        allowWorkerRoutes: opt.allowWorkerRoutes !== false,
        apiBase: opt.apiBase,
        routeCallCap: opt.routeCallCap,
        concurrency: opt.concurrency,
        timeoutMs: opt.timeoutMs,
        departureTimeIso: opt.departureTimeIso || null
      });
      working = annotated.hidden;
      routeStats = annotated.stats || routeStats;
      working = repairRouteGaps(working, meta, repairs);
    }

    // Single guardrail pass (arrival order / midnight-in-middle / meal idempotent / departure lock)
    var pass2 = repairItinerary(working, meta);
    working = pass2.hidden;
    repairs = repairs.concat(pass2.repairs || []);

    var validation = validateItinerary(working, meta);
    validation = mergeValidation(validation, validateRouteGaps(working, meta));

    // Opening-hours hard fails still present?
    if (PH && typeof PH.finalQaGateHidden === 'function') {
      var gate = PH.finalQaGateHidden(working, {
        styleKey: meta.travelStyle || '',
        dateStart: meta.dateStart || '',
        weekday: typeof meta.weekday === 'number' ? meta.weekday : undefined
      });
      if (gate && gate.hard && gate.hard.length) {
        gate.hard.forEach(function (h) {
          validation.issues.push(
            issue(h.type || 'outside_opening_hours', 'error', {
              day: h.day,
              title: h.title || h.itemTitle
            })
          );
        });
        validation.blockers = validation.issues.filter(function (x) {
          return x.severity === 'error';
        });
        validation.ok = validation.blockers.length === 0;
      }
    }

    // Final sanitize — Reality Gate done; Style Engine must not mutate further
    var SE2 = getStyleEngineApi();
    if (SE2 && typeof SE2.sanitizeItineraryForRender === 'function') {
      SE2.sanitizeItineraryForRender(working);
    }

    working.meta = working.meta || {};
    if (meta.unfulfilledUserRequest && meta.unfulfilledUserRequest.length) {
      working.meta.unfulfilledUserRequest = (working.meta.unfulfilledUserRequest || []).concat(
        meta.unfulfilledUserRequest
      );
    }
    var fin = finalizePlannerMeta(working, {
      geminiCandidate: geminiCandidate,
      repairs: repairs,
      validation: validation,
      meta: Object.assign({}, meta, {
        customWishes: opt.customWishes || meta.customWishes || ''
      })
    });
    working.meta.plannerV2 = Object.assign({}, working.meta.plannerV2 || {}, {
      reality: {
        placesHours: true,
        routes: true,
        mode: 'async',
        placesStats: placesStats,
        routeStats: routeStats,
        styleEngine: styleReport,
        geminiRole: 'itinerary_authority',
        plannerRole: 'validator_minimal_repair',
        styleRole: 'score_audit_only',
        principle: 'FAIL_SAFELY_OVER_REWRITE_BADLY'
      }
    });

    return {
      hidden: working,
      initialValidation: initial,
      repairs: repairs,
      validation: validation,
      needsReplan: fin.needsReplan,
      replanReasons: fin.replanReasons,
      intentPreservation: fin.preservation,
      intercepted: !initial.ok || repairs.length > 0 || !validation.ok || fin.needsReplan,
      stats: routeStats,
      style: styleReport
    };
  }

  /**
   * Parse Gemini `time: "HH:MM - HH:MM"` onto startTime/endTime when missing.
   */
  function ensureItemClockFields(item) {
    if (!item || typeof item !== 'object') return item;
    if (item.startTime && item.endTime) return item;
    var timeStr = String(item.time || item.timeLabel || item.timeRange || '').trim();
    var m = timeStr.match(/(\d{1,2}):(\d{2})\s*[-–—~至到]\s*(\d{1,2}):(\d{2})/);
    if (m) {
      var sh = parseInt(m[1], 10);
      var sm = parseInt(m[2], 10);
      var eh = parseInt(m[3], 10);
      var em = parseInt(m[4], 10);
      if (!item.startTime) {
        item.startTime =
          (sh < 10 ? '0' : '') + sh + ':' + (sm < 10 ? '0' : '') + sm;
      }
      if (!item.endTime) {
        item.endTime =
          (eh < 10 ? '0' : '') + eh + ':' + (em < 10 ? '0' : '') + em;
      }
    }
    return item;
  }

  function isMeaningfulCompletenessItem(item) {
    var type = item.eventType || classifyEventType(item);
    if (type === 'transport' || type === 'arrival' || type === 'departure') return false;
    if (type === 'rest' || type === 'optional' || type === 'checkin') return false;
    if (isAirportOrArrivalEvent(item)) return false;
    var t = titleOf(item);
    if (/^前往\s|交通：|轉乘|搭乘|步行至/.test(t) && !/餐廳|美食|景點|咖啡/.test(t)) return false;
    if (/返回飯店|回飯店|check-?in|入住|自由活動|自由時間|預留彈性/.test(t)) return false;
    return type === 'attraction' || type === 'shopping' || type === 'experience' || type === 'food';
  }

  function isGapExplainerItem(item) {
    var type = item.eventType || classifyEventType(item);
    if (type === 'transport' || type === 'food' || type === 'rest') return true;
    var t = titleOf(item);
    if (/移動|前往|搭乘|轉乘|步行|交通/.test(t)) return true;
    if (/早餐|午餐|晚餐|下午茶|宵夜|餐廳|咖啡/.test(t)) return true;
    if (/休息|自由時間|自由活動|散步|漫步|放空|預留/.test(t)) return true;
    if (isMeaningfulCompletenessItem(item)) return true;
    return false;
  }

  /**
   * Conservative DAY COMPLETENESS severe-failure detector for NORMAL USABLE FULL DAY.
   * Does NOT mutate schedule. Callers may trigger a single Gemini day replan.
   */
  function evaluateDayCompletenessQa(dayObj, opt) {
    opt = opt || {};
    var role = String(opt.planningRole || opt.role || 'normal');
    var payload = opt.payload || {};
    var issues = [];
    var longGaps = [];
    var eligibleRoles = { normal: 1, middle: 1 };
    var eligible = !!eligibleRoles[role];
    var wishes = String(payload.customWishes || payload.wishes || '');
    var leisureSparse =
      /悠閒|輕鬆|慢活|少景點|不要太趕|輕行程|輕鬆節奏|chill|relaxed|leisure|slow\s*pace/i.test(
        wishes
      );

    if (!eligible) {
      return {
        severe: false,
        eligible: false,
        skippedReason: 'not_normal_full_day',
        planningRole: role,
        meaningfulItemCount: 0,
        longGaps: [],
        issues: [],
        periodMeaningfulCounts: { 上午: 0, 下午: 0, 晚上: 0 }
      };
    }
    if (leisureSparse) {
      return {
        severe: false,
        eligible: false,
        skippedReason: 'user_requested_sparse_leisure',
        planningRole: role,
        meaningfulItemCount: 0,
        longGaps: [],
        issues: [],
        periodMeaningfulCounts: { 上午: 0, 下午: 0, 晚上: 0 }
      };
    }

    var dayCopy = cloneDeep(dayObj || { phases: [] });
    (dayCopy.phases || []).forEach(function (phase) {
      (phase.items || []).forEach(function (it) {
        ensureItemClockFields(it);
      });
    });
    var allItems = sortByAbs(flattenDay(dayCopy, 0));
    var meaningful = allItems.filter(isMeaningfulCompletenessItem);
    var periodCounts = { 上午: 0, 下午: 0, 晚上: 0 };
    meaningful.forEach(function (it) {
      var m = isNaN(it.startMinutes)
        ? isNaN(it.startAbs)
          ? 12 * 60
          : it.startAbs % DAY_MINUTES
        : it.startMinutes;
      var label = m < 12 * 60 ? '上午' : m < 17 * 60 ? '下午' : '晚上';
      if (it.period && periodCounts[it.period] != null) label = it.period;
      periodCounts[label]++;
    });

    var meaningfulCount = meaningful.length;
    if (meaningfulCount <= 3) {
      issues.push({
        type: 'too_few_meaningful_activities',
        message: 'meaningful activities <= 3 (' + meaningfulCount + ')'
      });
    }

    var sparseThreeBlock =
      meaningfulCount <= 3 &&
      periodCounts['上午'] <= 1 &&
      periodCounts['下午'] <= 1 &&
      periodCounts['晚上'] <= 1 &&
      periodCounts['上午'] + periodCounts['下午'] + periodCounts['晚上'] >= 2;
    if (sparseThreeBlock) {
      issues.push({
        type: 'sparse_one_per_period',
        message: 'degenerated to ~1 morning / 1 afternoon / 1 evening'
      });
    }

    var mi;
    for (mi = 0; mi < meaningful.length - 1; mi++) {
      var a = meaningful[mi];
      var b = meaningful[mi + 1];
      if (isNaN(a.endAbs) || isNaN(b.startAbs)) continue;
      var gap = b.startAbs - a.endAbs;
      if (gap <= 90) continue;
      var explained = false;
      var ai;
      for (ai = 0; ai < allItems.length; ai++) {
        var mid = allItems[ai];
        if (mid === a || mid === b) continue;
        if (isNaN(mid.startAbs)) continue;
        if (mid.startAbs >= a.endAbs && mid.startAbs < b.startAbs && isGapExplainerItem(mid)) {
          explained = true;
          break;
        }
      }
      if (!explained) {
        var gapInfo = {
          type: 'unexplained_long_gap',
          from: titleOf(a),
          to: titleOf(b),
          gapMinutes: gap,
          fromEnd: a.endTime || minutesToHhmm(a.endAbs % DAY_MINUTES),
          toStart: b.startTime || minutesToHhmm(b.startAbs % DAY_MINUTES)
        };
        longGaps.push(gapInfo);
        issues.push(gapInfo);
      }
    }

    var severe = meaningfulCount <= 3 && (longGaps.length >= 1 || sparseThreeBlock);

    return {
      severe: !!severe,
      eligible: true,
      skippedReason: '',
      planningRole: role,
      meaningfulItemCount: meaningfulCount,
      longGaps: longGaps,
      issues: issues,
      periodMeaningfulCounts: periodCounts,
      sparseThreeBlock: !!sparseThreeBlock
    };
  }

  var api = {
    DAY_MINUTES: DAY_MINUTES,
    MEAL_WINDOWS: MEAL_WINDOWS,
    classifyEventType: classifyEventType,
    classifyAirportTransfer: classifyAirportTransfer,
    isDepartureTransfer: isDepartureTransfer,
    isArrivalTransfer: isArrivalTransfer,
    isAirportToCityTransfer: isAirportToCityTransfer,
    isTransitionEvent: isTransitionEvent,
    lateNightEligibility: lateNightEligibility,
    canOccupyDeepNight: canOccupyDeepNight,
    normalizeItemTimeModel: normalizeItemTimeModel,
    applyTimeModel: applyTimeModel,
    setAbsRange: setAbsRange,
    validateItinerary: validateItinerary,
    repairItinerary: repairItinerary,
    auditGeminiItinerary: auditGeminiItinerary,
    planHiddenItinerary: planHiddenItinerary,
    planHiddenItineraryAsync: planHiddenItineraryAsync,
    applyPlacesHoursGateSync: applyPlacesHoursGateSync,
    validateRouteGaps: validateRouteGaps,
    repairRouteGaps: repairRouteGaps,
    stripMealPrefixes: stripMealPrefixes,
    withMealPrefix: withMealPrefix,
    measureIntentPreservation: measureIntentPreservation,
    deriveNeedsReplan: deriveNeedsReplan,
    canonicalPoiKey: canonicalPoiKey,
    hhmmToMinutes: hhmmToMinutes,
    minutesToHhmm: minutesToHhmm,
    evaluateDayCompletenessQa: evaluateDayCompletenessQa,
    ensureItemClockFields: ensureItemClockFields,
    isMeaningfulCompletenessItem: isMeaningfulCompletenessItem
  };

  global.SOARVIBE_PLANNER_V2 = api;
})(typeof window !== 'undefined' ? window : globalThis);
