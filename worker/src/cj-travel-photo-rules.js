/**
 * SoarVibe Travel Photo Rules — global, city-agnostic.
 * Pick what tourists want to see first, not just "is this the place".
 */
import { resolveSectionRole } from './cj-editorial-engine.js';
import { resolveSubjectType } from './cj-photo-evidence.js';
import { TRAVEL_PHOTO_RULES, TRAVEL_SEARCH_HINTS } from './cj-travel-rules-data.js';

export { TRAVEL_PHOTO_RULES };

/** Tourist viewing priority — slot order per profile */
var PHOTO_SLOTS = {
  district: [
    {
      id: 'district_panorama',
      accept: ['street_landmark', 'landmark_building'],
      alsoAccept: ['facade'],
      rejectPrimary: ['shop_interior', 'food_dish', 'room', 'dessert', 'logo_only', 'gachapon_wall', 'anime_collectible'],
      preferIndexMax: 4,
      minRatio: 1.0
    }
  ],
  shop: [
    {
      id: 'storefront',
      accept: ['facade', 'landmark_building'],
      rejectPrimary: ['shop_interior', 'food_dish', 'dessert', 'gachapon_wall', 'anime_collectible'],
      preferIndexMax: 1
    },
    {
      id: 'interior',
      accept: ['shop_interior', 'anime_collectible', 'gachapon_wall'],
      minIndex: 1
    }
  ],
  restaurant: [
    {
      id: 'storefront',
      accept: ['facade', 'landmark_building'],
      alsoAccept: ['street_landmark'],
      rejectPrimary: ['food_dish'],
      preferIndexMax: 2
    },
    {
      id: 'dish',
      accept: ['food_dish'],
      minIndex: 1
    }
  ],
  cafe: [
    {
      id: 'storefront',
      accept: ['facade', 'landmark_building'],
      alsoAccept: ['street_landmark'],
      rejectPrimary: ['dessert', 'cafe_interior', 'food_dish'],
      preferIndexMax: 2
    },
    {
      id: 'experience',
      accept: ['cafe_interior', 'dessert'],
      minIndex: 1
    }
  ],
  hotel: [
    {
      id: 'exterior',
      accept: ['facade', 'landmark_building'],
      alsoAccept: ['street_landmark'],
      rejectPrimary: ['room', 'lobby_bar', 'food_dish'],
      preferIndexMax: 2
    },
    {
      id: 'lobby',
      accept: ['lobby_bar'],
      rejectPrimary: ['room'],
      minIndex: 1
    },
    {
      id: 'room',
      accept: ['room'],
      minIndex: 2
    }
  ],
  hostel: [
    {
      id: 'exterior',
      accept: ['facade', 'landmark_building'],
      alsoAccept: ['street_landmark'],
      rejectPrimary: ['room', 'lobby_bar'],
      preferIndexMax: 2
    },
    {
      id: 'commons',
      accept: ['lobby_bar'],
      minIndex: 1
    },
    {
      id: 'room',
      accept: ['room'],
      minIndex: 2
    }
  ],
  gachapon: [
    {
      id: 'storefront',
      accept: ['facade'],
      rejectPrimary: ['gachapon_wall', 'shop_interior'],
      preferIndexMax: 1
    },
    {
      id: 'wall',
      accept: ['gachapon_wall', 'shop_interior'],
      minIndex: 0
    }
  ]
};

var COPY_EVIDENCE_CLAIMS = [
  { pattern: /Lobby|lobby|大廳|交誼|吧台|公共空間|lounge|公共吧台/i, need: 'lobby_bar' },
  { pattern: /街景|電氣街|中央通|霓虹|人潮|全景|panorama|street scene|電器街/i, need: 'street_landmark', also: ['landmark_building', 'facade'] },
  { pattern: /外觀|入口|建築|facade|exterior|外牆/i, need: 'facade', also: ['street_landmark', 'landmark_building'] },
  { pattern: /客房|房間|床位|dorm|suite|採光|收納/i, need: 'room' },
  { pattern: /女僕|maid|メイド/i, need: 'cafe_interior', also: ['dessert'], blobNeed: /maid|メイド|女僕/i },
  { pattern: /拉麵|湯頭|麵|ramen|soba|餐點|料理|dish/i, need: 'food_dish' },
  { pattern: /甜點|飲品|dessert|パフェ|parfait/i, need: 'dessert', also: ['cafe_interior'] },
  { pattern: /扭蛋|gachapon|膠囊/i, need: 'gachapon_wall', also: ['shop_interior'] },
  { pattern: /櫥窗|公仔|模型|Mandarake|figure/i, need: 'anime_collectible', also: ['shop_interior'] }
];

