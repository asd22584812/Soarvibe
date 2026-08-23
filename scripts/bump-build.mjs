/**
 * UTF-8 safe BUILD/SW bump — never use PowerShell Set-Content on index.html.
 * Usage: node scripts/bump-build.mjs v157
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const build = String(process.argv[2] || '').trim();
if (!/^v\d+$/.test(build)) {
  console.error('Usage: node scripts/bump-build.mjs v157');
  process.exit(1);
}

function readUtf8(p) {
  return fs.readFileSync(p);
}
function writeUtf8(p, text) {
  fs.writeFileSync(p, text, { encoding: 'utf8' });
}

const indexPath = path.join(root, 'index.html');
const swPath = path.join(root, 'service-worker.js');

let indexBuf = readUtf8(indexPath);
let index = indexBuf.toString('utf8');
if ((index.match(/\uFFFD/g) || []).length > 0) {
  throw new Error('index.html already has UTF-8 replacement chars — abort');
}
if ((index.match(/\?{8,}/g) || []).length > 20) {
  throw new Error('index.html has suspicious ????? runs — abort');
}
if (!/[\u4e00-\u9fff]/.test(index)) {
  throw new Error('index.html missing Chinese — abort');
}

const prevBuild = (index.match(/SOARVIBE_APP_BUILD\s*=\s*'([^']+)'/) || [])[1];
index = index.replace(
  /const SOARVIBE_APP_BUILD = 'v\d+'/,
  "const SOARVIBE_APP_BUILD = '" + build + "'"
);

// Bump common asset query strings that already use ?v=vNNN
index = index.replace(/\?v=v\d+/g, '?v=' + build);

writeUtf8(indexPath, index);

let sw = readUtf8(swPath).toString('utf8');
sw = sw.replace(/const CACHE_NAME = 'soarvibe-v\d+'/, "const CACHE_NAME = 'soarvibe-" + build + "'");
if (!sw.includes("city-shares-image.js")) {
  sw = sw.replace(
    "./city-shares-firestore.js",
    "./city-shares-firestore.js',\n  './city-shares-image.js"
  );
}
writeUtf8(swPath, sw);

const verify = fs.readFileSync(indexPath, 'utf8');
const report = {
  from: prevBuild,
  to: build,
  chineseCount: (verify.match(/[\u4e00-\u9fff]/g) || []).length,
  qRuns: (verify.match(/\?{8,}/g) || []).length,
  fffd: (verify.match(/\uFFFD/g) || []).length,
  buildOk: verify.includes("SOARVIBE_APP_BUILD = '" + build + "'"),
  sw: (fs.readFileSync(swPath, 'utf8').match(/CACHE_NAME = '([^']+)'/) || [])[1],
  tagline: (verify.match(/soarvibe-splash-tagline">([^<]+)<\/p>/) || [])[1] || null
};
console.log(JSON.stringify(report, null, 2));
if (!report.buildOk || report.qRuns || report.fffd || !report.chineseCount) {
  process.exit(1);
}
