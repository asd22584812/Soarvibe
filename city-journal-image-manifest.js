(function (global) {
    'use strict';

    var CJ_BASE = './assets/city-journal';
    var CJ_PLACEHOLDER = CJ_BASE + '/placeholder-city-journal.jpg';

    function entry(imageKey, fileName, cityId, styleKey, category, subject, allowedFor) {
        return {
            imageKey: imageKey,
            filePath: CJ_BASE + '/tokyo/' + fileName,
            cityId: cityId,
            styleKey: styleKey || null,
            category: category,
            subject: subject,
            allowedFor: allowedFor || [],
            verified: true
        };
    }

  /**
   * Only verified Tokyo Anime assets are listed.
   * All other city/style combinations must render placeholder until curated.
   */
    var cityJournalImageManifest = {
        'tokyo-hub-hero': entry('tokyo-hub-hero', 'tokyo-hero.jpg', 'tokyo', null, 'hub-hero', 'tokyo-city-skyline', ['hub']),
        'tokyo-anime-cover': entry('tokyo-anime-cover', 'tokyo-anime-cover.jpg', 'tokyo', 'anime', 'edition-cover', 'akihabara-anime-district', ['edition-cover']),
        'tokyo-anime-hero': entry('tokyo-anime-hero', 'tokyo-anime-hero.jpg', 'tokyo', 'anime', 'article-hero', 'akihabara-night', ['article-hero']),
        'tokyo-section-akihabara': entry('tokyo-section-akihabara', 'akihabara-electric-town.jpg', 'tokyo', 'anime', 'section', 'akihabara-electric-town', ['section']),
        'tokyo-section-nakano': entry('tokyo-section-nakano', 'nakano-broadway.jpg', 'tokyo', 'anime', 'section', 'nakano-broadway-figures', ['section']),
        'tokyo-section-gachapon': entry('tokyo-section-gachapon', 'gachapon-hall.jpg', 'tokyo', 'anime', 'section', 'gachapon-machines', ['section']),
        'tokyo-section-ichiran': entry('tokyo-section-ichiran', 'ichiran-ramen.jpg', 'tokyo', 'anime', 'section', 'ichiran-ramen', ['section']),
        'tokyo-section-maid-cafe': entry('tokyo-section-maid-cafe', 'maid-cafe.jpg', 'tokyo', 'anime', 'section', 'maid-cafe-dessert', ['section']),
        'tokyo-section-curry': entry('tokyo-section-curry', 'japanese-curry.jpg', 'tokyo', 'anime', 'section', 'japanese-curry', ['section']),
        'tokyo-section-hotel-gracery': entry('tokyo-section-hotel-gracery', 'hotel-gracery.jpg', 'tokyo', 'anime', 'section', 'tokyo-business-hotel', ['section'])
    };

    function validateManifestContext(manifestEntry, context) {
        if (!manifestEntry || !manifestEntry.verified) return false;
        if (!context || !context.cityId) return false;
        if (manifestEntry.cityId !== context.cityId) return false;
        if (context.category && manifestEntry.category !== context.category) return false;
        if (manifestEntry.styleKey && context.styleKey && manifestEntry.styleKey !== context.styleKey) return false;
        if (context.allowedFor && context.allowedFor.length) {
            var ok = false;
            for (var i = 0; i < context.allowedFor.length; i++) {
                if (manifestEntry.allowedFor.indexOf(context.allowedFor[i]) !== -1) {
                    ok = true;
                    break;
                }
            }
            if (!ok) return false;
        }
        if (context.imageKey && context.imageKey !== manifestEntry.imageKey) return false;
        if (context.sectionId) {
            var expectedKey = 'tokyo-section-' + context.sectionId;
            if (manifestEntry.imageKey !== expectedKey && manifestEntry.imageKey.indexOf(context.sectionId) === -1) {
                return false;
            }
        }
        return true;
    }

    function resolveManifestImage(imageKey, context) {
        var manifestEntry = cityJournalImageManifest[imageKey];
        if (!validateManifestContext(manifestEntry, Object.assign({ imageKey: imageKey }, context || {}))) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[CJ IMAGE REJECTED]', imageKey, context);
            }
            return CJ_PLACEHOLDER;
        }
        return manifestEntry.filePath;
    }

    function isManifestImageVerified(imageKey) {
        var manifestEntry = cityJournalImageManifest[imageKey];
        return !!(manifestEntry && manifestEntry.verified);
    }

    global.SOARVIBE_CJ_IMAGE_MANIFEST = {
        placeholder: CJ_PLACEHOLDER,
        cityJournalImageManifest: cityJournalImageManifest,
        validateManifestContext: validateManifestContext,
        resolveManifestImage: resolveManifestImage,
        isManifestImageVerified: isManifestImageVerified
    };
})(typeof window !== 'undefined' ? window : this);
