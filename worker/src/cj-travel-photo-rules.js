/**
 * SoarVibe Travel Photo Rules — global, city-agnostic.
 * Pick what tourists want to see first, not just "is this the place".
 */
import { resolveSectionRole } from './cj-editorial-engine.js';
import { resolveSubjectType } from './cj-photo-evidence.js';

export var TRAVEL_PHOTO_RULES = {
  version: 'travel-v1',
  principle: '選擇旅遊者最想看到的照片，不是隨機地點圖。',
  rules: [
    '街區/商圈/景點：第一張必須是代表整個區域的廣角街景、地標或全景',
    '商店：第一張優先店門口或外觀，第二張才是店內',
    '餐廳：第一張優先店門口、招牌、外觀，第二張才是餐點',
    '住宿：第一張優先外觀/入口，第二張 Lobby，第三張房型',
    '街區介紹必須至少有一張街景',
    '圖片必須直接對應文案描述',
    '搜尋優先當地語言，驗證不符則重新搜尋，禁止隨機 fallback'
  ]
};

/** Tourist viewing priority — slot order per profile */
var PHOTO_SLOTS = {
  district: [
    {
      id: 'district_panorama',
      accept: ['street_landmark', 'landmark_building'],
      alsoAccept: ['facade'],
      rejectPrimary: ['shop_interior', 'food_dish', 'room', 'dessert', 'logo_only', 'gachapon_wall', 'anime_collectible'],
      preferIndexMax: 4,
      minRatio: 1.05
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
      accept: ['facade'],
      rejectPrimary: ['food_dish'],
      preferIndexMax: 1
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
      accept: ['facade'],
      rejectPrimary: ['dessert', 'cafe_interior', 'food_dish'],
      preferIndexMax: 1
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
      accept: ['facade'],
      rejectPrimary: ['room', 'lobby_bar', 'food_dish'],
      preferIndexMax: 1
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
      accept: ['facade'],
      rejectPrimary: ['room', 'lobby_bar'],
      preferIndexMax: 1
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
  if (role === 'landmark' || role === 'explore') {
    if (subjectType === 'venue') return 'shop';
    return 'district';
  }
  if (role === 'food' || section.sectionType === 'food') return 'restaurant';
  if (role === 'cafe' || section.sectionType === 'cafe') return 'cafe';
  if (role === 'hotel' || section.sectionType === 'hotel') return 'hotel';
  if (role === 'hostel' || section.sectionType === 'hostel') return 'hostel';
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

export function validateTravelSlotGate(evidence, photoIndex, slot, section, photo) {
  if (!evidence || !slot) return { ok: false, reason: 'travel_no_evidence' };
  var types = evidence.types || [];
  var primary = evidence.primary;
  var idx = typeof photoIndex === 'number' ? photoIndex : 0;

  if (slot.rejectPrimary && slot.rejectPrimary.indexOf(primary) !== -1) {
    return { ok: false, reason: 'travel_reject_primary_' + primary };
  }

  if (!typesMatchSlot(types, primary, slot)) {
    return { ok: false, reason: 'travel_slot_type_mismatch' };
  }

  if (slot.preferIndexMax != null && idx > slot.preferIndexMax) {
    return { ok: false, reason: 'travel_index_too_late' };
  }
  if (slot.minIndex != null && idx < slot.minIndex) {
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

export function validateTravelPhotoSelection(section, evidence, photoIndex, photo) {
  var slots = getTravelPhotoSlots(section, { primaryOnly: true });
  if (!slots.length) return { ok: true, reason: null };
  var gate = validateTravelSlotGate(evidence, photoIndex, slots[0], section, photo);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason || 'travel_primary_slot_fail' };
  }
  return { ok: true, reason: null, slotId: slots[0].id };
}

export function validateCopyTravelAlignment(section, evidence, caption) {
  if (!evidence) return { ok: false, reason: 'travel_no_evidence' };
  var types = evidence.types || [evidence.primary];
  var blob = String(evidence.blob || '').toLowerCase();
  var cap = String(caption || '');
  var copyText = cap;
  if (section && section.heading) copyText = section.heading + ' ' + copyText;

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
  var hints = {
    district: ['street view', 'panorama', 'main street', '街景', '全景'],
    shop: ['exterior', 'storefront', 'facade', '外観', '店門口'],
    restaurant: ['exterior', 'storefront', 'entrance', '外観', '招牌'],
    cafe: ['exterior', 'storefront', 'cafe entrance', '外観'],
    hotel: ['exterior', 'building', 'facade', '外観', '入口'],
    hostel: ['exterior', 'building', 'facade', '外観', '入口']
  };
  return hints[profile] || hints.shop;
}
