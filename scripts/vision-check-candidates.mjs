import { visionCaptionViaWorker, visionVerifyLandmarkViaWorker } from './lib/vision-caption.mjs';

const candidates = [
  ['nakano-zox', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDgwCb_1dUwWnDRggKVGqZzFLesGoERepbLbDSYbvKDGcnoVbSf3FnrClD9to5FL0NM-mLF8Drf3j8ei6wShQmhb7FKv6qwpD3-vX5ZhFiR9bzV8qjvx7mIHlUI2FlRXCpWijOyt49uJmLdJH7bciKz2A=s4800-w1600-h1200', { subject: '中野ブロードウェイ', placeName: 'Nakano Broadway' }, { sectionId: 'nakano', subjectType: 'district' }],
  ['hotel-ext', 'https://lh3.googleusercontent.com/place-photos/AG9NLjCyL2GRekEVaoUH-qO5HdiaAzduOBoL8vr7QujGE08KTq1h8sHQ_99fJKid7t_6KxKbMvbZUoVS3AUcG0Yz66BSSzSstxWOTlqZDE0ru15ueWgMUCGL4Z5lDqDvjNIZyis6DxxsDwB46jYRJA=s4800-w1600-h1200', { subject: 'JR九州ホテル ブラッサム新宿', placeName: 'JR Kyushu Hotel Blossom Shinjuku' }, { sectionId: 'hotel-gracery', sectionRole: 'hotel' }],
  ['animate-pluto', 'https://lh3.googleusercontent.com/place-photos/AG9NLjDDoYLYXtai18ZOb5HLZyLF8x3gIkzV8DvX0lwmTGHRj7jm8aPngYMjLN2yfK6ZjXuBaovYnwdIVY1nKH8sr_0eFmU0ImeQmba6HVjR4gbl8KO_RHk4-IuX_hffyW72lkRRIVOGgJx_iJvmfg=s4800-w1600-h1200', { subject: 'アニメイト池袋本店', placeName: 'Animate Ikebukuro' }, { sectionId: 'ikebukuro-route', photoIntent: '外觀' }],
  ['animate-fl-old', 'https://lh3.googleusercontent.com/place-photos/AG9NLjAbQdgjHHuVG3LpK2XSlUVWevGFFfRDHap1B7uv2irvRcAxn3Y3QuDX5hEZpEr5mbWtWZF8S_FRKaMNB4xhDBxg-OFxKC9Dkf0Tly9T8TbdVNGiFHb6tExYkJ1X-La6fSscl43HgamRoz4vMnQ=s4800-w1600-h1200', { subject: 'アニメイト池袋本店', placeName: 'Animate Ikebukuro' }, { sectionId: 'ikebukuro-route', photoIntent: '外觀' }],
  ['animate-fl-new', 'https://lh3.googleusercontent.com/place-photos/AG9NLjA8MZ4Vp6DceK-UV6GGefUyxsB4nJltmvbWaHiXRIlNxrDww7lmqDC7IjMnWTah5kYpUD7-RaMPtk_bIJIaQlHLeE0FqW9pwnn4nzHatJh4T3MkPpyESKpvonm8_AeSV4syJqAMXWRV1tE4qFk=s4800-w1600-h1200', { subject: 'アニメイト池袋本店', placeName: 'Animate Ikebukuro' }, { sectionId: 'ikebukuro-route', photoIntent: '外觀' }]
];

async function main() {
  for (const [id, url, ctx, section] of candidates) {
    const v = await visionVerifyLandmarkViaWorker(url, ctx, section);
    console.log('\n' + id);
    console.log('match:', v.venueMatch, 'err:', v.apiError);
    console.log('subjects:', (v.visibleSubjects || []).join(', '));
    console.log('caption:', v.caption || '(none)');
  }
}

main();
