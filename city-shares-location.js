/**
 * City Shares location taxonomy resolver.
 * Canonical IDs only in Firestore; display names for UI.
 */
(function (global) {
  'use strict';

  var COUNTRIES = Object.freeze({
    japan: Object.freeze({ id: 'japan', name: '日本' }),
    korea: Object.freeze({ id: 'korea', name: '韓國' }),
    thailand: Object.freeze({ id: 'thailand', name: '泰國' }),
    vietnam: Object.freeze({ id: 'vietnam', name: '越南' }),
    usa: Object.freeze({ id: 'usa', name: '美國' }),
    australia: Object.freeze({ id: 'australia', name: '澳洲' }),
    uk: Object.freeze({ id: 'uk', name: '英國' }),
    france: Object.freeze({ id: 'france', name: '法國' }),
    singapore: Object.freeze({ id: 'singapore', name: '新加坡' }),
    taiwan: Object.freeze({ id: 'taiwan', name: '台灣' }),
    china: Object.freeze({ id: 'china', name: '中國' }),
    hongkong: Object.freeze({ id: 'hongkong', name: '香港' }),
    macau: Object.freeze({ id: 'macau', name: '澳門' })
  });

  var REGIONS = Object.freeze({
    hokkaido: Object.freeze({
      id: 'hokkaido',
      name: '北海道',
      countryId: 'japan'
    })
  });

  /** Known cities: canonical cityId → taxonomy */
  var CITIES = Object.freeze({
    tokyo: city('tokyo', '東京', 'japan'),
    osaka: city('osaka', '大阪', 'japan'),
    kyoto: city('kyoto', '京都', 'japan'),
    nagoya: city('nagoya', '名古屋', 'japan'),
    fukuoka: city('fukuoka', '福岡', 'japan'),
    okinawa: city('okinawa', '沖繩', 'japan'),
    sapporo: city('sapporo', '札幌', 'japan', 'hokkaido'),
    sendai: city('sendai', '仙台', 'japan'),
    hiroshima: city('hiroshima', '廣島', 'japan'),
    kumamoto: city('kumamoto', '熊本', 'japan'),
    takamatsu: city('takamatsu', '高松', 'japan'),
    seoul: city('seoul', '首爾', 'korea'),
    busan: city('busan', '釜山', 'korea'),
    jeju: city('jeju', '濟州', 'korea'),
    daegu: city('daegu', '大邱', 'korea'),
    incheon: city('incheon', '仁川', 'korea'),
    bangkok: city('bangkok', '曼谷', 'thailand'),
    chiangmai: city('chiangmai', '清邁', 'thailand'),
    london: city('london', '倫敦', 'uk'),
    paris: city('paris', '巴黎', 'france'),
    'new-york': city('new-york', '紐約', 'usa'),
    'los-angeles': city('los-angeles', '洛杉磯', 'usa'),
    'san-francisco': city('san-francisco', '舊金山', 'usa'),
    sydney: city('sydney', '雪梨', 'australia'),
    melbourne: city('melbourne', '墨爾本', 'australia'),
    singapore: city('singapore', '新加坡', 'singapore'),
    hanoi: city('hanoi', '河內', 'vietnam'),
    'ho-chi-minh': city('ho-chi-minh', '胡志明', 'vietnam')
  });

  /**
   * Legacy homepage / feed keys that are not true cities.
   * Used for backward-compatible open + lazy normalize.
   */
  var LEGACY_ENTRY = Object.freeze({
    hokkaido: Object.freeze({
      countryId: 'japan',
      countryName: '日本',
      regionId: 'hokkaido',
      regionName: '北海道',
      cityId: '',
      cityName: '',
      feedKind: 'region',
      displayLabel: '北海道'
    }),
    vietnam: Object.freeze({
      countryId: 'vietnam',
      countryName: '越南',
      regionId: '',
      regionName: '',
      cityId: '',
      cityName: '',
      feedKind: 'country',
      displayLabel: '越南'
    })
  });

  /** Alias → cityId or special token country:japan / region:hokkaido */
  var ALIASES = buildAliases();

  function city(id, name, countryId, regionId) {
    var country = COUNTRIES[countryId];
    var region = regionId ? REGIONS[regionId] : null;
    return Object.freeze({
      cityId: id,
      cityName: name,
      countryId: countryId,
      countryName: country ? country.name : countryId,
      regionId: regionId || '',
      regionName: region ? region.name : ''
    });
  }

  function buildAliases() {
    var map = {};
    function add(alias, target) {
      map[String(alias).toLowerCase()] = target;
    }
    Object.keys(CITIES).forEach(function (id) {
      var c = CITIES[id];
      add(id, id);
      add(c.cityName, id);
    });
    add('東京', 'tokyo');
    add('とうきょう', 'tokyo');
    add('東京都', 'tokyo');
    add('tokyo', 'tokyo');
    add('大阪', 'osaka');
    add('おおさか', 'osaka');
    add('osaka', 'osaka');
    add('京都', 'kyoto');
    add('きょうと', 'kyoto');
    add('kyoto', 'kyoto');
    add('名古屋', 'nagoya');
    add('nagoya', 'nagoya');
    add('福岡', 'fukuoka');
    add('ふくおか', 'fukuoka');
    add('fukuoka', 'fukuoka');
    add('沖繩', 'okinawa');
    add('沖縄', 'okinawa');
    add('okinawa', 'okinawa');
    add('札幌', 'sapporo');
    add('sapporo', 'sapporo');
    add('北海道札幌', 'sapporo');
    add('仙台', 'sendai');
    add('sendai', 'sendai');
    add('廣島', 'hiroshima');
    add('広島', 'hiroshima');
    add('hiroshima', 'hiroshima');
    add('熊本', 'kumamoto');
    add('kumamoto', 'kumamoto');
    add('高松', 'takamatsu');
    add('takamatsu', 'takamatsu');
    add('首爾', 'seoul');
    add('首尔', 'seoul');
    add('서울', 'seoul');
    add('seoul', 'seoul');
    add('釜山', 'busan');
    add('부산', 'busan');
    add('busan', 'busan');
    add('pusan', 'busan');
    add('濟州', 'jeju');
    add('济州', 'jeju');
    add('제주', 'jeju');
    add('jeju', 'jeju');
    add('jeju-island', 'jeju');
    add('大邱', 'daegu');
    add('daegu', 'daegu');
    add('仁川', 'incheon');
    add('incheon', 'incheon');
    add('曼谷', 'bangkok');
    add('bangkok', 'bangkok');
    add('清邁', 'chiangmai');
    add('chiang mai', 'chiangmai');
    add('倫敦', 'london');
    add('伦敦', 'london');
    add('london', 'london');
    add('巴黎', 'paris');
    add('paris', 'paris');
    add('紐約', 'new-york');
    add('纽约', 'new-york');
    add('new york', 'new-york');
    add('nyc', 'new-york');
    add('洛杉磯', 'los-angeles');
    add('洛杉矶', 'los-angeles');
    add('los angeles', 'los-angeles');
    add('la', 'los-angeles');
    add('舊金山', 'san-francisco');
    add('旧金山', 'san-francisco');
    add('san francisco', 'san-francisco');
    add('雪梨', 'sydney');
    add('悉尼', 'sydney');
    add('sydney', 'sydney');
    add('墨爾本', 'melbourne');
    add('墨尔本', 'melbourne');
    add('melbourne', 'melbourne');
    add('新加坡', 'singapore');
    add('singapore', 'singapore');
    add('河內', 'hanoi');
    add('河内', 'hanoi');
    add('hanoi', 'hanoi');
    add('胡志明', 'ho-chi-minh');
    add('胡志明市', 'ho-chi-minh');
    add('saigon', 'ho-chi-minh');

    add('日本', 'country:japan');
    add('japan', 'country:japan');
    add('韓國', 'country:korea');
    add('韩国', 'country:korea');
    add('korea', 'country:korea');
    add('south korea', 'country:korea');
    add('泰國', 'country:thailand');
    add('泰国', 'country:thailand');
    add('thailand', 'country:thailand');
    add('越南', 'country:vietnam');
    add('vietnam', 'country:vietnam');
    add('美國', 'country:usa');
    add('美国', 'country:usa');
    add('usa', 'country:usa');
    add('united states', 'country:usa');
    add('澳洲', 'country:australia');
    add('澳大利亞', 'country:australia');
    add('australia', 'country:australia');
    add('英國', 'country:uk');
    add('英国', 'country:uk');
    add('uk', 'country:uk');
    add('法國', 'country:france');
    add('法国', 'country:france');
    add('france', 'country:france');

    add('北海道', 'region:hokkaido');
    add('hokkaido', 'region:hokkaido');
    return map;
  }

  function normalizeKey(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function slugifyCity(raw) {
    var s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!s) return '';
    if (/^[a-z][a-z0-9-]{0,39}$/.test(s)) return s.slice(0, 40);
    // Non-latin free text → stable short slug prefix
    var hash = 0;
    var i;
    for (i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return ('c' + hash.toString(36)).slice(0, 40);
  }

  function emptyTaxonomy() {
    return {
      countryId: '',
      countryName: '',
      regionId: '',
      regionName: '',
      cityId: '',
      cityName: '',
      locationRaw: '',
      locationSource: 'manual',
      feedKind: 'global',
      displayLabel: '',
      chipLabel: ''
    };
  }

  function fromCityRecord(rec, raw, source) {
    var out = emptyTaxonomy();
    out.countryId = rec.countryId;
    out.countryName = rec.countryName;
    out.regionId = rec.regionId || '';
    out.regionName = rec.regionName || '';
    out.cityId = rec.cityId;
    out.cityName = rec.cityName;
    out.locationRaw = raw || rec.cityName;
    out.locationSource = source || 'alias';
    out.feedKind = 'city';
    out.displayLabel = rec.cityName;
    out.chipLabel = formatChip(out);
    return out;
  }

  function fromCountry(countryId, raw, source) {
    var c = COUNTRIES[countryId];
    var out = emptyTaxonomy();
    if (!c) return out;
    out.countryId = c.id;
    out.countryName = c.name;
    out.locationRaw = raw || c.name;
    out.locationSource = source || 'alias';
    out.feedKind = 'country';
    out.displayLabel = c.name;
    out.chipLabel = formatChip(out);
    return out;
  }

  function fromRegion(regionId, raw, source) {
    var r = REGIONS[regionId];
    var out = emptyTaxonomy();
    if (!r) return out;
    var c = COUNTRIES[r.countryId];
    out.countryId = r.countryId;
    out.countryName = c ? c.name : r.countryId;
    out.regionId = r.id;
    out.regionName = r.name;
    out.locationRaw = raw || r.name;
    out.locationSource = source || 'alias';
    out.feedKind = 'region';
    out.displayLabel = r.name;
    out.chipLabel = formatChip(out);
    return out;
  }

  function formatChip(tax) {
    var parts = [];
    if (tax.cityName) parts.push(tax.cityName);
    if (tax.regionName && tax.regionName !== tax.cityName) parts.push(tax.regionName);
    if (tax.countryName) parts.push(tax.countryName);
    if (!parts.length && tax.displayLabel) return '📍 ' + tax.displayLabel;
    if (!parts.length) return '';
    return '📍 ' + parts.join('・');
  }

  /**
   * Resolve free text / known id into taxonomy.
   * Never throws; unknown city still returns best-effort country + slug cityId when country known.
   */
  function resolveLocation(input, hints) {
    hints = hints || {};
    var raw = String(input || '').trim();
    var key = normalizeKey(raw);

    if (hints.cityId && CITIES[hints.cityId]) {
      return fromCityRecord(CITIES[hints.cityId], raw || CITIES[hints.cityId].cityName, hints.source || 'card');
    }
    if (hints.regionId && REGIONS[hints.regionId] && !hints.cityId) {
      return fromRegion(hints.regionId, raw, hints.source || 'card');
    }
    if (hints.countryId && COUNTRIES[hints.countryId] && !hints.cityId && !raw) {
      return fromCountry(hints.countryId, hints.countryName, hints.source || 'card');
    }

    if (key && ALIASES[key]) {
      var target = ALIASES[key];
      if (target.indexOf('country:') === 0) {
        return fromCountry(target.slice(8), raw, 'alias');
      }
      if (target.indexOf('region:') === 0) {
        return fromRegion(target.slice(7), raw, 'alias');
      }
      if (CITIES[target]) {
        return fromCityRecord(CITIES[target], raw, 'alias');
      }
    }

    // Partial contains for multi-word destinations (e.g. 北海道札幌 already aliased)
    if (raw) {
      var cityKeys = Object.keys(CITIES);
      var i;
      for (i = 0; i < cityKeys.length; i++) {
        var rec = CITIES[cityKeys[i]];
        if (raw.indexOf(rec.cityName) !== -1) {
          return fromCityRecord(rec, raw, 'alias');
        }
      }
      if (/北海道|hokkaido/i.test(raw) && /札幌|sapporo/i.test(raw)) {
        return fromCityRecord(CITIES.sapporo, raw, 'alias');
      }
      if (/北海道|hokkaido/i.test(raw)) {
        return fromRegion('hokkaido', raw, 'alias');
      }
    }

    var out = emptyTaxonomy();
    out.locationRaw = raw;
    out.locationSource = hints.source || 'manual';

    if (hints.countryId && COUNTRIES[hints.countryId]) {
      out.countryId = hints.countryId;
      out.countryName = COUNTRIES[hints.countryId].name;
    } else if (raw) {
      // Heuristic country from text
      var countryGuess = guessCountryFromText(raw);
      if (countryGuess) {
        out.countryId = countryGuess.id;
        out.countryName = countryGuess.name;
      }
    }

    if (raw && out.countryId) {
      out.cityId = slugifyCity(raw);
      out.cityName = raw;
      out.feedKind = 'city';
      out.displayLabel = raw;
    } else if (out.countryId) {
      out.feedKind = 'country';
      out.displayLabel = out.countryName;
    } else if (raw) {
      out.cityId = slugifyCity(raw);
      out.cityName = raw;
      out.feedKind = 'city';
      out.displayLabel = raw;
    }
    out.chipLabel = formatChip(out);
    return out;
  }

  function guessCountryFromText(raw) {
    var rules = [
      [/日本|japan|tokyo|osaka|kyoto|hokkaido|okinawa|札幌|名古屋|福岡/i, 'japan'],
      [/韓國|韩国|korea|seoul|busan|jeju|首爾|釜山|濟州/i, 'korea'],
      [/泰國|泰国|thailand|bangkok|曼谷/i, 'thailand'],
      [/越南|vietnam|hanoi|河內|胡志明/i, 'vietnam'],
      [/美國|美国|usa|america|new\s*york|los\s*angeles|舊金山|紐約/i, 'usa'],
      [/澳洲|australia|sydney|melbourne|雪梨|墨爾本/i, 'australia'],
      [/英國|英国|london|london|倫敦/i, 'uk'],
      [/法國|法国|france|paris|巴黎/i, 'france'],
      [/新加坡|singapore/i, 'singapore']
    ];
    var i;
    for (i = 0; i < rules.length; i++) {
      if (rules[i][0].test(raw)) return COUNTRIES[rules[i][1]];
    }
    return null;
  }

  /** Normalize a Firestore post (lazy) — never mutates server unless caller writes back. */
  function normalizePostTaxonomy(post) {
    if (!post) return post;
    if (post.countryId && COUNTRIES[post.countryId]) {
      if (!post.countryName) post.countryName = COUNTRIES[post.countryId].name;
      if (post.regionId && REGIONS[post.regionId] && !post.regionName) {
        post.regionName = REGIONS[post.regionId].name;
      }
      if (post.cityId && CITIES[post.cityId] && !post.cityName) {
        post.cityName = CITIES[post.cityId].cityName;
      }
      return post;
    }
    var legacy = LEGACY_ENTRY[post.cityId];
    if (legacy) {
      post.countryId = legacy.countryId;
      post.countryName = legacy.countryName;
      post.regionId = legacy.regionId || '';
      post.regionName = legacy.regionName || '';
      if (!post.cityName) post.cityName = legacy.cityName || '';
      post.locationSource = post.locationSource || 'migrated';
      return post;
    }
    if (post.cityId && CITIES[post.cityId]) {
      var rec = CITIES[post.cityId];
      post.countryId = rec.countryId;
      post.countryName = rec.countryName;
      post.regionId = rec.regionId || '';
      post.regionName = rec.regionName || '';
      post.cityName = post.cityName || rec.cityName;
      post.locationSource = post.locationSource || 'migrated';
      return post;
    }
    if (post.cityId) {
      var guessed = guessCountryFromText(post.cityId + ' ' + (post.cityName || ''));
      if (guessed) {
        post.countryId = guessed.id;
        post.countryName = guessed.name;
        post.locationSource = post.locationSource || 'migrated';
      }
    }
    return post;
  }

  function resolveEntryCard(card) {
    if (!card) return emptyTaxonomy();
    if (card.type === 'country') {
      return fromCountry(card.countryId, card.displayName, 'card');
    }
    if (card.type === 'region') {
      return fromRegion(card.regionId || card.id, card.displayName, 'card');
    }
    if (card.type === 'city') {
      return resolveLocation(card.cityId || card.displayName, {
        cityId: card.cityId,
        countryId: card.countryId,
        source: 'card'
      });
    }
    return resolveLocation(card.id || card.displayName, { source: 'card' });
  }

  function listCountries() {
    return Object.keys(COUNTRIES).map(function (k) {
      return COUNTRIES[k];
    });
  }

  function listCitySuggestions(countryId, query) {
    var q = normalizeKey(query);
    return Object.keys(CITIES)
      .map(function (k) {
        return CITIES[k];
      })
      .filter(function (c) {
        if (countryId && c.countryId !== countryId) return false;
        if (!q) return true;
        return (
          normalizeKey(c.cityId).indexOf(q) !== -1 ||
          normalizeKey(c.cityName).indexOf(q) !== -1
        );
      })
      .slice(0, 12);
  }

  global.SOARVIBE_CITY_SHARES_LOCATION = Object.freeze({
    COUNTRIES: COUNTRIES,
    REGIONS: REGIONS,
    CITIES: CITIES,
    LEGACY_ENTRY: LEGACY_ENTRY,
    resolveLocation: resolveLocation,
    normalizePostTaxonomy: normalizePostTaxonomy,
    resolveEntryCard: resolveEntryCard,
    formatChip: formatChip,
    slugifyCity: slugifyCity,
    listCountries: listCountries,
    listCitySuggestions: listCitySuggestions
  });
})(typeof window !== 'undefined' ? window : globalThis);
