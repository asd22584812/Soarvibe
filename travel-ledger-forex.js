/**
 * Travel Ledger — exchange rate helpers (no network in Phase 1A).
 */
(function (global) {
  'use strict';

  var CONFIG = global.SOARVIBE_TRAVEL_LEDGER_CONFIG;
  if (!CONFIG) {
    throw new Error('travel-ledger-forex.js requires travel-ledger-config.js');
  }

  var CACHE_KEY = 'soarvibeTravelLedgerForexCache';
  var CACHE_TTL_MS = 3600000;

  /** @type {Record<string, { rate:number, fetchedAt:number, source:string }>} */
  var memoryCache = Object.create(null);

  function nowIso() {
    return new Date().toISOString();
  }

  function cacheKey(fromCode, toCode) {
    return String(fromCode || '').toUpperCase() + '->' + String(toCode || '').toUpperCase();
  }

  function readPersistedCache() {
    if (typeof localStorage === 'undefined') return;
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryCache = parsed;
      }
    } catch (e) {
      memoryCache = Object.create(null);
    }
  }

  function writePersistedCache() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
    } catch (e) {
      /* quota or private mode */
    }
  }

  readPersistedCache();

  function getCachedExchangeRate(fromCode, toCode) {
    var key = cacheKey(fromCode, toCode);
    var entry = memoryCache[key];
    if (!entry || typeof entry.rate !== 'number' || !isFinite(entry.rate)) return null;
    if (Date.now() - (entry.fetchedAt || 0) > CACHE_TTL_MS) return null;
    return {
      rate: entry.rate,
      source: entry.source || CONFIG.EXCHANGE_RATE_SOURCES.cache,
      fetchedAt: entry.fetchedAt
    };
  }

  function setCachedExchangeRate(fromCode, toCode, rate, source) {
    if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) return null;
    var key = cacheKey(fromCode, toCode);
    var entry = {
      rate: rate,
      fetchedAt: Date.now(),
      source: source || CONFIG.EXCHANGE_RATE_SOURCES.cache
    };
    memoryCache[key] = entry;
    writePersistedCache();
    return entry;
  }

  function getManualExchangeRate(ledger) {
    if (!ledger || ledger.manualExchangeRate == null) return null;
    var rate = Number(ledger.manualExchangeRate);
    if (!isFinite(rate) || rate <= 0) return null;
    return rate;
  }

  function minorUnitFactor(code) {
    var digits = CONFIG.getMinorUnitDigits(code);
    var factor = 1;
    var i;
    for (i = 0; i < digits; i++) factor *= 10;
    return factor;
  }

  function convertMinorUnits(amountMinor, fromCode, toCode, rate) {
    if (amountMinor == null || typeof amountMinor !== 'number' || !isFinite(amountMinor)) return null;
    if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) return null;
    var from = String(fromCode || '').toUpperCase();
    var to = String(toCode || '').toUpperCase();
    if (from === to) return Math.round(amountMinor);
    var fromMajor = amountMinor / minorUnitFactor(from);
    var toMajor = fromMajor * rate;
    return Math.round(toMajor * minorUnitFactor(to));
  }

  /**
   * Resolve rate without network. Priority: manual → cache → unavailable.
   * existing_soarvibe_fx can be injected via options.injectedRate in Phase 1B+.
   */
  function createExchangeRateSnapshot(fromCode, toCode, ledger, options) {
    options = options || {};
    var from = String(fromCode || '').toUpperCase();
    var to = String(toCode || '').toUpperCase();
    if (!from || !to) {
      return {
        rate: null,
        source: CONFIG.EXCHANGE_RATE_SOURCES.unavailable,
        convertedAmountMinor: null
      };
    }
    if (from === to) {
      return {
        rate: 1,
        source: CONFIG.EXCHANGE_RATE_SOURCES.manual,
        convertedAmountMinor: options.amountMinor != null ? Math.round(options.amountMinor) : null
      };
    }

    var manual = getManualExchangeRate(ledger);
    if (manual != null) {
      return {
        rate: manual,
        source: CONFIG.EXCHANGE_RATE_SOURCES.manual,
        convertedAmountMinor:
          options.amountMinor != null
            ? convertMinorUnits(options.amountMinor, from, to, manual)
            : null
      };
    }

    if (options.injectedRate != null && isFinite(options.injectedRate) && options.injectedRate > 0) {
      return {
        rate: options.injectedRate,
        source: CONFIG.EXCHANGE_RATE_SOURCES.existing_soarvibe_fx,
        convertedAmountMinor:
          options.amountMinor != null
            ? convertMinorUnits(options.amountMinor, from, to, options.injectedRate)
            : null
      };
    }

    var cached = getCachedExchangeRate(from, to);
    if (cached) {
      return {
        rate: cached.rate,
        source: cached.source || CONFIG.EXCHANGE_RATE_SOURCES.cache,
        convertedAmountMinor:
          options.amountMinor != null
            ? convertMinorUnits(options.amountMinor, from, to, cached.rate)
            : null
      };
    }

    return {
      rate: null,
      source: CONFIG.EXCHANGE_RATE_SOURCES.unavailable,
      convertedAmountMinor: null
    };
  }

  /**
   * Stub adapter — Phase 1A never performs network I/O.
   * Phase 1B+ may delegate to SoarVibe fetchForexRates().
   */
  function fetchExchangeRate(fromCode, toCode) {
    return Promise.resolve({
      rate: null,
      source: CONFIG.EXCHANGE_RATE_SOURCES.unavailable,
      fetchedAt: nowIso()
    });
  }

  function clearForexCacheForTests() {
    memoryCache = Object.create(null);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (e) {
        /* ignore */
      }
    }
  }

  global.SOARVIBE_TRAVEL_LEDGER_FOREX = Object.freeze({
    CACHE_TTL_MS: CACHE_TTL_MS,
    getCachedExchangeRate: getCachedExchangeRate,
    setCachedExchangeRate: setCachedExchangeRate,
    getManualExchangeRate: getManualExchangeRate,
    createExchangeRateSnapshot: createExchangeRateSnapshot,
    convertMinorUnits: convertMinorUnits,
    fetchExchangeRate: fetchExchangeRate,
    clearForexCacheForTests: clearForexCacheForTests
  });
})(typeof window !== 'undefined' ? window : globalThis);
