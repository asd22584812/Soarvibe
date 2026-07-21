const API = 'https://soarvibe-api.soarvibe.workers.dev';
const ORIGIN = 'https://asd22584812.github.io';

const sections = [
  {
    name: 'hotel',
    section: {
      sectionId: 'hotel-gracery', sectionRole: 'hotel', sectionType: 'hotel',
      subject: 'JR九州ホテル ブラッサム新宿', officialName: 'JR Kyushu Hotel Blossom Shinjuku',
      mapsQuery: 'JR Kyushu Hotel Blossom Shinjuku Tokyo',
      placeId: 'ChIJh7zrtdGMGGARK2IbCPWPqnU',
      photoPlaceQueries: ['JR九州ホテル ブラッサム新宿 外観'],
      photoIntent: '飯店外觀', imageChecklist: ['facade', 'exterior', '外観']
    }
  },
  {
    name: 'animate',
    section: {
      sectionId: 'ikebukuro-route', sectionRole: 'anime', sectionType: 'shopping',
      subject: 'アニメイト池袋本店', officialName: 'Animate Ikebukuro',
      officialNameLocal: 'アニメイト池袋本店', placeId: 'ChIJi0VhQ2-NGGARGsbajebyPVA',
      mapsQuery: 'Animate Ikebukuro flagship store exterior Tokyo',
      photoPlaceQueries: ['アニメイト池袋本店 外観', 'Animate Ikebukuro building exterior'],
      photoIntent: '店門口、招牌、外觀', imageChecklist: ['アニメイト', '外観', 'facade'],
      excludeUrls: [
        'https://lh3.googleusercontent.com/place-photos/AG9NLjAbQdgjHHuVG3LpK2XSlUVWevGFFfRDHap1B7uv2irvRcAxn3Y3QuDX5hEZpEr5mbWtWZF8S_FRKaMNB4xhDBxg-OFxKC9Dkf0Tly9T8TbdVNGiFHb6tExYkJ1X-La6fSscl43HgamRoz4vMnQ',
        'https://lh3.googleusercontent.com/place-photos/AG9NLjA8MZ4Vp6DceK-UV6GGefUyxsB4nJltmvbWaHi'
      ]
    }
  }
];

async function main() {
  for (const item of sections) {
    const r = await fetch(API + '/api/editorial/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({
        article: { articleId: 'x', articleTheme: item.section.subject },
        sections: [item.section],
        excludeUrls: item.section.excludeUrls || []
      })
    });
    const j = await r.json();
    const row = j.results && j.results[0];
    console.log('\n##', item.name);
    console.log('url:', row && row.googlePhotoUrl);
    console.log('attr:', row && row.googleAttribution);
    console.log('ev:', row && row.photoEvidence && row.photoEvidence.primary);
  }
}

main();
