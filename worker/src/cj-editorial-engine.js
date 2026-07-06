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

/** Global photo priority by section role — travel guide order (exterior/street first) */
export var PHOTO_PRIORITY_BY_ROLE = {
  opening: {
    primary: ['城市代表景觀', 'iconic skyline', 'landmark panorama', 'hero view', 'street view'],
    secondary: ['地標建築', 'signature building', '街景', 'main street'],
    tertiary: ['入口', 'entrance']
  },
  landmark: {
    primary: ['街區全景', 'landmark panorama', 'main street', '中央通', 'street view', 'panorama'],
    secondary: ['地標建築', 'signature building', 'neon', '霓虹', 'crowd'],
    tertiary: ['入口', 'entrance']
  },
  explore: {
    primary: ['街區全景', 'district street', 'neighborhood', 'street view'],
    secondary: ['招牌霓虹', 'signage', 'crowd'],
    tertiary: ['入口', 'entrance']
  },
  experience: {
    primary: ['店面', 'venue front', 'storefront', 'exterior', '外觀'],
    secondary: ['體驗場景', 'activity', 'immersive interior'],
    tertiary: ['參與者', 'audience', 'atmosphere']
  },
  shopping: {
    primary: ['店面招牌', 'storefront', 'exterior', '外觀', 'facade'],
    secondary: ['商品展示', 'product display', 'merchandise wall'],
    tertiary: ['店內空間', 'shop interior']
  },
  anime: {
    primary: ['店面', 'storefront', 'district street', '外觀'],
    secondary: ['動漫展示', 'anime display', 'figure wall', 'signage wall'],
    tertiary: ['公仔展示', 'model shelf', 'manga wall', 'collectible']
  },
  food: {
    primary: ['店門口', 'storefront', 'exterior', '招牌', 'entrance', '外觀'],
    secondary: ['成品料理', 'finished dish', 'food close-up'],
    tertiary: ['店內吧台', 'dining counter', 'interior']
  },
  cafe: {
    primary: ['店外', 'storefront', 'exterior', '外觀', 'facade'],
    secondary: ['店內氛圍', 'cafe interior', 'seating'],
    tertiary: ['飲品甜點', 'dessert', 'drink', 'plate']
  },
  hotel: {
    primary: ['外觀', 'facade', 'exterior', 'building', '入口'],
    secondary: ['Lobby', 'lobby', 'lounge'],
    tertiary: ['客房', 'room', 'suite'],
    quaternary: ['公共空間', '公共區域']
  },
  hostel: {
    primary: ['外觀', 'facade', 'exterior', 'building', '入口'],
    secondary: ['Lobby', 'bar', 'lounge', '公共吧台', '交誼廳'],
    tertiary: ['客房', 'dorm', 'room']
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

  var subjectType = section.subjectType || (section.isSpecificVenue === false ? 'district' : 'venue');
  if (subjectType === 'district' || role === 'landmark' || role === 'opening' || role === 'explore') {
    ['street view', 'panorama', '街景', '全景'].forEach(push);
  } else if (role === 'food' || role === 'cafe' || role === 'hotel' || role === 'hostel') {
    ['exterior', 'storefront', 'facade', '外観'].forEach(push);
  } else {
    ['exterior', 'storefront', '外観'].forEach(push);
  }

  return out.slice(0, 40);
}

export function normalizeSection(section, articleContext) {
  var role = resolveSectionRole(section);
  var priority = resolvePhotoPriority(section);
  var subjectType = section.subjectType || (section.isSpecificVenue === true ? 'venue' : (section.isSpecificVenue === false ? 'district' : (role === 'landmark' || role === 'opening' ? 'district' : 'venue')));
  var minChecklistHits = section.minChecklistHits != null
    ? section.minChecklistHits
    : (section.requiredVisualMinGroups != null ? section.requiredVisualMinGroups : 2);

  var districtRejects = subjectType === 'district' ? [
    'hobby', 'ホビー', 'figure shop', '模型店', '店内', 'shop interior', 'mandarake', 'まんだらけ'
  ] : [];

  var copySemantics = analyzeCopySemantics(section);
  var derivedIntent = derivePhotoIntentFromSemantics(copySemantics);
  var mergedKeywords = buildSearchKeywords(section);
  (derivedIntent.keywords || []).forEach(function (kw) {
    if (mergedKeywords.indexOf(kw) === -1) mergedKeywords.push(kw);
  });

  return Object.assign({}, section, {
    sectionRole: role,
    sectionPurpose: section.sectionPurpose || role,
    subjectType: subjectType,
    photoPriority: priority,
    minChecklistHits: minChecklistHits,
    searchKeywords: mergedKeywords.slice(0, 48),
    copySemantics: copySemantics,
    copyDerivedPhotoIntent: derivedIntent.text,
    photoIntent: section.photoIntent || derivedIntent.text,
    imageChecklist: Array.isArray(section.imageChecklist) ? section.imageChecklist : [],
    imageRejectRules: Array.isArray(section.imageRejectRules)
      ? section.imageRejectRules.concat(districtRejects)
      : districtRejects.slice(),
    metadataRole: section.metadataRole || role,
    captionIntent: section.captionIntent || 'Describe only what is visible in the photo.',
    photoFirst: section.photoFirst !== false,
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

import {
  classifyPhotoEvidence,
  evidenceAllowedForSection,
  validateCaptionMatchesEvidence,
  validateLodgingVenueAttribution
} from './cj-photo-evidence.js';
import {
  analyzeCopySemantics,
  derivePhotoIntentFromSemantics,
  runGoldenRuleQA,
  EDITORIAL_GOLDEN_RULE
} from './cj-editorial-semantic.js';

export function runEngineQA(section, photoResult, caption, resolvedPlaceId) {
  return runGoldenRuleQA(section, photoResult, caption, section && section.copySemantics, resolvedPlaceId);
}

export { EDITORIAL_GOLDEN_RULE, analyzeCopySemantics, derivePhotoIntentFromSemantics };
export { TRAVEL_PHOTO_RULES, resolveTravelProfile, getTravelPhotoSlots } from './cj-travel-photo-rules.js';
export {
  buildPhotoSearchRetryPlan,
  createPhotoSearchDebug,
  SEARCH_PHASES,
  QUERY_SUFFIXES_BY_PROFILE
} from './cj-photo-search-strategy.js';
