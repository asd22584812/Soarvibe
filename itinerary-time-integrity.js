/**
 * SoarVibe Itinerary Time Integrity — P0
 * Midnight-aware normalization, chronological sort, conflict QA, meal labels,
 * conservative opening-hours catalog (Places full wiring later).
 */
(function (global) {
  'use strict';

  var DAY_MINUTES = 24 * 60;

  /** Conservative open windows for well-known POIs (local time). Prefer reject-over-guess. */
  var POI_HOURS_CATALOG = [
    {
      id: 'sapporo-clock-tower',
      match: /札幌?\s*時計台|時計台|Sapporo\s*Clock\s*Tower/i,
      openMin: 8 * 60 + 45,
      closeMin: 17 * 60,
      note: '時計台一般日間開放，晚間不應排參觀'
    },
    {
      id: 'shiroi-koibito',
      match: /白色戀人|白い恋人|Shiroi\s*Koibito/i,
      openMin: 10 * 60,
      closeMin: 18 * 60,
      note: '白色戀人公園日間園區，傍晚後通常已關閉／末入園更早'
    },
    {
      id: 'sapporo-beer-museum',
      match: /札幌?\s*啤酒博物館|ビール博物館|Beer\s*Museum|Sapporo\s*Beer\s*Museum/i,
      openMin: 11 * 60,
      closeMin: 18 * 60,
      note: '札幌啤酒博物館日間開放，深夜參觀應被拒'
    },
    {
      id: 'former-hokkaido-gov',
      match: /舊道廳|旧道庁|赤れんが|Former\s*Hokkaido\s*Government/i,
      openMin: 9 * 60,
      closeMin: 17 * 60,
      note: '舊道廳日間開放'
    },
    {
      id: 'nemuro-hanamaru',
      match: /根室花まる|花まる|Hanamaru/i,
      openMin: 11 * 60,
      closeMin: 22 * 60,
      note: '迴轉壽司一般午餐至晚間'
    }
  ];

  var MEAL_WINDOWS = {
    breakfast: { label: '早餐', min: 7 * 60, max: 10 * 60 },
    lunch: { label: '午餐', min: 11 * 60 + 30, max: 14 * 60 },
    teatime: { label: '下午茶', min: 14 * 60, max: 17 * 60 },
    dinner: { label: '晚餐', min: 17 * 60 + 30, max: 20 * 60 + 30 },
    lateDinnerSoft: { label: '晚餐', min: 20 * 60 + 30, max: 21 * 60 + 30 }
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

  /**
   * Normalize a single item's timeline.
   * Cross-midnight: end clock < start clock → end on next calendar day (dayOffsetEnd=1).
   */
  function normalizeItemTimeline(item) {
    item = item || {};
    var startClock = hhmmToMinutes(item.startTime);
    var endClock = hhmmToMinutes(item.endTime);
    var startDayOffset = 0;
    var endDayOffset = 0;
    var issues = [];

    if (isNaN(startClock) && !isNaN(endClock)) {
      startClock = endClock;
      issues.push('missing_start');
    }
    if (!isNaN(startClock) && isNaN(endClock)) {
      endClock = startClock + 45;
      endDayOffset = endClock >= DAY_MINUTES ? 1 : 0;
      endClock = endClock % DAY_MINUTES;
      issues.push('missing_end_inferred');
    }
    if (!isNaN(startClock) && !isNaN(endClock)) {
      if (endClock < startClock) {
        // Classic overnight span e.g. 23:30–00:30
        endDayOffset = 1;
      } else if (endClock === startClock) {
        endClock = (startClock + 30) % DAY_MINUTES;
        endDayOffset = startClock + 30 >= DAY_MINUTES ? 1 : 0;
        issues.push('zero_duration_expanded');
      }
    }

    var startAbs =
      isNaN(startClock) ? NaN : startDayOffset * DAY_MINUTES + startClock;
    var endAbs = isNaN(endClock) ? NaN : endDayOffset * DAY_MINUTES + endClock;

    if (!isNaN(startAbs) && !isNaN(endAbs) && endAbs <= startAbs) {
      issues.push('negative_or_zero_span');
      endAbs = startAbs + 30;
      endDayOffset = Math.floor(endAbs / DAY_MINUTES);
      endClock = endAbs % DAY_MINUTES;
    }

    return {
      startTime: isNaN(startClock) ? item.startTime || '' : minutesToHhmm(startClock),
      endTime: isNaN(endClock) ? item.endTime || '' : minutesToHhmm(endClock),
      startMinutes: startClock,
      endMinutes: endClock,
      startDayOffset: startDayOffset,
      endDayOffset: endDayOffset,
      startAbs: startAbs,
      endAbs: endAbs,
      crossesMidnight: endDayOffset > startDayOffset,
      issues: issues
    };
  }

  function applyTimelineToItem(item, tl) {
    if (!item || !tl) return item;
    item.startTime = tl.startTime;
    item.endTime = tl.endTime;
    item.startMinutes = tl.startMinutes;
    item.endMinutes = tl.endMinutes;
    item.startDayOffset = tl.startDayOffset;
    item.endDayOffset = tl.endDayOffset;
    item.startAbs = tl.startAbs;
    item.endAbs = tl.endAbs;
    item.crossesMidnight = !!tl.crossesMidnight;
    if (item.startTime && item.endTime) {
      item.timeLabel = item.startTime + ' - ' + item.endTime;
    }
    return item;
  }

  function periodForStartMinutes(startMin) {
    if (isNaN(startMin)) return '下午';
    if (startMin < 12 * 60) return '上午';
    if (startMin < 17 * 60) return '下午';
    return '晚上';
  }

  function flattenDayItems(day) {
    var items = [];
    if (!day || !Array.isArray(day.phases)) return items;
    day.phases.forEach(function (phase) {
      var period = String(phase.label || phase.period || '');
      (phase.items || []).forEach(function (it) {
        if (!it) return;
        var copy = Object.assign({}, it);
        if (!copy.period) copy.period = period;
        items.push(copy);
      });
    });
    return items;
  }

  function sortItemsChronologically(items) {
    return (items || []).slice().sort(function (a, b) {
      var ta = normalizeItemTimeline(a);
      var tb = normalizeItemTimeline(b);
      var aa = isNaN(ta.startAbs) ? Number.POSITIVE_INFINITY : ta.startAbs;
      var bb = isNaN(tb.startAbs) ? Number.POSITIVE_INFINITY : tb.startAbs;
      if (aa !== bb) return aa - bb;
      var ea = isNaN(ta.endAbs) ? aa : ta.endAbs;
      var eb = isNaN(tb.endAbs) ? bb : tb.endAbs;
      return ea - eb;
    });
  }

  function detectTimeConflicts(items) {
    var sorted = sortItemsChronologically(items);
    var issues = [];
    var i;
    for (i = 0; i < sorted.length; i++) {
      var tl = normalizeItemTimeline(sorted[i]);
      applyTimelineToItem(sorted[i], tl);
      if (tl.issues.indexOf('negative_or_zero_span') !== -1) {
        issues.push({
          type: 'negative_duration',
          title: sorted[i].title,
          startTime: sorted[i].startTime,
          endTime: sorted[i].endTime
        });
      }
      if (i === 0) continue;
      var prev = sorted[i - 1];
      var prevTl = normalizeItemTimeline(prev);
      if (isNaN(prevTl.endAbs) || isNaN(tl.startAbs)) continue;
      if (tl.startAbs < prevTl.endAbs) {
        issues.push({
          type: 'overlap',
          from: prev.title,
          to: sorted[i].title,
          prevEnd: prev.endTime,
          nextStart: sorted[i].startTime
        });
      }
      // Same-day clock regression without overnight flag on previous
      if (
        prevTl.endDayOffset === 0 &&
        tl.startDayOffset === 0 &&
        !isNaN(prevTl.startMinutes) &&
        !isNaN(tl.startMinutes) &&
        tl.startMinutes + 12 * 60 < prevTl.startMinutes &&
        prevTl.startMinutes >= 20 * 60
      ) {
        // e.g. 23:30 then 20:00 same evening — chronological sort should fix display;
        // still record if somehow unsorted input
        issues.push({
          type: 'time_regression',
          from: prev.title,
          to: sorted[i].title,
          prevStart: prev.startTime,
          nextStart: sorted[i].startTime
        });
      }
    }
    return { items: sorted, issues: issues };
  }

  function isMealLikeTitle(title) {
    return /早餐|午餐|晚餐|下午茶|宵夜|拉麵|燒肉|壽司|餐廳|食堂|居酒屋|咖啡|甜點|美食|螃蟹|丼|定食|meal|dinner|lunch|breakfast|cafe/i.test(
      String(title || '')
    );
  }

  function isReturnOrErrandTitle(title) {
    return /返回飯店|回飯店|休息|便利商店|藥妝|唐吉訶德|ドン・キ|採買|寄物|check-?in/i.test(
      String(title || '')
    );
  }

  function isNightlifeTitle(title) {
    return /夜景|夜市|酒吧|Bar|俱樂部|薄野|居酒屋|夜生活|霓虹/i.test(String(title || ''));
  }

  function inferMealLabelFromMinutes(startMin) {
    if (isNaN(startMin)) return '';
    if (startMin >= MEAL_WINDOWS.breakfast.min && startMin <= MEAL_WINDOWS.breakfast.max) {
      return '早餐';
    }
    if (startMin >= MEAL_WINDOWS.lunch.min && startMin <= MEAL_WINDOWS.lunch.max) {
      return '午餐';
    }
    if (startMin >= MEAL_WINDOWS.teatime.min && startMin <= MEAL_WINDOWS.teatime.max) {
      return '下午茶';
    }
    if (startMin >= MEAL_WINDOWS.dinner.min && startMin <= MEAL_WINDOWS.lateDinnerSoft.max) {
      return '晚餐';
    }
    if (startMin > MEAL_WINDOWS.lateDinnerSoft.max) return '宵夜';
    return '';
  }

  function repairMealLabels(items, styleKey) {
    var fixes = [];
    (items || []).forEach(function (it) {
      var tl = normalizeItemTimeline(it);
      applyTimelineToItem(it, tl);
      if (isNaN(tl.startMinutes)) return;
      var title = String(it.title || '');
      var correct = inferMealLabelFromMinutes(tl.startMinutes);
      // Mislabel: 20:00 called 下午茶
      if (/下午茶/.test(title) && tl.startMinutes >= 17 * 60) {
        it.title = title.replace(/下午茶/g, correct || '晚餐');
        fixes.push({ type: 'meal_label', title: it.title, from: '下午茶', at: it.startTime });
      }
      // Late dinner without nightlife context
      if (
        isMealLikeTitle(title) &&
        /晚餐/.test(title) &&
        tl.startMinutes >= 22 * 60 &&
        styleKey !== 'nightlife' &&
        !isNightlifeTitle(title)
      ) {
        it.timeIntegrityFlags = (it.timeIntegrityFlags || []).concat(['late_dinner']);
        fixes.push({
          type: 'late_dinner_flag',
          title: title,
          startTime: it.startTime
        });
        // Pull dinner earlier into preferred window when possible
        var newStart = MEAL_WINDOWS.dinner.min + 30;
        var stay = Math.max(45, (tl.endAbs || tl.startAbs + 60) - tl.startAbs);
        it.startTime = minutesToHhmm(newStart);
        it.endTime = minutesToHhmm(newStart + stay);
        applyTimelineToItem(it, normalizeItemTimeline(it));
        fixes.push({ type: 'shift_dinner_earlier', title: title, to: it.startTime });
      }
    });
    return { items: items, fixes: fixes };
  }

  function lookupPoiHours(title) {
    var t = String(title || '');
    var i;
    for (i = 0; i < POI_HOURS_CATALOG.length; i++) {
      if (POI_HOURS_CATALOG[i].match.test(t)) return POI_HOURS_CATALOG[i];
    }
    return null;
  }

  function validateOpeningHours(items) {
    var issues = [];
    var fixes = [];
    (items || []).forEach(function (it) {
      var hours = lookupPoiHours(it.title);
      var tl = normalizeItemTimeline(it);
      applyTimelineToItem(it, tl);
      if (!hours) {
        it.openingHoursUnknown = true;
        return;
      }
      it.openingHoursUnknown = false;
      it.openingHoursSource = 'catalog:' + hours.id;
      if (isNaN(tl.startMinutes)) return;
      // Visit must start before close-30m and not after close; prefer start >= open
      var lastEntry = hours.closeMin - 30;
      if (tl.startMinutes >= hours.closeMin || tl.startMinutes > lastEntry) {
        issues.push({
          type: 'after_hours',
          title: it.title,
          startTime: it.startTime,
          close: minutesToHhmm(hours.closeMin),
          note: hours.note
        });
        // Local repair: move into open window (mid afternoon)
        var repairedStart = Math.max(hours.openMin + 60, Math.min(14 * 60, lastEntry - 60));
        if (repairedStart < hours.closeMin - 45) {
          var stay = Math.min(
            90,
            Math.max(40, (tl.endAbs || tl.startAbs + 60) - tl.startAbs)
          );
          var repairedEnd = Math.min(repairedStart + stay, hours.closeMin - 15);
          it.startTime = minutesToHhmm(repairedStart);
          it.endTime = minutesToHhmm(repairedEnd);
          applyTimelineToItem(it, normalizeItemTimeline(it));
          it.period = periodForStartMinutes(repairedStart);
          fixes.push({
            type: 'shift_into_open_hours',
            title: it.title,
            to: it.startTime + '-' + it.endTime,
            catalog: hours.id
          });
        } else {
          it.timeIntegrityFlags = (it.timeIntegrityFlags || []).concat(['closed_unrepairable']);
          fixes.push({ type: 'flag_closed', title: it.title, catalog: hours.id });
        }
      } else if (tl.startMinutes < hours.openMin) {
        issues.push({
          type: 'before_open',
          title: it.title,
          startTime: it.startTime,
          open: minutesToHhmm(hours.openMin)
        });
        it.startTime = minutesToHhmm(hours.openMin + 15);
        var stay2 = Math.max(40, (tl.endAbs || tl.startAbs + 60) - tl.startAbs);
        it.endTime = minutesToHhmm(
          Math.min(hours.openMin + 15 + stay2, hours.closeMin - 15)
        );
        applyTimelineToItem(it, normalizeItemTimeline(it));
        fixes.push({ type: 'shift_after_open', title: it.title, to: it.startTime });
      }
    });
    return { items: items, issues: issues, fixes: fixes };
  }

  function enforceDayEndPolicy(items, styleKey) {
    var fixes = [];
    var maxEnd = 21 * 60 + 30;
    if (styleKey === 'foodie' || styleKey === 'anime') maxEnd = 22 * 60;
    if (styleKey === 'nightlife') maxEnd = 24 * 60 + 30;
    (items || []).forEach(function (it) {
      if (isNightlifeTitle(it.title)) return;
      var tl = normalizeItemTimeline(it);
      if (isNaN(tl.startAbs)) return;
      // Absolute end beyond max on same night (allow small overnight only for return)
      if (tl.startAbs >= maxEnd && !isReturnOrErrandTitle(it.title)) {
        it.timeIntegrityFlags = (it.timeIntegrityFlags || []).concat(['past_day_end']);
        fixes.push({
          type: 'past_day_end',
          title: it.title,
          startTime: it.startTime,
          maxEnd: minutesToHhmm(maxEnd % DAY_MINUTES)
        });
      }
    });
    return { items: items, fixes: fixes };
  }

  function rebuildPhasesFromItems(day, items) {
    var buckets = { 上午: [], 下午: [], 晚上: [] };
    sortItemsChronologically(items).forEach(function (it) {
      var tl = normalizeItemTimeline(it);
      applyTimelineToItem(it, tl);
      var period = periodForStartMinutes(
        isNaN(tl.startMinutes) ? 15 * 60 : tl.startMinutes % DAY_MINUTES
      );
      // Overnight continuing activity still evening
      if (tl.startDayOffset > 0) period = '晚上';
      it.period = period;
      buckets[period].push(it);
    });
    var order = ['上午', '下午', '晚上'];
    var emoji = { 上午: '☀️', 下午: '🌤️', 晚上: '🌙' };
    day.phases = order.map(function (label) {
      return {
        label: label,
        period: label,
        emoji: emoji[label],
        items: buckets[label]
      };
    });
    return day;
  }

  function repairOverlaps(items) {
    var sorted = sortItemsChronologically(items);
    var fixes = [];
    var i;
    for (i = 0; i < sorted.length; i++) {
      applyTimelineToItem(sorted[i], normalizeItemTimeline(sorted[i]));
    }
    for (i = 1; i < sorted.length; i++) {
      var prev = sorted[i - 1];
      var cur = sorted[i];
      var prevTl = normalizeItemTimeline(prev);
      var curTl = normalizeItemTimeline(cur);
      if (isNaN(prevTl.endAbs) || isNaN(curTl.startAbs)) continue;
      if (curTl.startAbs < prevTl.endAbs) {
        var gap = 10;
        var newStartAbs = prevTl.endAbs + gap;
        var stay = Math.max(25, (curTl.endAbs || curTl.startAbs + 40) - curTl.startAbs);
        cur.startTime = minutesToHhmm(newStartAbs % DAY_MINUTES);
        cur.endTime = minutesToHhmm((newStartAbs + stay) % DAY_MINUTES);
        // If wrapped, endDayOffset handled by normalize
        if (newStartAbs >= DAY_MINUTES && (newStartAbs + stay) % DAY_MINUTES < newStartAbs % DAY_MINUTES) {
          /* overnight ok */
        }
        applyTimelineToItem(cur, normalizeItemTimeline(cur));
        // If end still before start due to wrap confusion, force end after start same offset
        var fixed = normalizeItemTimeline(cur);
        if (!isNaN(fixed.startAbs) && !isNaN(fixed.endAbs) && fixed.endAbs <= fixed.startAbs) {
          cur.endTime = minutesToHhmm((fixed.startAbs + stay) % DAY_MINUTES);
          applyTimelineToItem(cur, normalizeItemTimeline(cur));
        }
        fixes.push({
          type: 'fix_overlap',
          title: cur.title,
          to: cur.startTime
        });
      }
    }
    return { items: sortItemsChronologically(sorted), fixes: fixes };
  }

  /**
   * Main entry: reconcile one day hidden structure.
   */
  function reconcileDayTimeline(day, opt) {
    opt = opt || {};
    var styleKey = opt.styleKey || '';
    var report = {
      issues: [],
      fixes: [],
      ok: true
    };
    if (!day) return { day: day, report: report };

    var items = flattenDayItems(day);
    if (!items.length) return { day: day, report: report };

    // 1) Normalize timelines
    items.forEach(function (it) {
      applyTimelineToItem(it, normalizeItemTimeline(it));
    });

    // 2) Opening hours (catalog) before sort so shifts land correctly
    var hoursRes = validateOpeningHours(items);
    report.issues = report.issues.concat(hoursRes.issues || []);
    report.fixes = report.fixes.concat(hoursRes.fixes || []);
    items = hoursRes.items;

    // 3) Meal labels / late dinner
    var mealRes = repairMealLabels(items, styleKey);
    report.fixes = report.fixes.concat(mealRes.fixes || []);
    items = mealRes.items;

    // 4) Chronological sort + overlap repair
    var conflict = detectTimeConflicts(items);
    report.issues = report.issues.concat(conflict.issues || []);
    var overlapRes = repairOverlaps(conflict.items);
    report.fixes = report.fixes.concat(overlapRes.fixes || []);
    items = overlapRes.items;

    // 5) Day-end policy flags (and soft note)
    var endRes = enforceDayEndPolicy(items, styleKey);
    report.fixes = report.fixes.concat(endRes.fixes || []);
    items = endRes.items;

    // 6) Final sort + rebuild phases by real clock
    items = sortItemsChronologically(items);
    items.forEach(function (it) {
      applyTimelineToItem(it, normalizeItemTimeline(it));
    });
    // Drop unrepairable closed major POIs from evening nonsense? keep but flagged
    rebuildPhasesFromItems(day, items);

    // 7) Final conflict scan (must be clean after repairs)
    var finalCheck = detectTimeConflicts(flattenDayItems(day));
    var hardLeft = (finalCheck.issues || []).filter(function (x) {
      return x.type === 'overlap' || x.type === 'negative_duration';
    });
    report.issues = report.issues.concat(hardLeft);
    report.ok = hardLeft.length === 0;
    day.timeIntegrity = {
      ok: report.ok,
      issueCount: report.issues.length,
      fixCount: report.fixes.length,
      issues: report.issues.slice(0, 20),
      fixes: report.fixes.slice(0, 20)
    };
    return { day: day, report: report };
  }

  function reconcileHiddenItinerary(hidden, opt) {
    opt = opt || {};
    var allIssues = [];
    var allFixes = [];
    if (!hidden || !Array.isArray(hidden.days)) {
      return { hidden: hidden, ok: true, issues: [], fixes: [] };
    }
    hidden.days.forEach(function (day) {
      var res = reconcileDayTimeline(day, opt);
      allIssues = allIssues.concat(res.report.issues || []);
      allFixes = allFixes.concat(res.report.fixes || []);
    });
    hidden.meta = hidden.meta || {};
    hidden.meta.timeIntegrity = {
      ok: allIssues.filter(function (x) {
        return x.type === 'overlap' || x.type === 'negative_duration';
      }).length === 0,
      issueCount: allIssues.length,
      fixCount: allFixes.length
    };
    return {
      hidden: hidden,
      ok: hidden.meta.timeIntegrity.ok,
      issues: allIssues,
      fixes: allFixes
    };
  }

  // Assert helpers for tests
  function assertChronological(items) {
    var sorted = sortItemsChronologically(items);
    var i;
    for (i = 1; i < sorted.length; i++) {
      var a = normalizeItemTimeline(sorted[i - 1]);
      var b = normalizeItemTimeline(sorted[i]);
      if (isNaN(a.startAbs) || isNaN(b.startAbs)) continue;
      if (b.startAbs < a.startAbs) return false;
    }
    return true;
  }

  global.SOARVIBE_ITINERARY_TIME_INTEGRITY = Object.freeze({
    hhmmToMinutes: hhmmToMinutes,
    minutesToHhmm: minutesToHhmm,
    normalizeItemTimeline: normalizeItemTimeline,
    sortItemsChronologically: sortItemsChronologically,
    detectTimeConflicts: detectTimeConflicts,
    reconcileDayTimeline: reconcileDayTimeline,
    reconcileHiddenItinerary: reconcileHiddenItinerary,
    lookupPoiHours: lookupPoiHours,
    inferMealLabelFromMinutes: inferMealLabelFromMinutes,
    assertChronological: assertChronological,
    POI_HOURS_CATALOG: POI_HOURS_CATALOG,
    MEAL_WINDOWS: MEAL_WINDOWS
  });
})(typeof window !== 'undefined' ? window : globalThis);
