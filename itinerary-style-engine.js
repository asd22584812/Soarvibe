/**
 * SoarVibe Style Engine v1.5 — Global Style Engine Phase 1+2+3
 * Phase 1: Selection Foundation
 * Phase 2: Destination Discovery → shortlist
 * Phase 3: Candidate-bound itinerary prompts + usage QA (no Places/Grounding)
 *
 * STYLE_DEFINITIONS = single source of truth (GLOBAL; no per-city POI DB).
 * STYLE = WHAT / WHERE. PACE / day density = Day Completeness (elsewhere).
 */
(function (global) {
  'use strict';

  var STYLE_KEYS = [
    'budget',
    'sightseeing',
    'trendy',
    'foodie',
    'photospot',
    'anime',
    'streetwear'
  ];

  var STYLE_LABELS = {
    budget: { zh: '小資旅行', en: 'Budget Travel' },
    sightseeing: { zh: '初次觀光', en: 'First-Time Classic' },
    trendy: { zh: '新潮熱門', en: 'Trendy & Contemporary' },
    foodie: { zh: '美食吃貨', en: 'Foodie & Gourmet' },
    photospot: { zh: '網美必拍', en: 'Instagrammable & Visual' },
    anime: { zh: '玩具動漫', en: 'Otaku & Toy Paradise' },
    streetwear: { zh: '潮流玩家', en: 'Streetwear & Vintage' }
  };

  /**
   * Activity / experience duration hints — NOT style-level day density.
   * Used only as guidance for how long a stop type may need; never bypasses completeness.
   */
  var ACTIVITY_DURATION_HINTS = {
    main_meal: { minMin: 75, maxMin: 90, label: '正餐' },
    cafe: { minMin: 45, maxMin: 60, label: '咖啡／甜點' },
    market_browse: { minMin: 60, maxMin: 120, label: '市場逛吃' },
    retail_cluster: { minMin: 90, maxMin: 180, label: '商圈／選物漫遊' },
    major_museum: { minMin: 90, maxMin: 150, label: '大型館舍' },
    landmark_visit: { minMin: 45, maxMin: 120, label: '地標停留' },
    photo_stop: { minMin: 45, maxMin: 75, label: '拍攝停靠' },
    quick_eat: { minMin: 30, maxMin: 50, label: '快捷餐' },
    walk_browse: { minMin: 45, maxMin: 90, label: '街區散步' }
  };

  /**
   * GLOBAL StyleDefinition — destination-agnostic selection intent.
   * Forbidden fields: dailyEventCount, minimumStops, forcedGap, styleDensityTarget.
   */
  var STYLE_DEFINITIONS = {
    budget: {
      key: 'budget',
      labels: STYLE_LABELS.budget,
      selectionIntent:
        '免票／高 CP 地標與平價在地體驗為錨；順路實用購物；降低高奢與付費堆疊。',
      prioritizeCategories: [
        'free_landmark',
        'park',
        'market',
        'budget_meal',
        'drugstore',
        'value_retail',
        'shopping_street'
      ],
      avoidCategories: ['luxury_dining', 'theme_premium', 'long_cafe_sit', 'otaku_deep_dive'],
      neighborhoodIntent: '商店街、市場、平民商圈、車站周邊高 CP 區',
      foodIntent: '平價排隊、市場小吃、casual specialty、高 CP 在地餐',
      shoppingIntent: '藥妝、平價服飾／生活選物、伴手禮；必須順路',
      experienceIntent: '高效步行串連、免費／低付費體驗',
      landmarkAffinity: 0.7,
      localAuthenticityBias: 0.75,
      visualValueBias: 0.35,
      subcultureBias: 0.1,
      priceBand: 'low',
      freshnessRequirement: 'none',
      freshnessFallbackLabel: '',
      genericTouristPenalty: 0.25,
      coreLandmarkBudget: 'medium',
      mealBudget: 'low',
      socialLive: false,
      categoryWeights: {
        landmark: 0.7,
        shopping: 0.45,
        food: 0.7,
        nightlife: 0.15,
        museum: 0.45,
        nature: 0.65,
        paidAttraction: 0.3,
        famousRatio: 0.55,
        hiddenGemRatio: 0.45
      }
    },
    sightseeing: {
      key: 'sightseeing',
      labels: STYLE_LABELS.sightseeing,
      selectionIntent:
        '城市代表性經典地標為錨；地標之間編織商店街／名產／咖啡，避免純地標→餐廳模板。',
      prioritizeCategories: [
        'iconic_landmark',
        'culture',
        'museum',
        'representative_food',
        'shopping_street',
        'viewpoint'
      ],
      avoidCategories: ['otaku_deep_dive', 'pure_vintage_hunt', 'obscure_only'],
      neighborhoodIntent: '經典觀光軸與代表街區',
      foodIntent: '代表性地方名物與名店節奏',
      shoppingIntent: '伴手禮、車站商場、藥妝等順路停靠',
      experienceIntent: '初次造訪必體驗的城市識別符',
      landmarkAffinity: 1.0,
      localAuthenticityBias: 0.55,
      visualValueBias: 0.55,
      subcultureBias: 0.1,
      priceBand: 'mid',
      freshnessRequirement: 'none',
      freshnessFallbackLabel: '',
      genericTouristPenalty: 0.1,
      coreLandmarkBudget: 'high',
      mealBudget: 'mid',
      socialLive: false,
      categoryWeights: {
        landmark: 1.0,
        shopping: 0.35,
        food: 0.6,
        nightlife: 0.25,
        museum: 0.7,
        nature: 0.5,
        paidAttraction: 0.65,
        famousRatio: 0.9,
        hiddenGemRatio: 0.2
      }
    },
    trendy: {
      key: 'trendy',
      labels: STYLE_LABELS.trendy,
      selectionIntent:
        '現代開發區／設計街區／複合設施／當代生活選物；無 freshness 證據時降級為 Contemporary，禁止宣稱最新爆紅。',
      prioritizeCategories: [
        'modern_district',
        'design_retail',
        'contemporary_cafe',
        'concept_store',
        'mixed_use',
        'lifestyle'
      ],
      avoidCategories: ['temple_circuit', 'iconic_only_day', 'otaku_deep_dive', 'museum_stack'],
      neighborhoodIntent: 'contemporary / design / newer commercial districts',
      foodIntent: 'contemporary cafe、現代餐飲概念、話題餐飲區（freshness 未知則不稱 current）',
      shoppingIntent: '時尚／生活選物、設計店、人氣商業區逛街',
      experienceIntent: '當代地方文化與現代城市體驗',
      landmarkAffinity: 0.4,
      localAuthenticityBias: 0.55,
      visualValueBias: 0.6,
      subcultureBias: 0.25,
      priceBand: 'mid-high',
      freshnessRequirement: 'preferred',
      freshnessFallbackLabel: 'Contemporary / Trend-oriented',
      genericTouristPenalty: 0.75,
      coreLandmarkBudget: 'low',
      mealBudget: 'mid-high',
      socialLive: false,
      categoryWeights: {
        landmark: 0.4,
        shopping: 0.7,
        food: 0.75,
        nightlife: 0.5,
        museum: 0.3,
        nature: 0.25,
        paidAttraction: 0.55,
        famousRatio: 0.35,
        hiddenGemRatio: 0.7
      }
    },
    foodie: {
      key: 'foodie',
      labels: STYLE_LABELS.foodie,
      selectionIntent:
        '食物為行程錨點：市場、專賣、地方料理、甜點、夜食；美食體驗壓倒純觀光 filler。',
      prioritizeCategories: [
        'market',
        'specialty_food',
        'regional_dish',
        'dessert',
        'cafe',
        'night_food',
        'depachika',
        'food_hall'
      ],
      avoidCategories: ['landmark_filler', 'iconic_only_day'],
      neighborhoodIntent: '食物商圈、市場、夜食街、食品伴手禮帶',
      foodIntent: '市場／名物／正餐／甜點／咖啡／居酒屋 — 餐型多樣',
      shoppingIntent: '食品伴手禮、超市精選、甜點外帶',
      experienceIntent: '吃與買的食物體驗',
      landmarkAffinity: 0.3,
      localAuthenticityBias: 0.85,
      visualValueBias: 0.4,
      subcultureBias: 0.1,
      priceBand: 'high',
      freshnessRequirement: 'none',
      freshnessFallbackLabel: '',
      genericTouristPenalty: 0.55,
      coreLandmarkBudget: 'low',
      mealBudget: 'high',
      socialLive: false,
      categoryWeights: {
        landmark: 0.3,
        shopping: 0.3,
        food: 1.0,
        nightlife: 0.4,
        museum: 0.25,
        nature: 0.2,
        paidAttraction: 0.25,
        famousRatio: 0.65,
        hiddenGemRatio: 0.5
      }
    },
    photospot: {
      key: 'photospot',
      labels: STYLE_LABELS.photospot,
      selectionIntent:
        '高視覺辨識建築／地景／採光機位；禁止宣稱 IG 爆款；鄰近咖啡與設計選物作連接。',
      prioritizeCategories: [
        'viewpoint',
        'architecture',
        'visual_landmark',
        'photo_cafe',
        'waterfront',
        'design_district'
      ],
      avoidCategories: ['dull_retail_stack', 'otaku_deep_dive'],
      neighborhoodIntent: '視覺軸、水岸、地標視角、設計街區',
      foodIntent: '高顏值咖啡／甜點／景觀餐',
      shoppingIntent: '鄰近設計／生活選物（連接器非主軸）',
      experienceIntent: '拍攝與視覺體驗',
      landmarkAffinity: 0.75,
      localAuthenticityBias: 0.45,
      visualValueBias: 1.0,
      subcultureBias: 0.1,
      priceBand: 'mid-high',
      freshnessRequirement: 'preferred',
      freshnessFallbackLabel: 'Photogenic / Visual-oriented',
      genericTouristPenalty: 0.35,
      coreLandmarkBudget: 'medium',
      mealBudget: 'mid-high',
      socialLive: false,
      categoryWeights: {
        landmark: 0.75,
        shopping: 0.35,
        food: 0.55,
        nightlife: 0.35,
        museum: 0.35,
        nature: 0.75,
        paidAttraction: 0.6,
        famousRatio: 0.55,
        hiddenGemRatio: 0.55
      }
    },
    anime: {
      key: 'anime',
      labels: STYLE_LABELS.anime,
      selectionIntent:
        '動漫／模型／公仔／二手收藏／角色商品商圈（依目的地實際密度；禁止虛構店家）。',
      prioritizeCategories: [
        'anime_retail',
        'figure_shop',
        'hobby',
        'secondhand_pop',
        'character_cafe',
        'game_district'
      ],
      avoidCategories: ['museum_stack', 'temple_circuit', 'iconic_only_day'],
      neighborhoodIntent: '次文化／hobby／動漫零售帶（不足則降級混在地體驗）',
      foodIntent: '商圈內快捷餐；可混一般在地餐',
      shoppingIntent: '角色商店、二手、Hobby 為主軸',
      experienceIntent: '挖寶與次文化零售',
      landmarkAffinity: 0.25,
      localAuthenticityBias: 0.4,
      visualValueBias: 0.35,
      subcultureBias: 1.0,
      priceBand: 'low-mid',
      freshnessRequirement: 'none',
      freshnessFallbackLabel: '',
      genericTouristPenalty: 0.8,
      coreLandmarkBudget: 'low',
      mealBudget: 'low-mid',
      socialLive: false,
      /* routing hint only — NOT day density / completeness bypass */
      routingHints: { preferClusterBrowse: true, maxPrimaryClustersSoft: 2 },
      categoryWeights: {
        landmark: 0.25,
        shopping: 0.9,
        food: 0.55,
        nightlife: 0.15,
        museum: 0.2,
        nature: 0.1,
        paidAttraction: 0.45,
        famousRatio: 0.45,
        hiddenGemRatio: 0.4
      }
    },
    streetwear: {
      key: 'streetwear',
      labels: STYLE_LABELS.streetwear,
      selectionIntent:
        '古著／買手／球鞋／街頭品牌巷弄；提高 browsing 體驗；降低百貨拼盤與純觀光地標日。',
      prioritizeCategories: [
        'vintage',
        'sneakers',
        'select_shop',
        'streetwear',
        'fashion_alley',
        'record_shop'
      ],
      avoidCategories: ['temple_circuit', 'museum_stack', 'department_stack', 'iconic_only_day'],
      neighborhoodIntent: 'fashion alleys、古著／球鞋巷、街頭品牌區',
      foodIntent: '鄰近休閒餐飲與咖啡（服務逛街節奏）',
      shoppingIntent: 'fashion／sneakers／select／vintage 主軸',
      experienceIntent: '試穿與選物漫遊（時長見 retail_cluster，不降全日密度）',
      landmarkAffinity: 0.25,
      localAuthenticityBias: 0.5,
      visualValueBias: 0.45,
      subcultureBias: 0.85,
      priceBand: 'mid',
      freshnessRequirement: 'none',
      freshnessFallbackLabel: '',
      genericTouristPenalty: 0.8,
      coreLandmarkBudget: 'low',
      mealBudget: 'mid',
      socialLive: false,
      routingHints: { preferClusterBrowse: true },
      categoryWeights: {
        landmark: 0.25,
        shopping: 1.0,
        food: 0.55,
        nightlife: 0.4,
        museum: 0.15,
        nature: 0.15,
        paidAttraction: 0.25,
        famousRatio: 0.3,
        hiddenGemRatio: 0.75
      }
    }
  };

  /**
   * Legacy STYLE_PROFILES — derived from StyleDefinition.categoryWeights.
   * No densityTarget / styleDensityTarget (STYLE ≠ PACE).
   */
  var STYLE_PROFILES = {};
  STYLE_KEYS.forEach(function (k) {
    var def = STYLE_DEFINITIONS[k];
    var w = def.categoryWeights || {};
    STYLE_PROFILES[k] = {
      landmark: w.landmark,
      shopping: w.shopping,
      food: w.food,
      nightlife: w.nightlife,
      museum: w.museum,
      nature: w.nature,
      paidAttraction: w.paidAttraction,
      famousRatio: w.famousRatio,
      hiddenGemRatio: w.hiddenGemRatio,
      walkingIntensity: k === 'budget' || k === 'streetwear' ? 0.75 : 0.5,
      shoppingDuration: w.shopping,
      mealBudget: def.mealBudget,
      reservationHeavy: k === 'foodie' ? 0.55 : 0.25,
      socialLive: def.socialLive === true,
      freshnessDefault: def.freshnessRequirement === 'preferred' ? 'unknown' : 'n/a'
    };
  });

  var QUALITY_WEIGHTS = {
    budget: {
      intentMatch: 0.15,
      poiMix: 0.1,
      budgetMatch: 0.25,
      paceMatch: 0.15,
      nightlifeMatch: 0.05,
      mealMatch: 0.15,
      hiddenGemMatch: 0.1,
      landmarkMatch: 0.05
    },
    sightseeing: {
      intentMatch: 0.2,
      poiMix: 0.1,
      budgetMatch: 0.05,
      paceMatch: 0.1,
      nightlifeMatch: 0.05,
      mealMatch: 0.1,
      hiddenGemMatch: 0.05,
      landmarkMatch: 0.35
    },
    trendy: {
      intentMatch: 0.2,
      poiMix: 0.1,
      budgetMatch: 0.05,
      paceMatch: 0.1,
      nightlifeMatch: 0.1,
      mealMatch: 0.1,
      hiddenGemMatch: 0.25,
      landmarkMatch: 0.1
    },
    foodie: {
      intentMatch: 0.15,
      poiMix: 0.1,
      budgetMatch: 0.05,
      paceMatch: 0.1,
      nightlifeMatch: 0.05,
      mealMatch: 0.4,
      hiddenGemMatch: 0.1,
      landmarkMatch: 0.05
    },
    photospot: {
      intentMatch: 0.2,
      poiMix: 0.15,
      budgetMatch: 0.05,
      paceMatch: 0.15,
      nightlifeMatch: 0.05,
      mealMatch: 0.1,
      hiddenGemMatch: 0.15,
      landmarkMatch: 0.15
    },
    anime: {
      intentMatch: 0.25,
      poiMix: 0.15,
      budgetMatch: 0.1,
      paceMatch: 0.15,
      nightlifeMatch: 0.05,
      mealMatch: 0.1,
      hiddenGemMatch: 0.1,
      landmarkMatch: 0.1
    },
    streetwear: {
      intentMatch: 0.2,
      poiMix: 0.15,
      budgetMatch: 0.1,
      paceMatch: 0.1,
      nightlifeMatch: 0.1,
      mealMatch: 0.1,
      hiddenGemMatch: 0.2,
      landmarkMatch: 0.05
    }
  };

  /**
   * Curated style catalogs — deterministic reshaping without Research API.
   * Used when Gemini output misses style intent; never invents unverified "live viral" claims.
   */
  var STYLE_CATALOGS = {
    Tokyo: {
      sightseeing: [
        { title: '淺草寺雷門', experience: 'landmark', district: '淺草', paid: false, famous: true, tags: ['iconic'] },
        { title: '東京晴空塔', experience: 'landmark', district: '押上', paid: true, famous: true, tags: ['iconic', 'view'] },
        { title: '澀谷十字路口', experience: 'landmark', district: '澀谷', paid: false, famous: true, tags: ['iconic'] },
        { title: '明治神宮', experience: 'culture', district: '原宿', paid: false, famous: true, tags: ['iconic'] },
        { title: '上野公園', experience: 'nature', district: '上野', paid: false, famous: true, tags: ['iconic'] }
      ],
      budget: [
        { title: '上野恩賜公園散步', experience: 'nature', district: '上野', paid: false, famous: true, tags: ['free'] },
        { title: '淺草寺參拜', experience: 'landmark', district: '淺草', paid: false, famous: true, tags: ['free'] },
        { title: '平價拉麵午餐', experience: 'food', district: '上野', paid: false, famous: false, tags: ['budget_meal'], foodFamily: 'ramen' },
        { title: '百元商店巡禮', experience: 'shopping', district: '新宿', paid: false, famous: false, tags: ['budget'] }
      ],
      trendy: [
        { title: '麻布台之丘散步', experience: 'landmark', district: '麻布台', paid: false, famous: false, tags: ['modern', 'development'], freshness: 'unknown' },
        { title: '澀谷現代複合商場', experience: 'shopping', district: '澀谷', paid: false, famous: false, tags: ['modern'], freshness: 'unknown' },
        { title: '表參道設計街區咖啡', experience: 'food', district: '表參道', paid: false, famous: false, tags: ['cafe', 'modern'], foodFamily: 'cafe' }
      ],
      foodie: [
        { title: '築地場外市場', experience: 'food', district: '築地', paid: false, famous: true, tags: ['market', 'specialty'], foodFamily: 'market' },
        { title: '海鮮丼午餐', experience: 'food', district: '築地', paid: false, famous: true, tags: ['specialty'], foodFamily: 'seafood' },
        { title: '和牛燒肉晚餐', experience: 'food', district: '新宿', paid: false, famous: true, tags: ['specialty'], foodFamily: 'yakiniku' },
        { title: '甜點咖啡', experience: 'food', district: '銀座', paid: false, famous: false, tags: ['dessert', 'cafe'], foodFamily: 'dessert' },
        { title: '居酒屋夜食', experience: 'nightlife', district: '新宿', paid: false, famous: false, tags: ['night_food'], foodFamily: 'izakaya' }
      ],
      photospot: [
        { title: 'teamLab 視覺展館', experience: 'landmark', district: '豐洲', paid: true, famous: true, tags: ['visual', 'architecture'] },
        { title: '東京塔夜景拍攝點', experience: 'landmark', district: '芝公園', paid: false, famous: true, tags: ['visual', 'night_view'] },
        { title: '高視覺辨識度建築咖啡', experience: 'food', district: '表參道', paid: false, famous: false, tags: ['visual', 'cafe'], foodFamily: 'cafe' },
        { title: '日落海濱觀景', experience: 'nature', district: '台場', paid: false, famous: true, tags: ['visual', 'sunset'] }
      ],
      anime: [
        { title: '秋葉原電氣街挖寶', experience: 'shopping', district: '秋葉原', paid: false, famous: true, tags: ['anime', 'figures'] },
        { title: '中野百老匯動漫中古', experience: 'shopping', district: '中野', paid: false, famous: true, tags: ['anime', 'secondhand'] },
        { title: '角色主題咖啡', experience: 'food', district: '池袋', paid: false, famous: false, tags: ['anime', 'cafe'], foodFamily: 'theme_cafe' },
        { title: '扭蛋／一番賞補給', experience: 'shopping', district: '池袋', paid: false, famous: true, tags: ['anime', 'gacha'] }
      ],
      streetwear: [
        { title: '原宿裏原宿古著巷', experience: 'shopping', district: '原宿', paid: false, famous: true, tags: ['vintage', 'streetwear'] },
        { title: '下北澤選物店漫遊', experience: 'shopping', district: '下北澤', paid: false, famous: true, tags: ['select', 'streetwear'] },
        { title: '高圓寺古著／黑膠', experience: 'shopping', district: '高圓寺', paid: false, famous: false, tags: ['vintage', 'record'] },
        { title: '工業風咖啡休息', experience: 'food', district: '下北澤', paid: false, famous: false, tags: ['cafe'], foodFamily: 'cafe' }
      ]
    },
    Sapporo: {
      sightseeing: [
        { title: '大通公園', experience: 'landmark', district: '大通', paid: false, famous: true, tags: ['iconic'] },
        { title: '札幌電視塔', experience: 'landmark', district: '大通', paid: true, famous: true, tags: ['iconic', 'view'] },
        { title: '札幌時計台', experience: 'landmark', district: '札幌站', paid: true, famous: true, tags: ['iconic'] },
        { title: '北海道神宮', experience: 'culture', district: '丸山', paid: false, famous: true, tags: ['iconic'] }
      ],
      budget: [
        { title: '大通公園免費散步', experience: 'nature', district: '大通', paid: false, famous: true, tags: ['free'] },
        { title: '平價味噌拉麵', experience: 'food', district: '薄野', paid: false, famous: true, tags: ['budget_meal'], foodFamily: 'ramen' },
        { title: '狸小路步行街', experience: 'shopping', district: '狸小路', paid: false, famous: true, tags: ['budget'] }
      ],
      trendy: [
        { title: '札幌站前現代複合設施', experience: 'shopping', district: '札幌站', paid: false, famous: false, tags: ['modern'], freshness: 'unknown' },
        { title: '話題設計咖啡', experience: 'food', district: '大通', paid: false, famous: false, tags: ['modern', 'cafe'], foodFamily: 'cafe', freshness: 'unknown' }
      ],
      foodie: [
        { title: '二條市場', experience: 'food', district: '二條市場', paid: false, famous: true, tags: ['market', 'specialty'], foodFamily: 'market' },
        { title: '海鮮丼午餐', experience: 'food', district: '二條市場', paid: false, famous: true, tags: ['specialty'], foodFamily: 'seafood' },
        { title: '成吉思汗烤肉晚餐', experience: 'food', district: '薄野', paid: false, famous: true, tags: ['specialty'], foodFamily: 'grill' },
        { title: '甜點／乳製品咖啡', experience: 'food', district: '大通', paid: false, famous: false, tags: ['dessert'], foodFamily: 'dessert' }
      ],
      photospot: [
        { title: '大通公園視覺軸線拍攝', experience: 'nature', district: '大通', paid: false, famous: true, tags: ['visual'] },
        { title: '電視塔觀景拍攝', experience: 'landmark', district: '大通', paid: true, famous: true, tags: ['visual', 'view'] },
        { title: '薄野夜景拍攝點', experience: 'nightlife', district: '薄野', paid: false, famous: true, tags: ['visual', 'night_view'] }
      ],
      anime: [
        { title: '札幌站前動漫零售街', experience: 'shopping', district: '札幌站', paid: false, famous: false, tags: ['anime'] },
        { title: '狸小路模型／公仔店', experience: 'shopping', district: '狸小路', paid: false, famous: false, tags: ['anime', 'figures'] },
        { title: '在地拉麵快速補給', experience: 'food', district: '薄野', paid: false, famous: true, tags: ['budget_meal'], foodFamily: 'ramen' },
        { title: '大通公園休息散步', experience: 'nature', district: '大通', paid: false, famous: true, tags: ['local'] }
      ],
      streetwear: [
        { title: '狸小路選物／古著店', experience: 'shopping', district: '狸小路', paid: false, famous: false, tags: ['select', 'streetwear'] },
        { title: '創成川周邊獨立店', experience: 'shopping', district: '創成川', paid: false, famous: false, tags: ['local_fashion'] },
        { title: '工業風咖啡', experience: 'food', district: '大通', paid: false, famous: false, tags: ['cafe'], foodFamily: 'cafe' },
        { title: '大通公園短暫停留', experience: 'nature', district: '大通', paid: false, famous: true, tags: ['local'] }
      ]
    }
  };

  function normalizeStyleKey(key) {
    var k = String(key || '').trim();
    if (STYLE_DEFINITIONS[k]) return k;
    if (STYLE_PROFILES[k]) return k;
    return 'sightseeing';
  }

  function getStyleDefinition(styleKey) {
    return STYLE_DEFINITIONS[normalizeStyleKey(styleKey)];
  }

  function getProfile(styleKey) {
    return STYLE_PROFILES[normalizeStyleKey(styleKey)];
  }

  function getStyleLabel(styleKey, lang) {
    var def = getStyleDefinition(styleKey);
    var labels = (def && def.labels) || STYLE_LABELS.sightseeing;
    return lang === 'en' ? labels.en : labels.zh;
  }

  function getGuideApi() {
    return global.SOARVIBE_GUIDE_INTELLIGENCE || null;
  }

  function isFillerTitle(title) {
    return /返回飯店|回飯店|休息|便利商店|藥妝|唐吉訶德|自由逛街|自由活動|採買後返回|移動至|前往機場|送機/i.test(
      String(title || '')
    );
  }

  function isAirportTitle(title) {
    return /機場|空港|入境|航班|起飛|抵達機場/i.test(String(title || ''));
  }

  function classifyExperience(title) {
    var G = getGuideApi();
    if (G && typeof G.classifyExperience === 'function') {
      return G.classifyExperience(title, []);
    }
    var t = String(title || '');
    if (isFillerTitle(t) || isAirportTitle(t)) return 'nav';
    if (/午餐|晚餐|早餐|下午茶|拉麵|燒肉|壽司|餐廳|食堂|居酒屋|咖啡|甜點|美食|丼|市場/i.test(t)) {
      return 'food';
    }
    if (/夜景|夜市|酒吧|薄野|夜生活/i.test(t)) return 'nightlife';
    if (/購物|商場|百貨|Outlet|古著|選物|動漫|扭蛋|一番賞|模型|公仔|vintage|streetwear/i.test(t)) {
      return 'shopping';
    }
    if (/博物館|美術館/i.test(t)) return 'museum';
    if (/公園|神宮|神社|自然/i.test(t)) return /神宮|神社|寺/.test(t) ? 'culture' : 'nature';
    if (/塔|時計|地標|展望|雷門|十字路口|晴空塔|電視塔/i.test(t)) return 'landmark';
    return 'local';
  }

  function foodFamilyOf(title) {
    var t = String(title || '');
    if (/市場|market/i.test(t)) return 'market';
    if (/拉麵|沾麵|ramen/i.test(t)) return 'ramen';
    if (/壽司|海鮮|丼|sushi|seafood/i.test(t)) return 'seafood';
    if (/燒肉|成吉思汗|yakiniku|grill/i.test(t)) return 'grill';
    if (/甜點|蛋糕|冰淇淋|dessert/i.test(t)) return 'dessert';
    if (/咖啡|cafe|下午茶/i.test(t)) return 'cafe';
    if (/居酒屋|宵夜|夜食|izakaya/i.test(t)) return 'izakaya';
    if (/主題咖啡|角色/i.test(t)) return 'theme_cafe';
    return 'other';
  }

  function itemTags(title, styleKey) {
    var t = String(title || '');
    var tags = [];
    if (/免費|公園|參拜|散步|雷門|十字路口/i.test(t)) tags.push('free');
    if (/展望|晴空塔|電視塔|SKY|teamLab|門票|門票/i.test(t) || /塔/.test(t)) tags.push('paid');
    if (/米其林|預約|Omakase|高檔|奢華/i.test(t)) tags.push('expensive');
    if (/麻布台|現代|複合|設計街區|話題/i.test(t)) tags.push('modern');
    if (/視覺|拍攝|夜景|日落|建築|teamLab/i.test(t)) tags.push('visual');
    if (/動漫|秋葉原|中野|扭蛋|一番賞|模型|公仔|Mandarake/i.test(t)) tags.push('anime');
    if (/古著|選物|裏原宿|下北澤|高圓寺|streetwear|黑膠|球鞋/i.test(t)) tags.push('streetwear');
    if (/市場|名物|特色|必比登/i.test(t)) tags.push('specialty');
    if (/隱藏|巷弄|小眾|獨立店/i.test(t)) tags.push('hidden');
    if (/淺草|晴空塔|澀谷|明治神宮|上野|大通|時計台|電視塔/i.test(t)) tags.push('iconic');
    if (styleKey === 'trendy' || styleKey === 'photospot') tags.push('freshness_unknown');
    return tags;
  }

  function annotateStyleItem(item, styleKey) {
    var title = item.title || item.name || '';
    var exp = classifyExperience(title);
    var filler = isFillerTitle(title) || exp === 'nav';
    item.__style = {
      experience: exp,
      isFiller: filler,
      isAirport: isAirportTitle(title),
      foodFamily: exp === 'food' || exp === 'nightlife' ? foodFamilyOf(title) : null,
      tags: itemTags(title, styleKey),
      paid: /展望|晴空塔|電視塔|teamLab|門票|SKY|時計台/.test(title),
      famous: /淺草|晴空塔|澀谷|明治|上野|大通|電視塔|時計台|築地|秋葉原|中野|二條市場/.test(title),
      styleFit: 0
    };
    item.__style.styleFit = scoreItemStyleFit(item, styleKey);
    return item;
  }

  function scoreItemStyleFit(item, styleKey) {
    var profile = getProfile(styleKey);
    var st = item.__style;
    if (!st || st.isFiller || st.isAirport) return 0;
    var exp = st.experience;
    var score = 40;
    var target = profile[exp];
    if (typeof target === 'number') score += target * 40;
    if (styleKey === 'budget') {
      if (st.tags.indexOf('free') !== -1 || st.tags.indexOf('budget_meal') !== -1) score += 20;
      if (st.paid) score -= 25;
      if (st.tags.indexOf('expensive') !== -1) score -= 35;
    }
    if (styleKey === 'sightseeing') {
      if (st.tags.indexOf('iconic') !== -1 || st.famous) score += 25;
      if (st.tags.indexOf('hidden') !== -1 && !st.famous) score -= 15;
    }
    if (styleKey === 'trendy') {
      if (st.tags.indexOf('modern') !== -1) score += 25;
      if (st.tags.indexOf('iconic') !== -1 && st.tags.indexOf('modern') === -1) score -= 10;
    }
    if (styleKey === 'foodie') {
      if (exp === 'food' || exp === 'nightlife') score += 30;
      if (st.tags.indexOf('specialty') !== -1 || st.tags.indexOf('market') !== -1) score += 15;
      if (exp === 'landmark' && !st.famous) score -= 10;
    }
    if (styleKey === 'photospot') {
      if (st.tags.indexOf('visual') !== -1) score += 30;
      if (exp === 'shopping' && st.tags.indexOf('visual') === -1) score -= 15;
    }
    if (styleKey === 'anime') {
      if (st.tags.indexOf('anime') !== -1) score += 35;
      if (exp === 'shopping') score += 10;
      if (exp === 'landmark' && st.tags.indexOf('anime') === -1) score -= 20;
    }
    if (styleKey === 'streetwear') {
      if (st.tags.indexOf('streetwear') !== -1 || st.tags.indexOf('vintage') !== -1) score += 35;
      if (/百貨|三越|伊勢丹|高島屋|大丸/.test(item.title || '')) score -= 30;
      if (exp === 'landmark' && st.tags.indexOf('iconic') !== -1) score -= 5;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function flattenDay(day) {
    var items = [];
    (day.phases || []).forEach(function (ph) {
      (ph.items || []).forEach(function (it) {
        items.push(it);
      });
    });
    return items;
  }

  function rebuildDay(day, items) {
    day.phases = [{ label: '全天', items: items }];
    return day;
  }

  function realPois(items) {
    return (items || []).filter(function (it) {
      return it.__style && !it.__style.isFiller && !it.__style.isAirport;
    });
  }

  function ratioMap(items) {
    var real = realPois(items);
    var counts = {
      landmark: 0,
      food: 0,
      shopping: 0,
      nightlife: 0,
      museum: 0,
      nature: 0,
      culture: 0,
      local: 0,
      other: 0
    };
    real.forEach(function (it) {
      var e = it.__style.experience;
      if (counts[e] == null) counts.other += 1;
      else counts[e] += 1;
    });
    var total = real.length || 1;
    var ratios = {};
    Object.keys(counts).forEach(function (k) {
      ratios[k] = counts[k] / total;
    });
    return { counts: counts, ratios: ratios, total: real.length };
  }

  function resolveCatalogCity(cityOrDest) {
    var d = String(cityOrDest || '');
    if (/札幌|北海道|Sapporo/i.test(d)) return 'Sapporo';
    if (/東京|Tokyo/i.test(d)) return 'Tokyo';
    if (/首爾|Seoul|韓國/i.test(d)) return 'Tokyo';
    if (d === 'Sapporo' || d === 'Tokyo') return d;
    return 'Tokyo';
  }

  function catalogFor(city, styleKey) {
    var key = resolveCatalogCity(city);
    var pack = STYLE_CATALOGS[key] || STYLE_CATALOGS.Tokyo;
    return (pack && pack[styleKey]) || [];
  }

  function inferCity(meta, hidden) {
    var d = String((meta && meta.destination) || (hidden && hidden.meta && hidden.meta.destination) || '');
    return resolveCatalogCity(d);
  }

  function isForeignForCity(title, city) {
    var t = String(title || '');
    var c = resolveCatalogCity(city);
    if (c === 'Sapporo') {
      return /秋葉原|中野|池袋|原宿|下北澤|高圓寺|築地|淺草|澀谷|麻布台|表參道|teamLab|晴空塔|明治神宮|上野|台場|東京塔|羽田|成田/i.test(
        t
      );
    }
    if (c === 'Tokyo') {
      return /大通公園|札幌電視塔|札幌時計台|二條市場|新千歲|薄野|狸小路|北海道神宮|白色戀人/i.test(t);
    }
    return false;
  }

  function makeItemFromCatalog(entry, dayIndex, slot) {
    var start = 10 * 60 + slot * 90;
    var hh = Math.floor(start / 60);
    var mm = start % 60;
    var end = start + 60;
    var eh = Math.floor(end / 60);
    var em = end % 60;
    function pad(n) {
      return (n < 10 ? '0' : '') + n;
    }
    return {
      title: entry.title,
      startTime: pad(hh) + ':' + pad(mm),
      endTime: pad(eh) + ':' + pad(em),
      eventType: entry.experience === 'food' ? 'food' : 'attraction',
      highlight: '當地推薦體驗',
      note: entry.district ? '建議區域：' + entry.district : '',
      // Test-only helper flag — never used for live injection
      __fixtureSimulatedGemini: true,
      __places: {
        openingHoursKnown: false,
        district: entry.district || ''
      }
    };
  }

  function titleExists(items, title) {
    return (items || []).some(function (it) {
      return String(it.title || '') === String(title || '');
    });
  }

  function canonicalTitle(title) {
    return String(title || '')
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, '')
      .trim()
      .toLowerCase();
  }

  function parseUserRequests(customWishes) {
    var raw = String(customWishes || '').trim();
    if (!raw) return { hard: [], soft: [], terms: [] };
    var parts = raw
      .split(/[\n,，；;、。！!？?]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return s.length >= 2;
      });
    var hard = [];
    var soft = [];
    parts.forEach(function (p) {
      if (/一定要|必須|一定|不要|不能|禁止|別|不可|得去|指定/.test(p)) hard.push(p);
      else soft.push(p);
    });
    var terms = [];
    parts.forEach(function (p) {
      // Exclusions are not positive match terms (e.g. 不要吃生食 must not mark 生食 POIs as requested)
      if (/不要|不能|禁止|別|不可/.test(p)) return;
      var cleaned = p
        .replace(
          /一定要安排一天去|一定要去|一定要|必須去|必須|也想逛|也想吃|還想逛|還想吃|想去|想吃|想逛|也想|還想|不要排太趕|請|希望|安排一天去|一天去/g,
          ''
        )
        .replace(/^[也還和及與的]+/, '')
        .trim();
      if (cleaned.length >= 2) terms.push(cleaned);
      var placeHit = cleaned.match(
        /小樽|成吉思汗|寶可夢|Pokemon|Pokémon|燒肉|拉麵|甜點|白色戀人|湯咖哩/i
      );
      if (placeHit) terms.push(placeHit[0]);
      // Split "拉麵和甜點"
      cleaned.split(/[和與与\/]/).forEach(function (bit) {
        bit = bit.trim();
        if (bit.length >= 2) terms.push(bit);
      });
    });
    // Dedupe
    var seen = {};
    terms = terms.filter(function (t) {
      var k = t.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
    return { hard: hard, soft: soft, terms: terms, raw: raw };
  }

  function markUserRequestedItems(hidden, customWishes) {
    var parsed = parseUserRequests(customWishes);
    var terms = parsed.terms || [];
    (hidden.days || []).forEach(function (day) {
      flattenDay(day).forEach(function (it) {
        var title = String(it.title || '');
        var hit = terms.some(function (term) {
          if (!term) return false;
          return title.indexOf(term) !== -1 || (term.length >= 4 && term.indexOf(title) !== -1);
        });
        // Extra fuzzy: Pokemon / 寶可夢
        if (!hit && /寶可夢|Pokemon|Pokémon|ポケモン/i.test(String(customWishes || ''))) {
          hit = /寶可夢|Pokemon|Pokémon|ポケモン/i.test(title);
        }
        if (!hit && /成吉思汗|ジンギスカン/i.test(String(customWishes || ''))) {
          hit = /成吉思汗|ジンギスカン|だるま|Daruma/i.test(title);
        }
        if (!hit && /小樽|Otaru/i.test(String(customWishes || ''))) {
          hit = /小樽|Otaru/i.test(title);
        }
        if (hit) {
          it.__userRequested = true;
          if (it.__style) it.__style.userRequested = true;
        }
      });
    });
    return parsed;
  }

  function collectUnfulfilledUserRequests(hidden, parsed) {
    var unfulfilled = [];
    (parsed.hard || []).forEach(function (req) {
      var term = req
        .replace(/一定要去|一定要|必須去|必須|想去|想吃|想逛|不要|不能|禁止|別/g, '')
        .trim();
      if (!term) return;
      // exclusion hard prefs are handled by Gemini; mark unfulfilled only for "must go" if missing
      if (/不要|不能|禁止|別/.test(req)) return;
      var found = false;
      (hidden.days || []).forEach(function (day) {
        flattenDay(day).forEach(function (it) {
          if (String(it.title || '').indexOf(term) !== -1) found = true;
        });
      });
      if (!found) {
        unfulfilled.push({
          request: req,
          status: 'unfulfilled',
          reason: 'missing_from_candidates'
        });
      }
    });
    return unfulfilled;
  }

  function sanitizeUserFacingText(text) {
    var s = String(text || '');
    s = s.replace(/style-engine:[^\s|｜]*/gi, '');
    s = s.replace(/\b(iconic|view|anchor|supporting|filler|hiddenGem|styleQuality)\b/gi, '');
    s = s.replace(/tags?:\s*\[[^\]]*\]/gi, '');
    s = s.replace(/（風格意圖槽位）/g, '');
    s = s.replace(/風格意圖槽位/g, '');
    s = s.replace(/\s{2,}/g, ' ').trim();
    s = s.replace(/^[·|｜\-\s]+|[·|｜\-\s]+$/g, '').trim();
    return s;
  }

  function sanitizeItineraryForRender(hidden) {
    (hidden.days || []).forEach(function (day) {
      flattenDay(day).forEach(function (it) {
        if (it.title != null) it.title = sanitizeUserFacingText(it.title);
        if (it.highlight != null) it.highlight = sanitizeUserFacingText(it.highlight);
        if (it.note != null) it.note = sanitizeUserFacingText(it.note);
        if (it.description != null) it.description = sanitizeUserFacingText(it.description);
        if (it.transport != null) it.transport = sanitizeUserFacingText(it.transport);
        // Strip catalog injection flags from ever rendering
        delete it.__styleCatalog;
        delete it.__candidateBoundQa;
      });
    });
    return hidden;
  }

  function canDropForStyle(it) {
    if (!it) return false;
    if (it.__userRequested) return false;
    if (it.__style && it.__style.userRequested) return false;
    if (it.__style && (it.__style.isAirport || it.__style.isFiller)) return false;
    if (isAirportTitle(it.title)) return false;
    return true;
  }

  /**
   * Filter / rank path DISABLED for live — Style Engine is audit-only after Gemini.
   * Kept as internal helper for tests that explicitly opt into filtering.
   */
  function applyStyleToDay(day, dayIndex, styleKey, city, repairs, usedTitles) {
    repairs = repairs || [];
    usedTitles = usedTitles || {};
    // Audit annotations only — never drop / rebuild schedule in default architecture
    flattenDay(day).forEach(function (it) {
      annotateStyleItem(it, styleKey);
      var canon = canonicalTitle(it.title);
      if (canon && !it.__style.isFiller && !it.__style.isAirport) {
        if (usedTitles[canon] && !it.__userRequested) {
          repairs.push({
            type: 'style_audit_trip_repeat',
            title: it.title,
            day: day.dayNum || dayIndex + 1
          });
        } else {
          usedTitles[canon] = true;
        }
      }
    });
    day.__styleDay = {
      styleKey: styleKey,
      ratios: ratioMap(flattenDay(day).map(function (it) {
        return annotateStyleItem(it, styleKey);
      })).ratios,
      theme: inferDayTheme(flattenDay(day), styleKey, city),
      auditOnly: true
    };
    return day;
  }

  function inferDayTheme(items, styleKey, city) {
    var districts = {};
    realPois(items).forEach(function (it) {
      var note = String(it.note || '');
      var m = note.match(/style-engine:([^\s]+)/);
      var d = (it.__places && it.__places.district) || (m && m[1]) || '';
      if (!d) {
        // heuristic from title
        ['淺草', '澀谷', '新宿', '上野', '秋葉原', '中野', '池袋', '原宿', '下北澤', '築地', '表參道', '麻布台', '台場', '大通', '薄野', '札幌站', '狸小路', '二條市場'].forEach(function (name) {
          if (String(it.title || '').indexOf(name) !== -1) d = name;
        });
      }
      if (d) districts[d] = (districts[d] || 0) + 1;
    });
    var top = Object.keys(districts).sort(function (a, b) {
      return districts[b] - districts[a];
    })[0];
    var labels = {
      budget: '小資高效',
      sightseeing: '經典代表',
      trendy: '現代街區',
      foodie: '美食主軸',
      photospot: '視覺拍攝',
      anime: '動漫挖寶',
      streetwear: '潮流選物'
    };
    return (labels[styleKey] || styleKey) + (top ? ' · ' + top : '') + (city ? '（' + city + '）' : '');
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function computeStyleQualityScore(hidden, styleKey) {
    styleKey = normalizeStyleKey(styleKey);
    var weights = QUALITY_WEIGHTS[styleKey] || QUALITY_WEIGHTS.sightseeing;
    var profile = getProfile(styleKey);
    var all = [];
    (hidden.days || []).forEach(function (day) {
      flattenDay(day).forEach(function (it) {
        annotateStyleItem(it, styleKey);
        all.push(it);
      });
    });
    var real = realPois(all);
    var stats = ratioMap(all);
    var paidN = real.filter(function (it) {
      return it.__style.paid;
    }).length;
    var famousN = real.filter(function (it) {
      return it.__style.famous || it.__style.tags.indexOf('iconic') !== -1;
    }).length;
    var hiddenN = real.filter(function (it) {
      return it.__style.tags.indexOf('hidden') !== -1 || it.__style.tags.indexOf('modern') !== -1;
    }).length;
    var foodN = stats.counts.food + stats.counts.nightlife;
    var families = {};
    real.forEach(function (it) {
      if (it.__style.foodFamily) families[it.__style.foodFamily] = true;
    });
    var foodFamilyCount = Object.keys(families).length;

    var landmarkMatch = clamp01(1 - Math.abs((stats.ratios.landmark || 0) - profile.landmark * 0.45));
    if (styleKey === 'sightseeing') {
      var iconicN = real.filter(function (it) {
        return it.__style.tags.indexOf('iconic') !== -1 || it.__style.famous;
      }).length;
      landmarkMatch = clamp01(
        (stats.counts.landmark + stats.counts.culture + iconicN * 0.5) / Math.max(3, (hidden.days || []).length)
      );
      if (iconicN >= 2) landmarkMatch = Math.max(landmarkMatch, 0.75);
      if (famousN < 2) landmarkMatch *= 0.7;
    }
    var mealMatch = clamp01((stats.ratios.food || 0) / Math.max(0.2, profile.food * 0.4));
    if (styleKey === 'foodie') {
      mealMatch = clamp01(foodN / Math.max(3, (hidden.days || []).length));
      if (foodFamilyCount < 2) mealMatch *= 0.6;
    }
    var budgetMatch = 0.7;
    if (styleKey === 'budget') {
      var paidRatio = paidN / (real.length || 1);
      budgetMatch = clamp01(1 - paidRatio / 0.5);
      if (real.some(function (it) { return it.__style.tags.indexOf('expensive') !== -1; })) {
        budgetMatch *= 0.4;
      }
    }
    var nightlifeMatch = clamp01(
      1 - Math.abs((stats.ratios.nightlife || 0) - profile.nightlife * 0.5)
    );
    var hiddenGemMatch = clamp01(hiddenN / Math.max(1, real.length * profile.hiddenGemRatio));
    if (styleKey === 'sightseeing') hiddenGemMatch = clamp01(1 - hiddenN / Math.max(3, real.length));
    var paceMatch = 0.75;
    var days = hidden.days || [];
    if (days.length) {
      // STYLE ≠ PACE: score against global completeness band, not style densityTarget
      var densities = days.map(function (d) {
        return realPois(flattenDay(d).map(function (it) {
          return annotateStyleItem(it, styleKey);
        })).length;
      });
      var avg = densities.reduce(function (a, b) { return a + b; }, 0) / densities.length;
      var GLOBAL_PACE_BAND = 6;
      paceMatch = clamp01(1 - Math.abs(avg - GLOBAL_PACE_BAND) / 5);
    }
    var poiMix = clamp01(
      (Number(stats.counts.landmark > 0) +
        Number(stats.counts.food > 0) +
        Number(stats.counts.shopping > 0 || styleKey === 'foodie' || styleKey === 'sightseeing') +
        Number(stats.counts.nature > 0 || stats.counts.culture > 0 || stats.counts.local > 0)) / 3
    );
    var intentMatch = clamp01(
      (landmarkMatch + mealMatch + budgetMatch + hiddenGemMatch) / 4
    );
    if (styleKey === 'anime') {
      var animeN = real.filter(function (it) {
        return it.__style.tags.indexOf('anime') !== -1;
      }).length;
      intentMatch = clamp01(animeN / Math.max(2, days.length));
    }
    if (styleKey === 'streetwear') {
      var swN = real.filter(function (it) {
        return (
          it.__style.tags.indexOf('streetwear') !== -1 ||
          it.__style.tags.indexOf('vintage') !== -1 ||
          (it.__style.experience === 'shopping' && !/百貨/.test(it.title || ''))
        );
      }).length;
      intentMatch = clamp01(swN / Math.max(2, days.length));
    }
    if (styleKey === 'trendy' || styleKey === 'photospot') {
      var visualModern = real.filter(function (it) {
        return (
          it.__style.tags.indexOf('modern') !== -1 ||
          it.__style.tags.indexOf('visual') !== -1
        );
      }).length;
      intentMatch = clamp01(visualModern / Math.max(2, days.length));
    }

    var parts = {
      intentMatch: intentMatch,
      poiMix: poiMix,
      budgetMatch: budgetMatch,
      paceMatch: paceMatch,
      nightlifeMatch: nightlifeMatch,
      mealMatch: mealMatch,
      hiddenGemMatch: hiddenGemMatch,
      landmarkMatch: landmarkMatch
    };
    var total = 0;
    Object.keys(weights).forEach(function (k) {
      total += (parts[k] || 0) * (weights[k] || 0);
    });
    return {
      styleKey: styleKey,
      score: Math.round(total * 100),
      parts: parts,
      weights: weights,
      stats: stats,
      socialLive: profile.socialLive === true,
      freshness: profile.freshnessDefault || 'n/a'
    };
  }

  function expectedForStyle(styleKey) {
    var map = {
      budget: 'free/low-cost POI, budget meals, low paid density, compact routing',
      sightseeing: 'iconic landmarks / representative districts dominant',
      trendy: 'modern districts & newer developments (socialLive=false)',
      foodie: 'markets / specialties / diverse food anchors (not ramen×N)',
      photospot: 'visual landmarks, architecture, views, photo-friendly cafes',
      anime: 'anime/manga/figure districts + normal meal pace',
      streetwear: 'vintage/select/streetwear districts, not dept-store spam'
    };
    return map[styleKey] || '';
  }

  function evaluateExpectedVsActual(hidden, styleKey) {
    var q = computeStyleQualityScore(hidden, styleKey);
    var expected = expectedForStyle(styleKey);
    var result = 'PASS';
    if (q.score < 55) result = 'FAIL';
    else if (q.score < 70) result = 'WARN';
    // Hard fails
    if (styleKey === 'sightseeing' && (q.parts.landmarkMatch || 0) < 0.45) result = 'FAIL';
    if (styleKey === 'foodie' && (q.parts.mealMatch || 0) < 0.45) result = 'FAIL';
    if (styleKey === 'budget' && (q.parts.budgetMatch || 0) < 0.4) result = 'FAIL';
    if (styleKey === 'anime' && (q.parts.intentMatch || 0) < 0.35) result = 'FAIL';
    if (styleKey === 'streetwear' && (q.parts.intentMatch || 0) < 0.35) result = 'FAIL';
    return {
      styleKey: styleKey,
      expected: expected,
      actual: {
        score: q.score,
        parts: q.parts,
        ratios: q.stats.ratios,
        socialLive: q.socialLive,
        freshness: q.freshness
      },
      result: result
    };
  }

  function summarizeHumanReadable(hidden, styleKey, city) {
    styleKey = normalizeStyleKey(styleKey);
    var daysOut = [];
    (hidden.days || []).forEach(function (day, idx) {
      var items = flattenDay(day).map(function (it) {
        return annotateStyleItem(it, styleKey);
      });
      var real = realPois(items);
      var districts = [];
      var anchors = [];
      var meals = [];
      var shopping = [];
      var nightlife = [];
      var paid = [];
      var gems = [];
      real.forEach(function (it) {
        var t = it.title || '';
        if (it.__style.experience === 'food') meals.push(t);
        if (it.__style.experience === 'shopping') shopping.push(t);
        if (it.__style.experience === 'nightlife') nightlife.push(t);
        if (it.__style.paid) paid.push(t);
        if (it.__style.tags.indexOf('hidden') !== -1 || it.__style.tags.indexOf('modern') !== -1) {
          gems.push(t);
        }
        if (it.__style.styleFit >= 70 || it.__style.tags.indexOf('iconic') !== -1) anchors.push(t);
        ['淺草', '澀谷', '新宿', '上野', '秋葉原', '中野', '池袋', '原宿', '下北澤', '築地', '表參道', '麻布台', '台場', '大通', '薄野', '札幌站', '狸小路', '二條市場', '宮之澤'].forEach(function (d) {
          if (t.indexOf(d) !== -1 && districts.indexOf(d) === -1) districts.push(d);
        });
      });
      daysOut.push({
        day: day.dayNum || idx + 1,
        theme: (day.__styleDay && day.__styleDay.theme) || inferDayTheme(items, styleKey, city),
        districts: districts,
        anchors: anchors,
        meals: meals,
        shopping: shopping,
        nightlife: nightlife,
        paidAttractions: paid,
        hiddenGems: gems,
        majorPOIs: real.map(function (it) {
          return it.title;
        })
      });
    });
    return {
      styleKey: styleKey,
      city: city,
      days: daysOut,
      quality: computeStyleQualityScore(hidden, styleKey),
      expectedVsActual: evaluateExpectedVsActual(hidden, styleKey)
    };
  }

  function applyStyleEngine(hidden, meta, opt) {
    opt = opt || {};
    meta = meta || {};
    hidden = hidden || { days: [] };
    var styleKey = normalizeStyleKey(opt.styleKey || meta.travelStyle || 'sightseeing');
    var city = resolveCatalogCity(opt.city || inferCity(meta, hidden));
    var repairs = [];
    var profile = getProfile(styleKey);
    var customWishes = opt.customWishes || meta.customWishes || '';
    var parsedRequests = markUserRequestedItems(hidden, customWishes);
    var usedTitles = Object.create(null);

    (hidden.days || []).forEach(function (day, idx) {
      applyStyleToDay(day, idx, styleKey, city, repairs, usedTitles);
    });

    var quality = computeStyleQualityScore(hidden, styleKey);
    var needsStyleReplan = quality.score < 55;
    var overFilterWarning = false;
    var unfulfilledUserRequest = collectUnfulfilledUserRequests(hidden, parsedRequests);
    var summary = summarizeHumanReadable(hidden, styleKey, city);

    // Never leave internal metadata in user-facing fields
    sanitizeItineraryForRender(hidden);

    // Preserve user flight / wishes on meta
    hidden.meta = hidden.meta || {};
    if (meta.flightOutboundNumber || meta.flightArrival || meta.flightReturn) {
      hidden.meta.userFlights = {
        flightOutboundNumber: meta.flightOutboundNumber || '',
        flightReturnNumber: meta.flightReturnNumber || '',
        flightOutboundFrom: meta.flightOutboundFrom || '',
        flightOutboundTo: meta.flightOutboundTo || '',
        flightReturnFrom: meta.flightReturnFrom || '',
        flightReturnTo: meta.flightReturnTo || '',
        flightDeparture: meta.flightDeparture || meta.departureTime || '',
        flightArrival: meta.flightArrival || meta.arrivalTime || '',
        flightReturn: meta.flightReturn || meta.returnTime || ''
      };
    }
    if (customWishes) hidden.meta.customWishes = customWishes;
    if (meta.flightMode) hidden.meta.flightMode = meta.flightMode;

    hidden.meta.styleEngine = {
      version: '1.2-audit',
      styleKey: styleKey,
      city: city,
      socialLive: profile.socialLive === true,
      freshness: profile.freshnessDefault || 'n/a',
      canCreateContent: false,
      canMutateSchedule: false,
      auditOnly: true,
      repairs: repairs.slice(0, 80),
      quality: quality,
      needsStyleReplan: needsStyleReplan,
      overFilterWarning: overFilterWarning,
      unfulfilledUserRequest: unfulfilledUserRequest,
      userRequests: parsedRequests,
      summary: summary,
      note:
        'Style Engine scores/audits only after Gemini. Never injects, drops, or reshapes itinerary content.'
    };

    return {
      hidden: hidden,
      repairs: repairs,
      quality: quality,
      summary: summary,
      styleKey: styleKey,
      needsStyleReplan: needsStyleReplan,
      overFilterWarning: overFilterWarning,
      unfulfilledUserRequest: unfulfilledUserRequest
    };
  }

  /**
   * Test helper only: simulate Gemini-proposed itinerary (NOT live Style Engine injection).
   */
  function buildNeutralFixture(city, days) {
    return buildGeminiSimulatedFixture(city, 'sightseeing', days || 5, { mixAllStyles: true });
  }

  function buildGeminiSimulatedFixture(city, styleKey, days, opt) {
    opt = opt || {};
    days = days || 5;
    styleKey = normalizeStyleKey(styleKey);
    city = resolveCatalogCity(city);
    var catalogs = STYLE_CATALOGS[city] || STYLE_CATALOGS.Tokyo;
    var pool = [];
    if (opt.mixAllStyles) {
      STYLE_KEYS.forEach(function (k) {
        pool = pool.concat(catalogs[k] || []);
      });
    } else {
      pool = (catalogs[styleKey] || []).slice();
      // Add a few cross-style candidates so filter can demonstrate ranking
      pool = pool.concat((catalogs.sightseeing || []).slice(0, 2));
    }
    var seen = {};
    pool = pool.filter(function (e) {
      if (seen[e.title]) return false;
      seen[e.title] = true;
      return true;
    });
    var outDays = [];
    var i;
    for (i = 0; i < days; i++) {
      var slice = pool.slice(i * 2, i * 2 + 4);
      if (slice.length < 2) slice = pool.slice(0, Math.min(4, pool.length));
      var items = slice.map(function (entry, slot) {
        return makeItemFromCatalog(entry, i, slot);
      });
      if (i === 0) {
        items.unshift({
          title: city === 'Sapporo' ? '新千歲機場抵達' : '成田／羽田機場抵達',
          startTime: '11:30',
          endTime: '12:00',
          eventType: 'arrival'
        });
      }
      if (i === days - 1) {
        items.push({
          title: '前往機場',
          startTime: '16:30',
          endTime: '17:30',
          eventType: 'departure'
        });
      } else {
        items.push({
          title: '返回住宿休息',
          startTime: '21:00',
          endTime: '21:30',
          eventType: 'rest'
        });
      }
      outDays.push({ dayNum: i + 1, phases: [{ label: '全天', items: items }] });
    }
    return {
      meta: {
        destination: city === 'Sapporo' ? '札幌' : '東京',
        travelStyle: styleKey
      },
      days: outDays
    };
  }

  function buildRepeatLandmarkFixture(city, days, landmarkTitle) {
    days = days || 5;
    city = resolveCatalogCity(city);
    var outDays = [];
    var i;
    for (i = 0; i < days; i++) {
      outDays.push({
        dayNum: i + 1,
        phases: [
          {
            label: '全天',
            items: [
              {
                title: landmarkTitle,
                startTime: '10:00',
                endTime: '11:30',
                highlight: '重複地標',
                note: '建議區域：大通'
              },
              {
                title: '札幌電視塔',
                startTime: '13:00',
                endTime: '14:00',
                highlight: '重複地標',
                note: '建議區域：大通'
              },
              {
                title: '返回住宿休息',
                startTime: '21:00',
                endTime: '21:30',
                eventType: 'rest'
              }
            ]
          }
        ]
      });
    }
    return { meta: { destination: city === 'Sapporo' ? '札幌' : '東京' }, days: outDays };
  }

  function overlapTitles(aHidden, bHidden) {
    function titles(h) {
      var set = {};
      (h.days || []).forEach(function (d) {
        flattenDay(d).forEach(function (it) {
          if (isFillerTitle(it.title) || isAirportTitle(it.title)) return;
          set[String(it.title || '')] = true;
        });
      });
      return set;
    }
    var A = titles(aHidden);
    var B = titles(bHidden);
    var keysA = Object.keys(A);
    var inter = keysA.filter(function (k) {
      return B[k];
    });
    var union = {};
    keysA.forEach(function (k) {
      union[k] = true;
    });
    Object.keys(B).forEach(function (k) {
      union[k] = true;
    });
    var u = Object.keys(union).length || 1;
    return { intersection: inter.length, union: u, ratio: inter.length / u, shared: inter };
  }

  function buildPlanningIntentPrompt(styleKey, city) {
    styleKey = normalizeStyleKey(styleKey);
    var def = getStyleDefinition(styleKey);
    var profile = getProfile(styleKey);
    var cityLabel = city || '目的地';
    var label = (def.labels && def.labels.zh) || styleKey;
    var freshLine = '';
    if (def.freshnessRequirement === 'preferred') {
      freshLine =
        ' Freshness：無 live 證據時標為「' +
        (def.freshnessFallbackLabel || 'Contemporary') +
        '」，禁止宣稱最新爆紅／社群第一。';
    }
    return (
      '【STYLE_DEFINITION planning intent — styleKey=' +
      styleKey +
      ' · ' +
      label +
      ' · ' +
      cityLabel +
      '】\n' +
      def.selectionIntent +
      '\n優先類別：' +
      (def.prioritizeCategories || []).join('、') +
      '。避免：' +
      (def.avoidCategories || []).join('、') +
      '。\n' +
      '街區：' +
      def.neighborhoodIntent +
      '\n美食：' +
      def.foodIntent +
      '\n購物：' +
      def.shoppingIntent +
      '\n體驗：' +
      def.experienceIntent +
      '\n此風格必須改變：POI selection、shopping type、meal style、neighborhood、evening rhythm、detour willingness、local vs famous ratio——不是只改形容詞。\n' +
      '【STYLE ≠ PACE】風格決定去哪／吃什麼／逛什麼；全日事件密度由 DAY COMPLETENESS 與 usable window 決定——禁止因 styleKey 把整天壓成半日或 bypass completeness。' +
      freshLine +
      ' landmarkAffinity=' +
      def.landmarkAffinity +
      ' foodWeight=' +
      ((profile && profile.food) || def.categoryWeights.food) +
      '。USER REQUEST > STYLE PREFERENCE > 休閒購物偏好。' +
      ' 人類真實節奏：混合觀光／餐飲／咖啡甜點／休閒逛街／地方名產；購物必須 destination-aware＋route-aware，禁止品牌／國家 checklist 硬塞（Don Quijote／Olive Young 僅為語意示例）。' +
      ' 地方感 > 通用連鎖；主要觀光 POI 整趟原則只出現一次；短距離「前往」不獨立成卡。' +
      ' 你一次產出完整可執行行程（順序、時間、區域 clustering、交通說明、抵達／離境日、住宿 check-in、購物停靠）。' +
      ' 後端 Style Engine 只會 score／audit，不會幫你注入購物／補景點／重排時間。'
    );
  }

  function buildStyleInstructionPrompt(styleKey, currentCity, selectedStyle) {
    styleKey = normalizeStyleKey(styleKey);
    var def = getStyleDefinition(styleKey);
    var city = currentCity || '旅遊目的地';
    var label = selectedStyle || (def.labels && def.labels.zh) || styleKey;
    var en = (def.labels && def.labels.en) || styleKey;
    var lines = [];
    lines.push('【' + label + ' (' + en + ')——當前風格核心指令 · GLOBAL StyleDefinition】');
    lines.push('- 選點意圖：' + def.selectionIntent);
    lines.push('- 景點／體驗：依【' + city + '】動態尋找符合「' + (def.prioritizeCategories || []).slice(0, 5).join('／') + '」的內容；避免 ' + (def.avoidCategories || []).slice(0, 4).join('／') + '。');
    lines.push('- 街區：' + def.neighborhoodIntent);
    lines.push('- 美食：' + def.foodIntent);
    lines.push('- 休閒購物：' + def.shoppingIntent);
    lines.push('- 體驗：' + def.experienceIntent);
    lines.push(
      '- 【STYLE ≠ PACE】停留時長依活動類型（正餐／咖啡／商圈漫遊／地標等），不是因為選了本風格就減少全日站數。必須通過 DAY COMPLETENESS；禁止半日大綱。'
    );
    if (def.routingHints && def.routingHints.preferClusterBrowse) {
      lines.push(
        '- 動線提示：同日可偏好商圈塊狀漫遊以減少拉車；這是 routing 提示，不是「一天只能很少活動」。'
      );
    }
    if (def.freshnessRequirement === 'preferred') {
      lines.push(
        '- Freshness：目前無 live 社群驗證。無證據時使用「' +
          (def.freshnessFallbackLabel || 'Contemporary') +
          '」；禁止宣稱最新爆紅／社群第一。'
      );
    }
    lines.push('- 與其他風格差異：genericTouristPenalty=' + def.genericTouristPenalty + '；landmarkAffinity=' + def.landmarkAffinity + '。');
    return lines.join('\n');
  }

  /* ========== Candidate schema + deterministic affinity (Phase 1) ========== */

  function createCandidate(partial) {
    partial = partial || {};
    var kind = partial.candidateKind || inferCandidateKind(partial);
    return {
      id: partial.id || '',
      title: partial.title || '',
      titleLocal: partial.titleLocal || '',
      destinationKey: String(partial.destinationKey || partial.destination || ''),
      categories: Array.isArray(partial.categories) ? partial.categories.slice() : [],
      neighborhoodHint: partial.neighborhoodHint || partial.district || '',
      experienceType: partial.experienceType || partial.experience || '',
      priceBand: partial.priceBand || 'mid',
      landmarkClass: partial.landmarkClass || 'none',
      geoHint: partial.geoHint || null,
      discoverySource: partial.discoverySource || 'synthetic',
      candidateKind: kind,
      freshnessConfidence: partial.freshnessConfidence || 'unknown',
      openStatus: partial.openStatus || 'unknown',
      validationState: partial.validationState || 'none',
      notesForGemini: partial.notesForGemini || '',
      foodFamily: partial.foodFamily || '',
      visualValue: typeof partial.visualValue === 'number' ? partial.visualValue : null,
      subcultureRelevance: typeof partial.subcultureRelevance === 'number' ? partial.subcultureRelevance : null,
      shoppingRelevance: typeof partial.shoppingRelevance === 'number' ? partial.shoppingRelevance : null,
      localAuthenticity: typeof partial.localAuthenticity === 'number' ? partial.localAuthenticity : null,
      tags: Array.isArray(partial.tags) ? partial.tags.slice() : [],
      styleAffinity: partial.styleAffinity || null
    };
  }

  function inferCandidateKind(partial) {
    partial = partial || {};
    if (partial.candidateKind) return String(partial.candidateKind);
    var src = String(partial.discoverySource || '');
    var title = String(partial.title || '');
    if (src === 'style_archetype' || /風格意圖槽位/.test(title)) return 'archetype';
    if (src === 'intel_anchor' || src === 'curated_optional') return 'anchor';
    if (src === 'provisional') return 'provisional';
    if (src === 'synthetic' && /風格意圖|semantic slot|archetype/i.test(title)) return 'archetype';
    return 'real';
  }

  function candidateHasCategory(c, list) {
    var cats = (c && c.categories) || [];
    var tags = (c && c.tags) || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (cats.indexOf(list[i]) !== -1) return true;
      if (tags.indexOf(list[i]) !== -1) return true;
    }
    return false;
  }

  function isFoodCandidate(c) {
    if (!c) return false;
    if (c.experienceType === 'food' || c.experienceType === 'nightlife') return true;
    if (c.foodFamily) return true;
    return candidateHasCategory(c, [
      'food',
      'cafe',
      'market',
      'dessert',
      'budget_meal',
      'specialty_food',
      'regional_dish',
      'night_food',
      'contemporary_cafe',
      'photo_cafe',
      'quick_eat',
      'depachika',
      'food_hall'
    ]);
  }

  function isGenericMustSee(c) {
    if (!c) return false;
    if (c.landmarkClass === 'core') return true;
    return candidateHasCategory(c, ['iconic_landmark', 'must_see', 'generic_tourist']);
  }

  /**
   * Infer supply scale from candidate count (global; no city name table).
   */
  function inferCandidateSupplyScale(candidateCount) {
    var n = Number(candidateCount) || 0;
    if (n >= 40) return 'mega';
    if (n >= 24) return 'large';
    if (n >= 12) return 'mid';
    return 'small';
  }

  /**
   * Soft core landmark share by supply scale + style coreLandmarkBudget.
   */
  function getCoreLandmarkSoftShare(styleKey, candidateCount) {
    var def = getStyleDefinition(styleKey);
    var scale = inferCandidateSupplyScale(candidateCount);
    var base = { mega: 0.2, large: 0.25, mid: 0.3, small: 0.38 };
    var share = base[scale] != null ? base[scale] : 0.3;
    var budget = def.coreLandmarkBudget || 'medium';
    if (budget === 'high') share += 0.08;
    if (budget === 'low') share -= 0.08;
    return clamp01(Math.max(0.12, Math.min(0.48, share)));
  }

  function scoreFoodAffinity(candidate, styleKey, flags) {
    styleKey = normalizeStyleKey(styleKey);
    var fam = String(candidate.foodFamily || '').toLowerCase();
    var cats = candidate.categories || [];
    var score = 0.45;
    function has() {
      var i;
      for (i = 0; i < arguments.length; i++) {
        if (cats.indexOf(arguments[i]) !== -1 || fam === arguments[i]) return true;
      }
      return false;
    }
    if (styleKey === 'budget') {
      if (has('budget_meal', 'market', 'casual', 'affordable')) {
        score = 0.92;
        flags.push('food_budget_fit');
      } else if (has('specialty_food', 'regional_dish')) score = 0.7;
      else if (has('luxury', 'fine_dining')) {
        score = 0.2;
        flags.push('food_budget_mismatch');
      }
    } else if (styleKey === 'sightseeing') {
      if (has('representative_food', 'regional_dish', 'specialty_food', 'signature')) {
        score = 0.9;
        flags.push('food_representative');
      } else if (has('market')) score = 0.75;
      else score = 0.55;
    } else if (styleKey === 'trendy') {
      if (has('contemporary_cafe', 'modern_dining', 'concept', 'cafe') && candidate.freshnessConfidence !== 'none') {
        score = 0.88;
        flags.push('food_contemporary');
      } else if (has('cafe', 'lifestyle')) score = 0.72;
      else if (has('regional_dish') && !has('contemporary_cafe', 'cafe')) score = 0.4;
    } else if (styleKey === 'foodie') {
      if (has('market', 'specialty_food', 'regional_dish', 'depachika', 'food_hall')) {
        score = 0.96;
        flags.push('food_foodie_anchor');
      } else if (has('dessert', 'night_food')) {
        score = 0.88;
        flags.push('food_foodie_secondary');
      } else if (has('cafe')) score = 0.7;
      else score = 0.5;
    } else if (styleKey === 'photospot') {
      if (has('photo_cafe', 'view_cafe', 'visual') || (candidate.visualValue != null && candidate.visualValue >= 0.7)) {
        score = 0.9;
        flags.push('food_visual');
      } else if (has('cafe', 'dessert')) score = 0.7;
      else score = 0.45;
    } else if (styleKey === 'anime') {
      if (has('quick_eat', 'character_cafe', 'theme_cafe')) {
        score = 0.85;
        flags.push('food_cluster_quick');
      } else if (has('budget_meal', 'ramen', 'casual')) score = 0.7;
      else score = 0.5;
    } else if (styleKey === 'streetwear') {
      if (has('casual', 'cafe', 'quick_eat') || candidate.neighborhoodHint) {
        score = 0.8;
        flags.push('food_retail_adjacent');
      } else if (has('fine_dining', 'luxury')) score = 0.3;
      else score = 0.55;
    }
    return clamp01(score);
  }

  /**
   * Deterministic style affinity 0–1 + reason flags.
   * Global; no city-specific branches.
   */
  function scoreStyleAffinity(candidate, styleKey) {
    styleKey = normalizeStyleKey(styleKey);
    var def = getStyleDefinition(styleKey);
    var flags = [];
    candidate = createCandidate(candidate);
    var score = 0.35;

    var priHit = 0;
    var i;
    for (i = 0; i < (def.prioritizeCategories || []).length; i++) {
      if (candidateHasCategory(candidate, [def.prioritizeCategories[i]])) priHit++;
    }
    if (priHit > 0) {
      score += Math.min(0.35, priHit * 0.12);
      flags.push('prioritize_hit:' + priHit);
    }

    for (i = 0; i < (def.avoidCategories || []).length; i++) {
      if (candidateHasCategory(candidate, [def.avoidCategories[i]])) {
        score -= 0.22;
        flags.push('avoid_hit:' + def.avoidCategories[i]);
      }
    }

    var lc = candidate.landmarkClass || 'none';
    if (lc === 'core') {
      score += def.landmarkAffinity * 0.25;
      flags.push('core_landmark');
      if (def.genericTouristPenalty >= 0.55 && priHit === 0 && !isFoodCandidate(candidate)) {
        score -= def.genericTouristPenalty * 0.35;
        flags.push('generic_core_penalty');
      }
    } else if (lc === 'secondary') {
      score += def.landmarkAffinity * 0.1;
    }

    if (isGenericMustSee(candidate) && def.genericTouristPenalty > 0.4 && styleKey !== 'sightseeing' && styleKey !== 'budget') {
      if (priHit === 0) {
        score -= def.genericTouristPenalty * 0.3;
        flags.push('anti_generic');
      }
    }

    if (isFoodCandidate(candidate)) {
      var foodScore = scoreFoodAffinity(candidate, styleKey, flags);
      score = score * 0.35 + foodScore * 0.65;
      flags.push('food_path');
    }

    if (typeof candidate.visualValue === 'number') {
      score += (candidate.visualValue - 0.5) * def.visualValueBias * 0.3;
    }
    if (typeof candidate.subcultureRelevance === 'number') {
      score += (candidate.subcultureRelevance - 0.5) * def.subcultureBias * 0.35;
    }
    if (typeof candidate.shoppingRelevance === 'number') {
      var shopW = (def.categoryWeights && def.categoryWeights.shopping) || 0.4;
      score += (candidate.shoppingRelevance - 0.5) * shopW * 0.25;
    }
    if (typeof candidate.localAuthenticity === 'number') {
      score += (candidate.localAuthenticity - 0.5) * def.localAuthenticityBias * 0.2;
    }

    var price = candidate.priceBand || 'mid';
    if (def.priceBand === 'low' && (price === 'high' || price === 'mid-high')) {
      score -= 0.2;
      flags.push('price_mismatch');
    }
    if (def.priceBand === 'high' && price === 'low' && styleKey === 'foodie') {
      score += 0.05;
    }

    if (def.freshnessRequirement === 'preferred') {
      if (candidate.freshnessConfidence === 'high' || candidate.freshnessConfidence === 'medium') {
        score += 0.08;
        flags.push('freshness_bonus');
      } else {
        flags.push('freshness_unknown_ok');
      }
    }

    score = clamp01(score);
    return {
      styleKey: styleKey,
      score: score,
      flags: flags,
      freshnessFallback:
        def.freshnessRequirement === 'preferred' &&
        !(candidate.freshnessConfidence === 'high' || candidate.freshnessConfidence === 'medium')
          ? def.freshnessFallbackLabel || 'Contemporary / Trend-oriented'
          : ''
    };
  }

  function rankCandidatesForStyle(candidates, styleKey) {
    return (candidates || [])
      .map(function (c) {
        var a = scoreStyleAffinity(c, styleKey);
        return { candidate: createCandidate(c), affinity: a };
      })
      .sort(function (x, y) {
        return y.affinity.score - x.affinity.score;
      });
  }

  /**
   * Soft core vs style-specific selection policy (no city hard-code).
   */
  function planCoreStyleMix(candidates, styleKey) {
    var ranked = rankCandidatesForStyle(candidates, styleKey);
    var n = ranked.length;
    var coreShare = getCoreLandmarkSoftShare(styleKey, n);
    var coreSlots = Math.max(0, Math.round(n * coreShare));
    var core = [];
    var styleSpecific = [];
    ranked.forEach(function (row) {
      var isCore = row.candidate.landmarkClass === 'core' || isGenericMustSee(row.candidate);
      if (isCore && core.length < coreSlots) core.push(row);
      else styleSpecific.push(row);
    });
    return {
      styleKey: normalizeStyleKey(styleKey),
      supplyScale: inferCandidateSupplyScale(n),
      coreShareSoft: coreShare,
      coreCount: core.length,
      styleSpecificCount: styleSpecific.length,
      core: core,
      styleSpecific: styleSpecific,
      ranked: ranked
    };
  }

  function promptCleanupList() {
    return [
      { action: 'rewrite', where: 'persona', from: '精通…各大社群熱點', to: '依風格權重與可驗證地點訊號規劃' },
      { action: 'rewrite', where: 'trendy', from: '最新開幕、社群討論度最高', to: '現代開發區／複合設施／設計街區（非 live 社群驗證）' },
      { action: 'rewrite', where: 'trendy', from: '現在大排長龍的網紅名店', to: '具話題性的現代餐飲（freshness=unknown）' },
      { action: 'remove', where: 'photospot', from: '對齊 IG／小紅書爆款', to: '高視覺辨識度／適合拍攝的地點與建築' },
      { action: 'remove', where: 'anime', from: '對齊 Threads 熱議', to: '動漫／漫畫／模型／公仔／二手收藏商圈（各地密度不同）' },
      { action: 'rewrite', where: 'foodie', from: 'Tabelog／米其林必比登（若無驗證）', to: '市場、地方名物、特色店與餐型多樣性' },
      { action: 'remove', where: 'all', from: 'densityTarget / 每天固定站數', to: 'STYLE≠PACE；密度由 DAY COMPLETENESS' }
    ];
  }

  /* ========== Phase 2: Destination Discovery Foundation ========== */

  var CATEGORY_ARCHETYPE_META = {
    free_landmark: { experienceType: 'landmark', landmarkClass: 'secondary', priceBand: 'low', label: '免費／高 CP 地標' },
    park: { experienceType: 'nature', landmarkClass: 'secondary', priceBand: 'low', label: '公園／散步' },
    market: { experienceType: 'food', foodFamily: 'market', priceBand: 'low', label: '市場逛吃' },
    budget_meal: { experienceType: 'food', foodFamily: 'budget_meal', priceBand: 'low', label: '平價在地餐' },
    drugstore: { experienceType: 'shopping', shoppingRelevance: 0.6, priceBand: 'low', label: '藥妝／實用選物' },
    value_retail: { experienceType: 'shopping', shoppingRelevance: 0.7, priceBand: 'low', label: '平價零售' },
    shopping_street: { experienceType: 'shopping', shoppingRelevance: 0.75, priceBand: 'mid', label: '商店街' },
    iconic_landmark: { experienceType: 'landmark', landmarkClass: 'core', priceBand: 'mid', label: '代表性地標', tags: ['iconic', 'must_see'] },
    culture: { experienceType: 'culture', landmarkClass: 'secondary', priceBand: 'mid', label: '文化體驗' },
    museum: { experienceType: 'museum', landmarkClass: 'secondary', priceBand: 'mid', label: '館舍' },
    representative_food: { experienceType: 'food', foodFamily: 'regional_dish', priceBand: 'mid', label: '代表地方料理' },
    viewpoint: { experienceType: 'landmark', landmarkClass: 'secondary', visualValue: 0.85, priceBand: 'mid', label: '觀景／視角' },
    modern_district: { experienceType: 'walk', landmarkClass: 'none', priceBand: 'mid-high', label: '現代街區漫遊', tags: ['modern'] },
    design_retail: { experienceType: 'shopping', shoppingRelevance: 0.9, priceBand: 'mid-high', label: '設計選物', tags: ['modern'] },
    contemporary_cafe: { experienceType: 'food', foodFamily: 'cafe', priceBand: 'mid-high', label: '當代咖啡', tags: ['modern', 'cafe'] },
    concept_store: { experienceType: 'shopping', shoppingRelevance: 0.85, priceBand: 'mid-high', label: '概念店', tags: ['modern'] },
    mixed_use: { experienceType: 'shopping', shoppingRelevance: 0.7, priceBand: 'mid-high', label: '複合商場／設施', tags: ['modern'] },
    lifestyle: { experienceType: 'shopping', shoppingRelevance: 0.7, priceBand: 'mid', label: '生活選物' },
    specialty_food: { experienceType: 'food', foodFamily: 'specialty_food', priceBand: 'mid', label: '食品專賣' },
    regional_dish: { experienceType: 'food', foodFamily: 'regional_dish', priceBand: 'mid', label: '地方名物' },
    dessert: { experienceType: 'food', foodFamily: 'dessert', priceBand: 'mid', label: '甜點' },
    cafe: { experienceType: 'food', foodFamily: 'cafe', priceBand: 'mid', label: '咖啡' },
    night_food: { experienceType: 'nightlife', foodFamily: 'night_food', priceBand: 'mid', label: '夜食' },
    depachika: { experienceType: 'food', foodFamily: 'market', priceBand: 'mid', label: '地下食品街' },
    food_hall: { experienceType: 'food', foodFamily: 'market', priceBand: 'mid', label: '美食廣場' },
    architecture: { experienceType: 'landmark', visualValue: 0.9, priceBand: 'mid', label: '建築視覺' },
    visual_landmark: { experienceType: 'landmark', landmarkClass: 'secondary', visualValue: 1, priceBand: 'mid', label: '高辨識地景' },
    photo_cafe: { experienceType: 'food', foodFamily: 'dessert', visualValue: 0.95, priceBand: 'mid-high', label: '視覺咖啡／甜點' },
    waterfront: { experienceType: 'nature', visualValue: 0.85, priceBand: 'low', label: '水岸／散步' },
    design_district: { experienceType: 'walk', shoppingRelevance: 0.6, visualValue: 0.7, priceBand: 'mid', label: '設計街區' },
    anime_retail: { experienceType: 'shopping', subcultureRelevance: 1, shoppingRelevance: 0.95, priceBand: 'low-mid', label: '動漫零售' },
    figure_shop: { experienceType: 'shopping', subcultureRelevance: 1, shoppingRelevance: 0.95, priceBand: 'low-mid', label: '模型／公仔' },
    hobby: { experienceType: 'shopping', subcultureRelevance: 0.95, shoppingRelevance: 0.9, priceBand: 'low-mid', label: 'Hobby 店' },
    secondhand_pop: { experienceType: 'shopping', subcultureRelevance: 0.9, shoppingRelevance: 0.85, priceBand: 'low', label: '二手收藏' },
    character_cafe: { experienceType: 'food', foodFamily: 'theme_cafe', subcultureRelevance: 0.85, priceBand: 'mid', label: '角色主題餐飲' },
    game_district: { experienceType: 'shopping', subcultureRelevance: 0.9, shoppingRelevance: 0.8, priceBand: 'low-mid', label: '遊戲商圈' },
    vintage: { experienceType: 'shopping', subcultureRelevance: 0.9, shoppingRelevance: 1, priceBand: 'mid', label: '古著' },
    sneakers: { experienceType: 'shopping', subcultureRelevance: 0.85, shoppingRelevance: 1, priceBand: 'mid', label: '球鞋' },
    select_shop: { experienceType: 'shopping', subcultureRelevance: 0.8, shoppingRelevance: 0.95, priceBand: 'mid', label: '買手店' },
    streetwear: { experienceType: 'shopping', subcultureRelevance: 0.9, shoppingRelevance: 1, priceBand: 'mid', label: '街頭品牌' },
    fashion_alley: { experienceType: 'shopping', subcultureRelevance: 0.85, shoppingRelevance: 0.95, priceBand: 'mid', label: '時尚巷弄' },
    record_shop: { experienceType: 'shopping', subcultureRelevance: 0.7, shoppingRelevance: 0.7, priceBand: 'mid', label: '黑膠／選物' }
  };

  function estimateDiscoveryCandidateBudget(opt) {
    opt = opt || {};
    var tripDays = Math.max(1, Number(opt.tripDays) || 5);
    var edge = opt.hasFlightEdges || opt.subtractEdgeDays ? 2 : 0;
    var fullDays =
      opt.normalFullDays != null
        ? Math.max(1, Number(opt.normalFullDays))
        : Math.max(1, tripDays - edge);
    var def = getStyleDefinition(opt.styleKey || 'sightseeing');
    var softTarget = Math.min(40, Math.max(16, 8 + fullDays * 5));
    if (def.key === 'foodie') softTarget = Math.min(40, softTarget + 4);
    if (def.key === 'trendy' || def.key === 'photospot') softTarget = Math.min(40, softTarget + 2);
    if (def.key === 'anime' || def.key === 'streetwear') softTarget = Math.min(40, softTarget + 2);
    return {
      tripDays: tripDays,
      fullDays: fullDays,
      softMin: Math.max(10, softTarget - 10),
      softTarget: softTarget,
      softMax: 40,
      districtSoft: Math.min(8, 3 + Math.ceil(fullDays / 2)),
      styleKey: def.key
    };
  }

  function buildDiscoveryIntentPrompt(destination, styleKey, opt) {
    opt = opt || {};
    styleKey = normalizeStyleKey(styleKey);
    var def = getStyleDefinition(styleKey);
    var budget = estimateDiscoveryCandidateBudget(
      Object.assign({ styleKey: styleKey }, opt)
    );
    var lines = [];
    lines.push('【DESTINATION DISCOVERY ONLY——禁止輸出完整行程時間表】');
    lines.push('目的地：' + (destination || '旅遊目的地'));
    lines.push('styleKey=' + styleKey + '｜' + ((def.labels && def.labels.zh) || styleKey));
    lines.push('選點意圖：' + def.selectionIntent);
    lines.push('優先類別：' + (def.prioritizeCategories || []).join('、'));
    lines.push('避免類別：' + (def.avoidCategories || []).join('、'));
    lines.push('街區意圖：' + def.neighborhoodIntent);
    lines.push('美食意圖：' + def.foodIntent);
    lines.push('購物意圖：' + def.shoppingIntent);
    lines.push('體驗意圖：' + def.experienceIntent);
    lines.push(
      '請只產出 JSON：districts[] 與 candidates[]（title、categories、neighborhoodHint、experienceType、landmarkClass、foodFamily?）。'
    );
    lines.push(
      '候選軟目標約 ' +
        budget.softMin +
        '–' +
        budget.softTarget +
        '（不是硬 quota）。候選不足時不要虛構不存在店名。'
    );
    lines.push('【STYLE ≠ PACE】不要因風格減少「未來行程」每日站數；本階段只找 WHAT／WHERE。');
    if (def.freshnessRequirement === 'preferred') {
      lines.push(
        'Freshness：無 live 驗證時 freshnessConfidence=unknown；不得輸出 verified current trending 用語；定位為 ' +
          (def.freshnessFallbackLabel || 'Contemporary') +
          '。'
      );
    }
    if (opt.customWishes) {
      lines.push('使用者許願（優先）：' + String(opt.customWishes).slice(0, 500));
    }
    return lines.join('\n');
  }

  function categoryMeta(cat) {
    return CATEGORY_ARCHETYPE_META[cat] || {
      experienceType: 'attraction',
      landmarkClass: 'none',
      priceBand: 'mid',
      label: cat
    };
  }

  function normalizeAnchorToCandidate(anchor, destinationKey, idx) {
    var name = (anchor && (anchor.name || anchor.title)) || '';
    if (!name) return null;
    var cat = String((anchor && anchor.category) || 'landmark');
    var isCore = (anchor && anchor.tier) === 'ANCHOR' || cat === 'landmark';
    return createCandidate({
      id: 'anchor_' + idx + '_' + name.slice(0, 12),
      title: name,
      destinationKey: destinationKey,
      categories: isCore
        ? ['iconic_landmark', cat === 'landmark' ? 'must_see' : cat]
        : [cat],
      neighborhoodHint: (anchor && (anchor.districtId || anchor.district)) || '',
      experienceType: cat === 'food' ? 'food' : 'landmark',
      landmarkClass: isCore ? 'core' : 'secondary',
      priceBand: 'mid',
      discoverySource: anchor && anchor.curated ? 'curated_optional' : 'intel_anchor',
      candidateKind: 'anchor',
      freshnessConfidence: 'unknown',
      openStatus: 'unknown',
      validationState: 'none',
      tags: isCore ? ['iconic'] : [],
      notesForGemini: 'destination intelligence anchor'
    });
  }

  function buildStyleArchetypeCandidate(destinationKey, district, category, idx, styleKey) {
    var meta = categoryMeta(category);
    var dName = (district && district.name) || '核心區';
    return createCandidate({
      id: 'arch_' + styleKey + '_' + (district && district.id ? district.id : 'd') + '_' + category + '_' + idx,
      title: dName + '｜' + meta.label + '（風格意圖槽位）',
      destinationKey: destinationKey,
      categories: [category].concat(meta.tags || []),
      neighborhoodHint: dName,
      experienceType: meta.experienceType || 'attraction',
      priceBand: meta.priceBand || 'mid',
      landmarkClass: meta.landmarkClass || 'none',
      geoHint: district && district.center ? { districtId: district.id, center: district.center } : { districtId: district && district.id },
      discoverySource: 'style_archetype',
      candidateKind: 'archetype',
      freshnessConfidence: 'unknown',
      openStatus: 'unknown',
      validationState: 'none',
      foodFamily: meta.foodFamily || '',
      visualValue: meta.visualValue != null ? meta.visualValue : null,
      subcultureRelevance: meta.subcultureRelevance != null ? meta.subcultureRelevance : null,
      shoppingRelevance: meta.shoppingRelevance != null ? meta.shoppingRelevance : null,
      localAuthenticity: meta.foodFamily ? 0.7 : 0.55,
      tags: meta.tags || [],
      notesForGemini:
        'Style archetype slot — resolve to a real venue in ' + dName + ' matching ' + category
    });
  }

  function buildShortlistBuckets(rankedRows, districts) {
    var buckets = {
      coreLandmarks: [],
      styleSpecific: [],
      food: [],
      shopping: [],
      experiences: [],
      districts: (districts || []).map(function (d) {
        return { id: d.id, name: d.name, food: !!d.food, shopping: !!d.shopping };
      })
    };
    (rankedRows || []).forEach(function (row) {
      var c = row.candidate;
      var exp = c.experienceType || '';
      var isCore = c.landmarkClass === 'core' || isGenericMustSee(c);
      var isFood = !isCore && isFoodCandidate(c);
      var isShop =
        !isCore &&
        !isFood &&
        (exp === 'shopping' ||
          candidateHasCategory(c, [
            'shopping_street',
            'design_retail',
            'vintage',
            'anime_retail',
            'streetwear',
            'sneakers',
            'select_shop',
            'fashion_alley',
            'concept_store',
            'value_retail',
            'drugstore'
          ]));
      if (isCore) buckets.coreLandmarks.push(row);
      else if (isFood) buckets.food.push(row);
      else if (isShop) buckets.shopping.push(row);
      else if (
        exp === 'walk' ||
        exp === 'nightlife' ||
        exp === 'culture' ||
        exp === 'nature' ||
        exp === 'museum'
      ) {
        buckets.experiences.push(row);
      } else {
        buckets.styleSpecific.push(row);
      }
    });
    return buckets;
  }

  function recordDiscoveryDebug(result) {
    if (typeof global === 'undefined') return result;
    global.__SOARVIBE_DISCOVERY_DEBUG__ = global.__SOARVIBE_DISCOVERY_DEBUG__ || { runs: [] };
    var summary = {
      destination: result.destinationKey,
      style: result.styleKey,
      sourceMode: result.sourceMode,
      candidateCount: (result.candidates || []).length,
      districtCount: (result.districts || []).length,
      freshnessConfidence: result.freshnessConfidence,
      discoveryConfidence: result.discoveryConfidence,
      topAffinity: (result.ranked || []).slice(0, 5).map(function (r) {
        return {
          id: r.candidate.id,
          title: r.candidate.title,
          score: r.affinity.score
        };
      }),
      coreCount: result.shortlist && result.shortlist.coreLandmarks
        ? result.shortlist.coreLandmarks.length
        : 0,
      foodCount: result.shortlist && result.shortlist.food ? result.shortlist.food.length : 0,
      warnings: result.warnings || [],
      at: Date.now()
    };
    global.__SOARVIBE_DISCOVERY_DEBUG__.runs.push(summary);
    if (global.__SOARVIBE_DISCOVERY_DEBUG__.runs.length > 30) {
      global.__SOARVIBE_DISCOVERY_DEBUG__.runs.splice(0, global.__SOARVIBE_DISCOVERY_DEBUG__.runs.length - 30);
    }
    global.__SOARVIBE_DISCOVERY_DEBUG__.last = summary;
    if (typeof console !== 'undefined' && console.info) {
      console.info('[SOARVIBE][Discovery]', summary);
    }
    return result;
  }

  /**
   * Destination Discovery — WHAT/WHERE only.
   * No Places / Grounding / Web Search in Phase 2.
   * Does NOT build day schedules or HH:MM.
   *
   * @param {string} destination
   * @param {string} styleKey
   * @param {object} opt seedCandidates[], tripDays, normalFullDays, customWishes,
   *                 skipCuratedBoost, maxArchetypesPerDistrict, disableArchetypes
   */
  function discoverDestinationCandidates(destination, styleKey, opt) {
    opt = opt || {};
    styleKey = normalizeStyleKey(styleKey);
    var def = getStyleDefinition(styleKey);
    var destinationKey = String(destination || '').trim() || '旅遊目的地';
    var warnings = [];
    var budget = estimateDiscoveryCandidateBudget(
      Object.assign({ styleKey: styleKey }, opt)
    );
    var di = global.SOARVIBE_DESTINATION_INTELLIGENCE;
    var intel = null;
    var curatedUsed = false;

    if (di && typeof di.buildDestinationIntelligence === 'function') {
      try {
        intel = di.buildDestinationIntelligence(destinationKey, {
          travelStyle: styleKey,
          tripDays: budget.tripDays,
          dateStart: opt.dateStart,
          customWishes: opt.customWishes || ''
        }, {
          skipCache: !!opt.skipCache,
          // Phase 2: never pass Places; optional geminiDistricts/pois only if caller injects
          geminiDistricts: opt.geminiDistricts || null,
          pois: opt.pois || null
        });
        curatedUsed = !!(intel && intel.curatedEnhancement);
        if (opt.skipCuratedBoost && curatedUsed) {
          warnings.push('curated_present_but_skip_requested');
          curatedUsed = false;
          // Keep districts/anchors only if not curated-only; drop curated anchors below
        }
      } catch (eIntel) {
        warnings.push('destination_intelligence_failed');
        intel = null;
      }
    } else {
      warnings.push('destination_intelligence_unavailable');
    }

    var districts =
      (intel && intel.districts && intel.districts.length
        ? intel.districts
        : [
            {
              id: 'core',
              name: destinationKey + '核心區',
              food: true,
              shopping: true,
              synthetic: true
            }
          ]
      ).slice(0, budget.districtSoft + 2);

    var candidates = [];
    var sourceParts = [];

    if (Array.isArray(opt.seedCandidates) && opt.seedCandidates.length) {
      opt.seedCandidates.forEach(function (raw, i) {
        var src =
          raw.discoverySource && raw.discoverySource !== 'synthetic'
            ? raw.discoverySource
            : 'seed';
        var c = createCandidate(
          Object.assign({}, raw, {
            destinationKey: raw.destinationKey || destinationKey,
            discoverySource: src,
            freshnessConfidence: raw.freshnessConfidence || 'unknown'
          })
        );
        if (!c.id) c.id = 'seed_' + i;
        candidates.push(c);
      });
      sourceParts.push('seed');
    }

    if (intel && intel.anchors && intel.anchors.length) {
      var anchorSlice = intel.anchors.slice(0, 12);
      if (opt.skipCuratedBoost) {
        anchorSlice = anchorSlice.filter(function (a) {
          return !(a && a.curated);
        });
      }
      anchorSlice.forEach(function (a, i) {
        var c = normalizeAnchorToCandidate(a, destinationKey, i);
        if (c) candidates.push(c);
      });
      if (anchorSlice.length) sourceParts.push(curatedUsed ? 'curated_optional' : 'intel_anchor');
    }

    var allowArchetypes = opt.disableArchetypes !== true;
    var maxPerDistrict =
      typeof opt.maxArchetypesPerDistrict === 'number' ? opt.maxArchetypesPerDistrict : 3;
    if (allowArchetypes) {
      var pri = (def.prioritizeCategories || []).slice(0, 8);
      var di2;
      var ci;
      for (di2 = 0; di2 < districts.length; di2++) {
        var district = districts[di2];
        var added = 0;
        for (ci = 0; ci < pri.length && added < maxPerDistrict; ci++) {
          // Prefer food cats on food districts, shopping on shopping districts
          var cat = pri[ci];
          var meta = categoryMeta(cat);
          if (meta.experienceType === 'food' && district.food === false && districts.length > 2) {
            continue;
          }
          candidates.push(
            buildStyleArchetypeCandidate(destinationKey, district, cat, added, styleKey)
          );
          added++;
        }
      }
      sourceParts.push('style_archetype');
    }

    // Deduplicate by title+neighborhood
    var seenKey = {};
    candidates = candidates.filter(function (c) {
      var k = String(c.title || '').toLowerCase() + '|' + String(c.neighborhoodHint || '');
      if (!k || seenKey[k]) return false;
      seenKey[k] = true;
      return true;
    });

    // Soft trim to softMax — prefer higher affinity later; here just cap archetypes if huge
    if (candidates.length > budget.softMax) {
      candidates = candidates.slice(0, budget.softMax);
      warnings.push('trimmed_to_soft_max');
    }

    var discoveryConfidence = 'medium';
    if (candidates.length < budget.softMin) {
      discoveryConfidence = 'low';
      warnings.push('low_candidate_supply');
      // Adjacent intent: add a few sightseeing-adjacent archetypes without inventing venue names
      if (allowArchetypes && styleKey !== 'sightseeing') {
        var adj = ['iconic_landmark', 'shopping_street', 'representative_food'];
        adj.forEach(function (cat, i) {
          if (candidates.length >= budget.softMin) return;
          candidates.push(
            buildStyleArchetypeCandidate(
              destinationKey,
              districts[0] || { id: 'core', name: destinationKey + '核心區' },
              cat,
              100 + i,
              styleKey
            )
          );
        });
        warnings.push('adjacent_intent_soft_fill');
      }
      // Still do NOT invent named restaurants / viral shops
    } else if (candidates.length >= budget.softTarget * 0.85) {
      discoveryConfidence = 'high';
    }

    // Phase 2: no Search Grounding → never claim current trending
    var freshnessConfidence = 'unknown';
    if (styleKey === 'trendy' || styleKey === 'photospot') {
      freshnessConfidence = 'low';
      warnings.push('freshness_unverified_model_or_archetype');
    }

    var sourceMode = sourceParts.length
      ? sourceParts.indexOf('seed') !== -1 && sourceParts.length === 1
        ? 'seed'
        : sourceParts.join('+')
      : 'empty';
    if (sourceMode.indexOf('style_archetype') !== -1 && sourceMode.indexOf('seed') === -1) {
      sourceMode = curatedUsed ? 'intel_archetype+curated_optional' : 'intel_archetype';
    }
    // Honest model-knowledge labeling when no external retrieval
    if (sourceMode.indexOf('seed') === -1) {
      sourceMode = sourceMode === 'empty' ? 'model_knowledge' : sourceMode + '|model_knowledge';
    }

    var ranked = rankCandidatesForStyle(candidates, styleKey);
    var mix = planCoreStyleMix(candidates, styleKey);
    var shortlist = buildShortlistBuckets(ranked, districts);
    // Attach mix slices for callers
    shortlist.coreFromPolicy = mix.core;
    shortlist.styleSpecificFromPolicy = mix.styleSpecific;
    shortlist.coreShareSoft = mix.coreShareSoft;
    shortlist.supplyScale = mix.supplyScale;

    var result = {
      destinationKey: destinationKey,
      styleKey: styleKey,
      districts: districts.map(function (d) {
        return {
          id: d.id,
          name: d.name,
          food: !!d.food,
          shopping: !!d.shopping,
          nightlife: !!d.nightlife,
          synthetic: !!d.synthetic,
          fromGemini: !!d.fromGemini
        };
      }),
      candidates: candidates,
      ranked: ranked,
      shortlist: shortlist,
      mix: mix,
      discoveryConfidence: discoveryConfidence,
      freshnessConfidence: freshnessConfidence,
      freshnessFallbackLabel:
        def.freshnessRequirement === 'preferred'
          ? def.freshnessFallbackLabel || 'Contemporary / Trend-oriented'
          : '',
      sourceMode: sourceMode,
      budget: budget,
      curatedEnhancementUsed: curatedUsed && !opt.skipCuratedBoost,
      unknownDestination: !!(intel && intel.unknownDestination),
      cityScale: (intel && intel.cityScale) || 'medium',
      intentPrompt: buildDiscoveryIntentPrompt(destinationKey, styleKey, opt),
      warnings: warnings,
      // Explicit: Phase 2 does not schedule
      schedulesDays: null,
      placesCalled: false,
      groundingCalled: false
    };

    return recordDiscoveryDebug(result);
  }

  /* ========== Phase 3: Candidate-bound itinerary helpers ========== */

  var _tripDiscoveryCache = Object.create(null);

  function tripDiscoveryCacheKey(payload) {
    payload = payload || {};
    return [
      String(payload.destination || '').trim(),
      normalizeStyleKey(payload.travelStyle || payload.styleKey || 'sightseeing'),
      String(payload.dateStart || ''),
      String(payload.dateEnd || ''),
      String(payload.customWishes || '').slice(0, 120)
    ].join('|');
  }

  function clearTripDiscoveryCache() {
    _tripDiscoveryCache = Object.create(null);
    if (typeof global !== 'undefined') {
      global.__SOARVIBE_TRIP_DISCOVERY__ = null;
    }
  }

  function getTripDiscoveryCache(payload) {
    var key = tripDiscoveryCacheKey(payload);
    if (_tripDiscoveryCache[key]) return _tripDiscoveryCache[key];
    if (payload && payload.__soarvibeDiscovery) return payload.__soarvibeDiscovery;
    if (typeof global !== 'undefined' && global.__SOARVIBE_TRIP_DISCOVERY__ &&
        global.__SOARVIBE_TRIP_DISCOVERY__.__cacheKey === key) {
      return global.__SOARVIBE_TRIP_DISCOVERY__;
    }
    return null;
  }

  /**
   * Trip-level discovery — call once per generation; days/replan reuse.
   * Session/memory only — never Firestore.
   */
  function ensureTripDiscovery(payload, opt) {
    opt = opt || {};
    payload = payload || {};
    var key = tripDiscoveryCacheKey(payload);
    var cached = getTripDiscoveryCache(payload);
    if (cached && !opt.forceRefresh) {
      cached.__fromCache = true;
      cached.__cacheKey = key;
      payload.__soarvibeDiscovery = cached;
      return cached;
    }

    var tripDays = 5;
    try {
      if (payload.dateStart && payload.dateEnd) {
        var d0 = new Date(payload.dateStart + 'T00:00:00');
        var d1 = new Date(payload.dateEnd + 'T00:00:00');
        tripDays = Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
      }
    } catch (eDays) { /* ignore */ }
    if (opt.tripDays) tripDays = opt.tripDays;

    var hasFlight =
      !!(payload.flightArrival || payload.arrivalTime || payload.flightReturn || payload.returnTime);
    var styleKey = payload.travelStyle || payload.styleKey || 'sightseeing';
    var discovery = discoverDestinationCandidates(payload.destination || '', styleKey, {
      tripDays: tripDays,
      hasFlightEdges: hasFlight,
      customWishes: payload.customWishes || '',
      dateStart: payload.dateStart,
      seedCandidates: opt.seedCandidates || null,
      skipCuratedBoost: !!opt.skipCuratedBoost,
      disableArchetypes: !!opt.disableArchetypes,
      maxArchetypesPerDistrict: opt.maxArchetypesPerDistrict
    });
    discovery.__fromCache = false;
    discovery.__cacheKey = key;
    discovery.__createdAt = Date.now();
    _tripDiscoveryCache[key] = discovery;
    payload.__soarvibeDiscovery = discovery;
    if (typeof global !== 'undefined') {
      global.__SOARVIBE_TRIP_DISCOVERY__ = discovery;
    }
    return discovery;
  }

  function archetypeSemanticLabel(c) {
    var t = String((c && c.title) || '');
    t = t.replace(/（風格意圖槽位）/g, '').replace(/風格意圖槽位/g, '').trim();
    var parts = t.split('｜');
    if (parts.length >= 2) return parts.slice(1).join('｜').trim() || t;
    return t || ((c.categories && c.categories[0]) || 'style experience');
  }

  function candidatePromptLine(c, kind) {
    kind = kind || inferCandidateKind(c);
    var district = c.neighborhoodHint || (c.geoHint && c.geoHint.districtId) || '';
    if (kind === 'archetype') {
      return (
        '- [SEMANTIC SLOT｜非店名] ' +
        archetypeSemanticLabel(c) +
        (district ? ' ＠' + district : '') +
        ' → 請在同／鄰近 district 找真實存在的實例；禁止把此槽位字串當 title'
      );
    }
    return (
      '- [' +
      (kind === 'anchor' ? 'ANCHOR' : 'APPROVED') +
      '] ' +
      String(c.title || '') +
      (district ? ' ＠' + district : '') +
      (c.categories && c.categories.length ? ' ｜' + c.categories.slice(0, 3).join(',') : '')
    );
  }

  function rowCandidate(row) {
    return row && (row.candidate || row);
  }

  function districtNameOf(c) {
    if (!c) return '';
    return String(c.neighborhoodHint || (c.geoHint && (c.geoHint.districtId || c.geoHint.district)) || '').trim();
  }

  function districtsAdjacent(districts, primaryIdx) {
    districts = districts || [];
    if (!districts.length) return { primary: null, adjacent: null };
    var p = districts[primaryIdx % districts.length];
    var a = districts.length > 1 ? districts[(primaryIdx + 1) % districts.length] : null;
    return { primary: p, adjacent: a };
  }

  function candidateInDayDistricts(c, primary, adjacent) {
    var n = districtNameOf(c).toLowerCase();
    if (!primary) return true;
    var pName = String(primary.name || primary.id || '').toLowerCase();
    var pId = String(primary.id || '').toLowerCase();
    if (n && (n.indexOf(pName) !== -1 || n.indexOf(pId) !== -1 || pName.indexOf(n) !== -1)) return true;
    if (adjacent) {
      var aName = String(adjacent.name || adjacent.id || '').toLowerCase();
      var aId = String(adjacent.id || '').toLowerCase();
      if (n && (n.indexOf(aName) !== -1 || n.indexOf(aId) !== -1 || aName.indexOf(n) !== -1)) return true;
    }
    // No neighborhood → allow as soft fallback (still style-ranked)
    if (!n) return true;
    return false;
  }

  function takeBucketRows(rows, limit, primary, adjacent, preferDistrict) {
    rows = rows || [];
    var matched = [];
    var rest = [];
    rows.forEach(function (row) {
      var c = rowCandidate(row);
      if (preferDistrict && !candidateInDayDistricts(c, primary, adjacent)) rest.push(row);
      else matched.push(row);
    });
    var out = matched.concat(rest);
    return out.slice(0, limit);
  }

  /**
   * Light geographic day slice — 1 primary district (+ optional adjacent).
   * Does not invent POIs; prefers shortlist rows near day's districts.
   */
  function selectDayCandidateSlice(discovery, dayNum, totalDays, opt) {
    opt = opt || {};
    discovery = discovery || {};
    var shortlist = discovery.shortlist || {};
    var districts = discovery.districts || shortlist.districts || [];
    var dayIndex = Math.max(0, (Number(dayNum) || 1) - 1);
    var pair = districtsAdjacent(districts, dayIndex);
    var lowSupply =
      discovery.discoveryConfidence === 'low' ||
      (discovery.candidates && discovery.candidates.length < 12);

    var coreLim = lowSupply ? 4 : 3;
    var styleLim = lowSupply ? 5 : 6;
    var foodLim = lowSupply ? 4 : 5;
    var shopLim = 3;
    var expLim = 3;

    var core = takeBucketRows(shortlist.coreLandmarks || shortlist.coreFromPolicy, coreLim, pair.primary, pair.adjacent, true);
    var styleSpecific = takeBucketRows(
      shortlist.styleSpecific || shortlist.styleSpecificFromPolicy,
      styleLim,
      pair.primary,
      pair.adjacent,
      true
    );
    var food = takeBucketRows(shortlist.food, foodLim, pair.primary, pair.adjacent, true);
    var shopping = takeBucketRows(shortlist.shopping, shopLim, pair.primary, pair.adjacent, true);
    var experiences = takeBucketRows(shortlist.experiences, expLim, pair.primary, pair.adjacent, true);

    // Adaptive: low discovery → allow more core from mix policy
    if (lowSupply && discovery.mix && discovery.mix.core) {
      discovery.mix.core.slice(0, 2).forEach(function (row) {
        if (core.length >= coreLim + 2) return;
        var id = rowCandidate(row).id;
        if (core.some(function (r) { return rowCandidate(r).id === id; })) return;
        core.push(row);
      });
    }

    function flattenApproved(rows) {
      return (rows || [])
        .map(rowCandidate)
        .filter(function (c) {
          return c && inferCandidateKind(c) !== 'archetype';
        });
    }
    function flattenArchetypes(rows) {
      return (rows || [])
        .map(rowCandidate)
        .filter(function (c) {
          return c && inferCandidateKind(c) === 'archetype';
        });
    }

    var allRows = core.concat(styleSpecific, food, shopping, experiences);
    var approved = flattenApproved(allRows);
    var archetypes = flattenArchetypes(allRows);

    return {
      dayNumber: Number(dayNum) || 1,
      totalDays: Number(totalDays) || 1,
      primaryDistrict: pair.primary,
      adjacentDistrict: pair.adjacent,
      core: core,
      styleSpecific: styleSpecific,
      food: food,
      shopping: shopping,
      experiences: experiences,
      approvedCandidates: approved,
      archetypeSlots: archetypes,
      approvedCount: approved.length,
      archetypeCount: archetypes.length,
      shortlistSufficient: approved.length >= 4,
      lowSupply: lowSupply,
      styleKey: discovery.styleKey,
      freshnessConfidence: discovery.freshnessConfidence,
      discoveryConfidence: discovery.discoveryConfidence
    };
  }

  function formatBucketLines(rows, emptyLabel) {
    if (!rows || !rows.length) return '- （本區暫無；允許 provisional nearby，須符合 style）\n';
    return rows
      .map(function (row) {
        var c = rowCandidate(row);
        return candidatePromptLine(c, inferCandidateKind(c));
      })
      .join('\n') + '\n';
  }

  /**
   * Candidate-bound prompt block for one day (or full-trip overview when dayNum omitted).
   */
  function buildCandidateBoundDayPrompt(discovery, opt) {
    opt = opt || {};
    if (!discovery) {
      return '【CANDIDATE-BOUND】Discovery 不可用——請依 StyleDefinition 選點，禁止 generic Top10 罐頭。\n';
    }
    var def = getStyleDefinition(discovery.styleKey || opt.styleKey || 'sightseeing');
    var dayNum = opt.dayNum;
    var totalDays = opt.totalDays || 1;
    var slice =
      dayNum != null
        ? selectDayCandidateSlice(discovery, dayNum, totalDays, opt)
        : null;

    var lines = [];
    lines.push('【🎯 CANDIDATE-BOUND ITINERARY——推薦候選，不是全部必塞】');
    lines.push('優先級：USER HARD → FLIGHT HARD → PHYSICAL FEASIBILITY → STYLE SELECTION → ROUTE → PACE → DAY COMPLETENESS');
    lines.push('STYLE = WHAT／WHERE；PACE／每天站數由 DAY COMPLETENESS 決定——禁止用風格減少站數。');
    lines.push('選點意圖：' + def.selectionIntent);
    lines.push('優先：' + (def.prioritizeCategories || []).join('、'));
    lines.push('避免：' + (def.avoidCategories || []).join('、'));
    lines.push('街區：' + def.neighborhoodIntent);
    lines.push('美食：' + def.foodIntent);
    lines.push('體驗：' + def.experienceIntent);
    if (def.freshnessRequirement === 'preferred') {
      lines.push(
        'Freshness=' +
          (discovery.freshnessConfidence || 'unknown') +
          ' → 僅允許 ' +
          (def.freshnessFallbackLabel || 'Contemporary / Trend-oriented') +
          '；禁止 current hottest／recently viral／現在爆紅宣稱。'
      );
    }
    lines.push('');
    lines.push('【使用規則】');
    lines.push('1. 正常全日 meaningful POI 約 70–85% 應來自 APPROVED／ANCHOR shortlist。');
    lines.push('2. 其餘可為 provisional／nearby complementary（同 destination、同／鄰近 district、符合 style、不違反 avoid、不跨區折返）。');
    lines.push('3. SEMANTIC SLOT 只描述類型——必須換成真實店名／景點名；禁止把槽位文字當 title。');
    lines.push('4. 禁止完全無視 shortlist 重產 generic Top10。');
    lines.push('5. 餐飲必須參考 FOOD 清單＋ foodIntent；禁止所有風格都「早餐咖啡＋午餐名物＋晚餐燒肉」。');
    lines.push('');

    if (slice) {
      lines.push(
        '【本日地理焦點】主 district：' +
          ((slice.primaryDistrict && slice.primaryDistrict.name) || '核心區') +
          (slice.adjacentDistrict
            ? '；必要時鄰近：' + (slice.adjacentDistrict.name || '')
            : '') +
          '。避免上午東區、下午西區、晚上又回東區。'
      );
      lines.push('');
      lines.push('【CORE LANDMARKS】');
      lines.push(formatBucketLines(slice.core));
      lines.push('【STYLE-SPECIFIC】');
      lines.push(formatBucketLines(slice.styleSpecific));
      lines.push('【FOOD】');
      lines.push(formatBucketLines(slice.food));
      lines.push('【SHOPPING】');
      lines.push(formatBucketLines(slice.shopping));
      lines.push('【EXPERIENCES】');
      lines.push(formatBucketLines(slice.experiences));
      if (slice.archetypeSlots && slice.archetypeSlots.length) {
        lines.push('【SEMANTIC SLOTS（非真實 POI）】');
        slice.archetypeSlots.forEach(function (c) {
          lines.push(candidatePromptLine(c, 'archetype'));
        });
        lines.push('');
      }
      if (!slice.shortlistSufficient) {
        lines.push(
          '【FALLBACK】approved shortlist 偏少（discoveryConfidence=' +
            (discovery.discoveryConfidence || '?') +
            '）→ 可用 archetype slots＋少量 provisional nearby；禁止大量虛構店名。'
        );
      }
    } else {
      var sl = discovery.shortlist || {};
      lines.push('【DISTRICTS】');
      (discovery.districts || sl.districts || []).slice(0, 8).forEach(function (d) {
        lines.push('- ' + (d.name || d.id));
      });
      lines.push('');
      lines.push('【CORE LANDMARKS】');
      lines.push(formatBucketLines((sl.coreLandmarks || sl.coreFromPolicy || []).slice(0, 8)));
      lines.push('【STYLE-SPECIFIC】');
      lines.push(formatBucketLines((sl.styleSpecific || []).slice(0, 10)));
      lines.push('【FOOD】');
      lines.push(formatBucketLines((sl.food || []).slice(0, 8)));
      lines.push('【SHOPPING】');
      lines.push(formatBucketLines((sl.shopping || []).slice(0, 6)));
      lines.push('【EXPERIENCES】');
      lines.push(formatBucketLines((sl.experiences || []).slice(0, 6)));
    }

    return lines.join('\n');
  }

  function normalizeTitleKey(t) {
    return String(t || '')
      .toLowerCase()
      .replace(/（風格意圖槽位）/g, '')
      .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, '');
  }

  function extractDayTitles(dayObj) {
    var titles = [];
    (dayObj && dayObj.phases ? dayObj.phases : []).forEach(function (phase) {
      (phase.items || []).forEach(function (item) {
        var t =
          (item && (item.title || item.name)) ||
          (typeof item === 'string' ? item : '');
        if (!t) return;
        if (/機場|航班|入境|送機|報到|返回.*休息|check-?in/i.test(t)) return;
        titles.push(String(t));
      });
    });
    return titles;
  }

  function titleMatchesApproved(title, approved) {
    var key = normalizeTitleKey(title);
    if (!key || key.length < 2) return false;
    var i;
    for (i = 0; i < (approved || []).length; i++) {
      var a = normalizeTitleKey(approved[i].title);
      if (!a) continue;
      if (key === a || key.indexOf(a) !== -1 || a.indexOf(key) !== -1) return true;
      // Token overlap for compound titles
      if (a.length >= 4 && key.indexOf(a.slice(0, Math.min(6, a.length))) !== -1) return true;
    }
    return false;
  }

  function titleLooksLikeArchetypeLeak(title) {
    return /風格意圖槽位|SEMANTIC SLOT|semantic slot/i.test(String(title || ''));
  }

  /**
   * Flag-only candidate usage QA. No auto full-trip retry.
   */
  function evaluateCandidateUsageQa(dayObj, daySlice, opt) {
    opt = opt || {};
    daySlice = daySlice || {};
    var titles = extractDayTitles(dayObj);
    var approved = daySlice.approvedCandidates || [];
    var archetypes = daySlice.archetypeSlots || [];
    var issues = [];
    var usedApproved = [];
    var provisional = [];
    var archetypeLeaks = [];

    titles.forEach(function (t) {
      if (titleLooksLikeArchetypeLeak(t)) {
        archetypeLeaks.push(t);
        issues.push({ type: 'archetype_title_leak', title: t });
        return;
      }
      if (titleMatchesApproved(t, approved)) usedApproved.push(t);
      else provisional.push(t);
    });

    var meaningful = titles.length;
    var ratio = meaningful ? usedApproved.length / meaningful : 1;
    var sufficient = daySlice.shortlistSufficient !== false && approved.length >= 4;
    var threshold = typeof opt.threshold === 'number' ? opt.threshold : 0.6;
    var violation = false;

    if (sufficient && meaningful >= 3 && ratio < threshold) {
      violation = true;
      issues.push({
        type: 'candidate_bound_violation',
        message:
          'candidateUsageRatio=' +
          ratio.toFixed(2) +
          ' < ' +
          threshold +
          ' with sufficient shortlist'
      });
    }

    if (
      daySlice.freshnessConfidence === 'low' ||
      daySlice.freshnessConfidence === 'unknown'
    ) {
      titles.forEach(function (t) {
        if (/現在爆紅|current hottest|recently viral|最新開幕必去/i.test(t)) {
          issues.push({ type: 'freshness_claim_forbidden', title: t });
        }
      });
    }

    return {
      dayNumber: daySlice.dayNumber,
      styleKey: daySlice.styleKey,
      meaningfulCount: meaningful,
      approvedCandidateCount: approved.length,
      approvedTitlesUsed: usedApproved,
      provisionalTitlesUsed: provisional,
      archetypeSlotsUsed: archetypes.map(archetypeSemanticLabel),
      archetypeTitleLeaks: archetypeLeaks,
      coreCount: (daySlice.core || []).length,
      styleSpecificCount: (daySlice.styleSpecific || []).length,
      foodCount: (daySlice.food || []).length,
      districtsUsed: [
        daySlice.primaryDistrict && daySlice.primaryDistrict.name,
        daySlice.adjacentDistrict && daySlice.adjacentDistrict.name
      ].filter(Boolean),
      candidateUsageRatio: Math.round(ratio * 1000) / 1000,
      shortlistSufficient: sufficient,
      candidate_bound_violation: violation,
      issues: issues,
      warnings: violation ? ['candidate_bound_violation'] : []
    };
  }

  function recordCandidateBoundDebug(entry) {
    if (typeof global === 'undefined') return entry;
    global.__SOARVIBE_CANDIDATE_BOUND_DEBUG__ =
      global.__SOARVIBE_CANDIDATE_BOUND_DEBUG__ || { runs: [] };
    var summary = {
      dayNumber: entry.dayNumber,
      style: entry.styleKey || entry.style,
      approvedCandidateCount: entry.approvedCandidateCount,
      approvedTitlesUsed: entry.approvedTitlesUsed || [],
      provisionalTitlesUsed: entry.provisionalTitlesUsed || [],
      archetypeSlotsUsed: entry.archetypeSlotsUsed || [],
      coreCount: entry.coreCount,
      styleSpecificCount: entry.styleSpecificCount,
      foodCount: entry.foodCount,
      districtsUsed: entry.districtsUsed || [],
      candidateUsageRatio: entry.candidateUsageRatio,
      warnings: entry.warnings || entry.issues || [],
      at: Date.now()
    };
    global.__SOARVIBE_CANDIDATE_BOUND_DEBUG__.runs.push(summary);
    if (global.__SOARVIBE_CANDIDATE_BOUND_DEBUG__.runs.length > 40) {
      global.__SOARVIBE_CANDIDATE_BOUND_DEBUG__.runs.splice(
        0,
        global.__SOARVIBE_CANDIDATE_BOUND_DEBUG__.runs.length - 40
      );
    }
    global.__SOARVIBE_CANDIDATE_BOUND_DEBUG__.last = summary;
    if (typeof console !== 'undefined' && console.info) {
      console.info('[SOARVIBE][Candidate-bound Day]', summary);
    }
    return entry;
  }

  /** Phase 4 hook hint */
  var PHASE4_GROUNDING_VALIDATION_ENTRY =
    'After discoverDestinationCandidates / before or after Gemini day gen: optional Search Grounding refresh for trendy freshness; selective Places validate on shortlist titles only — never discovery-from-Places.';

  var api = {
    version: '1.5-candidate-bound',
    STYLE_KEYS: STYLE_KEYS,
    STYLE_LABELS: STYLE_LABELS,
    STYLE_DEFINITIONS: STYLE_DEFINITIONS,
    STYLE_PROFILES: STYLE_PROFILES,
    ACTIVITY_DURATION_HINTS: ACTIVITY_DURATION_HINTS,
    QUALITY_WEIGHTS: QUALITY_WEIGHTS,
    STYLE_CATALOGS: STYLE_CATALOGS,
    normalizeStyleKey: normalizeStyleKey,
    getStyleDefinition: getStyleDefinition,
    getStyleLabel: getStyleLabel,
    getProfile: getProfile,
    applyStyleEngine: applyStyleEngine,
    computeStyleQualityScore: computeStyleQualityScore,
    evaluateExpectedVsActual: evaluateExpectedVsActual,
    summarizeHumanReadable: summarizeHumanReadable,
    buildNeutralFixture: buildNeutralFixture,
    buildGeminiSimulatedFixture: buildGeminiSimulatedFixture,
    buildRepeatLandmarkFixture: buildRepeatLandmarkFixture,
    overlapTitles: overlapTitles,
    promptCleanupList: promptCleanupList,
    buildPlanningIntentPrompt: buildPlanningIntentPrompt,
    buildStyleInstructionPrompt: buildStyleInstructionPrompt,
    createCandidate: createCandidate,
    inferCandidateKind: inferCandidateKind,
    scoreStyleAffinity: scoreStyleAffinity,
    scoreFoodAffinity: scoreFoodAffinity,
    rankCandidatesForStyle: rankCandidatesForStyle,
    inferCandidateSupplyScale: inferCandidateSupplyScale,
    getCoreLandmarkSoftShare: getCoreLandmarkSoftShare,
    planCoreStyleMix: planCoreStyleMix,
    parseUserRequests: parseUserRequests,
    markUserRequestedItems: markUserRequestedItems,
    sanitizeItineraryForRender: sanitizeItineraryForRender,
    sanitizeUserFacingText: sanitizeUserFacingText,
    classifyExperience: classifyExperience,
    isFillerTitle: isFillerTitle,
    canCreateContent: false,
    PHASE3_CANDIDATE_BOUND_ENTRY:
      'index.html fetchGeminiItineraryDayByDay / buildGeminiSingleDayRequestText ← ensureTripDiscovery + buildCandidateBoundDayPrompt',
    PHASE4_GROUNDING_VALIDATION_ENTRY: PHASE4_GROUNDING_VALIDATION_ENTRY,
    estimateDiscoveryCandidateBudget: estimateDiscoveryCandidateBudget,
    buildDiscoveryIntentPrompt: buildDiscoveryIntentPrompt,
    discoverDestinationCandidates: discoverDestinationCandidates,
    buildShortlistBuckets: buildShortlistBuckets,
    recordDiscoveryDebug: recordDiscoveryDebug,
    ensureTripDiscovery: ensureTripDiscovery,
    getTripDiscoveryCache: getTripDiscoveryCache,
    clearTripDiscoveryCache: clearTripDiscoveryCache,
    tripDiscoveryCacheKey: tripDiscoveryCacheKey,
    selectDayCandidateSlice: selectDayCandidateSlice,
    buildCandidateBoundDayPrompt: buildCandidateBoundDayPrompt,
    evaluateCandidateUsageQa: evaluateCandidateUsageQa,
    recordCandidateBoundDebug: recordCandidateBoundDebug,
    archetypeSemanticLabel: archetypeSemanticLabel
  };

  global.SOARVIBE_STYLE_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis);
