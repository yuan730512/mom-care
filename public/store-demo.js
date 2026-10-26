// 示範模式：假資料、只存在記憶體，重新整理就重置。介面與 store-firebase.js 相同。
import { todayStr, addDays } from './util.js';

const DEMO_USERS = [
  { uid: 'u-big', email: 'big@example.com', name: '老大', color: '#2F6DB5', role: 'member', order: 1 },
  { uid: 'u-mid', email: 'mid@example.com', name: '老二', color: '#B45F12', role: 'admin', order: 2 },
  { uid: 'u-small', email: 'small@example.com', name: '老三', color: '#7A5BA6', role: 'member', order: 3 },
];

const ITEMS = [
  { id: 'i1', name: '早餐', phrase: '陪媽媽吃早餐', points: 10, rule: '以一餐計', active: true, order: 1 },
  { id: 'i2', name: '午餐', phrase: '陪媽媽吃午餐', points: 10, rule: '以一餐計', active: true, order: 2 },
  { id: 'i3', name: '晚餐', phrase: '陪媽媽吃晚餐', points: 10, rule: '以一餐計', active: true, order: 3 },
  { id: 'i4', name: '帶孫用餐', phrase: '帶孫陪媽媽吃飯', points: 20, rule: '以一餐計', active: true, order: 4 },
  { id: 'i5', name: '就醫', phrase: '陪媽媽看醫生', points: 10, rule: '以一趟計', active: true, order: 5 },
  { id: 'i6', name: '外出', phrase: '陪媽媽外出', points: 15, rule: '至少 2 小時', active: true, order: 6 },
  { id: 'i7', name: '過夜', phrase: '陪媽媽過夜', points: 30, rule: '以一晚計', active: true, order: 7 },
  { id: 'i8', name: '事務', phrase: '幫媽媽辦事', points: 10, rule: '如銀行、證件、申請補助', active: true, order: 8 },
  { id: 'i9', name: '節日', phrase: '節日探望媽媽', points: 15, rule: '以一次計', active: true, order: 9 },
];

function makeRecords() {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  const d = (day, mo = m) => {
    const dt = new Date(y, mo, day);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const rows = [
    [d(3), '12:00', 'u-big', 'i4', 3, '帶小孩回去，媽媽很開心。'],
    [d(3), '18:30', 'u-mid', 'i3', 1, '一起吃巷口的麵店。'],
    [d(5), '09:30', 'u-mid', 'i5', 1, '身心科回診，拿了三個月的藥。'],
    [d(10), '10:00', 'u-big', 'i6', 4, '連假帶媽媽去公園走走。'],
    [d(10), '12:00', 'u-mid', 'i4', 2, '兩家一起聚餐。'],
    [d(10), '15:00', 'u-small', 'i9', 1, '回家看媽媽，帶了水果。'],
    [d(10), '18:00', 'u-big', 'i3', 1, '在家煮飯。'],
    [d(12), '14:00', 'u-big', 'i8', 0, '幫媽媽去銀行辦事。'],
    [d(14), '08:00', 'u-mid', 'i1', 1, '上班前陪媽媽吃早餐。'],
    [d(17), '13:00', 'u-mid', 'i6', 3, '陪媽媽去市場。'],
    [d(17), '21:00', 'u-big', 'i7', 2, '媽媽睡不好，留下來陪一晚。'],
    [d(19), '09:00', 'u-mid', 'i5', 1, '牙科回診。'],
    [d(t.getDate()), '09:00', 'u-big', 'i1', 2, '一起吃豆漿店。'],
    [d(t.getDate()), '18:30', 'u-mid', 'i3', 1, '下班後回家吃飯。'],
    [d(2, m - 1), '12:00', 'u-big', 'i2', 1, ''],
    [d(9, m - 1), '18:00', 'u-mid', 'i3', 1, ''],
    [d(16, m - 1), '10:00', 'u-mid', 'i5', 1, ''],
    [d(23, m - 1), '21:00', 'u-big', 'i7', 0, ''],
    [d(28, m - 1), '12:00', 'u-small', 'i2', 1, ''],
    [d(5, m - 2), '12:00', 'u-big', 'i4', 2, ''],
    [d(20, m - 2), '09:00', 'u-mid', 'i6', 2, ''],
  ];
  return rows.map((r, i) => {
    const it = ITEMS.find(x => x.id === r[3]);
    const u = DEMO_USERS.find(x => x.uid === r[2]);
    const createdAt = new Date(r[0] + 'T' + r[1] + ':00');
    const photos = [];
    for (let k = 0; k < r[4]; k++) photos.push({ id: `demo-${i}-${k}` });
    return {
      id: 'r' + i, uid: u.uid, name: u.name, date: r[0], time: r[1],
      itemId: it.id, itemName: it.name, phrase: it.phrase, points: it.points,
      note: r[5], photos, status: 'active', objections: [],
      createdAt, updatedAt: createdAt,
    };
  });
}

function makePosts() {
  const now = new Date();
  return [
    {
      id: 'p1', type: 'proposal', uid: 'u-big', name: '老大', title: '「過夜」由 30 點調整為 40 點',
      body: '媽媽最近晚上常睡不好，過夜其實很累，建議調高。',
      createdAt: addDays(now, -3), deadline: todayStr(addDays(now, 4)),
      votes: { 'u-big': 'yes', 'u-mid': 'yes' }, status: 'open',
      proposal: { itemId: 'i7', field: 'points', newValue: 40 },
    },
    {
      id: 'p2', type: 'discussion', uid: 'u-mid', name: '老二', title: '下個月媽媽回診，誰方便陪？',
      body: '下個月 5 號上午身心科回診，我那天要開會。',
      createdAt: addDays(now, -1), votes: {}, status: 'open',
    },
  ];
}

export function createDemoStore() {
  const S = {
    mode: 'demo',
    user: null,
    members: DEMO_USERS.map(u => ({ ...u })),
    allowlist: DEMO_USERS.map(u => ({ email: u.email, name: u.name, role: u.role, color: u.color, order: u.order })),
    settings: { fund: 3000000, objectionDays: 7, backfillDays: 7, startDate: '2026-11-01', motherName: '媽媽', version: 1 },
    items: ITEMS.map(i => ({ ...i })),
    itemVersions: [{ id: 'v1', version: 1, items: ITEMS.map(i => ({ ...i })), by: '老二', at: new Date('2026-10-01'), note: '初版（三人同意）' }],
    records: makeRecords(),
    posts: makePosts(),
    comments: { p2: [{ id: 'c1', uid: 'u-big', name: '老大', text: '我可以，那天我休假。', createdAt: new Date() }] },
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

    async updateProfile({ name, color }) {
      const m = S.members.find(x => x.uid === S.user.uid); Object.assign(m, { name, color }); S.user = { ...m }; emit('members'); if (onUser) onUser(S.user);
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
