/**
 * SoarVibe Guide Intelligence / Professional Itinerary Planner (P1)
 * Destination intelligence, area clustering, route score, style weights,
 * anti-repeat, seasonal context, professional guide score.
 * Gemini proposes; this engine validates, scores, and locally optimizes.
 */
(function (global) {
  'use strict';

  var DAY_MINUTES = 24 * 60;
  var GUIDE_SCORE_THRESHOLD = 68; // calibrated via golden + good-cluster fixtures (P1.1)

  function TI() {
    return global.SOARVIBE_ITINERARY_TIME_INTEGRITY || null;
  }

  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return NaN;
    var R = 6371;
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

  function estimateTransitMinutes(km, mode) {
    if (isNaN(km)) return 25;
    if (km < 0.8) return Math.max(8, Math.round(km * 14));
    if (mode === 'self-drive') return Math.max(12, Math.round(km * 3.5 + 8));
    return Math.max(15, Math.round(km * 5.5 + 10));
  }

  // DESTINATION_PACKS removed as primary source (P1.1).
  // Curated overlays live in SOARVIBE_DESTINATION_INTELLIGENCE.CURATED_ENHANCEMENTS.
  // resolveDestinationPack() always builds via Dynamic Destination Intelligence.

  function DI() {
    return global.SOARVIBE_DESTINATION_INTELLIGENCE || null;
  }

  function resolveDestinationPack(destination, tripContext) {
    var di = DI();
    if (di && typeof di.buildDestinationIntelligence === 'function') {
      return di.buildDestinationIntelligence(destination, tripContext || {});
    }
    // Minimal fallback if DI module missing
    return {
      id: 'fallback',
      cityLabel: String(destination || ''),
      regionLabel: '',
      center: (tripContext && tripContext.center) || null,
      districts: [],
      landmarks: [],
      foodAreas: [],
      shoppingAreas: [],
      nightlifeAreas: [],
      dayTripCandidates: [],
      themes: {
        classic_core: '城市經典核心',
        culture_maruyama: '文化散策',
        sweets_suburb: '近郊體驗',
        market_food_night: '美食與夜生活',
        daytrip_otaru: '一日延伸'
      },
      cityScale: 'medium',
      transitCharacter: 'mixed'
    };
  }

  var STYLE_PROFILES = {
    budget: {
      landmark: 0.7,
      shopping: 0.5,
      food: 0.7,
      nightlife: 0.2,
      museum: 0.5,
      nature: 0.6,
      paidAttraction: 0.35,
      famousRatio: 0.55,
      hiddenGemRatio: 0.45,
      walkingIntensity: 0.75,
      shoppingDuration: 0.6,
      mealBudget: 'low',
      reservationHeavy: 0.2
    },
    sightseeing: {
      landmark: 1.0,
      shopping: 0.45,
      food: 0.65,
      nightlife: 0.25,
      museum: 0.7,
      nature: 0.55,
      paidAttraction: 0.7,
      famousRatio: 0.9,
      hiddenGemRatio: 0.2,
      walkingIntensity: 0.55,
      shoppingDuration: 0.5,
      mealBudget: 'mid',
      reservationHeavy: 0.35
    },
    trendy: {
      landmark: 0.45,
      shopping: 0.75,
      food: 0.8,
      nightlife: 0.55,
      museum: 0.35,
      nature: 0.3,
      paidAttraction: 0.65,
      famousRatio: 0.4,
      hiddenGemRatio: 0.75,
      walkingIntensity: 0.6,
      shoppingDuration: 0.7,
      mealBudget: 'mid-high',
      reservationHeavy: 0.55
    },
    foodie: {
      landmark: 0.35,
      shopping: 0.35,
      food: 1.0,
      nightlife: 0.4,
      museum: 0.3,
      nature: 0.25,
      paidAttraction: 0.3,
      famousRatio: 0.7,
      hiddenGemRatio: 0.5,
      walkingIntensity: 0.5,
      shoppingDuration: 0.35,
      mealBudget: 'high',
      reservationHeavy: 0.7
    },
    photospot: {
      landmark: 0.7,
      shopping: 0.4,
      food: 0.55,
      nightlife: 0.35,
      museum: 0.4,
      nature: 0.7,
      paidAttraction: 0.65,
      famousRatio: 0.6,
      hiddenGemRatio: 0.55,
      walkingIntensity: 0.55,
      shoppingDuration: 0.4,
      mealBudget: 'mid-high',
      reservationHeavy: 0.4
    },
    anime: {
      landmark: 0.3,
      shopping: 0.85,
      food: 0.55,
      nightlife: 0.2,
      museum: 0.25,
      nature: 0.15,
      paidAttraction: 0.5,
      famousRatio: 0.5,
      hiddenGemRatio: 0.4,
      walkingIntensity: 0.45,
      shoppingDuration: 0.95,
      mealBudget: 'low-mid',
      reservationHeavy: 0.15
    },
    streetwear: {
      landmark: 0.25,
      shopping: 1.0,
      food: 0.55,
      nightlife: 0.45,
      museum: 0.2,
      nature: 0.2,
      paidAttraction: 0.3,
      famousRatio: 0.35,
      hiddenGemRatio: 0.8,
      walkingIntensity: 0.7,
      shoppingDuration: 1.0,
      mealBudget: 'mid',
      reservationHeavy: 0.25
    }
  };

  var EXPERIENCE_KEYS = [
    'culture',
    'landmark',
    'nature',
    'shopping',
    'food',
    'local',
    'museum',
    'nightlife',
    'hands-on',
    'seasonal'
  ];

  function deriveSeasonContext(dateIso, latitude) {
    var di = DI();
    if (di && typeof di.deriveSeasonalContext === 'function') {
      return di.deriveSeasonalContext(dateIso, latitude);
    }
    var d = dateIso ? new Date(String(dateIso).slice(0, 10) + 'T12:00:00') : null;
    if (!d || isNaN(d.getTime())) {
      return {
        month: null,
        season: 'unknown',
        weekday: null,
        daylightHint: 'unknown',
        mobilityBuffer: 1.0,
        notes: []
      };
    }
    var month = d.getMonth() + 1;
    var weekday = d.getDay();
    var season = 'spring';
    if (month >= 6 && month <= 8) season = 'summer';
    else if (month >= 9 && month <= 11) season = 'autumn';
    else if (month === 12 || month <= 2) season = 'winter';
    var mobilityBuffer = season === 'winter' ? 1.25 : 1.0;
    return {
      month: month,
      season: season,
      weekday: weekday,
      weekdayLabel: ['日', '一', '二', '三', '四', '五', '六'][weekday],
      daylightHint: season === 'winter' ? 'short' : season === 'summer' ? 'long' : 'moderate',
      mobilityBuffer: mobilityBuffer,
      notes: []
    };
  }

  function matchDistrict(title, pack) {
    if (!pack || !pack.districts) return null;
    var di = DI();
    if (di && typeof di.matchDistrictDynamic === 'function') {
      var hit = di.matchDistrictDynamic(title, pack);
      if (hit) return hit;
    }
    var t = String(title || '');
    var i;
    for (i = 0; i < pack.districts.length; i++) {
      var d = pack.districts[i];
      if (d.name && t.indexOf(d.name) !== -1) return d;
      if (d.aliases && d.aliases.length) {
        var j;
        for (j = 0; j < d.aliases.length; j++) {
          if (d.aliases[j] && d.aliases[j].test && d.aliases[j].test(t)) return d;
        }
      }
    }
    return null;
  }

  function matchDistrictByCoords(lat, lng, pack) {
    var di = DI();
    if (di && typeof di.matchDistrictByCoordsDynamic === 'function') {
      return di.matchDistrictByCoordsDynamic(lat, lng, pack);
    }
    if (!pack || lat == null || lng == null || !pack.districts) return null;
    var best = null;
    var bestKm = Infinity;
    pack.districts.forEach(function (d) {
      if (!d.center || d.dayTrip) return;
      var km = haversineKm({ lat: lat, lng: lng }, d.center);
      if (!isNaN(km) && km < bestKm) {
        bestKm = km;
        best = d;
      }
    });
    if (best && bestKm <= 3.5) return best;
    return null;
  }

  function classifyExperience(title, types) {
    var t = String(title || '');
    var joined = (types || []).join(' ');
    if (/返回飯店|回飯店|休息|便利商店|藥妝|唐吉訶德|寄物|check-?in|機場|空港|入境|送機/i.test(t)) {
      return 'nav';
    }
    if (/午餐|晚餐|早餐|下午茶|拉麵|燒肉|壽司|餐廳|食堂|居酒屋|咖啡|甜點|美食|螃蟹|丼|meal|dinner|lunch/i.test(t) ||
      /restaurant|cafe|food/i.test(joined)) {
      return 'food';
    }
    if (/夜景|夜市|酒吧|薄野|夜生活|bar|night/i.test(t) || /night_club|bar/i.test(joined)) {
      return 'nightlife';
    }
    if (/購物|商場|百貨|Outlet|藥妝|唐吉訶德|狸小路|shopping|mall/i.test(t) ||
      /shopping_mall|department_store/i.test(joined)) {
      return 'shopping';
    }
    if (/博物館|美術館|museum|gallery/i.test(t) || /museum|art_gallery/i.test(joined)) {
      return 'museum';
    }
    if (/公園|神宮|神社|自然|運河|park|garden|shrine|temple/i.test(t) ||
      /park|shrine|temple/i.test(joined)) {
      if (/神宮|神社|寺|舊道|文化/i.test(t)) return 'culture';
      return 'nature';
    }
    if (/體驗|工廠|手作|白色戀人|workshop/i.test(t)) return 'hands-on';
    if (/塔|時計|地標|展望|landmark/i.test(t) || /tourist_attraction/i.test(joined)) {
      return 'landmark';
    }
    return 'local';
  }

  function classifyTier(title, pack) {
    var t = String(title || '');
    if (/返回飯店|回飯店|休息|便利商店|藥妝|唐吉訶德|自由逛街|自由活動/i.test(t)) {
      return 'FILLER';
    }
    var landmarks = (pack && (pack.landmarks || pack.anchors)) || [];
    var i;
    for (i = 0; i < landmarks.length; i++) {
      var lm = landmarks[i];
      var nm = lm.name || '';
      if (nm && t.indexOf(nm) !== -1) return lm.tier || 'ANCHOR';
    }
    if (/午餐|晚餐|早餐|下午茶|拉麵|燒肉|壽司|餐廳/.test(t)) return 'SUPPORTING';
    return 'SUPPORTING';
  }

  function isNavOrFillerTitle(title) {
    return /返回飯店|回飯店|休息|便利商店|藥妝|唐吉訶德|自由逛街|自由活動|採買後返回/i.test(
      String(title || '')
    );
  }

  function annotateItem(item, pack) {
    var title = item.title || '';
    var types = (item.__places && item.__places.types) || [];
    var district =
      matchDistrict(title, pack) ||
      (item.__places
        ? matchDistrictByCoords(item.__places.lat, item.__places.lng, pack)
        : null);
    item.__guide = {
      districtId: district ? district.id : null,
      districtName: district ? district.name : null,
      experience: classifyExperience(title, types),
      tier: classifyTier(title, pack),
      isNav: isNavOrFillerTitle(title),
      lat: (item.__places && item.__places.lat) || (district && district.center.lat) || null,
      lng: (item.__places && item.__places.lng) || (district && district.center.lng) || null
    };
    return item;
  }

  function flattenDayItems(day) {
    var items = [];
    (day.phases || []).forEach(function (p) {
      (p.items || []).forEach(function (it) {
        items.push(it);
      });
    });
    return items;
  }

  function rebuildDayFromItems(day, items) {
    var ti = TI();
    if (ti && typeof ti.reconcileDayTimeline === 'function') {
      day.phases = [{ label: '晚上', items: items }];
      return ti.reconcileDayTimeline(day, {}).day;
    }
    day.phases = [{ label: '行程', items: items }];
    return day;
  }

  function scoreRouteEfficiency(items, pack, opt) {
    opt = opt || {};
    var poi = (items || []).filter(function (it) {
      return it.__guide && !it.__guide.isNav;
    });
    if (poi.length <= 1) return { score: 88, transitMinutes: 0, switches: 0, backtracks: 0, uniqueDistricts: poi.length };

    var switches = 0;
    var backtracks = 0;
    var transit = 0;
    var seenDistricts = [];
    var i;
    for (i = 1; i < poi.length; i++) {
      var a = poi[i - 1].__guide;
      var b = poi[i].__guide;
      var km = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
      var mins = estimateTransitMinutes(km, opt.mode);
      if (opt.season && opt.season.mobilityBuffer) mins = Math.round(mins * opt.season.mobilityBuffer);
      transit += mins;
      if (a.districtId && b.districtId && a.districtId !== b.districtId) {
        switches += 1;
        var distA = pack && (pack.districts || []).find(function (d) { return d.id === a.districtId; });
        var neighborOk = distA && distA.neighbors && distA.neighbors.indexOf(b.districtId) !== -1;
        if (!neighborOk) switches += 1;
      }
      if (b.districtId && seenDistricts.indexOf(b.districtId) !== -1 && a.districtId !== b.districtId) {
        backtracks += 1;
      }
      if (a.districtId && seenDistricts.indexOf(a.districtId) === -1) seenDistricts.push(a.districtId);
    }
    if (poi[poi.length - 1].__guide.districtId) {
      var last = poi[poi.length - 1].__guide.districtId;
      if (seenDistricts.indexOf(last) === -1) seenDistricts.push(last);
    }
    var uniqueDistricts = seenDistricts.length;
    var score = 100;
    score -= Math.min(40, switches * 8);
    score -= Math.min(25, backtracks * 12);
    score -= Math.min(20, Math.max(0, (transit - 90) / 8));
    if (uniqueDistricts >= 4 && poi.length <= 6) score -= 15;
    if (uniqueDistricts === 1) score = Math.min(100, score + 5);
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      transitMinutes: transit,
      switches: switches,
      backtracks: backtracks,
      uniqueDistricts: uniqueDistricts
    };
  }

  function optimizeDayOrder(items, pack, opt) {
    opt = opt || {};
    var nav = [];
    var poi = [];
    (items || []).forEach(function (it) {
      if (it.__guide && it.__guide.isNav) nav.push(it);
      else poi.push(it);
    });
    if (poi.length <= 2) return items;
    var start = opt.hotelCenter || (pack && pack.center) || null;
    var remaining = poi.slice();
    var ordered = [];
    var cursor = start;
    while (remaining.length) {
      var bestIdx = 0;
      var bestScore = Infinity;
      var i;
      for (i = 0; i < remaining.length; i++) {
        var g = remaining[i].__guide || {};
        var km = cursor ? haversineKm(cursor, { lat: g.lat, lng: g.lng }) : 0;
        if (isNaN(km)) km = 5;
        var bonus = 0;
        if (ordered.length && ordered[ordered.length - 1].__guide) {
          var prevD = ordered[ordered.length - 1].__guide.districtId;
          if (prevD && g.districtId === prevD) bonus = -2;
          else if (pack) {
            var pd = (pack.districts || []).find(function (d) { return d.id === prevD; });
            if (pd && pd.neighbors && pd.neighbors.indexOf(g.districtId) !== -1) bonus = -1;
          }
        }
        var s = km + bonus;
        if (s < bestScore) { bestScore = s; bestIdx = i; }
      }
      var next = remaining.splice(bestIdx, 1)[0];
      ordered.push(next);
      cursor = { lat: next.__guide.lat, lng: next.__guide.lng };
    }
    var endNav = nav.filter(function (n) {
      return /返回飯店|回飯店|休息|送機|機場/i.test(n.title || '');
    });
    return ordered.concat(endNav.slice(0, 1));
  }

  function demoteFillerCards(items, opt) {
    opt = opt || {};
    var fixes = [];
    var poi = [];
    var returns = [];
    var conveniences = [];
    (items || []).forEach(function (it) {
      var t = String(it.title || '');
      if (/返回飯店|回飯店|休息|送機|前往機場/i.test(t)) returns.push(it);
      else if (/便利商店|藥妝|唐吉訶德|自由逛街|自由活動/i.test(t)) conveniences.push(it);
      else poi.push(it);
    });
    if (returns.length > 1) {
      fixes.push({ type: 'collapse_return_cards', from: returns.length, to: 1 });
      returns = returns.slice(-1);
    }
    if (conveniences.length && opt.allowConvenience !== true) {
      fixes.push({ type: 'drop_convenience_fillers', count: conveniences.length });
      conveniences = [];
    }
    if (returns[0]) {
      returns[0].__guide = returns[0].__guide || {};
      returns[0].__guide.isNav = true;
      returns[0].__guide.tier = 'FILLER';
      returns[0].__guide.dayEndNav = true;
    }
    return { items: poi.concat(conveniences, returns), fixes: fixes };
  }

  function scoreDiversity(allDaysItems, styleKey) {
    var counts = {};
    EXPERIENCE_KEYS.forEach(function (k) { counts[k] = 0; });
    var shoppingDays = 0;
    var prevDayHadShopping = false;
    var repeatPenalty = 0;
    allDaysItems.forEach(function (dayItems) {
      var dayShopping = false;
      dayItems.forEach(function (it) {
        if (!it.__guide || it.__guide.isNav) return;
        var exp = it.__guide.experience;
        if (counts[exp] != null) counts[exp] += 1;
        if (exp === 'shopping') dayShopping = true;
      });
      if (dayShopping) {
        shoppingDays += 1;
        if (prevDayHadShopping) repeatPenalty += 12;
      }
      prevDayHadShopping = dayShopping;
    });
    var profile = STYLE_PROFILES[styleKey] || STYLE_PROFILES.sightseeing;
    var score = 80;
    var totalPoi = Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0) || 1;
    var shopRatio = counts.shopping / totalPoi;
    if (shopRatio > profile.shopping + 0.25) score -= 20;
    if (counts.landmark / totalPoi < profile.landmark * 0.35 && profile.landmark > 0.6) score -= 15;
    if (counts.food / totalPoi < 0.1 && profile.food > 0.5) score -= 10;
    score -= repeatPenalty;
    if (shoppingDays >= 3) score -= 15;
    return { score: Math.max(0, Math.min(100, Math.round(score))), counts: counts, shoppingDays: shoppingDays };
  }

  function scoreAnchorQuality(items) {
    var anchors = 0;
    var fillers = 0;
    var real = 0;
    (items || []).forEach(function (it) {
      if (!it.__guide) return;
      if (it.__guide.isNav) { fillers += 1; return; }
      real += 1;
      if (it.__guide.tier === 'ANCHOR') anchors += 1;
      if (it.__guide.tier === 'FILLER') fillers += 1;
    });
    if (!real) return { score: 40, anchors: 0 };
    var ratio = anchors / real;
    var score = Math.round(50 + ratio * 50);
    if (fillers > real) score -= 20;
    return { score: Math.max(0, Math.min(100, score)), anchors: anchors, ratio: ratio };
  }

  function scoreMealPlacement(items) {
    var meals = (items || []).filter(function (it) {
      return it.__guide && it.__guide.experience === 'food';
    });
    if (!meals.length) return { score: 70, issues: ['no_meal'] };
    var issues = [];
    var score = 90;
    meals.forEach(function (m) {
      var neighbors = items.filter(function (it) {
        return it !== m && it.__guide && !it.__guide.isNav;
      });
      if (m.__guide && m.__guide.lat != null && neighbors.length) {
        var near = neighbors.some(function (n) {
          var km = haversineKm(
            { lat: m.__guide.lat, lng: m.__guide.lng },
            { lat: n.__guide.lat, lng: n.__guide.lng }
          );
          return !isNaN(km) && km < 2.5;
        });
        if (!near) {
          score -= 15;
          issues.push('meal_far_from_route:' + m.title);
        }
      }
      var ti = TI();
      if (ti) {
        var tl = ti.normalizeItemTimeline(m);
        if (/晚餐/.test(m.title || '') && tl.startMinutes >= 22 * 60) {
          score -= 20;
          issues.push('late_dinner');
        }
      }
    });
    return { score: Math.max(0, Math.min(100, score)), issues: issues };
  }

  function scorePace(items, dayRole) {
    var real = (items || []).filter(function (it) { return it.__guide && !it.__guide.isNav; });
    var n = real.length;
    var score = 85;
    if (dayRole === 'arrival' && n > 3) score -= (n - 3) * 12;
    if (dayRole === 'departure' && n > 3) score -= (n - 3) * 12;
    if (dayRole === 'full' && n < 2) score -= 20;
    if (dayRole === 'full' && n > 7) score -= 15;
    var density = null;
    return { score: Math.max(0, Math.min(100, score)), count: n, density: density };
  }

  function scoreStyleMatch(items, styleKey) {
    var profile = STYLE_PROFILES[styleKey] || STYLE_PROFILES.sightseeing;
    var counts = {};
    EXPERIENCE_KEYS.forEach(function (k) { counts[k] = 0; });
    var total = 0;
    (items || []).forEach(function (it) {
      if (!it.__guide || it.__guide.isNav) return;
      var e = it.__guide.experience;
      if (counts[e] != null) counts[e] += 1;
      total += 1;
    });
    if (!total) return { score: 50 };
    var score = 70;
    ['landmark', 'food', 'shopping', 'nightlife', 'museum'].forEach(function (k) {
      var ratio = counts[k] / total;
      var target = profile[k] || 0.3;
      score -= Math.min(18, Math.abs(ratio - target * 0.5) * 40);
    });
    return { score: Math.max(0, Math.min(100, Math.round(score))) };
  }

  function scoreSeasonFit(items, season) {
    if (!season || season.season === 'unknown') return { score: 75 };
    var score = 80;
    if (season.season === 'winter') {
      (items || []).forEach(function (it) {
        if (!it.__guide || it.__guide.isNav) return;
        var ti = TI();
        if (ti && it.__guide.experience === 'nature') {
          var tl = ti.normalizeItemTimeline(it);
          if (tl.startMinutes >= 17 * 60) score -= 10;
        }
      });
    }
    return { score: Math.max(0, Math.min(100, score)) };
  }

  function inferDayRole(dayNum, totalDays) {
    if (dayNum === 1) return 'arrival';
    if (totalDays > 1 && dayNum === totalDays) return 'departure';
    return 'full';
  }

  function inferDayTheme(items, pack) {
    if (!pack) return '城市探索';
    var districtCounts = {};
    var foodish = 0;
    var cultural = 0;
    (items || []).forEach(function (it) {
      if (!it.__guide || it.__guide.isNav) return;
      if (it.__guide.districtId) {
        districtCounts[it.__guide.districtId] = (districtCounts[it.__guide.districtId] || 0) + 1;
      }
      if (it.__guide.experience === 'food' || it.__guide.experience === 'nightlife') foodish += 1;
      if (it.__guide.experience === 'culture' || it.__guide.experience === 'museum') cultural += 1;
    });
    var themes = pack.themes || {};
    var top = Object.keys(districtCounts).sort(function (a, b) {
      return districtCounts[b] - districtCounts[a];
    })[0];
    var topDistrict = (pack.districts || []).find(function (d) { return d.id === top; });
    if (topDistrict && topDistrict.dayTrip) return themes.daytrip_otaru || '一日延伸';
    if (foodish >= 2) return themes.market_food_night || '美食與夜生活';
    if (cultural >= 2) return themes.culture_maruyama || '文化散策';
    if (topDistrict && /近郊|北側|西側|宮之澤|郊外/.test(topDistrict.name || '')) {
      return themes.sweets_suburb || '近郊體驗';
    }
    return themes.classic_core || ((pack.cityLabel || pack.city || '') + '經典核心') || '城市探索';
  }

  function shiftDate(dateIso, addDays) {
    var d = new Date(String(dateIso).slice(0, 10) + 'T12:00:00');
    if (isNaN(d.getTime())) return dateIso;
    d.setDate(d.getDate() + addDays);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function computeDayGuideScore(day, opt) {
    opt = opt || {};
    var pack = opt.pack;
    var styleKey = opt.styleKey || 'sightseeing';
    var season = opt.season || deriveSeasonContext(opt.dateIso, pack && pack.center && pack.center.lat);
    var items = flattenDayItems(day);
    items.forEach(function (it) { annotateItem(it, pack); });
    var route = scoreRouteEfficiency(items, pack, { mode: opt.mode, season: season });
    var diversity = scoreDiversity([items], styleKey);
    var anchor = scoreAnchorQuality(items);
    var meal = scoreMealPlacement(items);
    var pace = scorePace(items, opt.dayRole || 'full');
    var style = scoreStyleMatch(items, styleKey);
    var seasonFit = scoreSeasonFit(items, season);
    var theme = inferDayTheme(items, pack);
    var total = Math.round(
      route.score * 0.28 + diversity.score * 0.12 + anchor.score * 0.15 +
      meal.score * 0.12 + pace.score * 0.12 + style.score * 0.13 + seasonFit.score * 0.08
    );
    day.__guideDay = {
      dayTheme: theme,
      routeEfficiency: route.score,
      diversity: diversity.score,
      anchorQuality: anchor.score,
      mealPlacement: meal.score,
      pace: pace.score,
      styleMatch: style.score,
      seasonFit: seasonFit.score,
      guideScore: total,
      routeDetail: route,
      cityScale: pack && pack.cityScale,
      transitCharacter: pack && pack.transitCharacter
    };
    return { score: total, parts: day.__guideDay, items: items };
  }

  function computeTripGuideScore(hidden, opt) {
    opt = opt || {};
    var pack = opt.pack || resolveDestinationPack(opt.destination || '', opt);
    var styleKey = opt.styleKey || 'sightseeing';
    var season = deriveSeasonContext(opt.dateStart || opt.dateIso, pack && pack.center && pack.center.lat);
    var totalDays = (hidden.days || []).length;
    var dayScores = [];
    var allDayItems = [];
    (hidden.days || []).forEach(function (day, idx) {
      var dayNum = parseInt(day.dayNum, 10) || idx + 1;
      var role = inferDayRole(dayNum, totalDays);
      var daySeason = deriveSeasonContext(
        opt.dateStart ? shiftDate(opt.dateStart, dayNum - 1) : opt.dateIso,
        pack && pack.center && pack.center.lat
      );
      var res = computeDayGuideScore(day, {
        pack: pack, styleKey: styleKey, season: daySeason, dayRole: role, mode: opt.mode
      });
      dayScores.push(res.score);
      allDayItems.push(res.items);
    });
    var tripDiversity = scoreDiversity(allDayItems, styleKey);
    var avg = dayScores.reduce(function (s, x) { return s + x; }, 0) / (dayScores.length || 1);
    var guideScore = Math.round(avg * 0.85 + tripDiversity.score * 0.15);
    return {
      guideScore: guideScore,
      dayScores: dayScores,
      diversity: tripDiversity,
      threshold: GUIDE_SCORE_THRESHOLD,
      belowThreshold: guideScore < GUIDE_SCORE_THRESHOLD,
      season: season,
      packId: pack ? pack.id : null
    };
  }

  function optimizeDay(day, opt) {
    opt = opt || {};
    var pack = opt.pack;
    var fixes = [];
    var items = flattenDayItems(day);
    items.forEach(function (it) { annotateItem(it, pack); });
    var demoted = demoteFillerCards(items, {
      allowConvenience: opt.styleKey === 'streetwear' || opt.styleKey === 'anime'
    });
    fixes = fixes.concat(demoted.fixes);
    items = demoted.items;
    items.forEach(function (it) { annotateItem(it, pack); });
    var before = scoreRouteEfficiency(items, pack, opt);
    var hotelCenter = null;
    if (pack && opt.hotelArea) {
      var hd = (pack.districts || []).find(function (d) {
        return d.name === opt.hotelArea || (opt.hotelArea && opt.hotelArea.indexOf(d.name) !== -1);
      });
      if (hd) hotelCenter = hd.center;
    }
    items = optimizeDayOrder(items, pack, {
      hotelCenter: hotelCenter || (pack && pack.center),
      styleKey: opt.styleKey
    });
    var after = scoreRouteEfficiency(items, pack, opt);
    if (after.score > before.score) {
      fixes.push({ type: 'reorder_for_route', from: before.score, to: after.score });
    }
    day = rebuildDayFromItems(day, items);
    var scored = computeDayGuideScore(day, opt);
    return { day: day, score: scored.score, fixes: fixes, parts: scored.parts };
  }

  function optimizeHidden(hidden, opt) {
    opt = opt || {};
    var pack = opt.pack || resolveDestinationPack(opt.destination || '', opt);
    var styleKey = opt.styleKey || 'sightseeing';
    var allFixes = [];
    var weakDays = [];
    var totalDays = (hidden.days || []).length;
    (hidden.days || []).forEach(function (day, idx) {
      var dayNum = parseInt(day.dayNum, 10) || idx + 1;
      var role = inferDayRole(dayNum, totalDays);
      var res = optimizeDay(day, {
        pack: pack,
        styleKey: styleKey,
        dayRole: role,
        hotelArea: opt.hotelArea,
        mode: opt.mode,
        season: deriveSeasonContext(
          opt.dateStart ? shiftDate(opt.dateStart, dayNum - 1) : opt.dateIso,
          pack && pack.center && pack.center.lat
        )
      });
      hidden.days[idx] = res.day;
      allFixes = allFixes.concat(res.fixes || []);
      if (res.score < GUIDE_SCORE_THRESHOLD) weakDays.push(dayNum);
    });
    var trip = computeTripGuideScore(hidden, opt);
    hidden.meta = hidden.meta || {};
    hidden.meta.guideIntelligence = {
      guideScore: trip.guideScore,
      dayScores: trip.dayScores,
      threshold: GUIDE_SCORE_THRESHOLD,
      belowThreshold: trip.belowThreshold,
      weakDays: weakDays,
      packId: trip.packId,
      cityScale: pack && pack.cityScale,
      transitCharacter: pack && pack.transitCharacter,
      curatedEnhancement: !!(pack && pack.curatedEnhancement),
      unknownDestination: !!(pack && pack.unknownDestination),
      season: trip.season,
      fixCount: allFixes.length,
      fixes: allFixes.slice(0, 30)
    };
    return {
      hidden: hidden,
      guideScore: trip.guideScore,
      belowThreshold: trip.belowThreshold,
      weakDays: weakDays,
      fixes: allFixes,
      threshold: GUIDE_SCORE_THRESHOLD
    };
  }

  /**
   * Prompt brief — Dynamic Destination Intelligence.
   */
  function buildDestinationIntelligencePrompt(destination, payload) {
    var di = DI();
    var intel = resolveDestinationPack(destination, payload || {});
    if (di && typeof di.buildPromptFromIntelligence === 'function') {
      var base = di.buildPromptFromIntelligence(intel, payload || {});
      var styleKey = (payload && payload.travelStyle) || 'sightseeing';
      var profile = STYLE_PROFILES[styleKey] || STYLE_PROFILES.sightseeing;
      return (
        base +
        '\n風格權重（必須反映在 POI 比例）：landmark=' +
        profile.landmark +
        ', food=' +
        profile.food +
        ', shopping=' +
        profile.shopping +
        ', nightlife=' +
        profile.nightlife +
        ', famousRatio=' +
        profile.famousRatio +
        ', mealBudget=' +
        profile.mealBudget
      );
    }
    return '【Destination Intelligence】' + String(destination || '');
  }

  function buildGuideTimingRulesOverride() {
    return (
      '【全風格通用：防腿斷與客觀時間鐵律——最高優先】\n' +
      '1. 區域聚類 (Area Clustering)：每一天鎖定 1 主區 + 最多 1 鄰近次區；禁止同日遠距拉鋸。\n' +
      '2. 計算路線時間：站間通常 10–25 分鐘；超過 40 分須有 ANCHOR 理由。\n' +
      '3. 逗留時間依風格與 POI 等級（ANCHOR／SUPPORTING）。\n' +
      '4. 體驗多元但地理連續。\n' +
      '5. 禁止重複店名與連續多日同質 shopping。\n' +
      '6. 時間格式：HH:MM - HH:MM。\n' +
      '7. 日終返回住宿即可，勿每天硬塞便利商店／藥妝卡。\n'
    );
  }

  function createPerfClock() {
    var marks = {};
    return {
      start: function (name) { marks[name] = { t0: Date.now() }; },
      end: function (name) {
        if (!marks[name]) return 0;
        marks[name].ms = Date.now() - marks[name].t0;
        return marks[name].ms;
      },
      report: function () {
        var out = {};
        Object.keys(marks).forEach(function (k) {
          out[k] = marks[k].ms != null ? marks[k].ms : null;
        });
        return out;
      }
    };
  }

  global.SOARVIBE_GUIDE_INTELLIGENCE = Object.freeze({
    STYLE_PROFILES: STYLE_PROFILES,
    GUIDE_SCORE_THRESHOLD: GUIDE_SCORE_THRESHOLD,
    resolveDestinationPack: resolveDestinationPack,
    deriveSeasonContext: deriveSeasonContext,
    matchDistrict: matchDistrict,
    annotateItem: annotateItem,
    scoreRouteEfficiency: scoreRouteEfficiency,
    optimizeDayOrder: optimizeDayOrder,
    demoteFillerCards: demoteFillerCards,
    scoreDiversity: scoreDiversity,
    scoreMealPlacement: scoreMealPlacement,
    computeDayGuideScore: computeDayGuideScore,
    computeTripGuideScore: computeTripGuideScore,
    optimizeDay: optimizeDay,
    optimizeHidden: optimizeHidden,
    buildDestinationIntelligencePrompt: buildDestinationIntelligencePrompt,
    buildGuideTimingRulesOverride: buildGuideTimingRulesOverride,
    inferDayRole: inferDayRole,
    inferDayTheme: inferDayTheme,
    classifyExperience: classifyExperience,
    classifyTier: classifyTier,
    createPerfClock: createPerfClock,
    haversineKm: haversineKm
  });
})(typeof window !== 'undefined' ? window : globalThis);

