/**
 * Firestore Rules Emulator acceptance — P3A atomic counters.
 * Run: npm run test:rules
 * (via firebase emulators:exec --only firestore)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  runTransaction,
  increment,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';


const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROJECT_ID = 'demo-soarvibe';
const RULES = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');

const USER_A = 'user_a';
const USER_B = 'user_b';
const POST_PUB = 'post_published';
const POST_DRAFT = 'post_draft';

let testEnv;

function publishedPost(overrides = {}) {
  return {
    authorId: USER_A,
    authorDisplayName: 'Alice',
    authorAvatarUrl: '',
    countryId: 'japan',
    countryName: '日本',
    regionId: '',
    regionName: '',
    cityId: 'tokyo',
    cityName: '東京',
    locationRaw: '東京',
    locationSource: 'manual',
    type: 'food',
    title: '測試貼文標題夠長',
    body: '這是一段至少二十個字的測試正文內容喔真的',
    place: null,
    media: [],
    tags: [],
    status: 'published',
    source: 'user',
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides
  };
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'posts', POST_PUB), publishedPost());
    await setDoc(
      doc(db, 'posts', POST_DRAFT),
      publishedPost({ status: 'draft', title: '草稿貼文標題夠長了' })
    );
    await setDoc(doc(db, 'posts', 'post_hidden'), publishedPost({ status: 'hidden' }));
    await setDoc(doc(db, 'posts', 'post_removed'), publishedPost({ status: 'removed' }));
    await setDoc(doc(db, 'users', USER_A), {
      uid: USER_A,
      nickname: 'Alice',
      displayName: 'Alice',
      email: 'a@test.com',
      avatarUrl: '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'users', USER_B), {
      uid: USER_B,
      nickname: 'Bob',
      displayName: 'Bob',
      email: 'b@test.com',
      avatarUrl: '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, 'users', USER_B, 'private', 'notes'), {
      shopping: 'secret'
    });
    await setDoc(doc(db, 'users', USER_B, 'collections', POST_PUB), {
      uid: USER_B,
      postId: POST_PUB,
      createdAt: Timestamp.now()
    });
  });
}

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function dbGuest() {
  return testEnv.unauthenticatedContext().firestore();
}

/**
 * Load city-shares-firestore.js in the SAME JS realm as the modular SDK
 * (vm sandboxes create cross-realm objects that Firestore rejects).
 */
