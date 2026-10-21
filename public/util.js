export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function pad(n) { return String(n).padStart(2, '0'); }
export function todayStr(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
export function fmtDate(s, withWeek = true) {
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}` + (withWeek ? `（${WEEK[d.getDay()]}）` : '');
}
export function fmtDateTime(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
  return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export function toDate(d) { return d instanceof Date ? d : (d && d.toDate ? d.toDate() : new Date(d)); }
export function money(n) { return 'NT$ ' + Math.round(n).toLocaleString('zh-TW'); }
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function nowTime() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

// 將圖片縮到最長邊 1600px、JPEG 0.82，省流量與儲存空間
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

// 顏色對比：決定色塊上的字要白還是黑
export function textOn(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1E2624' : '#FFFFFF';
}

export const COLOR_CHOICES = ['#2F6DB5', '#B45F12', '#7A5BA6', '#2E6B5E', '#B3261E', '#5B6460', '#0E7490', '#9D174D'];
