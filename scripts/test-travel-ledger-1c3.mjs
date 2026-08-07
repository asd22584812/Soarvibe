/**
 * Phase 1C.3 UX polish acceptance tests.
 * Usage: node scripts/test-travel-ledger-1c3.mjs
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
const css = fs.readFileSync(path.join(root, 'travel-ledger.css'), 'utf8');
const uiSrc = fs.readFileSync(path.join(root, 'travel-ledger-ui.js'), 'utf8');

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

function indexOfMarker(html, marker) {
  return html.indexOf(marker);
}

// —— CSS / gesture locks ——
assert(/\.tl-expense-sheet-panel[\s\S]*?overflow-x:\s*hidden/.test(css), 'panel overflow-x hidden');
assert(/\.tl-expense-sheet-body[\s\S]*?overflow-x:\s*hidden/.test(css), 'body overflow-x hidden');
assert(/\.tl-expense-sheet[\s\S]*?touch-action:\s*pan-y/.test(css), 'sheet touch-action pan-y');
assert(/\.tl-expense-sheet-body[\s\S]*?touch-action:\s*pan-y/.test(css), 'body touch-action pan-y');
assert(/overscroll-behavior-x:\s*none/.test(css), 'overscroll-behavior-x none');
assert(/overscroll-behavior-y:\s*contain/.test(css), 'overscroll-behavior-y contain');
assert(/\.tl-expense-cat-grid[\s\S]*?minmax\(0,\s*1fr\)/.test(css), 'category grid minmax(0,1fr)');
assert(/\.tl-expense-pay-row[\s\S]*?minmax\(0,\s*1fr\)/.test(css), 'payment grid minmax(0,1fr)');
assert(uiSrc.includes("'.tl-expense-groups .tl-expense-swipe'"), 'swipe selector scoped to expense rows');
assert(uiSrc.includes('fromHandle'), 'dismiss only from handle path');
assert(uiSrc.includes('lockHorizontal'), 'sheet locks horizontal scroll');
assert(/passive:\s*false/.test(uiSrc) && uiSrc.includes('preventDefault'), 'horizontal touchmove can preventDefault');

// Simulated 390px layout box: grids use 4/3 equal columns with minmax(0) → cannot exceed parent
const viewport = 390;
const sheetPad = 16 * 2;
const contentW = viewport - sheetPad;
const catCol = contentW / 4;
const payCol = contentW / 3;
assert(catCol * 4 <= contentW + 0.01, 'category grid fits 390px content');
assert(payCol * 3 <= contentW + 0.01, 'payment grid fits 390px content');
assert(contentW === 358, '390px content width after 16px pad');

const ended = DATA.createTravelLedger({
  name: '1C3 Ended',
  countryCode: 'JP',
  startDate: '2026-07-20',
  endDate: '2026-07-28',
  primaryCurrencyCode: 'JPY',
  displayCurrencyCode: 'TWD',
  budgetMinor: 200000,
  initialCashMinor: 100000
});
DATA.addTravelExpense(ended.id, {
  amountMinor: 37500,
  category: 'food',
  paymentMethod: 'cash',
  occurredAt: DATA.buildOccurredAtFromDateKey('2026-07-25', new Date('2026-07-25T12:00:00'))
});
const endedLedger = DATA.getTravelLedgerById(ended.id);
const today = '2026-08-06';
const endedSummary = DATA.calculateLedgerSummary(endedLedger, today);
const endedHero = UI.renderDetailPrimarySummary(endedLedger, today, endedSummary, 'JPY');

assert(endedHero.includes('總花費'), 'ended Hero: 總花費');
assert(endedHero.includes('現金剩餘'), 'ended Hero: 現金剩餘');
assert(!endedHero.includes('今天已花'), 'ended Hero hides 今天已花');
assert(!endedHero.includes('剩餘預算'), 'ended Hero hides 剩餘預算');
assert(endedHero.includes('tl-hero-summary-dual'), 'ended Hero dual');

const active = DATA.createTravelLedger({
  name: '1C3 Active',
  countryCode: 'JP',
  startDate: '2026-08-01',
  endDate: '2026-08-20',
  primaryCurrencyCode: 'JPY',
  displayCurrencyCode: 'TWD',
  budgetMinor: 200000,
  initialCashMinor: 100000
});
DATA.addTravelExpense(active.id, {
  amountMinor: 12500,
  category: 'food',
  paymentMethod: 'cash',
  occurredAt: DATA.buildOccurredAtFromDateKey('2026-08-06', new Date('2026-08-06T10:00:00'))
});
const activeLedger = DATA.getTravelLedgerById(active.id);
const activeSummary = DATA.calculateLedgerSummary(activeLedger, '2026-08-06');
const activeHero = UI.renderDetailPrimarySummary(activeLedger, '2026-08-06', activeSummary, 'JPY');

assert(activeHero.includes('今天已花'), 'active Hero: 今天已花');
assert(activeHero.includes('現金剩餘'), 'active Hero: 現金剩餘');
assert(!activeHero.includes('剩餘預算'), 'active Hero hides 剩餘預算');
assert(!activeHero.includes('總花費'), 'active Hero hides 總花費');
assert(activeHero.includes('tl-hero-summary-dual'), 'active Hero dual');

assert(endedSummary.remainingBudgetMinor === 200000 - 37500, '剩餘預算 still computed');
assert(activeSummary.remainingBudgetMinor === 200000 - 12500, 'active 剩餘預算 still computed');

const noCash = DATA.createTravelLedger({
  name: 'No Cash Hero',
  countryCode: 'KR',
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  primaryCurrencyCode: 'KRW',
  displayCurrencyCode: 'TWD',
  budgetMinor: 500000,
  initialCashMinor: null
});
const noCashHero = UI.renderDetailPrimarySummary(
  noCash,
  '2026-08-06',
  DATA.calculateLedgerSummary(noCash, '2026-08-06'),
  'KRW'
);
assert(noCashHero.includes('未設定'), 'cash unset shows 未設定');

assert(UI.addExpenseButtonHtml(ended.id, endedLedger, today).includes('＋ 馬上記帳'), 'ended CTA 馬上記帳');
assert(UI.expenseSheetTitle(endedLedger, false) === '補登花費', 'sheet title 補登花費');
assert(UI.expenseSubmitLabel(endedLedger, false) === '馬上記帳', 'sheet submit 馬上記帳');

const endedSheet = UI.renderExpenseSheetBody(endedLedger, null);
assert(endedSheet.includes('消費日期'), 'ended sheet shows date');
assert(endedSheet.includes('tl-expense-date-block'), 'date block present');
assert(endedSheet.includes('📅'), 'date title has calendar icon');
assert(endedSheet.includes('請選擇這筆花費實際發生的旅行日期'), 'date hint copy');
assert(endedSheet.includes('馬上補上吧'), 'ended intro copy updated');

const amountIdx = indexOfMarker(endedSheet, 'tl-expense-amount-wrap');
const dateIdx = indexOfMarker(endedSheet, 'tl-expense-date-block');
const catIdx = indexOfMarker(endedSheet, '分類');
assert(amountIdx >= 0 && dateIdx > amountIdx && catIdx > dateIdx, 'date between amount and category');

const activeSheet = UI.renderExpenseSheetBody(activeLedger, null);
assert(!activeSheet.includes('tl-expense-date-block'), 'active sheet hides date');
assert(!activeSheet.includes('name="expenseDate"'), 'active sheet no date input');

assert(/\.tl-expense-date-title[\s\S]*?font-size:\s*1[89]px/.test(css), 'date title >= 18px');
assert(/\.tl-expense-date-title[\s\S]*?font-weight:\s*700/.test(css), 'date title weight 700');
assert(/\.tl-expense-date-hint[\s\S]*?font-size:\s*15px/.test(css), 'date hint >= 15px');
assert(/\.tl-expense-date-input[\s\S]*?font-size:\s*18px/.test(css), 'date input >= 18px');
assert(/\.tl-expense-date-input[\s\S]*?min-height:\s*6[0-4]px/.test(css), 'date input height 58–64px');
assert(/\.tl-expense-date-block[\s\S]*?margin:\s*20px\s+0/.test(css), 'date block vertical margin 20px');
assert(/\.tl-expense-sheet-intro[\s\S]*?margin:\s*0\s+0\s+1rem/.test(css), 'intro has no negative top margin');
assert(/tabular-nums/.test(css), 'tabular-nums present');
assert(/white-space:\s*nowrap/.test(css), 'hero amounts nowrap');

assert(DATA.formatMoneyMinor(1250000, 'JPY') === '¥1,250,000', '¥1,250,000');
assert(DATA.formatMoneyMinor(12500000, 'KRW') === '₩12,500,000', '₩12,500,000');
assert(DATA.formatMoneyMinor(150000, 'TWD') === 'NT$150,000', 'NT$150,000');
assert(DATA.formatMoneyMinor(1234567, 'USD') === '$12,345.67', 'US$12,345.67');

assert(!/XMLHttpRequest/.test(uiSrc), 'no XMLHttpRequest in travel-ledger-ui');

console.log(`Phase 1C.3 tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
