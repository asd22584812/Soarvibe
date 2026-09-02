/**
 * Profile nickname default / account-isolation regressions (offline).
 * node scripts/test-profile-nickname-default.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  OK  ' + msg);
    passed += 1;
  } else {
    console.error('  FAIL  ' + msg);
    failed += 1;
  }
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const authUi = fs.readFileSync(path.join(root, 'soarvibe-auth-ui.js'), 'utf8');

console.log('\n=== source ===');
assert(
  /id="user-nickname"[^>]*value=""/.test(index) ||
    /id="user-nickname"[^>]*value=''/.test(index) ||
    (/id="user-nickname"/.test(index) && !/id="user-nickname"[^>]*value="義翔 Roderick"/.test(index)),
  'HTML nickname input has no developer default value'
);
assert(/placeholder="輸入你的暱稱"/.test(index), 'placeholder 輸入你的暱稱');
assert(!/const DEFAULT_USER_NICKNAME\s*=\s*'義翔 Roderick'/.test(index), 'DEFAULT_USER_NICKNAME constant removed');
assert(/LEGACY_DEFAULT_USER_NICKNAME\s*=\s*'義翔 Roderick'/.test(index), 'legacy marker kept only for scrubbing');
assert(/function readStoredUserNickname/.test(index), 'readStoredUserNickname exists');
assert(/function clearUserCenterNickname/.test(index), 'clearUserCenterNickname exists');
assert(/clearUserCenterNicknameUi/.test(authUi), 'auth-ui clears nickname on logout');
assert(/wasSignedIn/.test(authUi), 'auth-ui tracks sign-out transition for isolation');
assert(
  !/userNicknameInput\.value\s*=\s*nickname\s*\|\|\s*DEFAULT_USER_NICKNAME/.test(index),
  'load path no longer falls back to DEFAULT'
);
assert(
  /USER_CHECKLIST_KEY/.test(index) && /USER_NOTES_KEY/.test(index),
  'checklist / notes keys unchanged'
);
assert(/id="check-passport"/.test(index) && /user-note-shopping/.test(index), 'checklist / notes UI retained');

// Extract helpers into a tiny sandbox for behavioral checks.
function extractFn(src, name) {
  const start = src.indexOf('function ' + name);
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

const store = new Map();
const sandbox = {
  LEGACY_DEFAULT_USER_NICKNAME: '義翔 Roderick',
  USER_NICKNAME_KEY: 'soarvibe_user_nickname',
  localStorage: {
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    }
  },
  userNicknameInput: { value: 'stale' },
  window: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  extractFn(index, 'isLegacyDefaultNickname') +
    '\n' +
    extractFn(index, 'readStoredUserNickname') +
    '\n' +
    extractFn(index, 'writeStoredUserNickname') +
    '\n' +
    extractFn(index, 'clearUserCenterNickname') +
    '\n',
  sandbox
);

console.log('\n=== behavior ===');
store.clear();
sandbox.userNicknameInput.value = 'stale';
assert(sandbox.readStoredUserNickname() === '', '1. fresh guest → nickname empty');
assert(sandbox.userNicknameInput.value === 'stale', 'input untouched until clear/load');

sandbox.writeStoredUserNickname('小鹿');
assert(sandbox.readStoredUserNickname() === '小鹿', '3. existing nickname restore');
assert(store.get('soarvibe_user_nickname') === '小鹿', '3b. stored in soarvibe_user_nickname');

sandbox.clearUserCenterNickname();
assert(sandbox.userNicknameInput.value === '', '4. logout clear → input empty');
assert(sandbox.readStoredUserNickname() === '', '4b. logout clear → storage empty');

sandbox.writeStoredUserNickname('UserA');
sandbox.clearUserCenterNickname();
assert(sandbox.readStoredUserNickname() === '', '5. another account cannot inherit prior local nickname');

store.set('soarvibe_user_nickname', '義翔 Roderick');
assert(sandbox.readStoredUserNickname() === '', 'legacy developer default scrubbed to empty');
assert(!store.has('soarvibe_user_nickname'), 'legacy key removed from storage');

sandbox.writeStoredUserNickname('');
assert(sandbox.readStoredUserNickname() === '', 'empty write does not invent a default');
assert(!store.has('soarvibe_user_nickname'), 'empty write removes key');

assert(
  /placeholder="輸入你的暱稱"/.test(index) && !/value="義翔 Roderick"/.test(index),
  '2. placeholder normal; value not developer name'
);

assert(
  /USER_CHECKLIST_KEY[\s\S]*loadUserCenterData|loadUserCenterData[\s\S]*USER_CHECKLIST_KEY/.test(index),
  '6. checklist still loaded in user center'
);
assert(/USER_NOTES_KEY/.test(index) && /saveUserNotes/.test(index), '6b. notes save path retained');

console.log('\n=== totals ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
