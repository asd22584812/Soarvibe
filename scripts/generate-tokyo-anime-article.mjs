/**
 * Generate Tokyo anime City Journal via Gemini, then fetch Google Places photos.
 *
 * Usage:
 *   node scripts/generate-tokyo-anime-article.mjs
 *   node scripts/generate-tokyo-anime-article.mjs --skip-fetch
 *   node scripts/generate-tokyo-anime-article.mjs --skip-generate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EDITORIAL_PATH = path.join(ROOT, 'editorial', 'tokyo-anime-editorial.json');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const API_BASE = String(process.env.SOARVIBE_API_BASE || 'https://soarvibe-api.soarvibe.workers.dev').replace(/\/$/, '');
const ORIGIN = String(process.env.SOARVIBE_ORIGIN || 'https://asd22584812.github.io');

const args = process.argv.slice(2);
const skipFetch = args.includes('--skip-fetch');
const skipGenerate = args.includes('--skip-generate');

function jsString(value) {
  if (value == null) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    return '[' + value.map(function (v) { return jsString(v); }).join(', ') + ']';
  }
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function patchArticleTopLevel(src, article) {
  const fields = {
    title: article.title,
    subtitle: article.subtitle,
    intro: article.intro,
    outro: article.outro,
    issueLabel: article.issueLabel,
    articleTheme: article.articleTheme,
    editorialAngle: article.editorialAngle,
    readerPersona: article.readerPersona,
    travelStyle: article.travelStyle,
    emotion: article.emotion,
    articleGoal: article.articleGoal
  };
  let out = src;
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    const re = new RegExp('(\\n\\s*' + key + ':\\s*)(\'(?:\\\\.|[^\'])*\'|null)(,)?');
    if (!re.test(out)) continue;
    out = out.replace(re, function (_m, prefix, _old, suffix) {
      return prefix + jsString(value) + (suffix || ',');
    });
  }
  if (article.editorialPlan) {
    const plan = article.editorialPlan;
    for (const pk of ['theme', 'storyArc', 'readingRhythm']) {
      if (!plan[pk]) continue;
      const re = new RegExp('(editorialPlan:\\s*\\{[^}]*' + pk + ':\\s*)(\'(?:\\\\.|[^\'])*\')');
      out = out.replace(re, '$1' + jsString(plan[pk]));
    }
  }
  return out;
}

function patchSectionCopy(src, section) {
  const marker = "sectionId: '" + section.sectionId + "'";
  const start = src.indexOf(marker);
  if (start === -1) return src;
  const blockEnd = src.indexOf('},', start);
  if (blockEnd === -1) return src;
  let block = src.slice(start, blockEnd);
  const replacements = {
    heading: section.heading,
    content: section.content,
    subject: section.subject || section.title,
    officialName: section.officialName,
    officialNameLocal: section.officialNameLocal,
    mapsQuery: section.mapsQuery,
    photoIntent: section.photoIntent,
    aliases: section.aliases,
    imageChecklist: section.imageChecklist,
    imageRejectRules: section.imageRejectRules
  };
  for (const [key, value] of Object.entries(replacements)) {
    if (value == null) continue;
    const val = (Array.isArray(value)) ? jsString(value) : jsString(value);
    const re = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\'|\\[[^\\]]*\\])(,)?');
    if (!re.test(block)) continue;
    block = block.replace(re, function (_m, prefix, _old, suffix) {
      return prefix + val + (suffix || ',');
    });
  }
  if (Array.isArray(section.editorialMeta) && section.editorialMeta.length) {
    const metaStr = 'editorialMeta: ' + jsString(section.editorialMeta).replace(/'/g, "'").replace(/'(\{)/g, '{').replace(/(\})'/g, '}');
    // build editorialMeta manually as JS object array
    const metaJs = 'editorialMeta: [\n' + section.editorialMeta.map(function (m) {
      return '                            { icon: ' + jsString(m.icon) + ', label: ' + jsString(m.label) + ', value: ' + jsString(m.value) + ' }';
    }).join(',\n') + '\n                        ]';
    const metaRe = /editorialMeta:\s*\[[\s\S]*?\]/;
    if (metaRe.test(block)) block = block.replace(metaRe, metaJs);
  }
  return src.slice(0, start) + block + src.slice(blockEnd);
}

function metaToEditorialMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  return [
    { icon: '⭐', label: '推薦程度', value: meta.recommendation },
    { icon: '⏱', label: '建議停留', value: meta.stayDuration },
    { icon: '🚉', label: '最近車站', value: meta.nearestStation },
    { icon: '💰', label: '價格區間', value: meta.priceRange },
    { icon: '🕐', label: '最佳時段', value: meta.bestTime }
  ].filter(function (m) { return m.value; });
}

const ROTATING_IDS = ['ichiran', 'maid-cafe', 'hotel-gracery'];

function mergeEditorialWithArticle(existing, article) {
  const existingById = {};
  (existing.sections || []).forEach(function (s) {
    if (s && s.sectionId) existingById[s.sectionId] = s;
  });
  const sections = (article.sections || []).map(function (gen) {
    const photo = existingById[gen.sectionId] || {};
    const rotating = ROTATING_IDS.indexOf(gen.sectionId) !== -1;
    const base = Object.assign({}, photo, {
      sectionId: gen.sectionId,
      heading: gen.heading,
      content: gen.content,
      title: gen.heading || photo.title,
      officialName: gen.officialName || photo.officialName,
      officialNameLocal: gen.officialNameLocal || photo.officialNameLocal,
      mapsQuery: gen.mapsQuery || photo.mapsQuery,
      venueAlternatives: rotating ? [] : ((gen.venueAlternatives && gen.venueAlternatives.length)
        ? gen.venueAlternatives
        : (photo.venueAlternatives || []))
    });
    if (rotating) {
      base.placeId = null;
      base.googlePhotoUrl = null;
      base.googleAttribution = null;
      base.caption = null;
      base.allowVenueSwap = true;
      base.aliases = [gen.officialName, gen.officialNameLocal].filter(Boolean);
      base.photoAnchorTerms = [gen.officialNameLocal, gen.officialName].filter(Boolean);
      base.photoPlaceQueries = [
        ((gen.officialNameLocal || gen.officialName) + ' 外観'),
        ((gen.officialName || '') + ' exterior'),
        gen.mapsQuery
      ].filter(Boolean);
    }
    return base;
  });
  return Object.assign({}, existing, {
    sections: sections,
    issueLabel: article.issueLabel || existing.issueLabel
  });
}

function enrichArticleForData(article) {
  return Object.assign({}, article, {
    sections: (article.sections || []).map(function (s) {
      const editorialMeta = s.editorialMeta || metaToEditorialMeta(s.meta);
      return Object.assign({}, s, { editorialMeta: editorialMeta });
    })
  });
}

function buildEditorialJson(existing, article) {
  if (existing && existing.articleId) {
    return mergeEditorialWithArticle(existing, article);
  }
  const hero = Object.assign({
    sectionId: 'hero-anime',
    sectionRole: 'opening',
    subjectType: 'district',
    isSpecificVenue: false,
    sectionType: 'landmark'
  }, article.hero || {});

  const sections = (article.sections || []).map(function (s) {
    return Object.assign({
      allowVenueSwap: true,
      allowGenericPhotoFallback: false,
      isSpecificVenue: true
    }, s);
  });

  return {
    articleId: 'tokyo-anime',
    articleTheme: article.articleTheme,
    editorialAngle: article.editorialAngle,
    readerPersona: article.readerPersona,
    travelStyle: article.travelStyle,
    emotion: article.emotion,
    articleGoal: article.articleGoal,
    targetReader: article.readerPersona,
    storyline: article.storyline,
    readingRhythm: ['opening', 'explore', 'experience', 'food', 'shopping', 'stay', 'ending'],
    editorialPlan: article.editorialPlan || {
      theme: article.articleTheme,
      storyArc: article.storyline,
      readingRhythm: '上午電氣街 → 午後中野 → 傍晚扭蛋與補給 → 夜宿交通樞紐'
    },
    destination: { countryCode: 'JP', label: '東京' },
    hero: hero,
    sections: sections
  };
}

async function generateArticle(existingEditorial) {
  console.log('[GENERATE] Calling', API_BASE + '/api/editorial/generate');
  const response = await fetch(API_BASE + '/api/editorial/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      month: '7',
      year: '2026',
      styleKey: 'anime',
      existingEditorial: existingEditorial || null
    })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error('Editorial generate failed: ' + JSON.stringify(data));
  }
  if (data._meta && data._meta.salvaged) {
    console.log('[GENERATE] JSON was salvaged from truncated Gemini response');
  }
  delete data._meta;
  return data;
}

async function main() {
  let existingEditorial = null;
  if (fs.existsSync(EDITORIAL_PATH)) {
    existingEditorial = JSON.parse(fs.readFileSync(EDITORIAL_PATH, 'utf8'));
  }

  let article;
  if (!skipGenerate) {
    article = await generateArticle(existingEditorial);
    console.log('[GENERATE] Title:', article.title);
    const editorial = buildEditorialJson(existingEditorial, article);
    fs.writeFileSync(EDITORIAL_PATH, JSON.stringify(editorial, null, 2) + '\n', 'utf8');
    console.log('[WROTE]', EDITORIAL_PATH);

    const articleForData = enrichArticleForData(article);
    let dataSrc = fs.readFileSync(DATA_PATH, 'utf8');
    dataSrc = patchArticleTopLevel(dataSrc, articleForData);
    for (const section of articleForData.sections || []) {
      dataSrc = patchSectionCopy(dataSrc, section);
    }
    fs.writeFileSync(DATA_PATH, dataSrc, 'utf8');
    console.log('[PATCHED]', DATA_PATH, '(copy from Gemini)');
  }

  if (!skipFetch) {
    console.log('[FETCH] Running Google Places pipeline...');
    const result = spawnSync(process.execPath, ['scripts/fetch-tokyo-anime-google-places.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: Object.assign({}, process.env, { SOARVIBE_API_BASE: API_BASE, SOARVIBE_ORIGIN: ORIGIN })
    });
    if (result.status !== 0) process.exit(result.status || 1);
  }

  console.log('[DONE] Regenerate complete. Hard-refresh index.html (Ctrl+Shift+R).');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
