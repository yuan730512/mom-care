// 純計算：點數、期間、分配。不碰畫面與資料庫，方便測試。
import { parseDate, toDate, addDays, todayStr, pad } from './util.js';

export function withinWindow(record, settings, now = new Date()) {
  const c = toDate(record.createdAt);
  if (!c || isNaN(c)) return true; // 剛建立、伺服器時間尚未回來
  return now < addDays(c, settings.objectionDays || 7);
}

// 有效的異議：在異議期內提出、且未撤回
export function activeObjections(record, settings) {
  const c = toDate(record.createdAt);
  const limit = c && !isNaN(c) ? addDays(c, settings.objectionDays || 7) : null;
  return (record.objections || []).filter(o => !o.withdrawn && (!limit || toDate(o.at) <= limit));
}

export function recordState(record, settings, now = new Date()) {
  if (record.status === 'void') return 'void';
  if (activeObjections(record, settings).length) return 'disputed';
  if (withinWindow(record, settings, now)) return 'pending';
  return 'confirmed';
}

// 列入計算：未作廢、無有效異議（待確認的照算，異議期過後自動確認）
export function countable(record, settings, now = new Date()) {
  const s = recordState(record, settings, now);
  return s === 'pending' || s === 'confirmed';
}

export function periodRange(period, ref) {
  // ref: {year, month(0-11)}
  const y = ref.year, m = ref.month;
  const first = (yy, mm) => `${yy}-${pad(mm + 1)}-01`;
  const lastOf = (yy, mm) => { const d = new Date(yy, mm + 1, 0); return `${yy}-${pad(mm + 1)}-${pad(d.getDate())}`; };
  if (period === 'month') return { from: first(y, m), to: lastOf(y, m), label: `${y} 年 ${m + 1} 月` };
  if (period === 'quarter') {
    const sm = m - 2; const sd = new Date(y, sm, 1);
    return { from: first(sd.getFullYear(), sd.getMonth()), to: lastOf(y, m), label: `${sd.getFullYear()}/${sd.getMonth() + 1} – ${y}/${m + 1}` };
  }
  if (period === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} 全年` };
  return { from: '0000-01-01', to: '9999-12-31', label: '全部累計' };
}

export function totals(records, members, settings, range) {
  const t = {}, c = {};
  members.forEach(m => { t[m.uid] = 0; c[m.uid] = 0; });
  for (const r of records) {
    if (r.date < range.from || r.date > range.to) continue;
    if (settings.startDate && r.date < settings.startDate && range.from === '0000-01-01') continue;
    if (!countable(r, settings)) continue;
    if (!(r.uid in t)) { t[r.uid] = 0; c[r.uid] = 0; }
    t[r.uid] += Number(r.points) || 0;
    c[r.uid] += 1;
  }
  return { points: t, counts: c, sum: Object.values(t).reduce((a, b) => a + b, 0) };
}

// 依比例分配基金；最後一人拿餘數，避免四捨五入差額
export function split(fund, points, order) {
  const sum = order.reduce((a, uid) => a + (points[uid] || 0), 0);
  const out = {}; let used = 0;
  order.forEach((uid, i) => {
    if (sum === 0) { out[uid] = Math.round(fund / order.length); used += out[uid]; return; }
    if (i < order.length - 1) { out[uid] = Math.round(fund * (points[uid] || 0) / sum); used += out[uid]; }
    else out[uid] = fund - used;
  });
  return out;
}

export function backfillOk(dateStr, settings, today = todayStr()) {
  const min = todayStr(addDays(parseDate(today), -(settings.backfillDays || 7)));
  return dateStr >= min && dateStr <= today;
}

export function monthGrid(year, month) {
  // 回傳 42 格（6 週）的 'YYYY-MM-DD'
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  const out = [];
  for (let i = 0; i < 42; i++) out.push(todayStr(addDays(start, i)));
  return out;
}

export function toCSV(records, members, settings) {
  const name = uid => (members.find(m => m.uid === uid) || {}).name || uid;
  const stateName = { pending: '待確認', confirmed: '已確認', disputed: '異議中', void: '作廢' };
  const rows = [['日期', '時間', '登錄人', '項目', '內容', '點數', '狀態', '照片數', '備註', '登錄時間']];
  for (const r of [...records].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
    rows.push([r.date, r.time, name(r.uid), r.itemName, r.phrase, r.points, stateName[recordState(r, settings)], (r.photos || []).length, r.note || '', fmt(r.createdAt)]);
  }
  return '﻿' + rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
function fmt(d) { const x = toDate(d); return x && !isNaN(x) ? x.toISOString().slice(0, 16).replace('T', ' ') : ''; }
