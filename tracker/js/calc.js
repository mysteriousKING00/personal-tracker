'use strict';
/* Pure calculations over the stored data: time, habits, tasks, goals, weekly summaries. */
const Calc = (() => {
  const D = () => Store.get();

  const project = id => D().projects.find(p => p.id === id);
  const area = id => D().areas.find(a => a.id === id);
  const projectName = id => (project(id) || { name: '(deleted)' }).name;
  const projectColor = id => (project(id) || { color: '#999' }).color;
  const areaOf = pid => { const p = project(pid); return p ? area(p.areaId) : null; };

  const entryDay = e => U.dateKey(new Date(e.start));
  const entryMin = e => U.minutesBetween(e.start, e.end);
  const entriesOn = key => D().entries.filter(e => entryDay(e) === key).sort((a, b) => a.start.localeCompare(b.start));
  const entriesIn = (fromKey, toKey) => D().entries.filter(e => { const k = entryDay(e); return k >= fromKey && k <= toKey; });

  function minutesOn(key) { return entriesOn(key).reduce((s, e) => s + entryMin(e), 0); }
  function minutesByProject(fromKey, toKey) {
    const m = {};
    for (const e of entriesIn(fromKey, toKey)) m[e.projectId] = (m[e.projectId] || 0) + entryMin(e);
    return m;
  }
  function minutesByArea(fromKey, toKey) {
    const m = {};
    for (const [pid, min] of Object.entries(minutesByProject(fromKey, toKey))) {
      const a = areaOf(pid); const k = a ? a.id : 'none';
      m[k] = (m[k] || 0) + min;
    }
    return m;
  }

  /* ---------- habits ---------- */
  const weekday = key => U.parseKey(key).getDay();
  function habitScheduled(h, key) {
    if (key < h.start) return false;
    if (h.archived && h.archivedOn && key >= h.archivedOn) return false;
    if (h.archived && !h.archivedOn) return false;
    return h.days.includes(weekday(key));
  }
  const habitValue = (h, key) => (D().habitLog[key] || {})[h.id];
  // A number habit without a target is "tracked only": it never counts toward completion.
  const counts = h => h.type === 'check' || (h.type === 'number' && h.target != null && h.target !== '');
  function habitDone(h, key) {
    const v = habitValue(h, key);
    if (h.type === 'check') return v === true;
    if (v == null || v === '' || !counts(h)) return false;
    return h.direction === 'max' ? Number(v) <= Number(h.target) : Number(v) >= Number(h.target);
  }
  const scheduledHabits = key => D().habits.filter(h => counts(h) && habitScheduled(h, key));
  function dayHabits(key) {
    const hs = scheduledHabits(key);
    return { scheduled: hs.length, done: hs.filter(h => habitDone(h, key)).length };
  }
  function habitRate(h, fromKey, toKey) {
    let s = 0, d = 0;
    for (let k = fromKey; k <= toKey; k = U.dateKey(U.addDays(U.parseKey(k), 1))) {
      if (k > U.todayKey()) break;
      if (habitScheduled(h, k) && counts(h)) { s++; if (habitDone(h, k)) d++; }
    }
    return { scheduled: s, done: d, rate: U.pct(d, s) };
  }
  function streak(h) {
    let n = 0; let k = U.todayKey();
    if (habitScheduled(h, k) && !habitDone(h, k)) k = U.dateKey(U.addDays(U.parseKey(k), -1)); // today not finished yet
    for (let i = 0; i < 1000; i++) {
      if (k < h.start) break;
      if (habitScheduled(h, k)) { if (habitDone(h, k)) n++; else break; }
      k = U.dateKey(U.addDays(U.parseKey(k), -1));
    }
    return n;
  }

  /* ---------- day level for the heatmap (0–4) ---------- */
  function dayScore(key) {
    const h = dayHabits(key);
    const hr = h.scheduled ? h.done / h.scheduled : null;
    const tr = Math.min(1, minutesOn(key) / (D().settings.dailyTargetMin || 180));
    if (hr == null) return tr;
    return 0.5 * hr + 0.5 * tr;
  }
  function dayLevel(key) {
    if (key > U.todayKey()) return -1;
    const s = dayScore(key);
    if (s <= 0) return 0;
    if (s < 0.35) return 1;
    if (s < 0.6) return 2;
    if (s < 0.85) return 3;
    return 4;
  }

  /* ---------- tasks ---------- */
  function taskState(t, refKey = U.todayKey()) {
    if (t.status === 'done') return 'done';
    if (t.status === 'dropped') return 'dropped';
    if (t.due && t.due < refKey) return 'missed';
    return 'open';
  }

  /* ---------- plans ---------- */
  const planFor = wk => D().plans[wk] || D().settings.defaultPlan || {};

  /* ---------- goals ---------- */
  function goalProgress(g) {
    const today = U.todayKey();
    const end = g.deadline && g.deadline < today ? g.deadline : today;
    if (g.type === 'time') {
      let min = 0;
      for (const e of entriesIn(g.start, end)) {
        if (g.projectId && e.projectId === g.projectId) min += entryMin(e);
        else if (g.areaId && (areaOf(e.projectId) || {}).id === g.areaId) min += entryMin(e);
      }
      return { current: min / 60, target: Number(g.target), unit: 'h', pct: Math.min(100, U.pct(min / 60, Number(g.target)) || 0) };
    }
    if (g.type === 'tasks') {
      const ts = D().tasks.filter(t => t.goalId === g.id && t.status !== 'dropped');
      const done = ts.filter(t => t.status === 'done').length;
      return { current: done, target: ts.length, unit: 'tasks', pct: U.pct(done, ts.length) || 0 };
    }
    if (g.type === 'habit') {
      const h = D().habits.find(x => x.id === g.habitId);
      const r = h ? habitRate(h, g.start, end) : { rate: 0 };
      return { current: r.rate || 0, target: Number(g.target), unit: '%', pct: Math.min(100, U.pct(r.rate || 0, Number(g.target)) || 0) };
    }
    return { current: Number(g.current || 0), target: Number(g.target), unit: g.unit || '', pct: Math.min(100, U.pct(Number(g.current || 0), Number(g.target)) || 0) };
  }
  function goalPace(g) {
    // Expected progress if the target were spread evenly between start and deadline.
    if (!g.deadline) return null;
    const s = U.parseKey(g.start), e = U.parseKey(g.deadline), t = new Date();
    const total = (e - s) / 86400000 + 1, gone = Math.min(total, Math.max(0, (t - s) / 86400000 + 1));
    return Math.round((100 * gone) / total);
  }

  /* ---------- weekly summary (used by dashboard, report, history, export) ---------- */
  function week(wk) {
    const days = U.weekDays(wk);
    const from = days[0], to = days[6];
    const byProject = minutesByProject(from, to);
    const plan = planFor(wk);
    const projectIds = new Set([...Object.keys(byProject), ...Object.keys(plan).filter(k => plan[k] > 0)]);
    const projects = [...projectIds].map(pid => ({
      id: pid, name: projectName(pid), area: (areaOf(pid) || { name: '' }).name, color: projectColor(pid),
      plannedMin: Number(plan[pid] || 0), actualMin: Math.round(byProject[pid] || 0)
    })).sort((a, b) => b.actualMin - a.actualMin || b.plannedMin - a.plannedMin);
    const trackedMin = projects.reduce((s, p) => s + p.actualMin, 0);
    const plannedMin = projects.reduce((s, p) => s + p.plannedMin, 0);
    const plannedHitMin = projects.reduce((s, p) => s + Math.min(p.actualMin, p.plannedMin), 0);

    const byDay = days.map(k => {
      const h = dayHabits(k);
      return { date: k, minutes: Math.round(minutesOn(k)), habitsDone: h.done, habitsScheduled: h.scheduled, level: dayLevel(k) };
    });
    const habits = D().habits.filter(h => !h.archived || (h.archivedOn && h.archivedOn > from)).map(h => {
      const r = habitRate(h, from, to);
      const values = {}; days.forEach(k => { const v = habitValue(h, k); if (v !== undefined) values[k] = v; });
      const nums = Object.values(values).filter(v => typeof v === 'number' || (typeof v === 'string' && v !== '')).map(Number);
      return { id: h.id, name: h.name, type: h.type, unit: h.unit || '', target: h.target ?? null, direction: h.direction || null,
        scheduled: r.scheduled, done: r.done, rate: r.rate, values,
        total: h.type === 'number' ? nums.reduce((a, b) => a + b, 0) : null,
        average: h.type === 'number' && nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null };
    });
    const counted = habits.filter(h => h.rate != null && (h.type === 'check' || h.target != null));
    const hs = counted.reduce((s, h) => s + h.scheduled, 0), hd = counted.reduce((s, h) => s + h.done, 0);

    const refEnd = to < U.todayKey() ? U.dateKey(U.addDays(U.parseKey(to), 1)) : U.todayKey();
    const inWeek = k => k && k >= from && k <= to;
    const tasks = { done: [], missed: [], pending: [] };
    for (const t of D().tasks) {
      if (t.status === 'done' && t.doneAt && inWeek(t.doneAt)) tasks.done.push(t);
      else if (t.status !== 'done' && t.status !== 'dropped' && inWeek(t.due)) (taskState(t, refEnd) === 'missed' ? tasks.missed : tasks.pending).push(t);
    }
    const goodDays = byDay.filter(d => d.habitsScheduled && d.habitsDone >= Math.ceil(d.habitsScheduled * 6 / 7)).length;
    return { week: wk, from, to, days, projects, trackedMin, plannedMin, planHitPct: U.pct(plannedHitMin, plannedMin),
      byDay, habits, habitRate: U.pct(hd, hs), habitsDone: hd, habitsScheduled: hs, goodDays, tasks,
      activeDays: byDay.filter(d => d.level > 0).length };
  }
  function firstWeek() {
    const d = D();
    const keys = [d.created ? U.dateKey(new Date(d.created)) : U.todayKey()];
    d.entries.forEach(e => keys.push(entryDay(e)));
    Object.keys(d.habitLog).forEach(k => keys.push(k));
    return U.isoWeek(U.parseKey(keys.sort()[0]));
  }
  return { project, area, projectName, projectColor, areaOf, entryDay, entryMin, entriesOn, entriesIn, minutesOn, minutesByProject, minutesByArea,
    habitScheduled, habitValue, habitDone, counts, scheduledHabits, dayHabits, habitRate, streak, dayScore, dayLevel, taskState, planFor,
    goalProgress, goalPace, week, firstWeek };
})();
