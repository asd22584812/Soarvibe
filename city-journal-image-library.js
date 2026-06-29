(function (global) {
    'use strict';

    /**
     * Editorial Image Library — city-scoped fallbacks when Google Places has no suitable photo.
     * Keys: hero, food, cafe, shopping, hotel, street, landmark, night
     */
    var LIBRARY = {
        tokyo: {
            hero: './assets/city-journal/tokyo/tokyo-anime-hero.jpg',
            landmark: './assets/city-journal/tokyo/akihabara-electric-town.jpg',
            shopping: './assets/city-journal/tokyo/gachapon-hall.jpg',
            food: './assets/city-journal/tokyo/ichiran-ramen.jpg',
            cafe: './assets/city-journal/tokyo/maid-cafe.jpg',
            hotel: './assets/city-journal/tokyo/hotel-gracery.jpg',
            street: './assets/city-journal/tokyo/akihabara-electric-town.jpg',
            night: './assets/city-journal/tokyo/tokyo-anime-hero.jpg'
        }
    };

    function resolveEditorialFallback(cityId, category) {
        var city = LIBRARY[cityId];
        if (!city) return null;
        return city[category] || city.landmark || null;
    }

    global.SOARVIBE_CJ_IMAGE_LIBRARY = {
        library: LIBRARY,
        resolveEditorialFallback: resolveEditorialFallback
    };
})(typeof window !== 'undefined' ? window : this);
