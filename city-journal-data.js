(function (global) {
    'use strict';

    var EDITION_CATALOG = [
        { key: 'budget', label: '小資旅行', icon: '💰' },
        { key: 'sightseeing', label: '初次觀光', icon: '🗺️' },
        { key: 'trendy', label: '新潮熱門', icon: '⚡' },
        { key: 'foodie', label: '美食吃貨', icon: '🍜' },
        { key: 'photospot', label: '網美必拍', icon: '📸' },
        { key: 'anime', label: '玩具動漫', icon: '🎮' },
        { key: 'streetwear', label: '潮流玩家', icon: '👟' }
    ];

    var META = {
        tokyo: {
            id: 'tokyo',
            name: '東京',
            nameEn: 'TOKYO',
            destinationLabel: '東京',
            hubHeroImage: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=1200',
            hubSubtitle: '七種節奏，讀懂這座永遠不睡的城市',
            publishedEditions: ['anime']
        },
        kyoto: {
            id: 'kyoto',
            name: '京都',
            nameEn: 'KYOTO',
            destinationLabel: '京都',
            hubHeroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        osaka: {
            id: 'osaka',
            name: '大阪',
            nameEn: 'OSAKA',
            destinationLabel: '大阪',
            hubHeroImage: 'https://images.unsplash.com/photo-1590559899731-a3826db94655?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        seoul: {
            id: 'seoul',
            name: '首爾',
            nameEn: 'SEOUL',
            destinationLabel: '首爾',
            hubHeroImage: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        hokkaido: {
            id: 'hokkaido',
            name: '北海道',
            nameEn: 'HOKKAIDO',
            destinationLabel: '北海道',
            hubHeroImage: 'https://images.unsplash.com/photo-1578507065211-17efed996086?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        bangkok: {
            id: 'bangkok',
            name: '曼谷',
            nameEn: 'BANGKOK',
            destinationLabel: '曼谷',
            hubHeroImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        vietnam: {
            id: 'vietnam',
            name: '越南',
            nameEn: 'VIETNAM',
            destinationLabel: '越南',
            hubHeroImage: 'https://images.unsplash.com/photo-1509060464153-44667396260f?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        london: {
            id: 'london',
            name: '倫敦',
            nameEn: 'LONDON',
            destinationLabel: '倫敦',
            hubHeroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        paris: {
            id: 'paris',
            name: '巴黎',
            nameEn: 'PARIS',
            destinationLabel: '巴黎',
            hubHeroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        }
    };

    var ARTICLES = {
        tokyo: {
            anime: {
                id: 'tokyo-anime',
                cityId: 'tokyo',
                styleKey: 'anime',
                status: 'published',
                title: '秋葉原與中野：東京動漫聖地巡禮指南',
                subtitle: '從一番賞到復古玩具，骨灰級玩家的 48 小時地圖',
                heroImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200',
                issueDate: '2026-06',
                issueLabel: '2026 年 6 月號',
                intro: '東京對動漫迷而言，從來不是「去幾個景點打卡」就能結束的旅程。這座城市把次文化藏進電氣街的霓虹裡、藏進中野百老匯的二手櫃位中，也藏進巷弄轉角那台你以為只是路過的扭蛋機。動漫系東京旅行的核心，不是趕場把清單劃掉，而是以 2 到 3 小時為單位做「塊狀掃街」：先鎖定一番賞現貨與期間限定，再慢慢挖中古公仔、模型與冷門周邊。你不需要成為資深藏家才能玩得盡興——但你需要一份把體力留給真正想逛的店的節奏。這篇專題為第一次以動漫視角認識東京的旅人，也為想重溫聖地、更新地圖的老玩家而寫。最佳季節是春秋兩季，步行舒適、排隊壓力較小；若逢週末或連假，熱門店建議開店前 30 分鐘抵達。帶上空行李箱的一格、行動電源，以及一顆願意在冷門樓層多繞一圈的心——東京會在你以為已經逛完時，再送出一個驚喜。',
                spots: [
                    {
                        id: 'spot-akihabara',
                        name: '秋葉原電氣街',
                        nameLocal: '秋葉原電気街',
                        image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800',
                        imageKey: 'tokyo-akihabara',
                        intro: '東京動漫朝聖的起點。高樓與巷弄交錯，從大型連鎖動漫店到地下卡牌、模型專賣應有盡有。建議從 JR 秋葉原站電氣街口出發，先逛 2 至 3 間主題明確的店，避免在第一眼就被拉進無限迴圈。',
                        rating: 4.5,
                        ratingCount: 48200,
                        mapsQuery: '秋葉原電氣街 東京'
                    },
                    {
                        id: 'spot-nakano',
                        name: '中野百老匯',
                        nameLocal: '中野ブロードウェイ',
                        image: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=800',
                        imageKey: 'tokyo-nakano',
                        intro: '被許多老玩家視為比秋葉原更好挖寶的聖地。多層樓匯集漫畫、公仔、卡牌與復古玩具，價格常有驚喜。適合下午進場，光線較暖，邊逛邊比價，預留至少 2 小時。',
                        rating: 4.4,
                        ratingCount: 12600,
                        mapsQuery: '中野百老匯 東京'
                    },
                    {
                        id: 'spot-gachapon',
                        name: 'GACHAPON 扭蛋會館',
                        nameLocal: 'ガシャポンのデパート',
                        image: 'https://images.unsplash.com/photo-1613376021183-4127bb866ebd?q=80&w=800',
                        imageKey: 'tokyo-gachapon',
                        intro: '秋葉原周邊知名的扭蛋專門空間，整面牆的機台適合快速試手氣與收藏入門。建議先設定預算上限，避免不知不覺轉到行李箱爆滿——這是過來人的溫柔提醒。',
                        rating: 4.3,
                        ratingCount: 8900,
                        mapsQuery: 'GACHAPON 秋葉原'
                    }
                ],
                foods: [
                    {
                        id: 'food-ichiran-akiba',
                        name: '一蘭拉麵 秋葉原店',
                        cuisine: '拉麵',
                        priceLevel: '¥',
                        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800',
                        imageKey: 'tokyo-ramen',
                        intro: '掃街到一半最需要熱湯補給的標準答案。一人一格的設計讓獨旅也自在，濃郁豚骨湯底快速回血。建議避開 12:00–13:30 午餐尖峰，或先取號再回周邊逛一圈。',
                        rating: 4.2,
                        ratingCount: 15600,
                        mapsQuery: '一蘭拉麵 秋葉原'
                    },
                    {
                        id: 'food-maidcafe',
                        name: '秋葉原女僕咖啡廳街',
                        cuisine: '主題咖啡',
                        priceLevel: '¥¥',
                        image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=800',
                        imageKey: 'tokyo-cafe',
                        intro: '體驗東京次文化氛圍的經典方式之一。各家風格不同，從經典女僕到主題聯名皆有。若第一次嘗試，選評價穩定、規則說明清楚的分店，把時間控制在 60 分鐘內，留體力給下一間店。',
                        rating: 4.1,
                        ratingCount: 7200,
                        mapsQuery: '秋葉原 女僕咖啡廳'
                    },
                    {
                        id: 'food-curry-akiba',
                        name: '咖哩屋香料 秋葉原',
                        cuisine: '日式咖哩',
                        priceLevel: '¥',
                        image: 'https://images.unsplash.com/photo-1604908176997-43162e978c67?q=80&w=800',
                        imageKey: 'tokyo-curry',
                        intro: '動漫街區常見的平價能量補給。香料層次分明、飯量足夠，適合傍晚掃街後的晚餐。上菜快、翻桌率高，是趕夜間活動前的務實選擇。',
                        rating: 4.0,
                        ratingCount: 4100,
                        mapsQuery: '咖哩 秋葉原'
                    }
                ],
                hotels: [
                    {
                        id: 'hotel-gracery-akihabara',
                        name: 'Hotel Gracery 秋葉原',
                        area: '秋葉原',
                        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800',
                        imageKey: 'tokyo-hotel-1',
                        intro: '步行可達電氣街，動漫迷的經典落腳處。房間緊湊但機能完整，適合把時間花在街上而非飯店的人。建議提早預訂週末房型。',
                        rating: 4.3,
                        priceRange: '¥12,000–18,000 / 晚',
                        mapsQuery: 'Hotel Gracery 秋葉原'
                    },
                    {
                        id: 'hotel-nui-hostel',
                        name: 'Nui. HOSTEL & BAR LOUNGE',
                        area: '淺草橋',
                        image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=800',
                        imageKey: 'tokyo-hotel-2',
                        intro: '文青感十足的旅宿，公共空間寬敞，適合獨旅或輕預算玩家。到秋葉原約 15 分鐘電車，適合想平衡住宿質感與交通的旅人。',
                        rating: 4.5,
                        priceRange: '¥4,500–8,000 / 晚',
                        mapsQuery: 'Nui HOSTEL 東京'
                    }
                ],
                transport: {
                    title: '動漫聖地交通攻略',
                    summary: '秋葉原與中野皆在 JR 山手線沿線，動漫一日掃街建議以 Suica 或 Pasmo 為主，減少買票時間。',
                    sections: [
                        {
                            heading: '機場進市區',
                            body: '成田機場可搭 N\'EX 或 Skyliner 轉山手線至秋葉原；羽田機場則以京急線轉 JR 最為直覺。若行李較多，下午進城、先放飯店再開逛，體力會差很多。',
                            tips: ['建議在機場或車站購買 Suica', '週五晚間山手線較擁擠，預留站立空間']
                        },
                        {
                            heading: '聖地間移動',
                            body: '秋葉原 ↔ 中野僅一站山手線，約 5 分鐘。建議上午秋葉原、下午中野，或反過來，避免中午在兩站間來回拉車。',
                            tips: ['週末中野站出口人潮多，從北口出較接近百老匯', '大型戰利品可暫放飯店再出門第二輪']
                        }
                    ]
                },
                itinerary: {
                    title: '動漫聖地一日精華',
                    summary: '適合第一次以動漫視角逛東京的旅人，不趕場、保留彈性。',
                    slots: [
                        {
                            time: '09:30',
                            label: '上午',
                            title: '秋葉原開店掃街',
                            desc: '從電氣街口出發，先攻一番賞與限定周邊，再逛 1 至 2 間模型或卡牌專賣。'
                        },
                        {
                            time: '12:30',
                            label: '中午',
                            title: '拉麵補給＋短休',
                            desc: '一蘭或周邊平價咖哩，避開最尖峰時段。'
                        },
                        {
                            time: '14:00',
                            label: '下午',
                            title: '中野百老匯挖寶',
                            desc: '搭山手線一站抵達，專攻中古公仔與冷門櫃位，預留 2 小時。'
                        },
                        {
                            time: '17:30',
                            label: '傍晚',
                            title: '扭蛋＋女僕咖啡體驗',
                            desc: '回秋葉原收尾，GACHAPON 試手氣，可選一間主題咖啡感受氛圍。'
                        },
                        {
                            time: '19:30',
                            label: '晚上',
                            title: '自由探索或回飯店整理戰利品',
                            desc: '若體力許可，可逛夜間電氣街霓虹；否則回飯店分裝行李，為明天保留體力。'
                        }
                    ]
                },
                cta: {
                    buttonText: '用這種風格產生行程',
                    destinationLabel: '東京',
                    styleKey: 'anime'
                }
            }
        }
    };

    var IMAGE_DEFAULTS = {
        spot: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800',
        food: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800',
        hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800',
        hero: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=1200'
    };

    global.SOARVIBE_CITY_JOURNAL = {
        editionCatalog: EDITION_CATALOG,
        meta: META,
        articles: ARTICLES,
        imageDefaults: IMAGE_DEFAULTS
    };
})(typeof window !== 'undefined' ? window : this);
