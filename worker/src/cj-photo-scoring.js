import { validatePhotoIntentGate } from './cj-editorial-pipeline.js';
var BAD_GLOBAL = /tiger|white tiger|zoo|garden|residential|repair shop|garage|pool|beach|villa|白老虎|修車|住宅|花園|泳池/i;
var BAD_HERO = /lobby|interior|indoor|entrance|door|reception|室内|入口|大廳|電梯|elevator|corridor|走廊|parking|駐車/i;
var BAD_FOOD = /bathroom|toilet|restroom|washroom|洗手|廁所|空桌|empty table|counter only/i;
var BAD_HOTEL = /parking|garage|elevator|corridor|hallway|駐車|走廊|電梯/i;
var BAD_LANDMARK = /close.?up|column|pillar|wall only|近拍|柱子|牆壁/i;
var BAD_GENERIC = /plain|generic|empty street|sidewalk only|普通人行|一般街道/i;
var HERO_LANDMARK = /radio kaikan|animate|gigo|central|electric town|秋葉原|akihabara|電氣|中央通|扭蛋|gachapon|broadway|中野/i;

export function photoAttrText(photo) {
  if (!photo || !photo.authorAttributions) return '';
  return photo.authorAttributions.map(function (a) {
    return a.displayName || '';
  }).join(' ');
}

/** Metadata-only blob — never include editorial photoIntent / checklist. */
export function buildPhotoEvidenceBlob(photo, context) {
  var attr = photoAttrText(photo).toLowerCase();
  var place = String((context && context.placeName) || '').toLowerCase();
  return (attr + ' ' + place).trim();
}

function photoRatio(photo) {
  var w = photo.widthPx || 0;
  var h = photo.heightPx || 0;
  if (!w || !h) return 1.5;
  return w / h;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchVisualKeywords(blob, keywords) {
  var matched = [];
  (keywords || []).forEach(function (kw) {
    if (!kw) return;
    try {
      if (new RegExp(escapeRegExp(kw), 'i').test(blob)) matched.push(kw);
    } catch (e) { /* skip bad pattern */ }
  });
  return matched;
}

export function scorePhoto(photo, context) {
  var score = 50;
  var ratio = photoRatio(photo);
  var attr = photoAttrText(photo).toLowerCase();
  var place = String(context.placeName || '').toLowerCase();
  var query = String(context.mapsQuery || context.photoMapsQuery || '').toLowerCase();
  var blob = (attr + ' ' + place + ' ' + query).toLowerCase();
  var role = context.role || 'section';
  var sectionType = context.sectionType || 'landmark';
  var purpose = context.sectionPurpose || sectionType;
  var idx = typeof photo._index === 'number' ? photo._index : 0;
  var keywords = context.visualKeywords || [];
  var matchedKeywords = matchVisualKeywords(blob, keywords);

  if (BAD_GLOBAL.test(blob)) score -= 80;
  if (BAD_GENERIC.test(blob)) score -= 30;

  score += matchedKeywords.length * 18;

  if (keywords.length >= 2 && matchedKeywords.length === 0) {
    score -= 22;
    if (/neon|霓虹|招牌|animate|radio|central|中央通|扭蛋|動漫/.test(keywords.join(' '))) {
      if (!HERO_LANDMARK.test(blob) && !matchedKeywords.length) score -= 15;
    }
  }

  if (role === 'hero') {
    if (HERO_LANDMARK.test(blob)) score += 35;
    if (ratio >= 1.35) score += 22;
    if (ratio >= 1.6) score += 8;
    if (ratio < 0.95) score -= 28;
    if (BAD_HERO.test(blob)) score -= 30;
    if (idx === 0) score -= 4;
    if (idx === 1) score += 6;
    if (idx === 2) score += 4;
  }

  if (sectionType === 'landmark') {
    if (ratio >= 1.15) score += 12;
    if (BAD_LANDMARK.test(blob)) score -= 25;
    if (BAD_HERO.test(blob) && role !== 'hero') score -= 12;
  }
  if (purpose === 'anime' || sectionType === 'landmark' && /anime|動漫|mandarake|animate|gigo|radio/i.test(blob + keywords.join(' '))) {
    if (/mandarake|まんだらけ|animate|アニメイト|gigo|radio|ラジオ|ガチャ|gachapon/i.test(blob)) score += 20;
    if (idx >= 1) score += 8;
    if (/broadway|corridor|走道|廊下/i.test(blob) && !/mandarake|まんだらけ/i.test(blob)) score -= 35;
  }
  if (sectionType === 'food' || purpose === 'food') {
    if (/ramen|noodle|food|料理|ラーメン|麺|soba|拉麵|dish|meal/.test(blob)) score += 22;
    if (idx === 0 && /facade|exterior|外観|storefront|entrance/i.test(blob)) score -= 25;
    if (idx >= 1) score += 6;
    if (BAD_FOOD.test(blob)) score -= 45;
  }
  if (sectionType === 'cafe') {
    if (/cafe|coffee|dessert|maid|甜點|咖啡|カフェ/.test(blob)) score += 18;
    if (BAD_FOOD.test(blob)) score -= 30;
  }
  if (sectionType === 'hotel') {
    if (/lobby|room|hotel|exterior|facade|外觀|客房|ホテル/.test(blob)) score += 20;
    if (BAD_HOTEL.test(blob)) score -= 40;
  }
  if (sectionType === 'hostel') {
    if (/hostel|lounge|bar|交誼|ゲスト/.test(blob)) score += 16;
    if (BAD_HOTEL.test(blob)) score -= 25;
  }
  if (sectionType === 'shopping') {
    if (/gachapon|capsule|figure|扭蛋|公仔|shop|store/.test(blob)) score += 18;
  }

  if ((photo.widthPx || 0) >= 1200) score += 5;
  if ((photo.heightPx || 0) < 400) score -= 10;

  return score;
}

export function photoContentGate(photo, context, item) {
  var evidenceBlob = buildPhotoEvidenceBlob(photo, context);
  var scoreBlob = evidenceBlob + ' ' + String(context.mapsQuery || '').toLowerCase();
  var keywords = context.visualKeywords || [];
  var matchedKeywords = matchVisualKeywords(evidenceBlob, keywords);
  var score = scorePhoto(photo, Object.assign({}, context, { visualKeywords: keywords }));
  var role = context.role || 'section';
  var minScore = role === 'hero' ? 75 : 62;
  var gateCtx = Object.assign({}, context || {}, { photo: photo, placeName: context.placeName || '' });
  var intentGate = validatePhotoIntentGate(evidenceBlob, item || context, gateCtx);
  var ok = score >= minScore && intentGate.ok && !BAD_GLOBAL.test(evidenceBlob);

  return {
    ok: ok,
    score: score,
    matchedKeywords: matchedKeywords.concat(intentGate.matchedChecklist || []),
    blob: evidenceBlob,
    rejectReason: intentGate.ok ? null : intentGate.reason,
    anchorPlace: intentGate.anchorPlace || false
  };
}

export function rankPhotos(photos, context, item) {
  return (photos || []).map(function (photo, index) {
    var copy = Object.assign({}, photo, { _index: index });
    var gateCtx = Object.assign({}, context || {}, { photo: copy, placeName: (context && context.placeName) || '' });
    var gate = photoContentGate(copy, gateCtx, item || context);
    return { photo: copy, score: gate.score, gate: gate };
  }).sort(function (a, b) {
    return b.score - a.score;
  });
}
