(function (global) {
    'use strict';

    var STORY_CAPTIONS = [
        { terms: ['radio kaikan', 'ラジオ会館'], caption: 'Radio Kaikan 外牆滿版動漫廣告，是秋葉原最醒目的地標之一。' },
        { terms: ['中央通', 'chuo dori', 'chuo'], caption: '中央通兩旁的動漫招牌與霓虹，是秋葉原最具代表性的街景。' },
        { terms: ['animate', 'アニメイト'], caption: 'Animate 本館前人潮與招牌交織，電氣街節奏從這裡開始。' },
        { terms: ['gigo', 'ゲーセン'], caption: 'GIGO 大型看板矗立街頭，是電氣街一眼辨識的地標。' },
        { terms: ['mandarake', 'まんだらけ'], caption: 'Mandarake 櫥窗擺滿模型與收藏品，是動漫迷最容易停下腳步的地方。' },
        { terms: ['らしんばん', 'lashinbang'], caption: '架上中古漫畫層層堆疊，翻找過程本身就是樂趣。' },
        { terms: ['sun mall', 'サンモール', 'broadway'], caption: '中野 Sun Mall 中庭往上看，百老匯的挖寶氛圍一目了然。' },
        { terms: ['フィギュア', 'figure', 'figurine', '公仔'], caption: '玻璃櫥窗內公仔與模型一字排開，像一座小型展覽。' },
        { terms: ['ガチャ', 'gachapon', 'gashapon', 'capsule', '扭蛋'], caption: '整排扭蛋機一路延伸，形成動漫迷最熟悉的風景。' },
        { terms: ['tanaka', '田中', 'そば', 'ramen', 'ラーメン'], caption: '醬油湯頭與熱氣一同上桌，掃街中途最剛好的補給。' },
        { terms: ['maid', 'メイド', 'maid made'], caption: '繽紛甜點與主題內裝並陳，把次文化體驗留在味蕾裡。' },
        { terms: ['dessert', '甜點', 'パフェ', 'cake'], caption: '精緻甜點擺上桌面，是女僕咖啡廳最上鏡的瞬間。' },
        { terms: ['lobby', 'bar', 'lounge', '吧台'], caption: '木質吧台夜間仍聚集旅人，交換著下一站的行程。' },
        { terms: ['room', '客房', 'dorm'], caption: '簡潔客房保留休息空間，為隔天繼續開逛蓄力。' },
        { terms: ['washington', 'ワシントン'], caption: '步行一分鐘即達車站，把時間留給電氣街而非通勤。' },
        { terms: ['nui', 'hostel', 'ゲスト'], caption: '公共吧台夜間仍有旅人交談，青年旅宿的溫度在這裡。' }
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

    function trimCaption(text, minLen, maxLen) {
        var s = String(text || '').replace(/\s+/g, '').trim();
        if (!s) return '';
        maxLen = maxLen || 42;
        if (s.length <= maxLen) return s;
        return s.slice(0, maxLen).replace(/[，。、；]$/, '') + '。';
    }

    function generateCaption(ctx) {
        var blob = [
            ctx.photoPlaceName,
            ctx.googleAttribution || '',
            ctx.placeName,
            (ctx.matchedKeywords || []).join(' ')
        ].join(' ').toLowerCase();
        var i;
        for (i = 0; i < STORY_CAPTIONS.length; i++) {
            if (matchTerms(blob, STORY_CAPTIONS[i].terms).length) {
                return trimCaption(STORY_CAPTIONS[i].caption, 12, 42);
            }
        }
        var sectionType = ctx.sectionType || 'landmark';
        if (sectionType === 'food' && /ramen|ラーメン|拉麵|soba|麺/.test(blob)) {
            return trimCaption('醬油湯頭與熱氣一同上桌，掃街中途最剛好的補給。', 12, 42);
        }
        return '';
    }

    global.SOARVIBE_CJ_CAPTION = {
        generateCaption: generateCaption
    };
})(typeof window !== 'undefined' ? window : this);
