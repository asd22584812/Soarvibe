import { validatePhotoIntentGate } from './cj-editorial-pipeline.js';
import { resolveSectionRole } from './cj-editorial-engine.js';
import {
  classifyPhotoEvidence,
  evidenceAllowedForSection
} from './cj-photo-evidence.js';

var BAD_GLOBAL = /tiger|white tiger|zoo|garden|residential|repair shop|garage|pool|beach|villa|白老虎|修車|住宅|花園|泳池/i;
var BAD_HERO = /lobby|interior|indoor|entrance|door|reception|室内|入口|大廳|電梯|elevator|corridor|走廊|parking|駐車/i;
var BAD_FOOD = /bathroom|toilet|restroom|washroom|洗手|廁所|空桌|empty table|counter only/i;
var BAD_HOTEL = /parking|garage|elevator|corridor|hallway|駐車|走廊|電梯/i;
var BAD_LANDMARK = /close.?up|column|pillar|wall only|近拍|柱子|牆壁/i;
var BAD_GENERIC = /plain|generic|empty street|sidewalk only|普通人行|一般街道/i;
var STREET_LANDMARK = /radio kaikan|animate|gigo|central|chuo|electric town|neon|霓虹|中央通|街景|street view|akihabara|電氣/i;

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
  var sectionRole = context.sectionRole || resolveSectionRole(context);
  var sectionType = context.sectionType || 'landmark';
  var idx = typeof photo._index === 'number' ? photo._index : 0;
  var keywords = context.visualKeywords || [];
  var matchedKeywords = matchVisualKeywords(blob, keywords);

  if (BAD_GLOBAL.test(blob)) score -= 80;
  if (BAD_GENERIC.test(blob)) score -= 30;
  score += matchedKeywords.length * 18;

  if (keywords.length >= 2 && matchedKeywords.length === 0) {
    score -= 22;
  }

  if (role === 'hero' || sectionRole === 'opening') {
    if (STREET_LANDMARK.test(blob)) score += 35;
    if (ratio >= 1.35) score += 22;
    if (ratio >= 1.6) score += 8;
    if (ratio < 0.95) score -= 28;
    if (BAD_HERO.test(blob)) score -= 30;
    if (idx === 1) score += 6;
    if (idx === 2) score += 4;
  }

  if (sectionRole === 'landmark' || sectionRole === 'explore' || sectionRole === 'opening') {
    if (STREET_LANDMARK.test(blob)) score += 32;
    if (ratio >= 1.15) score += 16;
    if (BAD_LANDMARK.test(blob)) score -= 25;
    if (/figure|フィギュア|hobby|ホビー|模型|mandarake|まんだらけ|shop interior|店内|toy shop/i.test(blob) && !STREET_LANDMARK.test(blob)) {
      score -= 55;
    }
    if (/crowd|人潮|neon|霓虹|看板|signage/i.test(blob)) score += 14;
    if (idx === 0 && /hobby|ホビー|figure|模型|店内/i.test(blob)) score -= 40;
  }

  if (sectionRole === 'anime') {
    if (/mandarake|まんだらけ|figure|フィギュア|公仔|figurine|manga|漫画|collectible/i.test(blob)) score += 24;
    if (/sun mall|サンモール|atrium|中庭|broadway/i.test(blob)) score += 16;
    if (/ガチャ|gachapon|gashapon|capsule|扭蛋/i.test(blob)) score += 22;
    if (/corridor|走道|廊下|empty mall/i.test(blob) && !/mandarake|figure|フィギュア|ガチャ|gachapon/i.test(blob)) score -= 38;
    if (idx >= 1) score += 6;
  }

  if (sectionRole === 'shopping') {
    if (/product|merchandise|display|商品|展示|shop interior|店内/i.test(blob)) score += 20;
    if (/gachapon|capsule|figure|扭蛋|公仔|shop|store/i.test(blob)) score += 18;
    if (/facade|exterior|外観|storefront/i.test(blob) && context.rejectExteriorPhoto) score -= 35;
  }

  if (sectionRole === 'food' || sectionType === 'food') {
    if (/ramen|noodle|food|料理|ラーメン|麺|soba|拉麵|dish|meal/.test(blob)) score += 22;
    if (idx === 0 && /facade|exterior|外観|storefront|entrance/i.test(blob)) score -= 25;
    if (idx >= 1) score += 6;
    if (BAD_FOOD.test(blob)) score -= 45;
  }

  if (sectionRole === 'cafe' || sectionType === 'cafe') {
    if (/dessert|甜點|パフェ|cake|drink|飲|plate|料理/i.test(blob)) score += 32;
    if (/cafe|coffee|maid|カフェ|interior|内装|店内|seating/i.test(blob)) score += 18;
    if (/logo|sign only|招牌のみ/i.test(blob) && !/dessert|甜點|drink|interior/i.test(blob)) score -= 50;
    if (!/dessert|甜點|drink|interior|maid|メイド|カフェ/i.test(blob) && /店|shop|made/i.test(blob)) score -= 35;
    if (BAD_FOOD.test(blob)) score -= 30;
  }

  if (sectionRole === 'hotel' || sectionType === 'hotel') {
    if (/room|suite|客房|bed/i.test(blob)) score += 34;
    if (/lobby|lounge|lounge|大廳/i.test(blob)) score += 30;
    if (/facade|exterior|外観|building/i.test(blob)) score -= 18;
    if (idx === 0 && /facade|exterior|外観/i.test(blob)) score -= 35;
    if (idx >= 1) score += 10;
    if (BAD_HOTEL.test(blob)) score -= 40;
  }

  if (sectionRole === 'hostel' || sectionType === 'hostel') {
    if (/room|dorm|客房|bed/i.test(blob)) score += 30;
    if (/lobby|bar|lounge|吧台|交誼|公共/i.test(blob)) score += 28;
    if (/facade|exterior|外観/i.test(blob)) score -= 22;
    if (idx === 0 && /facade|exterior|外観/i.test(blob)) score -= 38;
    if (idx >= 1) score += 12;
    if (BAD_HOTEL.test(blob)) score -= 25;
  }

  if ((photo.widthPx || 0) >= 1200) score += 5;
  if ((photo.heightPx || 0) < 400) score -= 10;

  return score;
}

