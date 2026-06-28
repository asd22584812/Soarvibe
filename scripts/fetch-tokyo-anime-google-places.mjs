/**
 * One-time build: resolve Tokyo Anime Google Places photos via SOARVIBE Worker.
 * Usage: node scripts/fetch-tokyo-anime-google-places.mjs
 *
 * Requires deployed /api/places/resolve on SOARVIBE_API_BASE (default production worker).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const OUT_JSON = path.join(__dirname, 'tokyo-anime-google-places.json');

const API_BASE = String(process.env.SOARVIBE_API_BASE || 'https://soarvibe-api.soarvibe.workers.dev').replace(/\/$/, '');
const ORIGIN = String(process.env.SOARVIBE_ORIGIN || 'https://asd22584812.github.io');

const SECTION_QUERIES = [
  { sectionId: 'akihabara', subject: '秋葉原電氣街', mapsQuery: 'Akihabara Electric Town Tokyo Japan' },
  { sectionId: 'nakano', subject: '中野百老匯', mapsQuery: 'Nakano Broadway Tokyo Japan' },
  { sectionId: 'gachapon', subject: 'GACHAPON 扭蛋會館', mapsQuery: 'Gachapon Kaikan Akihabara Tokyo' },
  { sectionId: 'ichiran', subject: '一蘭拉麵 秋葉原店', mapsQuery: '一蘭 秋葉原店 東京' },
  { sectionId: 'maid-cafe', subject: '女僕咖啡廳 秋葉原', mapsQuery: 'Maid Cafe Akihabara Tokyo' },
  { sectionId: 'hotel-gracery', subject: 'Hotel Gracery Akihabara', mapsQuery: 'ホテルグレイスリー秋葉原 東京' },
  { sectionId: 'nui-hostel', subject: 'Nui Hostel Tokyo', mapsQuery: 'Nui Hostel & Bar Tokyo' }
];

function jsString(value) {
  if (value == null) return 'null';
  if (typeof value === 'number') return String(value);
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function patchDataJs(results) {
  let src = fs.readFileSync(DATA_PATH, 'utf8');
  for (const row of results) {
    const marker = "sectionId: '" + row.sectionId + "'";
    const start = src.indexOf(marker);
    if (start === -1) {
      console.warn('[SKIP] section not found:', row.sectionId);
      continue;
    }
    const blockEnd = src.indexOf('},', start);
    if (blockEnd === -1) continue;
    let block = src.slice(start, blockEnd);

    const fields = [
      'subject',
      'mapsQuery',
      'placeId',
      'googleRating',
      'googleAddress',
      'googlePhotoUrl',
      'googleAttribution',
      'imageSource'
    ];
    for (const key of fields) {
      const val = jsString(row[key]);
      const fieldRe = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\')(,)?');
      const replacement = '$1' + val + '$3';
      if (fieldRe.test(block)) {
        block = block.replace(fieldRe, replacement);
      } else {
        block = block.replace(
          /sectionId:\s*'[^']+',/,
          function (m) {
            return m + replacement;
          }
        );
      }
    }
    src = src.slice(0, start) + block + src.slice(blockEnd);
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
}

function patchHeroCoverFromAkihabara(row) {
  let src = fs.readFileSync(DATA_PATH, 'utf8');
  const heroFields = {
    heroPlaceId: row.placeId,
    heroGooglePhotoUrl: row.googlePhotoUrl,
    heroGoogleAttribution: row.googleAttribution,
    heroImageSource: row.imageSource,
    coverPlaceId: row.placeId,
    coverGooglePhotoUrl: row.googlePhotoUrl,
    coverGoogleAttribution: row.googleAttribution,
    coverImageSource: row.imageSource
  };
  for (const [key, value] of Object.entries(heroFields)) {
    const val = jsString(value);
    const fieldRe = new RegExp('\\n\\s*' + key + ':\\s*[^,\\n]+,?');
    src = src.replace(fieldRe, '\n                ' + key + ': ' + val + ',');
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
}

async function main() {
  const response = await fetch(API_BASE + '/api/places/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN
    },
    body: JSON.stringify({ sections: SECTION_QUERIES })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error('Worker places resolve failed: ' + JSON.stringify(payload));
  }
  const results = payload.results || [];
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  console.log('[WROTE]', OUT_JSON);
  for (const row of results) {
    console.log(
      row.sectionId,
      row.matched ? 'OK' : 'PLACEHOLDER',
      row.placeName || '',
      row.googlePhotoUrl ? '(photo)' : ''
    );
  }
  patchDataJs(results);
  const akihabara = results.find(function (r) { return r.sectionId === 'akihabara'; });
  if (akihabara && akihabara.googlePhotoUrl) {
    patchHeroCoverFromAkihabara(akihabara);
  }
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
