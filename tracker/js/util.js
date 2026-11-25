'use strict';
/* Small helpers shared by every module. No dependencies. */
const U = (() => {
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const todayKey = () => dateKey(new Date());
  const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const isoWeek = d => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `${t.getUTCFullYear()}-W${pad(Math.ceil(((t - y0) / 86400000 + 1) / 7))}`;
  };
  const weekMonday = wk => { const [y, w] = wk.split('-W').map(Number); return addDays(mondayOf(new Date(y, 0, 4)), (w - 1) * 7); };
  const weekDays = wk => { const m = weekMonday(wk); return [0, 1, 2, 3, 4, 5, 6].map(i => dateKey(addDays(m, i))); };
  const shiftWeek = (wk, n) => isoWeek(addDays(weekMonday(wk), 7 * n));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtMin = m => { m = Math.round(m || 0); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h}h ${pad(mm)}m` : `${mm}m`; };
  const fmtH = m => ((m || 0) / 60).toFixed(1) + ' h';
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
  const fmtPct = p => (p == null ? '–' : p + '%');
  const hhmm = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const minutesBetween = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 60000);
  const fmtDate = k => parseKey(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDateLong = k => parseKey(k).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const atTime = (key, hm) => { const d = parseKey(key); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  const csv = rows => rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const signed = (n, unit = '') => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n) + unit;
  return { pad, dateKey, parseKey, addDays, todayKey, mondayOf, isoWeek, weekMonday, weekDays, shiftWeek, uid, esc, fmtMin, fmtH, pct, fmtPct, hhmm, minutesBetween, fmtDate, fmtDateLong, atTime, download, csv, signed };
})();
