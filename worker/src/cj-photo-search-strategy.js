/**
 * Global photo search retry strategy — all cities, all editorial topics.
 * Never stop after first failure; tier queries by locale + travel profile.
 */
import { resolveTravelProfile } from './cj-travel-photo-rules.js';
import {
  resolveCountryCode,
  detectQueryLang,
  COUNTRY_LANG_PRIORITY
} from './cj-locale-search.js';

export var SEARCH_PHASES = [
  'precise_local',
  'local_suffix',
  'english_suffix',
  'place_photos',
  'review_photos'
];

/** Query suffixes by travel profile — local + English */
export var QUERY_SUFFIXES_BY_PROFILE = {
  district: {
    ja: ['通り', '街並み', '中央通り', '外観', '電気街'],
    en: ['street', 'street view', 'main street', 'electric town']
  },
  shop: {
    ja: ['外観', '入口', '店頭'],
    en: ['storefront', 'entrance', 'exterior']
  },
  restaurant: {
    ja: ['外観', '入口', '店頭'],
    en: ['storefront', 'entrance', 'exterior', 'ramen']
  },
  cafe: {
    ja: ['外観', '入口', '店頭'],
    en: ['storefront', 'entrance', 'exterior']
  },
  hotel: {
    ja: ['外観', '入口', 'ロビー', '客室'],
    en: ['hotel exterior', 'entrance', 'lobby', 'room']
  },
  hostel: {
    ja: ['外観', '入口', 'ロビー', '客室'],
    en: ['hostel exterior', 'entrance', 'lobby', 'room']
  },
  gachapon: {
    ja: ['外観', '店内', 'ガチャガチャ', 'カプセルトイ'],
    en: ['storefront', 'gachapon hall', 'capsule toy wall', 'interior']
  }
};

var PHASE_RANK = {
  precise_local: 0,
  local_suffix: 1,
  english_suffix: 2,
  place_photos: 3,
  review_photos: 4
};

function uniquePush(seen, plan, row) {
  var q = String(row.query || '').trim();
  if (!q || q.length < 2) return;
  var key = q.toLowerCase() + '|' + (row.lang || '');
  if (seen[key]) return;
  seen[key] = true;
  plan.push({
    query: q,
    lang: row.lang || 'en',
    phase: row.phase || 'english_suffix',
    source: row.source || 'generic',
    rank: PHASE_RANK[row.phase] != null ? PHASE_RANK[row.phase] : 9
  });
}

function nameSeeds(section) {
  var seen = {};
  var out = [];
  function add(v) {
    var s = String(v || '').trim();
    if (!s || s.length < 2 || seen[s.toLowerCase()]) return;
    seen[s.toLowerCase()] = true;
    out.push(s);
  }
  add(section.officialNameLocal);
  add(section.officialName);
  add(section.subject);
  add(section.title);
  (section.aliases || []).forEach(add);
  return out;
}

/** Extract area base from district name e.g. 秋葉原電気街 → 秋葉原 */
export function extractDistrictBaseName(section) {
  var local = String(section.officialNameLocal || section.subject || section.officialName || '').trim();
  if (!local) return '';
  var m = local.match(/^(.+?)(?:電気街|电器街|ブロードウェイ|百老匯|商店街|中央通)/);
  if (m && m[1]) return m[1].trim();
  var en = String(section.officialName || '').trim();
  if (/electric town/i.test(en)) return en.replace(/\s*electric\s*town/i, '').trim();
  if (/broadway/i.test(en)) return en.replace(/\s*broadway/i, '').trim();
  return local.split(/\s+/)[0] || local;
}

