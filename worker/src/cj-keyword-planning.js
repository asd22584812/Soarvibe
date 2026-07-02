/**
 * Keyword Planning — expand multilingual search queries from section config.
 */
import { buildSearchKeywords } from './cj-editorial-schema.js';
import { buildLocaleSearchQueries, assignQueryLang, resolveCountryCode } from './cj-locale-search.js';

export function buildKeywordSearchPlan(section, options) {
  var keywords = buildSearchKeywords(section);
  var articleCtx = (options && options.articleCtx) || null;
  var countryCode = resolveCountryCode(articleCtx, section);
  var localePlan = buildLocaleSearchQueries(section, articleCtx, {
    maxQueries: (options && options.maxQueries) || 12,
    extraQueries: keywords.map(function (kw) {
      return { query: kw, lang: assignQueryLang(kw, countryCode), source: 'derivedKeywords' };
    })
  });

  return {
    keywords: keywords,
    queries: localePlan.queries,
    countryCode: localePlan.countryCode,
    regionCode: localePlan.regionCode
  };
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
