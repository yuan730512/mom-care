import { firebaseConfig } from './firebase-config.js';
import { createDemoStore } from './store-demo.js';
import { WEEK, todayStr, parseDate, addDays, fmtDate, fmtDateTime, toDate, money, esc, nowTime, compressImage, textOn, COLOR_CHOICES, pad } from './util.js';
import { recordState, countable, periodRange, totals, split, backfillOk, monthGrid, toCSV, activeObjections, withinWindow } from './logic.js';

// ---------------- 狀態 ----------------
const params = new URLSearchParams(location.search);
const useDemo = params.get('demo') === '1' || !firebaseConfig.apiKey;
let store;

const now = new Date();
const st = {
  user: null, members: [], allowlist: [], settings: { fund: 3000000, objectionDays: 7, backfillDays: 7 },
  items: [], itemVersions: [], records: [], posts: [],
  view: 'cal',            // 桌機主區：cal | board | admin
  tab: 'cal',             // 手機頁籤：cal | log | stats | board
  cal: { year: now.getFullYear(), month: now.getMonth(), mode: 'month', weekStart: todayStr(addDays(now, -now.getDay())), sel: todayStr() },
  logWho: null, statPeriod: 'month',
  modal: null, loading: true,
};

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
let toastTimer;
function toast(msg) { $toast.textContent = msg; $toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600); }

const member = uid => st.members.find(m => m.uid === uid) || { name: '？', color: '#5B6460' };
const colorOf = uid => member(uid).color || '#5B6460';
const isAdmin = () => st.user && st.user.role === 'admin';
const sortedMembers = () => [...st.members].sort((a, b) => (a.order || 9) - (b.order || 9));
const activeItems = () => st.items.filter(i => i.active !== false);

// ---------------- 啟動 ----------------
async function boot() {
  if (useDemo) store = createDemoStore();
  else {
    const { createFirebaseStore } = await import('./store-firebase.js');
    store = createFirebaseStore(firebaseConfig);
  }
  window.__store = store;
  await store.init(user => { st.user = user; st.loading = false; if (user && !user.notAllowed) attachData(); render(); });
}
let attached = false;
function attachData() {
  if (attached) return; attached = true;
  store.subscribeMembers(v => { st.members = v; if (!st.logWho && v.length) st.logWho = st.user.uid; render(); });
  store.subscribeSettings(v => { st.settings = v; render(); });
  store.subscribeItems(v => { st.items = v; render(); });
  store.subscribeItemVersions(v => { st.itemVersions = v; render(); });
  store.subscribeRecords(v => { st.records = v; render(); });
  store.subscribePosts(v => { st.posts = v; render(); });
  if (isAdmin() || store.mode === 'demo') store.subscribeAllowlist(v => { st.allowlist = v; render(); });
}

// ---------------- 畫面 ----------------
function render() {
  if (st.loading) { $app.innerHTML = `<div class="login"><div class="card"><div class="muted">載入中…</div></div></div>`; return; }
  if (!st.user) { $app.innerHTML = loginView(); return; }
  if (st.user.notAllowed) { $app.innerHTML = notAllowedView(); return; }
  $app.innerHTML = `
    <div class="shell">
      ${topbar()}
      <div class="layout">
        <aside class="side ${st.tab === 'log' || st.tab === 'stats' ? '' : 'pane-mobile-hide'}" data-pane="side">
          <div class="${st.tab === 'log' ? '' : 'mobile-hide'}">${logPanel()}</div>
          <div class="${st.tab === 'stats' ? '' : 'mobile-hide'}">${statsPanel()}</div>
        </aside>
        <main class="main ${st.tab === 'cal' || st.tab === 'board' || st.tab === 'admin' ? '' : 'mobile-hide'}">
          ${st.view === 'cal' ? calendarView() : st.view === 'board' ? boardView() : adminView()}
        </main>
      </div>
      ${tabbar()}
    </div>
    <div id="modal"></div>`;
  applyMobileVisibility();
  renderModal();
}

// 手機：只顯示目前頁籤的區塊；桌機：全部顯示（由 CSS media 決定）
function applyMobileVisibility() {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  $app.querySelectorAll('.mobile-hide, .pane-mobile-hide').forEach(el => el.classList.toggle('hidden', mobile));
}
window.addEventListener('resize', applyMobileVisibility);

function loginView() {
  return `<div class="login"><div class="card">
    <div class="logo"><svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 48s-14-9-14-19a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 10-14 19-14 19z" fill="#fff"/></svg></div>
    <h1>陪伴媽媽</h1>
    <p class="muted">三兄弟陪伴點數紀錄</p>
    <button class="btn primary" data-action="login" style="width:100%">${useDemo ? '進入示範模式' : '使用 Google 帳號登入'}</button>
    ${useDemo ? '<p class="muted">示範模式：資料不會儲存，重新整理即重置。</p>' : '<p class="muted">僅限名單內的家人登入。</p>'}
  </div></div>`;
}
function notAllowedView() {
  return `<div class="login"><div class="card">
    <h2>這個帳號不在名單內</h2>
    <p class="muted">目前登入：${esc(st.user.email)}<br>請管理者把這個 Gmail 加入名單後再試。</p>
    <button class="btn" data-action="logout">登出</button>
  </div></div>`;
}

