#!/usr/bin/env node
/**
 * Download verified city share images listed in verified-manifest.json.
 * Respects Wikimedia rate limits (delay between requests).
 *
 * Usage: node scripts/fetch-city-shares-verified-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets/city-shares/tokyo/verified-manifest.json');
const OUT_DIR = path.join(ROOT, 'assets/city-shares/tokyo');
const DELAY_MS = 3500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SoarVibe-CityShares/1.0 (Phase 1A.5; local dev)' }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000 || buf.slice(0, 15).toString('utf8').includes('<!DOCTYPE')) {
    throw new Error(`Invalid image payload (${buf.length} bytes) for ${url}`);
  }
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Missing manifest:', MANIFEST);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const pkg of manifest.packages || []) {
    if (pkg.status !== 'verified') {
      console.log('SKIP package (not verified):', pkg.postId, '-', pkg.blocker || pkg.status);
      skip++;
      continue;
    }
    for (const asset of pkg.assets || []) {
      const dest = path.join(OUT_DIR, asset.localFile);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
        console.log('EXISTS', asset.localFile);
        ok++;
        continue;
      }
      process.stdout.write(`GET  ${asset.localFile} ... `);
      try {
        const bytes = await download(asset.downloadUrl, dest);
        console.log(`${(bytes / 1024).toFixed(0)} KB`);
        ok++;
      } catch (e) {
        console.log('FAIL');
        console.error('  ', e.message);
        fail++;
      }
      await sleep(DELAY_MS);
    }
  }

  console.log('\nSummary:', { ok, skip, fail });
  process.exit(fail > 0 ? 1 : 0);
}

main();
