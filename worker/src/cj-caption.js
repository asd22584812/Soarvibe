/**
 * Caption from actual photo context — no section presets.
 */
import { trimCaption, matchTerms } from './cj-editorial-pipeline.js';

var CAPTION_RULES = [
  { terms: ['animate', 'アニメイト'], caption: 'Animate 本館前，人潮與招牌交織。' },
  { terms: ['radio kaikan', 'ラジオ会館'], caption: 'Radio Kaikan 前，電氣街霓虹亮起。' },
  { terms: ['gigo', 'ゲーセン'], caption: 'GIGO 大型看板，是電氣街地標。' },
  { terms: ['mandarake', 'まんだらけ'], caption: 'Mandarake 櫥窗擺滿復古模型。' },
  { terms: ['らしんばん', 'lashinbang'], caption: 'らしんばん 架上擠滿中古漫畫。' },
  { terms: ['フィギュア', 'figure', 'figurine', '公仔'], caption: '玻璃櫥窗內公仔與模型一字排開。' },
  { terms: ['漫画', '漫畫', 'manga', 'comic'], caption: '架上漫畫與復古刊物層層堆疊。' },
  { terms: ['ガチャ', 'gachapon', 'gashapon', 'capsule', '扭蛋'], caption: '成排扭蛋機形成色彩繽紛的牆面。' },
  { terms: ['tanaka', '田中', 'そば', 'ramen', 'ラーメン'], caption: '醬油湯頭拉麵，熱氣補給剛好。' },
  { terms: ['maid', 'メイド', 'maid made'], caption: '繽紛甜點與主題內裝並陳。' },
  { terms: ['washington', 'ワシントン'], caption: '華盛頓飯店外觀，距車站一分鐘。' },
  { terms: ['nui', 'hostel', 'ゲスト'], caption: '公共吧台夜間仍有旅人交談。' },
  { terms: ['中央通', 'chuo', 'central'], caption: '傍晚的中央通開始亮起霓虹。' }
];

function buildPhotoBlob(ctx) {
  return [
    ctx.photoPlaceName,
    ctx.photoAttribution || '',
    ctx.placeName
  ].join(' ').toLowerCase();
}

export function generateCaption(ctx) {
  var blob = buildPhotoBlob(ctx || {});
  var i;
  for (i = 0; i < CAPTION_RULES.length; i++) {
    if (matchTerms(blob, CAPTION_RULES[i].terms).length) {
      return trimCaption(CAPTION_RULES[i].caption, 12, 25);
    }
  }
  var sectionType = ctx.sectionType || 'landmark';
  if (sectionType === 'food' && /ramen|ラーメン|拉麵|soba|麺/.test(blob)) {
    return trimCaption('醬油湯頭拉麵，熱氣補給剛好。', 12, 25);
  }
  if ((sectionType === 'hotel' || sectionType === 'hostel') && /hotel|ホテル|hostel/.test(blob)) {
    var place = ctx.photoPlaceName || ctx.placeName || '';
    return trimCaption(place ? place.slice(0, 12) + ' 外觀。' : '飯店外觀與入口清晰可見。', 12, 25);
  }
  var purpose = ctx.sectionPurpose || sectionType;
  var intent = String(ctx.photoIntent || '').split(/[、,，\/\|]+/)[0] || '';
  var venue = ctx.photoPlaceName || ctx.placeName || '';
  if (venue && intent) {
    return trimCaption(venue.slice(0, 10) + '，' + intent.slice(0, 12) + '。', 12, 25);
  }
  if (venue) {
    return trimCaption(venue.slice(0, 14) + '一景。', 12, 25);
  }
  return null;
}