export function resolveTravelProfile(section) {
  var subjectType = resolveSubjectType(section || {});
  var role = resolveSectionRole(section || {});

  if (subjectType === 'district' || role === 'opening') return 'district';
  if (section.sectionType === 'landmark' && section.isSpecificVenue !== true) return 'district';
  if (role === 'landmark' || role === 'explore') {
    if (subjectType === 'venue') return 'shop';
    return 'district';
  }
  if (role === 'food' || section.sectionType === 'food') return 'restaurant';
  if (role === 'cafe' || section.sectionType === 'cafe') return 'cafe';
  if (role === 'hotel' || section.sectionType === 'hotel') return 'hotel';
  if (role === 'hostel' || section.sectionType === 'hostel') return 'hostel';
  if (/gachapon|ガチャ|扭蛋|capsule/i.test(
    (section.subject || '') + (section.officialName || '') + (section.officialNameLocal || '') + (section.sectionId || '')
  )) {
    return 'gachapon';
  }
  if (role === 'night') return 'district';
  return 'shop';
}

export function getTravelPhotoSlots(section, options) {
  var profile = resolveTravelProfile(section);
  var slots = PHOTO_SLOTS[profile] || PHOTO_SLOTS.shop;
  var primaryOnly = !options || options.primaryOnly !== false;
  if (primaryOnly) return [slots[0]];
  return slots.slice();
}

function photoRatio(photo) {
  var w = (photo && photo.widthPx) || 0;
  var h = (photo && photo.heightPx) || 0;
  if (!w || !h) return 1.5;
  return w / h;
}

function typesMatchSlot(types, primary, slot) {
  var accept = (slot.accept || []).concat(slot.alsoAccept || []);
  if (accept.indexOf(primary) !== -1) return true;
  for (var i = 0; i < accept.length; i++) {
    if (types.indexOf(accept[i]) !== -1) return true;
  }
  return false;
}

export function validateTravelSlotGate(evidence, photoIndex, slot, section, photo, options) {
  if (!evidence || !slot) return { ok: false, reason: 'travel_no_evidence' };
  var types = evidence.types || [];
  var primary = evidence.primary;
  var idx = typeof photoIndex === 'number' ? photoIndex : 0;
  var fallbackSlot = options && options.fallbackSlot;

  if (slot.rejectPrimary && slot.rejectPrimary.indexOf(primary) !== -1) {
    return { ok: false, reason: 'travel_reject_primary_' + primary };
  }

  if (!typesMatchSlot(types, primary, slot)) {
    return { ok: false, reason: 'travel_slot_type_mismatch' };
  }

  if (slot.preferIndexMax != null && idx > slot.preferIndexMax) {
    return { ok: false, reason: 'travel_index_too_late' };
  }
  if (slot.minIndex != null && idx < slot.minIndex && !fallbackSlot) {
    return { ok: false, reason: 'travel_index_too_early' };
  }

  if (slot.minRatio && photo) {
    if (photoRatio(photo) < slot.minRatio) {
      return { ok: false, reason: 'travel_ratio_too_narrow' };
    }
  }

  var profile = resolveTravelProfile(section || {});
  if (profile === 'district' && types.indexOf('shop_interior') !== -1 &&
      types.indexOf('street_landmark') === -1 && types.indexOf('landmark_building') === -1) {
    return { ok: false, reason: 'travel_district_shop_only' };
  }

  return { ok: true, reason: null, slotId: slot.id };
}

export function applyTravelScoreBonus(score, photo, evidence, section) {
  if (!evidence || !section) return score;
  var slots = getTravelPhotoSlots(section, { primaryOnly: true });
  if (!slots.length) return score;
  var idx = typeof photo._index === 'number' ? photo._index : 0;
  var slotGate = validateTravelSlotGate(evidence, idx, slots[0], section, photo);
  if (slotGate.ok) score += 45;
  else score -= 28;
  return score;
}

