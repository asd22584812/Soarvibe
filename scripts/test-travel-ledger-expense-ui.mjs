/**
 * Phase 1C expense entry tests (data + UI helpers, no DOM).
 * Usage: node scripts/test-travel-ledger-expense-ui.mjs
 */
import { createRequire } from 'node:module';
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
const CONFIG = g.SOARVIBE_TRAVEL_LEDGER_CONFIG;

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

const today = '2026-08-06';
const ledger = DATA.createTravelLedger({
  name: 'Phase 1C 驗收',
  countryCode: 'JP',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  primaryCurrencyCode: 'JPY',
  displayCurrencyCode: 'TWD',
  budgetMinor: 1000000,
  initialCashMinor: 500000
});

assert(ledger.id, 'create ledger for expense tests');

// 1–3. add cash / credit / electronic
const cashExp = DATA.addTravelExpense(ledger.id, {
  amountMinor: 1500,
  category: 'food',
  paymentMethod: 'cash',
  occurredAt: `${today}T10:00:00.000Z`,
  note: '現金午餐'
});
assert(cashExp && cashExp.paymentMethod === 'cash', 'add cash expense');

const cardExp = DATA.addTravelExpense(ledger.id, {
  amountMinor: 3200,
  category: 'shopping',
  paymentMethod: 'credit_card',
  occurredAt: `${today}T11:00:00.000Z`
});
assert(cardExp && cardExp.paymentMethod === 'credit_card', 'add credit card expense');

const elecExp = DATA.addTravelExpense(ledger.id, {
  amountMinor: 800,
  category: 'transport',
  paymentMethod: 'electronic',
  occurredAt: `${today}T12:00:00.000Z`
});
assert(elecExp && elecExp.paymentMethod === 'electronic', 'add electronic expense');

let summary = DATA.calculateLedgerSummary(DATA.getTravelLedgerById(ledger.id), today);
assert(summary.todaySpendMinor === 1500 + 3200 + 800, 'todaySpend after three adds');
assert(summary.cashBalanceMinor === 500000 - 1500, 'cashBalance after cash expense');
assert(summary.nonCashSpendMinor === 3200 + 800, 'nonCashSpend after card/electronic');
assert(summary.remainingBudgetMinor === 1000000 - (1500 + 3200 + 800), 'remainingBudget after adds');

// 4–6. edit amount / category / payment
const edited = DATA.updateTravelExpense(ledger.id, cashExp.id, {
  amountMinor: 1800,
  category: 'cafe',
  paymentMethod: 'credit_card',
  note: '改成分類與付款'
});
assert(edited.amountMinor === 1800, 'edit amount');
assert(edited.category === 'cafe', 'edit category');
assert(edited.paymentMethod === 'credit_card', 'edit payment method');
assert(edited.createdAt === cashExp.createdAt, 'edit preserves createdAt');
assert(edited.occurredAt === cashExp.occurredAt, 'edit preserves occurredAt');
assert(edited.updatedAt >= cashExp.updatedAt, 'edit updates updatedAt');

summary = DATA.calculateLedgerSummary(DATA.getTravelLedgerById(ledger.id), today);
assert(summary.cashBalanceMinor === 500000, 'cashBalance after cash->card edit');
assert(summary.nonCashSpendMinor === 1800 + 3200 + 800, 'nonCashSpend after edit payment');

// 7. delete
const deleted = DATA.deleteTravelExpense(ledger.id, cardExp.id);
assert(deleted === true, 'delete expense');
summary = DATA.calculateLedgerSummary(DATA.getTravelLedgerById(ledger.id), today);
assert(summary.totalSpendMinor === 1800 + 800, 'summary after delete');
assert(summary.remainingBudgetMinor === 1000000 - (1800 + 800), 'remainingBudget after delete');

