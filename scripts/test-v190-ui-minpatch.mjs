/**
 * Static regression: transport hint gone, plane angle, day progress binding, expense date gate.
 * Run: node scripts/test-v190-ui-minpatch.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('OK', msg);
  } else {
    failed++;
    console.error('FAIL', msg);
  }
}

console.log('=== UTF-8 ===');
assert(!(index.match(/\uFFFD/g) || []).length, 'index no U+FFFD');
assert((index.match(/[\u4e00-\u9fff]/g) || []).length > 1000, 'index has Chinese');

console.log('\n=== Transport ===');
assert(!/transport-required-hint/.test(index), 'hint id removed');
assert(!/請先選擇本次旅程的交通方式/.test(index), 'hint copy removed');
assert(/value="public-transit"/.test(index) && /value="self-drive"/.test(index), 'two options remain');
assert(!/value="mixed"|value="taxi-charter"|value="walk-transit"|value="soarvibe-decide"/.test(index), 'no mixed revival');

console.log('\n=== Plane ===');
assert(/\.generating-orbit-arm\s*\{[^}]*transform:\s*rotate\(60deg\)/s.test(index), 'arm stays 60deg');
assert(/\.generating-plane\s*\{[^}]*rotate\(-45deg\)/s.test(index), 'plane self -45deg');
assert(/@keyframes generating-plane-bob\s*\{[^}]*rotate\(-45deg\)/s.test(index), 'bob uses -45deg');
assert(!/generating-plane[^\{]*\{[^}]*rotate\(-15deg\)/s.test(index), 'old -15deg gone from plane rule');

console.log('\n=== Day progress ===');
assert(/id="generating-day-progress"/.test(index), 'day progress DOM');
assert(/var generatingDayProgress = null/.test(index), 'day progress state');
assert(/function getDayProgressStatusText\(/.test(index), 'getDayProgressStatusText');
assert(/function clearGeneratingDayProgress\(/.test(index), 'clearGeneratingDayProgress');
assert(/正在安排 Day /.test(index), 'day copy present');
const stubOnly = /function setGeneratingDayProgress\(currentDay, totalDays, dest\) \{\s*startGeneratingStatusRotation\(dest, false\);\s*\}/.test(index);
assert(!stubOnly, 'setGeneratingDayProgress is not stub');
assert(/generatingDayProgress = \{\s*day:\s*currentDay,\s*total:\s*totalDays/.test(index), 'binds real day/total');
assert(/setGeneratingDayProgress\(d, totalDays, payload\.destination\)/.test(index), 'day-by-day calls real progress');
assert(/clearGeneratingDayProgress\(\)/.test(index), 'hide clears day progress');

console.log('\n=== Inline JS syntax ===');
const scripts = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(index))) {
  if (/\bsrc\s*=/i.test(m[1] || '')) continue;
  scripts.push(m[2]);
}
let parseOk = true;
for (const code of scripts) {
  if (!code.trim()) continue;
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (e) {
    parseOk = false;
    console.error(e.message);
  }
}
assert(parseOk, 'all inline scripts parse');

console.log('\n=== Ledger date gate (static + 1c1 covers runtime) ===');
assert(/if \(state === 'archived'\) return false;/.test(fs.readFileSync(path.join(root, 'travel-ledger-ui.js'), 'utf8')), 'archived still gated');
assert(!/state === 'active' && !isEdit/.test(fs.readFileSync(path.join(root, 'travel-ledger-ui.js'), 'utf8')), 'active create no longer hidden');
assert(!/state === 'active' && isEdit/.test(fs.readFileSync(path.join(root, 'travel-ledger-ui.js'), 'utf8')), 'active edit no longer hidden');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
