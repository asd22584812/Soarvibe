/**
 * Photo First — classify image evidence from metadata only (zero vision tokens).
 * Caption and QA must follow evidence, never section wishful thinking.
 */
import { matchTerms, resolveSectionRole } from './cj-editorial-engine.js';
export var PHOTO_FIRST_RULES = {
  principle: 'Copy → semantic intent → pick photo → evidence caption → triple QA',
  supersededBy: 'EDITORIAL_GOLDEN_RULE — 圖片服務文案',
  global: [
    '圖片永遠服務文案',
    'Caption 只描述圖片可見內容',
    '找不到合格圖 → placeholder'
  ]
};

var STREET_SIGNALS = [
  'street', '街', 'chuo', '中央通', 'neon', '霓虹', 'crowd', '人潮',
  'radio kaikan', 'ラジオ会館', 'animate', 'アニメイト', 'gigo', 'ゲーセン',
  'electric town', '電気街', 'signage', '看板', 'panorama', 'landmark'
];

var SHOP_INTERIOR_SIGNALS = [
  'hobby', 'ホビー', 'figure', 'フィギュア', '模型', 'toy', 'mandarake', 'まんだらけ',
  'collectible', 'shop interior', '店内', 'shelf', '櫥窗', 'display case', '公仔'
];

var LOGO_ONLY_SIGNALS = ['logo', 'sign only', '招牌のみ', 'storefront only'];

var ROLE_EVIDENCE_PRIORITY = {
  opening: ['street_landmark', 'landmark_building', 'facade'],
  landmark: ['street_landmark', 'landmark_building', 'facade'],
  explore: ['street_landmark', 'landmark_building', 'facade'],
  anime: ['gachapon_wall', 'anime_collectible', 'shop_interior', 'street_landmark'],
  shopping: ['gachapon_wall', 'anime_collectible', 'shop_interior'],
  food: ['food_dish', 'dessert'],
  cafe: ['dessert', 'cafe_interior', 'food_dish'],
  hotel: ['room', 'lobby_bar', 'facade'],
  hostel: ['room', 'lobby_bar', 'facade']
};

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasSafeTerm(text, term) {
  if (!term) return false;
  var t = String(term).toLowerCase();
  if (t.length <= 3 && /^[a-z]+$/.test(t)) {
    return new RegExp('(?:^|[^a-z])' + escapeRegExp(t) + '(?:[^a-z]|$)', 'i').test(text);
  }
  return new RegExp(escapeRegExp(term), 'i').test(text);
}

function hasTerms(text, terms) {
  var matched = [];
  (terms || []).forEach(function (term) {
    if (hasSafeTerm(text, term)) matched.push(term);
  });
  return matched;
}

export function resolveSubjectType(section) {
  if (section.subjectType) return section.subjectType;
  var role = resolveSectionRole(section || {});
  if (section.isSpecificVenue === true) return 'venue';
  if (section.isSpecificVenue === false) return 'district';
  if (role === 'landmark' || role === 'opening' || role === 'explore') return 'district';
  return 'venue';
}

