/**
 * SoarVibe Travel Time Engine (P0)
 * Hard flight constraints, buffers, fallback transport, post-gen Time QA.
 * No Routes API calls yet — adapter stubs + deterministic fallbacks.
 */
(function (global) {
  'use strict';

  var AIRPORT_TZ = {
    TPE: { iana: 'Asia/Taipei', utcOffsetHours: 8, city: '台北' },
    TSA: { iana: 'Asia/Taipei', utcOffsetHours: 8, city: '台北' },
    NRT: { iana: 'Asia/Tokyo', utcOffsetHours: 9, city: '東京' },
    HND: { iana: 'Asia/Tokyo', utcOffsetHours: 9, city: '東京' },
    ICN: { iana: 'Asia/Seoul', utcOffsetHours: 9, city: '首爾' },
    GMP: { iana: 'Asia/Seoul', utcOffsetHours: 9, city: '首爾' },
    KIX: { iana: 'Asia/Tokyo', utcOffsetHours: 9, city: '大阪' },
    ITM: { iana: 'Asia/Tokyo', utcOffsetHours: 9, city: '大阪' },
    CTS: { iana: 'Asia/Tokyo', utcOffsetHours: 9, city: '札幌' },
    FUK: { iana: 'Asia/Tokyo', utcOffsetHours: 9, city: '福岡' },
    BKK: { iana: 'Asia/Bangkok', utcOffsetHours: 7, city: '曼谷' },
    DMK: { iana: 'Asia/Bangkok', utcOffsetHours: 7, city: '曼谷' },
    SIN: { iana: 'Asia/Singapore', utcOffsetHours: 8, city: '新加坡' },
    HKG: { iana: 'Asia/Hong_Kong', utcOffsetHours: 8, city: '香港' },
    MFM: { iana: 'Asia/Macau', utcOffsetHours: 8, city: '澳門' },
    PVG: { iana: 'Asia/Shanghai', utcOffsetHours: 8, city: '上海' },
    SHA: { iana: 'Asia/Shanghai', utcOffsetHours: 8, city: '上海' },
    PEK: { iana: 'Asia/Shanghai', utcOffsetHours: 8, city: '北京' },
    PKX: { iana: 'Asia/Shanghai', utcOffsetHours: 8, city: '北京' },
    KUL: { iana: 'Asia/Kuala_Lumpur', utcOffsetHours: 8, city: '吉隆坡' },
    MNL: { iana: 'Asia/Manila', utcOffsetHours: 8, city: '馬尼拉' },
    SGN: { iana: 'Asia/Ho_Chi_Minh', utcOffsetHours: 7, city: '胡志明市' },
    HAN: { iana: 'Asia/Bangkok', utcOffsetHours: 7, city: '河內' }
  };

  var AIRPORT_TO_CITY_MINUTES = {
    NRT: 75,
    HND: 40,
    ICN: 70,
    GMP: 35,
    KIX: 55,
    ITM: 35,
    CTS: 40,
    FUK: 25,
    BKK: 45,
    DMK: 50,
    SIN: 30,
    HKG: 35,
    TPE: 40,
    TSA: 25,
    PVG: 55,
    SHA: 35
  };

  var CONFIG = {
    internationalArrivalBufferMinutes: 90,
    domesticArrivalBufferMinutes: 45,
    internationalAirportCheckinBufferMinutes: 180,
    domesticAirportCheckinBufferMinutes: 90,
    minGapBetweenStopsMinutes: 10,
    defaultInterStopMinutes: 35,
    sameAreaInterStopMinutes: 20,
    crossCityInterStopMinutes: 50
  };

  var routeCache = Object.create(null);

  function extractAirportCode(text) {
    var s = String(text || '').toUpperCase();
    var m = s.match(/\b([A-Z]{3})\b/);
    if (m && AIRPORT_TZ[m[1]]) return m[1];
    var keys = Object.keys(AIRPORT_TZ);
    for (var i = 0; i < keys.length; i++) {
      if (s.indexOf(keys[i]) !== -1) return keys[i];
    }
    return '';
  }

  function resolveAirportMeta(codeOrText) {
    var code = extractAirportCode(codeOrText) || String(codeOrText || '').toUpperCase().trim();
    var meta = AIRPORT_TZ[code];
    if (meta) {
      return {
        code: code,
        iana: meta.iana,
        utcOffsetHours: meta.utcOffsetHours,
        city: meta.city
      };
    }
    return {
      code: code || '',
      iana: '',
      utcOffsetHours: null,
      city: ''
    };
  }

  function parseIsoLocal(iso) {
    var s = String(iso || '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return {
      date: m[1] + '-' + m[2] + '-' + m[3],
      hhmm: m[4] + ':' + m[5],
      minutes: parseInt(m[4], 10) * 60 + parseInt(m[5], 10)
    };
  }

  function hhmmToMinutes(hhmm) {
    var m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return NaN;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function minutesToHhmm(total) {
    var t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    var h = Math.floor(t / 60);
    var mi = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
  }

  function addMinutesToHhmm(hhmm, delta) {
    var base = hhmmToMinutes(hhmm);
    if (isNaN(base)) return '';
    return minutesToHhmm(base + (Number(delta) || 0));
  }

  function isLikelyInternational(fromCode, toCode) {
    var a = resolveAirportMeta(fromCode);
    var b = resolveAirportMeta(toCode);
    if (a.iana && b.iana && a.iana !== b.iana) return true;
    if (a.utcOffsetHours != null && b.utcOffsetHours != null && a.utcOffsetHours !== b.utcOffsetHours) {
      return true;
    }
    return !!(fromCode && toCode && fromCode !== toCode);
  }

  function arrivalBufferMinutes(fromCode, toCode) {
    return isLikelyInternational(fromCode, toCode)
      ? CONFIG.internationalArrivalBufferMinutes
      : CONFIG.domesticArrivalBufferMinutes;
  }

  function checkinBufferMinutes(fromCode, toCode) {
    return isLikelyInternational(fromCode, toCode)
      ? CONFIG.internationalAirportCheckinBufferMinutes
      : CONFIG.domesticAirportCheckinBufferMinutes;
  }

  function airportTransferMinutes(airportCode) {
    var code = extractAirportCode(airportCode) || String(airportCode || '').toUpperCase();
    if (AIRPORT_TO_CITY_MINUTES[code] != null) return AIRPORT_TO_CITY_MINUTES[code];
    return 60;
  }

  /**
   * Optional flight verification adapter — no paid API wired yet.
   * Always returns user_provided when times exist.
   */
  function verifyFlightTimes(flightInput) {
    flightInput = flightInput || {};
    if (!flightInput.departureIso && !flightInput.arrivalIso) {
      return {
        status: 'skipped',
        source: 'none',
        label: '',
        verified: false
      };
    }
    return {
      status: 'user_provided_flight_time',
      source: 'user_provided_flight_time',
      label: '使用您填寫的航班時間',
      verified: false,
      message: '尚未接外部航班核對；已強制採用您填寫的時間。'
    };
  }

  function buildRouteKey(from, to, mode, dateBucket) {
    return [String(from || '').trim(), String(to || '').trim(), String(mode || 'transit'), String(dateBucket || '')]
      .join('|')
      .toLowerCase();
  }

  function estimateTransferMinutes(fromLabel, toLabel, mode) {
    var key = buildRouteKey(fromLabel, toLabel, mode || 'transit', '');
    if (routeCache[key] != null) {
      return {
        estimatedMinutes: routeCache[key].estimatedMinutes,
        source: routeCache[key].source + '+cache',
        from: fromLabel,
        to: toLabel,
        mode: mode || 'transit'
      };
    }

    var fromCode = extractAirportCode(fromLabel);
    var toCode = extractAirportCode(toLabel);
    var minutes = CONFIG.defaultInterStopMinutes;
    var source = 'fallback_estimate';

    if (fromCode && !toCode) {
      minutes = airportTransferMinutes(fromCode);
      source = 'airport_to_city_table';
    } else if (toCode && !fromCode) {
      minutes = airportTransferMinutes(toCode);
      source = 'city_to_airport_table';
    } else if (fromCode && toCode) {
      minutes = Math.max(airportTransferMinutes(fromCode), airportTransferMinutes(toCode));
      source = 'airport_pair_table';
    } else {
      var a = String(fromLabel || '');
      var b = String(toLabel || '');
      var sameHint =
        (a && b && (a.indexOf(b.slice(0, 2)) !== -1 || b.indexOf(a.slice(0, 2)) !== -1)) ||
        /飯店|酒店|hotel|住宿/i.test(a) ||
        /飯店|酒店|hotel|住宿/i.test(b);
      minutes = sameHint ? CONFIG.sameAreaInterStopMinutes : CONFIG.crossCityInterStopMinutes;
      source = 'area_heuristic';
    }

    var result = {
      from: fromLabel,
      to: toLabel,
      mode: mode || 'transit',
      estimatedMinutes: minutes,
      source: source
    };
    routeCache[key] = result;
    return result;
  }

  function buildTransportConstraintsForAirports(payload) {
    payload = payload || {};
    var mode = payload.customerSelectedTransport || payload.transport || 'public-transit';
    var list = [];
    var arrAirport = payload.flightOutboundTo || payload.arrivalAirport || '';
    var retAirport = payload.flightReturnFrom || payload.returnDepartureAirport || '';
    var hotel =
      (payload.accommodations && payload.accommodations[0] && payload.accommodations[0].name) ||
      payload.accommodation ||
      '住宿飯店';

    if (arrAirport) {
      list.push(
        estimateTransferMinutes(arrAirport, hotel, mode)
      );
    }
    if (retAirport) {
      list.push(
        estimateTransferMinutes(hotel, retAirport, mode)
      );
    }
    return list;
  }

  function buildTransportConstraintsForDay(day, mode) {
    var items = flattenDayItems(day);
    var out = [];
    var i;
    for (i = 0; i < items.length - 1; i++) {
      var a = items[i];
      var b = items[i + 1];
      var from = a.title || a.name || '';
      var to = b.title || b.name || '';
      if (!from || !to) continue;
      out.push(estimateTransferMinutes(from, to, mode));
    }
    return out;
  }

  function flattenDayItems(day) {
    var items = [];
    if (!day || !Array.isArray(day.phases)) return items;
    day.phases.forEach(function (phase) {
      (phase.items || []).forEach(function (it) {
        items.push(it);
      });
    });
    return items;
  }

  function normalizeFlightPayload(payload) {
    payload = payload || {};
    var depIso = payload.flightDeparture || payload.departureTime || '';
    var arrIso = payload.flightArrival || payload.arrivalTime || '';
    var retIso = payload.flightReturn || payload.returnTime || '';
    var fromAirport = payload.flightOutboundFrom || payload.departureAirport || '';
    var toAirport = payload.flightOutboundTo || payload.arrivalAirport || '';
    var retFrom = payload.flightReturnFrom || payload.returnDepartureAirport || '';
    var retTo = payload.flightReturnTo || payload.returnArrivalAirport || '';

    var depMeta = resolveAirportMeta(fromAirport);
    var arrMeta = resolveAirportMeta(toAirport);
    var retDepMeta = resolveAirportMeta(retFrom);
    var dep = parseIsoLocal(depIso);
    var arr = parseIsoLocal(arrIso);
    var ret = parseIsoLocal(retIso);

    var arrBuffer = arrivalBufferMinutes(fromAirport, toAirport);
    var transferIn = airportTransferMinutes(toAirport);
    var checkinBuf = checkinBufferMinutes(retFrom || toAirport, retTo || fromAirport);
    var transferOut = airportTransferMinutes(retFrom || toAirport);

    var earliestSightseeing = '';
    if (arr) {
      earliestSightseeing = addMinutesToHhmm(arr.hhmm, arrBuffer + transferIn);
    }

    var latestLeaveHotel = '';
    if (ret) {
      latestLeaveHotel = addMinutesToHhmm(ret.hhmm, -(checkinBuf + transferOut));
    }

    var verification = verifyFlightTimes({
      flightNumber: payload.flightOutboundNumber || '',
      departureIso: depIso,
      arrivalIso: arrIso
    });

    return {
      source: 'user_provided_flight_time',
      verification: verification,
      departure: dep
        ? {
            iso: depIso,
            date: dep.date,
            hhmm: dep.hhmm,
            airport: fromAirport,
            airportCode: depMeta.code,
            timezone: depMeta.iana,
            utcOffsetHours: depMeta.utcOffsetHours
          }
        : null,
      arrival: arr
        ? {
            iso: arrIso,
            date: arr.date,
            hhmm: arr.hhmm,
            airport: toAirport,
            airportCode: arrMeta.code,
            timezone: arrMeta.iana,
            utcOffsetHours: arrMeta.utcOffsetHours
          }
        : null,
      returnDeparture: ret
        ? {
            iso: retIso,
            date: ret.date,
            hhmm: ret.hhmm,
            airport: retFrom,
            airportCode: retDepMeta.code,
            timezone: retDepMeta.iana,
            utcOffsetHours: retDepMeta.utcOffsetHours
          }
        : null,
      buffers: {
        arrivalBufferMinutes: arrBuffer,
        airportTransferInMinutes: transferIn,
        airportCheckinBufferMinutes: checkinBuf,
        airportTransferOutMinutes: transferOut,
        earliestSightseeingHhmm: earliestSightseeing,
        latestLeaveForAirportHhmm: latestLeaveHotel
      },
      transportConstraints: buildTransportConstraintsForAirports(payload),
      hardConstraints: {
        mustUseUserTimes: true,
        forbidAiInventFlightTimes: true,
        day1EarliestActivityHhmm: earliestSightseeing,
        lastDayLatestActivityEndHhmm: latestLeaveHotel
      }
    };
  }

  function buildFlightHardConstraintPrompt(normalized) {
    if (!normalized) return '';
    var lines = [];
    lines.push('【🔒 HARD CONSTRAINT——航班時間不可改（程式強制，AI 禁止覆寫）】');
    lines.push('來源：' + (normalized.verification && normalized.verification.label
      ? normalized.verification.label
      : '使用者填寫時間'));
    if (normalized.departure) {
      lines.push(
        '・去程起飛（出發地當地 ' +
          (normalized.departure.airportCode || '') +
          ' / ' +
          (normalized.departure.timezone || 'local') +
          '）：' +
          normalized.departure.hhmm +
          '（' +
          normalized.departure.date +
          '）'
      );
    }
    if (normalized.arrival) {
      lines.push(
        '・去程抵達（目的地當地 ' +
          (normalized.arrival.airportCode || '') +
          ' / ' +
          (normalized.arrival.timezone || 'local') +
          '）：' +
          normalized.arrival.hhmm +
          '（' +
          normalized.arrival.date +
          '）← Day1 唯一基準'
      );
      lines.push(
        '・入境／提行李 buffer：' +
          normalized.buffers.arrivalBufferMinutes +
          ' 分；機場→市區／飯店約 ' +
          normalized.buffers.airportTransferInMinutes +
          ' 分'
      );
      lines.push(
        '・Day1 最早可開始一般觀光／非接機行程：' +
          normalized.buffers.earliestSightseeingHhmm +
          '（到達後立刻排景點＝違規）'
      );
    }
    if (normalized.returnDeparture) {
      lines.push(
        '・回程起飛（當地 ' +
          (normalized.returnDeparture.airportCode || '') +
          '）：' +
          normalized.returnDeparture.hhmm
      );
      lines.push(
        '・最終日最晚離開市區／飯店前往機場：' +
          normalized.buffers.latestLeaveForAirportHhmm +
          '（含報到 buffer ' +
          normalized.buffers.airportCheckinBufferMinutes +
          ' 分 + 交通 ' +
          normalized.buffers.airportTransferOutMinutes +
          ' 分）'
      );
    }
    lines.push('禁止：自行修改起飛／抵達時間；禁止把起飛時間當成抵達時間；禁止發明航程。');
    if (normalized.transportConstraints && normalized.transportConstraints.length) {
      lines.push('【🚗 transportConstraints——以下分鐘數為唯一可用交通時間，禁止自行縮短】');
      normalized.transportConstraints.forEach(function (leg) {
        lines.push(
          '- ' +
            leg.from +
            ' → ' +
            leg.to +
            '｜' +
            leg.mode +
            '｜' +
            leg.estimatedMinutes +
            ' 分｜source=' +
            leg.source
        );
      });
    }
    return lines.join('\n') + '\n';
  }

  function isAirportOrTransitTitle(title) {
    return /機場|空港|airport|入境|行李|check-?in|接機|送機|電車|地鐵|JR|轉乘|前往住宿|赴飯店|到飯店/i.test(
      String(title || '')
    );
  }

  function applyTimeQaToHidden(hidden, payload) {
    var normalized = normalizeFlightPayload(payload || (hidden && hidden.meta) || {});
    var issues = [];
    var fixes = [];
    if (!hidden || !Array.isArray(hidden.days)) {
      return { hidden: hidden, issues: issues, fixes: fixes, normalized: normalized, ok: true };
    }

    var mode =
      (payload && (payload.customerSelectedTransport || payload.transport)) || 'public-transit';
    var dayCount = hidden.days.length;

    hidden.days.forEach(function (day, dayIdx) {
      var items = flattenDayItems(day);
      if (!items.length) return;

      var isFirst = dayIdx === 0;
      var isLast = dayIdx === dayCount - 1;

      if (isFirst && normalized.buffers.earliestSightseeingHhmm) {
        var earliest = hhmmToMinutes(normalized.buffers.earliestSightseeingHhmm);
        items.forEach(function (it) {
          if (!it.startTime) return;
          if (isAirportOrTransitTitle(it.title)) return;
          var start = hhmmToMinutes(it.startTime);
          if (!isNaN(start) && !isNaN(earliest) && start < earliest) {
            issues.push({
              type: 'before_arrival_buffer',
              day: day.dayNum,
              title: it.title,
              startTime: it.startTime
            });
            var stay = Math.max(
              30,
              (hhmmToMinutes(it.endTime) || start + 60) - start
            );
            it.startTime = normalized.buffers.earliestSightseeingHhmm;
            it.endTime = addMinutesToHhmm(it.startTime, stay);
            it.timeLabel = it.startTime + ' - ' + it.endTime;
            fixes.push({
              type: 'shift_after_buffer',
              title: it.title,
              to: it.startTime
            });
          }
        });
      }

      // Re-flatten after possible shifts
      items = flattenDayItems(day);
      var i;
      for (i = 0; i < items.length - 1; i++) {
        var a = items[i];
        var b = items[i + 1];
        if (!a.endTime && a.startTime) {
          a.endTime = addMinutesToHhmm(a.startTime, 60);
        }
        if (!a.startTime || !b.startTime) continue;
        var leg = estimateTransferMinutes(a.title || '', b.title || '', mode);
        var needGap = Math.max(CONFIG.minGapBetweenStopsMinutes, leg.estimatedMinutes);
        var aEnd = hhmmToMinutes(a.endTime || a.startTime);
        var bStart = hhmmToMinutes(b.startTime);
        if (isNaN(aEnd) || isNaN(bStart)) continue;
        if (bStart < aEnd) {
          issues.push({ type: 'overlap', day: day.dayNum, from: a.title, to: b.title });
          b.startTime = addMinutesToHhmm(a.endTime || a.startTime, needGap);
          var bStay = Math.max(25, (hhmmToMinutes(b.endTime) || bStart + 45) - bStart);
          b.endTime = addMinutesToHhmm(b.startTime, bStay);
          b.timeLabel = b.startTime + ' - ' + b.endTime;
          fixes.push({ type: 'fix_overlap', to: b.title, start: b.startTime });
          continue;
        }
        if (bStart - aEnd < needGap) {
          issues.push({
            type: 'insufficient_transfer',
            day: day.dayNum,
            from: a.title,
            to: b.title,
            needMinutes: needGap,
            actualGap: bStart - aEnd
          });
          b.startTime = addMinutesToHhmm(a.endTime || a.startTime, needGap);
          var stay2 = Math.max(25, (hhmmToMinutes(b.endTime) || bStart + 45) - bStart);
          b.endTime = addMinutesToHhmm(b.startTime, stay2);
          b.timeLabel = b.startTime + ' - ' + b.endTime;
          fixes.push({
            type: 'insert_transfer_gap',
            to: b.title,
            minutes: needGap,
            start: b.startTime
          });
        }
      }

      if (isLast && normalized.buffers.latestLeaveForAirportHhmm) {
        var latest = hhmmToMinutes(normalized.buffers.latestLeaveForAirportHhmm);
        items = flattenDayItems(day);
        items.forEach(function (it) {
          if (!it.endTime && it.startTime) it.endTime = addMinutesToHhmm(it.startTime, 40);
          if (!it.endTime) return;
          if (/機場|空港|airport|送機|報到/i.test(String(it.title || ''))) return;
          var end = hhmmToMinutes(it.endTime);
          if (!isNaN(end) && !isNaN(latest) && end > latest) {
            issues.push({
              type: 'return_buffer_breach',
              day: day.dayNum,
              title: it.title,
              endTime: it.endTime
            });
            it.endTime = normalized.buffers.latestLeaveForAirportHhmm;
            var st = hhmmToMinutes(it.startTime);
            var en = hhmmToMinutes(it.endTime);
            if (!isNaN(st) && !isNaN(en) && en <= st) {
              it.startTime = addMinutesToHhmm(it.endTime, -40);
            }
            it.timeLabel = (it.startTime || '') + ' - ' + it.endTime;
            fixes.push({ type: 'trim_for_airport', title: it.title, end: it.endTime });
          }
        });
      }
    });

    hidden.meta = hidden.meta || {};
    hidden.meta.flightTimeEngine = {
      source: normalized.source,
      verification: normalized.verification,
      buffers: normalized.buffers,
      hardConstraints: normalized.hardConstraints,
      qa: { issueCount: issues.length, fixCount: fixes.length, issues: issues, fixes: fixes }
    };

    return {
      hidden: hidden,
      issues: issues,
      fixes: fixes,
      normalized: normalized,
      ok: issues.length === 0
    };
  }

  function attachToPayload(payload) {
    var next = Object.assign({}, payload || {});
    var normalized = normalizeFlightPayload(next);
    next.departureTimezone = (normalized.departure && normalized.departure.timezone) || '';
    next.arrivalTimezone = (normalized.arrival && normalized.arrival.timezone) || '';
    next.flightTimeNormalized = normalized;
    next.transportConstraints = normalized.transportConstraints;
    next.flightVerification = normalized.verification;
    return next;
  }

  global.SOARVIBE_TRAVEL_TIME_ENGINE = {
    version: 1,
    CONFIG: CONFIG,
    extractAirportCode: extractAirportCode,
    resolveAirportMeta: resolveAirportMeta,
    normalizeFlightPayload: normalizeFlightPayload,
    verifyFlightTimes: verifyFlightTimes,
    estimateTransferMinutes: estimateTransferMinutes,
    buildTransportConstraintsForAirports: buildTransportConstraintsForAirports,
    buildTransportConstraintsForDay: buildTransportConstraintsForDay,
    buildFlightHardConstraintPrompt: buildFlightHardConstraintPrompt,
    applyTimeQaToHidden: applyTimeQaToHidden,
    attachToPayload: attachToPayload,
    hhmmToMinutes: hhmmToMinutes,
    minutesToHhmm: minutesToHhmm,
    addMinutesToHhmm: addMinutesToHhmm,
    clearRouteCache: function () {
      routeCache = Object.create(null);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
