/**
 * City Shares location resolver unit checks (no network).
 * Run: node scripts/test-city-shares-location.mjs
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const src = readFileSync(join(ROOT, 'city-shares-location.js'), 'utf8');
const sandbox = { console, window: {} };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox);
const loc = sandbox.SOARVIBE_CITY_SHARES_LOCATION;
assert.ok(loc, 'location module missing');

function check(input, expect) {
  const tax = loc.resolveLocation(input);
  for (const [k, v] of Object.entries(expect)) {
    assert.equal(tax[k], v, `${input} → ${k} expected ${v}, got ${tax[k]}`);
  }
}

check('名古屋', { countryId: 'japan', cityId: 'nagoya' });
check('Nagoya', { countryId: 'japan', cityId: 'nagoya' });
check('濟州', { countryId: 'korea', cityId: 'jeju' });
check('Jeju', { countryId: 'korea', cityId: 'jeju' });
check('札幌', { countryId: 'japan', regionId: 'hokkaido', cityId: 'sapporo' });
check('Sapporo', { countryId: 'japan', regionId: 'hokkaido', cityId: 'sapporo' });
check('北海道', { countryId: 'japan', regionId: 'hokkaido', cityId: '', feedKind: 'region' });
check('東京', { countryId: 'japan', cityId: 'tokyo' });
check('Tokyo', { countryId: 'japan', cityId: 'tokyo' });
check('釜山', { countryId: 'korea', cityId: 'busan' });
check('Busan', { countryId: 'korea', cityId: 'busan' });
check('日本', { countryId: 'japan', feedKind: 'country' });
check('韓國', { countryId: 'korea', feedKind: 'country' });

const legacyTokyo = loc.normalizePostTaxonomy({ cityId: 'tokyo', title: 'x' });
assert.equal(legacyTokyo.countryId, 'japan');
assert.equal(legacyTokyo.cityName, '東京');

const legacyHokkaido = loc.normalizePostTaxonomy({ cityId: 'hokkaido', title: 'x' });
assert.equal(legacyHokkaido.countryId, 'japan');
assert.equal(legacyHokkaido.regionId, 'hokkaido');

const cardsSrc = readFileSync(join(ROOT, 'city-shares-cards.js'), 'utf8');
vm.runInNewContext(cardsSrc, sandbox);
const cards = sandbox.SOARVIBE_CITY_SHARES_CARDS;
assert.ok(cards);

const frozen = ['tokyo', 'kyoto', 'osaka', 'seoul', 'hokkaido', 'bangkok', 'vietnam', 'london', 'paris'];
const expectedUrls = {
  tokyo: 'photo-1648301184879-28c6ed4964d7',
  kyoto: 'photo-1573047330192-4e6bb1594325',
  osaka: 'photo-1773467223754-b9f3eb4d2c0f',
  seoul: 'photo-1517154421773-0529f29ea451',
  hokkaido: 'photo-1741225241678-0c7f8fa07917',
  bangkok: 'photo-1768392810963-017c92313d79',
  vietnam: './cover-photos/vietnam.jpg',
  london: 'photo-1513635269975-59663e0ac1ad',
  paris: 'photo-1502602898657-3e91760cbb34'
};
frozen.forEach((id) => {
  const c = cards.getCardById(id);
  assert.ok(c && c.frozen, `${id} should be frozen`);
  assert.ok(String(c.image).includes(expectedUrls[id]), `${id} image URL must stay unchanged`);
});

['japan', 'korea', 'usa', 'australia', 'busan'].forEach((id) => {
  const c = cards.getCardById(id);
  assert.ok(c, `missing new card ${id}`);
  assert.equal(c.frozen, false);
});

const enabled = cards.getEnabledCards().map((c) => c.id);
const tokyoIdx = enabled.indexOf('tokyo');
const kyotoIdx = enabled.indexOf('kyoto');
const parisIdx = enabled.indexOf('paris');
assert.ok(tokyoIdx < kyotoIdx && kyotoIdx < parisIdx, 'original relative order preserved');

console.log('city-shares-location + cards OK');
