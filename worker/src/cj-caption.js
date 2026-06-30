/**
 * Editorial captions — image only, 15–25 chars.
 */
import { trimCaption } from './cj-editorial-pipeline.js';

var CAPTION_BY_SECTION = {
  'hero-anime': 'Radio Kaikan 前，電氣街霓虹亮起。',
  akihabara: '傍晚的中央通開始亮起霓虹。',
  nakano: 'Mandarake 櫥窗擺滿復古模型。',
  gachapon: '成排扭蛋機讓人停不下來。',
  ichiran: '醬油湯頭拉麵，熱氣補給剛好。',
  'maid-cafe': '繽紛甜點與主題內裝並陳。',
  'hotel-gracery': '華盛頓飯店外觀，距車站一分鐘。',
  'nui-hostel': '公共吧台夜間仍有旅人交談。'
};

var LANDMARK_CAPTIONS = [
  { re: /radio kaikan|ラジオ会館/i, caption: 'Radio Kaikan 前，電氣街霓虹亮起。' },
  { re: /animate|アニメイト/i, caption: 'Animate 本館前，人潮與招牌交織。' },
  { re: /gigo|ゲーセン/i, caption: 'GIGO 大型看板，是電氣街地標。' },
  { re: /mandarake|まんだらけ/i, caption: 'Mandarake 櫥窗擺滿復古模型。' },
  { re: /gachapon|ガチャ|扭蛋/i, caption: '成排扭蛋機讓人停不下來。' },
  { re: /tanaka|田中|そば|ramen|ラーメン/i, caption: '醬油湯頭拉麵，熱氣補給剛好。' },
  { re: /maid|メイド/i, caption: '繽紛甜點與主題內裝並陳。' },
  { re: /washington|ワシントン/i, caption: '華盛頓飯店外觀，距車站一分鐘。' },
  { re: /nui|hostel/i, caption: '公共吧台夜間仍有旅人交談。' },
  { re: /chuo|central|中央通/i, caption: '傍晚的中央通開始亮起霓虹。' },
  { re: /electric|電気|akihabara|秋葉原/i, types: ['landmark'], caption: '傍晚的中央通開始亮起霓虹。' }
];

function buildBlob(ctx) {
  return [
    ctx.placeName,
    ctx.photoPlaceName,
    ctx.officialName,
    ctx.officialNameLocal,
    ctx.sectionId,
    ctx.mapsQuery
  ].join(' ').toLowerCase();
}

function matchesType(entry, sectionType) {
  if (!entry.types || !entry.types.length) return true;
  return entry.types.indexOf(sectionType) !== -1;
}

export function generateCaption(ctx) {
  var sectionId = ctx.sectionId || '';
  if (CAPTION_BY_SECTION[sectionId]) {
    return trimCaption(CAPTION_BY_SECTION[sectionId], 12, 25);
  }
  var blob = buildBlob(ctx || {});
  var sectionType = ctx.sectionType || 'landmark';
  var i;
  for (i = 0; i < LANDMARK_CAPTIONS.length; i++) {
    if (!matchesType(LANDMARK_CAPTIONS[i], sectionType)) continue;
    if (LANDMARK_CAPTIONS[i].re.test(blob)) {
      return trimCaption(LANDMARK_CAPTIONS[i].caption, 12, 25);
    }
  }
  var place = ctx.placeName || ctx.officialNameLocal || ctx.subject || '';
  if (sectionType === 'food') return trimCaption('熱騰騰的拉麵，湯頭與麵條清晰可見。', 12, 25);
  if (sectionType === 'hotel' || sectionType === 'hostel') return trimCaption(place + ' 外觀，可對照上文的交通資訊。', 12, 25);
  if (sectionType === 'cafe') return trimCaption('店內甜點與主題內裝，色彩清晰可見。', 12, 25);
  if (sectionType === 'shopping') return trimCaption('店內商品陳列，呼應上文的選購重點。', 12, 25);
  return trimCaption('代表性街景，呼應上文的探索動線。', 12, 25);
}