function topbar() {
  const u = st.user;
  return `<header class="topbar"><div class="inner">
    <div class="brand"><b>陪伴${esc(st.settings.motherName || '媽媽')}</b><span>三兄弟陪伴點數紀錄</span></div>
    <nav class="nav" aria-label="主選單">
      <button class="${st.view === 'cal' ? 'on' : ''}" data-action="view" data-v="cal">日曆</button>
      <button class="${st.view === 'board' ? 'on' : ''}" data-action="view" data-v="board">討論區${openPostCount()}</button>
      ${isAdmin() ? `<button class="${st.view === 'admin' ? 'on' : ''}" data-action="view" data-v="admin">管理</button>` : ''}
    </nav>
    <button class="btn primary small" data-action="new" style="margin-left:auto">＋ 新增紀錄</button>
    <button class="me" data-action="profile" title="個人設定"><span class="dot" style="background:${colorOf(u.uid)}"></span>${esc(u.name)}${isAdmin() ? ' · 管理者' : ''}</button>
    ${store.mode === 'demo' ? `<select data-action="switch-user" class="btn small" aria-label="切換示範身分">${store.demoUsers.map(d => `<option value="${d.uid}" ${d.uid === u.uid ? 'selected' : ''}>以 ${d.name} 身分</option>`).join('')}</select>` : ''}
  </div></header>`;
}
function openPostCount() { const n = st.posts.filter(p => p.status === 'open' && p.type === 'proposal' && !(p.votes || {})[st.user.uid]).length; return n ? ` <span class="tag warn">${n}</span>` : ''; }

function tabbar() {
  const t = (id, label) => `<button class="${st.tab === id ? 'on' : ''}" data-action="tab" data-t="${id}">${label}</button>`;
  return `<nav class="tabbar" aria-label="頁籤">
    ${t('cal', '日曆')}${t('log', '日誌')}
    <div class="fabwrap"><button class="fab" data-action="new" aria-label="新增紀錄">＋</button></div>
    ${t('stats', '統計')}${t('board', '討論')}
  </nav>`;
}

// ---------- 月曆 ----------
function eventChip(r, short = false) {
  const state = recordState(r, st.settings);
  const c = colorOf(r.uid);
  const label = short ? r.itemName : `${r.time} ${esc(r.name)}${esc(r.phrase)}`;
  const title = `${r.time} ${r.name}${r.phrase}（${r.points} 點${state === 'pending' ? '，待確認' : state === 'disputed' ? '，異議中' : state === 'void' ? '，作廢' : ''}）`;
  return `<button class="ev ${state}" data-action="open" data-id="${r.id}" style="background:${c};color:${textOn(c)}" title="${esc(title)}">${label}</button>`;
}
function recordsOn(date) { return st.records.filter(r => r.date === date).sort((a, b) => a.time.localeCompare(b.time)); }

