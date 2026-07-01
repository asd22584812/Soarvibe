/**
 * Editorial build — rule-based pipeline (zero AI tokens).
 * Google Places = place verify + metadata photo scoring.
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
const USE_LEGACY_PLACES = process.env.EDITORIAL_PIPELINE === 'places';

function jsString(value) {
  if (value == null) return 'null';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return '[' + value.map(function (v) { return jsString(v); }).join(', ') + ']';
  }
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function extractSectionContent(dataSrc, sectionId) {
  const marker = "sectionId: '" + sectionId + "'";
  const start = dataSrc.indexOf(marker);
  if (start === -1) return {};
  const blockEnd = dataSrc.indexOf('},', start);
  const block = dataSrc.slice(start, blockEnd);
  const heading = (block.match(/heading:\s*'((?:\\.|[^'])*)'/)) || [];
  const content = (block.match(/content:\s*'((?:\\.|[^'])*)'/)) || [];
  return {
    heading: heading[1] ? heading[1].replace(/\\'/g, "'") : '',
    content: content[1] ? content[1].replace(/\\'/g, "'") : ''
  };
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
    'googlePhotoUrl', 'googleAttribution', 'imageSource', 'caption', 'photoPlaceName', 'matchedKeywords'
  ];
  let out = src;
  for (const key of fields) {
    let val;
    if (key === 'caption' && row.photoCaption) val = jsString(row.photoCaption);
    else if (key === 'googlePhotoUrl' && !row.googlePhotoUrl) val = 'null';
    else if (key === 'googleAttribution' && !row.googleAttribution) val = 'null';
    else if (key === 'imageSource' && !row.imageSource) val = 'null';
    else if (key === 'aliases' || key === 'imageChecklist' || key === 'imageRejectRules' || key === 'matchedKeywords') {
      val = jsString(row[key] || []);
    } else if (key === 'photoPlaceName') {
      val = jsString(row.photoPlaceName || null);
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

function buildPayload(editorial, dataSrc) {
  const hero = Object.assign({}, editorial.hero, {
    subject: editorial.hero.title || editorial.hero.subject
  });
  const sections = editorial.sections.map(function (s) {
    const contentBlock = extractSectionContent(dataSrc, s.sectionId);
    return Object.assign({}, s, {
      subject: s.title || s.subject,
      heading: s.heading || contentBlock.heading || '',
      content: s.content || contentBlock.content || ''
    });
  });
  return {
    article: {
      articleId: editorial.articleId,
      articleTheme: editorial.articleTheme,
      editorialAngle: editorial.editorialAngle,
      targetReader: editorial.targetReader,
      readerPersona: editorial.readerPersona,
      travelStyle: editorial.travelStyle,
      emotion: editorial.emotion,
      articleGoal: editorial.articleGoal,
      storyline: editorial.storyline,
      readingRhythm: editorial.readingRhythm,
      editorialPlan: editorial.editorialPlan
    },
    sections: sections.concat([hero])
  };
}

async function resolveAll(payload) {
  const endpoint = USE_LEGACY_PLACES ? '/api/places/resolve' : '/api/editorial/resolve';
  const sections = payload.sections || [];
  const results = [];
  let excludeUrls = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const body = USE_LEGACY_PLACES
      ? {
        sections: [Object.assign({}, section, { visualKeywords: section.imageChecklist || [], excludeUrls: excludeUrls })]
      }
      : {
        article: payload.article,
        sections: [Object.assign({}, section, { excludeUrls: excludeUrls })],
        excludeUrls: excludeUrls
      };

    const response = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error('Worker editorial resolve failed for ' + section.sectionId + ': ' + JSON.stringify(data));
    const row = (data.results && data.results[0]) || data;
    results.push(row);
    if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
    if (data.excludeUrls) excludeUrls = data.excludeUrls;
  }

  return results;
}

async function main() {
  const editorial = JSON.parse(fs.readFileSync(EDITORIAL_PATH, 'utf8'));
  const dataSrc = fs.readFileSync(DATA_PATH, 'utf8');
  const payload = buildPayload(editorial, dataSrc);

  console.log('[PIPELINE]', USE_LEGACY_PLACES ? 'legacy-places' : 'engine-rules');
  const results = await resolveAll(payload);
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  console.log('[WROTE]', OUT_JSON);

  let src = dataSrc;
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
      officialNameLocal: editorialRow.officialNameLocal,
      photoPlaceName: row.photoPlaceName || null,
      matchedKeywords: row.matchedKeywords || row.aiReview && row.aiReview.matchedElements || []
    });
    const qa = row.editorialQA || {};
    const ai = row.aiReview || {};
    console.log(
      row.sectionId,
      row.matched ? 'PASS' : 'PLACEHOLDER',
      row.imageSource || '',
      'score:' + (row.photoScore || ai.score || '-'),
      'candidates:' + (row.candidatesReviewed || '-'),
      qa.recommendation || row.rejectReason || '',
      row.photoCaption ? row.photoCaption.slice(0, 28) : '(no caption)'
    );
    src = patchSectionRow(src, row);
  }
  if (hero) {
    Object.assign(hero, editorial.hero);
    console.log(
      'hero-anime',
      hero.matched ? 'PASS' : 'PLACEHOLDER',
      hero.placeName || '',
      'score:' + (hero.photoScore || '-'),
      hero.photoCaption || ''
    );
    src = patchHeroFields(src, hero);
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
