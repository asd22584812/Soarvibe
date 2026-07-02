/**
 * Editorial Semantic Matching — copy is source of truth (Golden Rule).
 * Zero-token rule analysis of section copy → photo intent → image QA.
 */
import { matchTerms, resolveSectionRole } from './cj-editorial-engine.js';
import {
  classifyPhotoEvidence,
  evidenceAllowedForSection,
  validateCaptionMatchesEvidence,
  validateLodgingVenueAttribution
} from './cj-photo-evidence.js';

export var EDITORIAL_GOLDEN_RULE = {
  principle: '圖片永遠服務文案；若原訂地點無合格圖，可改寫文案並換成同類型替代地點。',
  rules: [
    '如果圖片無法支撐文案，請重新搜尋圖片',
    '若原訂地點仍無合格圖，依 venueAlternatives 換成同類型知名地點並改寫文案',
    '改寫後文案必須與新地點、新圖片一致',
    '如果仍找不到，寧可 placeholder，也不要放錯圖',
    'Caption 只能描述圖片中真正看得到的內容',
    '住宿圖片必須驗證 Hotel Name 與 Place ID',
    '景點圖片必須驗證 Landmark',
    '美食圖片必須驗證 Dish',
    '體驗圖片必須驗證 Activity',
    '否則 Editorial QA 一律 FAIL'
  ]
};

/** Semantic categories editors care about */
export var SEMANTIC_CATEGORIES = [
  'street_scene', 'landmark', 'storefront', 'shop_collectible',
  'gachapon', 'dish', 'dessert', 'cafe_experience', 'lobby', 'room', 'night', 'activity'
];

var CATEGORY_DEFS = [
  {
    category: 'street_scene',
    evidence: ['street_landmark', 'landmark_building'],
    terms: ['街景', '電氣街', '中央通', '霓虹', '人潮', '街區', '一整片', '兩側', '招牌', 'electric town', 'chuo', '掃街', '廣角']
  },
  {
    category: 'landmark',
    evidence: ['landmark_building', 'street_landmark'],
    terms: ['地標', 'radio kaikan', 'ラジオ会館', 'animate', 'gigo', '一眼', '代表性', '朝聖']
  },
  {
    category: 'night',
    evidence: ['street_landmark', 'landmark_building'],
    terms: ['夜景', '霓虹亮起', '傍晚', '夜間', 'night', 'neon']
  },
  {
    category: 'shop_collectible',
    evidence: ['anime_collectible', 'shop_interior'],
    terms: ['mandarake', '公仔', '模型', '挖寶', '收藏', '漫畫', '櫥窗', '中古', 'figure', 'まんだらけ']
  },
  {
    category: 'gachapon',
    evidence: ['gachapon_wall'],
    terms: ['扭蛋', 'gachapon', '膠囊', '機台', 'ガチャ', 'capsule']
  },
  {
    category: 'dish',
    evidence: ['food_dish'],
    terms: ['拉麵', '湯頭', '醬油', '料理', '麵', '餐點', '用餐', '熱湯', 'ramen', 'soba', 'ラーメン', '補給']
  },
  {
    category: 'dessert',
    evidence: ['dessert', 'cafe_interior'],
    terms: ['甜點', '飲品', 'パフェ', 'dessert', '蛋糕']
  },
  {
    category: 'cafe_experience',
    evidence: ['dessert', 'cafe_interior'],
    terms: ['女僕', '咖啡', '主題內裝', '氛圍', 'maid', 'カフェ', '體驗']
  },
  {
    category: 'lobby',
    evidence: ['lobby_bar'],
    terms: ['吧台', '交誼', 'lobby', 'lounge', '公共空間', '交流', '聚集']
  },
  {
    category: 'room',
    evidence: ['room'],
    terms: ['客房', '房間', '床位', '入住', 'dorm', '採光', '收納', '簡潔', '休息']
  },
  {
    category: 'storefront',
    evidence: ['facade', 'landmark_building'],
    terms: ['外觀', '店面', '招牌', 'storefront', 'facade']
  },
  {
    category: 'activity',
    evidence: ['cafe_interior', 'anime_collectible', 'shop_interior'],
    terms: ['體驗', '沉浸', '參與', 'activity', '巡禮']
  }
];

