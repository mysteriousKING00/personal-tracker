'use strict';
/* Persistence: one JSON document in localStorage. Export/import keeps the data yours. */
const Store = (() => {
  const KEY = 'personal-tracker-v1';
  const SCHEMA = 1;
  const empty = () => ({
    schema: SCHEMA,
    created: new Date().toISOString(),
    settings: { dailyTargetMin: 180, lastBackup: null, defaultPlan: {} },
    areas: [], projects: [], entries: [], running: null,
    habits: [], habitLog: {}, tasks: [], goals: [], plans: {}, reviews: {}
  });
  let data = null;

  function migrate(d) {
    const base = empty();
    for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
    d.settings = { ...base.settings, ...d.settings };
    d.schema = SCHEMA;
    return d;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? migrate(JSON.parse(raw)) : null;
    } catch (e) { console.error(e); data = null; }
    return data;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { alert('Could not save (browser storage full or blocked). Export a backup now from Settings.'); return false; }
  }
  const get = () => data;
  function replace(d) { data = migrate(d); save(); }
  function merge(d) {
    d = migrate(d);
    const add = (arr, more) => { const ids = new Set(arr.map(x => x.id)); more.forEach(x => { if (!ids.has(x.id)) arr.push(x); }); };
    // Records that exist on both sides: carry over progress made on the other device.
    const tasks = new Map(data.tasks.map(t => [t.id, t]));
    for (const t of d.tasks) {
      const mine = tasks.get(t.id);
      if (!mine || t.status === 'todo' || !t.status) continue;
      // Imported task is done/dropped: take it if ours is still open, or if theirs was closed later.
      if (mine.status === 'todo' || (t.doneAt || '') > (mine.doneAt || '')) { mine.status = t.status; mine.doneAt = t.doneAt || null; }
    }
    const goals = new Map(data.goals.map(g => [g.id, g]));
    for (const g of d.goals) {
      const mine = goals.get(g.id);
      if (mine && mine.type === 'manual' && g.type === 'manual') mine.current = Math.max(Number(mine.current || 0), Number(g.current || 0));
    }
    ['areas', 'projects', 'entries', 'habits', 'tasks', 'goals'].forEach(k => add(data[k], d[k]));
    for (const [day, vals] of Object.entries(d.habitLog)) data.habitLog[day] = { ...vals, ...(data.habitLog[day] || {}) };
    for (const [wk, p] of Object.entries(d.plans)) if (!data.plans[wk]) data.plans[wk] = p;
    for (const [wk, r] of Object.entries(d.reviews)) if (!data.reviews[wk]) data.reviews[wk] = r;
    save();
  }
  function wipe() { localStorage.removeItem(KEY); data = null; }
  return { KEY, empty, load, save, get, replace, merge, wipe };
})();
