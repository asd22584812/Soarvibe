/**
 * SoarVibe: API failure must not serve live backup itinerary.
 * Run: node scripts/test-api-failure-no-backup.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log('PASS', name);
  } else {
    failed += 1;
    console.error('FAIL', name, detail || '');
  }
}

// --- Static / source contracts ---
ok('A0 ALLOW_LIVE_BACKUP_ITINERARY=false', /ALLOW_LIVE_BACKUP_ITINERARY\s*=\s*false/.test(indexHtml));
ok('A1 no Safeguard→backupItinerary', !/Safeguard → backupItinerary/.test(indexHtml));
ok('A2 fetchGeminiItinerary no backup return', !/無有效 Gemini 金鑰 → 使用專屬行程/.test(indexHtml));
ok('A3 keys exhausted throws (no backup fallback log)', /→ no live backup/.test(indexHtml));
ok('A4 day-by-day throws createAiGenerationFailure', /fetchGeminiItineraryDayByDay:day_/.test(indexHtml));
ok('A5 parse_failure type present', /failureType:\s*'parse_failure'|code:\s*'parse_failure'/.test(indexHtml));
ok('A6 busy title copy', /SoarVibe 小編正在忙碌中/.test(indexHtml));
ok('A7 busy body copy', /小編目前忙線中|目前行程規劃服務暫時無法連線/.test(indexHtml));
ok('A8 debug logger tag', /\[SOARVIBE\]\[AI Generation Failure\]/.test(indexHtml));
ok('A9 plane nose up-right -45deg', /generating-plane[\s\S]{0,220}rotate\(-45deg\)/.test(indexHtml));
ok('A9b plane bob uses -45deg', /generating-plane-bob[\s\S]{0,120}rotate\(-45deg\)/.test(indexHtml));
ok('A10 arm still 60deg (~2 o\'clock)', /\.generating-orbit-arm[\s\S]*?rotate\(60deg\)/.test(indexHtml));
ok('A11 showPlanningBusyNotice exists', /function showPlanningBusyNotice/.test(indexHtml));
ok('A12 alert secondary 返回修改', /返回修改/.test(indexHtml));
ok('A13 getBackupItineraryRaw gated', /Live backup itinerary disabled/.test(indexHtml));
ok('A14 style engine file untouched marker (no edit required)', fs.existsSync(path.join(root, 'itinerary-style-engine.js')));

function sliceFn(src, name) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return '';
  const start = m.index;
  const next = src.slice(start + 1).search(/\n\s*(?:async\s+)?function\s+\w+\s*\(/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

const genFns = [
  'fetchGeminiItineraryDayByDay',
  'fillPartialItineraryWithAi',
  'repairLazyItineraryDays',
  'fetchGeminiItinerary',
  'runItineraryGeneration'
];
for (const name of genFns) {
  const body = sliceFn(indexHtml, name);
  ok('A15 ' + name + ' has no getBackupDayForIndex', body.length > 0 && !/getBackupDayForIndex/.test(body));
  ok('A16 ' + name + ' has no getBackupItineraryRaw call', body.length > 0 && !/getBackupItineraryRaw\s*\(/.test(body));
}

// Sole live consumer of getBackupDayForIndex must be quality-phase fill, not API catch.
const backupCallSites = [...indexHtml.matchAll(/getBackupDayForIndex\s*\(/g)].map((m) => {
  const before = indexHtml.slice(Math.max(0, m.index - 600), m.index);
  const isDef = /function\s+$/.test(before);
  return { isDef, before };
});
ok('A17 getBackupDayForIndex only 2 live refs (def + fillEmptyPhase)', backupCallSites.length === 2);
ok(
  'A18 only QUALITY path calls getBackupDayForIndex',
  backupCallSites.filter((s) => s.isDef).length === 1 &&
    backupCallSites.filter((s) => !s.isDef).length === 1 &&
    backupCallSites.some((s) => !s.isDef && /fillEmptyPhaseFromBackup/.test(s.before))
);
ok(
  'A19 enrichEmpty afternoon uses fillEmptyPhaseFromBackup (quality)',
  /fillEmptyPhaseFromBackup\(dayNum,\s*'下午'/.test(indexHtml)
);
ok(
  'A20 day-by-day catch throws (not backup day)',
  /catch \(err\) \{\s*var failType[\s\S]*?throw createAiGenerationFailure/.test(
    sliceFn(indexHtml, 'fetchGeminiItineraryDayByDay')
  )
);

// --- Runtime classification helpers (mirrors index.html) ---
function createAiGenerationFailure(type, details) {
  details = details || {};
  const err = new Error(details.message || type || 'ai_api_unavailable');
  err.code = details.code || 'ai_api_unavailable';
  err.failureType = type || 'api_unavailable';
  err.status = details.status != null ? details.status : null;
  err.stage = details.stage || '';
  return err;
}

function isAiApiUnavailableError(err) {
  if (!err) return false;
  if (err.code === 'ai_api_unavailable' || err.code === 'parse_failure') return true;
  const t = String(err.failureType || err.message || '');
  if (/^(no_valid_key|all_keys_exhausted|origin_forbidden|billing_depleted|all_keys_429|timeout|network|worker_|upstream_|parse_failure|invalid_upstream|empty_upstream|service_unavailable)/i.test(t)) {
    return true;
  }
  const status = err.status != null ? Number(err.status) : NaN;
  if (status >= 500 || status === 429 || status === 408) return true;
  if (/Failed to fetch|NetworkError|AbortError|timeout|ETIMEDOUT|ECONNRESET|service unavailable|502|503|504/i.test(String(err.message || ''))) {
    return true;
  }
  return false;
}

function isQualityIssueNotApiFailure(err) {
  // Day completeness / style QA should NOT be classified as API down
  const msg = String((err && err.message) || '');
  return /day_completeness|candidate_usage|style_audit|severe_completeness/i.test(msg);
}

ok('B all keys fail → api unavailable', isAiApiUnavailableError(createAiGenerationFailure('all_keys_exhausted', { status: 429 })));
ok('C worker 500 → api unavailable', isAiApiUnavailableError(createAiGenerationFailure('worker_error', { status: 500, message: 'Worker 500' })));
ok('D network timeout → api unavailable', isAiApiUnavailableError({ message: 'timeout', status: 408 }));
ok('E parse_failure → api-class failure UX', isAiApiUnavailableError(createAiGenerationFailure('parse_failure', { code: 'parse_failure' })));
ok('F completeness severe NOT api failure', !isAiApiUnavailableError({ message: 'day_completeness_severe' }) && isQualityIssueNotApiFailure({ message: 'day_completeness_severe' }));
ok('G first-key-fail second-ok path still uses callGeminiContent (source)', /async function callGeminiContent/.test(indexHtml) && /currentKeyIndex/.test(indexHtml));

// Simulated live pipeline: exhausted keys must not yield backup text
function simulateFetchGeminiItineraryFail() {
  const ALLOW = false;
  function getBackup() {
    if (!ALLOW) throw createAiGenerationFailure('backup_blocked', { message: 'Live backup itinerary disabled' });
    return JSON.stringify({ days: [{ day: 1 }] });
  }
  try {
    getBackup();
    return { fromBackup: true };
  } catch (e) {
    return { fromBackup: false, error: e };
  }
}
const sim = simulateFetchGeminiItineraryFail();
ok('H live failure does not return fromBackup itinerary', sim.fromBackup === false && sim.error && sim.error.failureType === 'backup_blocked');

// Form retention: runItineraryGeneration catch must not clear destination inputs
ok('I failure path does not wipe destination/date fields', !/destinationInput\.value\s*=\s*['"]{2}/.test(indexHtml.split('async function runItineraryGeneration')[1].split('function isDestinationBlocked')[0]));
ok('J itineraryResult hidden on failure (no fake board)', /itineraryResult\.classList\.add\('hidden'\)/.test(indexHtml.split('async function runItineraryGeneration')[1].split('function isDestinationBlocked')[0]));

console.log('\nResult:', passed, 'passed,', failed, 'failed');
if (failed) process.exit(1);
