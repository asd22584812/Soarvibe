#!/usr/bin/env node
/**
 * Travel Ledger data layer tests (no network).
 * Usage: node scripts/test-travel-ledger.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error('✗', msg);
}

function pass(msg) {
  console.log('✓', msg);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${expected}, got ${actual}`);
    return false;
  }
  pass(label);
  return true;
}

function assertDeepEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    fail(`${label}: expected ${b}, got ${a}`);
    return false;
  }
  pass(label);
  return true;
}

function assertThrows(fn, label) {
  try {
    fn();
    fail(`${label}: expected throw`);
    return false;
  } catch (e) {
    pass(label);
    return true;
  }
}

class MemoryStorage {
  constructor() {
    this.store = Object.create(null);
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

function loadTravelLedgerModules(storage) {
  const ctx = {
    window: {},
    globalThis: {},
    localStorage: storage
  };
  ctx.window = ctx.globalThis;
  ctx.globalThis.localStorage = storage;
  ['travel-ledger-config.js', 'travel-ledger-forex.js', 'travel-ledger-data.js'].forEach(function (file) {
    const filePath = path.join(ROOT, file);
    vm.runInNewContext(fs.readFileSync(filePath, 'utf8'), ctx, { filename: filePath });
  });
  return ctx.globalThis;
}

function runTests() {
  const storage = new MemoryStorage();
  const mods = loadTravelLedgerModules(storage);
  const CONFIG = mods.SOARVIBE_TRAVEL_LEDGER_CONFIG;
  const DATA = mods.SOARVIBE_TRAVEL_LEDGER;
  const FOREX = mods.SOARVIBE_TRAVEL_LEDGER_FOREX;

  DATA.resetTravelLedgerStoreForTests();
  FOREX.clearForexCacheForTests();

  // 10. currency minor unit parse / format
  assertEqual(DATA.parseMoneyToMinor('980', 'JPY'), 980, 'parse JPY integer');
  assertEqual(DATA.parseMoneyToMinor('12.50', 'USD'), 1250, 'parse USD decimal');
  assertEqual(DATA.parseMoneyToMinor('980.5', 'JPY'), null, 'reject JPY decimal');
  assertEqual(DATA.parseMoneyToMinor('0', 'JPY'), null, 'reject zero amount');
  assertEqual(DATA.validateMoneyInput('12.501', 'USD').error, 'too_many_decimals', 'USD max 2 decimals');
  assertEqual(DATA.formatMoneyMinor(1250, 'USD'), '$12.50', 'format USD decimal');
  assertEqual(DATA.formatMoneyMinor(980, 'JPY'), '¥980', 'format JPY integer');

  // 11. bad JSON recovery
  storage.setItem(CONFIG.STORAGE_KEY, '{ broken json');
  const recovered = DATA.loadTravelLedgerStore();
  assertEqual(recovered.ledgers.length, 0, 'bad JSON returns empty ledgers');
  assertEqual(!!storage.getItem(CONFIG.RECOVERY_KEY), true, 'bad JSON saved to recovery key');

  // 12. migration + 14. normalize missing fields
  const migrated = DATA.migrateTravelLedgerStore({ version: 0, ledgers: [{ name: '測試', countryCode: 'JP' }] });
  assertEqual(migrated.version, 1, 'migration sets version 1');
  assertEqual(migrated.ledgers.length, 1, 'migration keeps valid ledger');
  assertEqual(migrated.ledgers[0].primaryCurrency.code, 'JPY', 'normalize infers JPY for JP');

  DATA.resetTravelLedgerStoreForTests();

  // 1. create ledger — 15. input not mutated
  const createPayload = {
    name: '大阪五日遊',
    countryCode: 'JP',
    cityName: '大阪',
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    budgetMinor: 80000,
    initialCashMinor: 30000,
    manualExchangeRate: 0.21
  };
  const payloadSnapshot = JSON.stringify(createPayload);
  const ledger = DATA.createTravelLedger(createPayload);
  assertEqual(JSON.stringify(createPayload), payloadSnapshot, 'createTravelLedger does not mutate input');
  assertEqual(typeof ledger.id, 'string', 'create returns ledger id');

  // 2. add expense
  const expense = DATA.addTravelExpense(ledger.id, {
    amountMinor: 1200,
    category: 'food',
    paymentMethod: 'cash',
    title: '道頓堀小吃',
    occurredAt: '2026-08-01T13:00:00+09:00'
  });
  assertEqual(expense.amountMinor, 1200, 'add expense amount');
  assertEqual(expense.exchangeRateSource, 'manual', 'add expense uses manual rate');
  assertEqual(expense.convertedAmountMinor, 252, 'add expense converted via manual rate');

  // 3. update expense
  const updated = DATA.updateTravelExpense(ledger.id, expense.id, {
    amountMinor: 1500,
    title: '道頓堀章魚燒'
  });
  assertEqual(updated.amountMinor, 1500, 'update expense amount');
  assertEqual(updated.convertedAmountMinor, 315, 'update expense recalculates conversion');

  // 4. duplicate expense
  const copy = DATA.duplicateTravelExpense(ledger.id, expense.id);
  assertEqual(copy != null && copy.id !== expense.id, true, 'duplicate creates new id');
  assertEqual(copy.amountMinor, 1500, 'duplicate copies amount');

  // 6. add cash adjustment
  DATA.addCashAdjustment(ledger.id, {
    amountMinor: 5000,
    type: 'add',
    reason: 'ATM'
  });

  // 7. summary
  const full = DATA.getTravelLedgerById(ledger.id);
  const summary = DATA.calculateLedgerSummary(full, '2026-08-01');
  assertEqual(summary.totalSpendMinor, 3000, 'summary totalSpend (1500 + 1500 duplicate)');
  assertEqual(summary.budgetSpendMinor, 3000, 'summary budgetSpend');
  assertEqual(summary.cashSpendMinor, 3000, 'summary cashSpend');
  assertEqual(summary.cashBalanceMinor, 32000, 'summary cashBalance 30000+5000-3000');
  assertEqual(summary.todaySpendMinor, 3000, 'summary todaySpend on 2026-08-01');
  assertEqual(summary.totalTripDays, 5, 'summary totalTripDays');
  assertEqual(summary.daysElapsed, 1, 'summary daysElapsed on day 1');

  // 8. category breakdown
  const categories = DATA.calculateCategoryBreakdown(full);
  assertEqual(categories[0].category, 'food', 'category breakdown top category');
  assertEqual(categories[0].amountMinor, 3000, 'category breakdown amount');

  // 9. payment breakdown
  const payments = DATA.calculatePaymentBreakdown(full);
  assertEqual(payments.cashMinor, 3000, 'payment breakdown cash');

  // 13. negative amount rejected
  assertThrows(function () {
    DATA.addTravelExpense(ledger.id, { amountMinor: -50, category: 'food', paymentMethod: 'cash' });
  }, 'reject negative amount');

  // 5. delete expense
  const deleted = DATA.deleteTravelExpense(ledger.id, copy.id);
  assertEqual(deleted, true, 'delete expense');
  const afterDelete = DATA.getTravelLedgerById(ledger.id);
  assertEqual(afterDelete.expenses.length, 1, 'one expense remains after delete');

  // USD decimal fixture via create
  DATA.resetTravelLedgerStoreForTests();
  const usdLedger = DATA.createTravelLedger({
    name: '美西公路旅行',
    countryCode: 'US',
    startDate: '2026-09-01',
    endDate: '2026-09-07',
    primaryCurrencyCode: 'USD',
    displayCurrencyCode: 'TWD',
    budgetMinor: 50000
  });
  const usdExpense = DATA.addTravelExpense(usdLedger.id, {
    amountMinor: 2599,
    category: 'food',
    paymentMethod: 'credit_card',
    title: 'In-N-Out'
  });
  assertEqual(usdExpense.amountMinor, 2599, 'USD minor units stored as cents');
  assertEqual(DATA.formatMoneyMinor(2599, 'USD'), '$25.99', 'USD formatted from minor units');

  // FOREX unavailable path
  DATA.resetTravelLedgerStoreForTests();
  const noRateLedger = DATA.createTravelLedger({
    name: '無匯率測試',
    countryCode: 'TH',
    startDate: '2026-10-01',
    endDate: '2026-10-03'
  });
  const noRateExpense = DATA.addTravelExpense(noRateLedger.id, {
    amountMinor: 500,
    category: 'transport',
    paymentMethod: 'cash'
  });
  assertEqual(noRateExpense.exchangeRateSource, 'unavailable', 'no rate source unavailable');
  assertEqual(noRateExpense.convertedAmountMinor, null, 'no rate leaves converted null');

  // Fixture import summary expectations
  const fixture = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'scripts/fixtures/travel-ledger-seed.json'), 'utf8')
  );
  const normalizedFixture = DATA.normalizeTravelLedgerStore(fixture);
  const tokyo = normalizedFixture.ledgers[0];
  const fixtureSummary = DATA.calculateLedgerSummary(tokyo, '2026-07-18');
  assertEqual(fixtureSummary.totalSpendMinor, 27470, 'fixture totalSpendMinor');
  assertEqual(fixtureSummary.budgetSpendMinor, 9470, 'fixture budgetSpendMinor');
  assertEqual(fixtureSummary.remainingBudgetMinor, 90530, 'fixture remainingBudgetMinor');
  assertEqual(fixtureSummary.cashSpendMinor, 5110, 'fixture cashSpendMinor');
  assertEqual(fixtureSummary.nonCashSpendMinor, 22360, 'fixture nonCashSpendMinor');
  assertEqual(fixtureSummary.cashBalanceMinor, 54890, 'fixture cashBalanceMinor');
  assertEqual(fixtureSummary.todaySpendMinor, 2180, 'fixture todaySpendMinor');
  assertEqual(fixtureSummary.averageDailySpendMinor, 2368, 'fixture averageDailySpendMinor');
  assertEqual(fixtureSummary.projectedFinalSpendMinor, 14205, 'fixture projectedFinalSpendMinor');
  assertEqual(fixtureSummary.expenseCount, 8, 'fixture expenseCount');
  assertEqual(fixtureSummary.daysElapsed, 4, 'fixture daysElapsed');
  assertEqual(fixtureSummary.totalTripDays, 6, 'fixture totalTripDays');

  // Single bad ledger should not crash store normalize
  const mixed = DATA.normalizeTravelLedgerStore({
    version: 1,
    ledgers: [{ name: '' }, tokyo, null]
  });
  assertEqual(mixed.ledgers.length, 1, 'invalid ledgers filtered during normalize');

  console.log('\n' + (failures.length ? failures.length + ' test(s) failed.' : 'All tests passed.'));
  if (failures.length) process.exit(1);
}

runTests();
