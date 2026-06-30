(function (global) {
    'use strict';

    var CJ_PLACEHOLDER = './assets/city-journal/placeholder-city-journal.jpg';

    var EDITION_CATALOG = [
        { key: 'budget', label: '小資旅行', icon: '💰' },
        { key: 'sightseeing', label: '初次觀光', icon: '🗺️' },
        { key: 'trendy', label: '新潮熱門', icon: '⚡' },
        { key: 'foodie', label: '美食吃貨', icon: '🍜' },
        { key: 'photospot', label: '網美必拍', icon: '📸' },
        { key: 'anime', label: '玩具動漫', icon: '🎮' },
        { key: 'streetwear', label: '潮流玩家', icon: '👟' }
    ];

    function buildMeta(cityId, name, nameEn, destinationLabel, hubSubtitle, publishedEditions, heroImageKey) {
        return {
            id: cityId,
            name: name,
            nameEn: nameEn,
            destinationLabel: destinationLabel,
            heroImageKey: heroImageKey || null,
            hubSubtitle: hubSubtitle,
            publishedEditions: publishedEditions || [],
            editionCoverKeys: EDITION_CATALOG.reduce(function (acc, edition) {
                acc[edition.key] = null;
                return acc;
            }, {})
        };
    }

    var META = {
        tokyo: buildMeta('tokyo', '東京', 'TOKYO', '東京', '七種節奏，讀懂這座永遠不睡的城市', ['anime'], 'tokyo-hub-hero'),
        kyoto: buildMeta('kyoto', '京都', 'KYOTO', '京都', '專題即將推出', []),
        osaka: buildMeta('osaka', '大阪', 'OSAKA', '大阪', '專題即將推出', []),
        seoul: buildMeta('seoul', '首爾', 'SEOUL', '首爾', '專題即將推出', []),
        hokkaido: buildMeta('hokkaido', '北海道', 'HOKKAIDO', '北海道', '專題即將推出', []),
        bangkok: buildMeta('bangkok', '曼谷', 'BANGKOK', '曼谷', '專題即將推出', []),
        vietnam: buildMeta('vietnam', '越南', 'VIETNAM', '越南', '專題即將推出', []),
        london: buildMeta('london', '倫敦', 'LONDON', '倫敦', '專題即將推出', []),
        paris: buildMeta('paris', '巴黎', 'PARIS', '巴黎', '專題即將推出', [])
    };

    META.tokyo.editionCoverKeys.anime = 'tokyo-anime-cover';

    var ARTICLES = {
        tokyo: {
            anime: {
                id: 'tokyo-anime',
                cityId: 'tokyo',
                styleKey: 'anime',
                status: 'published',
                title: '秋葉原與中野：東京動漫聖地巡禮指南',
                subtitle: '從一番賞到復古玩具，骨灰級玩家的 48 小時地圖',
                heroImageKey: 'tokyo-anime-hero',
                coverImageKey: 'tokyo-anime-cover',
                heroSubject: '秋葉原電氣街',
                heroOfficialName: null,
                heroOfficialNameLocal: null,
                heroMapsQuery: 'Radio Kaikan Akihabara Tokyo',
                heroVisualKeywords: ['Radio Kaikan', 'Animate', '秋葉原', '霓虹', '中央通', '動漫', '電氣街'],
                heroPlaceId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
                heroGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPyMqYt48AlW5AkRwxgZ2eUX7mDX-3KcPNXK3YHDDBgnddWa6eabfz5Z1YUMAIahJTK5XYXKS_hmiCP2dyfpuRmcewSUTRBpr82pMIdljzEoBT4VcL44qfiJJcokcbrYHHG0A9yoRH2ADobTbMSU8mEUg=s4800-w1600-h1200',
                heroGoogleAttribution: 'Giampaolo Mancinelli',
                heroImageSource: 'google_places',
                coverSubject: '秋葉原電氣街',
                coverMapsQuery: 'Akihabara Electric Town Tokyo Japan',
                coverPlaceId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
                coverGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPyMqYt48AlW5AkRwxgZ2eUX7mDX-3KcPNXK3YHDDBgnddWa6eabfz5Z1YUMAIahJTK5XYXKS_hmiCP2dyfpuRmcewSUTRBpr82pMIdljzEoBT4VcL44qfiJJcokcbrYHHG0A9yoRH2ADobTbMSU8mEUg=s4800-w1600-h1200',
                coverGoogleAttribution: 'Giampaolo Mancinelli',
                coverImageSource: 'google_places',
                issueLabel: '2026 年 6 月號',
                intro: '東京對動漫迷而言，從來不是把景點一個個打卡就能結束的旅行。真正吸引人的，是走進秋葉原的小巷、翻開中野百老匯一間不起眼的小店，在成排模型與漫畫之間，突然遇見那件找了很久的收藏。這座城市的樂趣，不只是買東西，而是在探索的過程中，不斷發現驚喜。',
                sections: [
                    {
                        sectionId: 'akihabara',
                        sectionType: 'landmark',
                        visualKeywords: ['動漫', '霓虹', 'Animate', 'Radio Kaikan', '中央通', '招牌', '秋葉原', '電氣街'],
                        officialName: null,
                        officialNameLocal: null,
                        subject: '秋葉原電氣街',
                        mapsQuery: 'Akihabara Electric Town Tokyo Japan',
                        placeId: 'ChIJZzSYoB2MGGARfBcicn7sx28',
                        googleRating: 4.5,
                        googleAddress: '〒101-0021 東京都千代田区外神田１丁目１２',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOH0F87_D1soeylSB5_P7sGkzKGOivPygTDbao_kBCyPOpPJ_IA5saP7LMIrhSptIWzANdTjFxZ2rsu9MXDXTPkG3j2wE_J2eOwaNf9nu5VIxGENCyY-NstHJPY7kt0DIp5tkE0GAmuH274zCo=s4800-w1600-h1200',
                        googleAttribution: 'Marta',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-akihabara',
                        caption: '秋葉原電氣街，動漫招牌與霓虹交織的街景。',
                        heading: '秋葉原電氣街 · 動漫朝聖的起點',
                        content: '從 JR 秋葉原站電氣街口走進去，視線很難不被櫥窗裡的模型與海報吸走。這裡不是單一景點，而是一整片可以迷路的地方：連鎖動漫店、卡牌專賣、地下樓層的復古遊戲機，每一轉角都可能是下一個驚喜。上午的人潮還算可控，先把最想逛的兩三間店鎖定，比漫無目的亂鑽更能保留體力。傍晚霓虹亮起，電氣街才真正進入它的主場。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '必訪' },
                            { icon: '⏰', label: '建議停留', value: '2–3 小時' },
                            { icon: '🚉', label: '最近車站', value: 'JR 秋葉原' },
                            { icon: '📷', label: '最佳拍攝', value: '傍晚霓虹時分' }
                        ]
                    },
                    {
                        sectionId: 'nakano',
                        sectionType: 'landmark',
                        visualKeywords: ['中野百老匯', 'Nakano Broadway', '公仔', '模型', '復古玩具', '漫畫'],
                        officialName: null,
                        officialNameLocal: null,
                        subject: '中野百老匯',
                        mapsQuery: 'Nakano Broadway Tokyo Japan',
                        placeId: 'ChIJg-7dspDyGGARvvDv4E5-tuE',
                        googleRating: 4.2,
                        googleAddress: '5-chōme-52-15 Nakano, Nakano City, Tokyo 164-0001, Japan',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOBV3tGQC66wLh_pvsFSuwilQMJcxhRGkoDJEaMoEwKOCaLUC20wPzGmevBgajSrcQ7jodwGcL877ec-QeWnFZx05mKOtQv-eF8348TF3LVDnIZSwCqXht3DrhRgkNRlUzX3-1OJUf1iMMC3_Y=s4800-w1600-h1200',
                        googleAttribution: '加藤展康',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nakano',
                        caption: '中野百老匯樓層內，公仔與復古玩具一字排開。',
                        heading: '中野百老匯 · 老玩家公認的挖寶聖地',
                        content: '老玩家口耳相傳的挖寶聖地。樓層裡擠滿漫畫、公仔、卡牌與復古玩具，價格常有意外驚喜。下午光線較暖，邊逛邊比價剛好；預留兩小時以上，才對得起這座寶庫。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '老玩家必訪' },
                            { icon: '⏰', label: '建議停留', value: '2 小時以上' },
                            { icon: '🚉', label: '最近車站', value: 'JR 中野（北口）' },
                            { icon: '🛍', label: '必挖', value: '中古公仔・卡牌' }
                        ]
                    },
                    {
                        sectionId: 'gachapon',
                        sectionType: 'shopping',
                        visualKeywords: ['扭蛋', 'GACHAPON', '轉蛋', '機台', 'capsule'],
                        officialName: null,
                        officialNameLocal: null,
                        subject: 'GACHAPON 扭蛋會館',
                        mapsQuery: 'Gachapon Kaikan Akihabara Tokyo',
                        placeId: 'ChIJBztW3x2MGGARadHYl5vTEK0',
                        googleRating: 4,
                        googleAddress: 'Japan, 〒101-0021 Tokyo, Chiyoda City, Sotokanda, 3-chōme−15−５ MNビル 1F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPlQvzONpiVeCAp28cg3VBkHgSJHCaxxP9apCNXKuVhd3KUuiCDfOoWOGGEPWg-GSJAMcy6kp4Qehhl2arH5Cv8rw5TIsT8k-flonNABId5IMHBU5YP8-QrgqGvMwr-GA0bzAI7WJgiUUJTt2A=s4800-w1600-h1200',
                        googleAttribution: 'ブラウンチョコ',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-gachapon',
                        caption: '扭蛋會館內，成排機台形成色彩繽紛的牆面。',
                        heading: 'GACHAPON 扭蛋會館 · 整面牆都是驚喜',
                        content: '整面牆的扭蛋機，轉一圈就可能入坑。先設定預算上限，再開始試手氣——這是過來人的溫柔提醒。',
                        editorialMeta: [
                            { icon: '⏰', label: '建議停留', value: '20–40 分鐘' },
                            { icon: '💴', label: '預算', value: '¥300–2,000' },
                            { icon: '🎁', label: '限定', value: '期間限定扭蛋' },
                            { icon: '🔥', label: '小 Tips', value: '先逛後轉，避免衝動爆預算' }
                        ]
                    },
                    {
                        sectionId: 'ichiran',
                        sectionType: 'food',
                        visualKeywords: ['拉麵', '醬油', '湯頭', '田中そば', 'soba', 'ramen'],
                        officialName: null,
                        officialNameLocal: null,
                        subject: '田中そば店 秋葉原店',
                        mapsQuery: '田中そば店 秋葉原店',
                        placeId: 'ChIJXTeLYx6MGGARNivhJ55nYVw',
                        googleRating: 4.2,
                        googleAddress: 'Japan, 〒101-0021 Tokyo, Chiyoda City, Sotokanda, 3-chōme−8−３ 第一針谷ビル1Ｆ',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOGemMyCtJtY4ox-MzrD_2Fp17Y0I5GL86Zm9pQurcbB-bI0PQv_Q4EUDaZ8DmGg7H1Y90XGFKR-PYoKGIV96H9sdSyy4qaU3nuj2ojgnhZyayXtho9WyL-SeBLUw9kOyTsK1tTLVudpfkUsbivMY7b9A=s4800-w1600-h1200',
                        googleAttribution: '田中そば店 秋葉原店',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-ichiran',
                        caption: '醬油湯頭拉麵，掃街中途最實用的熱湯補給。',
                        heading: '田中そば店 秋葉原店 · 掃街中途的熱湯補給',
                        content: '醬油湯頭、出餐快，午餐控制在三十分鐘內剛好。尖峰時段先排隊，再回周邊繼續逛。',
                        editorialMeta: [
                            { icon: '🍜', label: '推薦餐點', value: '醬油拉麵' },
                            { icon: '💴', label: '預算', value: '¥900–1,200' },
                            { icon: '⏰', label: '建議停留', value: '30–45 分鐘' }
                        ]
                    },
                    {
                        sectionId: 'maid-cafe',
                        sectionType: 'cafe',
                        visualKeywords: ['女僕', '咖啡', '甜點', 'maid', '主題咖啡'],
                        officialName: null,
                        officialNameLocal: null,
                        subject: '女僕咖啡廳 秋葉原',
                        mapsQuery: 'MAID MADE Akihabara Tokyo',
                        placeId: 'ChIJvQtxBAaNGGARTiTMJ-Nzhvc',
                        googleRating: 4.9,
                        googleAddress: 'Japan, 〒101-0021 Tokyo, Chiyoda City, Sotokanda, 1-chōme−15−13 秋葉原 神田B&Vビル 10F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMV7YbwCcqqGMS3-D5z5SOLl8geMQkJQtYOpZW-rSJ4sjjqv5DEQFWZlpbG5WunzooWgDIx9FJGqiQCVPQ5fI_GsVyO0JylfDDaFNmdvUiJpAyBUlItxrzzdxfhSLdiBRbUwi1H2PxNVkuseEw=s4800-w1365-h1200',
                        googleAttribution: 'MAID MADE 秋葉原駅前店',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-maid-cafe',
                        caption: '秋葉原主題咖啡廳，甜點與繽紛內裝是視覺主角。',
                        heading: '秋葉原女僕咖啡廳街 · 次文化體驗的一杯咖啡',
                        content: '第一次體驗，選評價穩定、規則說明清楚的分店。把時間控制在六十分鐘內，留體力給下一間店。',
                        editorialMeta: [
                            { icon: '⏰', label: '建議停留', value: '45–60 分鐘' },
                            { icon: '💴', label: '預算', value: '¥1,500–3,000' },
                            { icon: '🔥', label: '小 Tips', value: '先確認低消與拍照規則' }
                        ]
                    },
                    {
                        sectionId: 'nui-hostel',
                        sectionType: 'hostel',
                        visualKeywords: ['hostel', '旅館', '吧台', '交誼廳', 'Nui'],
                        officialName: null,
                        officialNameLocal: null,
                        subject: 'Nui Hostel Tokyo',
                        mapsQuery: 'Nui Hostel & Bar Tokyo',
                        placeId: 'ChIJ4U-9KsiOGGARARhaBLZLqS0',
                        googleRating: 4.5,
                        googleAddress: '2-chōme-14-13 Kuramae, Taito City, Tokyo 111-0051, Japan',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNCZo0z34QCyfrzNK4XjbnERETKf6UphmSp4csLPzE1l4y8DXHCKE8DkHOst2x9ss8DFbJPbzxvPCWCGfJxDUAXCMYVt_EyQBIK17GhfUy8kbKxbjlX37iT46b_hGe1EsMZ2chkuc01vF3enQ=s4800-w1600-h1200',
                        googleAttribution: 'Nui. HOSTEL & BAR LOUNGE',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nui-hostel',
                        caption: '淺草橋青年旅館，公共吧台夜間仍保有旅人交誼的溫度。',
                        heading: 'Nui Hostel Tokyo · 淺草橋的設計旅宿',
                        content: '離電氣街稍遠，搭 JR 往返仍方便。公共吧台與交誼廳氣氛輕鬆，獨旅或預算控管都合適。週末床位記得提早訂。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '預算型首選' },
                            { icon: '💴', label: '預算', value: '¥3,500–6,000／晚' },
                            { icon: '🚉', label: '最近車站', value: '淺草橋・蔵前' }
                        ]
                    },
                    {
                        sectionId: 'hotel-gracery',
                        sectionType: 'hotel',
                        visualKeywords: ['飯店', '外觀', '秋葉原', '華盛頓', 'Washington Hotel'],
                        officialName: null,
                        officialNameLocal: null,
                        subject: '秋葉原ワシントンホテル',
                        mapsQuery: 'Akihabara Washington Hotel Tokyo',
                        placeId: 'ChIJnxZoFqiOGGAReYJ1ck2lXiw',
                        googleRating: 4.2,
                        googleAddress: 'Japan, 〒101-0025 Tokyo, Chiyoda City, Kanda Sakumachō, 1-chōme−８−３',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMfZAmFkUjLUwz2RvL4JUZIJoJ-ahqlMesU9IA13AepSHMLAVE1wlmrwWi3rn5SBZ9_oplMX9Qoj_PgFwrufs5hnjpHTOrKkNLVzTmmisLatFZ7CYKNltT5AR5kG4FnfJsNYUH3vorEclWlDg=s4800-w1280-h900',
                        googleAttribution: '秋葉原ワシントンホテル',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-hotel-gracery',
                        caption: '秋葉原華盛頓飯店外觀，距車站步行約一分鐘。',
                        heading: '秋葉原ワシントンホテル · 步行可達電氣街',
                        content: 'JR 秋葉原站中央改札口步行約一分鐘，是把時間留給街上的務實落腳處。以秋葉原為基地、搭山手線一站前往中野，動線直覺。展期與週末記得提早訂房。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '交通首選' },
                            { icon: '🚉', label: '最近車站', value: 'JR 秋葉原（1 分鐘）' },
                            { icon: '💴', label: '預算', value: '¥10,000–16,000／晚' }
                        ]
                    }
                ],
                outro: '秋葉原與中野都在山手線上，Suica 或 Pasmo 就夠用。上午留給秋葉原，下午轉中野——兩站僅一站、約五分鐘。帶一行李箱的空格與行動電源，東京會在你以為逛完時，再送出一個驚喜。',
                cta: {
                    buttonText: '用這種風格產生行程',
                    destinationLabel: '東京',
                    styleKey: 'anime'
                }
            }
        }
    };

    global.SOARVIBE_CITY_JOURNAL = {
        editionCatalog: EDITION_CATALOG,
        meta: META,
        articles: ARTICLES,
        placeholderImage: CJ_PLACEHOLDER
    };
})(typeof window !== 'undefined' ? window : this);