var EVIDENCE_FOR_ROLE = {
  hotel: ['room', 'lobby_bar', 'facade'],
  hostel: ['room', 'lobby_bar', 'facade'],
  food: ['food_dish'],
  cafe: ['dessert', 'cafe_interior'],
  landmark: ['street_landmark', 'landmark_building'],
  opening: ['street_landmark', 'landmark_building'],
  anime: ['anime_collectible', 'gachapon_wall', 'shop_interior'],
  shopping: ['gachapon_wall', 'anime_collectible', 'shop_interior'],
  experience: ['cafe_interior', 'anime_collectible', 'shop_interior']
};

function copyBlob(section) {
  return [
    section.heading,
    section.content,
    section.editorialAngle,
    section.subject,
    section.title
  ].filter(Boolean).join(' ');
}

export function analyzeCopySemantics(section) {
  var blob = copyBlob(section || {});
  var role = resolveSectionRole(section || {});
  var hits = [];
  var requiredEvidence = [];
  var searchBoost = [];
  var i;
  var def;
  var score;
  var matched;

  for (i = 0; i < CATEGORY_DEFS.length; i++) {
    def = CATEGORY_DEFS[i];
    matched = matchTerms(blob, def.terms);
    if (!matched.length) continue;
    score = matched.length;
    hits.push({
      category: def.category,
      score: score,
      matched: matched,
      evidence: def.evidence.slice()
    });
    def.evidence.forEach(function (ev) {
      if (requiredEvidence.indexOf(ev) === -1) requiredEvidence.push(ev);
    });
    matched.forEach(function (m) {
      if (searchBoost.indexOf(m) === -1) searchBoost.push(m);
    });
  }

  hits.sort(function (a, b) { return b.score - a.score; });

  var primary = hits.length ? hits[0].category : null;
  if (!primary) {
    var roleEv = EVIDENCE_FOR_ROLE[role];
    if (roleEv) requiredEvidence = roleEv.slice();
    primary = role === 'food' ? 'dish' : (role === 'hotel' || role === 'hostel' ? 'room' : 'landmark');
  }

  return {
    primary: primary,
    categories: hits.map(function (h) { return h.category; }),
    hits: hits,
    requiredEvidence: requiredEvidence,
    searchBoost: searchBoost,
    copyExcerpt: blob.slice(0, 280)
  };
}

export function derivePhotoIntentFromSemantics(semantics) {
  if (!semantics) return { text: '', keywords: [] };
  var labels = {
    street_scene: '街景、霓虹、人潮、地標建築外觀',
    landmark: '地標建築、代表性招牌、街區辨識點',
    night: '夜景霓虹、傍晚街景',
    shop_collectible: '商品陳列、公仔模型、收藏櫥窗',
    gachapon: '整排扭蛋機、扭蛋牆',
    dish: '成品料理、餐點本體',
    dessert: '甜點、飲品',
    cafe_experience: '店內氛圍、甜點、主題內裝',
    lobby: 'Lobby、公共吧台、交誼空間',
    room: '客房、房間、床位空間',
    storefront: '店面外觀',
    activity: '體驗場景、店內活動'
  };
  var text = labels[semantics.primary] || '與段落文案一致的視覺主體';
  if (semantics.hits.length > 1) {
    text = semantics.hits.slice(0, 2).map(function (h) {
      return labels[h.category] || h.category;
    }).join('、');
  }
  return { text: text, keywords: semantics.searchBoost.slice(0, 12) };
}

function requiredEvidenceForSemantics(semantics) {
  if (!semantics) return [];
  if (semantics.hits && semantics.hits.length) {
    var primaryHit = null;
    for (var i = 0; i < semantics.hits.length; i++) {
      if (semantics.hits[i].category === semantics.primary) {
        primaryHit = semantics.hits[i];
        break;
      }
    }
    if (primaryHit) return primaryHit.evidence.slice();
    return semantics.hits[0].evidence.slice();
  }
  return semantics.requiredEvidence || [];
}

function lodgingAllowsRoomOrLobby(semantics) {
  if (!semantics || !semantics.categories) return false;
  return semantics.categories.indexOf('room') !== -1 && semantics.categories.indexOf('lobby') !== -1;
}