// 8–11. summary scenario from acceptance brief
DATA.resetTravelLedgerStoreForTests();
const scenario = DATA.createTravelLedger({
  name: 'Summary 驗收',
  countryCode: 'JP',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  primaryCurrencyCode: 'JPY',
  displayCurrencyCode: 'TWD',
  budgetMinor: 10000,
  initialCashMinor: 5000
});
DATA.addTravelExpense(scenario.id, {
  amountMinor: 1000,
  category: 'food',
  paymentMethod: 'cash',
  occurredAt: `${today}T09:00:00.000Z`
});
DATA.addTravelExpense(scenario.id, {
  amountMinor: 2000,
  category: 'shopping',
  paymentMethod: 'credit_card',
  occurredAt: `${today}T10:00:00.000Z`
});
DATA.addTravelExpense(scenario.id, {
  amountMinor: 500,
  category: 'transport',
  paymentMethod: 'electronic',
  occurredAt: `${today}T11:00:00.000Z`
});
DATA.addTravelExpense(scenario.id, {
  amountMinor: 3000,
  category: 'lodging',
  paymentMethod: 'credit_card',
  excludeFromBudget: true,
  occurredAt: `${today}T12:00:00.000Z`
});
const scenarioSummary = DATA.calculateLedgerSummary(DATA.getTravelLedgerById(scenario.id), today);
assert(scenarioSummary.totalSpendMinor === 6500, 'scenario totalSpend');
assert(scenarioSummary.budgetSpendMinor === 3500, 'scenario budgetSpend');
assert(scenarioSummary.remainingBudgetMinor === 6500, 'scenario remainingBudget');
assert(scenarioSummary.cashSpendMinor === 1000, 'scenario cashSpend');
assert(scenarioSummary.nonCashSpendMinor === 5500, 'scenario nonCashSpend');
assert(scenarioSummary.cashBalanceMinor === 4000, 'scenario cashBalance');

// 12. persistence after reload
const raw = storage.getItem(CONFIG.STORAGE_KEY);
assert(typeof raw === 'string' && raw.includes(scenario.id), 'persisted store contains ledger');
DATA.resetTravelLedgerStoreForTests();
assert((DATA.getTravelLedgers() || []).length === 0, 'reset clears in-memory store');
storage.setItem(CONFIG.STORAGE_KEY, raw);
const reloaded = DATA.getTravelLedgers();
assert(reloaded.some((l) => l.id === scenario.id), 'reload restores ledger from storage');
assert(
  (DATA.getTravelLedgerById(scenario.id).expenses || []).length === 4,
  'reload restores expenses'
);

// category enum consistency (12 categories, no taxi/drink)
const schemaCats = [
  'food',
  'cafe',
  'shopping',
  'souvenir',
  'transport',
  'lodging',
  'ticket',
  'entertainment',
  'nightlife',
  'drugstore',
  'communication',
  'other'
];
schemaCats.forEach(function (key) {
  assert(CONFIG.isValidCategory(key), `category enum accepts ${key}`);
});
assert(!CONFIG.isValidCategory('taxi'), 'taxi not in enum');
assert(!CONFIG.isValidCategory('drink'), 'drink not in enum');
assert(CONFIG.EXPENSE_ENTRY_CATEGORY_KEYS.length === 12, 'entry grid has 12 categories');

// minor unit validation
assert(DATA.parseMoneyToMinor('980', 'JPY') === 980, 'JPY integer parse');
assert(DATA.parseMoneyToMinor('12.50', 'USD') === 1250, 'USD decimal parse');
assert(DATA.parseMoneyToMinor('980.5', 'JPY') == null, 'JPY rejects decimal');
assert(DATA.parseMoneyToMinor('0', 'JPY') == null, 'reject zero amount');
assert(DATA.validateMoneyInput('12.501', 'USD').error === 'too_many_decimals', 'USD max 2 decimals');

// local date grouping rule
const localKey = DATA.getLocalDateKeyFromIso(`${today}T20:00:00.000Z`);
assert(typeof localKey === 'string' && localKey.length === 10, 'local date key format');
const midnightExp = {
  occurredAt: new Date(`${today}T23:30:00`).toISOString()
};
assert(DATA.expenseDateKey(midnightExp) === today, 'local date grouping uses device-local day');

console.log(`travel-ledger-expense-ui: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
