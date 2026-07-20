/**
 * Fetch Google Places cover thumbnails for each Tokyo travel-style edition card.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const OUT_JSON = path.join(__dirname, 'tokyo-edition-cover-places.json');

const API_BASE = String(process.env.SOARVIBE_API_BASE || 'https://soarvibe-api.soarvibe.workers.dev').replace(/\/$/, '');
const ORIGIN = String(process.env.SOARVIBE_ORIGIN || 'https://asd22584812.github.io');

const EDITION_COVERS = [
  {
    key: 'budget',
    subject: '上野 アメ横',
    officialName: 'Ameya-Yokocho',
    officialNameLocal: 'アメ横',
    mapsQuery: 'Ameya-Yokocho Ueno Tokyo',
    photoIntent: '廣角街景、商店街外觀、招牌',
    imageChecklist: ['アメ横', 'ameyoko', '商店街', '外観']
  },
  {
    key: 'sightseeing',
    subject: '東京タワー',
    officialName: 'Tokyo Tower',
    officialNameLocal: '東京タワー',
    mapsQuery: 'Tokyo Tower',
    photoIntent: '地標建築外觀、塔身全景',
    imageChecklist: ['東京タワー', 'tower', '塔', '外観']
  },
  {
    key: 'trendy',
    subject: '代官山 蔦屋書店',
    officialName: 'Tsutaya Books Daikanyama',
    officialNameLocal: '代官山 蔦屋書店',
    mapsQuery: 'Tsutaya Books Daikanyama',
    photoIntent: '書店建築外觀、潮流街區',
    imageChecklist: ['代官山', '蔦屋', 'tsutaya', '外観']
  },
  {
    key: 'foodie',
    subject: '築地場外市場',
    officialName: 'Tsukiji Outer Market',
    officialNameLocal: '築地場外市場',
    mapsQuery: 'Tsukiji Outer Market Tokyo',
    photoIntent: '市場外觀、海鮮攤位、街景',
    imageChecklist: ['築地', 'tsukiji', '市場', '外観']
  },
  {
    key: 'photospot',
    subject: 'teamLab Planets',
    officialName: 'teamLab Planets TOKYO DMM',
    officialNameLocal: 'teamLab Planets',
    mapsQuery: 'teamLab Planets TOKYO DMM',
    photoIntent: '入口外觀、沉浸式藝術空間',
    imageChecklist: ['teamLab', 'planets', '豊洲', '外観']
  },
  {
    key: 'anime',
    subject: '秋葉原電気街',
    officialName: 'Akihabara Electric Town',
    officialNameLocal: '秋葉原電気街',
    mapsQuery: 'Akihabara Electric Town Chuo Dori Tokyo',
    photoIntent: '廣角街景、霓虹招牌、電氣街外觀',
    imageChecklist: ['秋葉原', 'akihabara', '電気街', '外観']
  },
  {
    key: 'streetwear',
    subject: 'ラフォーレ原宿',
    officialName: 'Laforet Harajuku',
    officialNameLocal: 'ラフォーレ原宿',
    mapsQuery: 'Laforet Harajuku',
    photoIntent: '商場外觀、原宿潮流街景',
    imageChecklist: ['原宿', 'laforet', 'harajuku', '外観']
  }
];

async function resolveCover(edition, excludeUrls) {
  const section = Object.assign({
    sectionId: 'cover-' + edition.key,
    sectionRole: 'landmark',
    subjectType: 'venue',
    sectionType: 'landmark',
    isSpecificVenue: true,
    requireStreetscape: false,
    excludeUrls: excludeUrls || []
  }, edition);
  delete section.key;
  const body = {
    article: { articleId: 'tokyo-' + edition.key, articleTheme: edition.subject },
    sections: [section],
    excludeUrls: excludeUrls || []
  };
  const r = await fetch(API_BASE + '/api/editorial/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  return (j.results && j.results[0]) || j;
}

function jsString(value) {
  if (value == null) return 'null';
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function patchEditionCoverGoogle(src, results) {
  let out = src;
  const blockStart = out.indexOf('META.tokyo');
  if (blockStart === -1) throw new Error('META.tokyo not found');
  const articlesStart = out.indexOf('var ARTICLES', blockStart);
  const metaBlock = out.slice(blockStart, articlesStart);

  if (!/editionCoverGoogle:\s*\{/.test(metaBlock)) {
    const insertAfter = 'META.tokyo.editionCoverKeys.sightseeing = \'tokyo-sightseeing-cover\';';
    const editionObj = results.reduce(function (acc, row) {
      const key = row.editionKey;
      acc[key] = {
        googlePhotoUrl: row.googlePhotoUrl,
        googleAttribution: row.googleAttribution,
        imageSource: row.matched && row.googlePhotoUrl ? 'google_places' : null,
        subject: row.subject,
        mapsQuery: row.mapsQuery
      };
      return acc;
    }, {});
    const lines = Object.entries(editionObj).map(function ([key, val]) {
      return (
        '        ' + key + ': {\n' +
        '            googlePhotoUrl: ' + jsString(val.googlePhotoUrl) + ',\n' +
        '            googleAttribution: ' + jsString(val.googleAttribution) + ',\n' +
        '            imageSource: ' + jsString(val.imageSource) + ',\n' +
        '            subject: ' + jsString(val.subject) + ',\n' +
        '            mapsQuery: ' + jsString(val.mapsQuery) + '\n' +
        '        }'
      );
    }).join(',\n');
    const patch =
      insertAfter + '\n\n    META.tokyo.editionCoverGoogle = {\n' + lines + '\n    };';
    out = out.replace(insertAfter, patch);
    return out;
  }

  for (const row of results) {
    const key = row.editionKey;
    const reUrl = new RegExp('(' + key + ':\\s*\\{[\\s\\S]*?googlePhotoUrl:\\s*)(null|\'[^\']*\')');
    const reAttr = new RegExp('(' + key + ':\\s*\\{[\\s\\S]*?googleAttribution:\\s*)(null|\'[^\']*\')');
    const reSrc = new RegExp('(' + key + ':\\s*\\{[\\s\\S]*?imageSource:\\s*)(null|\'[^\']*\')');
    out = out.replace(reUrl, function (_m, p1) {
      return p1 + jsString(row.googlePhotoUrl);
    });
    out = out.replace(reAttr, function (_m, p1) {
      return p1 + jsString(row.googleAttribution);
    });
    out = out.replace(reSrc, function (_m, p1) {
      return p1 + jsString(row.matched && row.googlePhotoUrl ? 'google_places' : null);
    });
  }
  return out;
}

function patchArticleCover(src, styleKey, row) {
  if (!row.matched || !row.googlePhotoUrl) return src;
  const marker = "styleKey: '" + styleKey + "'";
  const idx = src.indexOf(marker);
  if (idx === -1) return src;
  const slice = src.slice(idx, idx + 4000);
  const coverUrlRe = /coverGooglePhotoUrl:\s*(null|'[^']*')/;
  const coverAttrRe = /coverGoogleAttribution:\s*(null|'[^']*')/;
  const coverSrcRe = /coverImageSource:\s*(null|'[^']*')/;
  let block = slice;
  block = block.replace(coverUrlRe, 'coverGooglePhotoUrl: ' + jsString(row.googlePhotoUrl));
  block = block.replace(coverAttrRe, 'coverGoogleAttribution: ' + jsString(row.googleAttribution));
  block = block.replace(coverSrcRe, 'coverImageSource: ' + jsString('google_places'));
  return src.slice(0, idx) + block + src.slice(idx + 4000);
}

async function main() {
  const results = [];
  const excludeUrls = [];
  for (const edition of EDITION_COVERS) {
    process.stdout.write('COVER ' + edition.key + ' ... ');
    try {
      const row = await resolveCover(edition, excludeUrls);
      const ok = !!(row.matched && row.googlePhotoUrl);
      console.log(ok ? 'PASS' : 'FAIL', row.placeName || '', (row.photoCaption || '').slice(0, 40));
      const packed = Object.assign({ editionKey: edition.key }, edition, row);
      results.push(packed);
      if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
    } catch (err) {
      console.log('ERR', err.message);
      results.push(Object.assign({ editionKey: edition.key, matched: false }, edition));
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  console.log('[WROTE]', OUT_JSON);

  let src = fs.readFileSync(DATA_PATH, 'utf8');
  src = patchEditionCoverGoogle(src, results);
  for (const row of results) {
    if (row.editionKey === 'anime' || row.editionKey === 'sightseeing') {
      src = patchArticleCover(src, row.editionKey, row);
    }
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
