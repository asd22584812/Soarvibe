/**
 * P0: Compose draft preservation + Travel Ledger delete/amount UX (static + localStorage).
 * Run: node scripts/test-compose-draft-ledger-p0.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  OK  ' + msg);
  } else {
    failed += 1;
    console.error('  FAIL  ' + msg);
  }
}

const uiSrc = readFileSync(join(root, 'city-shares-ui.js'), 'utf8');
const fsSrc = readFileSync(join(root, 'city-shares-firestore.js'), 'utf8');
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8');
const tlUi = readFileSync(join(root, 'travel-ledger-ui.js'), 'utf8');
const tlCss = readFileSync(join(root, 'travel-ledger.css'), 'utf8');
const tlDataSrc = readFileSync(join(root, 'travel-ledger-data.js'), 'utf8');

console.log('\n=== compose draft preservation ===');
assert(uiSrc.includes('composeDraft'), '1. composeDraft state exists');
assert(uiSrc.includes('function ensureComposeDraft'), '2. ensureComposeDraft');
assert(uiSrc.includes('function syncComposeDraftFromDom'), '3. syncComposeDraftFromDom');
assert(uiSrc.includes('function clearComposeDraft'), '4. clearComposeDraft');
assert(uiSrc.includes('bindComposeDraftInputs'), '5. draft input binding');
assert(uiSrc.includes("escapeHtml(draft.title || '')"), '6. renderCompose restores title');
assert(uiSrc.includes('escapeHtml(draft.body || \'\')') || uiSrc.includes('escapeHtml(draft.body || "")'), '7. renderCompose restores body');
assert(uiSrc.includes('syncComposeDraftFromDom()') && uiSrc.includes('handleComposeMediaPick'), '8. media pick syncs draft first');
assert(uiSrc.includes('發布失敗，內容已為你保留，請再試一次。'), '9. friendly permission error copy');
assert(uiSrc.includes("category: category") && uiSrc.includes('postId: postId'), '10. console logs category/code/postId only');
assert(uiSrc.includes('if (!csState.composeTaxonomy)'), '11. taxonomy only prepared when missing');
assert(uiSrc.includes('function friendlyPublishError'), '11b. friendlyPublishError helper');

console.log('\n=== firestore create / media slim ===');
assert(fsSrc.includes("code === 'permission-denied'"), '12. createPost tolerates get permission-denied');
assert(fsSrc.includes('Slim media schema'), '13. media slim comment');
assert(!/downloadURL:\s*src/.test(fsSrc.slice(fsSrc.indexOf('function createPost'))), '14. createPost media omits downloadURL');
assert(rulesSrc.includes('allow get: if resource == null'), '15. rules allow get missing doc');
assert(rulesSrc.includes('function isValidMediaItem'), '16. media item allowlist');
assert(!rulesSrc.includes('downloadURL'), '17. downloadURL not in media allowlist');
assert(rulesSrc.includes('clientPublishId'), '18. clientPublishId validated');

console.log('\n=== travel ledger delete + amount ===');
assert(tlUi.includes("data-tl-action=\"delete\""), '19. delete menu item');
assert(tlUi.includes('確定要刪除這本旅行帳本嗎？'), '20. delete confirm title');
assert(tlUi.includes('帳本中的花費紀錄也會一併刪除，此操作無法復原。'), '21. delete confirm body');
assert(tlUi.includes("okLabel: '刪除帳本'"), '22. delete confirm OK label');
assert(tlUi.includes('is-danger'), '23. destructive delete style');
assert(tlUi.includes('tl-menu-divider'), '23b. menu divider before delete');
assert(tlUi.includes('is-menu-open'), '23c. menu-open host class to escape overflow clip');
assert(tlCss.includes('.tl-current-card.is-menu-open') && tlCss.includes('overflow: visible'), '23d. CSS unlock overflow when menu open');
assert(tlCss.includes('.tl-pass.is-menu-open'), '23e. pass card menu overflow unlock');
assert(tlCss.includes('.tl-expense-amount-wrap.is-active'), '24. amount active state');
assert(tlCss.includes('-webkit-text-fill-color: #607d8b'), '25. high-contrast placeholder');
assert(tlUi.includes('placeholder="輸入金額"'), '26. amount placeholder copy');
assert(tlUi.includes('inputmode="decimal"'), '27. decimal keyboard');
assert(tlUi.includes('bindExpenseAmountFocus'), '28. amount focus helper');
assert(tlUi.includes('visualViewport'), '29. keyboard viewport adjust');
assert(tlDataSrc.includes("error: num === 0 ? 'zero'"), '30. zero amount rejected');

console.log('\n=== ledger cascade delete (localStorage) ===');
const memory = new Map();
const sandbox = {
  console,
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k)
  },
  window: {},
  globalThis: {},
  Date,
  Math,
  JSON,
  Number,
  String,
  Array,
  Object,
  isFinite,
  parseInt,
  parseFloat
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.global = sandbox;
vm.runInNewContext(readFileSync(join(root, 'travel-ledger-config.js'), 'utf8'), sandbox);
vm.runInNewContext(readFileSync(join(root, 'travel-ledger-forex.js'), 'utf8'), sandbox);
vm.runInNewContext(tlDataSrc, sandbox);
const DATA = sandbox.SOARVIBE_TRAVEL_LEDGER;
assert(!!DATA, '31. travel ledger data API loaded');

if (DATA) {
  const created = DATA.createTravelLedger({
    name: '東京短打',
    emoji: '🗼',
    countryCode: 'JP',
    cityName: '東京',
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    primaryCurrencyCode: 'JPY',
    displayCurrencyCode: 'TWD',
    budgetMinor: 5000000,
    initialCashMinor: 1000000
  });
  assert(!!created && !!created.id, '32. create ledger');
  DATA.addTravelExpense(created.id, {
    amountMinor: 1200,
    currencyCode: 'JPY',
    category: 'food',
    paymentMethod: 'cash',
    note: '拉麵'
  });
  const before = DATA.getTravelLedgerById(created.id);
  assert(before && before.expenses && before.expenses.length === 1, '33. expense nested under ledger');
  const ok = DATA.deleteTravelLedger(created.id);
  assert(ok === true, '34. deleteTravelLedger returns true');
  assert(!DATA.getTravelLedgerById(created.id), '35. parent ledger removed');
  const store = DATA.loadTravelLedgerStore();
  const orphan = (store.ledgers || []).some((l) => (l.expenses || []).some((e) => e.note === '拉麵'));
  assert(!orphan, '36. no orphan expenses after delete (nested cleanup)');
  const zero = DATA.validateMoneyInput('0', 'JPY');
  assert(zero.ok === false && zero.error === 'zero', '37. amount 0 invalid');
  const empty = DATA.validateMoneyInput('', 'JPY');
  assert(empty.ok === false && empty.error === 'empty', '38. amount empty invalid');
  const neg = DATA.validateMoneyInput('-5', 'JPY');
  assert(neg.ok === false, '39. amount negative invalid');
  const okAmt = DATA.validateMoneyInput('120', 'JPY');
  assert(okAmt.ok === true && okAmt.minor === 120, '40. amount valid');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