export function buildPhotoSearchRetryPlan(section, articleCtx, options) {
  var countryCode = resolveCountryCode(articleCtx, section);
  var priorities = COUNTRY_LANG_PRIORITY[countryCode] || ['en'];
  var localLang = priorities[0] || 'ja';
  var profile = resolveTravelProfile(section || {});
  var suffixes = QUERY_SUFFIXES_BY_PROFILE[profile] || QUERY_SUFFIXES_BY_PROFILE.shop;
  var localSuffixes = suffixes[localLang] || suffixes.ja || suffixes.en || [];
  var enSuffixes = suffixes.en || [];
  var seen = {};
  var plan = [];
  var max = (options && options.maxQueries) || 28;
  var profileMax = { district: 22, restaurant: 16, gachapon: 14, hotel: 14, hostel: 14, cafe: 16, shop: 16 };
  if (profileMax[profile]) max = Math.min(max, profileMax[profile]);
  var seeds = nameSeeds(section || {});

  (section.photoPlaceQueries || []).forEach(function (q) {
    uniquePush(seen, plan, {
      query: q,
      lang: detectQueryLang(q, countryCode) || localLang,
      phase: 'precise_local',
      source: 'photoPlaceQueries'
    });
  });

  seeds.forEach(function (name) {
    uniquePush(seen, plan, {
      query: name,
      lang: detectQueryLang(name, countryCode) || localLang,
      phase: 'precise_local',
      source: 'precise_name'
    });
  });

  seeds.forEach(function (name) {
    localSuffixes.forEach(function (suf) {
      uniquePush(seen, plan, {
        query: name + ' ' + suf,
        lang: localLang,
        phase: 'local_suffix',
        source: 'local_suffix_' + profile
      });
    });
  });

  seeds.forEach(function (name) {
    enSuffixes.forEach(function (suf) {
      uniquePush(seen, plan, {
        query: name + ' ' + suf,
        lang: 'en',
        phase: 'english_suffix',
        source: 'english_suffix_' + profile
      });
    });
  });

  if (profile === 'district') {
    var base = extractDistrictBaseName(section);
    if (base) {
      ['中央通り', '通り', '街並み', '外観'].forEach(function (suf) {
        uniquePush(seen, plan, {
          query: base + ' ' + suf,
          lang: localLang,
          phase: 'local_suffix',
          source: 'district_base'
        });
      });
    }
    (section.photoAnchorTerms || []).forEach(function (anchor) {
      uniquePush(seen, plan, {
        query: anchor + ' 外観',
        lang: localLang,
        phase: 'local_suffix',
        source: 'anchor_exterior'
      });
      uniquePush(seen, plan, {
        query: anchor + ' entrance',
        lang: 'en',
        phase: 'english_suffix',
        source: 'anchor_exterior_en'
      });
      if (base) {
        uniquePush(seen, plan, {
          query: base + ' ' + anchor + ' 外観',
          lang: localLang,
          phase: 'local_suffix',
          source: 'district_anchor_exterior'
        });
      }
    });
  }

  (section.searchKeywords || []).slice(0, 12).forEach(function (kw) {
    uniquePush(seen, plan, {
      query: kw,
      lang: detectQueryLang(kw, countryCode) || localLang,
      phase: 'english_suffix',
      source: 'searchKeywords'
    });
  });

  if (section.mapsQuery) {
    uniquePush(seen, plan, {
      query: section.mapsQuery,
      lang: detectQueryLang(section.mapsQuery, countryCode) || 'en',
      phase: 'english_suffix',
      source: 'mapsQuery'
    });
    if (profile === 'district') {
      uniquePush(seen, plan, {
        query: section.mapsQuery + ' street view',
        lang: 'en',
        phase: 'english_suffix',
        source: 'mapsQuery_street'
      });
    }
  }

  plan.sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return 0;
  });

  return {
    profile: profile,
    countryCode: countryCode,
    localLang: localLang,
    queries: plan.slice(0, max)
  };
}

export function createPhotoSearchDebug(sectionId) {
  var attempts = [];
  return {
    sectionId: sectionId || null,
    attempts: attempts,
    log: function (row) {
      var entry = Object.assign({ ts: Date.now() }, row);
      attempts.push(entry);
      return entry;
    },
    toJSON: function () {
      return { sectionId: sectionId || null, attempts: attempts.slice() };
    }
  };
}

export function logPhotoSearchAttempt(debug, row) {
  if (!debug || typeof debug.log !== 'function') return null;
  return debug.log(row);
}
