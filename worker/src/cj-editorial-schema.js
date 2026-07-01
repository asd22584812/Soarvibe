/**
 * City Journal Editorial AI — generic schema & photo priority templates.
 * Not city-specific; Tokyo Anime is one consumer.
 */

export var SECTION_PURPOSES = [
  'landmark', 'food', 'cafe', 'shopping', 'hotel', 'hostel',
  'transport', 'culture', 'photospot', 'street', 'anime', 'nightlife'
];

/** Photo priority tiers by section purpose / type */
export var PHOTO_PRIORITY_BY_PURPOSE = {
  landmark: {
    primary: ['地標全景', 'landmark panorama', 'iconic view'],
    secondary: ['代表建築', 'signature building', 'facade'],
    tertiary: ['街景', 'street scene', 'neighborhood']
  },
  anime: {
    primary: ['主題店面', '動漫招牌', 'anime storefront', 'signage wall'],
    secondary: ['公仔牆', '模型櫃', 'figure display', 'manga shelf', 'gachapon wall'],
    tertiary: ['街區氛圍', 'district street', 'neon crowd']
  },
  food: {
    primary: ['成品料理', 'finished dish', 'food close-up'],
    secondary: ['店內吧台', 'dining counter', 'interior atmosphere'],
    tertiary: ['店門口', 'storefront', 'exterior sign']
  },
  cafe: {
    primary: ['甜點', 'dessert', 'themed interior'],
    secondary: ['店內氛圍', 'cafe interior'],
    tertiary: ['招牌', 'storefront']
  },
  shopping: {
    primary: ['商品陳列', 'product display', 'merchandise wall'],
    secondary: ['店內氛圍', 'shop interior'],
    tertiary: ['招牌', 'storefront']
  },
  hotel: {
    primary: ['Lobby', '客房', 'room', 'lobby'],
    secondary: ['公共空間', 'lounge', 'cafe'],
    tertiary: ['外觀', 'facade', 'exterior']
  },
  hostel: {
    primary: ['公共吧台', '交誼廳', 'bar lounge', 'dorm common'],
    secondary: ['Lobby', 'shared space'],
    tertiary: ['外觀', 'facade']
  },
  transport: {
    primary: ['路線', '車站', 'station', 'platform'],
    secondary: ['轉乘', 'transfer'],
    tertiary: ['方向感', 'wayfinding']
  },
  photospot: {
    primary: ['最佳構圖', 'hero angle', 'instagram view'],
    secondary: ['代表視角', 'signature angle'],
    tertiary: ['周邊氛圍', 'surroundings']
  },
  culture: {
    primary: ['文化體驗', 'ceremony', 'tradition'],
    secondary: ['建築細節', 'architecture'],
    tertiary: ['街景', 'street']
  },
  street: {
    primary: ['街區全景', 'street panorama'],
    secondary: ['招牌霓虹', 'signage neon'],
    tertiary: ['人潮', 'crowd']
  },
  nightlife: {
    primary: ['夜景霓虹', 'night neon'],
    secondary: ['店面', 'venue front'],
    tertiary: ['街景', 'street']
  }
};

export function resolveSectionPurpose(section) {
  if (section.sectionPurpose) return section.sectionPurpose;
  if (section.sectionType === 'landmark' && /動漫|anime|公仔|扭蛋|mandarake/i.test(
    String(section.photoIntent || '') + String(section.title || '')
  )) {
    return 'anime';
  }
  return section.sectionType || 'landmark';
}

export function resolvePhotoPriority(section) {
  if (section.photoPriority && section.photoPriority.primary) {
    return section.photoPriority;
  }
  var purpose = resolveSectionPurpose(section);
  var tpl = PHOTO_PRIORITY_BY_PURPOSE[purpose] || PHOTO_PRIORITY_BY_PURPOSE.landmark;
  return {
    primary: tpl.primary.slice(),
    secondary: tpl.secondary.slice(),
    tertiary: tpl.tertiary.slice()
  };
}

export function normalizeSection(section, articleContext) {
  var purpose = resolveSectionPurpose(section);
  var priority = resolvePhotoPriority(section);
  var minChecklistHits = section.minChecklistHits != null
    ? section.minChecklistHits
    : (section.requiredVisualMinGroups != null ? section.requiredVisualMinGroups : 3);

  return Object.assign({}, section, {
    sectionPurpose: purpose,
    photoPriority: priority,
    minChecklistHits: minChecklistHits,
    searchKeywords: buildSearchKeywords(section),
    imageChecklist: Array.isArray(section.imageChecklist) ? section.imageChecklist : [],
    imageRejectRules: Array.isArray(section.imageRejectRules) ? section.imageRejectRules : [],
    articleTheme: section.articleTheme || (articleContext && articleContext.articleTheme) || null,
    editorialAngle: section.editorialAngle || null,
    targetReader: section.targetReader || (articleContext && articleContext.targetReader) || null,
    storyline: section.storyline || (articleContext && articleContext.storyline) || null,
    captionIntent: section.captionIntent || 'Describe what the reader actually sees in the photo, not the section title.'
  });
}

export function buildSearchKeywords(section) {
  var seen = {};
  var out = [];

  function push(kw) {
    var k = String(kw || '').trim();
    if (!k || k.length < 2 || seen[k.toLowerCase()]) return;
    seen[k.toLowerCase()] = true;
    out.push(k);
  }

  (section.searchKeywords || []).forEach(push);
  (section.photoPlaceQueries || []).forEach(push);
  push(section.officialNameLocal);
  push(section.officialName);
  push(section.title);
  push(section.subject);
  (section.aliases || []).forEach(push);

  var intentParts = String(section.photoIntent || '')
    .split(/[、,，\/\|]+/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  intentParts.forEach(push);

  (section.imageChecklist || []).forEach(push);

  if (section.visualGroups) {
    section.visualGroups.forEach(function (group) {
      (group || []).forEach(push);
    });
  }

  return out.slice(0, 40);
}

export function normalizeArticle(article) {
  var ctx = {
    articleTheme: article.articleTheme || (article.editorialPlan && article.editorialPlan.theme) || null,
    targetReader: article.targetReader || null,
    storyline: article.storyline || (article.editorialPlan && article.editorialPlan.storyArc) || null,
    editorialAngle: article.editorialAngle || null
  };
  return ctx;
}