function installCitySharesRuntime(modularDb, authUser) {
  function refFromPath(path) {
    return doc(modularDb, ...path.split('/'));
  }

  function wrapDoc(ref) {
    return {
      id: ref.id,
      path: ref.path,
      collection(name) {
        return wrapCollection(collection(ref, name));
      },
      async get() {
        const snap = await getDoc(ref);
        return {
          exists: snap.exists(),
          data: () => snap.data(),
          id: snap.id
        };
      }
    };
  }

  function wrapCollection(colRef) {
    return {
      doc(id) {
        const ref = id != null ? doc(colRef, id) : doc(colRef);
        return wrapDoc(ref);
      }
    };
  }

  const database = {
    collection(name) {
      return wrapCollection(collection(modularDb, name));
    },
    runTransaction(updateFn) {
      return runTransaction(modularDb, async (tx) => {
        const compatTx = {
          get(compatRef) {
            return tx.get(refFromPath(compatRef.path)).then((snap) => ({
              exists: snap.exists(),
              data: () => snap.data(),
              id: snap.id
            }));
          },
          set(compatRef, data) {
            tx.set(refFromPath(compatRef.path), data);
          },
          update(compatRef, data) {
            tx.update(refFromPath(compatRef.path), data);
          },
          delete(compatRef) {
            tx.delete(refFromPath(compatRef.path));
          }
        };
        return updateFn(compatTx);
      });
    }
  };

  globalThis.firebase = {
    firestore: {
      FieldValue: {
        serverTimestamp: () => serverTimestamp(),
        increment: (n) => increment(n)
      }
    }
  };
  globalThis.SOARVIBE_FIREBASE = {
    getDb: () => database,
    init: () => ({ db: database }),
    isReady: () => true
  };
  globalThis.SOARVIBE_AUTH = {
    isSignedIn: () => !!authUser,
    currentUser: () => authUser,
    getProfile: () =>
      authUser
        ? { uid: authUser.uid, nickname: authUser.displayName || '旅人', avatarUrl: '' }
        : null
  };

  const code = readFileSync(join(ROOT, 'city-shares-firestore.js'), 'utf8');
  // Same-realm eval so plain objects are accepted by Firestore
  // eslint-disable-next-line no-eval
  (0, eval)(code);
  return globalThis.SOARVIBE_CITY_SHARES_API;
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: '127.0.0.1',
      port: 8080
    }
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe('LIKE atomic consistency', () => {
  it('1. like child + likeCount +1 same transaction → PASS', async () => {
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    const likeRef = doc(db, 'posts', POST_PUB, 'likes', USER_A);
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.set(likeRef, { uid: USER_A, createdAt: serverTimestamp() });
        tx.update(postRef, { likeCount: increment(1), updatedAt: serverTimestamp() });
      })
    );
  });

  it('2. only create like child → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      setDoc(doc(db, 'posts', POST_PUB, 'likes', USER_A), {
        uid: USER_A,
        createdAt: serverTimestamp()
      })
    );
  });

  it('3. only likeCount +1 → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      updateDoc(doc(db, 'posts', POST_PUB), {
        likeCount: increment(1),
        updatedAt: serverTimestamp()
      })
    );
  });

  it('4. likeCount +2 → DENY', async () => {
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    const likeRef = doc(db, 'posts', POST_PUB, 'likes', USER_A);
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.set(likeRef, { uid: USER_A, createdAt: serverTimestamp() });
        tx.update(postRef, { likeCount: increment(2), updatedAt: serverTimestamp() });
      })
    );
  });

  it('5. unlike delete + likeCount -1 → PASS', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', POST_PUB, 'likes', USER_A), { uid: USER_A });
      await updateDoc(doc(db, 'posts', POST_PUB), { likeCount: 1 });
    });
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    const likeRef = doc(db, 'posts', POST_PUB, 'likes', USER_A);
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: increment(-1), updatedAt: serverTimestamp() });
      })
    );
  });

  it('6. delete someone else like → DENY', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', POST_PUB, 'likes', USER_A), { uid: USER_A });
      await updateDoc(doc(db, 'posts', POST_PUB), { likeCount: 1 });
    });
    const db = dbAs(USER_B);
    const postRef = doc(db, 'posts', POST_PUB);
    const likeRef = doc(db, 'posts', POST_PUB, 'likes', USER_A);
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: increment(-1), updatedAt: serverTimestamp() });
      })
    );
  });

  it('7. likeCount becomes negative → DENY', async () => {
    const db = dbAs(USER_A);
    // Seed a like without matching count=0 so -1 would go negative if unlike attempted
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'posts', POST_PUB, 'likes', USER_A), {
        uid: USER_A
      });
      // likeCount stays 0
    });
    const postRef = doc(db, 'posts', POST_PUB);
    const likeRef = doc(db, 'posts', POST_PUB, 'likes', USER_A);
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: increment(-1), updatedAt: serverTimestamp() });
      })
    );
  });
});

