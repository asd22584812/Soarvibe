/**
 * SoarVibe Dynamic Destination Intelligence (P1.1)
 * Global builder — works for ANY destination. Curated packs are enhancements only.
 */
(function (global) {
  'use strict';

  var SESSION_CACHE = Object.create(null);
  var CACHE_SCHEMA_VERSION = 1;

  /** Optional geo seeds (center/country/scale) — NOT district packs. Unknown cities still work. */
  var GEO_SEEDS = [
    { match: /東京|tokyo/i, city: '東京', region: '關東', country: 'Japan', countryId: 'JP', lat: 35.6762, lng: 139.6503, scale: 'mega', transit: 'railHeavy' },
    { match: /大阪|osaka/i, city: '大阪', region: '關西', country: 'Japan', countryId: 'JP', lat: 34.6937, lng: 135.5023, scale: 'mega', transit: 'railHeavy' },
    { match: /京都|kyoto/i, city: '京都', region: '關西', country: 'Japan', countryId: 'JP', lat: 35.0116, lng: 135.7681, scale: 'large', transit: 'railHeavy' },
    { match: /札幌|sapporo/i, city: '札幌', region: '北海道', country: 'Japan', countryId: 'JP', lat: 43.0618, lng: 141.3545, scale: 'large', transit: 'metroHeavy' },
    { match: /小樽|otaru/i, city: '小樽', region: '北海道', country: 'Japan', countryId: 'JP', lat: 43.1907, lng: 140.9947, scale: 'compact', transit: 'walkable' },
    { match: /函館|hakodate/i, city: '函館', region: '北海道', country: 'Japan', countryId: 'JP', lat: 41.7687, lng: 140.7288, scale: 'medium', transit: 'mixed' },
    { match: /名古屋|nagoya/i, city: '名古屋', region: '中部', country: 'Japan', countryId: 'JP', lat: 35.1815, lng: 136.9066, scale: 'large', transit: 'railHeavy' },
    { match: /福岡|fukuoka/i, city: '福岡', region: '九州', country: 'Japan', countryId: 'JP', lat: 33.5904, lng: 130.4017, scale: 'large', transit: 'metroHeavy' },
    { match: /沖繩|okinawa|那霸|naha/i, city: '沖繩', region: '沖繩', country: 'Japan', countryId: 'JP', lat: 26.2124, lng: 127.6792, scale: 'medium', transit: 'carRecommended' },
    { match: /廣島|hiroshima/i, city: '廣島', region: '中國地方', country: 'Japan', countryId: 'JP', lat: 34.3853, lng: 132.4553, scale: 'medium', transit: 'mixed' },
    { match: /仙台|sendai/i, city: '仙台', region: '東北', country: 'Japan', countryId: 'JP', lat: 38.2682, lng: 140.8694, scale: 'medium', transit: 'metroHeavy' },
    { match: /金澤|kanazawa/i, city: '金澤', region: '北陸', country: 'Japan', countryId: 'JP', lat: 36.5613, lng: 136.6562, scale: 'compact', transit: 'walkable' },
    { match: /奈良|nara/i, city: '奈良', region: '關西', country: 'Japan', countryId: 'JP', lat: 34.6851, lng: 135.8048, scale: 'compact', transit: 'walkable' },
    { match: /神戶|kobe/i, city: '神戶', region: '關西', country: 'Japan', countryId: 'JP', lat: 34.6901, lng: 135.1956, scale: 'medium', transit: 'railHeavy' },
    { match: /長崎|nagasaki/i, city: '長崎', region: '九州', country: 'Japan', countryId: 'JP', lat: 32.7503, lng: 129.8777, scale: 'medium', transit: 'mixed' },
    { match: /熊本|kumamoto/i, city: '熊本', region: '九州', country: 'Japan', countryId: 'JP', lat: 32.8032, lng: 130.7079, scale: 'medium', transit: 'mixed' },
    { match: /北海道|hokkaido/i, city: null, region: '北海道', country: 'Japan', countryId: 'JP', lat: 43.06, lng: 141.35, scale: 'regional', transit: 'mixed', level: 'region' },
    { match: /首爾|seoul|서울/i, city: '首爾', region: '首都圈', country: 'Korea', countryId: 'KR', lat: 37.5665, lng: 126.978, scale: 'mega', transit: 'metroHeavy' },
    { match: /釜山|busan|부산/i, city: '釜山', region: '慶尚', country: 'Korea', countryId: 'KR', lat: 35.1796, lng: 129.0756, scale: 'large', transit: 'metroHeavy' },
    { match: /濟州|jeju|제주/i, city: '濟州', region: '濟州', country: 'Korea', countryId: 'KR', lat: 33.4996, lng: 126.5312, scale: 'medium', transit: 'carRecommended' },
    { match: /仁川|incheon/i, city: '仁川', region: '首都圈', country: 'Korea', countryId: 'KR', lat: 37.4563, lng: 126.7052, scale: 'large', transit: 'metroHeavy' },
    { match: /大邱|daegu/i, city: '大邱', region: '慶尚', country: 'Korea', countryId: 'KR', lat: 35.8714, lng: 128.6014, scale: 'large', transit: 'metroHeavy' },
    { match: /台北|taipei/i, city: '台北', region: '北部', country: 'Taiwan', countryId: 'TW', lat: 25.033, lng: 121.5654, scale: 'large', transit: 'metroHeavy' },
    { match: /台中|taichung/i, city: '台中', region: '中部', country: 'Taiwan', countryId: 'TW', lat: 24.1477, lng: 120.6736, scale: 'large', transit: 'mixed' },
    { match: /台南|tainan/i, city: '台南', region: '南部', country: 'Taiwan', countryId: 'TW', lat: 22.9997, lng: 120.227, scale: 'medium', transit: 'mixed' },
    { match: /高雄|kaohsiung/i, city: '高雄', region: '南部', country: 'Taiwan', countryId: 'TW', lat: 22.6273, lng: 120.3014, scale: 'large', transit: 'metroHeavy' },
    { match: /花蓮|hualien/i, city: '花蓮', region: '東部', country: 'Taiwan', countryId: 'TW', lat: 23.9739, lng: 121.6015, scale: 'compact', transit: 'carRecommended' },
    { match: /曼谷|bangkok/i, city: '曼谷', region: '中部', country: 'Thailand', countryId: 'TH', lat: 13.7563, lng: 100.5018, scale: 'mega', transit: 'mixed' },
    { match: /清邁|chiang\s*mai/i, city: '清邁', region: '北部', country: 'Thailand', countryId: 'TH', lat: 18.7883, lng: 98.9853, scale: 'medium', transit: 'mixed' },
    { match: /普吉|phuket/i, city: '普吉', region: '南部', country: 'Thailand', countryId: 'TH', lat: 7.8804, lng: 98.3923, scale: 'medium', transit: 'carRecommended' },
    { match: /新加坡|singapore/i, city: '新加坡', region: '新加坡', country: 'Singapore', countryId: 'SG', lat: 1.3521, lng: 103.8198, scale: 'large', transit: 'metroHeavy' },
    { match: /吉隆坡|kuala\s*lumpur|\bkl\b/i, city: '吉隆坡', region: '雪蘭莪', country: 'Malaysia', countryId: 'MY', lat: 3.139, lng: 101.6869, scale: 'large', transit: 'mixed' },
    { match: /檳城|penang/i, city: '檳城', region: '檳城', country: 'Malaysia', countryId: 'MY', lat: 5.4164, lng: 100.3327, scale: 'medium', transit: 'mixed' },
    { match: /河內|hanoi/i, city: '河內', region: '北部', country: 'Vietnam', countryId: 'VN', lat: 21.0278, lng: 105.8342, scale: 'large', transit: 'mixed' },
    { match: /胡志明|ho\s*chi\s*minh|saigon/i, city: '胡志明市', region: '南部', country: 'Vietnam', countryId: 'VN', lat: 10.8231, lng: 106.6297, scale: 'mega', transit: 'mixed' },
    { match: /峴港|da\s*nang/i, city: '峴港', region: '中部', country: 'Vietnam', countryId: 'VN', lat: 16.0544, lng: 108.2022, scale: 'medium', transit: 'mixed' },
    { match: /峇里|bali/i, city: '峇里島', region: '峇里', country: 'Indonesia', countryId: 'ID', lat: -8.4095, lng: 115.1889, scale: 'regional', transit: 'carRecommended' },
    { match: /馬尼拉|manila/i, city: '馬尼拉', region: '首都區', country: 'Philippines', countryId: 'PH', lat: 14.5995, lng: 120.9842, scale: 'mega', transit: 'mixed' },
    { match: /紐約|new\s*york|\bnyc\b/i, city: '紐約', region: '紐約州', country: 'USA', countryId: 'US', lat: 40.7128, lng: -74.006, scale: 'mega', transit: 'metroHeavy' },
    { match: /洛杉磯|los\s*angeles|\bla\b/i, city: '洛杉磯', region: '加州', country: 'USA', countryId: 'US', lat: 34.0522, lng: -118.2437, scale: 'mega', transit: 'carRecommended' },
    { match: /舊金山|san\s*francisco/i, city: '舊金山', region: '加州', country: 'USA', countryId: 'US', lat: 37.7749, lng: -122.4194, scale: 'large', transit: 'mixed' },
    { match: /拉斯維加斯|las\s*vegas/i, city: '拉斯維加斯', region: '內華達', country: 'USA', countryId: 'US', lat: 36.1699, lng: -115.1398, scale: 'large', transit: 'walkable' },
    { match: /西雅圖|seattle/i, city: '西雅圖', region: '華盛頓', country: 'USA', countryId: 'US', lat: 47.6062, lng: -122.3321, scale: 'large', transit: 'mixed' },
    { match: /芝加哥|chicago/i, city: '芝加哥', region: '伊利諾', country: 'USA', countryId: 'US', lat: 41.8781, lng: -87.6298, scale: 'mega', transit: 'metroHeavy' },
    { match: /夏威夷|hawaii|honolulu|檀香山/i, city: '夏威夷', region: '夏威夷', country: 'USA', countryId: 'US', lat: 21.3069, lng: -157.8583, scale: 'regional', transit: 'carRecommended' },
    { match: /溫哥華|vancouver/i, city: '溫哥華', region: 'BC', country: 'Canada', countryId: 'CA', lat: 49.2827, lng: -123.1207, scale: 'large', transit: 'mixed' },
    { match: /多倫多|toronto/i, city: '多倫多', region: '安大略', country: 'Canada', countryId: 'CA', lat: 43.6532, lng: -79.3832, scale: 'mega', transit: 'metroHeavy' },
    { match: /蒙特婁|montreal|montréal/i, city: '蒙特婁', region: '魁北克', country: 'Canada', countryId: 'CA', lat: 45.5017, lng: -73.5673, scale: 'large', transit: 'metroHeavy' },
    { match: /雪梨|sydney/i, city: '雪梨', region: 'NSW', country: 'Australia', countryId: 'AU', lat: -33.8688, lng: 151.2093, scale: 'mega', transit: 'mixed' },
    { match: /墨爾本|melbourne/i, city: '墨爾本', region: 'VIC', country: 'Australia', countryId: 'AU', lat: -37.8136, lng: 144.9631, scale: 'mega', transit: 'mixed' },
    { match: /布里斯本|brisbane/i, city: '布里斯本', region: 'QLD', country: 'Australia', countryId: 'AU', lat: -27.4698, lng: 153.0251, scale: 'large', transit: 'mixed' },
    { match: /黃金海岸|gold\s*coast/i, city: '黃金海岸', region: 'QLD', country: 'Australia', countryId: 'AU', lat: -28.0167, lng: 153.4, scale: 'medium', transit: 'carRecommended' },
    { match: /伯斯|perth/i, city: '伯斯', region: 'WA', country: 'Australia', countryId: 'AU', lat: -31.9505, lng: 115.8605, scale: 'large', transit: 'mixed' },
    { match: /奧克蘭|auckland/i, city: '奧克蘭', region: '北島', country: 'New Zealand', countryId: 'NZ', lat: -36.8485, lng: 174.7633, scale: 'large', transit: 'carRecommended' },
    { match: /皇后鎮|queenstown/i, city: '皇后鎮', region: '南島', country: 'New Zealand', countryId: 'NZ', lat: -45.0312, lng: 168.6626, scale: 'compact', transit: 'carRecommended' },
    { match: /基督城|christchurch/i, city: '基督城', region: '南島', country: 'New Zealand', countryId: 'NZ', lat: -43.5321, lng: 172.6362, scale: 'medium', transit: 'carRecommended' },
    { match: /倫敦|london/i, city: '倫敦', region: '英格蘭', country: 'UK', countryId: 'GB', lat: 51.5074, lng: -0.1278, scale: 'mega', transit: 'metroHeavy' },
    { match: /巴黎|paris/i, city: '巴黎', region: '法蘭西島', country: 'France', countryId: 'FR', lat: 48.8566, lng: 2.3522, scale: 'mega', transit: 'metroHeavy' },
    { match: /羅馬|rome|roma/i, city: '羅馬', region: '拉齊奧', country: 'Italy', countryId: 'IT', lat: 41.9028, lng: 12.4964, scale: 'mega', transit: 'metroHeavy' },
    { match: /米蘭|milan|milano/i, city: '米蘭', region: '倫巴第', country: 'Italy', countryId: 'IT', lat: 45.4642, lng: 9.19, scale: 'large', transit: 'metroHeavy' },
    { match: /威尼斯|venice|venezia/i, city: '威尼斯', region: '威尼托', country: 'Italy', countryId: 'IT', lat: 45.4408, lng: 12.3155, scale: 'compact', transit: 'walkable' },
    { match: /佛羅倫斯|florence|firenze/i, city: '佛羅倫斯', region: '托斯卡納', country: 'Italy', countryId: 'IT', lat: 43.7696, lng: 11.2558, scale: 'medium', transit: 'walkable' },
    { match: /巴塞隆納|barcelona/i, city: '巴塞隆納', region: '加泰隆尼亞', country: 'Spain', countryId: 'ES', lat: 41.3874, lng: 2.1686, scale: 'large', transit: 'metroHeavy' },
    { match: /馬德里|madrid/i, city: '馬德里', region: '馬德里', country: 'Spain', countryId: 'ES', lat: 40.4168, lng: -3.7038, scale: 'mega', transit: 'metroHeavy' },
    { match: /里斯本|lisbon|lisboa/i, city: '里斯本', region: '里斯本', country: 'Portugal', countryId: 'PT', lat: 38.7223, lng: -9.1393, scale: 'large', transit: 'mixed' },
    { match: /阿姆斯特丹|amsterdam/i, city: '阿姆斯特丹', region: '北荷蘭', country: 'Netherlands', countryId: 'NL', lat: 52.3676, lng: 4.9041, scale: 'large', transit: 'walkable' },
    { match: /柏林|berlin/i, city: '柏林', region: '柏林', country: 'Germany', countryId: 'DE', lat: 52.52, lng: 13.405, scale: 'mega', transit: 'metroHeavy' },
    { match: /慕尼黑|munich|münchen/i, city: '慕尼黑', region: '巴伐利亞', country: 'Germany', countryId: 'DE', lat: 48.1351, lng: 11.582, scale: 'large', transit: 'metroHeavy' },
    { match: /維也納|vienna|wien/i, city: '維也納', region: '維也納', country: 'Austria', countryId: 'AT', lat: 48.2082, lng: 16.3738, scale: 'large', transit: 'metroHeavy' },
    { match: /布拉格|prague|praha/i, city: '布拉格', region: '波希米亞', country: 'Czechia', countryId: 'CZ', lat: 50.0755, lng: 14.4378, scale: 'large', transit: 'metroHeavy' },
    { match: /蘇黎世|zurich|zürich/i, city: '蘇黎世', region: '蘇黎世', country: 'Switzerland', countryId: 'CH', lat: 47.3769, lng: 8.5417, scale: 'medium', transit: 'railHeavy' },
    { match: /日內瓦|geneva/i, city: '日內瓦', region: '日內瓦', country: 'Switzerland', countryId: 'CH', lat: 46.2044, lng: 6.1432, scale: 'medium', transit: 'mixed' },
    { match: /哥本哈根|copenhagen/i, city: '哥本哈根', region: '首都區', country: 'Denmark', countryId: 'DK', lat: 55.6761, lng: 12.5683, scale: 'large', transit: 'metroHeavy' },
    { match: /斯德哥爾摩|stockholm/i, city: '斯德哥爾摩', region: '斯德哥爾摩', country: 'Sweden', countryId: 'SE', lat: 59.3293, lng: 18.0686, scale: 'large', transit: 'metroHeavy' },
    { match: /赫爾辛基|helsinki/i, city: '赫爾辛基', region: '烏西馬', country: 'Finland', countryId: 'FI', lat: 60.1699, lng: 24.9384, scale: 'medium', transit: 'mixed' },
    { match: /雅典|athens/i, city: '雅典', region: '阿提卡', country: 'Greece', countryId: 'GR', lat: 37.9838, lng: 23.7275, scale: 'large', transit: 'metroHeavy' },
    { match: /杜拜|dubai/i, city: '杜拜', region: '杜拜', country: 'UAE', countryId: 'AE', lat: 25.2048, lng: 55.2708, scale: 'large', transit: 'mixed' },
    { match: /阿布達比|abu\s*dhabi/i, city: '阿布達比', region: '阿布達比', country: 'UAE', countryId: 'AE', lat: 24.4539, lng: 54.3773, scale: 'medium', transit: 'carRecommended' },
    { match: /伊斯坦堡|istanbul/i, city: '伊斯坦堡', region: '馬爾馬拉', country: 'Turkey', countryId: 'TR', lat: 41.0082, lng: 28.9784, scale: 'mega', transit: 'metroHeavy' }
  ];

  var COUNTRY_ONLY = [
    { match: /^(日本|japan)$/i, country: 'Japan', countryId: 'JP', regions: ['關東', '關西', '北海道', '九州', '沖繩'], scale: 'regional' },
    { match: /^(韓國|korea|south\s*korea)$/i, country: 'Korea', countryId: 'KR', regions: ['首都圈', '慶尚', '濟州'], scale: 'regional' },
    { match: /^(台灣|taiwan)$/i, country: 'Taiwan', countryId: 'TW', regions: ['北部', '中部', '南部', '東部'], scale: 'regional' },
    { match: /^(美國|usa|united\s*states)$/i, country: 'USA', countryId: 'US', regions: ['東北', '西岸', '中西', '夏威夷'], scale: 'regional' },
    { match: /^(澳洲|australia)$/i, country: 'Australia', countryId: 'AU', regions: ['NSW', 'VIC', 'QLD'], scale: 'regional' },
    { match: /^(義大利|意大利|italy)$/i, country: 'Italy', countryId: 'IT', regions: ['拉齊奧', '倫巴第', '托斯卡納', '威尼托'], scale: 'regional' },
    { match: /^(法國|france)$/i, country: 'France', countryId: 'FR', regions: ['法蘭西島', '普羅旺斯'], scale: 'regional' },
    { match: /^(泰國|thailand)$/i, country: 'Thailand', countryId: 'TH', regions: ['中部', '北部', '南部'], scale: 'regional' }
  ];

  /** Curated district enhancements — optional overlays, never required. */
  var CURATED_ENHANCEMENTS = {
    sapporo: {
      match: /札幌|sapporo/i,
      districts: [
        { id: 'station', name: '札幌站', center: { lat: 43.0687, lng: 141.3508 }, neighbors: ['odori'], food: true, shopping: true },
        { id: 'odori', name: '大通', center: { lat: 43.061, lng: 141.354 }, neighbors: ['station', 'tanuki'], food: true, shopping: true },
        { id: 'tanuki', name: '狸小路', center: { lat: 43.0575, lng: 141.3535 }, neighbors: ['odori', 'susukino'], food: true, shopping: true, nightlife: true },
        { id: 'susukino', name: '薄野', center: { lat: 43.0555, lng: 141.353 }, neighbors: ['tanuki'], food: true, nightlife: true },
        { id: 'maruyama', name: '圓山', center: { lat: 43.0545, lng: 141.318 }, neighbors: ['miyanosawa'], cultural: true },
        { id: 'miyanosawa', name: '宮之澤', center: { lat: 43.089, lng: 141.271 }, neighbors: ['maruyama'] },
        { id: 'naebo', name: '苗穗', center: { lat: 43.071, lng: 141.369 }, neighbors: ['station'], food: true }
      ],
      anchors: [
        { name: '札幌時計台', districtId: 'odori', category: 'landmark', tier: 'ANCHOR' },
        { name: '札幌電視塔', districtId: 'odori', category: 'landmark', tier: 'ANCHOR' },
        { name: '狸小路', districtId: 'tanuki', category: 'shopping', tier: 'ANCHOR' },
        { name: '白色戀人公園', districtId: 'miyanosawa', category: 'hands-on', tier: 'ANCHOR' },
        { name: '札幌啤酒博物館', districtId: 'naebo', category: 'museum', tier: 'ANCHOR' }
      ],
      dayTrips: ['小樽']
    }
  };

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

  function cacheKey(destination, styleKey, month) {
    return [
      'v' + CACHE_SCHEMA_VERSION,
      String(destination || '').trim().toLowerCase(),
      String(styleKey || 'any'),
      month != null ? 'm' + month : 'm*'
    ].join('|');
  }

  function getCachedIntelligence(key) {
    return SESSION_CACHE[key] || null;
  }

  function setCachedIntelligence(key, value) {
    SESSION_CACHE[key] = value;
    return value;
  }

  function clearIntelligenceCache() {
    Object.keys(SESSION_CACHE).forEach(function (k) {
      delete SESSION_CACHE[k];
    });
  }

  /**
   * Cache schema (session now; durable DB later):
   * {
   *   schemaVersion, destinationKey, builtAt,
   *   base: DestinationIntelligence (style-agnostic),
   *   personalizations: { [style|season|days]: overrides }
   * }
   */
  function describeCacheSchema() {
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      layers: {
        base: 'country/region/city, districts, anchors, transit, cityScale',
        personalization: 'style ranking, seasonal weights, tripLength density, wishlist'
      },
      key: 'destination + optional(style, month)',
      storage: 'session (this round); durable KV/Firestore later'
    };
  }

  function findGeoSeed(text) {
    var t = String(text || '').trim();
    var i;
    for (i = 0; i < GEO_SEEDS.length; i++) {
      if (GEO_SEEDS[i].match.test(t)) return GEO_SEEDS[i];
    }
    return null;
  }

  function findCountryOnly(text) {
    var t = String(text || '').trim();
    var i;
    for (i = 0; i < COUNTRY_ONLY.length; i++) {
      if (COUNTRY_ONLY[i].match.test(t)) return COUNTRY_ONLY[i];
    }
    // Also "日本旅遊" style
    for (i = 0; i < COUNTRY_ONLY.length; i++) {
      var c = COUNTRY_ONLY[i];
      if (c.country === 'Japan' && /日本|japan/i.test(t) && !findGeoSeed(t)) return c;
      if (c.country === 'Korea' && /韓國|korea/i.test(t) && !findGeoSeed(t)) return c;
      if (c.country === 'USA' && /美國|united\s*states|\busa\b/i.test(t) && !findGeoSeed(t)) return c;
      if (c.country === 'Italy' && /義大利|意大利|italy/i.test(t) && !findGeoSeed(t)) return c;
      if (c.country === 'France' && /法國|france/i.test(t) && !findGeoSeed(t)) return c;
      if (c.country === 'Australia' && /澳洲|australia/i.test(t) && !findGeoSeed(t)) return c;
    }
    return null;
  }

  function findCurated(text) {
    var keys = Object.keys(CURATED_ENHANCEMENTS);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (CURATED_ENHANCEMENTS[keys[i]].match.test(String(text || ''))) {
        return CURATED_ENHANCEMENTS[keys[i]];
      }
    }
    return null;
  }

  /**
   * Resolve country / region / city hierarchy for any input.
   */
  function resolveLocationHierarchy(destination, tripContext) {
    tripContext = tripContext || {};
    var raw = String(destination || tripContext.destination || '').trim();
    var seed = findGeoSeed(raw);
    var countryOnly = !seed ? findCountryOnly(raw) : null;

    if (countryOnly) {
      return {
        destination: raw,
        country: countryOnly.country,
        countryId: countryOnly.countryId,
        region: null,
        city: null,
        level: 'country',
        scaleHint: countryOnly.scale,
        regions: countryOnly.regions || [],
        center: tripContext.center || null,
        known: true
      };
    }

    if (seed) {
      var level = seed.level || (seed.city ? 'city' : 'region');
      return {
        destination: raw,
        country: seed.country,
        countryId: seed.countryId,
        region: seed.region,
        city: seed.city,
        level: level,
        scaleHint: seed.scale,
        transitHint: seed.transit,
        center: { lat: seed.lat, lng: seed.lng },
        known: true
      };
    }

    // Unknown — still usable
    var center = tripContext.center || null;
    if (
      !center &&
      tripContext.lat != null &&
      tripContext.lng != null
    ) {
      center = { lat: Number(tripContext.lat), lng: Number(tripContext.lng) };
    }
    return {
      destination: raw,
      country: tripContext.country || guessCountryFromText(raw),
      countryId: tripContext.countryId || null,
      region: tripContext.region || null,
      city: raw,
      level: 'city',
      scaleHint: 'medium',
      transitHint: 'mixed',
      center: center,
      known: false,
      unknownDestination: true
    };
  }

  function guessCountryFromText(t) {
    if (/日本|japan|東京|大阪|京都|北海道/i.test(t)) return 'Japan';
    if (/韓國|korea|首爾|釜山|濟州/i.test(t)) return 'Korea';
    if (/台灣|taiwan|台北|高雄/i.test(t)) return 'Taiwan';
    if (/美國|usa|紐約|洛杉磯/i.test(t)) return 'USA';
    if (/法國|france|巴黎/i.test(t)) return 'France';
    if (/英國|uk|london|倫敦/i.test(t)) return 'UK';
    if (/澳洲|australia|雪梨|墨爾本/i.test(t)) return 'Australia';
    if (/泰國|thailand|曼谷/i.test(t)) return 'Thailand';
    return null;
  }

  function deriveSeasonalContext(dateIso, latitude) {
    var d = dateIso ? new Date(String(dateIso).slice(0, 10) + 'T12:00:00') : null;
    var month = d && !isNaN(d.getTime()) ? d.getMonth() + 1 : null;
    var weekday = d && !isNaN(d.getTime()) ? d.getDay() : null;
    var lat = latitude != null ? Number(latitude) : null;
    var southern = lat != null && lat < 0;
    var season = 'unknown';
    if (month != null) {
      var m = southern ? ((month + 5) % 12) + 1 : month;
      if (m >= 6 && m <= 8) season = 'summer';
      else if (m >= 9 && m <= 11) season = 'autumn';
      else if (m === 12 || m <= 2) season = 'winter';
      else season = 'spring';
    }
    var absLat = lat != null ? Math.abs(lat) : 35;
    var notes = [];
    var daylightHint = 'moderate';
    var mobilityBuffer = 1.0;
    var heatBuffer = 1.0;
    var rainSensitivity = 0.4;
    if (season === 'winter') {
      if (absLat >= 35) {
        daylightHint = 'short';
        mobilityBuffer = 1.2;
        notes.push('高緯／冬季日照偏短，戶外宜提早結束（非即時天氣）');
      }
      if (absLat >= 40) mobilityBuffer = 1.3;
    } else if (season === 'summer') {
      daylightHint = 'long';
      if (absLat <= 40) {
        heatBuffer = 1.15;
        notes.push('夏季炎熱可能影響步行節奏（非即時天氣）');
      }
    }
    return {
      month: month,
      season: season,
      weekday: weekday,
      weekdayLabel: weekday != null ? ['日', '一', '二', '三', '四', '五', '六'][weekday] : null,
      daylightHint: daylightHint,
      mobilityBuffer: mobilityBuffer,
      heatBuffer: heatBuffer,
      rainSensitivity: rainSensitivity,
      hemisphere: southern ? 'south' : 'north',
      notes: notes
    };
  }

  function inferCityScale(hierarchy, poiSpreadKm) {
    if (hierarchy.scaleHint) return hierarchy.scaleHint;
    if (poiSpreadKm != null) {
      if (poiSpreadKm < 4) return 'compact';
      if (poiSpreadKm < 10) return 'medium';
      if (poiSpreadKm < 25) return 'large';
      return 'mega';
    }
    return 'medium';
  }

  function inferTransitCharacter(hierarchy, cityScale) {
    if (hierarchy.transitHint) return hierarchy.transitHint;
    if (cityScale === 'compact') return 'walkable';
    if (cityScale === 'mega') return 'metroHeavy';
    if (cityScale === 'regional') return 'mixed';
    return 'mixed';
  }

  function recommendedDailyDensity(cityScale, dayRole) {
    var base = { compact: 4, medium: 5, large: 5, mega: 6, regional: 3 };
    var n = base[cityScale] || 5;
    if (dayRole === 'arrival' || dayRole === 'departure') n = Math.max(2, n - 2);
    return n;
  }

  /**
   * Synthesize districts around a center when Places/Gemini haven't provided clusters yet.
   * Uses geographic sectors — not city-specific names beyond "{city}中心".
   */
  function synthesizeDistricts(hierarchy, cityScale) {
    var city = hierarchy.city || hierarchy.destination || '目的地';
    var c = hierarchy.center;
    if (!c) {
      return [
        {
          id: 'core',
          name: city + '核心區',
          center: null,
          neighbors: ['north', 'east'],
          food: true,
          shopping: true,
          synthetic: true
        },
        {
          id: 'north',
          name: city + '北側',
          center: null,
          neighbors: ['core'],
          synthetic: true
        },
        {
          id: 'east',
          name: city + '東側',
          center: null,
          neighbors: ['core'],
          synthetic: true
        }
      ];
    }
    var step = cityScale === 'compact' ? 0.012 : cityScale === 'mega' ? 0.045 : 0.025;
    var sectors = [
      { id: 'core', name: city + '中心', dlat: 0, dlng: 0, food: true, shopping: true },
      { id: 'north', name: city + '北側', dlat: step, dlng: 0 },
      { id: 'south', name: city + '南側', dlat: -step, dlng: 0 },
      { id: 'east', name: city + '東側', dlat: 0, dlng: step },
      { id: 'west', name: city + '西側', dlat: 0, dlng: -step }
    ];
    if (cityScale === 'mega' || cityScale === 'large') {
      sectors.push({
        id: 'station',
        name: city + '車站周邊',
        dlat: step * 0.4,
        dlng: -step * 0.2,
        food: true,
        shopping: true
      });
    }
    return sectors.map(function (s) {
      return {
        id: s.id,
        name: s.name,
        center: { lat: c.lat + s.dlat, lng: c.lng + s.dlng },
        neighbors: s.id === 'core' ? ['north', 'south', 'east', 'west'] : ['core'],
        food: !!s.food,
        shopping: !!s.shopping,
        nightlife: s.id === 'south' || s.id === 'core',
        synthetic: true
      };
    });
  }

  /**
   * Cluster POI candidates by lat/lng into districts (grid + merge).
   */
  function clusterPoisIntoDistricts(pois, hierarchy, opt) {
    opt = opt || {};
    var cellDeg = opt.cellDeg || (hierarchy.scaleHint === 'mega' ? 0.03 : 0.02);
    var cells = {};
    (pois || []).forEach(function (p) {
      if (p.lat == null || p.lng == null) return;
      var key =
        Math.round(p.lat / cellDeg) + ':' + Math.round(p.lng / cellDeg);
      if (!cells[key]) {
        cells[key] = { pois: [], latSum: 0, lngSum: 0 };
      }
      cells[key].pois.push(p);
      cells[key].latSum += p.lat;
      cells[key].lngSum += p.lng;
    });
    var keys = Object.keys(cells);
    if (!keys.length) return synthesizeDistricts(hierarchy, inferCityScale(hierarchy));

    var districts = keys
      .map(function (k, idx) {
        var cell = cells[k];
        var n = cell.pois.length;
        var center = { lat: cell.latSum / n, lng: cell.lngSum / n };
        var label =
          (cell.pois[0] && (cell.pois[0].districtHint || cell.pois[0].neighborhood)) ||
          (hierarchy.city || hierarchy.destination || '區') + '-' + (idx + 1);
        var types = {};
        cell.pois.forEach(function (p) {
          (p.types || []).forEach(function (t) {
            types[t] = true;
          });
          if (p.category) types[p.category] = true;
        });
        return {
          id: 'c' + idx,
          name: label,
          center: center,
          neighbors: [],
          food: !!(types.restaurant || types.food || types.cafe),
          shopping: !!(types.shopping_mall || types.shopping || types.store),
          nightlife: !!(types.bar || types.night_club || types.nightlife),
          cultural: !!(types.museum || types.culture || types.church || types.hindu_temple),
          nature: !!(types.park || types.natural_feature),
          poiCount: n,
          fromPlaces: true
        };
      })
      .sort(function (a, b) {
        return b.poiCount - a.poiCount;
      })
      .slice(0, 10);

    // Neighbor by distance
    districts.forEach(function (a) {
      districts.forEach(function (b) {
        if (a.id === b.id) return;
        var km = haversineKm(a.center, b.center);
        if (!isNaN(km) && km < 3.5) a.neighbors.push(b.id);
      });
    });
    return districts;
  }

  function buildDistrictRelationships(districts) {
    return (districts || []).map(function (d) {
      return { id: d.id, name: d.name, neighbors: d.neighbors || [] };
    });
  }

  function classifyZones(districts) {
    return {
      foodZones: districts.filter(function (d) {
        return d.food;
      }).map(function (d) {
        return d.name;
      }),
      shoppingZones: districts.filter(function (d) {
        return d.shopping;
      }).map(function (d) {
        return d.name;
      }),
      nightlifeZones: districts.filter(function (d) {
        return d.nightlife;
      }).map(function (d) {
        return d.name;
      }),
      natureZones: districts.filter(function (d) {
        return d.nature;
      }).map(function (d) {
        return d.name;
      }),
      culturalZones: districts.filter(function (d) {
        return d.cultural;
      }).map(function (d) {
        return d.name;
      })
    };
  }

  /**
   * Country-level multi-city strategy — avoid stuffing 6 distant cities into 7 days.
   */
  function buildRegionalStrategy(hierarchy, tripContext) {
    tripContext = tripContext || {};
    var days = Number(tripContext.tripDays) || Number(tripContext.days) || 5;
    var styleKey = tripContext.travelStyle || tripContext.styleKey || 'sightseeing';

    if (hierarchy.level !== 'country' && hierarchy.level !== 'region') {
      return {
        mode: 'single_city',
        hubs: hierarchy.city ? [hierarchy.city] : [hierarchy.destination],
        maxHubs: 1,
        note: '城市級行程，以單城深度為主'
      };
    }

    var maxHubs = days <= 3 ? 1 : days <= 5 ? 2 : days <= 8 ? 3 : 4;
    var suggested = [];
    if (hierarchy.country === 'Japan') {
      if (hierarchy.level === 'region' && hierarchy.region === '北海道') {
        suggested = days <= 4 ? ['札幌', '小樽'] : ['札幌', '小樽', '函館'];
      } else {
        suggested =
          days <= 4
            ? ['東京']
            : days <= 7
              ? ['東京', '京都']
              : ['東京', '大阪', '京都'];
      }
    } else if (hierarchy.country === 'Korea') {
      suggested = days <= 4 ? ['首爾'] : days <= 7 ? ['首爾', '釜山'] : ['首爾', '釜山', '濟州'];
    } else if (hierarchy.country === 'Italy') {
      suggested = days <= 4 ? ['羅馬'] : days <= 7 ? ['羅馬', '佛羅倫斯'] : ['羅馬', '佛羅倫斯', '威尼斯'];
    } else if (hierarchy.country === 'France') {
      suggested = days <= 5 ? ['巴黎'] : ['巴黎'];
    } else if (hierarchy.country === 'USA') {
      suggested = days <= 5 ? ['紐約'] : ['紐約']; // avoid NY+LA in one week by default
      maxHubs = Math.min(maxHubs, 2);
    } else if (hierarchy.country === 'Australia') {
      suggested = days <= 5 ? ['雪梨'] : ['雪梨', '墨爾本'];
    } else if (hierarchy.regions && hierarchy.regions.length) {
      suggested = hierarchy.regions.slice(0, maxHubs);
    } else {
      suggested = [hierarchy.destination];
    }

    suggested = suggested.slice(0, maxHubs);
    return {
      mode: 'multi_city',
      hubs: suggested,
      maxHubs: maxHubs,
      tripDays: days,
      styleKey: styleKey,
      note:
        '國家／區域級輸入：' +
        days +
        ' 天最多 ' +
        maxHubs +
        ' 個樞紐，禁止塞入過多遠距城市。建議樞紐：' +
        suggested.join(' → ')
    };
  }

  function mergeCuratedEnhancement(intel, curated) {
    if (!curated) return intel;
    intel.curatedEnhancement = true;
    if (curated.districts && curated.districts.length) {
      // Prefer curated districts when available, keep synthetic as fallback neighbors
      intel.districts = curated.districts.map(function (d) {
        return Object.assign({}, d, { curated: true });
      });
      intel.districtRelationships = buildDistrictRelationships(intel.districts);
      var zones = classifyZones(intel.districts);
      Object.assign(intel, zones);
    }
    if (curated.anchors && curated.anchors.length) {
      intel.anchors = curated.anchors.map(function (a) {
        return Object.assign({ tier: 'ANCHOR', curated: true }, a);
      });
    }
    if (curated.dayTrips) intel.dayTrips = curated.dayTrips.slice();
    return intel;
  }

  /**
   * Main entry: buildDestinationIntelligence(destination, tripContext, opt)
   * opt.pois — optional Places/Gemini candidate list [{name,lat,lng,types,category,rating}]
   * opt.geminiDistricts — optional district labels from Gemini reasoning
   * opt.skipCache
   */
  function buildDestinationIntelligence(destination, tripContext, opt) {
    opt = opt || {};
    tripContext = tripContext || {};
    var hierarchy = resolveLocationHierarchy(destination, tripContext);
    var season = deriveSeasonalContext(
      tripContext.dateStart || tripContext.dateIso,
      hierarchy.center && hierarchy.center.lat
    );
    var ck = cacheKey(
      hierarchy.destination,
      tripContext.travelStyle || '',
      season.month
    );
    if (!opt.skipCache) {
      var hit = getCachedIntelligence(ck);
      if (hit) {
        hit.cacheHit = true;
        return hit;
      }
    }

    var regionalStrategy = buildRegionalStrategy(hierarchy, tripContext);
    var pois = opt.pois || tripContext.pois || [];
    var cityScale = inferCityScale(hierarchy);
    var districts;

    if (opt.geminiDistricts && opt.geminiDistricts.length) {
      districts = opt.geminiDistricts.map(function (g, idx) {
        return {
          id: g.id || 'g' + idx,
          name: g.name || g.label || '區' + (idx + 1),
          center: g.center || null,
          neighbors: g.neighbors || [],
          food: !!g.food,
          shopping: !!g.shopping,
          nightlife: !!g.nightlife,
          fromGemini: true
        };
      });
    } else if (pois.length) {
      districts = clusterPoisIntoDistricts(pois, hierarchy, opt);
      // refine scale from POI spread
      var lats = pois.map(function (p) {
        return p.lat;
      }).filter(function (x) {
        return x != null;
      });
      if (lats.length >= 2) {
        var minLat = Math.min.apply(null, lats);
        var maxLat = Math.max.apply(null, lats);
        var spread = (maxLat - minLat) * 111;
        cityScale = inferCityScale(hierarchy, spread);
      }
    } else {
      districts = synthesizeDistricts(hierarchy, cityScale);
    }

    var transitCharacter = inferTransitCharacter(hierarchy, cityScale);
    var zones = classifyZones(districts);
    var anchors = (pois || [])
      .filter(function (p) {
        return (p.rating || 0) >= 4.3 || p.tier === 'ANCHOR' || p.touristPriority === 'high';
      })
      .slice(0, 12)
      .map(function (p) {
        return {
          name: p.name || p.title,
          placeId: p.placeId || null,
          lat: p.lat,
          lng: p.lng,
          category: p.category || 'landmark',
          tier: p.tier || 'ANCHOR',
          rating: p.rating,
          types: p.types || []
        };
      });

    var density = recommendedDailyDensity(cityScale, tripContext.dayRole || 'full');

    var intel = {
      destination: hierarchy.destination,
      country: hierarchy.country,
      countryId: hierarchy.countryId,
      region: hierarchy.region,
      city: hierarchy.city,
      level: hierarchy.level,
      unknownDestination: !!hierarchy.unknownDestination,
      center: hierarchy.center,
      districts: districts,
      districtRelationships: buildDistrictRelationships(districts),
      anchors: anchors,
      foodZones: zones.foodZones,
      shoppingZones: zones.shoppingZones,
      nightlifeZones: zones.nightlifeZones,
      natureZones: zones.natureZones,
      culturalZones: zones.culturalZones,
      dayTrips: [],
      seasonalContext: season,
      transitCharacter: transitCharacter,
      cityScale: cityScale,
      recommendedDailyDensity: density,
      regionalStrategy: regionalStrategy,
      curatedEnhancement: false,
      placesBudget: estimateDiscoveryBudget(cityScale, Number(tripContext.tripDays) || 5),
      cacheKey: ck,
      cacheHit: false,
      builtAt: Date.now()
    };

    // Compatibility shape for guide-intelligence optimize (districts with aliases optional)
    intel.id = (hierarchy.city || hierarchy.destination || 'dest')
      .toLowerCase()
      .replace(/\s+/g, '-');
    intel.cityLabel = hierarchy.city || hierarchy.destination;
    intel.regionLabel = hierarchy.region || hierarchy.country;
    intel.landmarks = intel.anchors;
    intel.themes = {
      classic_core: (intel.cityLabel || '') + '經典核心',
      culture_maruyama: (intel.cityLabel || '') + '文化散策',
      sweets_suburb: (intel.cityLabel || '') + '近郊體驗',
      market_food_night: (intel.cityLabel || '') + '美食與夜生活',
      daytrip_otaru: '一日延伸'
    };

    var curated = findCurated(hierarchy.destination);
    if (curated) intel = mergeCuratedEnhancement(intel, curated);

    if (!opt.skipCache) setCachedIntelligence(ck, intel);
    return intel;
  }

  function estimateDiscoveryBudget(cityScale, tripDays) {
    var districtCap = cityScale === 'mega' ? 8 : cityScale === 'large' ? 7 : 5;
    var poiCap = Math.min(40, 8 + tripDays * 4);
    var placesSearchCap = Math.min(25, Math.ceil(poiCap * 0.7));
    return {
      districtCap: districtCap,
      poiCandidateCap: poiCap,
      placesSearchCap: placesSearchCap,
      concurrency: 4,
      levels: {
        L1: 'Gemini districts + POI intent (no Places flood)',
        L2: 'Places validate final candidates only'
      }
    };
  }

  /**
   * Match item title to a district in dynamic intelligence.
   */
  function matchDistrictDynamic(title, intel) {
    if (!intel || !intel.districts) return null;
    var t = String(title || '');
    var i;
    for (i = 0; i < intel.districts.length; i++) {
      var d = intel.districts[i];
      if (t.indexOf(d.name) !== -1) return d;
      if (d.aliases) {
        var j;
        for (j = 0; j < d.aliases.length; j++) {
          if (d.aliases[j].test && d.aliases[j].test(t)) return d;
        }
      }
    }
    // Coord proximity if __places
    return null;
  }

  function matchDistrictByCoordsDynamic(lat, lng, intel) {
    if (!intel || lat == null || lng == null) return null;
    var best = null;
    var bestKm = Infinity;
    (intel.districts || []).forEach(function (d) {
      if (!d.center) return;
      var km = haversineKm({ lat: lat, lng: lng }, d.center);
      if (!isNaN(km) && km < bestKm) {
        bestKm = km;
        best = d;
      }
    });
    var limit = intel.cityScale === 'compact' ? 2.5 : intel.cityScale === 'mega' ? 5 : 3.5;
    if (best && bestKm <= limit) return best;
    return null;
  }

  function buildPromptFromIntelligence(intel, tripContext) {
    tripContext = tripContext || {};
    if (!intel) return '';
    var lines = [];
    lines.push('【🧭 SoarVibe Dynamic Destination Intelligence——全球通用底稿】');
    lines.push(
      '目的地：' +
        intel.destination +
        '｜層級：' +
        intel.level +
        '｜國家：' +
        (intel.country || '?') +
        '｜區域：' +
        (intel.region || '-') +
        '｜城市：' +
        (intel.city || '-')
    );
    if (intel.unknownDestination) {
      lines.push('（此目的地無 curated profile，以下為動態推導，仍須依真實地理聚類。）');
    }
    if (intel.curatedEnhancement) {
      lines.push('（已套用 curated enhancement，非唯一依賴。）');
    }
    lines.push('城市尺度 cityScale=' + intel.cityScale + '｜交通性格=' + intel.transitCharacter);
    lines.push('建議每日 POI 密度 ≈ ' + intel.recommendedDailyDensity);
    if (intel.regionalStrategy && intel.regionalStrategy.mode === 'multi_city') {
      lines.push('【區域策略】' + intel.regionalStrategy.note);
    }
    lines.push(
      '主要分區（同日鎖定 1 主區 + 最多 1 鄰近次區）：' +
        (intel.districts || [])
          .slice(0, 8)
          .map(function (d) {
            return d.name;
          })
          .join('、')
    );
    if (intel.foodZones && intel.foodZones.length) {
      lines.push('美食區：' + intel.foodZones.slice(0, 6).join('、'));
    }
    if (intel.shoppingZones && intel.shoppingZones.length) {
      lines.push('購物區：' + intel.shoppingZones.slice(0, 6).join('、'));
    }
    if (intel.anchors && intel.anchors.length) {
      lines.push('ANCHOR 候選：');
      intel.anchors.slice(0, 8).forEach(function (a) {
        lines.push('- ' + (a.name || '') + (a.category ? '（' + a.category + '）' : ''));
      });
    }
    var season = intel.seasonalContext || {};
    lines.push(
      '季節脈絡（非即時天氣）：' +
        (season.month || '?') +
        '月／' +
        (season.season || '?') +
        '／日照 ' +
        (season.daylightHint || '?') +
        '／移動 buffer ×' +
        (season.mobilityBuffer || 1)
    );
    (season.notes || []).forEach(function (n) {
      lines.push('- ' + n);
    });
    if (intel.placesBudget) {
      lines.push(
        '探索預算：POI cap ' +
          intel.placesBudget.poiCandidateCap +
          '／Places search cap ' +
          intel.placesBudget.placesSearchCap +
          '／concurrency ' +
          intel.placesBudget.concurrency
      );
    }
    lines.push(
      '編排鐵律：每天 dayTheme 服務同一 geographic cluster；禁止東→西→東亂跳；FILLER 不與 ANCHOR 等權。'
    );
    return lines.join('\n');
  }

  async function buildDestinationIntelligenceAsync(destination, tripContext, opt) {
    opt = opt || {};
    tripContext = tripContext || {};
    // Level 1: optional Gemini district/POI intent via injected fn
    if (typeof opt.discoverIntent === 'function') {
      try {
        var intent = await opt.discoverIntent(destination, tripContext);
        if (intent) {
          if (intent.districts) opt.geminiDistricts = intent.districts;
          if (intent.pois) opt.pois = (opt.pois || []).concat(intent.pois);
        }
      } catch (e) { /* continue without */ }
    }
    // Level 2: optional Places validation for candidates only
    if (typeof opt.resolvePlacesCandidates === 'function' && opt.pois && opt.pois.length) {
      try {
        var capped = opt.pois.slice(0, (opt.placesCap || 20));
        opt.pois = await opt.resolvePlacesCandidates(capped, tripContext);
      } catch (e2) { /* keep unverified */ }
    }
    return buildDestinationIntelligence(destination, tripContext, opt);
  }

  global.SOARVIBE_DESTINATION_INTELLIGENCE = Object.freeze({
    buildDestinationIntelligence: buildDestinationIntelligence,
    buildDestinationIntelligenceAsync: buildDestinationIntelligenceAsync,
    resolveLocationHierarchy: resolveLocationHierarchy,
    buildRegionalStrategy: buildRegionalStrategy,
    clusterPoisIntoDistricts: clusterPoisIntoDistricts,
    synthesizeDistricts: synthesizeDistricts,
    deriveSeasonalContext: deriveSeasonalContext,
    inferCityScale: inferCityScale,
    inferTransitCharacter: inferTransitCharacter,
    matchDistrictDynamic: matchDistrictDynamic,
    matchDistrictByCoordsDynamic: matchDistrictByCoordsDynamic,
    buildPromptFromIntelligence: buildPromptFromIntelligence,
    findGeoSeed: findGeoSeed,
    findCurated: findCurated,
    getCachedIntelligence: getCachedIntelligence,
    setCachedIntelligence: setCachedIntelligence,
    clearIntelligenceCache: clearIntelligenceCache,
    cacheKey: cacheKey,
    describeCacheSchema: describeCacheSchema,
    estimateDiscoveryBudget: estimateDiscoveryBudget,
    haversineKm: haversineKm,
    GEO_SEEDS_COUNT: GEO_SEEDS.length,
    CURATED_ENHANCEMENTS: CURATED_ENHANCEMENTS,
    CACHE_SCHEMA_VERSION: CACHE_SCHEMA_VERSION
  });
})(typeof window !== 'undefined' ? window : globalThis);
