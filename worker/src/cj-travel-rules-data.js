/**
 * Travel photo rules — data only, no imports (avoids circular module init).
 */
export var TRAVEL_PHOTO_RULES = {
  version: 'travel-v1',
  principle: '選擇旅遊者最想看到的照片，不是隨機地點圖。',
  rules: [
    '街區/商圈/景點：第一張必須是代表整個區域的廣角街景、地標或全景',
    '商店：第一張優先店門口或外觀，第二張才是店內',
    '餐廳：第一張優先店門口、招牌、外觀，第二張才是餐點',
    '住宿：第一張優先外觀/入口，第二張 Lobby，第三張房型',
    '街區介紹必須至少有一張街景',
    '圖片必須直接對應文案描述',
    '搜尋優先當地語言，驗證不符則重新搜尋，禁止隨機 fallback'
  ]
};

export var TRAVEL_SEARCH_HINTS = {
  district: ['street view', 'panorama', 'main street', '街景', '全景'],
  shop: ['exterior', 'storefront', 'facade', '外観', '店門口'],
  restaurant: ['exterior', 'storefront', 'entrance', '外観', '招牌'],
  cafe: ['exterior', 'storefront', 'cafe entrance', '外観'],
  hotel: ['exterior', 'building', 'facade', '外観', '入口'],
  hostel: ['exterior', 'building', 'facade', '外観', '入口']
};
