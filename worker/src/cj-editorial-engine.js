/**
 * SoarVibe Editorial Engine — global, city-agnostic.
 * Google Places = data only. Engine = editorial decisions.
 */

export var SECTION_ROLES = [
  'opening', 'landmark', 'explore', 'experience', 'shopping', 'anime',
  'food', 'cafe', 'hotel', 'hostel', 'night', 'transport', 'ending'
];

export var READING_RHYTHM = [
  'opening', 'explore', 'experience', 'food', 'shopping', 'stay', 'ending'
];

/** Global photo priority by section role — all cities share */
export var PHOTO_PRIORITY_BY_ROLE = {
  opening: {
    primary: ['城市代表景觀', 'iconic skyline', 'landmark panorama', 'hero view'],
    secondary: ['地標建築', 'signature building'],
    tertiary: ['街景', 'street atmosphere']
  },
  landmark: {
    primary: ['城市代表景觀', 'landmark panorama', 'iconic district', '中央通', 'main street'],
    secondary: ['地標建築', 'signature building', 'neon', '霓虹', 'crowd'],
    tertiary: ['街景', 'street scene', 'entrance']
  },
  explore: {
    primary: ['街區全景', 'district street', 'neighborhood'],
    secondary: ['招牌霓虹', 'signage', 'crowd'],
    tertiary: ['入口', 'entrance']
  },
  experience: {
    primary: ['體驗場景', 'activity', 'immersive interior'],
    secondary: ['參與者', 'audience', 'atmosphere'],
    tertiary: ['店面', 'venue front']
  },
  shopping: {
    primary: ['商品展示', 'product display', 'merchandise wall'],
    secondary: ['店內空間', 'shop interior'],
    tertiary: ['店面招牌', 'storefront']
  },
  anime: {
    primary: ['動漫展示', 'anime display', 'figure wall', 'signage wall'],
    secondary: ['公仔展示', 'model shelf', 'manga wall', 'collectible', 'Sun Mall', '中庭', 'atrium'],
    tertiary: ['店面', 'storefront', 'district street']
  },
  food: {
    primary: ['成品料理', 'finished dish', 'food close-up'],
    secondary: ['店內吧台', 'dining counter', 'interior'],
    tertiary: ['店門口', 'storefront']
  },
  cafe: {
    primary: ['飲品甜點', 'dessert', 'drink', 'plate'],
    secondary: ['店內氛圍', 'cafe interior', 'seating'],
    tertiary: ['店外', 'storefront', 'logo only']
  },
  hotel: {
    primary: ['客房', 'room', 'suite'],
    secondary: ['Lobby', 'lobby', 'lounge'],
    tertiary: ['公共空間', '公共區域'],
    quaternary: ['外觀', 'facade', 'exterior']
  },
  hostel: {
    primary: ['客房', 'dorm', 'room'],
    secondary: ['Lobby', 'bar', 'lounge', '公共吧台'],
    tertiary: ['交誼廳', 'common space'],
    quaternary: ['外觀', 'facade']
  },
  night: {
    primary: ['夜景霓虹', 'night neon', 'illuminated street'],
    secondary: ['店面', 'venue'],
    tertiary: ['街景', 'street']
  },
  transport: {
    primary: ['車站', 'station', 'platform', 'route'],
    secondary: ['轉乘', 'transfer'],
    tertiary: ['方向', 'wayfinding']
  },
  ending: {
    primary: ['再訪誘因', 'farewell view', 'sunset', 'night view'],
    secondary: ['街景', 'street'],
    tertiary: ['地標', 'landmark']
  }
};

/** Metadata capsule field sets by role — no one-size-fits-all */
export var METADATA_BY_ROLE = {
  landmark: ['recommend', 'stay', 'photoTime', 'season', 'transport', 'tips'],
  explore: ['recommend', 'stay', 'photoTime', 'transport', 'tips'],
  shopping: ['recommend', 'stay', 'highlight', 'mustBuy', 'taxFree', 'payment'],
  anime: ['recommend', 'stay', 'mustVisit', 'limited', 'newArrival', 'tips'],
  food: ['dish', 'budget', 'wait', 'hours'],
  cafe: ['recommend', 'stay', 'signature', 'budget', 'tips'],
  hotel: ['recommend', 'price', 'transport', 'checkIn', 'feature'],
  hostel: ['recommend', 'price', 'transport', 'feature', 'tips'],
  experience: ['recommend', 'stay', 'feature', 'tips'],
  night: ['recommend', 'stay', 'photoTime', 'tips'],
  opening: ['recommend', 'stay', 'transport'],
  ending: ['recommend', 'tips'],
  transport: ['route', 'transfer', 'tips']
};