export function evidenceMatchesCopySemantics(evidence, semantics, section) {
  if (!semantics || !evidence) return { ok: false, reason: 'missing_semantics_or_evidence' };
  var types = evidence.types || [evidence.primary];
  var required = requiredEvidenceForSemantics(semantics);
  if (!required.length) return { ok: true, reason: null };

  if (section && section.subjectType === 'district') {
    if (types.indexOf('street_landmark') !== -1 || types.indexOf('landmark_building') !== -1 || types.indexOf('facade') !== -1) {
      return { ok: true, reason: null };
    }
    if (types.indexOf('shop_interior') !== -1 || types.indexOf('anime_collectible') !== -1) {
      var districtBlob = [
        evidence.blob,
        (section.searchKeywords || []).join(' '),
        section.officialName,
        section.officialNameLocal
      ].join(' ');
      if (/radio|ラジオ|animate|アニメイト|gigo|mandarake|まんだらけ|中央通|chuo|neon|霓虹/i.test(districtBlob)) {
        return { ok: true, reason: null };
      }
    }
  }

  if (section && (section.venueSwapped || section.primaryVenueFailed)) {
    var swapRole = resolveSectionRole(section);
    if (swapRole === 'cafe') {
      var cafeOk = types.indexOf('cafe_interior') !== -1 || types.indexOf('dessert') !== -1;
      if (cafeOk && (semantics.primary === 'cafe_experience' || semantics.primary === 'dessert' || semantics.primary === 'activity')) {
        return { ok: true, reason: null };
      }
    }
    if (swapRole === 'hotel' || swapRole === 'hostel') {
      return { ok: true, reason: null };
    }
  }

  var matched = required.some(function (ev) { return types.indexOf(ev) !== -1; });
  if (!matched) {
    if ((semantics.primary === 'street_scene' || semantics.primary === 'landmark') &&
        (types.indexOf('landmark_building') !== -1 || types.indexOf('street_landmark') !== -1 || types.indexOf('facade') !== -1)) {
      matched = true;
    }
  }
  if (!matched) {
    return { ok: false, reason: 'copy_image_semantic_mismatch' };
  }

  if (semantics.primary === 'street_scene' || semantics.primary === 'landmark' || semantics.primary === 'night') {
    if (types.indexOf('shop_interior') !== -1 && types.indexOf('street_landmark') === -1 && types.indexOf('landmark_building') === -1) {
      return { ok: false, reason: 'copy_wants_street_got_shop' };
    }
  }

  var dualLodging = lodgingAllowsRoomOrLobby(semantics);
  if (!dualLodging && semantics.primary === 'room' && types.indexOf('lobby_bar') !== -1 && types.indexOf('room') === -1) {
    return { ok: false, reason: 'copy_wants_room_got_lobby' };
  }

  if (!dualLodging && semantics.primary === 'lobby' && types.indexOf('room') !== -1 && types.indexOf('lobby_bar') === -1) {
    return { ok: false, reason: 'copy_wants_lobby_got_room' };
  }

  if (semantics.primary === 'dish' && types.indexOf('food_dish') === -1) {
    return { ok: false, reason: 'copy_wants_dish' };
  }

  return { ok: true, reason: null };
}

