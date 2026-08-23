/**
 * Travel Ledger menu delete visibility regression (overflow clip fix).
 * Run: node scripts/test-tl-menu-delete-p0.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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

const ui = readFileSync(join(root, 'travel-ledger-ui.js'), 'utf8');
const css = readFileSync(join(root, 'travel-ledger.css'), 'utf8');
const start = ui.indexOf('function renderMenu');
const end = ui.indexOf('function renderEmptyState');
const menuFn = ui.slice(start, end);

assert(start >= 0, '1. renderMenu exists');
assert(menuFn.includes('data-tl-action="edit"'), '2. edit in menu DOM template');
assert(menuFn.includes('data-tl-action="archive"'), '3. archive in menu DOM template');
assert(menuFn.includes('data-tl-action="delete"'), '4. delete in menu DOM template');
assert(menuFn.includes('tl-menu-divider'), '5. divider before delete');
assert(menuFn.indexOf('archive') < menuFn.indexOf('tl-menu-divider'), '6. archive before divider');
assert(menuFn.indexOf('tl-menu-divider') < menuFn.indexOf('data-tl-action="delete"'), '7. divider before delete');
assert(!/if\s*\(.*\)\s*\{[^}]*delete/.test(menuFn), '8. no conditional hiding delete in renderMenu');
assert(ui.includes("closest('.tl-current-card, .tl-pass, .tl-detail-hero')"), '9. open menu marks card host');
assert(css.includes('#travelLedger .tl-pass.is-menu-open'), '10. pass overflow unlock');
assert(css.includes('#travelLedger .tl-current-card.is-menu-open'), '11. current overflow unlock');
assert(/\.tl-current-card\.is-menu-open[\s\S]*?overflow:\s*visible/.test(css), '12. overflow visible rule');
assert(css.includes('.tl-menu-item.is-danger'), '13. destructive style');
assert(ui.includes("okLabel: '刪除帳本'"), '14. confirm ok label');
assert(ui.includes('deleteTravelLedger'), '15. delete data API used');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