describe('SAVE atomic consistency', () => {
  it('8. collection child + saveCount +1 → PASS', async () => {
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    const colRef = doc(db, 'users', USER_A, 'collections', POST_PUB);
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.set(colRef, {
          uid: USER_A,
          postId: POST_PUB,
          createdAt: serverTimestamp()
        });
        tx.update(postRef, { saveCount: increment(1), updatedAt: serverTimestamp() });
      })
    );
  });

  it('9. only create collection → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      setDoc(doc(db, 'users', USER_A, 'collections', POST_PUB), {
        uid: USER_A,
        postId: POST_PUB,
        createdAt: serverTimestamp()
      })
    );
  });

  it('10. only saveCount +1 → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      updateDoc(doc(db, 'posts', POST_PUB), {
        saveCount: increment(1),
        updatedAt: serverTimestamp()
      })
    );
  });

  it('11. write collection under another user → DENY', async () => {
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    const colRef = doc(db, 'users', USER_B, 'collections', POST_PUB);
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.set(colRef, {
          uid: USER_B,
          postId: POST_PUB,
          createdAt: serverTimestamp()
        });
        tx.update(postRef, { saveCount: increment(1), updatedAt: serverTimestamp() });
      })
    );
  });

  it('12. unsave + saveCount -1 → PASS', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', USER_A, 'collections', POST_PUB), {
        uid: USER_A,
        postId: POST_PUB
      });
      await updateDoc(doc(db, 'posts', POST_PUB), { saveCount: 1 });
    });
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    const colRef = doc(db, 'users', USER_A, 'collections', POST_PUB);
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.delete(colRef);
        tx.update(postRef, { saveCount: increment(-1), updatedAt: serverTimestamp() });
      })
    );
  });
});

describe('COMMENT atomic consistency', () => {
  it('13. published: comment + count +1 + opCommentId → PASS', async () => {
    const db = dbAs(USER_B);
    const postRef = doc(db, 'posts', POST_PUB);
    const commentRef = doc(collection(db, 'posts', POST_PUB, 'comments'));
    const commentId = commentRef.id;
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.set(commentRef, {
          authorId: USER_B,
          authorDisplayName: 'Bob',
          text: '好棒的分享補充',
          status: 'published',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        tx.update(postRef, {
          commentCount: increment(1),
          opCommentId: commentId,
          updatedAt: serverTimestamp()
        });
      })
    );
  });

  it('14. draft/hidden/removed post comment → DENY', async () => {
    for (const postId of [POST_DRAFT, 'post_hidden', 'post_removed']) {
      const db = dbAs(USER_B);
      const postRef = doc(db, 'posts', postId);
      const commentRef = doc(collection(db, 'posts', postId, 'comments'));
      const commentId = commentRef.id;
      await assertFails(
        runTransaction(db, async (tx) => {
          tx.set(commentRef, {
            authorId: USER_B,
            authorDisplayName: 'Bob',
            text: '不該出現的留言內容',
            status: 'published',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          tx.update(postRef, {
            commentCount: increment(1),
            opCommentId: commentId,
            updatedAt: serverTimestamp()
          });
        })
      );
    }
  });

  it('15. only create comment → DENY', async () => {
    const db = dbAs(USER_B);
    await assertFails(
      setDoc(doc(collection(db, 'posts', POST_PUB, 'comments')), {
        authorId: USER_B,
        authorDisplayName: 'Bob',
        text: '只有留言沒有計數',
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  it('16. only commentCount +1 → DENY', async () => {
    const db = dbAs(USER_B);
    await assertFails(
      updateDoc(doc(db, 'posts', POST_PUB), {
        commentCount: increment(1),
        opCommentId: 'fake_id',
        updatedAt: serverTimestamp()
      })
    );
  });

  it('17. wrong opCommentId → DENY', async () => {
    const db = dbAs(USER_B);
    const postRef = doc(db, 'posts', POST_PUB);
    const commentRef = doc(collection(db, 'posts', POST_PUB, 'comments'));
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.set(commentRef, {
          authorId: USER_B,
          authorDisplayName: 'Bob',
          text: 'opCommentId 對不上',
          status: 'published',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        tx.update(postRef, {
          commentCount: increment(1),
          opCommentId: 'not_the_real_id',
          updatedAt: serverTimestamp()
        });
      })
    );
  });

  it('18. commentCount +2 → DENY', async () => {
    const db = dbAs(USER_B);
    const postRef = doc(db, 'posts', POST_PUB);
    const commentRef = doc(collection(db, 'posts', POST_PUB, 'comments'));
    const commentId = commentRef.id;
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.set(commentRef, {
          authorId: USER_B,
          authorDisplayName: 'Bob',
          text: '一次加兩個不合法',
          status: 'published',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        tx.update(postRef, {
          commentCount: increment(2),
          opCommentId: commentId,
          updatedAt: serverTimestamp()
        });
      })
    );
  });

  it('19. author delete comment + count -1 + opCommentId → PASS', async () => {
    const commentId = 'cmt_author_a';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', POST_PUB, 'comments', commentId), {
        authorId: USER_A,
        authorDisplayName: 'Alice',
        text: '我的留言可以被刪',
        status: 'published',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      await updateDoc(doc(db, 'posts', POST_PUB), { commentCount: 1, opCommentId: commentId });
    });
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    const commentRef = doc(db, 'posts', POST_PUB, 'comments', commentId);
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.delete(commentRef);
        tx.update(postRef, {
          commentCount: increment(-1),
          opCommentId: commentId,
          updatedAt: serverTimestamp()
        });
      })
    );
  });

  it('20. delete someone else comment → DENY', async () => {
    const commentId = 'cmt_author_a2';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', POST_PUB, 'comments', commentId), {
        authorId: USER_A,
        text: '別人不能刪我',
        status: 'published',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      await updateDoc(doc(db, 'posts', POST_PUB), { commentCount: 1 });
    });
    const db = dbAs(USER_B);
    const postRef = doc(db, 'posts', POST_PUB);
    const commentRef = doc(db, 'posts', POST_PUB, 'comments', commentId);
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.delete(commentRef);
        tx.update(postRef, {
          commentCount: increment(-1),
          opCommentId: commentId,
          updatedAt: serverTimestamp()
        });
      })
    );
  });

  it('21. modify comment authorId → DENY', async () => {
    const commentId = 'cmt_author_a3';
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', POST_PUB, 'comments', commentId), {
        authorId: USER_A,
        text: '不可竄改作者',
        status: 'published',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    });
    const db = dbAs(USER_A);
    await assertFails(
      updateDoc(doc(db, 'posts', POST_PUB, 'comments', commentId), {
        authorId: USER_B,
        text: '竄改後文字',
        updatedAt: serverTimestamp()
      })
    );
  });
});

