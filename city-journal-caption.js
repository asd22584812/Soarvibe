(function (global) {
    'use strict';

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

    function trimCaption(text, maxLen) {
        var s = String(text || '').replace(/\s+/g, '').trim();
        if (!s) return '';
        if (s.length <= maxLen) return s;
        return s.slice(0, maxLen).replace(/[，。、；]$/, '') + '。';
    }

    function generateCaption(ctx) {
        var sectionId = (ctx && ctx.sectionId) || '';
        if (CAPTION_BY_SECTION[sectionId]) {
            return trimCaption(CAPTION_BY_SECTION[sectionId], 25);
        }
        return trimCaption('代表性實景，呼應上文的探索動線。', 25);
    }

    global.SOARVIBE_CJ_CAPTION = {
        generateCaption: generateCaption,
        CAPTION_BY_SECTION: CAPTION_BY_SECTION
    };
})(typeof window !== 'undefined' ? window : this);
