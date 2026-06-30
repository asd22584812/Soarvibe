/**
 * Editorial build — loads editorial/tokyo-anime-editorial.json pipeline config.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const EDITORIAL_PATH = path.join(ROOT, 'editorial', 'tokyo-anime-editorial.json');
const OUT_JSON = path.join(__dirname, 'tokyo-anime-google-places.json');

const API_BASE = String(process.env.SOARVIBE_API_BASE || 'https://soarvibe-api.soarvibe.workers.dev').replace(/\/$/, '');
const ORIGIN = String(process.env.SOARVIBE_ORIGIN || 'https://asd22584812.github.io');

function jsString(value) {
  if (value == null) return 'null';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return '[' + value.map(function (v) { return jsString(v); }).join(', ') + ']';
  }
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function patchField(src, key, val, withinStart, withinEnd) {
  const block = src.slice(withinStart, withinEnd);
  const fieldRe = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\'|\\[[^\\]]*\\])(,)?');
  if (!fieldRe.test(block)) return src;
  const next = block.replace(fieldRe, function (_m, prefix, _old, suffix) {
    return prefix + val + (suffix || ',');
  });
  return src.slice(0, withinStart) + next + src.slice(withinEnd);
}

function patchSectionRow(src, row) {
  const marker = "sectionId: '" + row.sectionId + "'";
  const start = src.indexOf(marker);
  if (start === -1) {
    console.warn('[SKIP] section not found:', row.sectionId);
    return src;
  }
  const blockEnd = src.indexOf('},', start);
  if (blockEnd === -1) return src;
  const fields = [
    'officialName', 'officialNameLocal', 'aliases', 'photoIntent', 'imageChecklist', 'imageRejectRules',
    'subject', 'mapsQuery', 'placeId', 'googleRating', 'googleAddress',
    'googlePhotoUrl', 'googleAttribution', 'imageSource', 'caption'
  ];
  let out = src;
  for (const key of fields) {
    let val;
    if (key === 'caption' && row.photoCaption) val = jsString(row.photoCaption);
    else if (key === 'googlePhotoUrl' && !row.googlePhotoUrl) val = 'null';
    else if (key === 'googleAttribution' && !row.googleAttribution) val = 'null';
    else if (key === 'imageSource' && !row.imageSource) val = 'null';
    else if (key === 'aliases' || key === 'imageChecklist' || key === 'imageRejectRules') {
      val = jsString(row[key] || []);
    } else val = jsString(row[key]);
    out = patchField(out, key, val, start, blockEnd);
  }
  return out;
}

function patchHeroFields(src, row) {
  const heroFields = {
    heroSubject: row.subject || row.title,
    heroOfficialName: row.officialName,
    heroOfficialNameLocal: row.officialNameLocal,
    heroMapsQuery: row.mapsQuery,
    heroPlaceId: row.placeId,
    heroGooglePhotoUrl: row.googlePhotoUrl,
    heroGoogleAttribution: row.googleAttribution,
    heroImageSource: row.imageSource,
    coverPlaceId: row.placeId,
    coverGooglePhotoUrl: row.googlePhotoUrl,
    coverGoogleAttribution: row.googleAttribution,
    coverImageSource: row.imageSource
  };
  let out = src;
  for (const [key, value] of Object.entries(heroFields)) {
    const val = jsString(value);
    const fieldRe = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\')(,)?');
    if (!fieldRe.test(out)) continue;
    out = out.replace(fieldRe, function (_m, prefix, _old, suffix) {
      return prefix + val + (suffix || ',');
    });
  }
  return out;
}

function buildPayload(editorial) {
  const hero = Object.assign({}, editorial.hero, {
    visualKeywords: editorial.hero.imageChecklist || []
  });
  const sections = editorial.sections.map(function (s) {
    return Object.assign({}, s, {
      subject: s.title || s.subject,
      visualKeywords: s.imageChecklist || []
    });
  });
  return sections.concat([hero]);
}

async function resolveAll(payload) {
  const response = await fetch(API_BASE + '/api/places/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ sections: payload })
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Worker places resolve failed: ' + JSON.stringify(data));
  return data.results || [];
}

async function main() {
  const editorial = JSON.parse(fs.readFileSync(EDITORIAL_PATH, 'utf8'));
  const payload = buildPayload(editorial);
  const results = await resolveAll(payload);
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  console.log('[WROTE]', OUT_JSON);

  let src = fs.readFileSync(DATA_PATH, 'utf8');
  const hero = results.find(function (r) { return r.sectionId === 'hero-anime'; });
  const sections = results.filter(function (r) { return r.sectionId !== 'hero-anime'; });

  for (const row of sections) {
    const editorialRow = editorial.sections.find(function (s) { return s.sectionId === row.sectionId; }) || {};
    Object.assign(row, {
      aliases: editorialRow.aliases,
      photoIntent: editorialRow.photoIntent,
      imageChecklist: editorialRow.imageChecklist,
      imageRejectRules: editorialRow.imageRejectRules,
      officialName: editorialRow.officialName,
      officialNameLocal: editorialRow.officialNameLocal
    });
    console.log(
      row.sectionId,
      row.matched ? 'OK' : 'PLACEHOLDER',
      row.placeName || '',
      row.searchUsed || '',
      row.rejectReason || '',
      row.googleAttribution ? 'attr:' + row.googleAttribution.slice(0, 20) : '',
      row.photoCaption || ''
    );
    src = patchSectionRow(src, row);
  }
  if (hero) {
    Object.assign(hero, editorial.hero);
    console.log('hero-anime', hero.matched ? 'OK' : 'PLACEHOLDER', hero.placeName, hero.searchUsed || '', hero.rejectReason || '');
    src = patchHeroFields(src, hero);
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