export var METADATA_LABELS = {
  recommend: { icon: '⭐', label: '推薦程度' },
  stay: { icon: '⏰', label: '建議停留' },
  photoTime: { icon: '📷', label: '最佳拍攝' },
  season: { icon: '🌸', label: '最佳季節' },
  transport: { icon: '🚉', label: '交通方式' },
  tips: { icon: '🔥', label: 'Tips' },
  highlight: { icon: '✨', label: '特色' },
  mustBuy: { icon: '🛍', label: '必買' },
  mustVisit: { icon: '🎯', label: '必逛' },
  limited: { icon: '🎁', label: '限定商品' },
  newArrival: { icon: '🆕', label: '新品' },
  taxFree: { icon: '💳', label: '退稅' },
  payment: { icon: '💴', label: '付款方式' },
  dish: { icon: '🍜', label: '推薦餐點' },
  budget: { icon: '💴', label: '預算' },
  wait: { icon: '⏳', label: '等待時間' },
  hours: { icon: '🕐', label: '營業時間' },
  signature: { icon: '☕', label: '招牌' },
  price: { icon: '💴', label: '價格' },
  checkIn: { icon: '🛎', label: '入住' },
  feature: { icon: '✨', label: '特色' },
  route: { icon: '🚃', label: '路線' },
  transfer: { icon: '🔀', label: '轉乘' }
};

const ROLE_FROM_TYPE = {
  food: 'food',
  cafe: 'cafe',
  hotel: 'hotel',
  hostel: 'hostel',
  shopping: 'shopping',
  transport: 'transport'
};

export function resolveSectionRole(section) {
  if (section.sectionRole) return section.sectionRole;
  if (section.role === 'hero') return 'opening';
  var purpose = section.sectionPurpose;
  if (purpose && SECTION_ROLES.indexOf(purpose) >= 0) return purpose;
  var t = section.sectionType || 'landmark';
  if (ROLE_FROM_TYPE[t]) return ROLE_FROM_TYPE[t];
  if (t === 'landmark') return 'landmark';
  return 'explore';
}

export function resolvePhotoPriority(section) {
  if (section.photoPriority && section.photoPriority.primary) {
    return section.photoPriority;
  }
  var role = resolveSectionRole(section);
  var tpl = PHOTO_PRIORITY_BY_ROLE[role] || PHOTO_PRIORITY_BY_ROLE.landmark;
  return Object.assign({}, tpl);
}

