#!/usr/bin/env node
/**
 * Validate travel ledger store + fixture against schema and project rules.
 * Usage: node scripts/validate-travel-ledger.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const errors = [];
const warnings = [];

function addError(msg) {
  errors.push(msg);
}

function addWarning(msg) {
  warnings.push(msg);
}

function loadTravelLedgerModules() {
  const ctx = { window: {}, globalThis: {} };
  ctx.window = ctx.globalThis;
  ['travel-ledger-config.js', 'travel-ledger-forex.js', 'travel-ledger-data.js'].forEach(function (file) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      throw new Error('Missing module: ' + file);
    }
    vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), ctx, { filename: filePath });
  });
  return ctx.globalThis;
}

let MODULES;
try {
  MODULES = loadTravelLedgerModules();
} catch (e) {
  addError(e.message);
}

const CONFIG = MODULES && MODULES.SOARVIBE_TRAVEL_LEDGER_CONFIG;
const DATA = MODULES && MODULES.SOARVIBE_TRAVEL_LEDGER;

function loadJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    addError(`Missing file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    addError(`Invalid JSON in ${relativePath}: ${e.message}`);
    return null;
  }
}

function isBlank(v) {
  return v == null || (typeof v === 'string' && !v.trim());
}

function isValidDateOnly(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function compareDateOnly(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function validateCurrencyBlock(block, label) {
  if (!block || typeof block !== 'object') {
    addError(`${label}: missing currency block`);
    return;
  }
  if (!CONFIG.isValidCurrencyCode(block.code)) {
    addError(`${label}: invalid currency code ${block.code}`);
    return;
  }
  const meta = CONFIG.getCurrencyMeta(block.code);
  if (meta.symbol !== block.symbol) {
    addWarning(`${label}: symbol ${block.symbol} differs from config ${meta.symbol}`);
  }
  if (meta.minorUnitDigits !== block.minorUnitDigits) {
    addError(
      `${label}: minorUnitDigits ${block.minorUnitDigits} != config ${meta.minorUnitDigits}`
    );
  }
}

function validateConversionConsistency(expense, ledgerLabel) {
  if (expense.exchangeRateSnapshot == null && expense.convertedAmountMinor == null) {
    if (expense.exchangeRateSource !== 'unavailable') {
      addWarning(
        `${ledgerLabel} expense ${expense.id}: null conversion should use source unavailable`
      );
    }
    return;
  }
  if (expense.exchangeRateSnapshot == null || expense.convertedAmountMinor == null) {
    addError(
      `${ledgerLabel} expense ${expense.id}: exchangeRateSnapshot and convertedAmountMinor must both be set or both null`
    );
    return;
  }
  if (!isFinite(expense.exchangeRateSnapshot) || expense.exchangeRateSnapshot <= 0) {
    addError(`${ledgerLabel} expense ${expense.id}: invalid exchangeRateSnapshot`);
    return;
  }
  const expected = DATA.convertMinorUnits(
    expense.amountMinor,
    expense.currencyCode,
    expense.conversionCurrency,
    expense.exchangeRateSnapshot
  );
  if (expected !== expense.convertedAmountMinor) {
    addError(
      `${ledgerLabel} expense ${expense.id}: convertedAmountMinor ${expense.convertedAmountMinor} != expected ${expected}`
    );
  }
}

function validateExpense(expense, ledger) {
  const label = `ledger ${ledger.id}`;
  if (!expense || typeof expense !== 'object') {
    addError(`${label}: invalid expense object`);
    return;
  }
  if (isBlank(expense.id)) addError(`${label}: expense missing id`);
  if (!Number.isInteger(expense.amountMinor) || expense.amountMinor < 0) {
    addError(`${label} expense ${expense.id}: invalid amountMinor`);
  }
  if (!CONFIG.isValidCategory(expense.category)) {
    addError(`${label} expense ${expense.id}: invalid category ${expense.category}`);
  }
  if (!CONFIG.isValidPaymentMethod(expense.paymentMethod)) {
    addError(`${label} expense ${expense.id}: invalid paymentMethod ${expense.paymentMethod}`);
  }
  if (expense.mood != null && !CONFIG.isValidMood(expense.mood)) {
    addError(`${label} expense ${expense.id}: invalid mood ${expense.mood}`);
  }
  if (!CONFIG.isValidCurrencyCode(expense.currencyCode)) {
    addError(`${label} expense ${expense.id}: invalid currencyCode`);
  }
  if (expense.currencyMinorUnit !== CONFIG.getMinorUnitDigits(expense.currencyCode)) {
    addError(`${label} expense ${expense.id}: currencyMinorUnit mismatch`);
  }
  if (expense.convertedAmountMinor != null) {
    if (!Number.isInteger(expense.convertedAmountMinor) || expense.convertedAmountMinor < 0) {
      addError(`${label} expense ${expense.id}: invalid convertedAmountMinor`);
    }
  }
  validateConversionConsistency(expense, label);
}

function validateCashAdjustment(adj, ledger) {
  const label = `ledger ${ledger.id}`;
  if (!adj || typeof adj !== 'object') {
    addError(`${label}: invalid cash adjustment`);
    return;
  }
  if (isBlank(adj.id)) addError(`${label}: cash adjustment missing id`);
  if (!Number.isInteger(adj.amountMinor) || adj.amountMinor < 0) {
    addError(`${label} cash ${adj.id}: invalid amountMinor`);
  }
  if (!CONFIG.isValidCashAdjustmentType(adj.type)) {
    addError(`${label} cash ${adj.id}: invalid type ${adj.type}`);
  }
}

function validateLedger(ledger, index) {
  if (!ledger || typeof ledger !== 'object') {
    addError(`ledgers[${index}] is not an object`);
    return;
  }
  if (isBlank(ledger.id)) addError(`ledgers[${index}] missing id`);
  if (isBlank(ledger.name)) addError(`ledger ${ledger.id || index} missing name`);
  if (!isValidDateOnly(ledger.startDate) || !isValidDateOnly(ledger.endDate)) {
    addError(`ledger ${ledger.id}: invalid startDate/endDate`);
  } else if (compareDateOnly(ledger.startDate, ledger.endDate) > 0) {
    addError(`ledger ${ledger.id}: startDate > endDate`);
  }
  if (ledger.status && !CONFIG.isValidLedgerStatus(ledger.status)) {
    addError(`ledger ${ledger.id}: invalid status ${ledger.status}`);
  }
  validateCurrencyBlock(ledger.primaryCurrency, `ledger ${ledger.id} primaryCurrency`);
  validateCurrencyBlock(ledger.displayCurrency, `ledger ${ledger.id} displayCurrency`);
  if (ledger.budgetMinor != null && (!Number.isInteger(ledger.budgetMinor) || ledger.budgetMinor < 0)) {
    addError(`ledger ${ledger.id}: invalid budgetMinor`);
  }
  if (
    ledger.initialCashMinor != null &&
    (!Number.isInteger(ledger.initialCashMinor) || ledger.initialCashMinor < 0)
  ) {
    addError(`ledger ${ledger.id}: invalid initialCashMinor`);
  }
  const expenseIds = new Set();
  (ledger.expenses || []).forEach(function (exp) {
    if (expenseIds.has(exp.id)) {
      addError(`ledger ${ledger.id}: duplicate expense id ${exp.id}`);
    }
    expenseIds.add(exp.id);
    validateExpense(exp, ledger);
  });
  const cashIds = new Set();
  (ledger.cashAdjustments || []).forEach(function (adj) {
    if (cashIds.has(adj.id)) {
      addError(`ledger ${ledger.id}: duplicate cash adjustment id ${adj.id}`);
    }
    cashIds.add(adj.id);
    validateCashAdjustment(adj, ledger);
  });
}

function validateStore(raw, label) {
  if (!raw || typeof raw !== 'object') {
    addError(`${label}: root must be object`);
    return;
  }
  if (raw.version !== 1) {
    addError(`${label}: version must be 1`);
  }
  if (!Array.isArray(raw.ledgers)) {
    addError(`${label}: ledgers must be array`);
    return;
  }
  const ledgerIds = new Set();
  raw.ledgers.forEach(function (ledger, idx) {
    if (ledgerIds.has(ledger.id)) {
      addError(`${label}: duplicate ledger id ${ledger.id}`);
    }
    ledgerIds.add(ledger.id);
    validateLedger(ledger, idx);
  });
}

function printReport() {
  console.log('=== Travel Ledger Validation ===\n');
  if (!CONFIG || !DATA) {
    console.log('Modules failed to load.');
    errors.forEach(function (e) {
      console.log('  ✗', e);
    });
    process.exit(1);
  }

  const fixture = loadJson('scripts/fixtures/travel-ledger-seed.json');
  if (fixture) {
    console.log('Fixture ledgers:', fixture.ledgers.length);
    validateStore(fixture, 'fixture');
    const normalized = DATA.normalizeTravelLedgerStore(fixture);
    validateStore(normalized, 'normalized fixture');
    const ledger = normalized.ledgers[0];
    if (ledger) {
      const summary = DATA.calculateLedgerSummary(ledger, '2026-07-18');
      console.log('\nFixture summary snapshot (ref 2026-07-18):');
      console.log('  totalSpendMinor:', summary.totalSpendMinor);
      console.log('  budgetSpendMinor:', summary.budgetSpendMinor);
      console.log('  remainingBudgetMinor:', summary.remainingBudgetMinor);
      console.log('  cashBalanceMinor:', summary.cashBalanceMinor);
      console.log('  todaySpendMinor:', summary.todaySpendMinor);
      console.log('  averageDailySpendMinor:', summary.averageDailySpendMinor);
      console.log('  projectedFinalSpendMinor:', summary.projectedFinalSpendMinor);
    }
  }

  console.log('\nErrors:', errors.length);
  console.log('Warnings:', warnings.length);
  if (warnings.length) {
    console.log('\n--- WARNINGS ---');
    warnings.forEach(function (w) {
      console.log('  ⚠', w);
    });
  }
  if (errors.length) {
    console.log('\n--- ERRORS ---');
    errors.forEach(function (e) {
      console.log('  ✗', e);
    });
    process.exit(1);
  }
  console.log('\nValidation passed' + (warnings.length ? ' with warnings.' : '.'));
}

printReport();
