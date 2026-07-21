const API = 'https://soarvibe-api.soarvibe.workers.dev';
const ORIGIN = 'https://asd22584812.github.io';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function resolve(section) {
  for (let i = 0; i < 6; i++) {
    try {
      await sleep(12000);
      const r = await fetch(API + '/api/editorial/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({
          article: { articleId: 'tokyo-anime', articleTheme: 'July anime' },
          sections: [section]
        })
      });
      const text = await r.text();
      if (text.startsWith('<!')) throw new Error('HTML');
      const row = JSON.parse(text).results[0];
      if (row.matched && row.googlePhotoUrl) return row;
      console.log(section.sectionId, 'try', i, row.rejectReason || 'no url');
    } catch (e) {
      console.warn(section.sectionId, 'err', e.message);
    }
  }
  return null;
}

async function main() {
  const hotel = await resolve({
    sectionId: 'hotel-gracery', sectionRole: 'hotel', sectionType: 'hotel',
    officialName: 'MIMARU TOKYO UENO EAST', officialNameLocal: 'MIMARU東京 上野イースト',
    mapsQuery: 'MIMARU TOKYO UENO EAST', photoIntent: '外觀', imageChecklist: ['MIMARU', '外観']
  });
  const cafe = await resolve({
    sectionId: 'maid-cafe', sectionRole: 'cafe', sectionType: 'cafe',
    officialName: '@home cafe Akihabara', officialNameLocal: 'アットホームカフェ 秋葉原店',
    mapsQuery: 'アットホームカフェ 秋葉原店', photoIntent: '外觀', imageChecklist: ['アットホーム', '外観']
  });
  console.log('\nHOTEL', hotel && hotel.googlePhotoUrl, hotel && hotel.googleAttribution);
  console.log('CAFE', cafe && cafe.googlePhotoUrl, cafe && cafe.googleAttribution);
  if (hotel) console.log(JSON.stringify({ hotel }, null, 2));
  if (cafe) console.log(JSON.stringify({ cafe }, null, 2));
}

main();
