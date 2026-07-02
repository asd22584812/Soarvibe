(function (global) {
    'use strict';

    var CAPTION_BY_EVIDENCE = {
        street_landmark: '街道兩側動漫招牌與霓虹交織，街區氛圍一眼可見。',
        landmark_building: '地標建築外牆與大型招牌清楚可見，街區個性一眼可辨。',
        anime_collectible: '櫥窗內收藏品一字排開，是動漫迷最容易停下腳步的地方。',
        gachapon_wall: '整排扭蛋機一路延伸，色彩與機台本身就是風景。',
        food_dish: '料理本體即是最好的招牌，擺上桌的瞬間最說明這家店。',
        dessert: '精緻甜點與飲品擺上桌面，店內氛圍比 Logo 更能說明體驗。',
        cafe_interior: '主題內裝與座位區呈現店內氛圍，一眼就知道這是主題咖啡廳。',
        room: '客房採簡約木質設計，採光充足，空間雖緊湊但收納完整。',
        lobby_bar: '公共吧台與交誼空間，是旅人交流最頻繁的角落。',
        facade: '建築外觀標示清楚，方便確認是否抵達正確地點。'
    };

    function trimCaption(text, maxLen) {
        var s = String(text || '').replace(/\s+/g, '').trim();
        if (!s) return '';
        maxLen = maxLen || 48;
        if (s.length <= maxLen) return s;
        return s.slice(0, maxLen).replace(/[，。、；]$/, '') + '。';
    }

    function generateCaption(ctx) {
        var evidenceType = ctx && ctx.photoEvidence && ctx.photoEvidence.primary;
        if (evidenceType && CAPTION_BY_EVIDENCE[evidenceType]) {
            return trimCaption(CAPTION_BY_EVIDENCE[evidenceType]);
        }
        return '';
    }

    global.SOARVIBE_CJ_CAPTION = {
        generateCaption: generateCaption
    };
})(typeof window !== 'undefined' ? window : this);