export function validatePlaceIdMatch(section, resolvedPlaceId) {
  if (!section || !section.placeId) return { ok: true };
  var role = resolveSectionRole(section);
  if (role !== 'hotel' && role !== 'hostel') return { ok: true };
  var expected = String(section.placeId).replace(/^places\//, '').trim();
  var actual = String(resolvedPlaceId || '').replace(/^places\//, '').trim();
  if (!actual || expected !== actual) {
    return { ok: false, reason: 'lodging_place_id_mismatch' };
  }
  return { ok: true };
}

export function validateLandmarkForCopy(section, evidence, semantics) {
  var role = resolveSectionRole(section || {});
  if (role !== 'landmark' && role !== 'opening' && role !== 'explore') return { ok: true };
  if (section.subjectType !== 'district' && semantics && semantics.primary !== 'street_scene' && semantics.primary !== 'landmark') {
    return { ok: true };
  }
  var types = (evidence && evidence.types) || [];
  var ok = types.indexOf('street_landmark') !== -1 || types.indexOf('landmark_building') !== -1;
  if (!ok) return { ok: false, reason: 'landmark_not_verified' };
  return { ok: true };
}

export function validateDishForCopy(section, evidence) {
  if (resolveSectionRole(section) !== 'food') return { ok: true };
  var types = (evidence && evidence.types) || [];
  if (types.indexOf('food_dish') === -1) return { ok: false, reason: 'dish_not_verified' };
  return { ok: true };
}

export function validateActivityForCopy(section, evidence, semantics) {
  var role = resolveSectionRole(section);
  if (role !== 'experience' && role !== 'cafe' && !(semantics && semantics.primary === 'activity')) {
    return { ok: true };
  }
  if (semantics && semantics.primary === 'activity') {
    var types = (evidence && evidence.types) || [];
    var ok = types.indexOf('cafe_interior') !== -1 || types.indexOf('anime_collectible') !== -1 || types.indexOf('shop_interior') !== -1;
    if (!ok) return { ok: false, reason: 'activity_not_verified' };
  }
  return { ok: true };
}

/** Triple QA: copy semantics ↔ image evidence ↔ caption */
export function runGoldenRuleQA(section, photoResult, caption, semantics, resolvedPlaceId) {
  var issues = [];
  if (!section) {
    return { pass: false, issues: ['missing_section'], usePlaceholder: true, goldenRule: EDITORIAL_GOLDEN_RULE };
  }
  if (!photoResult || !photoResult.googlePhotoUrl) {
    return {
      pass: false,
      issues: ['no_photo'],
      usePlaceholder: true,
      recommendation: 'use_placeholder',
      goldenRule: EDITORIAL_GOLDEN_RULE
    };
  }

  var blob = [
    photoResult.photoPlaceName,
    photoResult.googleAttribution,
    (photoResult.matchedKeywords || []).join(' ')
  ].join(' ').toLowerCase();

  var evidence = photoResult.photoEvidence || classifyPhotoEvidence(blob, section);
  var evidenceOk = evidenceAllowedForSection(evidence, section);
  if (!evidenceOk.ok) issues.push(evidenceOk.reason);

  var sem = semantics || section.copySemantics || analyzeCopySemantics(section);

  var semOk = evidenceMatchesCopySemantics(evidence, sem, section);
  if (!semOk.ok) issues.push(semOk.reason);

  var lodging = validateLodgingVenueAttribution(photoResult.googleAttribution, section);
  if (!lodging.ok && !(section && section.venueSwapped)) issues.push(lodging.reason);

  var placeOk = validatePlaceIdMatch(section, resolvedPlaceId || photoResult.placeId);
  if (!placeOk.ok) issues.push(placeOk.reason);

  var landmarkOk = validateLandmarkForCopy(section, evidence, sem);
  if (!landmarkOk.ok) issues.push(landmarkOk.reason);

  var dishOk = validateDishForCopy(section, evidence);
  if (!dishOk.ok) issues.push(dishOk.reason);

  var activityOk = validateActivityForCopy(section, evidence, sem);
  if (!activityOk.ok) issues.push(activityOk.reason);

  if (!caption || caption.length < 8) issues.push('caption_missing');
  var capOk = validateCaptionMatchesEvidence(caption, evidence);
  if (!capOk.ok) issues.push(capOk.reason);

  var capCopyOk = evidenceMatchesCopySemantics(
    { types: inferCaptionEvidenceTypes(caption) },
    sem,
    section
  );
  if (!capCopyOk.ok && section && section.venueSwapped && capOk.ok) {
    capCopyOk = { ok: true, reason: null };
  }
  if (!capCopyOk.ok) issues.push('caption_copy_mismatch');

  var hardFail = [
    'copy_image_semantic_mismatch', 'copy_wants_street_got_shop', 'copy_wants_room_got_lobby',
    'copy_wants_lobby_got_room', 'copy_wants_dish', 'lodging_venue_mismatch', 'lodging_place_id_mismatch',
    'landmark_not_verified', 'dish_not_verified', 'activity_not_verified', 'caption_copy_mismatch',
    'logo_only', 'unknown_evidence'
  ];

  return {
    pass: issues.length === 0,
    issues: issues,
    photoEvidence: evidence,
    copySemantics: sem,
    usePlaceholder: issues.some(function (i) { return hardFail.indexOf(i) !== -1; }),
    recommendation: issues.length ? 'swap_image' : 'approve',
    goldenRule: EDITORIAL_GOLDEN_RULE,
    modifyCopy: false
  };
}

function inferCaptionEvidenceTypes(caption) {
  var cap = String(caption || '');
  var types = [];
  if (/霓虹|街景|中央通|電氣街|地標|外牆/i.test(cap)) types.push('street_landmark', 'landmark_building');
  if (/扭蛋|gachapon/i.test(cap)) types.push('gachapon_wall');
  if (/拉麵|湯頭|麵|ramen/i.test(cap)) types.push('food_dish');
  if (/甜點|飲品/i.test(cap)) types.push('dessert');
  if (/吧台|交誼|lobby/i.test(cap)) types.push('lobby_bar');
  if (/客房|房間|採光|收納/i.test(cap)) types.push('room');
  if (/櫥窗|公仔|模型|Mandarake/i.test(cap)) types.push('anime_collectible');
  return types;
}
