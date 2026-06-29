/**
 * Generate editorial caption from actual photo / place context.
 * Caption describes only what the selected image represents.
 */

var LANDMARK_CAPTIONS = [
  { re: /radio kaikan|無線電會館|無線電/i, caption: 'Radio Kaikan 外觀，是秋葉原最具代表性的模型大樓。' },
  { re: /animate/i, caption: 'Animate 本館，是動漫迷朝聖的第一站。' },
  { re: /gigo|ゲーセン/i, caption: 'GIGO 大型看板，是秋葉原電氣街的地標之一。' },
  { re: /gachapon|gashapon|capsule|扭蛋|ガチャ/i, caption: '扭蛋會館內，成排機台形成色彩繽紛的牆面。' },
  { re: /tanaka|田中|そば|soba/i, caption: '醬油湯頭拉麵，掃街中途最實用的熱湯補給。' },
  { re: /ramen|拉麵|ラーメン/i, types: ['food'], caption: '醬油湯頭拉麵，掃街中途最實用的熱湯補給。' },
  { re: /maid|メイド|maid made/i, caption: '秋葉原主題咖啡廳，甜點與繽紛內裝是視覺主角。' },
  { re: /washington|ワシントン|華盛頓/i, caption: '秋葉原華盛頓飯店外觀，距車站步行約一分鐘。' },
  { re: /nui|hostel|ゲスト/i, caption: '淺草橋青年旅館，公共吧台夜間仍保有旅人交誼的溫度。' },
  { re: /nakano|中野|broadway|百老匯/i, caption: '中野百老匯樓層內，公仔與復古玩具一字排開。' },
  { re: /chuo.?dori|central|中央通/i, caption: '傍晚時分的中央通，霓虹開始點亮整條電氣街。' },
  { re: /electric town|電氣街|akihabara|秋葉原/i, types: ['landmark', 'shopping', 'hero'], caption: '秋葉原電氣街，動漫招牌與霓虹交織的街景。' }
];

var TYPE_FALLBACK = {
  landmark: '代表性街景，呼應本文所描述的探索動線。',
  food: '店內料理實景，與上文推薦的用餐節奏相互呼應。',
  cafe: '咖啡廳內景，呼應上文所描述的主題體驗。',
  hotel: '飯店外觀或公共空間，方便對照上文交通資訊。',
  hostel: '旅宿公共空間，呼應上文所描述的落腳選擇。',
  shopping: '店內實景，呼應上文所描述的選購重點。'
};

function buildBlob(ctx) {
  return [
    ctx.placeName,
    ctx.photoPlaceName,
    ctx.mapsQuery,
    ctx.photoMapsQuery,
    (ctx.matchedKeywords || []).join(' '),
    ctx.photoSubject || ''
  ].join(' ').toLowerCase();
}

function matchesType(entry, sectionType) {
  if (!entry.types || !entry.types.length) return true;
  return entry.types.indexOf(sectionType) !== -1;
}

export function generateCaption(ctx) {
  var blob = buildBlob(ctx || {});
  var sectionType = ctx.sectionType || 'landmark';
  var i;
  for (i = 0; i < LANDMARK_CAPTIONS.length; i++) {
    if (!matchesType(LANDMARK_CAPTIONS[i], sectionType)) continue;
    if (LANDMARK_CAPTIONS[i].re.test(blob)) {
      return LANDMARK_CAPTIONS[i].caption;
    }
  }
  var place = ctx.placeName || ctx.photoPlaceName || ctx.subject || '';
  if (place) {
    if (sectionType === 'food') return place + ' 的招牌料理，與上文推薦的用餐節奏相互呼應。';
    if (sectionType === 'hotel' || sectionType === 'hostel') return place + ' 外觀，方便對照上文的交通與預算資訊。';
    if (sectionType === 'cafe') return place + ' 內景，呼應上文所描述的主題體驗。';
    if (sectionType === 'shopping') return place + ' 店內實景，呼應上文所描述的選購重點。';
    return place + ' 代表性角度，呼應上文所描述的探索動線。';
  }
  return TYPE_FALLBACK[sectionType] || TYPE_FALLBACK.landmark;
}

export function detectPhotoSubject(ctx) {
  var caption = generateCaption(ctx);
  return caption.split('，')[0] || caption;
}
