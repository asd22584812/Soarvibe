/**
 * Probe editorial resolve for a section across photo indices.
 */
const API_BASE = 'https://soarvibe-api.soarvibe.workers.dev';
const ORIGIN = 'https://asd22584812.github.io';

const probes = [
  {
    label: 'nakano-entrance',
    section: {
      sectionId: 'nakano',
      sectionRole: 'anime',
      subjectType: 'district',
      sectionType: 'landmark',
      requireStreetscape: true,
      title: '中野ブロードウェイ',
      subject: '中野ブロードウェイ',
      officialName: 'Nakano Broadway',
      officialNameLocal: '中野ブロードウェイ',
      mapsQuery: 'Nakano Broadway entrance Tokyo',
      photoPlaceQueries: ['Nakano Broadway entrance sign', '中野ブロードウェイ 入口', 'Nakano Broadway facade'],
      photoIntent: '中野百老匯商場外牆、入口招牌',
      imageChecklist: ['Broadway', 'ブロードウェイ', '中野', '外観', 'facade', 'entrance'],
      imageRejectRules: ['corridor', 'indoor', 'grocery', 'watch', '幸福物產']
    }
  },
  {
    label: 'hotel-exterior',
    section: {
      sectionId: 'hotel-gracery',
      sectionRole: 'hotel',
      sectionType: 'hotel',
      title: 'JR九州ホテル ブラッサム新宿',
      subject: 'JR九州ホテル ブラッサム新宿',
      officialName: 'JR九州ホテル ブラッサム新宿',
      officialNameLocal: 'JR九州ホテル ブラッサム新宿',
      mapsQuery: 'JR Kyushu Hotel Blossom Shinjuku exterior',
      placeId: 'ChIJh7zrtdGMGGARK2IbCPWPqnU',
      photoPlaceQueries: ['JR九州ホテル ブラッサム新宿 外観', 'JR Kyushu Hotel Blossom Shinjuku building'],
      photoIntent: '飯店外觀、建築入口',
      imageChecklist: ['facade', 'exterior', '外観', 'entrance', 'ホテル'],
      imageRejectRules: ['bathroom', 'bathtub', 'room', 'bed']
    }
  },
  {
    label: 'animate-exterior',
    section: {
      sectionId: 'ikebukuro-animate',
      sectionRole: 'anime',
      sectionType: 'shopping',
      title: 'アニメイト池袋本店',
      subject: 'アニメイト池袋本店',
      officialName: 'Animate Ikebukuro',
      officialNameLocal: 'アニメイト池袋本店',
      placeId: 'ChIJi0VhQ2-NGGARGsbajebyPVA',
      mapsQuery: 'アニメイト池袋本店 外観',
      photoPlaceQueries: ['アニメイト池袋本店 外観', 'Animate Ikebukuro exterior'],
      photoIntent: '店門口、招牌、外觀',
      imageChecklist: ['アニメイト', 'animate', '外観', '入口'],
      imageRejectRules: ['manga', 'bookshelf', '新刊', 'indoor']
    }
  }
];

async function resolve(section, minPhotoIndex, excludeUrls) {
  const body = {
    article: { articleId: 'probe', articleTheme: section.subject },
    sections: [Object.assign({}, section, { minPhotoIndex, excludeUrls })],
    excludeUrls
  };
  const r = await fetch(API_BASE + '/api/editorial/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  return (j.results && j.results[0]) || j;
}

async function main() {
  for (const probe of probes) {
    console.log('\n===', probe.label, '===');
    const exclude = [
      'https://lh3.googleusercontent.com/place-photos/AG9NLjBFYRJp0oi3z0suguKv8GZe2TQNue8n5qOL5TN5Pxl6atz1NzXls5rPfZMiN9tyx8Bzx4eTqKexqhtqjcGl5ujwb4akhXrsm0XCeiq5KtRcYzvQhAcXke-ZMDokcoMgkv7Hu8MI3V1RLUy3r2A',
      'https://lh3.googleusercontent.com/place-photos/AG9NLjAn1npMVqT_rFm_befRlNsNj5Cm2dy1W3F6LtGa97Atb3j4tyLG4fNkGzrY9hk9MgHHzyCVP5t84_MCuBE1XHwfqKKeESpLwLjxBpz3MoTOpgf4TwDqeubpYvOEVmt1vdT00j4r3Ko_9BV9Azi1_NDcQw',
      'https://lh3.googleusercontent.com/place-photos/AG9NLjDezg3XoiSZslrPUupZyGKXsZm2Sd3CvkYU1grk-bQ7pkAgTKwQt4r3u8v63F0-yIUKpps4jDn2W46DG-XmZsJq5gCo9eJj6wbwpTqXpcAFmgk2F0Ola59vv1RtPhP_AW8Yh7EcVXfOSUjR_A',
      'https://lh3.googleusercontent.com/place-photos/AG9NLjDDoYLYXtai18ZOb5HLZyLF8x3gIkzV8DvX0lwmTGHRj7jm8aPngYMjLN2yfK6ZjXuBaovYnwdIVY1nKH8sr_0eFmU0ImeQmba6HVjR4gbl8KO_RHk4-IuX_hffyW72lkRRIVOGgJx_iJvmfg'
    ];
    for (let i = 0; i < 10; i++) {
      const row = await resolve(probe.section, i, exclude);
      if (!row.googlePhotoUrl) {
        console.log('idx', i, 'NO URL', row.rejectReason || '');
        continue;
      }
      const ev = row.photoEvidence || {};
      console.log(
        'idx', i,
        'score', row.photoScore,
        'slot', row.travelPhotoSlot,
        'primary', ev.primary,
        'attr', row.googleAttribution,
        'blob', (ev.blob || '').slice(0, 60),
        '\n ', row.googlePhotoUrl.slice(0, 90) + '...'
      );
    }
  }
}

main().catch(console.error);
