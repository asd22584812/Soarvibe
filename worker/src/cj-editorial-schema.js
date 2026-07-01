/**
 * Re-exports SoarVibe Editorial Engine for backward compatibility.
 */
export {
  SECTION_ROLES,
  READING_RHYTHM,
  PHOTO_PRIORITY_BY_ROLE as PHOTO_PRIORITY_BY_PURPOSE,
  METADATA_BY_ROLE,
  METADATA_LABELS,
  resolveSectionRole,
  resolveSectionRole as resolveSectionPurpose,
  resolvePhotoPriority,
  normalizeSection,
  normalizeArticle,
  buildSearchKeywords,
  matchTerms,
  buildMetadataCapsule,
  runEngineQA
} from './cj-editorial-engine.js';
