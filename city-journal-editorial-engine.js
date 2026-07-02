(function (global) {
    'use strict';

    var SECTION_ROLES = [
        'opening', 'landmark', 'explore', 'experience', 'shopping', 'anime',
        'food', 'cafe', 'hotel', 'hostel', 'night', 'transport', 'ending'
    ];

    var METADATA_BY_ROLE = {
        landmark: ['recommend', 'stay', 'photoTime', 'season', 'transport', 'tips'],
        explore: ['recommend', 'stay', 'photoTime', 'transport', 'tips'],
        shopping: ['recommend', 'stay', 'highlight', 'mustBuy', 'taxFree', 'payment'],
        anime: ['recommend', 'stay', 'mustVisit', 'limited', 'newArrival', 'tips'],
        food: ['dish', 'budget', 'wait', 'hours'],
        cafe: ['recommend', 'stay', 'signature', 'budget', 'tips'],
        hotel: ['recommend', 'price', 'transport', 'checkIn', 'feature'],
        hostel: ['recommend', 'price', 'transport', 'feature', 'tips'],
        experience: ['recommend', 'stay', 'feature', 'tips'],
        night: ['recommend', 'stay', 'photoTime', 'tips'],
        opening: ['recommend', 'stay', 'transport'],
        ending: ['recommend', 'tips'],
        transport: ['route', 'transfer', 'tips']
    };

    var METADATA_LABELS = {
        recommend: { icon: '⭐', label: '推薦程度' },
        stay: { icon: '⏰', label: '建議停留' },
        photoTime: { icon: '📷', label: '最佳拍攝' },
        season: { icon: '🌸', label: '最佳季節' },
        transport: { icon: '🚉', label: '交通方式' },
        tips: { icon: '🔥', label: 'Tips' },
        highlight: { icon: '✨', label: '特色' },
        mustBuy: { icon: '🛍', label: '必買' },
        mustVisit: { icon: '🎯', label: '必逛' },
        limited: { icon: '🎁', label: '限定商品' },
        newArrival: { icon: '🆕', label: '新品' },
        taxFree: { icon: '💳', label: '退稅' },
        payment: { icon: '💴', label: '付款方式' },
        dish: { icon: '🍜', label: '推薦餐點' },
        budget: { icon: '💴', label: '預算' },
        wait: { icon: '⏳', label: '等待時間' },
        hours: { icon: '🕐', label: '營業時間' },
        signature: { icon: '☕', label: '招牌' },
        price: { icon: '💴', label: '價格' },
        checkIn: { icon: '🛎', label: '入住' },
        feature: { icon: '✨', label: '特色' },
        route: { icon: '🚃', label: '路線' },
        transfer: { icon: '🔀', label: '轉乘' }
    };

    function resolveSectionRole(section) {
        if (!section) return 'landmark';
        if (section.sectionRole) return section.sectionRole;
        var map = { food: 'food', cafe: 'cafe', hotel: 'hotel', hostel: 'hostel', shopping: 'shopping', transport: 'transport' };
        return map[section.sectionType] || 'landmark';
    }

    function buildMetadataTemplate(section) {
        var role = resolveSectionRole(section);
        var keys = METADATA_BY_ROLE[role] || METADATA_BY_ROLE.landmark;
        return keys.map(function (key) {
            var def = METADATA_LABELS[key];
            return def ? { key: key, icon: def.icon, label: def.label } : null;
        }).filter(Boolean);
    }

    global.SOARVIBE_CJ_ENGINE = {
        SECTION_ROLES: SECTION_ROLES,
        METADATA_BY_ROLE: METADATA_BY_ROLE,
        METADATA_LABELS: METADATA_LABELS,
        EDITORIAL_GOLDEN_RULE: {
            principle: '圖片永遠服務文案，不是文案去配合圖片。',
            rules: [
                '圖片無法支撐文案 → 重新搜圖',
                '不得修改文案迎合圖片',
                '找不到 → placeholder',
                'Caption 只描述圖片可見內容',
                '住宿驗證 Hotel Name + Place ID',
                '景點驗證 Landmark、美食驗證 Dish、體驗驗證 Activity'
            ]
        },
        resolveSectionRole: resolveSectionRole,
        buildMetadataTemplate: buildMetadataTemplate
    };
})(typeof window !== 'undefined' ? window : this);
