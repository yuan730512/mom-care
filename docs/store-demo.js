// 示範模式：假資料、只存在記憶體，重新整理就重置。介面與 store-firebase.js 相同。
import { todayStr, addDays } from './util.js';
import { DEFAULT_ITEMS, calcPoints, minutesBetween } from './logic.js';

const DEMO_USERS = [
  { uid: 'u-big', email: 'big@example.com', name: '陳源', color: '#2F6DB5', role: 'member', order: 1 },
  { uid: 'u-mid', email: 'mid@example.com', name: '陳淵', color: '#B45F12', role: 'admin', order: 2 },
  { uid: 'u-small', email: 'small@example.com', name: '陳泓', color: '#7A5BA6', role: 'member', order: 3 },
];

const ITEMS = DEFAULT_ITEMS.map((it, i) => ({ id: 'i' + (i + 1), order: i + 1, ...it }));
const FAMILY = { 'u-big': ['大嫂', '大女兒', '小女兒'], 'u-mid': ['太太'], 'u-small': [] };

function makeRecords() {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  const d = (day, mo = m) => {
    const dt = new Date(y, mo, day);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  // [日期, 開始, 結束, 人, 項目, 說明, 同行家人, 照片數, 備註, 加減點, 調整原因]
  const rows = [
    [d(3), '12:00', '14:00', 'u-big', 'i1', '吃午餐', ['大嫂', '大女兒', '小女兒'], 3, '帶小孩回去，媽媽很開心。'],
    [d(3), '18:30', '20:00', 'u-mid', 'i1', '吃晚餐', ['太太'], 1, '一起吃巷口的麵店。'],
    [d(5), '09:00', '11:30', 'u-mid', 'i1', '看醫生', [], 1, '身心科回診，拿了三個月的藥。', 5, '候診特別久，掛號排隊另計'],
    [d(10), '10:00', '13:00', 'u-big', 'i1', '去公園散步', ['大女兒'], 4, '連假帶媽媽去公園走走。'],
    [d(10), '15:00', '16:00', 'u-small', 'i1', '聊天', [], 1, '回家看媽媽，帶了水果。'],
    [d(12), '14:00', '15:00', 'u-big', 'i5', '', [], 0, '幫媽媽去銀行辦事。'],
    [d(14), '07:30', '08:30', 'u-mid', 'i1', '吃早餐', [], 1, '上班前陪媽媽吃早餐。'],
    [d(17), '13:00', '15:30', 'u-mid', 'i1', '逛市場', ['太太'], 3, ''],
    [d(17), '21:00', '08:00', 'u-big', 'i2', '', [], 2, '媽媽睡不好，留下來陪一晚。'],
    [d(19), '02:00', '05:00', 'u-mid', 'i4', '', [], 0, '半夜送急診，凌晨回家。'],
    [d(t.getDate()), '09:00', '10:00', 'u-big', 'i1', '吃早餐', ['大嫂'], 2, ''],
    [d(t.getDate()), '18:30', '20:30', 'u-mid', 'i1', '吃晚餐', ['太太'], 1, ''],
    [d(2, m - 1), '12:00', '13:30', 'u-big', 'i1', '吃午餐', ['大女兒', '小女兒'], 1, ''],
    [d(9, m - 1), '18:00', '20:00', 'u-mid', 'i1', '吃晚餐', [], 1, ''],
    [d(16, m - 1), '10:00', '12:00', 'u-mid', 'i1', '看醫生', [], 1, ''],
    [d(23, m - 1), '21:00', '08:00', 'u-big', 'i2', '', [], 0, ''],
    [d(28, m - 1), '12:00', '13:00', 'u-small', 'i1', '吃午餐', [], 1, ''],
    [d(5, m - 2), '12:00', '14:00', 'u-big', 'i1', '吃午餐', ['大嫂', '大女兒', '小女兒'], 2, ''],
    [d(20, m - 2), '09:00', '12:00', 'u-mid', 'i1', '去公園', ['太太'], 2, ''],
  ];
  return rows.map((r, i) => {
    const [date, start, endT, uid, itemId, desc, companions, nPhotos, note, adjust = 0, adjustReason = ''] = r;
    const it = ITEMS.find(x => x.id === itemId);
    const u = DEMO_USERS.find(x => x.uid === uid);
    const minutes = minutesBetween(start, endT);
    const c = calcPoints(it, { minutes, companions: companions.length, adjust });
    const createdAt = new Date(date + 'T' + start + ':00');
    const photos = [];
    for (let k = 0; k < nPhotos; k++) photos.push({ id: `demo-${i}-${k}` });
    return {
      id: 'r' + i, uid, name: u.name, date, time: start, endTime: endT, minutes, hours: c.hours,
      itemId, itemName: it.name, kind: c.kind, desc, phrase: it.phrase + (c.kind === 'time' ? desc : ''),
      companions, companionCount: companions.length, multiplier: c.multiplier,
      unitPoints: c.unit, basePoints: c.base, adjust: c.adjust, adjustReason, points: c.points,
      note, photos, status: 'active', objections: [], createdAt, updatedAt: createdAt,
    };
  });
}

function makePosts() {
  const now = new Date();
  return [
    {
      id: 'p1', type: 'proposal', uid: 'u-big', name: '陳源', title: '「過夜照顧」由 50 點調整為 60 點',
      body: '媽媽最近晚上常睡不好，過夜其實很累，建議調高。',
      createdAt: addDays(now, -3), deadline: todayStr(addDays(now, 4)),
      votes: { 'u-big': 'yes', 'u-mid': 'yes' }, status: 'open',
      proposal: { kind: 'change', itemId: 'i2', itemName: '過夜照顧', newValue: 60 },
    },
    {
      id: 'p2', type: 'discussion', uid: 'u-mid', name: '陳淵', title: '下個月媽媽回診，誰方便陪？',
      body: '下個月 5 號上午身心科回診，我那天要開會。',
      createdAt: addDays(now, -1), votes: {}, status: 'open',
    },
  ];
}

export function createDemoStore() {
  const S = {
    mode: 'demo',
    user: null,
    members: DEMO_USERS.map(u => ({ ...u, family: [...(FAMILY[u.uid] || [])] })),
    allowlist: DEMO_USERS.map(u => ({ email: u.email, name: u.name, role: u.role, color: u.color, order: u.order })),
    settings: { fund: 3000000, objectionDays: 7, backfillDays: 7, startDate: '2026-11-01', motherName: '媽媽', version: 1 },
    items: ITEMS.map(i => ({ ...i })),
    itemVersions: [{ id: 'v1', version: 1, items: ITEMS.map(i => ({ ...i })), by: '陳淵', at: new Date('2026-11-01'), note: '初版（三人同意）' }],
    records: makeRecords(),
    posts: makePosts(),
    comments: { p2: [{ id: 'c1', uid: 'u-big', name: '陳源', text: '我可以，那天我休假。', createdAt: new Date() }] },
    history: {},
    photoData: {},
    listeners: {},
  };
  const emit = (k) => (S.listeners[k] || []).forEach(cb => cb(S[k] ?? null));
  const sub = (k, cb) => { (S.listeners[k] ||= []).push(cb); cb(S[k]); return () => { S.listeners[k] = S.listeners[k].filter(f => f !== cb); }; };
  let onUser = null;
  const setUser = (uid) => { S.user = uid ? { ...S.members.find(m => m.uid === uid) } : null; if (onUser) onUser(S.user); };
  const ts = () => new Date();
  const idgen = (p) => p + Math.random().toString(36).slice(2, 8);

  return {
    mode: 'demo',
    get user() { return S.user; },
    demoUsers: DEMO_USERS,
    async init(cb) { onUser = cb; setUser('u-mid'); },
    async login() { setUser('u-mid'); },
    async logout() { setUser(null); },
    async switchUser(uid) { setUser(uid); },

    subscribeMembers: cb => sub('members', cb),
    subscribeAllowlist: cb => sub('allowlist', cb),
    subscribeSettings: cb => sub('settings', cb),
    subscribeItems: cb => sub('items', cb),
    subscribeItemVersions: cb => sub('itemVersions', cb),
    subscribeRecords: cb => sub('records', cb),
    subscribePosts: cb => sub('posts', cb),
    subscribeComments(pid, cb) { const k = 'comments'; const f = () => cb(S.comments[pid] || []); (S.listeners[k] ||= []).push(f); f(); return () => { S.listeners[k] = S.listeners[k].filter(x => x !== f); }; },

    async updateProfile(patch) {
      const m = S.members.find(x => x.uid === S.user.uid); Object.assign(m, patch); S.user = { ...m }; emit('members'); if (onUser) onUser(S.user);
    },
    async uploadPhotos(files, onProgress) {
      const out = [];
      for (const f of files) { const url = URL.createObjectURL(f); const id = idgen('ph'); S.photoData[id] = url; out.push({ id }); if (onProgress) onProgress(out.length, files.length); }
      return out;
    },
    async getPhoto(id) { const u = S.photoData[id] || (id.startsWith('demo-') ? demoThumb([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) : null); return u ? { thumb: u, data: u } : null; },
    async addRecord(data) {
      const r = { id: idgen('r'), uid: S.user.uid, name: S.user.name, ...data, status: 'active', objections: [], createdAt: ts(), updatedAt: ts() };
      S.records = [...S.records, r]; emit('records'); return r.id;
    },
    async updateRecord(id, changes, reason) {
      const r = S.records.find(x => x.id === id); const before = { ...r };
      Object.assign(r, changes, { updatedAt: ts() });
      (S.history[id] ||= []).push({ id: idgen('h'), by: S.user.uid, name: S.user.name, at: ts(), reason, before: pick(before, changes), after: pick(r, changes) });
      S.records = [...S.records]; emit('records');
    },
    async voidRecord(id, reason) { return this.updateRecord(id, { status: 'void' }, reason || '作廢'); },
    async addObjection(id, text) {
      const r = S.records.find(x => x.id === id);
      r.objections = [...(r.objections || []), { by: S.user.uid, name: S.user.name, text, at: ts(), response: null }];
      r.updatedAt = ts(); S.records = [...S.records]; emit('records');
    },
    async patchObjection(id, index, patch) {
      const r = S.records.find(x => x.id === id);
      r.objections = r.objections.map((o, i) => i === index ? { ...o, ...patch, patchedAt: ts() } : o);
      S.records = [...S.records]; emit('records');
    },
    async getHistory(id) { return S.history[id] || []; },

    async saveItems(items, note) {
      S.items = items.map(i => ({ ...i })); emit('items');
      const v = (S.itemVersions.at(-1)?.version || 0) + 1;
      S.itemVersions = [...S.itemVersions, { id: idgen('v'), version: v, items: items.map(i => ({ ...i })), by: S.user.name, at: ts(), note }];
      S.settings = { ...S.settings, version: v }; emit('itemVersions'); emit('settings');
    },
    async saveSettings(partial) { S.settings = { ...S.settings, ...partial }; emit('settings'); },
    async saveAllowlist(email, data) {
      const i = S.allowlist.findIndex(a => a.email === email);
      if (i >= 0) S.allowlist[i] = { ...S.allowlist[i], ...data }; else S.allowlist.push({ email, ...data });
      S.allowlist = [...S.allowlist]; emit('allowlist');
    },

    async addPost(post) { S.posts = [{ id: idgen('p'), uid: S.user.uid, name: S.user.name, votes: {}, status: 'open', createdAt: ts(), ...post }, ...S.posts]; emit('posts'); },
    async vote(pid, choice) { const p = S.posts.find(x => x.id === pid); p.votes = { ...p.votes, [S.user.uid]: choice }; S.posts = [...S.posts]; emit('posts'); },
    async closePost(pid, result) { const p = S.posts.find(x => x.id === pid); Object.assign(p, { status: 'closed', result, closedAt: ts() }); S.posts = [...S.posts]; emit('posts'); },
    async addComment(pid, text) { (S.comments[pid] ||= []).push({ id: idgen('c'), uid: S.user.uid, name: S.user.name, text, createdAt: ts() }); emit('comments'); },
  };
}

// 示範用的假照片：純色漸層 SVG
function demoThumb(seed) {
  const hues = [[46, 60], [160, 40], [210, 50], [330, 40], [25, 70]][seed % 5];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hues[0]},${hues[1]}%,78%)'/><stop offset='1' stop-color='hsl(${hues[0]},${hues[1]}%,55%)'/></linearGradient></defs><rect width='240' height='240' fill='url(#g)'/><text x='120' y='130' font-size='22' text-anchor='middle' fill='#fff' font-family='sans-serif'>示範照片</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function pick(obj, keys) { const o = {}; for (const k of Object.keys(keys)) o[k] = obj[k]; return o; }
