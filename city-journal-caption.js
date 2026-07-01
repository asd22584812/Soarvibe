(function (global) {
    'use strict';

    var CAPTION_RULES = [
        { terms: ['animate', 'アニメイト'], caption: 'Animate 本館前，人潮與招牌交織。' },
        { terms: ['radio kaikan', 'ラジオ会館'], caption: 'Radio Kaikan 前，電氣街霓虹亮起。' },
        { terms: ['gigo', 'ゲーセン'], caption: 'GIGO 大型看板，是電氣街地標。' },
        { terms: ['mandarake', 'まんだらけ'], caption: 'Mandarake 櫥窗擺滿復古模型。' },
        { terms: ['らしんばん', 'lashinbang'], caption: 'らしんばん 架上擠滿中古漫畫。' },
        { terms: ['フィギュア', 'figure', 'figurine', '公仔'], caption: '玻璃櫥窗內公仔與模型一字排開。' },
        { terms: ['漫画', '漫畫', 'manga'], caption: '架上漫畫與復古刊物層層堆疊。' },
        { terms: ['ガチャ', 'gachapon', 'gashapon', 'capsule', '扭蛋'], caption: '成排扭蛋機形成色彩繽紛的牆面。' },
        { terms: ['tanaka', '田中', 'そば', 'ramen', 'ラーメン'], caption: '醬油湯頭拉麵，熱氣補給剛好。' },
        { terms: ['maid', 'メイド', 'maid made'], caption: '繽紛甜點與主題內裝並陳。' },
        { terms: ['washington', 'ワシントン'], caption: '華盛頓飯店外觀，距車站一分鐘。' },
        { terms: ['nui', 'hostel', 'ゲスト'], caption: '公共吧台夜間仍有旅人交談。' },
        { terms: ['中央通', 'chuo', 'central'], caption: '傍晚的中央通開始亮起霓虹。' }
    ];

    function matchTerms(blob, terms) {
        var matched = [];
        (terms || []).forEach(function (term) {
            if (!term) return;
            try {
                if (new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(blob)) matched.push(term);
            } catch (e) { /* skip */ }
        });
        return matched;
    }

    function trimCaption(text, maxLen) {
        var s = String(text || '').replace(/\s+/g, '').trim();
        if (!s) return '';
        if (s.length <= maxLen) return s;
        return s.slice(0, maxLen).replace(/[，。、；]$/, '') + '。';
    }

    function generateCaption(ctx) {
        var blob = [
            ctx.photoPlaceName,
            ctx.googleAttribution || '',
            ctx.placeName
        ].join(' ').toLowerCase();
        var i;
        for (i = 0; i < CAPTION_RULES.length; i++) {
            if (matchTerms(blob, CAPTION_RULES[i].terms).length) {
                return trimCaption(CAPTION_RULES[i].caption, 25);
            }
        }
        var sectionType = ctx.sectionType || 'landmark';
        if (sectionType === 'food' && /ramen|ラーメン|拉麵|soba|麺/.test(blob)) {
            return trimCaption('醬油湯頭拉麵，熱氣補給剛好。', 25);
        }
        var intent = String(ctx.photoIntent || '').split(/[、,，\/\|]+/)[0] || '';
        var venue = ctx.photoPlaceName || ctx.placeName || '';
        if (venue && intent) {
            return trimCaption(venue.slice(0, 10) + '，' + intent.slice(0, 12) + '。', 25);
        }
        if (venue) {
            return trimCaption(venue.slice(0, 14) + '一景。', 25);
        }
        return '';
    }

    global.SOARVIBE_CJ_CAPTION = {
        generateCaption: generateCaption
    };
})(typeof window !== 'undefined' ? window : this);
