'use strict';
/* Controller: routing, actions, forms, exports. */
(() => {
  const st = Views.st;
  const D = () => Store.get();
  const save = () => Store.save();
  const $ = s => document.querySelector(s);
  let tick = null;

  /* ---------- rendering ---------- */
  function render() {
    const main = $('#view');
    document.querySelectorAll('nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === st.view));
    if (!D()) { $('nav').hidden = true; main.innerHTML = Views.welcome(); return; }
    $('nav').hidden = false;
    main.innerHTML = (Views.views[st.view] || Views.views.day)();
    banner();
    clearInterval(tick);
    if (st.view === 'day' && D().running) tick = setInterval(() => {
      const el = $('#elapsed'); if (el && D().running) el.textContent = U.fmtMin(U.minutesBetween(D().running.start, new Date()));
    }, 15000);
    const run = D().running;
    document.title = run ? `● ${Calc.projectName(run.projectId)} · Tracker` : 'Personal Tracker';
  }
  function banner() {
    const d = D(); const b = $('#banner');
    const days = Math.floor((Date.now() - new Date(d.settings.lastBackup || d.created).getTime()) / 86400000);
    const hasData = d.entries.length || Object.keys(d.habitLog).length;
    b.hidden = !(hasData && days >= 7);
    if (!b.hidden) b.innerHTML = `Your last backup was ${d.settings.lastBackup ? days + ' days ago' : 'never'}. Data lives only in this browser. <button class="btn" data-act="backup">Download backup</button>`;
  }
  function go(view) { if (st.view === 'report') saveReview(); st.view = view; st.editEntry = st.editHabit = st.editTask = null; location.hash = view; render(); window.scrollTo(0, 0); }

  /* ---------- exports ---------- */
  function weekExport(wk) {
    const w = Calc.week(wk), pw = Calc.week(U.shiftWeek(wk, -1));
    const t = x => ({ id: x.id, title: x.title, project: x.projectId ? Calc.projectName(x.projectId) : null, due: x.due || null, doneAt: x.doneAt || null, milestone: !!x.milestone, plannedMin: x.plannedMin ?? null });
    return {
      schema: 'personal-tracker.week.v1', week: wk, from: w.from, to: w.to, generated: new Date().toISOString(),
      totals: { trackedMin: w.trackedMin, plannedMin: w.plannedMin, planHitPct: w.planHitPct, habitRate: w.habitRate, habitsDone: w.habitsDone, habitsScheduled: w.habitsScheduled, goodDays: w.goodDays, activeDays: w.activeDays, tasksDone: w.tasks.done.length, tasksMissed: w.tasks.missed.length, tasksPending: w.tasks.pending.length },
      previousWeek: { week: pw.week, trackedMin: pw.trackedMin, habitRate: pw.habitRate, goodDays: pw.goodDays, tasksDone: pw.tasks.done.length, tasksMissed: pw.tasks.missed.length },
      byProject: w.projects.map(p => ({ project: p.name, area: p.area, plannedMin: p.plannedMin, actualMin: p.actualMin })),
      byDay: w.byDay,
      habits: w.habits.map(h => ({ name: h.name, type: h.type, unit: h.unit, target: h.target, direction: h.direction, scheduled: h.scheduled, done: h.done, rate: h.rate, total: h.total, average: h.average, values: h.values })),
      tasks: { done: w.tasks.done.map(t), missed: w.tasks.missed.map(t), pending: w.tasks.pending.map(t) },
      goals: D().goals.map(g => { const p = Calc.goalProgress(g); return { title: g.title, type: g.type, current: +Number(p.current).toFixed(2), target: p.target, unit: p.unit, pct: p.pct, expectedPct: Calc.goalPace(g), deadline: g.deadline || null }; }),
      entries: Calc.entriesIn(w.from, w.to).map(en => ({ date: Calc.entryDay(en), start: en.start, end: en.end, minutes: Math.round(Calc.entryMin(en)), project: Calc.projectName(en.projectId), area: (Calc.areaOf(en.projectId) || {}).name || null, note: en.note || '' })),
      review: D().reviews[wk] || {}
    };
  }
  function weekCsv(wk) {
    const x = weekExport(wk);
    const rows = [['section', 'date', 'name', 'area', 'planned_min', 'actual_min', 'value', 'status', 'note']];
    x.byProject.forEach(p => rows.push(['project', '', p.project, p.area, p.plannedMin, p.actualMin, '', '', '']));
    x.entries.forEach(en => rows.push(['entry', en.date, en.project, en.area, '', en.minutes, '', '', en.note]));
    x.habits.forEach(h => { Object.entries(h.values).forEach(([k, v]) => rows.push(['habit', k, h.name, '', '', '', v, '', ''])); rows.push(['habit_rate', '', h.name, '', '', '', h.rate ?? '', '', '']); });
    ['done', 'missed', 'pending'].forEach(s => x.tasks[s].forEach(tk => rows.push(['task', tk.due || '', tk.title, '', tk.plannedMin ?? '', '', '', s, tk.project || ''])));
    x.goals.forEach(g => rows.push(['goal', g.deadline || '', g.title, '', g.target, '', g.current, g.pct + '%', 'expected ' + (g.expectedPct ?? '–') + '%']));
    x.byDay.forEach(dd => rows.push(['day', dd.date, '', '', '', dd.minutes, `${dd.habitsDone}/${dd.habitsScheduled}`, 'level ' + dd.level, '']));
    return U.csv(rows);
  }
  // Saves the review form of the open report, if present and changed. Returns true if something was saved.
  function saveReview() {
    const f = document.querySelector('form[data-form="review"]');
    if (!f) return false;
    const fd = new FormData(f);
    const next = { q1: fd.get('q1') || '', q2: fd.get('q2') || '', q3: fd.get('q3') || '' };
    const prev = D().reviews[st.week] || {};
    if (['q1', 'q2', 'q3'].every(k => (prev[k] || '') === next[k])) return false;
    D().reviews[st.week] = { ...next, saved: new Date().toISOString() };
    save();
    return true;
  }
  function backup() {
    D().settings.lastBackup = new Date().toISOString(); save();
    U.download(`tracker-backup-${U.todayKey()}.json`, JSON.stringify(D(), null, 1), 'application/json');
    render();
  }
  function readFile(input, cb) {
    const f = input.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d || !Array.isArray(d.entries) || !Array.isArray(d.habits)) throw new Error('not a tracker backup'); cb(d); } catch (err) { alert('Import failed: ' + err.message); } };
    r.readAsText(f);
  }

  /* ---------- actions (clicks) ---------- */
  const act = {
    preset: el => { Store.replace(el.dataset.p === 'semester' ? Presets.semester() : Presets.blank()); go('day'); },
    dayPrev: () => { st.day = U.dateKey(U.addDays(U.parseKey(st.day), -1)); render(); },
    dayNext: () => { st.day = U.dateKey(U.addDays(U.parseKey(st.day), 1)); render(); },
    dayToday: () => { st.day = U.todayKey(); render(); },
    weekPrev: () => { saveReview(); st.week = U.shiftWeek(st.week, -1); render(); },
    weekNext: () => { saveReview(); st.week = U.shiftWeek(st.week, 1); render(); },
    openWeek: el => { saveReview(); st.week = el.dataset.week; go('report'); },
    stop: () => {
      const r = D().running; if (!r) return;
      const end = new Date().toISOString();
      if (U.minutesBetween(r.start, end) >= 1) D().entries.push({ id: U.uid(), projectId: r.projectId, start: r.start, end, note: r.note || '' });
      D().running = null; save(); render();
    },
    editEntry: el => { st.editEntry = el.dataset.id; render(); },
    delEntry: el => { if (confirm('Delete this time entry?')) { D().entries = D().entries.filter(x => x.id !== el.dataset.id); save(); render(); } },
    cancelEdit: () => { st.editEntry = st.editHabit = st.editTask = null; render(); },
    toggleHabit: el => {
      const k = el.dataset.day, id = el.dataset.id; const log = D().habitLog[k] = D().habitLog[k] || {};
      if (log[id] === true) delete log[id]; else log[id] = true; save(); render();
    },
    editHabit: el => { st.editHabit = el.dataset.id; render(); },
    archiveHabit: el => { const h = D().habits.find(x => x.id === el.dataset.id); h.archived = true; h.archivedOn = U.todayKey(); save(); render(); },
    unarchiveHabit: el => { const h = D().habits.find(x => x.id === el.dataset.id); h.archived = false; delete h.archivedOn; save(); render(); },
    delHabit: el => { if (confirm('Delete this habit and all its history?')) { const id = el.dataset.id; D().habits = D().habits.filter(h => h.id !== id); Object.values(D().habitLog).forEach(l => delete l[id]); save(); render(); } },
    editTask: el => { st.editTask = el.dataset.id; render(); },
    dropTask: el => { const t = D().tasks.find(x => x.id === el.dataset.id); t.status = 'dropped'; t.doneAt = U.todayKey(); save(); render(); },
    delTask: el => { if (confirm('Delete this task?')) { D().tasks = D().tasks.filter(x => x.id !== el.dataset.id); save(); render(); } },
    delGoal: el => { if (confirm('Delete this goal?')) { D().goals = D().goals.filter(x => x.id !== el.dataset.id); save(); render(); } },
    goalInc: el => { const g = D().goals.find(x => x.id === el.dataset.id); g.current = Number(g.current || 0) + Number(el.dataset.n); save(); render(); },
    // Typed-but-unsaved review answers are saved first, so they appear in the PDF and the exports.
    print: () => { saveReview(); render(); window.print(); },
    exportWeekJson: () => { saveReview(); render(); U.download(`week-${st.week}.json`, JSON.stringify(weekExport(st.week), null, 2), 'application/json'); },
    exportWeekCsv: () => { saveReview(); render(); U.download(`week-${st.week}.csv`, weekCsv(st.week), 'text/csv'); },
    exportAllCsv: () => {
      const rows = [['date', 'start', 'end', 'minutes', 'project', 'area', 'note']];
      D().entries.slice().sort((a, b) => a.start.localeCompare(b.start)).forEach(en => rows.push([Calc.entryDay(en), en.start, en.end, Math.round(Calc.entryMin(en)), Calc.projectName(en.projectId), (Calc.areaOf(en.projectId) || {}).name || '', en.note || '']));
      U.download(`time-entries-${U.todayKey()}.csv`, U.csv(rows), 'text/csv');
    },
    backup,
    wipe: () => { if (prompt('Type DELETE to erase all data in this browser. Download a backup first.') === 'DELETE') { Store.wipe(); render(); } },
    clearWeekPlan: () => { delete D().plans[st.week]; save(); render(); },
    toggleArea: el => { const a = D().areas.find(x => x.id === el.dataset.id); a.archived = !a.archived; save(); render(); },
    toggleProj: el => { const p = D().projects.find(x => x.id === el.dataset.id); p.archived = !p.archived; save(); render(); }
  };

  /* ---------- forms ---------- */
  const form = {
    start: f => {
      const fd = new FormData(f);
      D().running = { projectId: fd.get('projectId'), start: new Date().toISOString(), note: fd.get('note').trim() };
      D().lastProject = fd.get('projectId'); save(); render();
    },
    addEntry: f => {
      const fd = new FormData(f); const s = U.atTime(st.day, fd.get('from')); let en = U.atTime(st.day, fd.get('to'));
      if (en <= s) { const x = new Date(en); x.setDate(x.getDate() + 1); en = x.toISOString(); } // crosses midnight
      D().entries.push({ id: U.uid(), projectId: fd.get('projectId'), start: s, end: en, note: fd.get('note').trim() });
      D().lastProject = fd.get('projectId'); save(); render();
    },
    saveEntry: f => {
      const fd = new FormData(f); const en = D().entries.find(x => x.id === f.dataset.id); const k = Calc.entryDay(en);
      en.projectId = fd.get('projectId'); en.start = U.atTime(k, fd.get('from')); en.end = U.atTime(k, fd.get('to'));
      if (en.end <= en.start) { const x = new Date(en.end); x.setDate(x.getDate() + 1); en.end = x.toISOString(); }
      en.note = fd.get('note').trim(); st.editEntry = null; save(); render();
    },
    addTask: f => {
      const fd = new FormData(f);
      D().tasks.push({ id: U.uid(), title: fd.get('title').trim(), projectId: fd.get('projectId') || null, due: fd.get('due') || null,
        plannedMin: fd.get('plannedMin') ? Number(fd.get('plannedMin')) : null, milestone: fd.get('milestone') === 'on', goalId: f.dataset.goal || null,
        status: 'todo', created: U.todayKey(), doneAt: null });
      save(); render();
    },
    saveTask: f => {
      const fd = new FormData(f); const t = D().tasks.find(x => x.id === f.dataset.id);
      Object.assign(t, { title: fd.get('title').trim(), projectId: fd.get('projectId') || null, due: fd.get('due') || null,
        plannedMin: fd.get('plannedMin') ? Number(fd.get('plannedMin')) : null, milestone: fd.get('milestone') === 'on' });
      st.editTask = null; save(); render();
    },
    saveHabit: f => {
      const fd = new FormData(f);
      const days = [0, 1, 2, 3, 4, 5, 6].filter(i => fd.get('d' + i) === 'on');
      if (!days.length) { alert('Pick at least one day.'); return; }
      const target = fd.get('target') === '' ? null : Number(fd.get('target'));
      if (f.dataset.id) {
        const h = D().habits.find(x => x.id === f.dataset.id);
        Object.assign(h, { name: fd.get('name').trim(), days, direction: fd.get('direction'), target, unit: fd.get('unit').trim() });
      } else {
        D().habits.push({ id: U.uid(), name: fd.get('name').trim(), type: fd.get('type'), days, direction: fd.get('direction'), target, unit: fd.get('unit').trim(), start: U.todayKey(), archived: false });
      }
      st.editHabit = null; save(); render();
    },
    addGoal: f => {
      const fd = new FormData(f); let type = fd.get('type');
      const g = { id: U.uid(), title: fd.get('title').trim(), type, target: Number(fd.get('target')), start: fd.get('start') || U.todayKey(), deadline: fd.get('deadline') || null };
      if (type === 'time' || type === 'timeArea') {
        g.type = 'time';
        if (type === 'timeArea') { if (!fd.get('areaId')) return alert('Pick an area.'); g.areaId = fd.get('areaId'); }
        else { if (!fd.get('projectId')) return alert('Pick a project.'); g.projectId = fd.get('projectId'); }
      }
      if (type === 'habit') { if (!fd.get('habitId')) return alert('Pick a habit.'); g.habitId = fd.get('habitId'); }
      if (type === 'manual') { g.current = 0; g.unit = fd.get('unit').trim(); }
      D().goals.push(g); save(); render();
    },
    review: () => { saveReview(); render(); },
    plan: (f, submitter) => {
      const fd = new FormData(f); const p = {};
      D().projects.filter(x => !x.archived).forEach(x => { const v = Number(fd.get('p_' + x.id) || 0); if (v > 0) p[x.id] = Math.round(v * 60); });
      if (submitter && submitter.value === 'default') D().settings.defaultPlan = p; else D().plans[st.week] = p;
      save(); render();
    },
    target: f => { D().settings.dailyTargetMin = Math.max(15, Number(new FormData(f).get('min')) || 180); save(); render(); },
    addArea: f => { const fd = new FormData(f); D().areas.push({ id: U.uid(), name: fd.get('name').trim(), color: fd.get('color') }); save(); render(); },
    addProject: f => { const a = D().areas.find(x => x.id === f.dataset.area); D().projects.push({ id: U.uid(), name: new FormData(f).get('name').trim(), areaId: a.id, color: a.color }); save(); render(); }
  };

  /* ---------- inputs ---------- */
  const change = {
    habit: el => { const k = st.day, l = D().habitLog[k] = D().habitLog[k] || {}; if (el.checked) l[el.dataset.id] = true; else delete l[el.dataset.id]; save(); render(); },
    habitNum: el => { const k = st.day, l = D().habitLog[k] = D().habitLog[k] || {}; if (el.value === '') delete l[el.dataset.id]; else l[el.dataset.id] = Number(el.value); save(); render(); },
    task: el => { const t = D().tasks.find(x => x.id === el.dataset.id); t.status = el.checked ? 'done' : 'todo'; t.doneAt = el.checked ? U.todayKey() : null; save(); render(); },
    areaColor: el => { const a = D().areas.find(x => x.id === el.dataset.id); a.color = el.value; save(); },
    areaName: el => { const a = D().areas.find(x => x.id === el.dataset.id); if (el.value.trim()) a.name = el.value.trim(); save(); },
    projColor: el => { const p = D().projects.find(x => x.id === el.dataset.id); p.color = el.value; save(); },
    projName: el => { const p = D().projects.find(x => x.id === el.dataset.id); if (el.value.trim()) p.name = el.value.trim(); save(); },
    import: el => readFile(el, d => {
      const mode = ($('#importMode') || {}).value || 'merge';
      if (mode === 'replace' && !confirm('Replace ALL current data with this backup?')) return;
      mode === 'replace' ? Store.replace(d) : Store.merge(d); alert('Import complete.'); render();
    }),
    importFirst: el => readFile(el, d => { Store.replace(d); go('day'); })
  };

  /* ---------- wiring ---------- */
  document.addEventListener('click', ev => {
    const nav = ev.target.closest('[data-view]'); if (nav) { go(nav.dataset.view); return; }
    const el = ev.target.closest('[data-act]'); if (el && act[el.dataset.act]) { ev.preventDefault(); act[el.dataset.act](el); }
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.closest('[data-form]'); if (!f || !form[f.dataset.form]) return;
    ev.preventDefault(); form[f.dataset.form](f, ev.submitter);
  });
  document.addEventListener('change', ev => { const el = ev.target.closest('[data-change]'); if (el && change[el.dataset.change]) change[el.dataset.change](el); });
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (Views.views[v] && v !== st.view) { st.view = v; render(); } });
  window.addEventListener('storage', ev => { if (ev.key === Store.KEY) { Store.load(); render(); } }); // other tab changed data
  document.addEventListener('visibilitychange', () => { if (!document.hidden && st.view === 'day') render(); });

  Store.load();
  const v = location.hash.slice(1); if (Views.views[v]) st.view = v;
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__app = { weekExport, weekCsv }; // handy for debugging in the console
})();
