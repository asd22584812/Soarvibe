/**
 * Saved-trip customTitle rename regressions (localStorage favorites only).
 * Run: node scripts/test-saved-trip-custom-title.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('OK', msg);
  } else {
    failed += 1;
    console.error('FAIL', msg);
  }
}

function extractFn(src, name) {
  let start = src.indexOf('async function ' + name + '(');
  if (start < 0) start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

console.log('=== Static contracts ===');
assert(/function getSavedTripDisplayTitle\(/.test(index), 'getSavedTripDisplayTitle present');
assert(/function applySavedTripCustomTitle\(/.test(index), 'applySavedTripCustomTitle present');
assert(/function renameSavedTrip\(/.test(index), 'renameSavedTrip present');
assert(/saved-trip-rename-btn/.test(index), 'pencil rename button class present');
assert(/aria-label',\s*'改名'/.test(index) || /aria-label="改名"/.test(index), 'rename aria-label 改名');
assert(
  /getSavedTripDisplayTitle\(trip\)/.test(index) &&
    !/titleEl\.textContent\s*=\s*trip\.title\s*\|\|/.test(index),
  'card title uses getSavedTripDisplayTitle (not raw trip.title only)'
);
assert(
  /trip\.customTitle\s*=\s*trimmed/.test(index) && /delete trip\.customTitle/.test(index),
  'rename sets customTitle or deletes on empty'
);
assert(
  /var title = getTripTitleFromMeta\(meta\);/.test(index) &&
    /entry = \{[\s\S]*?title:\s*title[\s\S]*?markdown:/.test(index) &&
    !/saveCurrentTrip[\s\S]{0,800}customTitle/.test(index),
  'saveCurrentTrip still writes formula title; does not write customTitle at save'
);
assert(
  /showItineraryContent\(trip\.markdown,\s*trip\.meta,\s*trip\.hiddenData\)/.test(index),
  'load still uses markdown/meta/hiddenData'
);
assert(/deleteSavedTrip\(trip\.id\)/.test(index), 'delete still keyed by id');
assert(
  /applySavedTripCustomTitle[\s\S]{0,400}setSavedTrips\(trips\)/.test(index) &&
    /setSavedTrips\(trips\);[\s\S]{0,80}renderSavedTrips\(\)/.test(index),
  'rename persists via setSavedTrips then rerenders'
);

console.log('\n=== Runtime display + rename ===');
const store = { savedTrips: '[]' };
const sandbox = {
  console,
  window: {
    prompt: () => null
  },
  localStorage: {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    },
    setItem(k, v) {
      store[k] = String(v);
    }
  },
  SAVED_TRIPS_KEY: 'savedTrips',
  savedTripsList: { innerHTML: '' },
  savedTripsEmpty: { classList: { add() {}, remove() {} } },
  renderSavedTrips() {}
};
vm.createContext(sandbox);
vm.runInContext(extractFn(index, 'getSavedTrips'), sandbox);
vm.runInContext(extractFn(index, 'setSavedTrips'), sandbox);
vm.runInContext(extractFn(index, 'getSavedTripDisplayTitle'), sandbox);
vm.runInContext(extractFn(index, 'applySavedTripCustomTitle'), sandbox);
vm.runInContext(extractFn(index, 'renameSavedTrip'), sandbox);

const oldTrip = {
  id: '1',
  title: '東京 · 初次觀光',
  markdown: '## Day 1\nold-md',
  savedAt: '2026-01-01T00:00:00.000Z',
  meta: { destination: '東京', travelStyle: 'sightseeing', dateStart: '2026-05-01', dateEnd: '2026-05-03' },
  hiddenData: { days: [{ dayNum: 1 }], checklist: ['a'] }
};
const snapMd = oldTrip.markdown;
const snapMeta = JSON.stringify(oldTrip.meta);
const snapHidden = JSON.stringify(oldTrip.hiddenData);
const snapTitle = oldTrip.title;

assert(
  sandbox.getSavedTripDisplayTitle(oldTrip) === '東京 · 初次觀光',
  '舊收藏無 customTitle 顯示 title'
);
assert(
  sandbox.getSavedTripDisplayTitle({}) === '未命名行程',
  '缺 title 顯示 未命名行程'
);

sandbox.applySavedTripCustomTitle(oldTrip, '  蜜月東京  ');
assert(oldTrip.customTitle === '蜜月東京', 'rename 寫入 trimmed customTitle');
assert(oldTrip.title === snapTitle, 'rename 不覆寫原本 title');
assert(
  sandbox.getSavedTripDisplayTitle(oldTrip) === '蜜月東京',
  'customTitle 優先顯示'
);
assert(oldTrip.markdown === snapMd, 'rename 不改 markdown');
assert(JSON.stringify(oldTrip.meta) === snapMeta, 'rename 不改 meta');
assert(JSON.stringify(oldTrip.hiddenData) === snapHidden, 'rename 不改 hiddenData');

sandbox.applySavedTripCustomTitle(oldTrip, '   ');
assert(!Object.prototype.hasOwnProperty.call(oldTrip, 'customTitle'), '空字串 delete customTitle');
assert(
  sandbox.getSavedTripDisplayTitle(oldTrip) === '東京 · 初次觀光',
  '清空 customTitle 回到 title'
);

console.log('\n=== Persistence + load/delete isolation ===');
store.savedTrips = JSON.stringify([
  {
    id: 'keep',
    title: '大阪 · 美食之旅',
    markdown: 'md-keep',
    meta: { destination: '大阪' },
    hiddenData: { days: [] },
    savedAt: '2026-02-01T00:00:00.000Z'
  },
  {
    id: 'gone',
    title: '京都 · 初次觀光',
    markdown: 'md-gone',
    meta: { destination: '京都' },
    hiddenData: { days: [] },
    savedAt: '2026-02-02T00:00:00.000Z'
  }
]);

let rendered = 0;
sandbox.renderSavedTrips = function () {
  rendered += 1;
};
sandbox.window.prompt = function () {
  return '  關西美食週  ';
};
sandbox.renameSavedTrip('keep');
const afterRename = JSON.parse(store.savedTrips);
const keep = afterRename.find((t) => t.id === 'keep');
assert(!!keep && keep.customTitle === '關西美食週', 'rename 後 localStorage 持久保存 customTitle');
assert(keep.title === '大阪 · 美食之旅', '持久化後 title 公式名仍在');
assert(keep.markdown === 'md-keep', '持久化後 markdown 不變');
assert(rendered === 1, 'rename 後立即 rerender');

sandbox.window.prompt = function () {
  return '';
};
sandbox.renameSavedTrip('keep');
const afterClear = JSON.parse(store.savedTrips).find((t) => t.id === 'keep');
assert(
  afterClear && !Object.prototype.hasOwnProperty.call(afterClear, 'customTitle'),
  '清空後 localStorage 無 customTitle'
);
assert(afterClear.title === '大阪 · 美食之旅', '清空後 title 仍在');

vm.runInContext(extractFn(index, 'deleteSavedTrip'), sandbox);
sandbox.deleteSavedTrip('gone');
const afterDelete = JSON.parse(store.savedTrips);
assert(afterDelete.length === 1 && afterDelete[0].id === 'keep', 'delete 仍只依 id，不受 customTitle 影響');
assert(afterDelete[0].markdown === 'md-keep', 'delete 不影響其餘行程本體');

const loadStart = index.indexOf("card.addEventListener('click', function () {");
const loadEnd = index.indexOf('});', loadStart);
const loadSnippet = loadStart >= 0 && loadEnd > loadStart ? index.slice(loadStart, loadEnd + 3) : '';
assert(
  /showItineraryContent\(trip\.markdown,\s*trip\.meta,\s*trip\.hiddenData\)/.test(loadSnippet) &&
    !/customTitle/.test(loadSnippet),
  'load 邏輯不讀 customTitle'
);

console.log('\n=== Summary ===');
console.log('passed=' + passed + ' failed=' + failed);
process.exitCode = failed ? 1 : 0;