describe('POST / USER access', () => {
  it('22. guest read published post → PASS', async () => {
    await assertSucceeds(getDoc(doc(dbGuest(), 'posts', POST_PUB)));
  });

  it('23. guest read draft post → DENY', async () => {
    await assertFails(getDoc(doc(dbGuest(), 'posts', POST_DRAFT)));
  });

  it('24. author read own draft → PASS', async () => {
    await assertSucceeds(getDoc(doc(dbAs(USER_A), 'posts', POST_DRAFT)));
  });

  it('25. modify post authorId / source / createdAt → DENY', async () => {
    const db = dbAs(USER_A);
    const postRef = doc(db, 'posts', POST_PUB);
    await assertFails(updateDoc(postRef, { authorId: USER_B }));
    await assertFails(updateDoc(postRef, { source: 'official' }));
    await assertFails(updateDoc(postRef, { createdAt: Timestamp.now() }));
  });

  it('26. user A read user B profile/private/collections → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(getDoc(doc(db, 'users', USER_B)));
    await assertFails(getDoc(doc(db, 'users', USER_B, 'private', 'notes')));
    await assertFails(getDoc(doc(db, 'users', USER_B, 'collections', POST_PUB)));
  });

  it('27. user A update user B profile → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      updateDoc(doc(db, 'users', USER_B), {
        nickname: 'Hacked',
        updatedAt: serverTimestamp()
      })
    );
  });

  it('28. unmatched path → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      setDoc(doc(db, 'admin', 'secrets'), { open: true })
    );
    await assertFails(getDoc(doc(dbGuest(), 'metrics', 'x')));
  });

  it('29. create post with media.length <= 3 → PASS', async () => {
    const db = dbAs(USER_A);
    await assertSucceeds(
      setDoc(doc(db, 'posts', 'post_media_ok'), publishedPost({
        media: [
          { mediaId: 'a', src: 'https://example.com/a.webp', type: 'image/webp', sortOrder: 0 },
          { mediaId: 'b', src: 'https://example.com/b.webp', type: 'image/webp', sortOrder: 1 },
          { mediaId: 'c', src: 'https://example.com/c.webp', type: 'image/webp', sortOrder: 2 }
        ]
      }))
    );
  });

  it('30. create post with media.length 4 → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      setDoc(doc(db, 'posts', 'post_media_over'), publishedPost({
        media: [
          { mediaId: 'a', src: 'https://example.com/a.webp' },
          { mediaId: 'b', src: 'https://example.com/b.webp' },
          { mediaId: 'c', src: 'https://example.com/c.webp' },
          { mediaId: 'd', src: 'https://example.com/d.webp' }
        ]
      }))
    );
  });

  it('31. update post media to length 4 → DENY', async () => {
    const db = dbAs(USER_A);
    await assertFails(
      updateDoc(doc(db, 'posts', POST_PUB), {
        media: [
          { mediaId: 'a', src: 'https://example.com/a.webp' },
          { mediaId: 'b', src: 'https://example.com/b.webp' },
          { mediaId: 'c', src: 'https://example.com/c.webp' },
          { mediaId: 'd', src: 'https://example.com/d.webp' }
        ],
        updatedAt: serverTimestamp()
      })
    );
  });
});

