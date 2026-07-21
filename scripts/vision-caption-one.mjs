import { visionCaptionViaWorker } from './lib/vision-caption.mjs';

const photos = [
  {
    id: 'nakano',
    url: 'https://lh3.googleusercontent.com/place-photos/AG9NLjDgwCb_1dUwWnDRggKVGqZzFLesGoERepbLbDSYbvKDGcnoVbSf3FnrClD9to5FL0NM-mLF8Drf3j8ei6wShQmhb7FKv6qwpD3-vX5ZhFiR9bzV8qjvx7mIHlUI2FlRXCpWijOyt49uJmLdJH7bciKz2A=s4800-w1600-h1200',
    ctx: { subject: '中野ブロードウェイ', placeName: 'Nakano Broadway', officialName: 'Nakano Broadway', officialNameLocal: '中野ブロードウェイ' },
    section: { sectionId: 'nakano', subjectType: 'district', photoIntent: '外牆入口街景' }
  },
  {
    id: 'hotel',
    url: 'https://lh3.googleusercontent.com/place-photos/AG9NLjCyL2GRekEVaoUH-qO5HdiaAzduOBoL8vr7Quj',
    ctx: { subject: 'JR九州ホテル ブラッサム新宿', placeName: 'JR Kyushu Hotel Blossom Shinjuku', officialName: 'JR Kyushu Hotel Blossom Shinjuku', officialNameLocal: 'JR九州ホテル ブラッサム新宿' },
    section: { sectionId: 'hotel-gracery', sectionRole: 'hotel', photoIntent: '飯店外觀' }
  }
];

async function main() {
  for (const p of photos) {
    if (!p.url.includes('=s')) {
      console.log(p.id, 'SKIP truncated url');
      continue;
    }
    const cap = await visionCaptionViaWorker(p.url, p.ctx, p.section);
    console.log(p.id, cap || '(no caption)');
  }
}

main();