function calendarView() {
  const { year, month, mode } = st.cal;
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  const title = mode === 'month' ? `${year} 年 ${month + 1} 月` : weekTitle();
  return `<section class="cal">
    <div class="cal-head">
      <button class="btn small" data-action="cal-today">今天</button>
      <button class="btn icon" data-action="cal-prev" aria-label="上一個">‹</button>
      <button class="btn icon" data-action="cal-next" aria-label="下一個">›</button>
      <span class="title">${title}</span>
      <div class="seg" role="group" aria-label="檢視">
        <button class="${mode === 'month' ? 'on' : ''}" data-action="cal-mode" data-m="month">月</button>
        <button class="${mode === 'week' ? 'on' : ''}" data-action="cal-mode" data-m="week">週</button>
      </div>
      <div class="legend">${sortedMembers().map(m => `<span><span class="dot" style="background:${m.color}"></span>${esc(m.name)}</span>`).join('')}</div>
    </div>
    ${mode === 'month' ? monthView(mobile) : weekView()}
    ${mobile ? dayList() : ''}
    <div class="cal-foot">虛線框＝${st.settings.objectionDays} 天異議期內，紅框＝有異議，刪除線＝作廢。點色塊看照片與細節。</div>
  </section>`;
}
function monthView(mobile) {
  const { year, month, sel } = st.cal;
  const today = todayStr();
  const cells = monthGrid(year, month).map(d => {
    const inM = parseDate(d).getMonth() === month;
    const list = recordsOn(d);
    const max = mobile ? 2 : 3;
    return `<div class="cal-cell ${inM ? '' : 'out'} ${d === today ? 'today' : ''} ${mobile && d === sel ? 'sel' : ''}" data-action="cal-sel" data-d="${d}" aria-label="${d}，${list.length} 筆">
      <span class="num">${parseDate(d).getDate()}</span>
      ${list.slice(0, max).map(r => eventChip(r, mobile)).join('')}
      ${list.length > max ? `<span class="cal-more">還有 ${list.length - max} 筆</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="cal-week">${WEEK.map(w => `<div>${w}</div>`).join('')}</div><div class="cal-grid">${cells}</div>`;
}
function weekTitle() { const s = parseDate(st.cal.weekStart), e = addDays(s, 6); return `${s.getFullYear()}/${s.getMonth() + 1}/${s.getDate()} – ${e.getMonth() + 1}/${e.getDate()}`; }
function weekView() {
  const today = todayStr();
  const cols = [];
  for (let i = 0; i < 7; i++) {
    const d = todayStr(addDays(parseDate(st.cal.weekStart), i));
    cols.push(`<div class="week-col ${d === today ? 'today' : ''}"><div class="num">${WEEK[i]} ${parseDate(d).getDate()}</div>${recordsOn(d).map(r => eventChip(r)).join('') || '<span class="muted" style="text-align:center">—</span>'}</div>`);
  }
  return `<div class="week-grid">${cols.join('')}</div>`;
}
function dayList() {
  const d = st.cal.sel; const list = recordsOn(d);
  return `<div class="daylist"><b>${fmtDate(d)}</b>${list.length ? list.map(r => logRow(r, true)).join('') : '<span class="muted">這天還沒有紀錄。</span>'}</div>`;
}
function logRow(r, withName = false) {
  const state = recordState(r, st.settings);
  const tag = state === 'pending' ? '<span class="tag warn">待確認</span>' : state === 'disputed' ? '<span class="tag bad">異議</span>' : state === 'void' ? '<span class="tag gray">作廢</span>' : '';
  return `<button class="log-item" data-action="open" data-id="${r.id}">
    <span class="dot" style="background:${colorOf(r.uid)}"></span>
    <span class="d">${fmtDate(r.date, false)} ${r.time}</span>
    <span class="t">${withName ? esc(r.name) : ''}${esc(r.phrase)}${(r.photos || []).length ? ' 📷' : ''}</span>
    ${tag}<span class="pts">+${r.points}</span>
  </button>`;
}

// ---------- 日誌 ----------
function logPanel() {
  const who = st.logWho || st.user.uid;
  const { year, month } = st.cal;
  const range = periodRange('month', { year, month });
  const list = st.records.filter(r => r.uid === who && r.date >= range.from && r.date <= range.to).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const t = totals(list, st.members, st.settings, range);
  return `<section class="card">
    <div class="row"><h2>工作日誌</h2><span class="muted" style="margin-left:auto">${range.label}</span></div>
    <div class="log-tabs">${sortedMembers().map(m => `<button class="${m.uid === who ? 'on' : ''}" data-action="log-who" data-uid="${m.uid}" style="${m.uid === who ? `background:${m.color};border-color:${m.color};color:${textOn(m.color)}` : ''}">${esc(m.name)}</button>`).join('')}</div>
    <div class="stat-mini"><div><span class="muted">本月點數</span><br><b>${t.points[who] || 0}</b></div><div><span class="muted">本月次數</span><br><b>${t.counts[who] || 0}</b></div></div>
    <div class="log-list">${list.length ? list.map(r => logRow(r)).join('') : '<span class="muted">這個月還沒有紀錄。</span>'}</div>
  </section>`;
}

// ---------- 統計 ----------
function statsPanel() {
  const ref = { year: st.cal.year, month: st.cal.month };
  const range = periodRange(st.statPeriod, ref);
  const t = totals(st.records, st.members, st.settings, range);
  const order = sortedMembers().map(m => m.uid);
  const share = split(Number(st.settings.fund) || 0, t.points, order);
  let acc = 0; const segs = order.map(uid => { const p = t.sum ? (t.points[uid] / t.sum) * 360 : 0; const s = `${colorOf(uid)} ${acc}deg ${acc + p}deg`; acc += p; return s; });
  const donut = t.sum ? `conic-gradient(${segs.join(',')})` : 'var(--line-soft)';
  const periods = [['month', '本月'], ['quarter', '近三月'], ['year', '全年'], ['all', '累計']];
  return `<section class="card">
    <h2>點數統計</h2>
    <div class="seg" style="align-self:flex-start">${periods.map(([k, l]) => `<button class="${st.statPeriod === k ? 'on' : ''}" data-action="stat-period" data-p="${k}">${l}</button>`).join('')}</div>
    <div class="muted">${range.label}</div>
    <div class="donut" role="img" aria-label="點數比例" style="background:${donut}"><div><b>${t.sum}</b><span class="muted">總點數</span></div></div>
    ${order.map(uid => { const m = member(uid); const pct = t.sum ? Math.round(t.points[uid] / t.sum * 1000) / 10 : 0; return `<div class="person-row">
      <div class="top"><span class="dot" style="background:${m.color}"></span><b>${esc(m.name)}</b><span class="muted">${t.points[uid] || 0} 點 · ${t.counts[uid] || 0} 次 · ${pct}%</span><span class="amt">${money(share[uid])}</span></div>
      <div class="bar"><div style="width:${pct}%;background:${m.color}"></div></div></div>`; }).join('')}
    <p class="muted" style="margin:0">金額為以基金 ${money(st.settings.fund || 0)} 依此期間比例的試算，最終以累計比例為準。</p>
    <button class="btn small" data-action="export">匯出全部紀錄（CSV）</button>
  </section>`;
}

// ---------- 討論區 ----------
function boardView() {
  const open = st.posts.filter(p => p.status === 'open'), closed = st.posts.filter(p => p.status !== 'open');
  return `<section class="card">
    <div class="row"><h2>討論區</h2><button class="btn small" data-action="new-post" style="margin-left:auto">＋ 發起討論或提案</button></div>
    ${open.length ? open.map(postCard).join('') : '<span class="muted">目前沒有進行中的討論。</span>'}
    ${closed.length ? `<details><summary class="muted">已結束（${closed.length}）</summary>${closed.map(postCard).join('')}</details>` : ''}
  </section>`;
}
function postCard(p) {
  const votes = p.votes || {}; const yes = Object.values(votes).filter(v => v === 'yes').length, no = Object.values(votes).filter(v => v === 'no').length;
  const n = st.members.length || 3; const mine = votes[st.user.uid];
  const notVoted = sortedMembers().filter(m => !votes[m.uid]).map(m => m.name);
  const isProp = p.type === 'proposal';
  const item = isProp && p.proposal ? st.items.find(i => i.id === p.proposal.itemId) : null;
  const propLine = isProp && p.proposal ? (p.proposal.kind === 'new' ? `新增項目「${esc(p.proposal.name)}」${p.proposal.newValue} 點` : `「${esc(item ? item.name : p.proposal.itemName || '')}」由 ${item ? item.points : '?'} 點改為 ${p.proposal.newValue} 點`) : '';
  return `<article class="post" id="post-${p.id}">
    <div class="head">
      <span class="tag ${p.status === 'open' ? (isProp ? 'ok' : 'gray') : 'gray'}">${isProp ? (p.status === 'open' ? '投票中' : p.result === 'pass' ? '通過' : '未通過') : (p.status === 'open' ? '討論' : '已結束')}</span>
      <b>${esc(p.title)}</b>
      <span class="meta">${esc(p.name)} · ${fmtDateTime(p.createdAt)}${p.deadline ? ' · 截止 ' + fmtDate(p.deadline, false) : ''}</span>
    </div>
    ${propLine ? `<div class="preview">提案內容：${propLine}</div>` : ''}
    ${p.body ? `<div class="body">${esc(p.body)}</div>` : ''}
    ${isProp ? `<div class="vote-bar"><div class="y" style="width:${yes / n * 100}%"></div><div class="n" style="width:${no / n * 100}%"></div></div>
      <div class="row" style="font-size:14px"><span>贊成 ${yes}</span><span>反對 ${no}</span><span class="muted">${notVoted.length ? '未投：' + notVoted.join('、') : '全員已投'}</span>
      ${p.status === 'open' ? `<span class="row" style="margin-left:auto">
        <button class="btn small ${mine === 'yes' ? 'primary' : ''}" data-action="vote" data-id="${p.id}" data-v="yes">贊成</button>
        <button class="btn small ${mine === 'no' ? 'danger' : ''}" data-action="vote" data-id="${p.id}" data-v="no">反對</button>
        ${isAdmin() ? `<button class="btn small" data-action="close-post" data-id="${p.id}">結案</button>` : ''}</span>` : ''}
      </div>` : (p.status === 'open' && (isAdmin() || p.uid === st.user.uid) ? `<div><button class="btn small" data-action="close-post" data-id="${p.id}">結束討論</button></div>` : '')}
    <div class="comments" data-comments="${p.id}"><span class="muted">載入留言…</span></div>
    <form class="row" data-action="comment" data-id="${p.id}"><input name="text" placeholder="留言…" required style="flex:1;min-height:40px;padding:6px 10px;border:1px solid #D5D8D1;border-radius:8px"><button class="btn small">送出</button></form>
  </article>`;
}
const commentSubs = {};
function mountComments() {
  $app.querySelectorAll('[data-comments]').forEach(el => {
    const pid = el.dataset.comments;
    if (!commentSubs[pid]) commentSubs[pid] = store.subscribeComments(pid, list => { commentCache[pid] = list; paintComments(pid); });
    paintComments(pid);
  });
}
const commentCache = {};
function paintComments(pid) {
  const el = $app.querySelector(`[data-comments="${pid}"]`); if (!el) return;
  const list = commentCache[pid]; if (!list) return;
  el.innerHTML = list.length ? list.map(c => `<div class="comment"><b style="color:${colorOf(c.uid)}">${esc(c.name)}</b>${esc(c.text)} <span class="muted">${fmtDateTime(c.createdAt)}</span></div>`).join('') : '<span class="muted">還沒有留言。</span>';
}

// ---------- 管理 ----------
function adminView() {
  const s = st.settings;
  return `<section class="card">
    <div class="row"><h2>點數表</h2><span class="muted">目前第 ${s.version || 0} 版</span></div>
    <p class="muted" style="margin:0">依協議，調整點數應先在討論區提案投票；通過後在此修改，或由結案時自動套用。修改只影響之後的紀錄。</p>
    <form data-action="save-items" class="card" style="padding:0;border:none;gap:8px">
      <div class="item-row head"><span>項目（短名）</span><span>日曆顯示文字</span><span>點數</span><span>基本時數／計算方式</span><span>啟用</span></div>
      <div id="item-rows">${st.items.map(itemRow).join('')}</div>
      <div class="row"><button type="button" class="btn small" data-action="add-item-row">＋ 新增一列</button></div>
      <div class="field"><label>修改說明（會記在版本紀錄）</label><input name="note" placeholder="例：依 11/3 投票通過，過夜改為 40 點" required></div>
      <div><button class="btn primary">儲存為第 ${(s.version || 0) + 1} 版</button></div>
    </form>
    ${st.itemVersions.length ? `<details><summary class="muted">版本紀錄（${st.itemVersions.length}）</summary>${[...st.itemVersions].reverse().map(v => `<div class="muted">第 ${v.version} 版 · ${fmtDateTime(v.at)} · ${esc(v.by)} · ${esc(v.note || '')}</div>`).join('')}</details>` : ''}
  </section>
  <section class="card">
    <h2>家人名單（可登入的 Gmail）</h2>
    <div class="table-wrap"><table class="stat-table"><thead><tr><th>Gmail</th><th>名稱</th><th>角色</th><th>順序</th></tr></thead><tbody>
      ${st.allowlist.map(a => `<tr><td>${esc(a.email)}</td><td>${esc(a.name || '')}</td><td>${a.role === 'admin' ? '管理者' : '成員'}</td><td>${a.order || ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">尚無</td></tr>'}
    </tbody></table></div>
    <form data-action="save-allow" class="row">
      <input name="email" type="email" placeholder="家人的 Gmail" required style="flex:2;min-width:180px;min-height:40px;padding:6px 10px;border:1px solid #D5D8D1;border-radius:8px">
      <input name="name" placeholder="名稱（如 老大）" required style="flex:1;min-width:100px;min-height:40px;padding:6px 10px;border:1px solid #D5D8D1;border-radius:8px">
      <select name="role" style="min-height:40px;border:1px solid #D5D8D1;border-radius:8px;padding:0 8px"><option value="member">成員</option><option value="admin">管理者</option></select>
      <input name="order" type="number" min="1" max="9" value="${st.allowlist.length + 1}" style="width:64px;min-height:40px;padding:6px 10px;border:1px solid #D5D8D1;border-radius:8px" aria-label="順序">
      <button class="btn small">新增／更新</button>
    </form>
    <p class="muted" style="margin:0">名稱與顏色由本人登入後在「個人設定」調整。名單不能刪除，只能停用（請找我處理）。</p>
  </section>
  <section class="card">
    <h2>設定</h2>
    <form data-action="save-settings" class="row" style="align-items:flex-end">
      <div class="field"><label>基金總額（元）</label><input name="fund" type="number" min="0" step="10000" value="${s.fund || 0}"></div>
      <div class="field"><label>異議期（天）</label><input name="objectionDays" type="number" min="1" max="60" value="${s.objectionDays || 7}"></div>
      <div class="field"><label>補登期限（天）</label><input name="backfillDays" type="number" min="0" max="60" value="${s.backfillDays || 7}"></div>
      <div class="field"><label>計算起始日</label><input name="startDate" type="date" value="${s.startDate || ''}"></div>
      <div class="field"><label>稱呼</label><input name="motherName" value="${esc(s.motherName || '媽媽')}" style="width:100px"></div>
      <button class="btn primary">儲存設定</button>
    </form>
  </section>`;
}
function itemRow(it = {}, i = 0) {
  return `<div class="item-row" data-row>
    <input name="name" value="${esc(it.name || '')}" placeholder="短名" required aria-label="項目">
    <input name="phrase" value="${esc(it.phrase || '')}" placeholder="陪媽媽…" required aria-label="顯示文字">
    <input name="points" type="number" min="0" value="${it.points ?? 10}" required aria-label="點數">
    <input name="rule" value="${esc(it.rule || '')}" placeholder="以一次計" aria-label="計算方式">
    <input name="active" type="checkbox" ${it.active === false ? '' : 'checked'} aria-label="啟用" style="width:22px;height:22px;justify-self:center">
    <input type="hidden" name="id" value="${esc(it.id || '')}">
  </div>`;
}

// ---------------- 對話框 ----------------
function renderModal() {
  const el = document.getElementById('modal'); if (!el) return;
  mountComments();
  if (!st.modal) { el.innerHTML = ''; return; }
  if (el.dataset.key === st.modal.key && st.modal.type !== 'detail') return; // 表單開著時不重畫，避免輸入遺失
  el.dataset.key = st.modal.key;
  const m = st.modal;
  el.innerHTML = `<div class="modal-bg" data-action="close-bg"><div class="modal" role="dialog" aria-modal="true">${m.type === 'detail' ? detailModal(m.id) : m.type === 'form' ? formModal(m.id) : m.type === 'post' ? postModal() : profileModal()}</div></div>`;
  if (m.type === 'form') initForm(el, m.id);
  if (m.type === 'detail') loadHistory(m.id);
}
function openModal(type, id) { st.modal = { type, id, key: type + ':' + (id || '') + ':' + Date.now() }; renderModal(); }
function closeModal() { st.modal = null; renderModal(); }

function detailModal(id) {
  const r = st.records.find(x => x.id === id); if (!r) return '<div class="inner">找不到這筆紀錄。</div>';
  const state = recordState(r, st.settings); const c = colorOf(r.uid);
  const mine = r.uid === st.user.uid; const inWin = withinWindow(r, st.settings);
  const stateTag = { pending: '<span class="tag warn">待確認</span>', confirmed: '<span class="tag ok">已確認</span>', disputed: '<span class="tag bad">異議中</span>', void: '<span class="tag gray">已作廢</span>' }[state];
  const objs = (r.objections || []);
  return `<div class="band" style="background:${c}"></div><div class="inner">
    <div class="top"><div style="flex:1"><h2>${esc(r.name)}${esc(r.phrase)}</h2><div class="muted">${fmtDate(r.date)} ${r.time} · ${stateTag}</div></div>
      <span class="tag ok" style="font-size:15px">+${r.points} 點</span><button class="btn icon" data-action="close" aria-label="關閉">✕</button></div>
    ${(r.photos || []).length ? `<div class="photos">${r.photos.map(p => `<a href="${p.url}" target="_blank" rel="noopener"><img src="${p.url}" alt="照片" loading="lazy"></a>`).join('')}</div>` : '<div class="muted">未附照片</div>'}
    ${r.note ? `<div>${esc(r.note)}</div>` : ''}
    ${objs.map((o, i) => `<div class="objection"><div><b>${esc(o.name)}</b> 提出異議（${fmtDateTime(o.at)}）${o.withdrawn ? '<span class="tag gray">已撤回</span>' : ''}：${esc(o.text)}</div>
      ${o.response ? `<div>${esc(r.name)} 回應：${esc(o.response)}</div>` : ''}
      <div class="row">${mine && !o.response && !o.withdrawn ? `<button class="btn small" data-action="respond" data-id="${r.id}" data-i="${i}">回應</button>` : ''}
      ${o.by === st.user.uid && !o.withdrawn ? `<button class="btn small" data-action="withdraw" data-id="${r.id}" data-i="${i}">撤回異議</button>` : ''}</div></div>`).join('')}
    <div class="row">
      ${mine && inWin && state !== 'void' ? `<button class="btn small" data-action="edit" data-id="${r.id}">修改</button><button class="btn small danger" data-action="void" data-id="${r.id}">作廢</button>` : ''}
      ${!mine && inWin && state !== 'void' ? `<button class="btn small danger" data-action="object" data-id="${r.id}">提出異議</button>` : ''}
      ${mine && !inWin && state !== 'void' ? '<span class="muted">異議期已過，紀錄已固定。</span>' : ''}
    </div>
    <div class="history" id="history"><span>登錄：${fmtDateTime(r.createdAt)}</span></div>
  </div>`;
}
async function loadHistory(id) {
  const h = await store.getHistory(id).catch(() => []);
  const el = document.getElementById('history'); if (!el) return;
  const label = { date: '日期', time: '時間', itemName: '項目', points: '點數', note: '備註', photos: '照片', status: '狀態', phrase: '內容', itemId: '項目' };
  el.innerHTML += h.map(x => `<span>${fmtDateTime(x.at)} ${esc(x.name)} 修改：${Object.keys(x.after || {}).filter(k => k !== 'itemId' && k !== 'phrase').map(k => `${label[k] || k} ${esc(fmtVal(x.before?.[k]))} → ${esc(fmtVal(x.after[k]))}`).join('；')}${x.reason ? '（' + esc(x.reason) + '）' : ''}</span>`).join('');
  if (!h.length) el.innerHTML += '<span>無修改紀錄</span>';
}
function fmtVal(v) { if (Array.isArray(v)) return v.length + ' 張'; if (v === 'void') return '作廢'; if (v === 'active') return '有效'; return v ?? '—'; }

function formModal(id) {
  const r = id ? st.records.find(x => x.id === id) : null;
  const sel = r ? r.itemId : (activeItems()[0] || {}).id;
  const minDate = todayStr(addDays(new Date(), -(st.settings.backfillDays || 7)));
  return `<div class="band" style="background:${colorOf(st.user.uid)}"></div><div class="inner">
    <div class="top"><h2>${r ? '修改紀錄' : '新增紀錄'}</h2><button class="btn icon" data-action="close" aria-label="關閉">✕</button></div>
    <form id="rec-form" data-action="save-record" data-id="${id || ''}">
      <div class="row">
        <div class="field" style="flex:3"><label for="f-date">日期</label><input id="f-date" name="date" type="date" required value="${r ? r.date : (st.cal.sel <= todayStr() && st.cal.sel >= minDate ? st.cal.sel : todayStr())}" min="${minDate}" max="${todayStr()}"></div>
        <div class="field" style="flex:2"><label for="f-time">時間</label><input id="f-time" name="time" type="time" required value="${r ? r.time : nowTime()}"></div>
      </div>
      <div class="field" style="margin-top:12px"><label>做了什麼？</label>
        <div class="item-pick">${activeItems().map(it => `<button type="button" class="${it.id === sel ? 'on' : ''}" data-pick="${it.id}"><b>${esc(it.name)}</b><span>${it.points} 點</span></button>`).join('')}</div>
        <input type="hidden" name="itemId" value="${sel || ''}">
      </div>
      <div class="preview" id="f-preview"></div>
      <div class="field" style="margin-top:12px"><label>照片（可多張，會自動縮圖）</label>
        <div class="photos" id="f-photos"></div>
        <input type="file" id="f-file" accept="image/*" multiple class="sr-only">
      </div>
      <div class="field" style="margin-top:12px"><label for="f-note">備註（選填）</label><textarea id="f-note" name="note" rows="2" placeholder="例：下班後回家陪媽媽吃飯">${esc(r ? r.note : '')}</textarea></div>
      ${r ? `<div class="field" style="margin-top:12px"><label for="f-reason">修改原因（會留在歷史）</label><input id="f-reason" name="reason" required placeholder="例：時間填錯"></div>` : ''}
      <div class="muted" id="f-hint" style="margin-top:8px"></div>
      <button class="btn primary" style="width:100%;margin-top:12px;min-height:52px;font-size:17px" id="f-submit">${r ? '儲存修改' : '送出紀錄'}</button>
    </form>
  </div>`;
}
function initForm(root, id) {
  const r = id ? st.records.find(x => x.id === id) : null;
  const form = root.querySelector('#rec-form');
  const photos = [...(r ? r.photos : [])]; // {url, path} 已上傳
  const pending = [];                       // File 待上傳
  const paint = () => {
    const it = st.items.find(x => x.id === form.itemId.value) || {};
    root.querySelector('#f-preview').innerHTML = `<span class="muted">日曆上會顯示</span><br><b style="color:${colorOf(st.user.uid)}">${esc(form.time.value)} ${esc(st.user.name)}${esc(it.phrase || '')}</b> <span class="muted">+${it.points ?? 0} 點${it.rule ? ' · ' + esc(it.rule) : ''}</span>`;
    root.querySelector('#f-photos').innerHTML = photos.map((p, i) => `<div class="ph"><img src="${p.url}" alt=""><button type="button" class="rm" data-rm="${i}" aria-label="移除照片">✕</button></div>`).join('')
      + pending.map((f, i) => `<div class="ph"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="rm" data-rmp="${i}" aria-label="移除照片">✕</button></div>`).join('')
      + `<button type="button" class="add" id="f-add"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>加照片</button>`;
  };
  form.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]'); if (pick) { form.itemId.value = pick.dataset.pick; form.querySelectorAll('[data-pick]').forEach(b => b.classList.toggle('on', b === pick)); paint(); }
    if (e.target.closest('#f-add')) root.querySelector('#f-file').click();
    const rm = e.target.closest('[data-rm]'); if (rm) { photos.splice(Number(rm.dataset.rm), 1); paint(); }
    const rmp = e.target.closest('[data-rmp]'); if (rmp) { pending.splice(Number(rmp.dataset.rmp), 1); paint(); }
  });
  form.time.addEventListener('input', paint);
  root.querySelector('#f-file').addEventListener('change', async e => {
    for (const f of e.target.files) pending.push(await compressImage(f));
    e.target.value = ''; paint();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = root.querySelector('#f-submit'); const hint = root.querySelector('#f-hint');
    if (!form.itemId.value) { hint.textContent = '請選擇項目'; return; }
    if (!backfillOk(form.date.value, st.settings)) { hint.textContent = `只能登錄今天往前 ${st.settings.backfillDays} 天內的紀錄`; return; }
    btn.disabled = true;
    try {
      let uploaded = [];
      if (pending.length) { hint.textContent = '上傳照片中…'; uploaded = await store.uploadPhotos(pending, (n, t) => hint.textContent = `上傳照片 ${n}/${t}…`); }
      const it = st.items.find(x => x.id === form.itemId.value);
      const data = { date: form.date.value, time: form.time.value, itemId: it.id, itemName: it.name, phrase: it.phrase, points: Number(it.points), note: form.note.value.trim(), photos: [...photos, ...uploaded] };
      if (r) {
        const changes = {}; for (const k of Object.keys(data)) if (JSON.stringify(data[k]) !== JSON.stringify(r[k])) changes[k] = data[k];
        if (Object.keys(changes).length) await store.updateRecord(r.id, changes, form.reason.value.trim());
        toast('已儲存修改');
      } else { await store.addRecord(data); toast(`已登錄：${it.phrase} +${it.points} 點`); }
      closeModal();
    } catch (err) { console.error(err); hint.textContent = '儲存失敗：' + (err.message || err); btn.disabled = false; }
  });
  paint();
}

function postModal() {
  return `<div class="band" style="background:var(--accent)"></div><div class="inner">
    <div class="top"><h2>發起討論或提案</h2><button class="btn icon" data-action="close" aria-label="關閉">✕</button></div>
    <form data-action="save-post" style="display:flex;flex-direction:column;gap:12px">
      <div class="seg" style="align-self:flex-start"><button type="button" class="on" data-ptype="discussion">討論</button><button type="button" data-ptype="proposal">點數表提案（投票）</button></div>
      <input type="hidden" name="type" value="discussion">
      <div class="field"><label for="p-title">標題</label><input id="p-title" name="title" required></div>
      <div id="p-prop" class="hidden" style="display:flex;flex-direction:column;gap:12px">
        <div class="field"><label for="p-item">要調整的項目</label><select id="p-item" name="itemId">${activeItems().map(i => `<option value="${i.id}">${esc(i.name)}（目前 ${i.points} 點）</option>`).join('')}<option value="__new">新增項目…</option></select></div>
        <div class="field hidden" id="p-newname"><label for="p-name">新項目名稱 / 顯示文字</label><input id="p-name" name="newName" placeholder="短名，例：陪運動"><input name="newPhrase" placeholder="顯示文字，例：陪媽媽運動" style="margin-top:6px"></div>
        <div class="field"><label for="p-val">新點數</label><input id="p-val" name="newValue" type="number" min="0" value="10"></div>
        <div class="field"><label for="p-deadline">投票截止日</label><input id="p-deadline" name="deadline" type="date" value="${todayStr(addDays(new Date(), 7))}"></div>
      </div>
      <div class="field"><label for="p-body">說明</label><textarea id="p-body" name="body" rows="3"></textarea></div>
      <button class="btn primary">送出</button>
    </form></div>`;
}
function profileModal() {
  const u = st.user;
  return `<div class="band" style="background:${colorOf(u.uid)}"></div><div class="inner">
    <div class="top"><h2>個人設定</h2><button class="btn icon" data-action="close" aria-label="關閉">✕</button></div>
    <form data-action="save-profile" style="display:flex;flex-direction:column;gap:12px">
      <div class="field"><label for="pf-name">顯示名稱</label><input id="pf-name" name="name" value="${esc(u.name)}" required maxlength="10"></div>
      <div class="field"><label>我的顏色</label><div class="row">${COLOR_CHOICES.map(c => `<label style="cursor:pointer"><input type="radio" name="color" value="${c}" ${c === u.color ? 'checked' : ''} class="sr-only"><span class="dot" style="width:36px;height:36px;background:${c};outline:${c === u.color ? '3px solid var(--ink)' : 'none'};outline-offset:2px"></span></label>`).join('')}</div></div>
      <div class="muted">登入帳號：${esc(u.email)}</div>
      <div class="row"><button class="btn primary">儲存</button>${isAdmin() ? '<button type="button" class="btn" data-action="view" data-v="admin">管理頁</button>' : ''}<button type="button" class="btn" data-action="logout" style="margin-left:auto">登出</button></div>
    </form></div>`;
}

// ---------------- 事件 ----------------
$app.addEventListener('click', async e => {
  const t = e.target.closest('[data-action]'); if (!t) return;
  const a = t.dataset.action;
  if (t.tagName === 'FORM' || t.tagName === 'SELECT') return;
  try {
    switch (a) {
      case 'login': await store.login(); break;
      case 'logout': await store.logout(); closeModal(); break;
      case 'view': st.view = t.dataset.v; st.tab = t.dataset.v === 'cal' ? 'cal' : t.dataset.v; closeModal(); render(); break;
      case 'tab': st.tab = t.dataset.t; if (['cal', 'board', 'admin'].includes(st.tab)) st.view = st.tab; render(); break;
      case 'new': openModal('form'); break;
      case 'open': openModal('detail', t.dataset.id); break;
      case 'edit': openModal('form', t.dataset.id); break;
      case 'close': case 'close-bg': if (a === 'close-bg' && e.target !== t) return; closeModal(); break;
      case 'profile': openModal('profile'); break;
      case 'new-post': openModal('post'); break;
      case 'cal-today': { const d = new Date(); Object.assign(st.cal, { year: d.getFullYear(), month: d.getMonth(), weekStart: todayStr(addDays(d, -d.getDay())), sel: todayStr() }); render(); break; }
      case 'cal-prev': case 'cal-next': { const dir = a === 'cal-next' ? 1 : -1; if (st.cal.mode === 'month') { const d = new Date(st.cal.year, st.cal.month + dir, 1); st.cal.year = d.getFullYear(); st.cal.month = d.getMonth(); } else { const ws = addDays(parseDate(st.cal.weekStart), 7 * dir); st.cal.weekStart = todayStr(ws); st.cal.year = ws.getFullYear(); st.cal.month = ws.getMonth(); } render(); break; }
      case 'cal-mode': st.cal.mode = t.dataset.m; render(); break;
      case 'cal-sel': if (e.target.closest('.ev')) return; st.cal.sel = t.dataset.d; render(); break;
      case 'log-who': st.logWho = t.dataset.uid; render(); break;
      case 'stat-period': st.statPeriod = t.dataset.p; render(); break;
      case 'export': { const csv = toCSV(st.records, st.members, st.settings); const b = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = `陪伴紀錄-${todayStr()}.csv`; l.click(); URL.revokeObjectURL(u); break; }
      case 'vote': await store.vote(t.dataset.id, t.dataset.v); toast('已投票'); break;
      case 'close-post': await closePost(t.dataset.id); break;
      case 'void': { const why = prompt('作廢原因？（會留在歷史）'); if (why === null) return; await store.voidRecord(t.dataset.id, why); toast('已作廢'); closeModal(); break; }
      case 'object': { const why = prompt('異議內容？（登錄人與其他人都會看到）'); if (!why) return; await store.addObjection(t.dataset.id, why); toast('已提出異議'); closeModal(); break; }
      case 'respond': { const txt = prompt('回應異議：'); if (!txt) return; await store.patchObjection(t.dataset.id, Number(t.dataset.i), { response: txt }); closeModal(); break; }
      case 'withdraw': { if (!confirm('確定撤回這筆異議？')) return; await store.patchObjection(t.dataset.id, Number(t.dataset.i), { withdrawn: true }); toast('已撤回'); closeModal(); break; }
      case 'add-item-row': $app.querySelector('#item-rows').insertAdjacentHTML('beforeend', itemRow({})); break;
    }
  } catch (err) { console.error(err); toast('操作失敗：' + (err.message || err)); }
});
$app.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.action === 'switch-user') { await store.switchUser(t.value); st.logWho = t.value; }
  if (t.name === 'color' && t.form?.dataset.action === 'save-profile') t.form.querySelectorAll('.dot').forEach(d => d.style.outline = 'none'), (t.nextElementSibling.style.outline = '3px solid var(--ink)');
});
$app.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-action]'); if (!f) return;
  e.preventDefault();
  const fd = new FormData(f);
  try {
    switch (f.dataset.action) {
      case 'comment': { const text = fd.get('text').trim(); if (!text) return; await store.addComment(f.dataset.id, text); f.reset(); break; }
      case 'save-profile': await store.updateProfile({ name: fd.get('name').trim(), color: fd.get('color') }); toast('已儲存'); closeModal(); break;
      case 'save-settings': await store.saveSettings({ fund: Number(fd.get('fund')), objectionDays: Number(fd.get('objectionDays')), backfillDays: Number(fd.get('backfillDays')), startDate: fd.get('startDate'), motherName: fd.get('motherName').trim() || '媽媽' }); toast('設定已儲存'); break;
      case 'save-allow': await store.saveAllowlist(fd.get('email'), { name: fd.get('name').trim(), role: fd.get('role'), order: Number(fd.get('order')) || 9, color: COLOR_CHOICES[(Number(fd.get('order')) || 1) - 1] || '#2E6B5E' }); toast('名單已更新'); f.reset(); break;
      case 'save-items': {
        const rows = [...f.querySelectorAll('[data-row]')].map(r => ({ id: r.querySelector('[name=id]').value || undefined, name: r.querySelector('[name=name]').value.trim(), phrase: r.querySelector('[name=phrase]').value.trim(), points: Number(r.querySelector('[name=points]').value), rule: r.querySelector('[name=rule]').value.trim(), active: r.querySelector('[name=active]').checked }));
        if (!confirm(`確定儲存為第 ${(st.settings.version || 0) + 1} 版？只影響之後的紀錄。`)) return;
        await store.saveItems(rows, fd.get('note')); toast('點數表已更新'); break;
      }
      case 'save-post': {
        const type = fd.get('type'); const post = { type, title: fd.get('title').trim(), body: fd.get('body').trim() };
        if (type === 'proposal') {
          post.deadline = fd.get('deadline');
          if (fd.get('itemId') === '__new') post.proposal = { kind: 'new', name: fd.get('newName').trim(), phrase: fd.get('newPhrase').trim(), newValue: Number(fd.get('newValue')) };
          else { const it = st.items.find(i => i.id === fd.get('itemId')); post.proposal = { kind: 'change', itemId: it.id, itemName: it.name, newValue: Number(fd.get('newValue')) }; }
        }
        await store.addPost(post); toast('已發布'); closeModal(); st.view = 'board'; st.tab = 'board'; render(); break;
      }
    }
  } catch (err) { console.error(err); toast('儲存失敗：' + (err.message || err)); }
});
// 提案表單的切換（不重畫整個對話框）
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ptype]'); if (!b) return;
  const f = b.closest('form'); f.type.value = b.dataset.ptype;
  f.querySelectorAll('[data-ptype]').forEach(x => x.classList.toggle('on', x === b));
  f.querySelector('#p-prop').classList.toggle('hidden', b.dataset.ptype !== 'proposal');
});
document.addEventListener('change', e => {
  if (e.target.id === 'p-item') e.target.form.querySelector('#p-newname').classList.toggle('hidden', e.target.value !== '__new');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && st.modal) closeModal(); });