describe('city-shares-firestore.js API against emulator', () => {
  it('toggleLike() like then unlike → PASS', async () => {
    const db = dbAs(USER_A);
    const api = installCitySharesRuntime(db, {
      uid: USER_A,
      displayName: 'Alice',
      email: 'a@test.com'
    });
    const liked = await api.toggleLike(POST_PUB);
    assert.equal(liked.liked, true);
    const snap = await getDoc(doc(db, 'posts', POST_PUB));
    assert.equal(snap.data().likeCount, 1);
    const unliked = await api.toggleLike(POST_PUB);
    assert.equal(unliked.liked, false);
    const snap2 = await getDoc(doc(db, 'posts', POST_PUB));
    assert.equal(snap2.data().likeCount, 0);
  });

  it('toggleSave() save then unsave → PASS', async () => {
    const db = dbAs(USER_A);
    const api = installCitySharesRuntime(db, {
      uid: USER_A,
      displayName: 'Alice',
      email: 'a@test.com'
    });
    const saved = await api.toggleSave(POST_PUB);
    assert.equal(saved.saved, true);
    const snap = await getDoc(doc(db, 'posts', POST_PUB));
    assert.equal(snap.data().saveCount, 1);
    const unsaved = await api.toggleSave(POST_PUB);
    assert.equal(unsaved.saved, false);
    const snap2 = await getDoc(doc(db, 'posts', POST_PUB));
    assert.equal(snap2.data().saveCount, 0);
  });

  it('addComment() + deleteComment() → PASS', async () => {
    const db = dbAs(USER_B);
    const api = installCitySharesRuntime(db, {
      uid: USER_B,
      displayName: 'Bob',
      email: 'b@test.com'
    });
    const commentId = await api.addComment(POST_PUB, '這是透過 city-shares API 的留言測試');
    assert.ok(commentId);
    const snap = await getDoc(doc(db, 'posts', POST_PUB));
    assert.equal(snap.data().commentCount, 1);
    assert.equal(snap.data().opCommentId, commentId);
    await api.deleteComment(POST_PUB, commentId);
    const snap2 = await getDoc(doc(db, 'posts', POST_PUB));
    assert.equal(snap2.data().commentCount, 0);
  });

  it('addComment() on draft → DENY', async () => {
    const db = dbAs(USER_B);
    const api = installCitySharesRuntime(db, {
      uid: USER_B,
      displayName: 'Bob',
      email: 'b@test.com'
    });
    await assert.rejects(() => api.addComment(POST_DRAFT, '草稿不該能留言內容要夠長'));
  });
});
