/**
 * Phase 0 — verify Worker endpoint responses after deploy.
 */
const API = 'https://soarvibe-api.soarvibe.workers.dev';
const ORIGIN = 'https://asd22584812.github.io';

async function req(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: body != null ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: r.status, json, text: text.slice(0, 300) };
}

const disabled = [
  ['POST', '/api/editorial/resolve', { article: { articleId: 'test' }, sections: [{ sectionId: 'x', mapsQuery: 'test' }] }],
  ['POST', '/api/editorial/generate', { articleId: 'tokyo-anime' }],
  ['POST', '/api/editorial/section-copy', { article: {}, section: {}, place: {} }],
  ['POST', '/api/editorial/vision-caption', { imageBase64: 'a', mimeType: 'image/jpeg' }],
  ['POST', '/api/editorial/caption', { placeName: 'test', photoUrl: 'https://example.com/x.jpg' }],
  ['POST', '/api/places/resolve', { sections: [{ sectionId: 'x', mapsQuery: 'test' }] }]
];

const enabled = [
  ['GET', '/api/health', null],
  ['GET', '/api/maps-key', null]
];

console.log('=== Phase 0 disabled endpoints (expect 410) ===');
for (const [method, path, body] of disabled) {
  const r = await req(method, path, body);
  const ok = r.status === 410;
  console.log((ok ? 'PASS' : 'FAIL'), method, path, '→', r.status, r.json?.error || r.text.slice(0, 80));
}

console.log('\n=== Planner endpoints (expect 200) ===');
for (const [method, path, body] of enabled) {
  const r = await req(method, path, body);
  const ok = r.status === 200;
  console.log((ok ? 'PASS' : 'FAIL'), method, path, '→', r.status, r.json ? JSON.stringify(r.json).slice(0, 120) : r.text.slice(0, 80));
}

console.log('\n=== POST /api/gemini (expect 200 or 4xx with valid body, not 410) ===');
const gemini = await req('POST', '/api/gemini', {
  model: 'gemini-2.5-flash',
  contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
  generationConfig: { maxOutputTokens: 8 }
});
const geminiOk = gemini.status !== 410 && gemini.status !== 503;
console.log(geminiOk ? 'PASS' : 'FAIL', 'POST /api/gemini →', gemini.status, gemini.json?.error || (gemini.text || '').slice(0, 100));

console.log('\n=== Indirect Text Search probe (editorial resolve must not reach Google) ===');
const probe = await req('POST', '/api/editorial/resolve', {
  article: { articleId: 'probe' },
  sections: [{ sectionId: 'probe', officialName: 'MIMARU', mapsQuery: 'MIMARU TOKYO', photoIntent: '外觀' }]
});
console.log('editorial/resolve blocked at route:', probe.status === 410 ? 'YES' : 'NO', probe.json?.disabled === true ? '(disabled flag set)' : '');
