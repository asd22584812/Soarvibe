const API = 'https://soarvibe-api.soarvibe.workers.dev';
const ORIGIN = 'https://asd22584812.github.io';

const probes = [
  {
    sectionId: 'ichiran',
    sectionRole: 'food',
    sectionType: 'food',
    officialName: 'AFURI Ebisu',
    officialNameLocal: 'AFURI 恵比寿',
    mapsQuery: 'AFURI 恵比寿 Tokyo',
    photoPlaceQueries: ['AFURI 恵比寿', '阿夫利 恵比寿', 'AFURI Ebisu ramen'],
    photoIntent: '店門口、招牌、外觀',
    imageChecklist: ['AFURI', '阿夫利', '外観', 'ラーメン']
  },
  {
    sectionId: 'maid-cafe',
    sectionRole: 'cafe',
    sectionType: 'cafe',
    officialName: '@home cafe Akihabara',
    officialNameLocal: '@home cafe 秋葉原店',
    mapsQuery: '@home cafe 秋葉原',
    photoPlaceQueries: ['@home cafe 秋葉原 外観', '@home cafe Akihabara exterior', 'アットホームカフェ 秋葉原'],
    photoIntent: '店門口、招牌、外觀優先',
    imageChecklist: ['@home', 'home cafe', '外観', 'メイド']
  },
  {
    sectionId: 'hotel-gracery',
    sectionRole: 'hotel',
    sectionType: 'hotel',
    officialName: 'NOHGA HOTEL UENO TOKYO',
    officialNameLocal: 'ノーガホテル上野',
    mapsQuery: 'NOHGA HOTEL UENO TOKYO',
    photoPlaceQueries: ['NOHGA HOTEL UENO TOKYO 外観', 'ノーガホテル上野 外観'],
    photoIntent: '飯店外觀、建築入口',
    imageChecklist: ['NOHGA', 'ノーガ', '外観', 'facade', 'entrance']
  }
];

async function resolve(section) {
  const r = await fetch(API + '/api/editorial/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      article: { articleId: 'tokyo-anime', articleTheme: 'July anime' },
      sections: [section]
    })
  });
  const j = await r.json();
  return (j.results && j.results[0]) || j;
}

async function main() {
  for (const s of probes) {
    const row = await resolve(s);
    console.log('\n##' + s.sectionId);
    console.log('matched:', row.matched, row.rejectReason || '');
    console.log('place:', row.placeName, row.placeId);
    console.log('url:', row.googlePhotoUrl);
    console.log('attr:', row.googleAttribution);
    console.log('ev:', row.photoEvidence && row.photoEvidence.primary);
    console.log('addr:', row.googleAddress);
  }
}

main();
