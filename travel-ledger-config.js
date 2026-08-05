/**
 * Travel Ledger — shared config (categories, currencies, enums).
 * UI strings and emoji live here only.
 */
(function (global) {
  'use strict';

  var EXPENSE_CATEGORIES = Object.freeze({
    food: { label: '美食', icon: '🍜' },
    cafe: { label: '咖啡甜點', icon: '☕' },
    shopping: { label: '購物', icon: '🛍️' },
    souvenir: { label: '伴手禮', icon: '🎁' },
    transport: { label: '交通', icon: '🚃' },
    lodging: { label: '住宿', icon: '🏨' },
    ticket: { label: '門票活動', icon: '🎫' },
    entertainment: { label: '動漫娛樂', icon: '🎮' },
    nightlife: { label: '酒吧夜生活', icon: '🍺' },
    drugstore: { label: '藥妝', icon: '💊' },
    communication: { label: '網路通訊', icon: '📱' },
    other: { label: '其他', icon: '🧳' }
  });

  var PAYMENT_METHODS = Object.freeze({
    cash: { label: '現金' },
    credit_card: { label: '信用卡' },
    electronic: { label: '電子支付' },
    other: { label: '其他' }
  });

  var MOODS = Object.freeze({
    great: { label: '超值得', icon: '😍' },
    good: { label: '不錯', icon: '😊' },
    neutral: { label: '普通', icon: '😐' },
    bad: { label: '踩雷', icon: '😭' }
  });

  var LEDGER_STATUSES = Object.freeze({
    upcoming: { label: '即將出發' },
    active: { label: '旅行中' },
    ended: { label: '已結束' },
    archived: { label: '已封存' }
  });

  var CASH_ADJUSTMENT_TYPES = Object.freeze({
    add: { label: '增加現金' },
    subtract: { label: '減少現金' }
  });

  var EXCHANGE_RATE_SOURCES = Object.freeze({
    manual: 'manual',
    cache: 'cache',
    existing_soarvibe_fx: 'existing_soarvibe_fx',
    unavailable: 'unavailable'
  });

  /** ISO 4217 code → { symbol, name, minorUnitDigits } */
  var CURRENCIES = Object.freeze({
    JPY: { symbol: '¥', name: '日圓', minorUnitDigits: 0 },
    KRW: { symbol: '₩', name: '韓元', minorUnitDigits: 0 },
    VND: { symbol: '₫', name: '越南盾', minorUnitDigits: 0 },
    TWD: { symbol: 'NT$', name: '新台幣', minorUnitDigits: 0 },
    USD: { symbol: '$', name: '美元', minorUnitDigits: 2 },
    EUR: { symbol: '€', name: '歐元', minorUnitDigits: 2 },
    GBP: { symbol: '£', name: '英鎊', minorUnitDigits: 2 },
    THB: { symbol: '฿', name: '泰銖', minorUnitDigits: 2 },
    SGD: { symbol: 'S$', name: '新加坡幣', minorUnitDigits: 2 },
    HKD: { symbol: 'HK$', name: '港幣', minorUnitDigits: 2 },
    MOP: { symbol: 'MOP$', name: '澳門幣', minorUnitDigits: 2 },
    CNY: { symbol: '¥', name: '人民幣', minorUnitDigits: 2 },
    MYR: { symbol: 'RM', name: '馬來西亞令吉', minorUnitDigits: 2 },
    IDR: { symbol: 'Rp', name: '印尼盾', minorUnitDigits: 0 },
    PHP: { symbol: '₱', name: '菲律賓披索', minorUnitDigits: 2 },
    AUD: { symbol: 'A$', name: '澳幣', minorUnitDigits: 2 },
    CAD: { symbol: 'C$', name: '加幣', minorUnitDigits: 2 },
    NZD: { symbol: 'NZ$', name: '紐西蘭幣', minorUnitDigits: 2 },
    CHF: { symbol: 'CHF', name: '瑞士法郎', minorUnitDigits: 2 },
    AED: { symbol: 'AED', name: '阿聯酋迪拉姆', minorUnitDigits: 2 }
  });

  var COUNTRY_PROFILES = Object.freeze([
    { countryCode: 'JP', countryName: '日本', defaultCityName: '東京', emoji: '🇯🇵', currencyCode: 'JPY' },
    { countryCode: 'KR', countryName: '韓國', defaultCityName: '首爾', emoji: '🇰🇷', currencyCode: 'KRW' },
    { countryCode: 'TH', countryName: '泰國', defaultCityName: '曼谷', emoji: '🇹🇭', currencyCode: 'THB' },
    { countryCode: 'VN', countryName: '越南', defaultCityName: '河內', emoji: '🇻🇳', currencyCode: 'VND' },
    { countryCode: 'GB', countryName: '英國', defaultCityName: '倫敦', emoji: '🇬🇧', currencyCode: 'GBP' },
    { countryCode: 'FR', countryName: '法國', defaultCityName: '巴黎', emoji: '🇫🇷', currencyCode: 'EUR' },
    { countryCode: 'US', countryName: '美國', defaultCityName: '紐約', emoji: '🇺🇸', currencyCode: 'USD' },
    { countryCode: 'TW', countryName: '台灣', defaultCityName: '台北', emoji: '🇹🇼', currencyCode: 'TWD' },
    { countryCode: 'SG', countryName: '新加坡', defaultCityName: '新加坡', emoji: '🇸🇬', currencyCode: 'SGD' },
    { countryCode: 'HK', countryName: '香港', defaultCityName: '香港', emoji: '🇭🇰', currencyCode: 'HKD' },
    { countryCode: 'MO', countryName: '澳門', defaultCityName: '澳門', emoji: '🇲🇴', currencyCode: 'MOP' },
    { countryCode: 'CN', countryName: '中國', defaultCityName: '上海', emoji: '🇨🇳', currencyCode: 'CNY' },
    { countryCode: 'MY', countryName: '馬來西亞', defaultCityName: '吉隆坡', emoji: '🇲🇾', currencyCode: 'MYR' },
    { countryCode: 'ID', countryName: '印尼', defaultCityName: '峇里', emoji: '🇮🇩', currencyCode: 'IDR' },
    { countryCode: 'PH', countryName: '菲律賓', defaultCityName: '馬尼拉', emoji: '🇵🇭', currencyCode: 'PHP' },
    { countryCode: 'AU', countryName: '澳洲', defaultCityName: '雪梨', emoji: '🇦🇺', currencyCode: 'AUD' },
    { countryCode: 'EU', countryName: '歐元區', defaultCityName: '巴黎', emoji: '🇪🇺', currencyCode: 'EUR' }
  ]);

  var DEFAULT_DISPLAY_CURRENCY_CODE = 'TWD';

  function listCategoryKeys() {
    return Object.keys(EXPENSE_CATEGORIES);
  }

  function listPaymentMethodKeys() {
    return Object.keys(PAYMENT_METHODS);
  }

  function getCategoryMeta(key) {
    return EXPENSE_CATEGORIES[key] || null;
  }

  function getPaymentMethodMeta(key) {
    return PAYMENT_METHODS[key] || null;
  }

  function getCurrencyMeta(code) {
    if (!code) return null;
    return CURRENCIES[String(code).toUpperCase()] || null;
  }

  function getMinorUnitDigits(code) {
    var meta = getCurrencyMeta(code);
    return meta ? meta.minorUnitDigits : 2;
  }

  function getCurrencySymbol(code) {
    var meta = getCurrencyMeta(code);
    return meta ? meta.symbol : String(code || '');
  }

  function getCountryProfile(countryCode) {
    if (!countryCode) return null;
    var upper = String(countryCode).toUpperCase();
    for (var i = 0; i < COUNTRY_PROFILES.length; i++) {
      if (COUNTRY_PROFILES[i].countryCode === upper) return COUNTRY_PROFILES[i];
    }
    return null;
  }

  function isValidCategory(key) {
    return !!EXPENSE_CATEGORIES[key];
  }

  function isValidPaymentMethod(key) {
    return !!PAYMENT_METHODS[key];
  }

  function isValidLedgerStatus(key) {
    return !!LEDGER_STATUSES[key];
  }

  function isValidCashAdjustmentType(key) {
    return !!CASH_ADJUSTMENT_TYPES[key];
  }

  function isValidMood(key) {
    return !!MOODS[key];
  }

  function isValidCurrencyCode(code) {
    return !!getCurrencyMeta(code);
  }

  global.SOARVIBE_TRAVEL_LEDGER_CONFIG = Object.freeze({
    STORAGE_KEY: 'soarvibeTravelLedgers',
    RECOVERY_KEY: 'soarvibeTravelLedgersRecovery',
    STORE_VERSION: 1,
    DEFAULT_DISPLAY_CURRENCY_CODE: DEFAULT_DISPLAY_CURRENCY_CODE,
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    PAYMENT_METHODS: PAYMENT_METHODS,
    MOODS: MOODS,
    LEDGER_STATUSES: LEDGER_STATUSES,
    CASH_ADJUSTMENT_TYPES: CASH_ADJUSTMENT_TYPES,
    EXCHANGE_RATE_SOURCES: EXCHANGE_RATE_SOURCES,
    CURRENCIES: CURRENCIES,
    COUNTRY_PROFILES: COUNTRY_PROFILES,
    listCategoryKeys: listCategoryKeys,
    listPaymentMethodKeys: listPaymentMethodKeys,
    getCategoryMeta: getCategoryMeta,
    getPaymentMethodMeta: getPaymentMethodMeta,
    getCurrencyMeta: getCurrencyMeta,
    getMinorUnitDigits: getMinorUnitDigits,
    getCurrencySymbol: getCurrencySymbol,
    getCountryProfile: getCountryProfile,
    isValidCategory: isValidCategory,
    isValidPaymentMethod: isValidPaymentMethod,
    isValidLedgerStatus: isValidLedgerStatus,
    isValidCashAdjustmentType: isValidCashAdjustmentType,
    isValidMood: isValidMood,
    isValidCurrencyCode: isValidCurrencyCode
  });
})(typeof window !== 'undefined' ? window : globalThis);
