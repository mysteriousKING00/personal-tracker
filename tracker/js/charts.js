'use strict';
/* Dependency-free SVG charts. Colors come from CSS variables, so they follow light/dark mode and print. */
const Charts = (() => {
  const e = U.esc;

  // GitHub-style contribution calendar: columns = weeks (Mon→Sun rows).
  function heatmap(fromKey, toKey, levelFn, titleFn) {
    const start = U.mondayOf(U.parseKey(fromKey)), end = U.parseKey(toKey);
    const cell = 13, gap = 3, left = 28, top = 18;
    const weeks = Math.ceil(((end - start) / 86400000 + 1) / 7);
    const w = left + weeks * (cell + gap), h = top + 7 * (cell + gap);
    let out = `<svg class="heatmap" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Daily activity calendar">`;
    ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].forEach((l, i) => { if (l) out += `<text x="0" y="${top + i * (cell + gap) + 10}" class="ax">${l}</text>`; });
    let lastMonth = -1;
    for (let wi = 0; wi < weeks; wi++) {
      const monday = U.addDays(start, wi * 7);
      if (monday.getMonth() !== lastMonth && (monday.getDate() <= 7 || wi === 0) && !(wi === 0 && monday.getDate() > 21)) {
        lastMonth = monday.getMonth();
        out += `<text x="${left + wi * (cell + gap)}" y="11" class="ax">${monday.toLocaleDateString(undefined, { month: 'short' })}</text>`;
      }
      for (let di = 0; di < 7; di++) {
        const d = U.addDays(monday, di), k = U.dateKey(d);
        if (d > end) continue;
        const lvl = levelFn(k);
        const cls = lvl < 0 ? 'lvl-future' : `lvl-${lvl}`;
        out += `<rect x="${left + wi * (cell + gap)}" y="${top + di * (cell + gap)}" width="${cell}" height="${cell}" rx="2" class="${cls}"><title>${e(titleFn ? titleFn(k) : k)}</title></rect>`;
      }
    }
    return out + '</svg>';
  }

  // Horizontal bars, optional planned marker per row.
  function hbars(rows, { fmt = v => v, max = null, planned = false } = {}) {
    if (!rows.length) return '<p class="muted">No data yet.</p>';
    const m = max || Math.max(1, ...rows.map(r => Math.max(r.value, r.plan || 0)));
    const rowH = 26, labelW = Math.min(200, Math.max(70, 8 + 7 * Math.max(...rows.map(r => String(r.label).length)))), barW = 300, w = labelW + barW + 90, h = rows.length * rowH + 4;
    let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img">`;
    rows.forEach((r, i) => {
      const y = i * rowH + 4, bw = Math.max(0, (r.value / m) * barW);
      out += `<text x="${labelW - 8}" y="${y + 14}" text-anchor="end" class="lbl">${e(r.label)}</text>`;
      out += `<rect x="${labelW}" y="${y + 3}" width="${barW}" height="15" rx="3" class="track"/>`;
      out += `<rect x="${labelW}" y="${y + 3}" width="${bw}" height="15" rx="3" fill="${e(r.color || 'var(--accent)')}"/>`;
      if (planned && r.plan) { const px = labelW + (r.plan / m) * barW; out += `<line x1="${px}" x2="${px}" y1="${y}" y2="${y + 21}" class="planline"/>`; }
      out += `<text x="${labelW + barW + 8}" y="${y + 14}" class="val">${e(fmt(r.value, r))}</text>`;
    });
    return out + '</svg>';
  }

  // Vertical columns (e.g. minutes per day), optional target line.
  function columns(points, { fmt = v => v, target = null, height = 150 } = {}) {
    if (!points.length) return '<p class="muted">No data yet.</p>';
    const m = Math.max(1, target || 0, ...points.map(p => p.value));
    const colW = Math.max(8, Math.min(40, Math.floor(560 / points.length) - 4)), gap = 4;
    const w = points.length * (colW + gap) + 40, h = height + 34, base = height + 4;
    let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img">`;
    const showEvery = Math.ceil(points.length / 14);
    points.forEach((p, i) => {
      const x = 36 + i * (colW + gap), bh = (p.value / m) * height;
      out += `<rect x="${x}" y="${base - bh}" width="${colW}" height="${Math.max(0, bh)}" rx="2" fill="${e(p.color || 'var(--accent)')}"><title>${e(p.label)}: ${e(fmt(p.value))}</title></rect>`;
      if (i % showEvery === 0) out += `<text x="${x + colW / 2}" y="${h - 14}" text-anchor="middle" class="ax">${e(p.short || p.label)}</text>`;
    });
    out += `<text x="0" y="12" class="ax">${e(fmt(m))}</text><line x1="34" x2="${w}" y1="${base}" y2="${base}" class="axis"/>`;
    if (target) { const ty = base - (target / m) * height; out += `<line x1="34" x2="${w}" y1="${ty}" y2="${ty}" class="planline"/><text x="0" y="${ty + 4}" class="ax">goal</text>`; }
    return out + '</svg>';
  }

  // Line chart for trends across weeks (values may be null).
  function line(points, { fmt = v => v, max = null, height = 140 } = {}) {
    const vals = points.map(p => p.value).filter(v => v != null);
    if (!vals.length) return '<p class="muted">No data yet.</p>';
    const m = max || Math.max(1, ...vals);
    const step = 48, w = 40 + Math.max(1, points.length - 1) * step + 20, h = height + 34, base = height + 6;
    const xy = (i, v) => [40 + i * step, base - (v / m) * height];
    let path = '', dots = '';
    points.forEach((p, i) => {
      if (p.value == null) return;
      const [x, y] = xy(i, p.value);
      path += (path ? 'L' : 'M') + x + ' ' + y + ' ';
      dots += `<circle cx="${x}" cy="${y}" r="3.5" class="dot"><title>${e(p.label)}: ${e(fmt(p.value))}</title></circle>`;
    });
    let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img">`;
    out += `<text x="0" y="12" class="ax">${e(fmt(m))}</text><line x1="36" x2="${w}" y1="${base}" y2="${base}" class="axis"/>`;
    out += `<path d="${path}" class="trend"/>` + dots;
    points.forEach((p, i) => { out += `<text x="${40 + i * step}" y="${h - 12}" text-anchor="middle" class="ax">${e(p.short || p.label)}</text>`; });
    return out + '</svg>';
  }

  const bar = (pct, color) => `<div class="pbar"><span style="width:${Math.max(0, Math.min(100, pct || 0))}%;${color ? 'background:' + e(color) : ''}"></span></div>`;
  return { heatmap, hbars, columns, line, bar };
})();
