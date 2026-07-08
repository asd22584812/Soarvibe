/**
 * Download Google photo and caption via Worker vision (base64 upload).
 */
const API_BASE = String(process.env.SOARVIBE_API_BASE || 'https://soarvibe-api.soarvibe.workers.dev').replace(/\/$/, '');
const ORIGIN = String(process.env.SOARVIBE_ORIGIN || 'https://asd22584812.github.io');

async function fetchImageBase64(imageUrl) {
  const res = await fetch(imageUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'image/jpeg,image/png,image/webp,image/*,*/*',
      Referer: 'https://www.google.com/',
      'User-Agent': 'Mozilla/5.0 (compatible; SoarVibe-Editorial/1.0)'
    }
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 4 * 1024 * 1024) return null;
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  return { mime, data: buf.toString('base64') };
}

async function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

export async function visionCaptionViaWorker(imageUrl, ctx, section) {
  if (!imageUrl) return null;
  const inline = await fetchImageBase64(imageUrl);
  if (!inline) {
    console.warn('[VISION] image fetch failed');
    return null;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2000 * attempt);
    const response = await fetch(API_BASE + '/api/editorial/vision-caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({
        imageBase64: inline.data,
        mimeType: inline.mime,
        placeName: ctx.placeName,
        section: Object.assign({}, section || {}, {
          heading: ctx.heading,
          subject: ctx.subject,
          officialName: ctx.officialName,
          officialNameLocal: ctx.officialNameLocal
        })
      })
    });
    const data = await response.json();
    if (response.ok && data.caption) return String(data.caption).trim();
    if (data.error === 'vision_failed' || data.error === 'gemini_failed') continue;
  }
  return null;
}
