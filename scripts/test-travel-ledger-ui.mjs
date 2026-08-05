/**
 * Phase 1B UI helper smoke tests (no DOM).
 */
import { createRequire } from 'node:module';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const context = { console, globalThis: {}, window: {}, setTimeout: () => 0, clearTimeout: () => {} };
context.window = context.globalThis;
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
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    readyState: 'complete'
  },
  setTimeout: () => 0,
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

const today = '2026-08-05';
const upcoming = {
  startDate: '2026-09-01',
  endDate: '2026-09-07',
  status: 'upcoming'
};
const active = {
  startDate: '2026-08-01',
  endDate: '2026-08-10',
  status: 'active'
};
const ended = {
  startDate: '2026-07-01',
  endDate: '2026-07-05',
  status: 'ended'
};
const archived = { ...active, status: 'archived' };

assert(UI.getLedgerDisplayStatus(upcoming, today) === 'upcoming', 'upcoming status');
assert(UI.getLedgerDisplayStatus(active, today) === 'active', 'active status');
assert(UI.getLedgerDisplayStatus(ended, today) === 'ended', 'ended status');
assert(UI.getLedgerDisplayStatus(archived, today) === 'archived', 'archived status');
assert(UI.getLedgerDayProgress(active, today).includes('旅行第'), 'day progress active');
assert(UI.getLedgerDayProgress(upcoming, today).includes('距離出發'), 'day progress upcoming');

const jpy = DATA.createTravelLedger({
  name: '東京自由行',
  countryCode: 'JP',
  startDate: '2026-09-01',
  endDate: '2026-09-06',
  primaryCurrencyCode: 'JPY',
  displayCurrencyCode: 'TWD',
  budgetMinor: 100000
});
assert(jpy.primaryCurrency.code === 'JPY', 'create JPY ledger');

const usd = DATA.createTravelLedger({
  name: '紐約小旅行',
  countryCode: 'US',
  startDate: '2026-10-01',
  endDate: '2026-10-05',
  primaryCurrencyCode: 'USD',
  displayCurrencyCode: 'TWD'
});
assert(usd.primaryCurrency.code === 'USD', 'create USD ledger');

const summary = DATA.calculateLedgerSummary(jpy, today);
assert(summary.remainingBudgetMinor === 100000, 'no-budget-spend summary');

const noBudget = DATA.createTravelLedger({
  name: '無預算',
  countryCode: 'TW',
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  primaryCurrencyCode: 'TWD',
  displayCurrencyCode: 'TWD'
});
const noBudgetSummary = DATA.calculateLedgerSummary(noBudget, today);
assert(noBudgetSummary.remainingBudgetMinor == null, 'no budget remaining null');

assert(typeof g.openTravelLedger === 'function', 'window.openTravelLedger');
assert(typeof g.closeTravelLedger === 'function', 'window.closeTravelLedger');

console.log(`travel-ledger-ui smoke: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
