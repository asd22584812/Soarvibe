/**
 * Travel Ledger — localStorage repository + pure calculation helpers.
 * No DOM, no paid APIs, no mutation of input objects.
 */
(function (global) {
  'use strict';

  var CONFIG = global.SOARVIBE_TRAVEL_LEDGER_CONFIG;
  var FOREX = global.SOARVIBE_TRAVEL_LEDGER_FOREX;
  if (!CONFIG || !FOREX) {
    throw new Error('travel-ledger-data.js requires travel-ledger-config.js and travel-ledger-forex.js');
  }

  var STORAGE_KEY = CONFIG.STORAGE_KEY;
  var RECOVERY_KEY = CONFIG.RECOVERY_KEY;
  var STORE_VERSION = CONFIG.STORE_VERSION;

  function nowIso() {
    return new Date().toISOString();
  }

  function generateId(prefix) {
    var rand = Math.random().toString(36).slice(2, 10);
    var extra = Math.random().toString(36).slice(2, 6);
    return prefix + '_' + Date.now().toString(36) + '_' + rand + extra;
  }

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isPlainObject(v) {
    return v != null && typeof v === 'object' && !Array.isArray(v);
  }

  function parseDateOnly(isoDate) {
    if (!isoDate || typeof isoDate !== 'string') return null;
    var m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  function formatDateOnly(date) {
    var y = date.getFullYear();
    var mo = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + d;
  }

  function compareDateOnly(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function daysBetweenInclusive(startDate, endDate) {
    var s = parseDateOnly(startDate);
    var e = parseDateOnly(endDate);
    if (!s || !e) return 0;
    var diff = e.getTime() - s.getTime();
    if (diff < 0) return 0;
    return Math.floor(diff / 86400000) + 1;
  }

  function resolveReferenceDate(referenceDate) {
    if (referenceDate instanceof Date && !isNaN(referenceDate.getTime())) {
      return formatDateOnly(referenceDate);
    }
    if (typeof referenceDate === 'string' && referenceDate.length >= 10) {
      return referenceDate.slice(0, 10);
    }
    return formatDateOnly(new Date());
  }

  function deriveLedgerStatus(ledger, referenceDate) {
    var ref = resolveReferenceDate(referenceDate);
    if (ledger.status === 'archived') return 'archived';
    if (!ledger.startDate || !ledger.endDate) return ledger.status || 'upcoming';
    if (compareDateOnly(ref, ledger.startDate) < 0) return 'upcoming';
    if (compareDateOnly(ref, ledger.endDate) > 0) return 'ended';
    return 'active';
  }

  function sanitizeMinor(value, allowNull) {
    if (value == null) return allowNull ? null : 0;
    var n = Number(value);
    if (!isFinite(n) || n < 0) return allowNull ? null : 0;
    return Math.round(n);
  }

  function buildCurrencyBlock(code) {
    var upper = String(code || '').toUpperCase();
    var meta = CONFIG.getCurrencyMeta(upper);
    if (!meta) {
      return {
        code: upper,
        symbol: upper,
        name: upper,
        minorUnitDigits: 2
      };
    }
    return {
      code: upper,
      symbol: meta.symbol,
      name: meta.name,
      minorUnitDigits: meta.minorUnitDigits
    };
  }

  function normalizeExpense(raw, ledger) {
    if (!isPlainObject(raw)) return null;
    var category = CONFIG.isValidCategory(raw.category) ? raw.category : 'other';
    var catMeta = CONFIG.getCategoryMeta(category);
    var currencyCode = String(raw.currencyCode || (ledger && ledger.primaryCurrency && ledger.primaryCurrency.code) || 'JPY').toUpperCase();
    var currencyBlock = buildCurrencyBlock(currencyCode);
    var paymentMethod = CONFIG.isValidPaymentMethod(raw.paymentMethod) ? raw.paymentMethod : 'cash';
    var conversionCurrency = String(
      raw.conversionCurrency || (ledger && ledger.displayCurrency && ledger.displayCurrency.code) || CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE
    ).toUpperCase();
    var conversionBlock = buildCurrencyBlock(conversionCurrency);
    var amountMinor = sanitizeMinor(raw.amountMinor, false);
    var convertedAmountMinor =
      raw.convertedAmountMinor == null ? null : sanitizeMinor(raw.convertedAmountMinor, true);
    var mood = raw.mood && CONFIG.isValidMood(raw.mood) ? raw.mood : null;
    var occurredAt = typeof raw.occurredAt === 'string' && raw.occurredAt ? raw.occurredAt : nowIso();
    return {
      id: raw.id || generateId('expense'),
      amountMinor: amountMinor,
      currencyCode: currencyBlock.code,
      currencySymbol: raw.currencySymbol || currencyBlock.symbol,
      currencyMinorUnit: currencyBlock.minorUnitDigits,
      convertedAmountMinor: convertedAmountMinor,
      conversionCurrency: conversionBlock.code,
      conversionMinorUnit: conversionBlock.minorUnitDigits,
      exchangeRateSnapshot:
        raw.exchangeRateSnapshot == null ? null : Number(raw.exchangeRateSnapshot),
      exchangeRateSource: raw.exchangeRateSource || CONFIG.EXCHANGE_RATE_SOURCES.unavailable,
      category: category,
      categoryLabel: raw.categoryLabel || (catMeta && catMeta.label) || category,
      categoryIcon: raw.categoryIcon || (catMeta && catMeta.icon) || '🧳',
      paymentMethod: paymentMethod,
      title: typeof raw.title === 'string' ? raw.title.trim() : '',
      note: typeof raw.note === 'string' ? raw.note.trim() : '',
      mood: mood,
      occurredAt: occurredAt,
      createdAt: raw.createdAt || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
      excludeFromBudget: !!raw.excludeFromBudget
    };
  }

  function normalizeCashAdjustment(raw, ledger) {
    if (!isPlainObject(raw)) return null;
    var type = CONFIG.isValidCashAdjustmentType(raw.type) ? raw.type : 'add';
    var currencyCode = String(raw.currencyCode || (ledger && ledger.primaryCurrency && ledger.primaryCurrency.code) || 'JPY').toUpperCase();
    return {
      id: raw.id || generateId('cash'),
      amountMinor: sanitizeMinor(raw.amountMinor, false),
      currencyCode: currencyCode,
      type: type,
      reason: typeof raw.reason === 'string' ? raw.reason.trim() : '',
      occurredAt: typeof raw.occurredAt === 'string' && raw.occurredAt ? raw.occurredAt : nowIso(),
      createdAt: raw.createdAt || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || nowIso()
    };
  }

  function normalizeLedger(raw) {
    if (!isPlainObject(raw)) return null;
    var name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) return null;
    var profile = CONFIG.getCountryProfile(raw.countryCode);
    var primaryCode =
      (raw.primaryCurrency && raw.primaryCurrency.code) ||
      raw.primaryCurrencyCode ||
      (profile && profile.currencyCode) ||
      'JPY';
    var display = buildCurrencyBlock(
      raw.displayCurrency && raw.displayCurrency.code
        ? raw.displayCurrency.code
        : raw.displayCurrencyCode || CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE
    );
    var primary = buildCurrencyBlock(primaryCode);
    var ledger = {
      id: raw.id || generateId('ledger'),
      name: name,
      countryCode: String(raw.countryCode || '').toUpperCase(),
      countryName: typeof raw.countryName === 'string' ? raw.countryName.trim() : '',
      cityName: typeof raw.cityName === 'string' ? raw.cityName.trim() : '',
      emoji: typeof raw.emoji === 'string' ? raw.emoji : '🧳',
      startDate: typeof raw.startDate === 'string' ? raw.startDate.slice(0, 10) : '',
      endDate: typeof raw.endDate === 'string' ? raw.endDate.slice(0, 10) : '',
      status: CONFIG.isValidLedgerStatus(raw.status) ? raw.status : 'upcoming',
      primaryCurrency: primary,
      displayCurrency: display,
      budgetMinor: sanitizeMinor(raw.budgetMinor, true),
      initialCashMinor: sanitizeMinor(raw.initialCashMinor, true),
      manualExchangeRate: raw.manualExchangeRate == null ? null : Number(raw.manualExchangeRate),
      expenses: [],
      cashAdjustments: [],
      createdAt: raw.createdAt || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || nowIso()
    };
    if (ledger.manualExchangeRate != null && (!isFinite(ledger.manualExchangeRate) || ledger.manualExchangeRate <= 0)) {
      ledger.manualExchangeRate = null;
    }
    if (Array.isArray(raw.expenses)) {
      raw.expenses.forEach(function (exp) {
        var n = normalizeExpense(exp, ledger);
        if (n) ledger.expenses.push(n);
      });
    }
    if (Array.isArray(raw.cashAdjustments)) {
      raw.cashAdjustments.forEach(function (adj) {
        var n = normalizeCashAdjustment(adj, ledger);
        if (n) ledger.cashAdjustments.push(n);
      });
    }
    ledger.status = deriveLedgerStatus(ledger);
    return ledger;
  }

  function normalizeTravelLedgerStore(raw) {
    var store = {
      version: STORE_VERSION,
      ledgers: []
    };
    if (!isPlainObject(raw)) return store;
    store.version = typeof raw.version === 'number' ? raw.version : STORE_VERSION;
    if (Array.isArray(raw.ledgers)) {
      raw.ledgers.forEach(function (item) {
        var ledger = normalizeLedger(item);
        if (ledger) store.ledgers.push(ledger);
      });
    }
    return store;
  }

  function migrateTravelLedgerStore(store) {
    var normalized = normalizeTravelLedgerStore(store);
    if (!normalized.version || normalized.version < STORE_VERSION) {
      normalized.version = STORE_VERSION;
    }
    return normalized;
  }

  function readStorageRaw(key) {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStorageRaw(key, value) {
    if (typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadTravelLedgerStore() {
    var raw = readStorageRaw(STORAGE_KEY);
    if (!raw) {
      return { version: STORE_VERSION, ledgers: [] };
    }
    try {
      var parsed = JSON.parse(raw);
      return migrateTravelLedgerStore(parsed);
    } catch (e) {
      writeStorageRaw(RECOVERY_KEY, raw);
      return { version: STORE_VERSION, ledgers: [] };
    }
  }

  function saveTravelLedgerStore(store) {
    var normalized = migrateTravelLedgerStore(store);
    normalized.updatedAt = nowIso();
    writeStorageRaw(STORAGE_KEY, JSON.stringify(normalized));
    return cloneDeep(normalized);
  }

  function withStore(mutator) {
    var store = loadTravelLedgerStore();
    var result = mutator(store);
    saveTravelLedgerStore(store);
    return result;
  }

  function findLedgerIndex(store, ledgerId) {
    for (var i = 0; i < store.ledgers.length; i++) {
      if (store.ledgers[i].id === ledgerId) return i;
    }
    return -1;
  }

  function getTravelLedgers() {
    return cloneDeep(loadTravelLedgerStore().ledgers);
  }

  function getTravelLedgerById(id) {
    var store = loadTravelLedgerStore();
    for (var i = 0; i < store.ledgers.length; i++) {
      if (store.ledgers[i].id === id) return cloneDeep(store.ledgers[i]);
    }
    return null;
  }

  function createTravelLedger(payload) {
    payload = payload || {};
    var profile = CONFIG.getCountryProfile(payload.countryCode);
    var primaryCode =
      payload.primaryCurrencyCode ||
      (payload.primaryCurrency && payload.primaryCurrency.code) ||
      (profile && profile.currencyCode) ||
      'JPY';
    var displayCode =
      payload.displayCurrencyCode ||
      (payload.displayCurrency && payload.displayCurrency.code) ||
      CONFIG.DEFAULT_DISPLAY_CURRENCY_CODE;
    var ledgerInput = {
      id: generateId('ledger'),
      name: payload.name,
      countryCode: payload.countryCode || (profile && profile.countryCode) || '',
      countryName: payload.countryName || (profile && profile.countryName) || '',
      cityName: payload.cityName || (profile && profile.defaultCityName) || '',
      emoji: payload.emoji || (profile && profile.emoji) || '🧳',
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status || 'upcoming',
      primaryCurrency: buildCurrencyBlock(primaryCode),
      displayCurrency: buildCurrencyBlock(displayCode),
      budgetMinor: payload.budgetMinor,
      initialCashMinor: payload.initialCashMinor,
      manualExchangeRate: payload.manualExchangeRate,
      expenses: [],
      cashAdjustments: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    var ledger = normalizeLedger(ledgerInput);
    if (!ledger) throw new Error('invalid_ledger_payload');
    return withStore(function (store) {
      store.ledgers.unshift(ledger);
      return cloneDeep(ledger);
    });
  }

  function updateTravelLedger(id, patch) {
    patch = patch || {};
    return withStore(function (store) {
      var idx = findLedgerIndex(store, id);
      if (idx < 0) return null;
      var current = cloneDeep(store.ledgers[idx]);
      var merged = Object.assign({}, current, patch, {
        id: current.id,
        expenses: current.expenses,
        cashAdjustments: current.cashAdjustments,
        updatedAt: nowIso()
      });
      if (patch.primaryCurrencyCode) merged.primaryCurrency = buildCurrencyBlock(patch.primaryCurrencyCode);
      if (patch.displayCurrencyCode) merged.displayCurrency = buildCurrencyBlock(patch.displayCurrencyCode);
      var normalized = normalizeLedger(merged);
      if (!normalized) return null;
      normalized.expenses = current.expenses;
      normalized.cashAdjustments = current.cashAdjustments;
      normalized.createdAt = current.createdAt;
      normalized.updatedAt = nowIso();
      store.ledgers[idx] = normalized;
      return cloneDeep(normalized);
    });
  }

  function archiveTravelLedger(id) {
    return updateTravelLedger(id, { status: 'archived' });
  }

  function deleteTravelLedger(id) {
    return withStore(function (store) {
      var idx = findLedgerIndex(store, id);
      if (idx < 0) return false;
      store.ledgers.splice(idx, 1);
      return true;
    });
  }

  function applyExpenseSnapshot(ledger, expenseInput) {
    if (expenseInput.amountMinor != null) {
      var rawAmount = Number(expenseInput.amountMinor);
      if (!isFinite(rawAmount) || rawAmount < 0) throw new Error('negative_amount');
    }
    var expense = normalizeExpense(expenseInput, ledger);
    if (!expense) throw new Error('invalid_expense');
    if (expense.amountMinor < 0) throw new Error('negative_amount');

    var preserveUnavailable =
      expenseInput.exchangeRateSource === CONFIG.EXCHANGE_RATE_SOURCES.unavailable &&
      expenseInput.exchangeRateSnapshot == null &&
      expenseInput.convertedAmountMinor == null;

    if (preserveUnavailable) {
      expense.exchangeRateSnapshot = null;
      expense.convertedAmountMinor = null;
      expense.exchangeRateSource = CONFIG.EXCHANGE_RATE_SOURCES.unavailable;
    } else {
      var snap = FOREX.createExchangeRateSnapshot(
        expense.currencyCode,
        expense.conversionCurrency,
        ledger,
        {
          amountMinor: expense.amountMinor,
          injectedRate: expenseInput.injectedRate
        }
      );
      expense.exchangeRateSnapshot = snap.rate;
      expense.exchangeRateSource = snap.source;
      expense.convertedAmountMinor = snap.convertedAmountMinor;
    }
    expense.updatedAt = nowIso();
    return expense;
  }

  function addTravelExpense(ledgerId, expenseInput) {
    expenseInput = expenseInput || {};
    return withStore(function (store) {
      var idx = findLedgerIndex(store, ledgerId);
      if (idx < 0) return null;
      var ledger = store.ledgers[idx];
      var expense = applyExpenseSnapshot(ledger, Object.assign({}, expenseInput, { id: generateId('expense') }));
      ledger.expenses.unshift(expense);
      ledger.updatedAt = nowIso();
      return cloneDeep(expense);
    });
  }

  function updateTravelExpense(ledgerId, expenseId, patch) {
    patch = patch || {};
    return withStore(function (store) {
      var idx = findLedgerIndex(store, ledgerId);
      if (idx < 0) return null;
      var ledger = store.ledgers[idx];
      var expIdx = -1;
      for (var i = 0; i < ledger.expenses.length; i++) {
        if (ledger.expenses[i].id === expenseId) {
          expIdx = i;
          break;
        }
      }
      if (expIdx < 0) return null;
      var merged = Object.assign({}, ledger.expenses[expIdx], patch, { id: expenseId });
      var expense = applyExpenseSnapshot(ledger, merged);
      ledger.expenses[expIdx] = expense;
      ledger.updatedAt = nowIso();
      return cloneDeep(expense);
    });
  }

  function deleteTravelExpense(ledgerId, expenseId) {
    return withStore(function (store) {
      var idx = findLedgerIndex(store, ledgerId);
      if (idx < 0) return false;
      var ledger = store.ledgers[idx];
      var before = ledger.expenses.length;
      ledger.expenses = ledger.expenses.filter(function (e) {
        return e.id !== expenseId;
      });
      if (ledger.expenses.length === before) return false;
      ledger.updatedAt = nowIso();
      return true;
    });
  }

  function duplicateTravelExpense(ledgerId, expenseId) {
    return withStore(function (store) {
      var idx = findLedgerIndex(store, ledgerId);
      if (idx < 0) return null;
      var ledger = store.ledgers[idx];
      var source = null;
      for (var i = 0; i < ledger.expenses.length; i++) {
        if (ledger.expenses[i].id === expenseId) {
          source = ledger.expenses[i];
          break;
        }
      }
      if (!source) return null;
    var copy = cloneDeep(source);
    copy.id = generateId('expense');
    copy.createdAt = nowIso();
    copy.updatedAt = nowIso();
    ledger.expenses.unshift(copy);
      ledger.updatedAt = nowIso();
      return cloneDeep(copy);
    });
  }

  function addCashAdjustment(ledgerId, adjustmentInput) {
    adjustmentInput = adjustmentInput || {};
    return withStore(function (store) {
      var idx = findLedgerIndex(store, ledgerId);
      if (idx < 0) return null;
      var ledger = store.ledgers[idx];
      var adj = normalizeCashAdjustment(
        Object.assign({}, adjustmentInput, { id: generateId('cash') }),
        ledger
      );
      if (!adj) throw new Error('invalid_cash_adjustment');
      if (adjustmentInput.amountMinor != null) {
        var rawAdjAmount = Number(adjustmentInput.amountMinor);
        if (!isFinite(rawAdjAmount) || rawAdjAmount < 0) throw new Error('negative_amount');
      }
      if (adj.amountMinor < 0) throw new Error('invalid_cash_adjustment');
      ledger.cashAdjustments.unshift(adj);
      ledger.updatedAt = nowIso();
      return cloneDeep(adj);
    });
  }

  function updateCashAdjustment(ledgerId, adjustmentId, patch) {
    patch = patch || {};
    return withStore(function (store) {
      var idx = findLedgerIndex(store, ledgerId);
      if (idx < 0) return null;
      var ledger = store.ledgers[idx];
      for (var i = 0; i < ledger.cashAdjustments.length; i++) {
        if (ledger.cashAdjustments[i].id === adjustmentId) {
          var merged = Object.assign({}, ledger.cashAdjustments[i], patch, { id: adjustmentId, updatedAt: nowIso() });
          var adj = normalizeCashAdjustment(merged, ledger);
          if (!adj) return null;
          ledger.cashAdjustments[i] = adj;
          ledger.updatedAt = nowIso();
          return cloneDeep(adj);
        }
      }
      return null;
    });
  }

  function deleteCashAdjustment(ledgerId, adjustmentId) {
    return withStore(function (store) {
      var idx = findLedgerIndex(store, ledgerId);
      if (idx < 0) return false;
      var ledger = store.ledgers[idx];
      var before = ledger.cashAdjustments.length;
      ledger.cashAdjustments = ledger.cashAdjustments.filter(function (a) {
        return a.id !== adjustmentId;
      });
      if (ledger.cashAdjustments.length === before) return false;
      ledger.updatedAt = nowIso();
      return true;
    });
  }

  function minorUnitFactor(code) {
    var digits = CONFIG.getMinorUnitDigits(code);
    var factor = 1;
    var i;
    for (i = 0; i < digits; i++) factor *= 10;
    return factor;
  }

  function formatMoneyMinor(amountMinor, currencyCode, options) {
    options = options || {};
    if (amountMinor == null) return '—';
    var code = String(currencyCode || '').toUpperCase();
    var meta = CONFIG.getCurrencyMeta(code);
    var digits = meta ? meta.minorUnitDigits : 2;
    var symbol = options.symbol || (meta && meta.symbol) || code;
    var major = amountMinor / minorUnitFactor(code);
    var formatted =
      digits === 0
        ? Math.round(major).toLocaleString('en-US')
        : major.toLocaleString('en-US', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
          });
    if (options.symbolAfter) return formatted + ' ' + symbol;
    return symbol + formatted;
  }

  function parseMoneyToMinor(input, currencyCode) {
    var result = validateMoneyInput(input, currencyCode);
    return result.ok ? result.minor : null;
  }

  function validateMoneyInput(input, currencyCode) {
    if (input == null || input === '') {
      return { ok: false, minor: null, error: 'empty' };
    }
    var code = String(currencyCode || '').toUpperCase();
    var digits = CONFIG.getMinorUnitDigits(code);
    var factor = minorUnitFactor(code);
    var str = String(input).replace(/,/g, '').trim();
    if (!str) {
      return { ok: false, minor: null, error: 'empty' };
    }
    if (digits === 0) {
      if (!/^\d+$/.test(str)) {
        return { ok: false, minor: null, error: 'integer_only' };
      }
    } else if (!/^\d+(\.\d+)?$/.test(str)) {
      return { ok: false, minor: null, error: 'invalid_format' };
    } else {
      var decimalPart = str.split('.')[1];
      if (decimalPart && decimalPart.length > digits) {
        return { ok: false, minor: null, error: 'too_many_decimals' };
      }
    }
    var num = Number(str);
    if (!isFinite(num) || num <= 0) {
      return { ok: false, minor: null, error: num === 0 ? 'zero' : 'invalid' };
    }
    var minor = Math.round(num * factor);
    if (!Number.isSafeInteger(minor)) {
      return { ok: false, minor: null, error: 'unsafe_integer' };
    }
    return { ok: true, minor: minor, error: null };
  }

  function getLocalDateKeyFromIso(iso) {
    if (!iso || typeof iso !== 'string') return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return formatDateOnly(d);
  }

  function expenseDateKey(expense) {
    if (!expense || !expense.occurredAt) return '';
    return getLocalDateKeyFromIso(expense.occurredAt);
  }

  function isCashPayment(method) {
    return method === 'cash';
  }

  function iterateExpenses(ledger, fn) {
    (ledger.expenses || []).forEach(fn);
  }

  function calculateCashBalance(ledger) {
    ledger = ledger || {};
    var primaryCode = ledger.primaryCurrency && ledger.primaryCurrency.code;
    var balance = sanitizeMinor(ledger.initialCashMinor, true);
    if (balance == null) balance = 0;
    (ledger.cashAdjustments || []).forEach(function (adj) {
      if (adj.currencyCode && primaryCode && adj.currencyCode !== primaryCode) return;
      if (adj.type === 'subtract') balance -= adj.amountMinor;
      else balance += adj.amountMinor;
    });
    iterateExpenses(ledger, function (exp) {
      if (!isCashPayment(exp.paymentMethod)) return;
      if (exp.currencyCode && primaryCode && exp.currencyCode !== primaryCode) return;
      balance -= exp.amountMinor;
    });
    return balance;
  }

  function calculatePaymentBreakdown(ledger) {
    var out = {
      cashMinor: 0,
      creditCardMinor: 0,
      electronicMinor: 0,
      otherMinor: 0
    };
    iterateExpenses(ledger, function (exp) {
      switch (exp.paymentMethod) {
        case 'cash':
          out.cashMinor += exp.amountMinor;
          break;
        case 'credit_card':
          out.creditCardMinor += exp.amountMinor;
          break;
        case 'electronic':
          out.electronicMinor += exp.amountMinor;
          break;
        default:
          out.otherMinor += exp.amountMinor;
      }
    });
    return out;
  }

  function calculateCategoryBreakdown(ledger) {
    var map = Object.create(null);
    var total = 0;
    iterateExpenses(ledger, function (exp) {
      total += exp.amountMinor;
      if (!map[exp.category]) {
        map[exp.category] = {
          category: exp.category,
          categoryLabel: exp.categoryLabel,
          categoryIcon: exp.categoryIcon,
          amountMinor: 0,
          count: 0
        };
      }
      map[exp.category].amountMinor += exp.amountMinor;
      map[exp.category].count += 1;
    });
    return Object.keys(map)
      .map(function (key) {
        var row = map[key];
        row.percent = total > 0 ? Math.round((row.amountMinor / total) * 1000) / 10 : 0;
        return row;
      })
      .sort(function (a, b) {
        return b.amountMinor - a.amountMinor;
      });
  }

  function calculateDailyBreakdown(ledger) {
    var map = Object.create(null);
    iterateExpenses(ledger, function (exp) {
      var day = expenseDateKey(exp);
      if (!day) return;
      if (!map[day]) map[day] = { date: day, amountMinor: 0, count: 0, expenses: [] };
      map[day].amountMinor += exp.amountMinor;
      map[day].count += 1;
      map[day].expenses.push(exp);
    });
    return Object.keys(map)
      .sort()
      .map(function (key) {
        return map[key];
      });
  }

  function calculateAverageDailySpend(ledger, referenceDate) {
    var ref = resolveReferenceDate(referenceDate);
    var start = ledger.startDate;
    if (!start || compareDateOnly(ref, start) < 0) return null;
    var effectiveEnd = compareDateOnly(ref, ledger.endDate) <= 0 ? ref : ledger.endDate;
    var elapsed = daysBetweenInclusive(start, effectiveEnd);
    if (elapsed <= 0) return null;
    var budgetSpend = 0;
    iterateExpenses(ledger, function (exp) {
      if (!exp.excludeFromBudget) budgetSpend += exp.amountMinor;
    });
    return Math.round(budgetSpend / elapsed);
  }

  function calculateProjectedFinalSpend(ledger, referenceDate) {
    var ref = resolveReferenceDate(referenceDate);
    if (!ledger.startDate || !ledger.endDate) return null;
    if (compareDateOnly(ref, ledger.startDate) < 0) return null;
    var totalTripDays = daysBetweenInclusive(ledger.startDate, ledger.endDate);
    if (totalTripDays <= 0) return null;
    var budgetSpend = 0;
    iterateExpenses(ledger, function (exp) {
      if (!exp.excludeFromBudget) budgetSpend += exp.amountMinor;
    });
    if (compareDateOnly(ref, ledger.endDate) >= 0) {
      return budgetSpend;
    }
    var elapsed = daysBetweenInclusive(ledger.startDate, ref);
    if (elapsed <= 0) return budgetSpend;
    if (budgetSpend === 0) return 0;
    return Math.round((budgetSpend / elapsed) * totalTripDays);
  }

  function calculateLedgerSummary(ledger, referenceDate) {
    ledger = ledger || {};
    var ref = resolveReferenceDate(referenceDate);
    var totalSpendMinor = 0;
    var budgetSpendMinor = 0;
    var cashSpendMinor = 0;
    var nonCashSpendMinor = 0;
    var todaySpendMinor = 0;
    iterateExpenses(ledger, function (exp) {
      totalSpendMinor += exp.amountMinor;
      if (!exp.excludeFromBudget) budgetSpendMinor += exp.amountMinor;
      if (isCashPayment(exp.paymentMethod)) cashSpendMinor += exp.amountMinor;
      else nonCashSpendMinor += exp.amountMinor;
      if (expenseDateKey(exp) === ref) todaySpendMinor += exp.amountMinor;
    });
    var budgetMinor = sanitizeMinor(ledger.budgetMinor, true);
    var remainingBudgetMinor =
      budgetMinor == null ? null : Math.max(0, budgetMinor - budgetSpendMinor);
    var totalTripDays = daysBetweenInclusive(ledger.startDate, ledger.endDate);
    var daysElapsed = 0;
    if (ledger.startDate && compareDateOnly(ref, ledger.startDate) >= 0) {
      var effectiveEnd = compareDateOnly(ref, ledger.endDate) <= 0 ? ref : ledger.endDate;
      daysElapsed = daysBetweenInclusive(ledger.startDate, effectiveEnd);
    }
    return {
      totalSpendMinor: totalSpendMinor,
      budgetSpendMinor: budgetSpendMinor,
      remainingBudgetMinor: remainingBudgetMinor,
      cashSpendMinor: cashSpendMinor,
      nonCashSpendMinor: nonCashSpendMinor,
      cashBalanceMinor: calculateCashBalance(ledger),
      todaySpendMinor: todaySpendMinor,
      averageDailySpendMinor: calculateAverageDailySpend(ledger, ref),
      projectedFinalSpendMinor: calculateProjectedFinalSpend(ledger, ref),
      expenseCount: (ledger.expenses || []).length,
      daysElapsed: daysElapsed,
      totalTripDays: totalTripDays,
      referenceDate: ref,
      status: deriveLedgerStatus(ledger, ref)
    };
  }

  function importTravelLedgerStore(rawStore) {
    return saveTravelLedgerStore(rawStore);
  }

  function resetTravelLedgerStoreForTests() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RECOVERY_KEY);
    }
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    RECOVERY_KEY: RECOVERY_KEY,
    loadTravelLedgerStore: loadTravelLedgerStore,
    saveTravelLedgerStore: saveTravelLedgerStore,
    normalizeTravelLedgerStore: normalizeTravelLedgerStore,
    migrateTravelLedgerStore: migrateTravelLedgerStore,
    importTravelLedgerStore: importTravelLedgerStore,
    getTravelLedgers: getTravelLedgers,
    getTravelLedgerById: getTravelLedgerById,
    createTravelLedger: createTravelLedger,
    updateTravelLedger: updateTravelLedger,
    archiveTravelLedger: archiveTravelLedger,
    deleteTravelLedger: deleteTravelLedger,
    addTravelExpense: addTravelExpense,
    updateTravelExpense: updateTravelExpense,
    deleteTravelExpense: deleteTravelExpense,
    duplicateTravelExpense: duplicateTravelExpense,
    addCashAdjustment: addCashAdjustment,
    updateCashAdjustment: updateCashAdjustment,
    deleteCashAdjustment: deleteCashAdjustment,
    calculateLedgerSummary: calculateLedgerSummary,
    calculateCashBalance: calculateCashBalance,
    calculateCategoryBreakdown: calculateCategoryBreakdown,
    calculateDailyBreakdown: calculateDailyBreakdown,
    calculatePaymentBreakdown: calculatePaymentBreakdown,
    calculateAverageDailySpend: calculateAverageDailySpend,
    calculateProjectedFinalSpend: calculateProjectedFinalSpend,
    formatMoneyMinor: formatMoneyMinor,
    parseMoneyToMinor: parseMoneyToMinor,
    validateMoneyInput: validateMoneyInput,
    getLocalDateKeyFromIso: getLocalDateKeyFromIso,
    expenseDateKey: expenseDateKey,
    convertMinorUnits: FOREX.convertMinorUnits,
    deriveLedgerStatus: deriveLedgerStatus,
    normalizeLedger: normalizeLedger,
    normalizeExpense: normalizeExpense,
    resetTravelLedgerStoreForTests: resetTravelLedgerStoreForTests
  };

  global.SOARVIBE_TRAVEL_LEDGER = api;
  Object.keys(api).forEach(function (key) {
    global[key] = api[key];
  });
})(typeof window !== 'undefined' ? window : globalThis);