export function classifyPhotoEvidence(blob, section, options) {
  var text = String(blob || '').toLowerCase();
  var attrOnly = options && options.attrOnly ? String(options.attrOnly).toLowerCase() : text;
  var photoIndex = options && typeof options.photoIndex === 'number' ? options.photoIndex : -1;
  var role = resolveSectionRole(section || {});
  var subjectType = resolveSubjectType(section || {});

  [section && section.officialName, section && section.officialNameLocal, section && section.subject]
    .concat((section && section.aliases) || [])
    .forEach(function (name) {
      if (!name) return;
      text = text.replace(new RegExp(escapeRegExp(String(name)), 'ig'), ' ');
    });
  text = text.replace(/\s+/g, ' ').trim();

  var types = [];
  var signals = [];

  function has(terms) {
    var m = hasTerms(text, terms);
    if (m.length) signals = signals.concat(m);
    return m.length > 0;
  }

  if (has(STREET_SIGNALS)) types.push('street_landmark');
  if (
    has(['hobby', 'ホビー', 'figure shop', '模型店', '店内', 'shop interior', 'toy shop']) ||
    (has(['figure', 'フィギュア', '模型', 'mandarake', 'まんだらけ', '公仔', 'collectible']) &&
      !has(['radio kaikan', 'ラジオ会館', 'animate', 'アニメイト', 'gigo', 'ゲーセン', 'street', '街', 'neon', '霓虹']))
  ) {
    types.push('shop_interior');
  }
  if (has(['radio kaikan', 'ラジオ会館', 'animate', 'アニメイト', 'gigo', 'ゲーセン']) && types.indexOf('shop_interior') === -1) {
    types.unshift('landmark_building');
  }
  if (has(['room', '客房', 'dorm', 'bed', 'suite', '寝室', 'guest room', 'bedroom'])) types.push('room');
  if (has(['lobby', 'reception desk', '大廳', 'front desk', '交誼廳', '公共吧台', '公共空間'])) types.push('lobby_bar');
  if (hasSafeTerm(text, 'lounge') && has(['bartender', 'cocktail', 'bar counter', 'drink menu', 'カウンター', '吧台', 'カクテル', '調酒'])) {
    types.push('lobby_bar');
  }
  if (has(['bartender', 'cocktail', 'bar counter', 'drink menu', 'wine list', 'beer tap', 'カウンター', 'カクテル', '調酒'])) {
    types.push('lobby_bar');
  }
  if (has(['facade', 'exterior', '外観', 'building front', '外觀'])) types.push('facade');
  if (has(['ramen', 'ラーメン', 'noodle', 'dish', 'meal', 'food', '料理', '麺', 'soba', '拉麵'])) types.push('food_dish');
  if (has(['dessert', '甜點', 'パフェ', 'cake', 'parfait', 'drink', '飲', 'coffee', '咖啡'])) types.push('dessert');
  if (has(['ガチャ', 'gachapon', 'gashapon', 'capsule', '扭蛋', 'gachapon hall'])) types.push('gachapon_wall');
  if (has(['figure', 'フィギュア', 'manga', '漫画', 'mandarake', 'まんだらけ', 'collectible', '公仔'])) types.push('anime_collectible');
  if (has(['interior', '内装', 'seating', '座位', 'テーブル', 'table setting'])) types.push('cafe_interior');

  if (role === 'cafe' && types.indexOf('dessert') === -1 && types.indexOf('cafe_interior') === -1 && types.indexOf('food_dish') === -1) {
    if (/メイド|maid|カフェ|cafe|interior|内装|店内|seating|dessert|パフェ|drink|甜點|飲品/i.test(attrOnly)) {
      types.push('cafe_interior');
    }
    if (photoIndex >= 1 && /メイド|maid|カフェ|cafe|店|shop/i.test(attrOnly)) {
      types.push('cafe_interior');
    }
  }

  if (role === 'food' && types.indexOf('food_dish') === -1 && photoIndex >= 1) {
    if (/ramen|ラーメン|soba|noodle|food|meal|麺|拉麵|dish/i.test(attrOnly)) {
      types.push('food_dish');
    } else if (options && options.anchorVerified) {
      types.push('food_dish');
    }
  }

  if ((role === 'hotel' || role === 'hostel') && types.indexOf('room') === -1 && types.indexOf('lobby_bar') === -1) {
    if (photoIndex >= 1 && !has(['facade', 'exterior', '外観', 'building front', '外觀'])) {
      types.push('room');
    }
  }

  var venueName = [
    section && section.officialName,
    section && section.officialNameLocal,
    section && section.subject
  ].filter(Boolean).join(' ').toLowerCase();

  var attrLooksLikeVenueOnly = /店|館|hotel|hostel|cafe|カフェ|メイド|maid/i.test(text);
  var hasExperienceSignal = types.some(function (t) {
    return t !== 'facade' && t !== 'street_landmark';
  });

  if ((role === 'cafe' || role === 'food') && attrLooksLikeVenueOnly &&
      types.indexOf('dessert') === -1 && types.indexOf('cafe_interior') === -1 && types.indexOf('food_dish') === -1) {
    types.push('logo_only');
  }
  if (has(LOGO_ONLY_SIGNALS)) types.push('logo_only');

  if (!types.length) types.push('unknown');

  var primary = types[0];
  var roleOrder = ROLE_EVIDENCE_PRIORITY[role];
  if (roleOrder) {
    for (var ri = 0; ri < roleOrder.length; ri++) {
      if (types.indexOf(roleOrder[ri]) !== -1) {
        primary = roleOrder[ri];
        break;
      }
    }
  }

  return {
    primary: primary,
    types: types,
    signals: signals,
    subjectType: subjectType,
    role: role,
    blob: text
  };
}