export function validateDistrictPhotoQuality(evidence, section, placeName) {
  if (resolveTravelProfile(section || {}) !== 'district') return { ok: true, reason: null };
  var types = (evidence && evidence.types) || [];
  var meta = [
    evidence && evidence.blob,
    (evidence && evidence.signals || []).join(' '),
    types.join(' '),
    placeName
  ].filter(Boolean).join(' ').toLowerCase();

  // District paragraphs need outdoor streetscape — reject interiors hard.
  if (types.indexOf('shop_interior') !== -1 || types.indexOf('cafe_interior') !== -1 ||
      types.indexOf('gachapon_wall') !== -1 || types.indexOf('food_dish') !== -1 ||
      types.indexOf('dessert') !== -1 || types.indexOf('room') !== -1) {
    if (types.indexOf('street_landmark') === -1 && types.indexOf('landmark_building') === -1) {
      return { ok: false, reason: 'travel_district_interior' };
    }
  }
  if (/video gamer|tokyo video|arcade bar|bar counter|室内|indoor|interior|店内|ゲーセン内|ピンボール|bar stool|ネオンバー/i.test(meta)) {
    return { ok: false, reason: 'travel_district_indoor_bar' };
  }
  if (/grocery|supermarket|market|食材|物產|物産|vegetable|菜市|幸福物産|produce|青果|八百屋|スーパー/i.test(meta)) {
    return { ok: false, reason: 'travel_district_grocery' };
  }
  if (/poster|海報|ポスター|flyer|チラシ|menu board only/i.test(meta) &&
      !/street|街|neon|霓虹|facade|外観|crossing|交差点/i.test(meta)) {
    return { ok: false, reason: 'travel_district_poster_only' };
  }
  if (/cozy|コージー|cake|ベーカリー|bakery|パン|甜點店|café|cafe|カフェ|food_dish|dessert/i.test(meta)) {
    if (!/broadway|ブロードウェイ|sun mall|サンモール|mandarake|まんだらけ|radio|ラジオ|gigo|ゲーセン|chuo|中央通|neon|霓虹|street|街|electric town|電気街/i.test(meta)) {
      return { ok: false, reason: 'travel_district_bakery_or_cafe' };
    }
  }
  var multiLandmark = /radio|ラジオ|gigo|ゲーセン|chuo|中央通|street view|street scene|neon|霓虹|crowd|人潮|panorama|kaikan|会館|signage|看板|electric town|broadway|ブロードウェイ|sun mall|サンモール|交差点|crossing/i.test(meta);
  var animateOnly = (/animate|アニメイト/i.test(meta) || /animate|アニメイト/i.test(String(placeName || '').toLowerCase())) && !multiLandmark;
  if (animateOnly) {
    return { ok: false, reason: 'travel_district_single_store' };
  }
  return { ok: true, reason: null };
}

export function validateTravelPhotoSelection(section, evidence, photoIndex, photo, options) {
  var slots = getTravelPhotoSlots(section, { primaryOnly: false });
  if (!slots.length) return { ok: true, reason: null };
  var slotId = options && options.travelPhotoSlot;
  if (slotId) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].id !== slotId) continue;
      var picked = validateTravelSlotGate(evidence, photoIndex, slots[i], section, photo);
      if (!picked.ok) return { ok: false, reason: picked.reason || 'travel_slot_fail' };
      return { ok: true, reason: null, slotId: slotId };
    }
  }
  for (var j = 0; j < slots.length; j++) {
    var gate = validateTravelSlotGate(evidence, photoIndex, slots[j], section, photo);
    if (gate.ok) return { ok: true, reason: null, slotId: slots[j].id };
  }
  return { ok: false, reason: 'travel_primary_slot_fail' };
}

export function validateCopyTravelAlignment(section, evidence, caption) {
  if (!evidence) return { ok: false, reason: 'travel_no_evidence' };
  var types = evidence.types || [evidence.primary];
  var blob = String(evidence.blob || '').toLowerCase();
  var cap = String(caption || '');
  var copyText = cap;

  var role = resolveSectionRole(section || {});

  for (var i = 0; i < COPY_EVIDENCE_CLAIMS.length; i++) {
    var claim = COPY_EVIDENCE_CLAIMS[i];
    if (!claim.pattern.test(copyText)) continue;
    if (claim.blobNeed && !claim.blobNeed.test(blob + ' ' + cap)) continue;
    var okTypes = [claim.need].concat(claim.also || []);
    var matched = okTypes.some(function (t) { return types.indexOf(t) !== -1; });
    if (!matched) {
      return { ok: false, reason: 'travel_copy_claims_' + claim.need };
    }
  }

  if ((role === 'hotel' || role === 'hostel') && types.indexOf('room') !== -1 &&
      types.indexOf('facade') === -1 && types.indexOf('lobby_bar') === -1) {
    if (/飯店|hotel|hostel|住宿|旅館/i.test(copyText) && !/客房|房間|room|dorm|床位/i.test(copyText)) {
      return { ok: false, reason: 'travel_hotel_room_only' };
    }
  }

  if (resolveTravelProfile(section) === 'restaurant' && evidence.primary === 'food_dish' &&
      types.indexOf('facade') === -1) {
    return { ok: false, reason: 'travel_food_dish_only' };
  }

  return { ok: true, reason: null };
}

export function travelSearchHints(section) {
  var profile = resolveTravelProfile(section);
  return TRAVEL_SEARCH_HINTS[profile] || TRAVEL_SEARCH_HINTS.shop;
}
