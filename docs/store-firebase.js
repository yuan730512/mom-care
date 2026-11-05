// 正式模式：Firebase Auth（Google 登入）+ Firestore + Storage
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, onSnapshot, query, orderBy, where,
  serverTimestamp, Timestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { parseDate, fileToDataURL, makeThumb } from './util.js';

const DEFAULT_SETTINGS = { fund: 3000000, objectionDays: 7, backfillDays: 7, startDate: '', motherName: '媽媽', version: 0 };

export function createFirebaseStore(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  auth.languageCode = 'zh-TW';
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  let user = null;
  let onUser = null;
  const liveSettings = { ...DEFAULT_SETTINGS };

  const col = (name) => collection(db, name);
  const now = () => serverTimestamp();

  async function resolveUser(fbUser) {
    if (!fbUser) { user = null; return null; }
    const email = fbUser.email;
    const allow = await getDoc(doc(db, 'allowlist', email)).catch(() => null);
    if (!allow || !allow.exists()) {
      user = { uid: fbUser.uid, email, name: fbUser.displayName || email, notAllowed: true };
      return user;
    }
    const a = allow.data();
    const mref = doc(db, 'members', fbUser.uid);
    const m = await getDoc(mref);
    if (!m.exists()) {
      await setDoc(mref, { email, name: a.name || fbUser.displayName || email, color: a.color || '#2E6B5E', order: a.order || 9, createdAt: now() });
    }
    const md = (await getDoc(mref)).data();
    user = { uid: fbUser.uid, email, name: md.name, color: md.color, family: md.family || [], role: a.role || 'member', order: md.order ?? a.order ?? 9 };
    return user;
  }

  function mapDoc(d) { return { id: d.id, ...d.data() }; }
  function subscribe(q, cb, map = mapDoc) {
    return onSnapshot(q, snap => cb(snap.docs.map(map)), err => { console.error(err); cb([]); });
  }

  return {
    mode: 'firebase',
    get user() { return user; },

    async init(cb) {
      onUser = cb;
      await getRedirectResult(auth).catch(e => console.warn('redirect', e));
      onAuthStateChanged(auth, async fbUser => { await resolveUser(fbUser); onUser(user); });
    },
    async login() {
      try { await signInWithPopup(auth, provider); }
      catch (e) {
        if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
          await signInWithRedirect(auth, provider);
        } else throw e;
      }
    },
    async logout() { await signOut(auth); },

    subscribeMembers: cb => subscribe(query(col('members'), orderBy('order')), cb, d => ({ uid: d.id, ...d.data() })),
    subscribeAllowlist: cb => subscribe(col('allowlist'), cb, d => ({ email: d.id, ...d.data() })),
    subscribeSettings(cb) {
      return onSnapshot(doc(db, 'settings', 'main'), s => { Object.assign(liveSettings, DEFAULT_SETTINGS, s.exists() ? s.data() : {}); cb({ ...liveSettings }); }, err => { console.error(err); cb({ ...liveSettings }); });
    },
    subscribeItems: cb => subscribe(query(col('items'), orderBy('order')), cb),
    subscribeItemVersions: cb => subscribe(query(col('itemVersions'), orderBy('version')), cb),
    subscribeRecords: cb => subscribe(query(col('records'), orderBy('date')), cb),
    subscribePosts: cb => subscribe(query(col('posts'), orderBy('createdAt', 'desc')), cb),
    subscribeComments: (pid, cb) => subscribe(query(collection(db, 'posts', pid, 'comments'), orderBy('createdAt')), cb),

    async updateProfile(patch) {
      await updateDoc(doc(db, 'members', user.uid), { ...patch, updatedAt: now() });
      user = { ...user, ...patch }; onUser(user);
    },

    // 照片存進 Firestore：photos/{id} 放完整圖（約 1000px），紀錄裡只放 240px 縮圖
    async uploadPhotos(files, onProgress) {
      const out = [];
      let i = 0;
      for (const f of files) {
        const data = await fileToDataURL(f);
        if (data.length > 950000) throw new Error('照片壓縮後仍超過 Firestore 單張上限，請換一張');
        const thumb = await makeThumb(f);
        const ref = await addDoc(col('photos'), { uid: user.uid, data, thumb, createdAt: now() });
        out.push({ id: ref.id });
        i++; if (onProgress) onProgress(i, files.length);
      }
      return out;
    },
    async getPhoto(id) {
      const d = await getDoc(doc(db, 'photos', id));
      return d.exists() ? { thumb: d.data().thumb, data: d.data().data } : null;
    },

    async addRecord(data) {
      const d = parseDate(data.date);
      const ref = await addDoc(col('records'), {
        ...data, uid: user.uid, name: user.name, status: 'active', objections: [],
        dateTs: Timestamp.fromDate(d), createdAt: now(), updatedAt: now(),
      });
      return ref.id;
    },
    async updateRecord(id, changes, reason) {
      const rref = doc(db, 'records', id);
      const before = (await getDoc(rref)).data();
      const upd = { ...changes, updatedAt: now() };
      if (changes.date) upd.dateTs = Timestamp.fromDate(parseDate(changes.date));
      await updateDoc(rref, upd);
      const b = {}, a = {};
      for (const k of Object.keys(changes)) { b[k] = before[k] ?? null; a[k] = changes[k]; }
      await addDoc(collection(db, 'records', id, 'history'), { by: user.uid, name: user.name, at: now(), reason: reason || '', before: b, after: a });
    },
    async voidRecord(id, reason) { return this.updateRecord(id, { status: 'void' }, reason || '作廢'); },
    async addObjection(id, text) {
      const rref = doc(db, 'records', id);
      const cur = (await getDoc(rref)).data().objections || [];
      await updateDoc(rref, { objections: [...cur, { by: user.uid, name: user.name, text, at: Timestamp.now(), response: null }], updatedAt: now() });
    },
    async patchObjection(id, index, patch) {
      const rref = doc(db, 'records', id);
      const cur = (await getDoc(rref)).data().objections || [];
      await updateDoc(rref, { objections: cur.map((o, i) => i === index ? { ...o, ...patch, patchedAt: Timestamp.now() } : o), updatedAt: now() });
    },
    async getHistory(id) {
      const s = await getDocs(query(collection(db, 'records', id, 'history'), orderBy('at')));
      return s.docs.map(mapDoc);
    },

    async saveItems(items, note) {
      const batch = writeBatch(db);
      const version = (liveSettings.version || 0) + 1;
      items.forEach((it, i) => {
        const id = it.id || doc(col('items')).id;
        batch.set(doc(db, 'items', id), { name: it.name, phrase: it.phrase, kind: it.kind === 'time' ? 'time' : 'fixed', points: Number(it.points), multiply: !!it.multiply, rule: it.rule || '', active: it.active !== false, order: i + 1, updatedAt: now() });
        it.id = id;
      });
      batch.set(doc(col('itemVersions')), { version, items: items.map(it => ({ ...it, points: Number(it.points) })), by: user.name, at: now(), note: note || '' });
      batch.set(doc(db, 'settings', 'main'), { version, updatedAt: now() }, { merge: true });
      await batch.commit();
    },
    async saveSettings(partial) { await setDoc(doc(db, 'settings', 'main'), { ...partial, updatedAt: now() }, { merge: true }); },
    async saveAllowlist(email, data) { await setDoc(doc(db, 'allowlist', email.trim().toLowerCase()), { ...data, updatedAt: now() }, { merge: true }); },

    async addPost(post) { await addDoc(col('posts'), { ...post, uid: user.uid, name: user.name, votes: {}, status: 'open', createdAt: now() }); },
    async vote(pid, choice) { await updateDoc(doc(db, 'posts', pid), { [`votes.${user.uid}`]: choice, updatedAt: now() }); },
    async closePost(pid, result) { await updateDoc(doc(db, 'posts', pid), { status: 'closed', result, closedAt: now() }); },
    async addComment(pid, text) { await addDoc(collection(db, 'posts', pid, 'comments'), { uid: user.uid, name: user.name, text, createdAt: now() }); },
  };
}