export function evidenceAllowedForSection(evidence, section) {
  if (!evidence) return { ok: false, reason: 'no_evidence' };
  var role = resolveSectionRole(section || {});
  var subjectType = resolveSubjectType(section || {});
  var primary = evidence.primary;
  var types = evidence.types || [];

  if (primary === 'logo_only') return { ok: false, reason: 'logo_only' };
  if (primary === 'unknown') {
    if (section && (section.primaryVenueFailed || section.venueSwapped) &&
      (role === 'cafe' || role === 'hotel' || role === 'hostel')) {
      return { ok: true, reason: null };
    }
    return { ok: false, reason: 'unknown_evidence' };
  }

  if (subjectType === 'district' || role === 'opening') {
    if (types.indexOf('shop_interior') !== -1 && types.indexOf('street_landmark') === -1 && types.indexOf('landmark_building') === -1) {
      return { ok: false, reason: 'district_shop_interior' };
    }
    var districtVisual = types.some(function (t) {
      return t === 'street_landmark' || t === 'facade' || t === 'landmark_building';
    });
    if (!districtVisual) {
      return { ok: false, reason: 'district_no_street' };
    }
  }

  if (role === 'cafe') {
    if (types.indexOf('dessert') === -1 && types.indexOf('cafe_interior') === -1 && types.indexOf('food_dish') === -1) {
      return { ok: false, reason: 'cafe_no_experience' };
    }
  }

  if (role === 'food') {
    if (types.indexOf('food_dish') === -1) {
      return { ok: false, reason: 'food_no_dish' };
    }
  }

  if (role === 'anime') {
    var animeOk = types.indexOf('anime_collectible') !== -1 ||
      types.indexOf('gachapon_wall') !== -1 ||
      types.indexOf('shop_interior') !== -1;
    if (!animeOk) {
      return { ok: false, reason: 'anime_no_collectible' };
    }
  }

  if (role === 'shopping' && section && section.rejectExteriorPhoto) {
    if (primary === 'facade') return { ok: false, reason: 'shopping_exterior' };
  }

  if (role === 'hotel' || role === 'hostel') {
    if (section && (section.primaryVenueFailed || section.venueSwapped)) {
      if (primary !== 'logo_only') return { ok: true, reason: null };
    }
    if (types.indexOf('room') === -1 && types.indexOf('lobby_bar') === -1 && types.indexOf('facade') === -1) {
      return { ok: false, reason: 'lodging_no_interior' };
    }
  }

  return { ok: true, reason: null };
}

var CAPTION_BY_EVIDENCE = {
  landmark_building: {
    radio: 'Radio Kaikan 外牆滿版動漫廣告，是這條電氣街最醒目的地標之一。',
    animate: 'Animate 本館前人潮與招牌交織，電氣街節奏從這裡開始。',
    gigo: 'GIGO 大型看板矗立街頭，是電氣街一眼辨識的地標。',
    default: '地標建築外牆與大型招牌清楚可見，街區個性一眼可辨。'
  },
  street_landmark: {
    radio: 'Radio Kaikan 外牆滿版動漫廣告，是這條電氣街最醒目的地標之一。',
    chuo: '中央通兩旁的動漫招牌與霓虹，是電氣街最具代表性的街景。',
    animate: 'Animate 本館前人潮與招牌交織，電氣街節奏從這裡開始。',
    gigo: 'GIGO 大型看板矗立街頭，是電氣街一眼辨識的地標。',
    default: '街道兩側動漫招牌與霓虹交織，街區氛圍一眼可見。'
  },
  anime_collectible: {
    mandarake: 'Mandarake 櫥窗擺滿模型與收藏品，是動漫迷最容易停下腳步的地方。',
    figure: '玻璃櫥窗內公仔與模型一字排開，像一座小型展覽。',
    default: '架上收藏品層層陳列，翻找過程本身就是樂趣。'
  },
  gachapon_wall: {
    default: '整排扭蛋機一路延伸，色彩與機台本身就是風景。'
  },
  food_dish: {
    ramen: '醬油湯頭與麵一同上桌，熱氣與香氣先於店名被記住。',
    default: '料理本體即是最好的招牌，擺上桌的瞬間最說明這家店。'
  },
  dessert: {
    default: '精緻甜點與飲品擺上桌面，店內氛圍比 Logo 更能說明體驗。'
  },
  cafe_interior: {
    default: '主題內裝與座位區呈現店內氛圍，一眼就知道這是主題咖啡廳。'
  },
  room: {
    default: '客房採簡約木質設計，採光充足，空間雖緊湊但收納完整。'
  },
  lobby_bar: {
    default: '公共吧台與交誼空間，是旅人交流最頻繁的角落。'
  },
  facade: {
    hotel: '飯店外觀清楚標示位置，步行至車站的路線直覺。',
    default: '建築外觀標示清楚，方便確認是否抵達正確地點。'
  }
};

