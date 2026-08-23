/**
 * Phase 1C.1 bugfix tests (temporal state, date limits, summary, grouping).
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

const storage = new MemoryStorage();
const context = {
  console,
  globalThis: {},
  window: {},
  localStorage: storage,
  setTimeout: () => 0,
  clearTimeout: () => {}
};
context.window = context.globalThis;
context.globalThis.localStorage = storage;
vm.createContext(context);

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('travel-ledger-config.js');
loadScript('travel-ledger-forex.js');
loadScript('travel-ledger-data.js');

const g = context.globalThis;
const DATA = g.SOARVIBE_TRAVEL_LEDGER;
DATA.resetTravelLedgerStoreForTests();

const uiCode = fs.readFileSync(path.join(root, 'travel-ledger-ui.js'), 'utf8')
  .replace('document.getElementById', '(() => null)')
  .replace('document.querySelector', '(() => null)')
  .replace('document.querySelectorAll', '(() => [])')
  .replace('document.addEventListener', '(() => {})')
  .replace('document.readyState', '"complete"');

const uiContext = {
  console,
  globalThis: g,
  window: g,
  localStorage: storage,
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    readyState: 'complete'
  },
  setTimeout: (fn) => {
    if (typeof fn === 'function') fn();
    return 0;
  },
  clearTimeout: () => {}
};
vm.createContext(uiContext);
vm.runInContext(uiCode, uiContext, { filename: 'travel-ledger-ui.js' });

const UI = g.SOARVIBE_TRAVEL_LEDGER_UI;

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error('FAIL:', msg);
}

const trip = {
  name: '1C1 Trip',
  countryCode: 'JP',
  startDate: '2026-07-29',
  endDate: '2026-08-04',
  primaryCurrencyCode: 'JPY',
  displayCurrencyCode: 'TWD',
  budgetMinor: 150000,
  initialCashMinor: 50000
};

const ledger = DATA.createTravelLedger(trip);
const todayAfterTrip = '2026-08-06';

assert(DATA.getLedgerTemporalState(ledger, '2026-07-20') === 'upcoming', 'before start → upcoming');
assert(DATA.getLedgerTemporalState(ledger, '2026-08-01') === 'active', 'mid trip → active');
assert(DATA.getLedgerTemporalState(ledger, '2026-08-04') === 'active', 'last day → active');
assert(DATA.getLedgerTemporalState(ledger, todayAfterTrip) === 'ended', 'after end → ended');

assert(
  DATA.getDefaultExpenseDateKey(ledger, null, todayAfterTrip) === '2026-08-04',
  'ended default date is trip last day'
);

DATA.addTravelExpense(ledger.id, {
  amountMinor: 1200,
  category: 'food',
  paymentMethod: 'cash',
  occurredAt: DATA.buildOccurredAtFromDateKey('2026-08-03', new Date('2026-08-03T12:00:00'))
});
let ledgerWithExp = DATA.getTravelLedgerById(ledger.id);
assert(
  DATA.getDefaultExpenseDateKey(ledgerWithExp, null, todayAfterTrip) === '2026-08-03',
  'ended default prefers last expense date'
);

assert(DATA.validateExpenseDateInTrip('2026-08-04', ledger).ok, 'endDate allowed');
assert(!DATA.validateExpenseDateInTrip('2026-07-28', ledger).ok, 'before start rejected');
assert(!DATA.validateExpenseDateInTrip('2026-08-06', ledger).ok, 'after end rejected');

const iso = DATA.buildOccurredAtFromDateKey('2026-08-02', new Date('2026-08-02T15:30:00'));
assert(DATA.getLocalDateKeyFromIso(iso) === '2026-08-02', 'occurredAt stores chosen local date');

DATA.addTravelExpense(ledger.id, {
  amountMinor: 800,
  category: 'cafe',
  paymentMethod: 'cash',
  occurredAt: DATA.buildOccurredAtFromDateKey('2026-08-04', new Date('2026-08-04T09:00:00'))
});
const endedSummary = DATA.calculateLedgerSummary(DATA.getTravelLedgerById(ledger.id), todayAfterTrip);
assert(endedSummary.totalSpendMinor === 2000, 'totalSpend includes backfill');
assert(endedSummary.todaySpendMinor === 0, 'todaySpend zero after trip ended');
assert(endedSummary.remainingBudgetMinor === 148000, 'remaining budget still computed');

const endedHeroHtml = UI.renderDetailPrimarySummary(ledgerWithExp, todayAfterTrip, endedSummary, 'JPY');
assert(endedHeroHtml.includes('旅程已結束'), 'ended hero shows ended kicker');
assert(endedHeroHtml.includes('總花費'), 'ended hero shows total label');
assert(endedHeroHtml.includes('現金剩餘'), 'ended hero shows cash balance');
assert(!endedHeroHtml.includes('今天已花'), 'ended hero hides today spend');

const activeLedger = DATA.createTravelLedger({
  name: 'Active Trip',
  countryCode: 'JP',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  primaryCurrencyCode: 'JPY',
  displayCurrencyCode: 'TWD',
  budgetMinor: 100000
});
DATA.addTravelExpense(activeLedger.id, {
  amountMinor: 500,
  category: 'food',
  paymentMethod: 'cash',
  occurredAt: DATA.buildOccurredAtFromDateKey('2026-08-06', new Date('2026-08-06T12:00:00'))
});
const activeSum = DATA.calculateLedgerSummary(DATA.getTravelLedgerById(activeLedger.id), '2026-08-06');
assert(activeSum.todaySpendMinor === 500, 'active todaySpend counts local today');

const activeHeroHtml = UI.renderDetailPrimarySummary(
  DATA.getTravelLedgerById(activeLedger.id),
  '2026-08-06',
  activeSum,
  'JPY'
);
assert(activeHeroHtml.includes('今天已花'), 'active hero shows today');
assert(!activeHeroHtml.includes('剩餘預算'), 'active hero hides remaining budget');
assert(activeHeroHtml.includes('現金剩餘'), 'active hero shows cash balance');
assert(activeHeroHtml.includes('tl-hero-summary-dual'), 'active hero uses dual layout');
assert(!activeHeroHtml.includes('tl-hero-summary-triple'), 'active hero not triple');

const endedGroups = UI.groupExpensesForDisplay(ledgerWithExp.expenses, todayAfterTrip, 'ended');
assert(Array.isArray(endedGroups), 'ended groups is array');
assert(!endedGroups.some((group) => group.title === '今天'), 'ended list has no 今天 group');
assert(endedGroups.some((group) => group.title.includes('8 月')), 'ended list uses month-day labels');

const activeGroups = UI.groupExpensesForDisplay(
  [{ id: 'x', occurredAt: DATA.buildOccurredAtFromDateKey('2026-08-06', new Date()), amountMinor: 1, category: 'food', paymentMethod: 'cash', categoryLabel: '美食' }],
  '2026-08-06',
  'active'
);
assert(activeGroups[0].title === '今天', 'active list uses 今天');

const noBudgetSummary = DATA.calculateLedgerSummary(
  DATA.createTravelLedger({ ...trip, budgetMinor: null }),
  todayAfterTrip
);
const unset = UI.formatRemainingBudgetHero(noBudgetSummary, 'JPY');
assert(unset.modifier === 'is-unset', 'no budget → unset');

const over = UI.formatRemainingBudgetHero(
  { budgetMinor: 1000, budgetOverMinor: 5200, remainingBudgetMinor: 0 },
  'JPY'
);
assert(over.label === '已超出預算', 'over budget label');
assert(over.modifier === 'is-over', 'over budget modifier');

const endedBtn = UI.addExpenseButtonHtml(ledger.id, ledgerWithExp, todayAfterTrip);
assert(endedBtn.includes('馬上記帳'), 'ended uses 馬上記帳 button');
assert(!endedBtn.includes('補登花費'), 'ended button no longer says 補登花費');
assert(!endedBtn.includes('disabled'), 'ended button not disabled');

assert(UI.expenseSheetTitle(ledgerWithExp, false) === '補登花費', 'ended sheet title stays 補登花費');
assert(UI.expenseSubmitLabel(ledgerWithExp, false) === '馬上記帳', 'ended sheet submit is 馬上記帳');

const noCashLedger = DATA.createTravelLedger({
  ...trip,
  name: 'No Cash',
  initialCashMinor: null
});
const noCashSum = DATA.calculateLedgerSummary(noCashLedger, todayAfterTrip);
const noCashHero = UI.renderDetailPrimarySummary(noCashLedger, todayAfterTrip, noCashSum, 'JPY');
assert(noCashHero.includes('未設定'), 'no initial cash shows 未設定');
assert(!/\b¥0\b/.test(noCashHero.split('現金剩餘')[1] || ''), 'no initial cash does not show misleading ¥0');

assert(endedHeroHtml.includes('tl-hero-summary-dual'), 'ended hero uses dual layout');
assert(!endedHeroHtml.includes('剩餘預算'), 'ended hero hides remaining budget');
assert(!endedHeroHtml.includes('已超出預算'), 'ended hero hides budget over');

assert(DATA.formatMoneyMinor(25400, 'JPY') === '¥25,400', '¥25,400 format');
assert(DATA.formatMoneyMinor(1250000, 'JPY') === '¥1,250,000', '¥1,250,000 format');

assert(UI.needsExpenseDatePicker(ledgerWithExp, false), 'ended create needs date');
assert(UI.needsExpenseDatePicker(DATA.getTravelLedgerById(activeLedger.id), false), 'active create needs date');
assert(UI.needsExpenseDatePicker(DATA.getTravelLedgerById(activeLedger.id), true), 'active edit needs date');

const beforeDelete = endedSummary.totalSpendMinor;
const expId = ledgerWithExp.expenses[0].id;
DATA.deleteTravelExpense(ledger.id, expId);
const afterDelete = DATA.calculateLedgerSummary(DATA.getTravelLedgerById(ledger.id), todayAfterTrip).totalSpendMinor;
assert(afterDelete < beforeDelete, 'delete reduces totalSpend');

console.log(`travel-ledger-1c1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
