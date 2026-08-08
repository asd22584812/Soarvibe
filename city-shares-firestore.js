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

  function mapPostDoc(doc) {
    var data = doc.data() || {};
    var likeCount = data.likeCount || 0;
    var commentCount = data.commentCount || 0;
    return Object.assign(
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
        media: data.media || [],
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
  }

  function listPublishedPosts(cityId, opt) {
    var database = requireDb();
    opt = opt || {};
    var limit = opt.limit || 40;
    var q = database
      .collection('posts')
      .where('status', '==', 'published')
      .where('cityId', '==', cityId)
      .orderBy('createdAt', 'desc')
      .limit(limit);
    return q.get().then(function (snap) {
      return snap.docs.map(mapPostDoc);
    });
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

  function createPost(input) {
    var user = requireUser();
    var database = requireDb();
    var title = String(input.title || '').trim().slice(0, TITLE_MAX);
    var body = String(input.body || '').trim().slice(0, BODY_MAX);
    var cityId = String(input.cityId || '').trim();
    var type = String(input.type || 'sightseeing').trim();
    if (!title) return Promise.reject(new Error('請填寫標題'));
    if (body.length < BODY_MIN) return Promise.reject(new Error('心得至少 ' + BODY_MIN + ' 字'));
    if (!cityId) return Promise.reject(new Error('請選擇城市'));

    var a = authApi();
    var profile = a && a.getProfile ? a.getProfile() : null;
    var ref = database.collection('posts').doc();
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var doc = {
      authorId: user.uid,
      authorDisplayName: profileName(),
      authorAvatarUrl: (profile && profile.avatarUrl) || user.photoURL || '',
      cityId: cityId,
      type: type,
      title: title,
      body: body,
      place: input.place || null,
      media: Array.isArray(input.media) ? input.media.slice(0, 6) : [],
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
      return getPost(ref.id);
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
