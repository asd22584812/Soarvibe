/**
 * City Journal Editorial Pipeline — strict visual validation.
 */
import { buildLocaleSearchQueries, assignQueryLang, resolveCountryCode } from './cj-locale-search.js';

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePhotoIntent(photoIntent) {
  return String(photoIntent || '')
    .split(/[、,，\/\|]+/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

export function buildPhotoSearchSequence(item, articleCtx) {
  var countryCode = resolveCountryCode(articleCtx, item);
  var intentKw = parsePhotoIntent(item.photoIntent);
  var intentSlice = intentKw.slice(0, 4).join(' ');
  var extra = [];

  if (item.officialNameLocal && intentSlice) {
    extra.push({
      query: item.officialNameLocal + ' ' + intentSlice,
      lang: assignQueryLang(item.officialNameLocal, countryCode),
      source: 'photoIntentLocal'
    });
  }
  if (item.officialName && intentSlice && item.officialName !== item.officialNameLocal) {
    extra.push({
      query: item.officialName + ' ' + intentSlice,
      lang: 'en',
      source: 'photoIntentEn'
    });
  }
  (item.aliases || []).forEach(function (alias) {
    if (intentSlice && intentKw.length) {
      extra.push({
        query: alias + ' ' + intentKw[0],
        lang: assignQueryLang(alias, countryCode),
        source: 'aliasIntent'
      });
    }
  });

  return buildLocaleSearchQueries(item, articleCtx, {
    maxQueries: 16,
    extraQueries: extra
  }).queries;
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

export function isAnchorPhotoPlace(placeName, anchorTerms) {
  if (!anchorTerms || !anchorTerms.length) return false;
  return matchTerms(String(placeName || ''), anchorTerms).length > 0;
}

export function countVisualGroups(blob, visualGroups) {
  var hit = 0;
  var matched = [];
  (visualGroups || []).forEach(function (group) {
    var m = matchTerms(blob, group);
    if (m.length) {
      hit += 1;
      matched = matched.concat(m);
    }
  });
  return { groupsHit: hit, matched: matched };
}

export function isExteriorOnlyBlob(blob, photo, item) {
  var text = String(blob || '').toLowerCase();
  if (/外観|facade|exterior|storefront|entrance only|招牌のみ|building only/i.test(text)) {
    return true;
  }
  if (item && item.rejectExteriorPhoto && photo && photo._index === 0) {
    var interiorSignals = /ガチャ|gachapon|gashapon|capsule|扭蛋|machine|機|wall|店内|interior/i.test(text);
    if (!interiorSignals) return true;
  }
  return false;
}

import { resolveSectionRole } from './cj-editorial-engine.js';

function isGenericAnimeCorridor(blob, item) {
  var role = resolveSectionRole(item || {});
  if (role !== 'anime') return false;
  if (/mandarake|まんだらけ|らしんばん|lashinbang|figure|フィギュア|ガチャ|gachapon/i.test(blob)) return false;
  return /corridor|走道|廊下|entrance|入口|elevator|エレベーター|empty mall/i.test(blob);
}

function supplementVisualGroups(blob, photo, item, vg) {
  var supplemental = 0;
  var extra = [];
  if (!item || !photo) return { groupsHit: vg.groupsHit, matched: vg.matched };
  var role = resolveSectionRole(item);

  if (role === 'anime' && isAnchorPhotoPlace(blob, item.photoAnchorTerms)) {
    if (/figure|フィギュア|manga|漫画|漫畫|toy|玩具|hobby|ホビー|模型|公仔|figurine|comic|ガチャ|gachapon/i.test(blob)) {
      supplemental = 1;
      extra.push('collectible_evidence');
    } else if (photo._index >= 1 && !/corridor|走道|廊下|entrance|入口|lobby/i.test(blob)) {
      supplemental = 1;
      extra.push('anchor_interior');
    }
  }

  if ((role === 'shopping' || role === 'anime') && item.rejectExteriorPhoto && isAnchorPhotoPlace(blob, item.photoAnchorTerms)) {
    if (photo._index >= 1 || /machine|機|interior|店内|wall|capsule|ガチャ/i.test(blob)) {
      supplemental = Math.max(supplemental, 1);
      extra.push('interior_evidence');
    }
  }

  if ((role === 'landmark' || role === 'opening') && isAnchorPhotoPlace(blob, item.photoAnchorTerms)) {
    if (/radio|ラジオ|animate|アニメイト|gigo|ゲーセン|中央通|neon|霓虹|看板|sign|street|街/i.test(blob)) {
      supplemental = Math.max(supplemental, 1);
      extra.push('landmark_street');
    }
  }

  return {
    groupsHit: vg.groupsHit + supplemental,
    matched: vg.matched.concat(extra)
  };
}

export function validatePhotoIntentGate(blob, item, context) {
  var rejectRules = Array.isArray(item.imageRejectRules) ? item.imageRejectRules : [];
  var photo = (context && context.photo) || null;
  var placeName = (context && context.placeName) || '';

  for (var r = 0; r < rejectRules.length; r++) {
    try {
      if (new RegExp(escapeRegExp(rejectRules[r]), 'i').test(blob)) {
        return { ok: false, reason: 'reject:' + rejectRules[r], matchedChecklist: [] };
      }
    } catch (e) { /* skip */ }
  }

  if (isExteriorOnlyBlob(blob, photo, item)) {
    return { ok: false, reason: 'exterior_only', matchedChecklist: [] };
  }

  if (isGenericAnimeCorridor(blob, item)) {
    return { ok: false, reason: 'anime_corridor', matchedChecklist: [] };
  }

  if (item.minPhotoIndex != null && photo && photo._index < item.minPhotoIndex) {
    return { ok: false, reason: 'photo_index_low', matchedChecklist: [] };
  }

  if (isAnchorPhotoPlace(placeName, item.photoAnchorTerms)) {
    if (item.requireInteriorPhoto && isExteriorOnlyBlob(blob, photo, item)) {
      return { ok: false, reason: 'anchor_exterior', matchedChecklist: [] };
    }
    return {
      ok: true,
      matchedChecklist: matchTerms(blob, item.photoAnchorTerms || []),
      anchorPlace: true
    };
  }

  var visualGroups = item.visualGroups || [];
  var minGroups = item.requiredVisualMinGroups || 0;
  if (visualGroups.length && minGroups > 0) {
    var vg = supplementVisualGroups(blob, photo, item, countVisualGroups(blob, visualGroups));
    var generic = matchTerms(blob, item.genericPlaceTerms || []);
    if (vg.groupsHit < minGroups) {
      return {
        ok: false,
        reason: 'visual_groups:' + vg.groupsHit + '/' + minGroups,
        matchedChecklist: vg.matched
      };
    }
    if (generic.length >= 2 && !isAnchorPhotoPlace(blob, item.photoAnchorTerms)) {
      return { ok: false, reason: 'generic_place_only', matchedChecklist: vg.matched };
    }
    return {
      ok: true,
      matchedChecklist: vg.matched,
      anchorPlace: isAnchorPhotoPlace(blob, item.photoAnchorTerms)
    };
  }

  var checklist = Array.isArray(item.imageChecklist) ? item.imageChecklist : [];
  var intentTerms = parsePhotoIntent(item.photoIntent);
  var matchedChecklist = matchTerms(blob, checklist.concat(intentTerms));
  var minHits = checklist.length ? 2 : 1;
  if (matchedChecklist.length < minHits) {
    return { ok: false, reason: 'checklist_miss', matchedChecklist: matchedChecklist };
  }

  return { ok: true, matchedChecklist: matchedChecklist };
}

export function trimCaption(text, minLen, maxLen) {
  var s = String(text || '').replace(/\s+/g, '').trim();
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen).replace(/[，。、；]$/, '') + '。';
}

export function runEditorialQA(section, photoResult) {
  var issues = [];
  if (!section) return { ok: false, issues: ['missing_section'], usePlaceholder: true };
  if (!photoResult || !photoResult.googlePhotoUrl) {
    return { ok: false, issues: ['no_photo'], usePlaceholder: true };
  }
  if (photoResult.googleAttribution && section.officialNameLocal) {
    var attr = photoResult.googleAttribution;
    var venueLike = /店|館|hotel|hostel|restaurant|cafe|ポッド|cinema|theater|映画/i.test(attr);
    if (venueLike) {
      var okVenue = matchTerms(attr, [section.officialNameLocal, section.officialName, section.subject])
        .concat(matchTerms(attr, section.aliases || []))
        .concat(matchTerms(attr, section.photoAnchorTerms || []));
      if (!okVenue.length && resolveSectionRole(section) !== 'anime') {
        issues.push('attribution_drift');
      }
    }
  }
  return { ok: issues.length === 0, issues: issues, usePlaceholder: issues.length > 0 };
}