async function closePost(pid) {
  const p = st.posts.find(x => x.id === pid);
  if (p.type !== 'proposal') { if (!confirm('結束這則討論？')) return; await store.closePost(pid, 'closed'); return; }
  const votes = p.votes || {}; const yes = Object.values(votes).filter(v => v === 'yes').length;
  const pass = yes * 2 > (st.members.length || 3);
  if (!confirm(`贊成 ${yes} 票，${pass ? '過半通過' : '未過半'}。${pass ? '結案並套用到點數表（成為新版本）？' : '結案為「未通過」？'}`)) return;
  if (pass && isAdmin()) {
    const items = st.items.map(i => ({ ...i }));
    if (p.proposal.kind === 'new') items.push({ name: p.proposal.name, phrase: p.proposal.phrase || p.proposal.name, points: p.proposal.newValue, rule: '', active: true });
    else { const it = items.find(i => i.id === p.proposal.itemId); if (it) it.points = p.proposal.newValue; }
    await store.saveItems(items, `提案「${p.title}」投票通過（贊成 ${yes} 票）`);
  }
  await store.closePost(pid, pass ? 'pass' : 'fail');
  toast(pass ? '已通過並更新點數表' : '已結案（未通過）');
}

boot().catch(err => { console.error(err); $app.innerHTML = `<div class="login"><div class="card"><h2>啟動失敗</h2><div class="muted">${esc(err.message || err)}</div></div></div>`; });