export function normalizeArticle(article) {
  return {
    articleId: article.articleId || article.id || null,
    articleTheme: article.articleTheme || (article.editorialPlan && article.editorialPlan.theme) || null,
    editorialAngle: article.editorialAngle || null,
    storyline: article.storyline || (article.editorialPlan && article.editorialPlan.storyArc) || null,
    readerPersona: article.readerPersona || article.targetReader || null,
    travelStyle: article.travelStyle || null,
    emotion: article.emotion || null,
    articleGoal: article.articleGoal || null,
    readingRhythm: article.readingRhythm || (article.editorialPlan && article.editorialPlan.readingRhythm) || null
  };
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchTerms(blob, terms) {
  var matched = [];
  (terms || []).forEach(function (term) {
    if (!term) return;
    try {
      if (new RegExp(escapeRegExp(term), 'i').test(blob)) matched.push(term);
    } catch (e) { /* skip */ }
  });
  return matched;
}

export function buildSearchKeywords(section) {
  var seen = {};
  var out = [];
  var priority = resolvePhotoPriority(section);
  var role = resolveSectionRole(section);

  function push(kw) {
    var k = String(kw || '').trim();
    if (!k || k.length < 2 || seen[k.toLowerCase()]) return;
    seen[k.toLowerCase()] = true;
    out.push(k);
  }

  (section.searchKeywords || []).forEach(push);
  (priority.primary || []).forEach(push);
  (priority.secondary || []).forEach(push);
  push(section.officialNameLocal);
  push(section.officialName);
  push(section.title);
  push(section.subject);
  (section.aliases || []).forEach(push);
  (section.photoPlaceQueries || []).forEach(push);

  String(section.photoIntent || '')
    .split(/[、,，\/\|]+/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean)
    .forEach(push);

  (section.imageChecklist || []).forEach(push);

  if (section.visualGroups) {
    section.visualGroups.forEach(function (group) {
      (group || []).forEach(push);
    });
  }

  if (role === 'landmark' || role === 'opening') {
    push('street view');
    push('main street');
  }

  return out.slice(0, 40);
}

export function normalizeSection(section, articleContext) {
  var role = resolveSectionRole(section);
  var priority = resolvePhotoPriority(section);
  var minChecklistHits = section.minChecklistHits != null
    ? section.minChecklistHits
    : (section.requiredVisualMinGroups != null ? section.requiredVisualMinGroups : 2);

  return Object.assign({}, section, {
    sectionRole: role,
    sectionPurpose: section.sectionPurpose || role,
    photoPriority: priority,
    minChecklistHits: minChecklistHits,
    searchKeywords: buildSearchKeywords(section),
    imageChecklist: Array.isArray(section.imageChecklist) ? section.imageChecklist : [],
    imageRejectRules: Array.isArray(section.imageRejectRules) ? section.imageRejectRules : [],
    metadataRole: section.metadataRole || role,
    captionIntent: section.captionIntent || 'Describe what the reader sees in the photo as a short story beat.',
    articleTheme: section.articleTheme || (articleContext && articleContext.articleTheme) || null,
    editorialAngle: section.editorialAngle || (articleContext && articleContext.editorialAngle) || null,
    readerPersona: section.readerPersona || (articleContext && articleContext.readerPersona) || null
  });
}

export function buildMetadataCapsule(section) {
  var role = section.metadataRole || resolveSectionRole(section);
  var keys = METADATA_BY_ROLE[role] || METADATA_BY_ROLE.landmark;
  var values = section.metadataValues || {};
  return keys.map(function (key) {
    var def = METADATA_LABELS[key];
    if (!def) return null;
    return {
      key: key,
      icon: def.icon,
      label: def.label,
      value: values[key] != null ? values[key] : null
    };
  }).filter(function (row) { return row && row.value; });
}

export function runEngineQA(section, photoResult, caption) {
  var issues = [];
  if (!section) return { pass: false, issues: ['missing_section'], usePlaceholder: true };
  if (!photoResult || !photoResult.googlePhotoUrl) {
    return { pass: false, issues: ['no_photo'], usePlaceholder: true, recommendation: 'use_placeholder' };
  }

  var role = resolveSectionRole(section);
  var blob = [
    photoResult.photoPlaceName,
    photoResult.googleAttribution,
    (photoResult.matchedKeywords || []).join(' ')
  ].join(' ').toLowerCase();

  var streetSignals = false;
  if (role === 'landmark' || role === 'opening' || role === 'explore') {
    streetSignals = /中央通|chuo|central|neon|霓虹|radio|ラジオ|animate|gigo|街|street|electric/i.test(blob);
    var shopOnly = /hobby|ホビー|figure only|模型店|mandarake interior|フィギュア店/i.test(blob) && !streetSignals;
    if (shopOnly) issues.push('landmark_shop_only');
  }

  if (role === 'anime' && /corridor|走道|廊下|empty mall/i.test(blob) && !/mandarake|figure|フィギュア|公仔|ガチャ|gachapon/i.test(blob)) {
    issues.push('anime_corridor_only');
  }

  if ((role === 'hotel' || role === 'hostel')) {
    if (/facade|exterior|外観|building only/i.test(blob) && !/lobby|room|bar|lounge|客房|dorm/i.test(blob)) {
      issues.push('hotel_exterior_only');
    }
  }

  if (role === 'cafe' && /logo|sign only|招牌のみ/i.test(blob) && !/dessert|甜點|drink|飲|パフェ/i.test(blob)) {
    issues.push('cafe_logo_only');
  }

  if (!caption || caption.length < 8) issues.push('caption_missing');
  if (caption && /一景。?$/.test(caption)) issues.push('caption_generic');

  return {
    pass: issues.length === 0,
    issues: issues,
    usePlaceholder: issues.some(function (i) {
      return i === 'landmark_shop_only' || i === 'hotel_exterior_only' || i === 'anime_corridor_only' || i === 'cafe_logo_only';
    }),
    recommendation: issues.length ? 'swap_image' : 'approve'
  };
}