export function photoContentGate(photo, context, item) {
  var attrOnly = photoAttrText(photo).toLowerCase();
  var evidenceBlob = buildPhotoEvidenceBlob(photo, context);
  var keywords = context.visualKeywords || [];
  var matchedKeywords = matchVisualKeywords(evidenceBlob, keywords);
  var score = scorePhoto(photo, Object.assign({}, context, { visualKeywords: keywords }));
  var role = context.role || 'section';
  var sectionRole = (item && item.sectionRole) || context.sectionRole || resolveSectionRole(item || context);
  var minScore = role === 'hero' ? 78 : 65;
  var gateCtx = Object.assign({}, context || {}, { photo: photo, placeName: context.placeName || '' });
  var intentGate = validatePhotoIntentGate(evidenceBlob, item || context, gateCtx);
  var classifyBlob = evidenceBlob + ' ' + matchedKeywords.join(' ');
  if (sectionRole === 'hotel' || sectionRole === 'hostel' || sectionRole === 'cafe' || sectionRole === 'food') {
    classifyBlob = attrOnly + ' ' + matchedKeywords.join(' ');
  }
  var evidence = classifyPhotoEvidence(classifyBlob, item || context);
  var evidenceGate = evidenceAllowedForSection(evidence, item || context);
  var ok = score >= minScore && intentGate.ok && evidenceGate.ok && !BAD_GLOBAL.test(evidenceBlob);

  return {
    ok: ok,
    score: score,
    matchedKeywords: matchedKeywords.concat(intentGate.matchedChecklist || []),
    blob: evidenceBlob,
    photoEvidence: evidence,
    rejectReason: !evidenceGate.ok ? evidenceGate.reason : (intentGate.ok ? null : intentGate.reason),
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
