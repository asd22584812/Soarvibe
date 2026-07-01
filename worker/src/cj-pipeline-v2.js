/**
 * Editorial Pipeline v2 — generic City Journal image + caption orchestrator.
 *
 * Flow: normalize → place verify → keyword plan → candidates → AI review → caption → QA
 * Google Places = place metadata + photo candidates only.
 */
import { normalizeSection, normalizeArticle } from './cj-editorial-schema.js';
import { buildKeywordSearchPlan } from './cj-keyword-planning.js';
import { collectImageCandidates, placeDisplayName } from './cj-image-candidates.js';
import { reviewCandidates } from './cj-ai-image-review.js';
import { generateAICaption } from './cj-ai-caption.js';
import { runEditorialQAV2 } from './cj-editorial-qa-v2.js';
import { resolveOfficialPlace } from './cj-place-resolve.js';

function placeIdFromResource(id) {
  return String(id || '').replace(/^places\//, '').trim();
}

export async function resolveSectionV2(mapsKey, env, item, articleCtx, deps) {
  var section = normalizeSection(item, articleCtx);
  var sectionId = String(section.sectionId || '').trim();
  var subject = String(section.subject || section.title || '').trim();
  var mapsQuery = String(section.mapsQuery || '').trim();

  if (!sectionId) {
    return { sectionId: sectionId, error: 'missing_section_id' };
  }

  var pipelineLog = {
    version: 'v2',
    steps: []
  };

  try {
    pipelineLog.steps.push('place_verify');
    var resolved = await resolveOfficialPlace(mapsKey, section, {
      getGooglePlaceById: deps.getGooglePlaceById,
      searchGooglePlace: deps.searchGooglePlace
    });

    if (!resolved || !resolved.place) {
      return failedRow(sectionId, subject, mapsQuery, 'no_valid_place', pipelineLog);
    }

    var place = resolved.place;
    var placeMeta = {
      placeId: placeIdFromResource(place.id || place.name),
      placeName: placeDisplayName(place),
      googleRating: place.rating != null ? place.rating : null,
      googleAddress: place.formattedAddress || null,
      searchUsed: resolved.searchUsed || null
    };

    pipelineLog.steps.push('keyword_planning');
    var keywordPlan = buildKeywordSearchPlan(section, { maxQueries: 5 });

    pipelineLog.steps.push('collect_candidates');
    var candidates = await collectImageCandidates(mapsKey, {
      resolveGooglePhotoUri: deps.resolveGooglePhotoUri,
      searchGooglePlace: deps.searchGooglePlace,
      keywordPlan: keywordPlan,
      excludeUrls: section.excludeUrls || []
    }, section, {
      maxCandidates: section.maxCandidates || 12,
      maxPhotosPerPlace: 5
    });

    pipelineLog.candidateCount = candidates.length;

    if (!candidates.length) {
      return Object.assign(failedRow(sectionId, subject, mapsQuery, 'no_candidates', pipelineLog), placeMeta);
    }

    pipelineLog.steps.push('ai_image_review');
    var reviewResult = await reviewCandidates(
      candidates,
      section,
      articleCtx,
      env,
      {
        maxReview: section.maxAIReview || 5,
        minPassScore: section.minPassScore || 70
      }
    );

    pipelineLog.reviewCount = reviewResult.reviewCount;
    pipelineLog.selectedCandidateId = reviewResult.selected ? reviewResult.selected.candidateId : null;

    var selected = reviewResult.selected;
    if (!selected) {
      return Object.assign(failedRow(sectionId, subject, mapsQuery, 'ai_review_no_pass', pipelineLog), placeMeta, {
        candidatesReviewed: reviewResult.reviewCount,
        reviewSummaries: reviewResult.reviewed.map(function (r) {
          return {
            candidateId: r.candidateId,
            sourcePlaceName: r.sourcePlaceName,
            pass: r.aiReview && r.aiReview.pass,
            score: r.aiReview && r.aiReview.score,
            error: r.aiReview && r.aiReview.error,
            raw: r.aiReview && r.aiReview.raw,
            matchedElements: r.aiReview && r.aiReview.matchedElements,
            visibleDescription: r.aiReview && r.aiReview.visibleDescription
          };
        }),
        editorialQA: {
          pass: false,
          issues: ['ai_review_no_pass'],
          usePlaceholder: true,
          recommendation: 'use_placeholder'
        }
      });
    }

    pipelineLog.steps.push('caption_generation');
    var caption = await generateAICaption(section, selected, articleCtx, env);
    if (!caption) {
      return Object.assign(failedRow(sectionId, subject, mapsQuery, 'no_caption', pipelineLog), placeMeta, {
        editorialQA: {
          pass: false,
          issues: ['no_caption'],
          usePlaceholder: true
        }
      });
    }

    pipelineLog.steps.push('editorial_qa');
    var qa = await runEditorialQAV2(section, selected, caption, placeMeta, env);

    if (qa.usePlaceholder) {
      return Object.assign(failedRow(sectionId, subject, mapsQuery, qa.recommendation || 'qa_failed', pipelineLog), placeMeta, {
        photoCaption: caption,
        editorialQA: qa,
        aiReview: selected.aiReview,
        candidatesReviewed: reviewResult.reviewCount
      });
    }

    return {
      sectionId: sectionId,
      subject: subject,
      mapsQuery: mapsQuery,
      placeId: placeMeta.placeId,
      googleRating: placeMeta.googleRating,
      googleAddress: placeMeta.googleAddress,
      googlePhotoUrl: selected.imageUrl,
      googleAttribution: selected.attribution,
      imageSource: 'editorial_ai',
      matched: true,
      placeName: placeMeta.placeName,
      photoPlaceName: selected.sourcePlaceName || placeMeta.placeName,
      photoCaption: caption,
      photoIndex: selected.photoIndex,
      photoScore: selected.aiReview.score,
      matchedKeywords: selected.aiReview.matchedElements || [],
      photoSearchUsed: selected.searchQuery || null,
      searchUsed: placeMeta.searchUsed,
      sectionType: section.sectionType || null,
      role: section.role || null,
      rejectReason: null,
      editorialQA: qa,
      aiReview: {
        pass: selected.aiReview.pass,
        score: selected.aiReview.score,
        matchedElements: selected.aiReview.matchedElements,
        visibleDescription: selected.aiReview.visibleDescription,
        priorityTier: selected.aiReview.priorityTier,
        photoType: selected.aiReview.photoType
      },
      pipeline: pipelineLog,
      candidatesReviewed: reviewResult.reviewCount,
      candidateCount: candidates.length
    };
  } catch (err) {
    return Object.assign(failedRow(sectionId, subject, mapsQuery, String(err.message || err), pipelineLog), {
      error: String(err.message || err)
    });
  }
}

function failedRow(sectionId, subject, mapsQuery, reason, pipelineLog) {
  return {
    sectionId: sectionId,
    subject: subject,
    mapsQuery: mapsQuery,
    placeId: null,
    googleRating: null,
    googleAddress: null,
    googlePhotoUrl: null,
    googleAttribution: null,
    imageSource: null,
    matched: false,
    rejectReason: reason,
    pipeline: pipelineLog,
    editorialQA: {
      pass: false,
      issues: [reason],
      usePlaceholder: true
    }
  };
}

export async function resolveArticleV2(mapsKey, env, payload, deps) {
  var articleCtx = normalizeArticle(payload.article || payload);
  var sections = Array.isArray(payload.sections) ? payload.sections : [];
  var results = [];
  var excludeUrls = Array.isArray(payload.excludeUrls) ? payload.excludeUrls.slice() : [];

  for (var i = 0; i < sections.length; i++) {
    var item = Object.assign({}, sections[i], { excludeUrls: excludeUrls });
    var row = await resolveSectionV2(mapsKey, env, item, articleCtx, deps);
    results.push(row);
    if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
  }

  return { results: results, excludeUrls: excludeUrls, pipelineVersion: 'v2' };
}
