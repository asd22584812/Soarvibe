/**
 * City Shares Firestore API — posts / comments / likes (Spark-friendly).
 *
 * Likes model (minimize reads):
 * - posts/{postId}/likes/{uid} existence = liked
 * - posts.likeCount denormalized via transaction (±1)
 *
 * Public browse: query status == 'published'
 * Official local seeds remain as fallback via city-shares-data.js
 */
(function (global) {
  'use strict';

  var COMMENT_MAX = 500;
  var TITLE_MAX = 80;
  var BODY_MAX = 600;
  var BODY_MIN = 20;
  /** Per-post media cap (enforced when citySharesMediaUpload is true; R2 later). */
  var MEDIA_MAX_PER_POST = 3;

  function mediaUploadEnabled() {
    var flags = global.SOARVIBE_FEATURE_FLAGS || {};
    return flags.citySharesMediaUpload === true;
  }

  function db() {
    return global.SOARVIBE_FIREBASE && global.SOARVIBE_FIREBASE.getDb
      ? global.SOARVIBE_FIREBASE.getDb()
      : null;
  }

  function authApi() {
    return global.SOARVIBE_AUTH || null;
  }

  function requireDb() {
    var database = db();
    if (!database) throw new Error('Firestore 未就緒');
    return database;
  }

  function requireUser() {
    var a = authApi();
    if (!a || !a.isSignedIn()) throw new Error('AUTH_REQUIRED');
    return a.currentUser();
  }

  function profileName() {
    var a = authApi();
    var p = a && a.getProfile ? a.getProfile() : null;
    var u = a && a.currentUser ? a.currentUser() : null;
    if (p && p.nickname) return String(p.nickname).slice(0, 32);
    if (u && u.displayName) return String(u.displayName).slice(0, 32);
    if (u && u.email) return String(u.email.split('@')[0]).slice(0, 32);
    return '旅人';
  }

  function locApi() {
    return global.SOARVIBE_CITY_SHARES_LOCATION || null;
  }

  function mapPostDoc(doc) {
    var data = doc.data() || {};
    var likeCount = data.likeCount || 0;
    var commentCount = data.commentCount || 0;
    var media = (data.media || []).map(function (m, idx) {
      var item = Object.assign({}, m || {});
      item.src = item.src || item.downloadURL || '';
      item.thumbSrc = item.thumbSrc || item.src || '';
      item.sortOrder = item.sortOrder != null ? item.sortOrder : idx;
      return item;
    });
    var mapped = Object.assign(
      {
        postId: doc.id,
        source: data.source || 'user',
        status: data.status || 'published',
        likeCount: likeCount,
        commentCount: commentCount,
        stats: {
          likeCount: likeCount,
          commentCount: commentCount,
          saveCount: data.saveCount || 0,
          beenCount: 0,
          wantCount: 0,
          avoidCount: 0
        },
        media: media,
        tags: data.tags || [],
        place: data.place || null,
        author: {
          authorId: data.authorId || '',
          displayName: data.authorDisplayName || '旅人',
          avatarUrl: data.authorAvatarUrl || ''
        }
      },
      data,
      {
        postId: doc.id,
        likeCount: likeCount,
        commentCount: commentCount,
        media: media,
        author: {
          authorId: data.authorId || '',
          displayName: data.authorDisplayName || '旅人',
          avatarUrl: data.authorAvatarUrl || ''
        },
        stats: {
          likeCount: likeCount,
          commentCount: commentCount,
          saveCount: data.saveCount || 0,
          beenCount: 0,
          wantCount: 0,
          avoidCount: 0
        }
      }
    );
    var loc = locApi();
    if (loc && typeof loc.normalizePostTaxonomy === 'function') {
      loc.normalizePostTaxonomy(mapped);
    }
    return mapped;
  }

  function listPublishedPosts(cityId, opt) {
    return listByCity(cityId, opt);
  }

  function listByCity(cityId, opt) {
    var database = requireDb();
    opt = opt || {};
    var limit = opt.limit || 40;
    var id = String(cityId || '').trim();
    if (!id) return Promise.resolve([]);
    var q = database
      .collection('posts')
      .where('status', '==', 'published')
      .where('cityId', '==', id)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    return q.get().then(function (snap) {
      return snap.docs.map(mapPostDoc);
    });
  }

  function listByCountry(countryId, opt) {
    var database = requireDb();
    opt = opt || {};
    var limit = opt.limit || 40;
    var id = String(countryId || '').trim();
    if (!id) return Promise.resolve([]);
    var q = database
      .collection('posts')
      .where('status', '==', 'published')
      .where('countryId', '==', id)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    return q
      .get()
      .then(function (snap) {
        return snap.docs.map(mapPostDoc);
      })
      .catch(function (err) {
        // Index may still be building — soft-fail empty for country feed.
        console.warn('[SOARVIBE] listByCountry failed', id, err && err.message);
        return [];
      });
  }

  function listByRegion(regionId, opt) {
    var database = requireDb();
    opt = opt || {};
    var limit = opt.limit || 40;
    var id = String(regionId || '').trim();
    if (!id) return Promise.resolve([]);
    var q = database
      .collection('posts')
      .where('status', '==', 'published')
      .where('regionId', '==', id)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    return q
      .get()
      .then(function (snap) {
        return snap.docs.map(mapPostDoc);
      })
      .catch(function (err) {
        console.warn('[SOARVIBE] listByRegion failed', id, err && err.message);
        // Legacy fallback: region cards previously used cityId == regionId (e.g. hokkaido)
        return listByCity(id, opt);
      });
  }

  function listFeedForScope(scope, opt) {
    scope = scope || {};
    var loc = locApi();
    if (scope.feedKind === 'country' && scope.countryId) {
      var cityIds = [];
      if (loc && loc.CITIES) {
        Object.keys(loc.CITIES).forEach(function (id) {
          if (loc.CITIES[id].countryId === scope.countryId) cityIds.push(id);
        });
      }
      // Legacy country-as-cityId entries (e.g. vietnam)
      if (scope.entryId && scope.entryId !== scope.countryId) {
        cityIds.push(scope.entryId);
      }
      cityIds.push(scope.countryId);
      var tasks = [listByCountry(scope.countryId, opt)].concat(
        cityIds.map(function (id) {
          return listByCity(id, opt).catch(function () {
            return [];
          });
        })
      );
      return Promise.all(tasks).then(function (lists) {
        var map = {};
        lists.forEach(function (arr) {
          (arr || []).forEach(function (p) {
            if (!p || !p.postId) return;
            if (loc && loc.normalizePostTaxonomy) loc.normalizePostTaxonomy(p);
            if (p.countryId === scope.countryId || (!p.countryId && cityIds.indexOf(p.cityId) !== -1)) {
              map[p.postId] = p;
              if (!p.countryId) p.countryId = scope.countryId;
            }
          });
        });
        return Object.keys(map)
          .map(function (k) {
            return map[k];
          })
          .sort(function (a, b) {
            var am =
              (a.createdAt && a.createdAt.toMillis && a.createdAt.toMillis()) || 0;
            var bm =
              (b.createdAt && b.createdAt.toMillis && b.createdAt.toMillis()) || 0;
            return bm - am;
          });
      });
    }
    if (scope.feedKind === 'region' && scope.regionId) {
      return listByRegion(scope.regionId, opt).then(function (byRegion) {
        return listByCity(scope.regionId, opt).then(function (legacy) {
          var map = {};
          (byRegion || []).concat(legacy || []).forEach(function (p) {
            if (p && p.postId) map[p.postId] = p;
          });
          // Also include sapporo etc. under region
          var regionCities = [];
          if (loc && loc.CITIES) {
            Object.keys(loc.CITIES).forEach(function (id) {
              if (loc.CITIES[id].regionId === scope.regionId) regionCities.push(id);
            });
          }
          return Promise.all(
            regionCities.map(function (id) {
              return listByCity(id, opt).catch(function () {
                return [];
              });
            })
          ).then(function (extra) {
            extra.forEach(function (arr) {
              (arr || []).forEach(function (p) {
                if (p && p.postId) map[p.postId] = p;
              });
            });
            return Object.keys(map)
              .map(function (k) {
                return map[k];
              })
              .sort(function (a, b) {
                var am =
                  (a.createdAt && a.createdAt.toMillis && a.createdAt.toMillis()) || 0;
                var bm =
                  (b.createdAt && b.createdAt.toMillis && b.createdAt.toMillis()) || 0;
                return bm - am;
              });
          });
        });
      });
    }
    if (scope.cityId) {
      return listByCity(scope.cityId, opt);
    }
    if (scope.entryId) {
      return listByCity(scope.entryId, opt);
    }
    return Promise.resolve([]);
  }

  function getPost(postId) {
    var database = requireDb();
    return database
      .collection('posts')
      .doc(postId)
      .get()
      .then(function (doc) {
        if (!doc.exists) return null;
        return mapPostDoc(doc);
      });
  }

  function storage() {
    return global.SOARVIBE_FIREBASE && global.SOARVIBE_FIREBASE.getStorage
      ? global.SOARVIBE_FIREBASE.getStorage()
      : null;
  }

  function uploadPostImages(uid, postId, files) {
    if (!mediaUploadEnabled()) {
      return Promise.resolve([]);
    }
    var store = storage();
    if (!files || !files.length) return Promise.resolve([]);
    if (!store) {
      return Promise.reject(new Error('照片上傳尚未啟用'));
    }
    var tasks = files.slice(0, MEDIA_MAX_PER_POST).map(function (file, idx) {
      if (!file) return Promise.resolve(null);
      var type = String(file.type || '');
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(type)) {
        return Promise.reject(new Error('僅支援 JPG / PNG / WEBP / GIF'));
      }
      if (file.size > 2 * 1024 * 1024) {
        return Promise.reject(new Error('單張照片請小於 2MB'));
      }
      var ext =
        type.indexOf('png') !== -1
          ? 'png'
          : type.indexOf('webp') !== -1
            ? 'webp'
            : type.indexOf('gif') !== -1
              ? 'gif'
              : 'jpg';
      var fileName = 'img-' + idx + '-' + Date.now() + '.' + ext;
      var path = 'city-shares/' + uid + '/' + postId + '/' + fileName;
      var ref = store.ref().child(path);
      return ref.put(file, { contentType: type }).then(function () {
        return ref.getDownloadURL().then(function (url) {
          return {
            mediaId: fileName,
            src: url,
            downloadURL: url,
            storagePath: path,
            type: type,
            sortOrder: idx,
            slot: 'other'
          };
        });
      });
    });
    return Promise.all(tasks).then(function (items) {
      return items.filter(Boolean);
    });
  }

  function resolveCreateTaxonomy(input) {
    var loc = locApi();
    var hints = {
      countryId: input.countryId,
      cityId: input.cityId,
      regionId: input.regionId,
      source: input.locationSource || 'manual'
    };
    var raw =
      input.locationRaw ||
      input.cityName ||
      input.cityQuery ||
      input.cityId ||
      '';
    var tax;
    if (loc && typeof loc.resolveLocation === 'function') {
      tax = loc.resolveLocation(raw, hints);
    } else {
      tax = {
        countryId: String(input.countryId || '').trim(),
        countryName: String(input.countryName || '').trim(),
        regionId: String(input.regionId || '').trim(),
        regionName: String(input.regionName || '').trim(),
        cityId: String(input.cityId || '').trim(),
        cityName: String(input.cityName || '').trim(),
        locationRaw: String(raw || ''),
        locationSource: hints.source
      };
    }
    if (input.countryId) tax.countryId = String(input.countryId).trim();
    if (input.countryName) tax.countryName = String(input.countryName).trim();
    if (input.regionId) tax.regionId = String(input.regionId).trim();
    if (input.regionName) tax.regionName = String(input.regionName).trim();
    if (input.cityId) tax.cityId = String(input.cityId).trim();
    if (input.cityName) tax.cityName = String(input.cityName).trim();
    if (input.locationRaw) tax.locationRaw = String(input.locationRaw).trim();
    return tax;
  }

  function createPost(input) {
    var user = requireUser();
    var database = requireDb();
    var title = String(input.title || '').trim().slice(0, TITLE_MAX);
    var body = String(input.body || '').trim().slice(0, BODY_MAX);
    var type = String(input.type || 'sightseeing').trim();
    var tax = resolveCreateTaxonomy(input || {});
    var cityId = String(tax.cityId || '').trim();
    var countryId = String(tax.countryId || '').trim();
    if (!title) return Promise.reject(new Error('請填寫標題'));
    if (body.length < BODY_MIN) return Promise.reject(new Error('心得至少 ' + BODY_MIN + ' 字'));
    if (!countryId) return Promise.reject(new Error('請選擇國家／地區'));
    // cityId may be empty for country-level posts (nullable by design)

    var a = authApi();
    var profile = a && a.getProfile ? a.getProfile() : null;
    var ref = database.collection('posts').doc();
    var postId = ref.id;
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var allowMedia = mediaUploadEnabled();
    var files = allowMedia && Array.isArray(input.mediaFiles) ? input.mediaFiles : [];
    var presetMedia =
      allowMedia && Array.isArray(input.media) && input.media.length
        ? input.media.slice(0, MEDIA_MAX_PER_POST)
        : null;

    return uploadPostImages(user.uid, postId, files).then(function (uploaded) {
      var media = presetMedia || uploaded || [];
      if (!allowMedia) media = [];
      var doc = {
        authorId: user.uid,
        authorDisplayName: profileName(),
        authorAvatarUrl: (profile && profile.avatarUrl) || user.photoURL || '',
        countryId: countryId,
        countryName: String(tax.countryName || '').trim().slice(0, 40),
        regionId: String(tax.regionId || '').trim().slice(0, 40),
        regionName: String(tax.regionName || '').trim().slice(0, 40),
        cityId: cityId,
        cityName: String(tax.cityName || '').trim().slice(0, 60),
        locationRaw: String(tax.locationRaw || '').trim().slice(0, 80),
        locationSource: String(tax.locationSource || 'manual').slice(0, 24),
        type: type,
        title: title,
        body: body,
        place: input.place || null,
        media: media,
        tags: Array.isArray(input.tags) ? input.tags.slice(0, 12) : [],
        status: 'published',
        source: 'user',
        likeCount: 0,
        commentCount: 0,
        saveCount: 0,
        createdAt: now,
        updatedAt: now
      };
      return ref.set(doc).then(function () {
        return getPost(postId);
      });
    });
  }

  function deletePost(postId) {
    var user = requireUser();
    var database = requireDb();
    var ref = database.collection('posts').doc(postId);
    return ref.get().then(function (snap) {
      if (!snap.exists) throw new Error('貼文不存在');
      if (snap.data().authorId !== user.uid) throw new Error('只能刪除自己的貼文');
      return ref.update({
        status: 'removed',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  }

  function listComments(postId, opt) {
    var database = requireDb();
    opt = opt || {};
    return database
      .collection('posts')
      .doc(postId)
      .collection('comments')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'asc')
      .limit(opt.limit || 80)
      .get()
      .then(function (snap) {
        return snap.docs.map(function (doc) {
          var d = doc.data() || {};
          return Object.assign({ commentId: doc.id }, d);
        });
      });
  }

  function addComment(postId, text) {
    var user = requireUser();
    var database = requireDb();
    var body = String(text || '').trim().slice(0, COMMENT_MAX);
    if (!body) return Promise.reject(new Error('請輸入留言'));
    var postRef = database.collection('posts').doc(postId);
    // Pre-allocate id so rules can bind opCommentId ↔ comments/{commentId}
    var commentRef = postRef.collection('comments').doc();
    var commentId = commentRef.id;
    var now = firebase.firestore.FieldValue.serverTimestamp();
    return database.runTransaction(function (tx) {
      return tx.get(postRef).then(function (postSnap) {
        if (!postSnap.exists) throw new Error('貼文不存在');
        if (postSnap.data().status !== 'published') {
          throw new Error('僅能在已公開貼文留言');
        }
        tx.set(commentRef, {
          authorId: user.uid,
          authorDisplayName: profileName(),
          text: body,
          status: 'published',
          createdAt: now,
          updatedAt: now
        });
        tx.update(postRef, {
          commentCount: firebase.firestore.FieldValue.increment(1),
          opCommentId: commentId,
          updatedAt: now
        });
      });
    }).then(function () {
      return commentId;
    });
  }

  function deleteComment(postId, commentId) {
    var user = requireUser();
    var database = requireDb();
    var postRef = database.collection('posts').doc(postId);
    var commentRef = postRef.collection('comments').doc(commentId);
    return database.runTransaction(function (tx) {
      return Promise.all([tx.get(postRef), tx.get(commentRef)]).then(function (pair) {
        var postSnap = pair[0];
        var snap = pair[1];
        if (!postSnap.exists) throw new Error('貼文不存在');
        if (!snap.exists) throw new Error('留言不存在');
        if (snap.data().authorId !== user.uid) throw new Error('只能刪除自己的留言');
        tx.delete(commentRef);
        tx.update(postRef, {
          commentCount: firebase.firestore.FieldValue.increment(-1),
          opCommentId: commentId,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    });
  }

  function hasLiked(postId) {
    var user = currentMaybeUser();
    if (!user) return Promise.resolve(false);
    var database = requireDb();
    return database
      .collection('posts')
      .doc(postId)
      .collection('likes')
      .doc(user.uid)
      .get()
      .then(function (snap) {
        return snap.exists;
      });
  }

  function hasSaved(postId) {
    var user = currentMaybeUser();
    if (!user) return Promise.resolve(false);
    var database = requireDb();
    return database
      .collection('users')
      .doc(user.uid)
      .collection('collections')
      .doc(postId)
      .get()
      .then(function (snap) {
        return snap.exists;
      });
  }

  function currentMaybeUser() {
    var a = authApi();
    return a && a.currentUser ? a.currentUser() : null;
  }

  function toggleLike(postId) {
    var user = requireUser();
    var database = requireDb();
    var postRef = database.collection('posts').doc(postId);
    var likeRef = postRef.collection('likes').doc(user.uid);
    return database.runTransaction(function (tx) {
      return Promise.all([tx.get(postRef), tx.get(likeRef)]).then(function (pair) {
        var postSnap = pair[0];
        var likeSnap = pair[1];
        if (!postSnap.exists) throw new Error('貼文不存在');
        var now = firebase.firestore.FieldValue.serverTimestamp();
        if (likeSnap.exists) {
          // Atomic: delete likes/{uid} + likeCount -1
          tx.delete(likeRef);
          tx.update(postRef, {
            likeCount: firebase.firestore.FieldValue.increment(-1),
            updatedAt: now
          });
          return { liked: false };
        }
        // Atomic: create likes/{uid} + likeCount +1
        tx.set(likeRef, { createdAt: now, uid: user.uid });
        tx.update(postRef, {
          likeCount: firebase.firestore.FieldValue.increment(1),
          updatedAt: now
        });
        return { liked: true };
      });
    });
  }

  /**
   * Save / unsave post (collections ↔ saveCount). Must be one transaction.
   */
  function toggleSave(postId, meta) {
    var user = requireUser();
    var database = requireDb();
    var postRef = database.collection('posts').doc(postId);
    var colRef = database.collection('users').doc(user.uid).collection('collections').doc(postId);
    meta = meta || {};
    return database.runTransaction(function (tx) {
      return Promise.all([tx.get(postRef), tx.get(colRef)]).then(function (pair) {
        var postSnap = pair[0];
        var colSnap = pair[1];
        if (!postSnap.exists) throw new Error('貼文不存在');
        var now = firebase.firestore.FieldValue.serverTimestamp();
        if (colSnap.exists) {
          tx.delete(colRef);
          tx.update(postRef, {
            saveCount: firebase.firestore.FieldValue.increment(-1),
            updatedAt: now
          });
          return { saved: false };
        }
        tx.set(colRef, {
          uid: user.uid,
          postId: postId,
          cityId: postSnap.data().cityId || meta.cityId || '',
          title: postSnap.data().title || meta.title || '',
          createdAt: now
        });
        tx.update(postRef, {
          saveCount: firebase.firestore.FieldValue.increment(1),
          updatedAt: now
        });
        return { saved: true };
      });
    });
  }

  function mergeFeed(cityId, localPosts) {
    return listPublishedPosts(cityId)
      .then(function (remote) {
        var map = {};
        (localPosts || []).forEach(function (p) {
          if (p && p.postId) map[p.postId] = p;
        });
        remote.forEach(function (p) {
          map[p.postId] = p;
        });
        return Object.keys(map).map(function (k) {
          return map[k];
        });
      })
      .catch(function (e) {
        console.warn('[SOARVIBE] Firestore feed fallback to local seeds', e);
        return localPosts || [];
      });
  }

  global.SOARVIBE_CITY_SHARES_API = {
    listPublishedPosts: listPublishedPosts,
    listByCity: listByCity,
    listByCountry: listByCountry,
    listByRegion: listByRegion,
    listFeedForScope: listFeedForScope,
    getPost: getPost,
    createPost: createPost,
    deletePost: deletePost,
    listComments: listComments,
    addComment: addComment,
    deleteComment: deleteComment,
    hasLiked: hasLiked,
    hasSaved: hasSaved,
    toggleLike: toggleLike,
    toggleSave: toggleSave,
    mergeFeed: mergeFeed
  };
})(typeof window !== 'undefined' ? window : globalThis);
