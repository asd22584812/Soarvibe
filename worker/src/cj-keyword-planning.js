/**
 * Keyword Planning — expand multilingual search queries from section config.
 */
import { buildSearchKeywords } from './cj-editorial-schema.js';

export function buildKeywordSearchPlan(section, options) {
  var keywords = buildSearchKeywords(section);
  var maxQueries = (options && options.maxQueries) || 12;
  var seen = {};
  var queries = [];

  function pushQuery(q, lang) {
    var s = String(q || '').trim();
    if (!s || s.length < 2 || seen[s.toLowerCase()]) return;
    seen[s.toLowerCase()] = true;
    queries.push({ query: s, lang: lang || detectLang(s) });
  }

  (section.searchKeywords || []).forEach(function (kw) {
    pushQuery(kw, detectLang(kw));
  });

  keywords.forEach(function (kw) {
    pushQuery(kw, detectLang(kw));
  });

  if (section.mapsQuery) {
    pushQuery(section.mapsQuery, 'en');
  }

  return {
    keywords: keywords,
    queries: queries.slice(0, maxQueries)
  };
}

function detectLang(text) {
  if (/[\u3040-\u30ff]/.test(text)) return 'ja';
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-TW';
  return 'en';
}

export function buildImageReviewPromptContext(section, articleCtx) {
  var priority = section.photoPriority || {};
  return {
    sectionId: section.sectionId,
    title: section.title || section.subject,
    sectionPurpose: section.sectionPurpose,
    editorialAngle: section.editorialAngle || '',
    photoIntent: section.photoIntent || '',
    photoPriority: priority,
    imageChecklist: section.imageChecklist || [],
    imageRejectRules: section.imageRejectRules || [],
    minChecklistHits: section.minChecklistHits || 3,
    bodyExcerpt: section.content ? String(section.content).slice(0, 280) : '',
    articleTheme: articleCtx.articleTheme || '',
    targetReader: articleCtx.targetReader || '',
    captionIntent: section.captionIntent || ''
  };
}
