/**
 * City Journal Editorial Pipeline — photoIntent, checklist, QA.
 */

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parsePhotoIntent(photoIntent) {
  return String(photoIntent || '')
    .split(/[、,，\/\|]+/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

export function buildPhotoSearchSequence(item) {
  var seen = {};
  var out = [];
  var intentKw = parsePhotoIntent(item.photoIntent);
  var intentSlice = intentKw.slice(0, 4).join(' ');

  function push(query, lang) {
    var q = String(query || '').trim();
    if (!q || seen[q]) return;
    seen[q] = true;
    out.push({ query: q, lang: lang || 'ja' });
  }

  if (item.officialNameLocal && intentSlice) {
    push(item.officialNameLocal + ' ' + intentSlice, 'ja');
  }
  push(item.officialNameLocal, 'ja');
  if (item.officialName && intentSlice) {
    push(item.officialName + ' ' + intentSlice, 'en');
  }
  push(item.officialName, 'en');
  (item.aliases || []).forEach(function (alias) {
    if (intentSlice && intentKw.length) {
      push(alias + ' ' + intentKw[0], alias.match(/[\u3040-\u30ff\u4e00-\u9faf]/) ? 'ja' : 'en');
    }
    push(alias, alias.match(/[\u3040-\u30ff\u4e00-\u9faf]/) ? 'ja' : 'en');
  });
  push(item.subject, 'zh-TW');
  push(item.mapsQuery, 'zh-TW');
  return out;
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

export function validatePhotoIntentGate(blob, item, context) {
  var rejectRules = Array.isArray(item.imageRejectRules) ? item.imageRejectRules : [];
  var checklist = Array.isArray(item.imageChecklist) ? item.imageChecklist : [];
  var intentTerms = parsePhotoIntent(item.photoIntent);
  var role = (context && context.role) || 'section';

  for (var r = 0; r < rejectRules.length; r++) {
    try {
      if (new RegExp(escapeRegExp(rejectRules[r]), 'i').test(blob)) {
        return { ok: false, reason: 'reject:' + rejectRules[r], matchedChecklist: [] };
      }
    } catch (e) { /* skip */ }
  }

  var allTerms = checklist.concat(intentTerms);
  var matchedChecklist = matchTerms(blob, allTerms);
  var minHits = role === 'hero' ? 1 : (checklist.length ? 1 : 0);
  if (checklist.length && matchedChecklist.length < minHits) {
    var placeOnly = matchTerms(blob, checklist.concat([
      item.officialName, item.officialNameLocal, item.subject
    ].filter(Boolean)));
    if (placeOnly.length < minHits) {
      return { ok: false, reason: 'checklist_miss', matchedChecklist: matchedChecklist };
    }
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
  if (!section) return { ok: false, issues: ['missing_section'] };
  if (!photoResult || !photoResult.googlePhotoUrl) {
    issues.push('no_photo');
    return { ok: issues.length === 0, issues: issues, usePlaceholder: true };
  }
  if (photoResult.placeName && section.officialNameLocal) {
    var blob = (photoResult.placeName + ' ' + (section.officialNameLocal || '') + ' ' + (section.officialName || '')).toLowerCase();
    var nameOk = matchTerms(blob, [section.officialNameLocal, section.officialName, section.subject]).length > 0;
    if (!nameOk) issues.push('place_name_drift');
  }
  if (photoResult.googleAttribution && section.officialNameLocal) {
    var attr = photoResult.googleAttribution;
    var venueLike = /店|館|hotel|hostel|restaurant|cafe|ポッド|cinema|theater|映画/i.test(attr);
    if (venueLike && !matchTerms(attr, [section.officialNameLocal, section.officialName, section.subject]).length) {
      if (!matchTerms(attr, section.aliases || []).length) {
        issues.push('attribution_drift');
      }
    }
  }
  return { ok: issues.length === 0, issues: issues, usePlaceholder: issues.length > 0 };
}
