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
    crossCityInterStopMinutes: 50,
    previewOutboundDepHhmm: '06:30',
    previewReturnDepHhmm: '20:30',
    previewOriginAirport: 'TPE',
    previewOriginUtcOffsetHours: 8
  };

  /**
   * Maintainable destination profiles for preview flight estimates + hotel areas.
   * flightMinutesFromTaiwan = typical airborne minutes (not wall-clock).
   * haul: short | medium | long — shapes Day1 / LastDay expectations.
   */
  var DESTINATION_PROFILES = [
    {
      keys: ['東京', 'tokyo', '成田', '羽田'],
      regionId: 'japan_tokyo',
      label: '東京',
      defaultAirport: 'NRT',
      flightMinutesFromTaiwan: 210,
      flightMinutesRange: [180, 240],
      utcOffsetHours: 9,
      iana: 'Asia/Tokyo',
      hotelAreas: ['新宿', '上野', '東京站'],
      haul: 'short'
    },
    {
      keys: ['大阪', 'osaka', '關西'],
      regionId: 'japan_osaka',
      label: '大阪',
      defaultAirport: 'KIX',
      flightMinutesFromTaiwan: 165,
      flightMinutesRange: [150, 195],
      utcOffsetHours: 9,
      iana: 'Asia/Tokyo',
      hotelAreas: ['難波', '梅田', '心齋橋'],
      haul: 'short'
    },
    {
      keys: ['京都', 'kyoto'],
      regionId: 'japan_kyoto',
      label: '京都',
      defaultAirport: 'KIX',
      flightMinutesFromTaiwan: 165,
      flightMinutesRange: [150, 195],
      utcOffsetHours: 9,
      iana: 'Asia/Tokyo',
      hotelAreas: ['京都站', '祇園', '河原町'],
      haul: 'short'
    },
    {
      keys: ['北海道', '札幌', 'hokkaido', 'sapporo'],
      regionId: 'japan_hokkaido',
      label: '北海道',
      defaultAirport: 'CTS',
      flightMinutesFromTaiwan: 240,
      flightMinutesRange: [210, 270],
      utcOffsetHours: 9,
      iana: 'Asia/Tokyo',
      hotelAreas: ['札幌站', '大通'],
      haul: 'short'
    },
    {
      keys: ['沖繩', 'okinawa', '那霸'],
      regionId: 'japan_okinawa',
      label: '沖繩',
      defaultAirport: 'OKA',
      flightMinutesFromTaiwan: 135,
      flightMinutesRange: [120, 165],
      utcOffsetHours: 9,
      iana: 'Asia/Tokyo',
      hotelAreas: ['那霸', '國際通'],
      haul: 'short'
    },
    {
      keys: ['首爾', 'seoul', '韓國', 'korea'],
      regionId: 'korea_seoul',
      label: '首爾',
      defaultAirport: 'ICN',
      flightMinutesFromTaiwan: 165,
      flightMinutesRange: [150, 180],
      utcOffsetHours: 9,
      iana: 'Asia/Seoul',
      hotelAreas: ['明洞', '弘大', '江南'],
      haul: 'short'
    },
    {
      keys: ['曼谷', 'bangkok', '泰國'],
      regionId: 'thailand_bangkok',
      label: '曼谷',
      defaultAirport: 'BKK',
      flightMinutesFromTaiwan: 225,
      flightMinutesRange: [210, 255],
      utcOffsetHours: 7,
      iana: 'Asia/Bangkok',
      hotelAreas: ['暹羅', 'Sukhumvit', '考山路'],
      haul: 'short'
    },
    {
      keys: ['新加坡', 'singapore'],
      regionId: 'singapore',
      label: '新加坡',
      defaultAirport: 'SIN',
      flightMinutesFromTaiwan: 270,
      flightMinutesRange: [240, 300],
      utcOffsetHours: 8,
      iana: 'Asia/Singapore',
      hotelAreas: ['市中心', '烏節路', '濱海灣'],
      haul: 'medium'
    },
    {
      keys: ['香港', 'hong kong', 'hongkong'],
      regionId: 'hongkong',
      label: '香港',
      defaultAirport: 'HKG',
      flightMinutesFromTaiwan: 100,
      flightMinutesRange: [90, 120],
      utcOffsetHours: 8,
      iana: 'Asia/Hong_Kong',
      hotelAreas: ['尖沙咀', '銅鑼灣', '中環'],
      haul: 'short'
    },
    {
      keys: ['倫敦', 'london'],
      regionId: 'uk_london',
      label: '倫敦',
      defaultAirport: 'LHR',
      flightMinutesFromTaiwan: 900,
      flightMinutesRange: [840, 960],
      utcOffsetHours: 0,
      iana: 'Europe/London',
      hotelAreas: ['Kings Cross', 'South Bank', 'Paddington'],
      haul: 'long'
    },
    {
      keys: ['巴黎', 'paris'],
      regionId: 'france_paris',
      label: '巴黎',
      defaultAirport: 'CDG',
      flightMinutesFromTaiwan: 900,
      flightMinutesRange: [840, 960],
      utcOffsetHours: 1,
      iana: 'Europe/Paris',
      hotelAreas: ['拉丁區', '馬雷區', '歌劇院'],
      haul: 'long'
    },
    {
      keys: ['紐約', 'new york', 'nyc'],
      regionId: 'usa_nyc',
      label: '紐約',
      defaultAirport: 'JFK',
      flightMinutesFromTaiwan: 960,
      flightMinutesRange: [900, 1020],
      utcOffsetHours: -5,
      iana: 'America/New_York',
      hotelAreas: ['Midtown', 'Downtown'],
      haul: 'long'
    }
  ];

  // Extra airports used by long-haul preview estimates
  AIRPORT_TZ.LHR = { iana: 'Europe/London', utcOffsetHours: 0, city: '倫敦' };
  AIRPORT_TZ.CDG = { iana: 'Europe/Paris', utcOffsetHours: 1, city: '巴黎' };
  AIRPORT_TZ.JFK = { iana: 'America/New_York', utcOffsetHours: -5, city: '紐約' };
  AIRPORT_TZ.OKA = { iana: 'Asia/Tokyo', utcOffsetHours: 9, city: '那霸' };
  AIRPORT_TO_CITY_MINUTES.LHR = 50;
  AIRPORT_TO_CITY_MINUTES.CDG = 50;
  AIRPORT_TO_CITY_MINUTES.JFK = 60;
  AIRPORT_TO_CITY_MINUTES.OKA = 30;

  var routeCache = Object.create(null);

  function resolveDestinationProfile(destination) {
    var dest = String(destination || '').trim().toLowerCase();
    if (!dest) return null;
    for (var i = 0; i < DESTINATION_PROFILES.length; i++) {
      var row = DESTINATION_PROFILES[i];
      for (var j = 0; j < row.keys.length; j++) {
        if (dest.indexOf(String(row.keys[j]).toLowerCase()) !== -1) return row;
      }
    }
    return null;
  }

  function estimateFlightDuration(originRegionOrAirport, destinationRegionOrText) {
    var profile = resolveDestinationProfile(destinationRegionOrText);
    var fromCode = extractAirportCode(originRegionOrAirport) || CONFIG.previewOriginAirport;
    var toCode =
      extractAirportCode(destinationRegionOrText) ||
      (profile && profile.defaultAirport) ||
      '';
    if (profile && (!fromCode || fromCode === 'TPE' || fromCode === 'TSA')) {
      return {
        minutes: profile.flightMinutesFromTaiwan,
        range: profile.flightMinutesRange.slice(),
        label:
          'Taiwan → ' +
          profile.label +
          ' 約 ' +
          (profile.flightMinutesRange[0] / 60).toFixed(1).replace(/\.0$/, '') +
          '–' +
          (profile.flightMinutesRange[1] / 60).toFixed(1).replace(/\.0$/, '') +
          'h',
        profile: profile,
        fromCode: fromCode || CONFIG.previewOriginAirport,
        toCode: toCode || profile.defaultAirport,
        source: 'destination_profile'
      };
    }
    var mins = 210;
    if (fromCode && toCode) {
      // reuse airport-pair heuristics via typical table in host if needed
      var fromOff = resolveAirportMeta(fromCode).utcOffsetHours;
      var toOff = resolveAirportMeta(toCode).utcOffsetHours;
      if (fromOff != null && toOff != null && Math.abs(fromOff - toOff) >= 6) mins = 900;
      else if (toCode === 'ICN' || toCode === 'GMP') mins = 165;
      else if (toCode === 'BKK' || toCode === 'DMK') mins = 225;
      else if (toCode === 'NRT' || toCode === 'HND') mins = 210;
      else if (toCode === 'KIX' || toCode === 'ITM') mins = 165;
    }
    return {
      minutes: mins,
      range: [mins - 30, mins + 30],
      label: (fromCode || 'TPE') + ' → ' + (toCode || 'DEST') + ' ~' + Math.round(mins / 60) + 'h',
      profile: profile,
      fromCode: fromCode || CONFIG.previewOriginAirport,
      toCode: toCode,
      source: 'heuristic'
    };
  }

  function buildPreviewTripPlan(payload) {
    payload = payload || {};
    var profile = resolveDestinationProfile(payload.destination);
    var duration = estimateFlightDuration(CONFIG.previewOriginAirport, payload.destination);
    var fromCode = duration.fromCode || CONFIG.previewOriginAirport;
    var toCode = duration.toCode || (profile && profile.defaultAirport) || '';
    var fromMeta = resolveAirportMeta(fromCode);
    var toMeta = toCode
      ? resolveAirportMeta(toCode)
      : {
          code: '',
          iana: (profile && profile.iana) || '',
          utcOffsetHours: profile ? profile.utcOffsetHours : null,
          city: (profile && profile.label) || ''
        };
    var depHhmm = CONFIG.previewOutboundDepHhmm;
    var retHhmm = CONFIG.previewReturnDepHhmm;
    var fromOff =
      fromMeta.utcOffsetHours != null ? fromMeta.utcOffsetHours : CONFIG.previewOriginUtcOffsetHours;
    var toOff = toMeta.utcOffsetHours != null ? toMeta.utcOffsetHours : fromOff;
    var tzDeltaMins = (toOff - fromOff) * 60;
    var arrHhmm = addMinutesToHhmm(depHhmm, duration.minutes + tzDeltaMins);
    var arrBuffer = arrivalBufferMinutes(fromCode, toCode || fromCode);
    var transferIn = toCode ? airportTransferMinutes(toCode) : 60;
    var checkinBuf = checkinBufferMinutes(toCode || fromCode, fromCode);
    var transferOut = toCode ? airportTransferMinutes(toCode) : 60;
    var earliest = addMinutesToHhmm(arrHhmm, arrBuffer + transferIn);
    var latestLeave = addMinutesToHhmm(retHhmm, -(checkinBuf + transferOut));
    var haul = (profile && profile.haul) || (duration.minutes >= 600 ? 'long' : 'short');
    var hotelAreas = (profile && profile.hotelAreas) || ['市中心交通便利區'];
    var notice =
      '尚未填寫航班，本次先以早去晚回的預設時段規劃。實際訂票後補上航班資訊，可重新精準最佳化。';

    return {
      mode: 'preview',
      notice: notice,
      haul: haul,
      originAirport: fromCode,
      destinationAirport: toCode,
      originTimezone: fromMeta.iana || 'Asia/Taipei',
      destinationTimezone: toMeta.iana || '',
      originUtcOffsetHours: fromOff,
      destinationUtcOffsetHours: toOff,
      outboundDepartureHhmm: depHhmm,
      estimatedArrivalHhmm: arrHhmm,
      returnDepartureHhmm: retHhmm,
      flightDurationMinutes: duration.minutes,
      flightDurationLabel: duration.label,
      flightDurationRange: duration.range,
      arrivalBufferMinutes: arrBuffer,
      airportTransferInMinutes: transferIn,
      airportCheckinBufferMinutes: checkinBuf,
      airportTransferOutMinutes: transferOut,
      earliestSightseeingHhmm: earliest,
      latestLeaveForAirportHhmm: latestLeave,
      hotelAreas: hotelAreas,
      defaultHotelArea: hotelAreas[0],
      isRealFlight: false
    };
  }

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

    var completeOutbound = hasCompleteOutboundFlightData(payload);
    var completeReturn = hasCompleteReturnFlightData(payload);
    var complete = completeOutbound;
    var partial = hasPartialFlightData(payload);
    var previewPlan = !complete ? buildPreviewTripPlan(payload) : null;

    var depMeta = resolveAirportMeta(fromAirport);
    var arrMeta = resolveAirportMeta(toAirport);
    var retDepMeta = resolveAirportMeta(retFrom);
    var dep = completeOutbound ? parseIsoLocal(depIso) : null;
    var arr = completeOutbound ? parseIsoLocal(arrIso) : null;
    var ret = completeReturn ? parseIsoLocal(retIso) : null;

    var arrBuffer = completeOutbound ? arrivalBufferMinutes(fromAirport, toAirport) : 0;
    var transferIn = completeOutbound ? airportTransferMinutes(toAirport) : 0;
    var checkinBuf = completeReturn
      ? checkinBufferMinutes(retFrom || toAirport, retTo || fromAirport)
      : 0;
    var transferOut = completeReturn ? airportTransferMinutes(retFrom || toAirport) : 0;

    var earliestSightseeing = '';
    if (arr) {
      earliestSightseeing = addMinutesToHhmm(arr.hhmm, arrBuffer + transferIn);
    } else if (previewPlan) {
      earliestSightseeing = previewPlan.earliestSightseeingHhmm;
      arrBuffer = previewPlan.arrivalBufferMinutes;
      transferIn = previewPlan.airportTransferInMinutes;
    }

    var latestLeaveHotel = '';
    if (ret) {
      latestLeaveHotel = addMinutesToHhmm(ret.hhmm, -(checkinBuf + transferOut));
    } else if (previewPlan) {
      latestLeaveHotel = previewPlan.latestLeaveForAirportHhmm;
      checkinBuf = previewPlan.airportCheckinBufferMinutes;
      transferOut = previewPlan.airportTransferOutMinutes;
    }

    var verification = completeOutbound
      ? verifyFlightTimes({
          flightNumber: payload.flightOutboundNumber || '',
          departureIso: depIso,
          arrivalIso: arrIso
        })
      : {
          status: 'preview_trip_mode',
          source: partial ? 'partial_flight_data' : 'preview_defaults',
          label: partial ? '航班資料不完整・Preview 模式' : 'Preview・早去晚回預設時段',
          message: previewPlan ? previewPlan.notice : '尚未填寫航班，使用預覽預設時段。'
        };

    var userHotel =
      (payload.accommodations &&
        payload.accommodations[0] &&
        String(payload.accommodations[0].name || '').trim()) ||
      String(payload.accommodation || '').trim();
    var hotelAreas = (previewPlan && previewPlan.hotelAreas) || ['市中心交通便利區'];
    var accommodationPlan = {
      mode: userHotel ? 'user_hotel' : 'area_only',
      hotelName: userHotel || '',
      defaultHotelArea: userHotel ? '' : hotelAreas[0],
      hotelAreas: hotelAreas,
      notice: userHotel
        ? ''
        : '尚未指定飯店，本次以中價位、交通便利住宿作為動線基準。'
    };

    return {
      source: complete ? 'user_provided_flight_time' : verification.source,
      planningMode: complete ? 'precise' : 'preview',
      tripMode: complete ? 'PRECISION_TRIP_MODE' : 'PREVIEW_TRIP_MODE',
      hasCompleteFlightData: complete,
      hasCompleteOutboundFlightData: completeOutbound,
      hasCompleteReturnFlightData: completeReturn,
      hasPartialFlightData: partial && !complete,
      previewPlan: previewPlan,
      accommodationPlan: accommodationPlan,
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
        : previewPlan
          ? {
              iso: '',
              date: payload.dateStart || '',
              hhmm: previewPlan.outboundDepartureHhmm,
              airport: previewPlan.originAirport,
              airportCode: previewPlan.originAirport,
              timezone: previewPlan.originTimezone,
              utcOffsetHours: previewPlan.originUtcOffsetHours,
              isPreview: true
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
        : previewPlan
          ? {
              iso: '',
              date: payload.dateStart || '',
              hhmm: previewPlan.estimatedArrivalHhmm,
              airport: previewPlan.destinationAirport,
              airportCode: previewPlan.destinationAirport,
              timezone: previewPlan.destinationTimezone,
              utcOffsetHours: previewPlan.destinationUtcOffsetHours,
              isPreview: true
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
        : previewPlan
          ? {
              iso: '',
              date: payload.dateEnd || '',
              hhmm: previewPlan.returnDepartureHhmm,
              airport: previewPlan.destinationAirport,
              airportCode: previewPlan.destinationAirport,
              timezone: previewPlan.destinationTimezone,
              utcOffsetHours: previewPlan.destinationUtcOffsetHours,
              isPreview: true
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
      transportConstraints: complete
        ? buildTransportConstraintsForAirports(payload)
        : {
            mode: 'estimated',
            note: 'Preview／無完整航班・交通時間僅供預估'
          },
      hardConstraints: {
        active: complete,
        mustUseUserTimes: complete,
        forbidAiInventFlightTimes: true,
        day1EarliestActivityHhmm: earliestSightseeing,
        lastDayLatestActivityEndHhmm: latestLeaveHotel
      }
    };
  }

  function filled(v) {
    return String(v || '').trim().length > 0;
  }

  function hasCompleteOutboundFlightData(payload) {
    payload = payload || {};
    var depIso = payload.flightDeparture || payload.departureTime || '';
    var arrIso = payload.flightArrival || payload.arrivalTime || '';
    var fromAirport = payload.flightOutboundFrom || payload.departureAirport || '';
    var toAirport = payload.flightOutboundTo || payload.arrivalAirport || '';
    var dep = parseIsoLocal(depIso);
    var arr = parseIsoLocal(arrIso);
    return !!(
      filled(fromAirport) &&
      filled(toAirport) &&
      dep &&
      arr &&
      dep.hhmm &&
      arr.hhmm
    );
  }

  function hasCompleteReturnFlightData(payload) {
    payload = payload || {};
    var retIso = payload.flightReturn || payload.returnTime || '';
    var retFrom = payload.flightReturnFrom || payload.returnDepartureAirport || '';
    var ret = parseIsoLocal(retIso);
    return !!(filled(retFrom) && ret && ret.hhmm);
  }

  function hasCompleteFlightData(payload) {
    return hasCompleteOutboundFlightData(payload);
  }

  function hasPartialFlightData(payload) {
    payload = payload || {};
    if (hasCompleteFlightData(payload)) return false;
    var fields = [
      payload.flightOutboundNumber,
      payload.flightReturnNumber,
      payload.flightOutboundFrom || payload.departureAirport,
      payload.flightOutboundTo || payload.arrivalAirport,
      payload.flightReturnFrom || payload.returnDepartureAirport,
      payload.flightReturnTo || payload.returnArrivalAirport,
      payload.flightDeparture || payload.departureTime,
      payload.flightArrival || payload.arrivalTime,
      payload.flightReturn || payload.returnTime
    ];
    return fields.some(function (f) {
      return filled(f);
    });
  }

  function buildInspirationFlightPrompt() {
    return buildPreviewFlightPrompt(null);
  }

  function buildPreviewFlightPrompt(normalized) {
    var plan = (normalized && normalized.previewPlan) || null;
    var lines = [
      '【✈️ PREVIEW_TRIP_MODE——早去晚回示範行程／靈感規劃】',
      '・這不是真實航班。禁止顯示假的航班編號。',
      '・' +
        (plan && plan.notice
          ? plan.notice
          : '尚未填寫航班，本次先以早去晚回的預設時段規劃。實際訂票後補上航班資訊，可重新精準最佳化。')
    ];
    if (plan) {
      lines.push(
        '・預設去程出發（示範）：' +
          plan.outboundDepartureHhmm +
          '（' +
          plan.originAirport +
          '／' +
          plan.originTimezone +
          '）'
      );
      lines.push(
        '・預估飛行時間（deterministic）：' +
          plan.flightDurationLabel +
          '（約 ' +
          plan.flightDurationMinutes +
          ' 分）'
      );
      lines.push(
        '・預估目的地當地抵達：' +
          plan.estimatedArrivalHhmm +
          '（已含時差；非使用者真實航班）'
      );
      lines.push(
        '・入境／提行李 buffer ' +
          plan.arrivalBufferMinutes +
          ' 分＋機場→市區約 ' +
          plan.airportTransferInMinutes +
          ' 分 → Day1 最早一般行程 ' +
          plan.earliestSightseeingHhmm
      );
      lines.push(
        '・預設回程出發（示範）：' +
          plan.returnDepartureHhmm +
          '；最終日最晚離開市區約 ' +
          plan.latestLeaveForAirportHhmm
      );
      if (plan.haul === 'short') {
        lines.push(
          '・亞洲近程 Preview：Day1 應在下午以前進入城市，下午／晚上正常行程；最終日上午／下午仍可安排，傍晚前往機場。'
        );
        lines.push('・禁止 Day1 晚上才抵達、禁止最終日一早就結束。');
      } else if (plan.haul === 'long') {
        lines.push(
          '・長程目的地：依預估飛行時間調整 Day1 開始，不要硬套亞洲近程模板；仍禁止捏造真實航班。'
        );
      }
    }
    lines.push('・交通分鐘數僅能標示「預估」。');
    return lines.join('\n');
  }

  function buildFlightHardConstraintPrompt(normalized) {
    if (!normalized || !normalized.hasCompleteFlightData) {
      return buildPreviewFlightPrompt(normalized) + '\n';
    }
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
    } else {
      lines.push('・回程航班未完整：最終日不套用送機 HARD CONSTRAINT，按一般完整日規劃。');
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
    var applyFlightHardQa = !!(
      (normalized.hasCompleteFlightData && normalized.hardConstraints.active) ||
      (normalized.planningMode === 'preview' && normalized.buffers && normalized.buffers.earliestSightseeingHhmm)
    );
    var integrity = global.SOARVIBE_ITINERARY_TIME_INTEGRITY || null;

    function itemAbsStart(it) {
      if (integrity && typeof integrity.normalizeItemTimeline === 'function') {
        var tl = integrity.normalizeItemTimeline(it);
        return tl.startAbs;
      }
      return hhmmToMinutes(it && it.startTime);
    }

    function itemAbsEnd(it) {
      if (integrity && typeof integrity.normalizeItemTimeline === 'function') {
        var tl = integrity.normalizeItemTimeline(it);
        return tl.endAbs;
      }
      return hhmmToMinutes(it && (it.endTime || it.startTime));
    }

    function sortDayPhasesChronologically(day) {
      if (integrity && typeof integrity.sortItemsChronologically === 'function') {
        var flat = [];
        (day.phases || []).forEach(function (phase) {
          (phase.items || []).forEach(function (it) {
            flat.push(it);
          });
        });
        flat = integrity.sortItemsChronologically(flat);
        var buckets = { 上午: [], 下午: [], 晚上: [] };
        flat.forEach(function (it) {
          var tl = integrity.normalizeItemTimeline(it);
          it.startTime = tl.startTime;
          it.endTime = tl.endTime;
          it.startAbs = tl.startAbs;
          it.endAbs = tl.endAbs;
          it.crossesMidnight = tl.crossesMidnight;
          if (it.startTime && it.endTime) it.timeLabel = it.startTime + ' - ' + it.endTime;
          var startMin = isNaN(tl.startMinutes) ? 15 * 60 : tl.startMinutes;
          var period = startMin < 12 * 60 ? '上午' : startMin < 17 * 60 ? '下午' : '晚上';
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
        return;
      }
      // Fallback: sort within each phase by clock only
      (day.phases || []).forEach(function (phase) {
        if (!phase.items) return;
        phase.items.sort(function (a, b) {
          return (hhmmToMinutes(a.startTime) || 0) - (hhmmToMinutes(b.startTime) || 0);
        });
      });
    }

    hidden.days.forEach(function (day, dayIdx) {
      sortDayPhasesChronologically(day);
      var items = flattenDayItems(day);
      if (!items.length) return;

      var isFirst = dayIdx === 0;
      var isLast = dayIdx === dayCount - 1;

      if (applyFlightHardQa && isFirst && normalized.buffers.earliestSightseeingHhmm) {
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

      // Re-flatten after possible shifts + chronological order
      sortDayPhasesChronologically(day);
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
        var aEnd = itemAbsEnd(a);
        var bStart = itemAbsStart(b);
        if (isNaN(aEnd) || isNaN(bStart)) continue;
        if (bStart < aEnd) {
          issues.push({ type: 'overlap', day: day.dayNum, from: a.title, to: b.title });
          // Shift using absolute end + gap, then write clock times
          var newStartAbs = aEnd + needGap;
          var bStay = Math.max(
            25,
            (itemAbsEnd(b) || bStart + 45) - bStart
          );
          b.startTime = minutesToHhmm(newStartAbs);
          b.endTime = minutesToHhmm(newStartAbs + bStay);
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
          var shiftedAbs = aEnd + needGap;
          var stay2 = Math.max(25, (itemAbsEnd(b) || bStart + 45) - bStart);
          b.startTime = minutesToHhmm(shiftedAbs);
          b.endTime = minutesToHhmm(shiftedAbs + stay2);
          b.timeLabel = b.startTime + ' - ' + b.endTime;
          fixes.push({
            type: 'insert_transfer_gap',
            to: b.title,
            minutes: needGap,
            start: b.startTime
          });
        }
      }

      if (applyFlightHardQa && isLast && normalized.buffers.latestLeaveForAirportHhmm) {
        var latest = hhmmToMinutes(normalized.buffers.latestLeaveForAirportHhmm);
        items = flattenDayItems(day);
        items.forEach(function (it) {
          if (!it.endTime && it.startTime) it.endTime = addMinutesToHhmm(it.startTime, 40);
          if (!it.endTime) return;
          if (/機場|空港|airport|送機|報到/i.test(String(it.title || ''))) return;
          var end = hhmmToMinutes(it.endTime);
          // Overnight end (00:xx after late activity) is always past return buffer on same calendar label —
          // use absolute end when integrity available
          var endAbs = itemAbsEnd(it);
          var endCmp = !isNaN(endAbs) ? endAbs % (24 * 60) : end;
          if (!isNaN(endCmp) && !isNaN(latest) && endCmp > latest && (isNaN(endAbs) || endAbs < 24 * 60)) {
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

      // Final chronological pass after flight/transfer edits
      sortDayPhasesChronologically(day);
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
    next.planningMode = normalized.planningMode;
    next.tripMode = normalized.tripMode;
    next.hasCompleteFlightData = normalized.hasCompleteFlightData;
    next.hasPartialFlightData = normalized.hasPartialFlightData;
    next.previewPlan = normalized.previewPlan || null;
    next.accommodationPlan = normalized.accommodationPlan || null;
    next.defaultHotelArea =
      (normalized.accommodationPlan && normalized.accommodationPlan.defaultHotelArea) || '';
    return next;
  }

  global.SOARVIBE_TRAVEL_TIME_ENGINE = {
    version: 3,
    CONFIG: CONFIG,
    extractAirportCode: extractAirportCode,
    resolveAirportMeta: resolveAirportMeta,
    normalizeFlightPayload: normalizeFlightPayload,
    hasCompleteFlightData: hasCompleteFlightData,
    hasCompleteOutboundFlightData: hasCompleteOutboundFlightData,
    hasCompleteReturnFlightData: hasCompleteReturnFlightData,
    hasPartialFlightData: hasPartialFlightData,
    verifyFlightTimes: verifyFlightTimes,
    estimateTransferMinutes: estimateTransferMinutes,
    buildTransportConstraintsForAirports: buildTransportConstraintsForAirports,
    buildTransportConstraintsForDay: buildTransportConstraintsForDay,
    buildFlightHardConstraintPrompt: buildFlightHardConstraintPrompt,
    buildInspirationFlightPrompt: buildInspirationFlightPrompt,
    buildPreviewFlightPrompt: buildPreviewFlightPrompt,
    buildPreviewTripPlan: buildPreviewTripPlan,
    estimateFlightDuration: estimateFlightDuration,
    resolveDestinationProfile: resolveDestinationProfile,
    DESTINATION_PROFILES: DESTINATION_PROFILES,
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
