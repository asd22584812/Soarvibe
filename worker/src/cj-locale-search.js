/**
 * Locale-aware Google Places search — primary local language, English fallback.
 */
import { travelSearchHints } from './cj-travel-photo-rules.js';

export var COUNTRY_LANG_PRIORITY = {
  JP: ['ja', 'en'],
  KR: ['ko', 'en'],
  TW: ['zh-TW', 'en'],
  HK: ['zh-HK', 'zh-TW', 'en'],
  CN: ['zh-CN', 'en'],
  FR: ['fr', 'en'],
  DE: ['de', 'en'],
  ES: ['es', 'en'],
  IT: ['it', 'en'],
  TH: ['th', 'en'],
  VN: ['vi', 'en']
};

export var COUNTRY_REGION = {
  JP: 'JP',
  KR: 'KR',
  TW: 'TW',
  HK: 'HK',
  CN: 'CN',
  FR: 'FR',
  DE: 'DE',
  ES: 'ES',
  IT: 'IT',
  TH: 'TH',
  VN: 'VN'
};

export function resolveCountryCode(articleCtx, item) {
  if (item && item.countryCode) return String(item.countryCode).toUpperCase();
  if (articleCtx && articleCtx.countryCode) return String(articleCtx.countryCode).toUpperCase();
  if (articleCtx && articleCtx.destination && articleCtx.destination.countryCode) {
    return String(articleCtx.destination.countryCode).toUpperCase();
  }
  return 'JP';
}

export function resolveRegionCode(articleCtx, item) {
  var cc = resolveCountryCode(articleCtx, item);
  return COUNTRY_REGION[cc] || cc || 'JP';
}

export function detectQueryLang(text, countryCode) {
  var s = String(text || '');
  if (/[\u3040-\u30ff]/.test(s)) return 'ja';
  if (/[\uac00-\ud7af]/.test(s)) return 'ko';
  if (/[\u0e00-\u0e7f]/.test(s)) return 'th';
  if (/[\u0103\u0102\u00e2\u00c2\u00ea\u00ca\u00f4\u00d4\u01a1\u01a0\u01b0\u01af\u0111\u0110]/i.test(s)) return 'vi';
  if (/[\u4e00-\u9fff]/.test(s)) {
    if (countryCode === 'CN') return 'zh-CN';
    if (countryCode === 'HK') return 'zh-HK';
    return 'zh-TW';
  }
  if (/[àâäéèêëïîôùûüçœæ]/i.test(s)) return 'fr';
  if (/[äöüß]/i.test(s)) return 'de';
  if (/[ñ¿¡]/i.test(s)) return 'es';
  if (/[àèéìíîòóù]/i.test(s)) return 'it';
  return null;
}

function langPriority(countryCode) {
  return COUNTRY_LANG_PRIORITY[countryCode] || ['en'];
}

function langRank(lang, priorities) {
  var idx = priorities.indexOf(lang);
  return idx === -1 ? priorities.length + 1 : idx;
}

function isLocalLang(lang, countryCode) {
  var priorities = langPriority(countryCode);
  return priorities.length > 0 && lang === priorities[0];
}

function isEnglish(lang) {
  return lang === 'en';
}

/**
 * Order and dedupe search queries: local names first, then English fallback.
 */
export function buildLocaleSearchQueries(item, articleCtx, options) {
  var countryCode = resolveCountryCode(articleCtx, item);
  var priorities = langPriority(countryCode);
  var maxQueries = (options && options.maxQueries) || 14;
  var seen = {};
  var rows = [];

  function push(query, preferredLang, source) {
    var q = String(query || '').trim();
    if (!q || q.length < 2 || seen[q.toLowerCase()]) return;
    seen[q.toLowerCase()] = true;
    var detected = detectQueryLang(q, countryCode);
    var lang = detected || preferredLang || priorities[0] || 'en';
    rows.push({
      query: q,
      lang: lang,
      source: source || 'generic',
      rank: langRank(lang, priorities)
    });
  }

  (item.photoPlaceQueries || []).forEach(function (q) {
    push(q, priorities[0], 'photoPlaceQueries');
  });

  if (item.officialNameLocal) {
    push(item.officialNameLocal, priorities[0], 'officialNameLocal');
  }

  (item.searchKeywords || []).forEach(function (q) {
    push(q, null, 'searchKeywords');
  });

  if (item.officialName && item.officialName !== item.officialNameLocal) {
    push(item.officialName, 'en', 'officialName');
  }

  (item.aliases || []).forEach(function (q) {
    push(q, null, 'aliases');
  });

  if (item.subject) push(item.subject, priorities[0], 'subject');
  if (item.mapsQuery) push(item.mapsQuery, 'en', 'mapsQuery');

  if (item.subjectType === 'district') {
    if (countryCode === 'JP') {
      push((item.officialNameLocal || item.subject || '') + ' 中央通', 'ja', 'travelHints');
      push((item.officialNameLocal || item.subject || '') + ' 街並み', 'ja', 'travelHints');
      push((item.officialNameLocal || item.subject || '') + ' ラジオ会館', 'ja', 'travelHints');
    }
    push((item.officialName || item.mapsQuery || '') + ' street view', 'en', 'travelHints');
  }

  var travelHints = travelSearchHints(item);
  travelHints.forEach(function (hint) {
    push(hint, priorities[0], 'travelHints');
  });
  if (item.officialNameLocal) {
    if (countryCode === 'JP') {
      push(item.officialNameLocal + ' 外観', 'ja', 'travelHints');
      push(item.officialNameLocal + ' 店舗', 'ja', 'travelHints');
    }
  }

  if (options && Array.isArray(options.extraQueries)) {
    options.extraQueries.forEach(function (row) {
      push(row.query, row.lang, row.source || 'extra');
    });
  }

  rows.sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    var sourceOrder = {
      photoPlaceQueries: 0,
      officialNameLocal: 1,
      searchKeywords: 2,
      officialName: 3,
      aliases: 4,
      travelHints: 5,
      subject: 6,
      mapsQuery: 7,
      extra: 8,
      generic: 9
    };
    return (sourceOrder[a.source] || 9) - (sourceOrder[b.source] || 9);
  });

  var out = rows.slice(0, maxQueries);

  if (priorities.indexOf('en') !== -1) {
    var hasEn = out.some(function (r) { return isEnglish(r.lang); });
    if (!hasEn && item.mapsQuery) {
      push(item.mapsQuery, 'en', 'mapsQuery');
      if (out.length < maxQueries && seen[item.mapsQuery.toLowerCase()]) {
        out = rows.slice(0, maxQueries);
      }
    }
  }

  return {
    countryCode: countryCode,
    regionCode: resolveRegionCode(articleCtx, item),
    langPriority: priorities,
    queries: out.slice(0, maxQueries)
  };
}

export function assignQueryLang(query, countryCode) {
  return detectQueryLang(query, countryCode) || langPriority(countryCode)[0] || 'en';
}