function pickVariant(map, blob) {
  if (!map) return null;
  if (/radio|ラジオ/i.test(blob) && map.radio) return map.radio;
  if (/chuo|中央通/i.test(blob) && map.chuo) return map.chuo;
  if (/animate|アニメイト/i.test(blob) && map.animate) return map.animate;
  if (/gigo|ゲーセン/i.test(blob) && map.gigo) return map.gigo;
  if (/mandarake|まんだらけ/i.test(blob) && map.mandarake) return map.mandarake;
  if (/figure|フィギュア|公仔/i.test(blob) && map.figure) return map.figure;
  if (/ramen|ラーメン|soba|拉麵/i.test(blob) && map.ramen) return map.ramen;
  if (/washington|ワシントン|hotel|ホテル/i.test(blob) && map.hotel) return map.hotel;
  return map.default || null;
}

export function captionFromEvidence(evidence, section, ctx) {
  if (!evidence || !evidence.primary) return null;
  var blob = [
    evidence.blob,
    ctx && ctx.photoAttribution,
    ctx && ctx.photoPlaceName
  ].join(' ').toLowerCase();

  var caption = pickVariant(CAPTION_BY_EVIDENCE[evidence.primary], blob);
  return caption || null;
}

/** Caption must not claim visuals absent from evidence. */
export function validateCaptionMatchesEvidence(caption, evidence) {
  if (!caption || !evidence) return { ok: false, reason: 'missing' };
  var cap = String(caption);
  var types = evidence.types || [evidence.primary];

  var claims = [
    { pattern: /吧台|夜間|夜晚|night/i, need: 'lobby_bar' },
    { pattern: /Lobby|大廳|交誼|公共吧台/i, need: 'lobby_bar' },
    { pattern: /客房|房間|dorm|採光|收納/i, need: 'room' },
    { pattern: /霓虹|街景|中央通|電氣街|地標|外牆/i, need: 'street_landmark', also: ['landmark_building', 'facade'] },
    { pattern: /甜點|dessert|飲品|パフェ/i, need: 'dessert' },
    { pattern: /拉麵|湯頭|麵|ramen|soba/i, need: 'food_dish' },
    { pattern: /扭蛋|gachapon|膠囊/i, need: 'gachapon_wall' },
    { pattern: /櫥窗|公仔|模型|Mandarake/i, need: 'anime_collectible' }
  ];

  for (var i = 0; i < claims.length; i++) {
    if (!claims[i].pattern.test(cap)) continue;
    var okTypes = [claims[i].need].concat(claims[i].also || []);
    var matched = okTypes.some(function (t) { return types.indexOf(t) !== -1; });
    if (!matched) {
      return { ok: false, reason: 'caption_claims_' + claims[i].need };
    }
  }

  if (/一景。?$/.test(cap)) return { ok: false, reason: 'caption_generic' };
  if (cap.length < 10) return { ok: false, reason: 'caption_too_short' };

  return { ok: true, reason: null };
}

export function validateLodgingVenueAttribution(attribution, section) {
  var role = resolveSectionRole(section || {});
  if (role !== 'hotel' && role !== 'hostel') return { ok: true };
  var attr = String(attribution || '');
  if (!attr) return { ok: false, reason: 'lodging_no_attribution' };

  var terms = [
    section.officialNameLocal,
    section.officialName,
    section.subject
  ].concat(section.aliases || []).concat(section.photoAnchorTerms || []).filter(Boolean);

  var matched = matchTerms(attr, terms);
  if (!matched.length) {
    return { ok: false, reason: 'lodging_venue_mismatch', attribution: attr };
  }
  return { ok: true };
}
