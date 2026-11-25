'use strict';
/* All screens. Each view returns HTML; actions are wired through data-act / data-form attributes. */
const Views = (() => {
  const e = U.esc;
  const D = () => Store.get();
  const st = { view: 'day', day: U.todayKey(), week: U.isoWeek(new Date()), editEntry: null, editHabit: null, editTask: null };

  /* ---------- shared bits ---------- */
  function projectOptions(selected, { blank = false } = {}) {
    let out = blank ? '<option value="">— none —</option>' : '';
    for (const a of D().areas.filter(a => !a.archived)) {
      const ps = D().projects.filter(p => p.areaId === a.id && !p.archived);
      if (!ps.length) continue;
      out += `<optgroup label="${e(a.name)}">` + ps.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${e(p.name)}</option>`).join('') + '</optgroup>';
    }
    return out;
  }
  const chip = pid => `<span class="chip" style="--c:${e(Calc.projectColor(pid))}">${e(Calc.projectName(pid))}</span>`;
  const kpi = (label, value, sub = '') => `<div class="kpi"><div class="kpi-v">${value}</div><div class="kpi-l">${e(label)}</div>${sub ? `<div class="kpi-s">${sub}</div>` : ''}</div>`;
  const dayTitle = k => `${U.fmtDate(k)}: ${U.fmtMin(Calc.minutesOn(k))} tracked, ${Calc.dayHabits(k).done}/${Calc.dayHabits(k).scheduled} habits`;
  const weekLabel = wk => `${wk} · ${U.fmtDate(U.weekDays(wk)[0])} – ${U.fmtDate(U.weekDays(wk)[6])}`;
  const delta = (cur, prev, unit = '', digits = 0) => {
    if (cur == null || prev == null) return '';
    const d = +(cur - prev).toFixed(digits);
    return `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${U.signed(d, unit)}</span>`;
  };

  /* ================= DAY ================= */
  function day() {
    const k = st.day, today = U.todayKey(), isToday = k === today;
    const entries = Calc.entriesOn(k);
    const total = Calc.minutesOn(k);
    const r = D().running;
    let timer;
    if (!D().projects.some(p => !p.archived)) timer = '<p class="muted">Add a project in Settings first.</p>';
    else if (r) {
      timer = `<div class="running"><div>${chip(r.projectId)} <span class="muted">${e(r.note || '')}</span></div>
        <div class="elapsed" id="elapsed">${U.fmtMin(U.minutesBetween(r.start, new Date()))}</div>
        <div class="muted small">since ${U.hhmm(r.start)}</div>
        <button class="btn danger" data-act="stop">Stop</button></div>`;
    } else {
      timer = `<form data-form="start" class="row">
        <select name="projectId" required>${projectOptions(D().lastProject)}</select>
        <input name="note" placeholder="What exactly? (output target)" maxlength="200">
        <button class="btn primary">Start</button></form>`;
    }
    const habits = D().habits.filter(h => Calc.habitScheduled(h, k));
    const hd = Calc.dayHabits(k);
    const habitRows = habits.map(h => {
      const v = Calc.habitValue(h, k);
      if (h.type === 'check') return `<label class="habit ${v === true ? 'on' : ''}"><input type="checkbox" data-change="habit" data-id="${h.id}" ${v === true ? 'checked' : ''}> <span>${e(h.name)}</span></label>`;
      const tgt = h.target != null && h.target !== '' ? `<span class="muted small">${h.direction === 'max' ? '≤' : '≥'} ${e(h.target)} ${e(h.unit || '')}</span>` : '<span class="muted small">tracked</span>';
      return `<label class="habit num ${Calc.habitDone(h, k) ? 'on' : ''}"><span>${e(h.name)}</span><input type="number" step="any" inputmode="decimal" value="${v ?? ''}" data-change="habitNum" data-id="${h.id}"> <span class="muted small">${e(h.unit || '')}</span> ${tgt}</label>`;
    }).join('') || '<p class="muted">No habits scheduled. Add them under Habits.</p>';

    const rows = entries.map(en => {
      if (st.editEntry === en.id) return `<tr><td colspan="5"><form data-form="saveEntry" data-id="${en.id}" class="row">
        <select name="projectId">${projectOptions(en.projectId)}</select>
        <input type="time" name="from" value="${U.hhmm(en.start)}" required><input type="time" name="to" value="${U.hhmm(en.end)}" required>
        <input name="note" value="${e(en.note || '')}" placeholder="Note"><button class="btn primary">Save</button>
        <button type="button" class="btn" data-act="cancelEdit">Cancel</button></form></td></tr>`;
      return `<tr><td class="nowrap">${U.hhmm(en.start)}–${U.hhmm(en.end)}</td><td>${chip(en.projectId)}</td><td class="num">${U.fmtMin(Calc.entryMin(en))}</td>
        <td>${e(en.note || '')}</td><td class="actions"><button class="link" data-act="editEntry" data-id="${en.id}">Edit</button><button class="link danger" data-act="delEntry" data-id="${en.id}">Delete</button></td></tr>`;
    }).join('');

    const tasks = D().tasks.filter(t => t.status === 'todo' && (t.due ? t.due <= k : isToday))
      .sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    const taskRows = tasks.map(t => taskLine(t, k)).join('') || '<p class="muted">Nothing due.</p>';

    return `<div class="toolbar"><button class="btn" data-act="dayPrev" aria-label="Previous day">‹</button>
      <h2>${e(U.fmtDateLong(k))}</h2><button class="btn" data-act="dayNext" aria-label="Next day">›</button>
      ${isToday ? '' : '<button class="btn" data-act="dayToday">Today</button>'}
      <span class="spacer"></span><span class="pill">Tracked ${U.fmtMin(total)}</span><span class="pill">Habits ${hd.done}/${hd.scheduled}</span></div>
    <div class="grid2">
      <section class="card"><h3>Timer</h3>${isToday ? timer : '<p class="muted">The live timer is for today. Use manual entry for other days.</p>'}
        <h4>Add time manually</h4>
        <form data-form="addEntry" class="row"><select name="projectId" required>${projectOptions(D().lastProject)}</select>
          <input type="time" name="from" required aria-label="From"><input type="time" name="to" required aria-label="To">
          <input name="note" placeholder="Note" maxlength="200"><button class="btn">Add</button></form></section>
      <section class="card"><h3>Habits <span class="muted small">${hd.done}/${hd.scheduled}</span></h3><div class="habits">${habitRows}</div></section>
    </div>
    <section class="card scroll"><h3>Time log</h3>${rows ? `<table class="tbl"><thead><tr><th>Time</th><th>Project</th><th class="num">Duration</th><th>Note</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">No time logged.</p>'}</section>
    <section class="card"><h3>Tasks due</h3>${taskRows}
      <form data-form="addTask" class="row top-gap"><input name="title" placeholder="New task" required maxlength="200">
      <select name="projectId">${projectOptions(null, { blank: true })}</select><input type="date" name="due" value="${k}">
      <button class="btn">Add task</button></form></section>`;
  }

  function taskLine(t, refKey = U.todayKey()) {
    const s = Calc.taskState(t, refKey);
    if (st.editTask === t.id) return `<form data-form="saveTask" data-id="${t.id}" class="row task-edit">
      <input name="title" value="${e(t.title)}" required><select name="projectId">${projectOptions(t.projectId, { blank: true })}</select>
      <input type="date" name="due" value="${t.due || ''}"><input type="number" name="plannedMin" min="0" placeholder="Planned min" value="${t.plannedMin ?? ''}">
      <label class="small"><input type="checkbox" name="milestone" ${t.milestone ? 'checked' : ''}> milestone</label>
      <button class="btn primary">Save</button><button type="button" class="btn" data-act="cancelEdit">Cancel</button></form>`;
    return `<div class="task ${s}"><input type="checkbox" data-change="task" data-id="${t.id}" ${t.status === 'done' ? 'checked' : ''} aria-label="Done">
      <span class="t-title">${t.milestone ? '◆ ' : ''}${e(t.title)}</span>
      ${t.projectId ? chip(t.projectId) : ''}${t.due ? `<span class="muted small">${U.fmtDate(t.due)}</span>` : ''}
      ${t.plannedMin ? `<span class="muted small">${U.fmtMin(t.plannedMin)}</span>` : ''}
      ${s === 'missed' ? '<span class="badge bad">missed</span>' : ''}${s === 'dropped' ? '<span class="badge">dropped</span>' : ''}
      <span class="spacer"></span><button class="link" data-act="editTask" data-id="${t.id}">Edit</button>
      ${t.status === 'todo' ? `<button class="link" data-act="dropTask" data-id="${t.id}">Drop</button>` : ''}
      <button class="link danger" data-act="delTask" data-id="${t.id}">Delete</button></div>`;
  }

  /* ================= HABITS ================= */
  function habits() {
    const today = U.todayKey();
    const days = []; for (let i = 13; i >= 0; i--) days.push(U.dateKey(U.addDays(new Date(), -i)));
    const active = D().habits.filter(h => !h.archived);
    const head = days.map(k => `<th class="c" title="${k}">${U.parseKey(k).toLocaleDateString(undefined, { weekday: 'narrow' })}<br><span class="small">${U.parseKey(k).getDate()}</span></th>`).join('');
    const body = active.map(h => {
      if (st.editHabit === h.id) return `<tr><td colspan="${days.length + 4}">${habitForm(h)}</td></tr>`;
      const cells = days.map(k => {
        if (!Calc.habitScheduled(h, k)) return '<td class="c off">·</td>';
        const v = Calc.habitValue(h, k);
        if (h.type === 'check') return `<td class="c"><button class="tick ${v === true ? 'on' : ''}" data-act="toggleHabit" data-id="${h.id}" data-day="${k}" aria-label="${e(h.name)} ${k}">${v === true ? '✓' : ''}</button></td>`;
        return `<td class="c small ${Calc.habitDone(h, k) ? 'ok' : ''}">${v ?? ''}</td>`;
      }).join('');
      const r7 = Calc.habitRate(h, U.dateKey(U.addDays(new Date(), -6)), today), r30 = Calc.habitRate(h, U.dateKey(U.addDays(new Date(), -29)), today);
      const tracked = h.type === 'number' && !Calc.counts(h);
      return `<tr><td class="hname">${e(h.name)}${h.type === 'number' ? ` <span class="muted small">(${e(h.unit || 'number')}${h.target != null && h.target !== '' ? `, ${h.direction === 'max' ? '≤' : '≥'}${e(h.target)}` : ''})</span>` : ''}
        <div class="small"><button class="link" data-act="editHabit" data-id="${h.id}">Edit</button><button class="link" data-act="archiveHabit" data-id="${h.id}">Archive</button></div></td>${cells}
        <td class="num">${tracked ? '–' : Calc.streak(h)}</td><td class="num">${tracked ? '–' : U.fmtPct(r7.rate)}</td><td class="num">${tracked ? '–' : U.fmtPct(r30.rate)}</td></tr>`;
    }).join('');
    const archived = D().habits.filter(h => h.archived);
    return `<div class="toolbar"><h2>Habits</h2><span class="spacer"></span><span class="muted small">Click a cell to tick a past day. Number habits are entered on the Day page.</span></div>
    <section class="card scroll"><table class="tbl habits-grid"><thead><tr><th>Habit</th>${head}<th class="num">Streak</th><th class="num">7 d</th><th class="num">30 d</th></tr></thead><tbody>${body || `<tr><td colspan="${days.length + 4}" class="muted">No habits yet.</td></tr>`}</tbody></table></section>
    <section class="card"><h3>New habit</h3>${habitForm(null)}</section>
    ${archived.length ? `<section class="card"><h3>Archived</h3>${archived.map(h => `<div class="row">${e(h.name)} <span class="spacer"></span><button class="link" data-act="unarchiveHabit" data-id="${h.id}">Restore</button><button class="link danger" data-act="delHabit" data-id="${h.id}">Delete forever</button></div>`).join('')}</section>` : ''}`;
  }
  function habitForm(h) {
    const days = h ? h.days : [0, 1, 2, 3, 4, 5, 6];
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const order = [1, 2, 3, 4, 5, 6, 0];
    return `<form data-form="saveHabit" ${h ? `data-id="${h.id}"` : ''} class="stack">
      <div class="row"><input name="name" placeholder="Habit (be specific and measurable)" value="${e(h ? h.name : '')}" required maxlength="120">
      <select name="type" ${h ? 'disabled' : ''}><option value="check" ${h && h.type === 'check' ? 'selected' : ''}>Yes / no</option><option value="number" ${h && h.type === 'number' ? 'selected' : ''}>Number</option></select></div>
      <div class="row small">Days: ${order.map(i => `<label><input type="checkbox" name="d${i}" ${days.includes(i) ? 'checked' : ''}> ${names[i]}</label>`).join(' ')}</div>
      <div class="row small">For numbers: <select name="direction"><option value="max" ${h && h.direction === 'max' ? 'selected' : ''}>at most</option><option value="min" ${h && h.direction === 'min' ? 'selected' : ''}>at least</option></select>
      <input type="number" step="any" name="target" placeholder="Target" title="Leave empty to just track the number" value="${h && h.target != null ? e(h.target) : ''}">
      <input name="unit" placeholder="Unit (min, €, pages…)" value="${e(h ? h.unit || '' : '')}" maxlength="12"></div>
      <div class="row"><button class="btn primary">${h ? 'Save' : 'Add habit'}</button>${h ? '<button type="button" class="btn" data-act="cancelEdit">Cancel</button>' : ''}</div></form>`;
  }

  /* ================= TASKS ================= */
  function tasks() {
    const today = U.todayKey();
    const all = D().tasks.slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const g = { missed: [], today: [], week: [], later: [], nodate: [], done: [] };
    const weekEnd = U.dateKey(U.addDays(new Date(), 7));
    for (const t of all) {
      const s = Calc.taskState(t);
      if (s === 'done' || s === 'dropped') g.done.push(t);
      else if (s === 'missed') g.missed.push(t);
      else if (!t.due) g.nodate.push(t);
      else if (t.due === today) g.today.push(t);
      else if (t.due <= weekEnd) g.week.push(t);
      else g.later.push(t);
    }
    g.done.sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const sec = (title, list, cls = '') => list.length ? `<section class="card ${cls}"><h3>${title} <span class="muted small">${list.length}</span></h3>${list.map(t => taskLine(t)).join('')}</section>` : '';
    return `<div class="toolbar"><h2>Tasks & milestones</h2></div>
    <section class="card"><form data-form="addTask" class="row"><input name="title" placeholder="Task or milestone" required maxlength="200">
      <select name="projectId">${projectOptions(null, { blank: true })}</select><input type="date" name="due">
      <input type="number" name="plannedMin" min="0" placeholder="Planned min"><label class="small"><input type="checkbox" name="milestone"> milestone</label>
      <button class="btn primary">Add</button></form></section>
    ${sec('Missed (overdue)', g.missed, 'warn')}${sec('Today', g.today)}${sec('Next 7 days', g.week)}${sec('Later', g.later)}${sec('No date', g.nodate)}${sec('Done & dropped', g.done.slice(0, 40))}`;
  }

  /* ================= GOALS ================= */
  function goals() {
    const list = D().goals.map(g => {
      const p = Calc.goalProgress(g), pace = Calc.goalPace(g);
      const behind = pace != null && p.pct < pace - 10;
      const scope = g.type === 'time' ? (g.projectId ? Calc.projectName(g.projectId) : (Calc.area(g.areaId) || {}).name || '') : g.type === 'habit' ? ((D().habits.find(h => h.id === g.habitId) || {}).name || '') : '';
      return `<div class="goal"><div class="row"><strong>${e(g.title)}</strong><span class="muted small">${e(scope)}</span><span class="spacer"></span>
        ${g.deadline ? `<span class="muted small">by ${U.fmtDate(g.deadline)}</span>` : ''}</div>
        ${Charts.bar(p.pct, behind ? 'var(--bad)' : null)}
        <div class="row small"><span>${p.unit === 'h' ? p.current.toFixed(1) : p.current} / ${e(p.target)} ${e(p.unit)} · ${p.pct}%</span>
        ${pace != null ? `<span class="muted">expected by now: ${pace}%</span>` : ''}${behind ? '<span class="badge bad">behind pace</span>' : ''}<span class="spacer"></span>
        ${g.type === 'manual' ? `<button class="link" data-act="goalInc" data-id="${g.id}" data-n="-1">−1</button><button class="link" data-act="goalInc" data-id="${g.id}" data-n="1">+1</button>` : ''}
        <button class="link danger" data-act="delGoal" data-id="${g.id}">Delete</button></div></div>`;
    }).join('') || '<p class="muted">No goals yet.</p>';
    const habitOpts = D().habits.filter(h => !h.archived && Calc.counts(h)).map(h => `<option value="${h.id}">${e(h.name)}</option>`).join('');
    const areaOpts = D().areas.filter(a => !a.archived).map(a => `<option value="${a.id}">${e(a.name)}</option>`).join('');
    return `<div class="toolbar"><h2>Goals</h2></div><section class="card">${list}</section>
    <section class="card"><h3>New goal</h3><form data-form="addGoal" class="stack">
      <div class="row"><input name="title" placeholder="Goal" required maxlength="120">
      <select name="type"><option value="time">Hours in a project</option><option value="timeArea">Hours in an area</option><option value="habit">Habit completion %</option><option value="tasks">Tasks linked to it</option><option value="manual">Manual counter</option></select></div>
      <div class="row small">Project <select name="projectId">${projectOptions(null, { blank: true })}</select> Area <select name="areaId"><option value="">—</option>${areaOpts}</select>
      Habit <select name="habitId"><option value="">—</option>${habitOpts}</select></div>
      <div class="row small">Target <input type="number" step="any" name="target" required> <input name="unit" placeholder="Unit (manual only)" maxlength="12">
      Start <input type="date" name="start" value="${U.todayKey()}"> Deadline <input type="date" name="deadline"></div>
      <div class="row"><button class="btn primary">Add goal</button></div></form>
      <p class="muted small">For a "tasks" goal, add its tasks in the box that appears below once the goal exists.</p></section>
    ${D().goals.filter(g => g.type === 'tasks').map(g => `<section class="card"><h3>Tasks for: ${e(g.title)}</h3>${D().tasks.filter(t => t.goalId === g.id).map(t => taskLine(t)).join('') || '<p class="muted">None yet.</p>'}
      <form data-form="addTask" data-goal="${g.id}" class="row top-gap"><input name="title" placeholder="New task for this goal" required><input type="date" name="due"><button class="btn">Add</button></form></section>`).join('')}`;
  }

  /* ================= DASHBOARD ================= */
  function dashboard() {
    const wk = U.isoWeek(new Date()), w = Calc.week(wk), pw = Calc.week(U.shiftWeek(wk, -1));
    const today = U.todayKey();
    const from = U.dateKey(U.addDays(new Date(), -364));
    let activeStreak = 0;
    for (let i = 0; i < 400; i++) { const k = U.dateKey(U.addDays(new Date(), -i)); if (Calc.dayLevel(k) > 0) activeStreak++; else if (i > 0) break; }
    const last30 = []; for (let i = 29; i >= 0; i--) { const k = U.dateKey(U.addDays(new Date(), -i)); last30.push({ label: U.fmtDate(k), short: String(U.parseKey(k).getDate()), value: Math.round(Calc.minutesOn(k)) }); }
    const fw = Calc.firstWeek();
    const weeks = []; for (let i = 11; i >= 0; i--) { const k2 = U.shiftWeek(wk, -i); if (k2 >= fw) weeks.push(Calc.week(k2)); }
    const habitRows = D().habits.filter(h => !h.archived && Calc.counts(h)).map(h => ({ label: h.name.split('·')[0].split(':')[0].trim().slice(0, 24), value: Calc.habitRate(h, U.dateKey(U.addDays(new Date(), -29)), today).rate || 0, color: 'var(--good)' }));
    return `<div class="toolbar"><h2>Dashboard</h2><span class="spacer"></span><span class="muted small">${e(weekLabel(wk))}</span></div>
    <div class="kpis">
      ${kpi('Tracked this week', U.fmtH(w.trackedMin), `plan ${U.fmtH(w.plannedMin)} ${delta(+(w.trackedMin / 60).toFixed(1), +(pw.trackedMin / 60).toFixed(1), ' h', 1)}`)}
      ${kpi('Plan met', U.fmtPct(w.planHitPct), 'actual vs planned, capped per project')}
      ${kpi('Habits this week', U.fmtPct(w.habitRate), `${w.habitsDone}/${w.habitsScheduled} ${delta(w.habitRate, pw.habitRate, ' pp')}`)}
      ${kpi('Good days (6+/7)', `${w.goodDays}/7`)}
      ${kpi('Tasks', `${w.tasks.done.length} done`, `${w.tasks.missed.length} missed · ${w.tasks.pending.length} pending`)}
      ${kpi('Active-day streak', activeStreak + ' d')}
    </div>
    <section class="card scroll"><h3>Contribution calendar <span class="muted small">last 12 months · habits + tracked time</span></h3>
      ${Charts.heatmap(from, today, Calc.dayLevel, dayTitle)}
      <div class="legend small muted">Less <i class="lvl-0"></i><i class="lvl-1"></i><i class="lvl-2"></i><i class="lvl-3"></i><i class="lvl-4"></i> More</div></section>
    <div class="grid2">
      <section class="card"><h3>This week: planned vs actual</h3>${Charts.hbars(w.projects.map(p => ({ label: p.name, value: p.actualMin, plan: p.plannedMin, color: p.color })), { fmt: (v, r) => `${U.fmtH(v)}${r.plan ? ' / ' + U.fmtH(r.plan) : ''}`, planned: true })}
        <p class="muted small">Bar = actual · line = plan</p></section>
      <section class="card"><h3>Habit adherence, last 30 days</h3>${Charts.hbars(habitRows, { fmt: v => v + '%', max: 100 })}</section>
    </div>
    <section class="card scroll"><h3>Tracked time, last 30 days</h3>${Charts.columns(last30, { fmt: v => U.fmtMin(v), target: D().settings.dailyTargetMin })}</section>
    <div class="grid2">
      <section class="card"><h3>Hours per week</h3>${Charts.line(weeks.map(x => ({ label: x.week, short: x.week.slice(5), value: +(x.trackedMin / 60).toFixed(1) })), { fmt: v => v + ' h' })}</section>
      <section class="card"><h3>Habit rate per week</h3>${Charts.line(weeks.map(x => ({ label: x.week, short: x.week.slice(5), value: x.habitRate })), { fmt: v => v + '%', max: 100 })}</section>
    </div>
    <section class="card"><h3>Goals</h3>${D().goals.map(g => { const p = Calc.goalProgress(g); const pace = Calc.goalPace(g); return `<div class="goal compact"><div class="row small"><strong>${e(g.title)}</strong><span class="spacer"></span>${p.pct}%${pace != null ? ` <span class="muted">(pace ${pace}%)</span>` : ''}</div>${Charts.bar(p.pct, pace != null && p.pct < pace - 10 ? 'var(--bad)' : null)}</div>`; }).join('') || '<p class="muted">No goals.</p>'}</section>`;
  }

  /* ================= WEEKLY REPORT ================= */
  function report() {
    const wk = st.week, w = Calc.week(wk), pwk = U.shiftWeek(wk, -1), pw = Calc.week(pwk);
    const rv = D().reviews[wk] || {};
    const prevById = Object.fromEntries(pw.projects.map(p => [p.id, p]));
    const projRows = w.projects.map(p => `<tr><td>${chip(p.id)}</td><td class="muted small">${e(p.area)}</td><td class="num">${U.fmtH(p.plannedMin)}</td><td class="num">${U.fmtH(p.actualMin)}</td>
      <td class="num">${p.plannedMin ? U.fmtPct(U.pct(p.actualMin, p.plannedMin)) : '–'}</td><td class="num">${delta(+(p.actualMin / 60).toFixed(1), +((prevById[p.id] || { actualMin: 0 }).actualMin / 60).toFixed(1), ' h', 1)}</td></tr>`).join('');
    const habitRows = w.habits.map(h => `<tr><td>${e(h.name)}</td>${w.days.map(k => {
      const v = h.values[k];
      if (h.type === 'check') return `<td class="c">${v === true ? '✓' : (k <= U.todayKey() && Calc.habitScheduled(D().habits.find(x => x.id === h.id), k) ? '<span class="miss">✗</span>' : '')}</td>`;
      return `<td class="c small">${v ?? ''}</td>`;
    }).join('')}<td class="num">${h.type === 'number' && h.target == null ? (h.average != null ? 'Ø ' + h.average : '–') : U.fmtPct(h.rate)}</td>
      <td class="num">${h.type === 'number' && h.target == null ? '' : delta(h.rate, (pw.habits.find(x => x.id === h.id) || {}).rate, ' pp')}</td></tr>`).join('');
    const tl = list => list.map(t => `<li>${t.milestone ? '◆ ' : ''}${e(t.title)}${t.projectId ? ' · ' + e(Calc.projectName(t.projectId)) : ''}${t.due ? ` <span class="muted">(${U.fmtDate(t.due)})</span>` : ''}</li>`).join('') || '<li class="muted">none</li>';
    const dayPts = w.byDay.map(d => ({ label: U.fmtDate(d.date), short: U.parseKey(d.date).toLocaleDateString(undefined, { weekday: 'short' }), value: d.minutes }));
    const areaMin = {}; w.projects.forEach(p => { areaMin[p.area || '—'] = (areaMin[p.area || '—'] || 0) + p.actualMin; });
    const areaColor = n => (D().areas.find(a => a.name === n) || { color: 'var(--accent)' }).color;
    const heatFrom = U.weekDays(U.shiftWeek(wk, -11))[0];
    const goalRows = D().goals.map(g => { const p = Calc.goalProgress(g), pace = Calc.goalPace(g); return `<tr><td>${e(g.title)}</td><td class="num">${p.unit === 'h' ? p.current.toFixed(1) : p.current} / ${e(p.target)} ${e(p.unit)}</td><td style="min-width:120px">${Charts.bar(p.pct, pace != null && p.pct < pace - 10 ? 'var(--bad)' : null)}</td><td class="num">${p.pct}%</td><td class="num muted">${pace != null ? pace + '%' : '–'}</td></tr>`; }).join('');
    return `<div class="toolbar no-print"><button class="btn" data-act="weekPrev">‹</button><h2>Weekly report</h2><button class="btn" data-act="weekNext">›</button>
      <span class="spacer"></span><button class="btn primary" data-act="print">Save as PDF</button><button class="btn" data-act="exportWeekJson">Export JSON</button><button class="btn" data-act="exportWeekCsv">Export CSV</button></div>
    <article class="report">
      <header class="rep-head"><h1>Weekly report · ${e(wk)}</h1><p>${e(U.fmtDateLong(w.from))} – ${e(U.fmtDateLong(w.to))} · compared with ${e(pwk)} · generated ${e(new Date().toLocaleString())}</p></header>
      <div class="kpis">
        ${kpi('Tracked', U.fmtH(w.trackedMin), delta(+(w.trackedMin / 60).toFixed(1), +(pw.trackedMin / 60).toFixed(1), ' h', 1))}
        ${kpi('Planned', U.fmtH(w.plannedMin), `plan met ${U.fmtPct(w.planHitPct)}`)}
        ${kpi('Habit completion', U.fmtPct(w.habitRate), delta(w.habitRate, pw.habitRate, ' pp'))}
        ${kpi('Good days', `${w.goodDays}/7`, delta(w.goodDays, pw.goodDays))}
        ${kpi('Tasks done', String(w.tasks.done.length), `${w.tasks.missed.length} missed · ${w.tasks.pending.length} pending`)}
        ${kpi('Active days', `${w.activeDays}/7`, delta(w.activeDays, pw.activeDays))}
      </div>
      <section><h2>Time: planned vs actual</h2>
        <table class="tbl"><thead><tr><th>Project</th><th>Area</th><th class="num">Planned</th><th class="num">Actual</th><th class="num">% of plan</th><th class="num">vs last week</th></tr></thead>
        <tbody>${projRows || '<tr><td colspan="6" class="muted">No time tracked.</td></tr>'}</tbody>
        <tfoot><tr><th>Total</th><th></th><th class="num">${U.fmtH(w.plannedMin)}</th><th class="num">${U.fmtH(w.trackedMin)}</th><th class="num">${U.fmtPct(U.pct(w.trackedMin, w.plannedMin))}</th><th class="num">${delta(+(w.trackedMin / 60).toFixed(1), +(pw.trackedMin / 60).toFixed(1), ' h', 1)}</th></tr></tfoot></table>
        <div class="grid2"><div>${Charts.hbars(w.projects.map(p => ({ label: p.name, value: p.actualMin, plan: p.plannedMin, color: p.color })), { fmt: v => U.fmtH(v), planned: true })}</div>
        <div>${Charts.hbars(Object.entries(areaMin).map(([n, v]) => ({ label: n, value: v, color: areaColor(n) })), { fmt: v => U.fmtH(v) })}</div></div>
        <h3>Time per day</h3>${Charts.columns(dayPts, { fmt: v => U.fmtMin(v), target: D().settings.dailyTargetMin, height: 110 })}</section>
      <section class="page-break"><h2>Habits & consistency</h2>
        <table class="tbl"><thead><tr><th>Habit</th>${w.days.map(k => `<th class="c">${U.parseKey(k).toLocaleDateString(undefined, { weekday: 'short' })}</th>`).join('')}<th class="num">Rate</th><th class="num">vs last</th></tr></thead><tbody>${habitRows}</tbody></table>
        <h3>Last 12 weeks</h3>${Charts.heatmap(heatFrom, w.to < U.todayKey() ? w.to : U.todayKey(), Calc.dayLevel, dayTitle)}</section>
      <section><h2>Tasks</h2><div class="grid3"><div><h3>Completed (${w.tasks.done.length})</h3><ul>${tl(w.tasks.done)}</ul></div>
        <div><h3>Missed (${w.tasks.missed.length})</h3><ul>${tl(w.tasks.missed)}</ul></div><div><h3>Pending (${w.tasks.pending.length})</h3><ul>${tl(w.tasks.pending)}</ul></div></div></section>
      <section><h2>Goals</h2><table class="tbl"><thead><tr><th>Goal</th><th class="num">Progress</th><th></th><th class="num">%</th><th class="num">Pace</th></tr></thead><tbody>${goalRows || '<tr><td class="muted" colspan="5">No goals.</td></tr>'}</tbody></table></section>
      <section><h2>Review</h2>
        <form data-form="review" class="stack review">
          <label>1. Which box broke most, and what happened in the 2 hours before?<textarea name="q1" rows="2">${e(rv.q1 || '')}</textarea></label>
          <label>2. Which day did I keep going without wanting to?<textarea name="q2" rows="2">${e(rv.q2 || '')}</textarea></label>
          <label>3. One change for next week (only one)<textarea name="q3" rows="2">${e(rv.q3 || '')}</textarea></label>
          <button class="btn no-print">Save review</button></form>
        <div class="print-only">${['q1', 'q2', 'q3'].map((q, i) => `<p><strong>${i + 1}.</strong> ${e(rv[q] || '—')}</p>`).join('')}</div></section>
    </article>`;
  }

  /* ================= HISTORY ================= */
  function history() {
    const cur = U.isoWeek(new Date()); const first = Calc.firstWeek();
    const rows = []; let wk = cur, guard = 0;
    while (wk >= first && guard++ < 520) { rows.push(Calc.week(wk)); wk = U.shiftWeek(wk, -1); }
    const tr = rows.map(w => `<tr><td><button class="link" data-act="openWeek" data-week="${w.week}">${w.week}</button></td><td class="muted small">${U.fmtDate(w.from)} – ${U.fmtDate(w.to)}</td>
      <td class="num">${U.fmtH(w.trackedMin)}</td><td class="num">${U.fmtPct(w.planHitPct)}</td><td class="num">${U.fmtPct(w.habitRate)}</td><td class="num">${w.goodDays}</td>
      <td class="num">${w.tasks.done.length}</td><td class="num ${w.tasks.missed.length ? 'bad-t' : ''}">${w.tasks.missed.length}</td><td class="num">${w.activeDays}</td></tr>`).join('');
    const top = {}; rows.forEach(w => w.habits.forEach(h => { if (h.rate != null && h.scheduled && (h.type === 'check' || h.target != null)) { top[h.name] = top[h.name] || { s: 0, d: 0 }; top[h.name].s += h.scheduled; top[h.name].d += h.done; } }));
    const weakest = Object.entries(top).map(([n, v]) => ({ n, r: U.pct(v.d, v.s) })).sort((a, b) => a.r - b.r);
    return `<div class="toolbar"><h2>History</h2><span class="spacer"></span><span class="muted small">Click a week to open its report.</span></div>
    <section class="card scroll"><table class="tbl"><thead><tr><th>Week</th><th>Dates</th><th class="num">Tracked</th><th class="num">Plan met</th><th class="num">Habits</th><th class="num">Good days</th><th class="num">Done</th><th class="num">Missed</th><th class="num">Active days</th></tr></thead><tbody>${tr}</tbody></table></section>
    <section class="card"><h3>Recurring weak spots (all time)</h3>${weakest.length ? Charts.hbars(weakest.slice(0, 8).map(x => ({ label: x.n.split('·')[0].split(':')[0].trim().slice(0, 24), value: x.r || 0, color: 'var(--bad)' })), { fmt: v => v + '%', max: 100 }) : '<p class="muted">Not enough data yet.</p>'}
      <p class="muted small">Lowest completion rates across all recorded weeks. These are the habits to shrink or redesign.</p></section>`;
  }

  /* ================= SETTINGS ================= */
  function settings() {
    const d = D(); const wk = st.week; const plan = Calc.planFor(wk); const hasOverride = !!d.plans[wk];
    const areas = d.areas.map(a => `<div class="area-block"><div class="row"><input type="color" value="${e(a.color)}" data-change="areaColor" data-id="${a.id}" aria-label="Color">
      <input value="${e(a.name)}" data-change="areaName" data-id="${a.id}" aria-label="Area name"> ${a.archived ? '<span class="badge">archived</span>' : ''}<span class="spacer"></span>
      <button class="link" data-act="toggleArea" data-id="${a.id}">${a.archived ? 'Restore' : 'Archive'}</button></div>
      <div class="projects">${d.projects.filter(p => p.areaId === a.id).map(p => `<div class="row"><input type="color" value="${e(p.color)}" data-change="projColor" data-id="${p.id}" aria-label="Color">
        <input value="${e(p.name)}" data-change="projName" data-id="${p.id}" aria-label="Project name">${p.archived ? '<span class="badge">archived</span>' : ''}<span class="spacer"></span>
        <button class="link" data-act="toggleProj" data-id="${p.id}">${p.archived ? 'Restore' : 'Archive'}</button></div>`).join('')}
      <form data-form="addProject" data-area="${a.id}" class="row"><input name="name" placeholder="New project in ${e(a.name)}" required maxlength="60"><button class="btn">Add</button></form></div></div>`).join('');
    const planRows = d.projects.filter(p => !p.archived).map(p => `<tr><td>${chip(p.id)}</td><td><input type="number" min="0" step="0.25" name="p_${p.id}" value="${plan[p.id] ? +(plan[p.id] / 60).toFixed(2) : ''}" placeholder="0"> h</td></tr>`).join('');
    const days = Math.floor((Date.now() - new Date(d.settings.lastBackup || d.created).getTime()) / 86400000);
    return `<div class="toolbar"><h2>Settings</h2></div>
    <section class="card"><h3>Weekly plan <span class="muted small">${e(weekLabel(wk))} ${hasOverride ? '· custom for this week' : '· using default'}</span></h3>
      <div class="row"><button class="btn" data-act="weekPrev">‹ week</button><button class="btn" data-act="weekNext">week ›</button></div>
      <form data-form="plan" class="stack"><table class="tbl"><tbody>${planRows}</tbody></table>
      <div class="row"><button class="btn primary" name="mode" value="week">Save for this week only</button><button class="btn" name="mode" value="default">Save as default</button>
      ${hasOverride ? '<button type="button" class="btn" data-act="clearWeekPlan">Use default for this week</button>' : ''}</div></form></section>
    <section class="card"><h3>Daily target</h3><form data-form="target" class="row">Tracked time that counts as a full day: <input type="number" name="min" min="15" step="15" value="${d.settings.dailyTargetMin}"> min <button class="btn">Save</button></form>
      <p class="muted small">Heatmap intensity = 50% habits done + 50% tracked time vs this target.</p></section>
    <section class="card"><h3>Areas & projects</h3>${areas}
      <form data-form="addArea" class="row top-gap"><input name="name" placeholder="New area" required maxlength="40"><input type="color" name="color" value="#2f6fdf"><button class="btn">Add area</button></form></section>
    <section class="card"><h3>Your data</h3>
      <p>Everything is stored only in this browser (${(JSON.stringify(d).length / 1024).toFixed(0)} KB). Nothing is sent anywhere. Last full backup: <strong>${d.settings.lastBackup ? U.fmtDate(U.dateKey(new Date(d.settings.lastBackup))) : 'never'}</strong>${days >= 7 ? ' <span class="badge bad">due</span>' : ''}.</p>
      <div class="row"><button class="btn primary" data-act="backup">Download full backup (JSON)</button>
      <label class="btn">Import backup… <input type="file" accept="application/json,.json" data-change="import" hidden></label>
      <select id="importMode"><option value="merge">merge with current data</option><option value="replace">replace current data</option></select></div>
      <div class="row top-gap"><button class="btn" data-act="exportAllCsv">Export all time entries (CSV)</button><button class="btn danger" data-act="wipe">Delete all data…</button></div></section>`;
  }

  /* ================= FIRST RUN ================= */
  function welcome() {
    return `<section class="card welcome"><h2>Welcome</h2><p>This tracker stores everything in your own browser. Choose a starting point. You can change everything later.</p>
      <div class="row"><button class="btn primary" data-act="preset" data-p="semester">Semester preset (7 subjects, 7 daily boxes, exam goals)</button>
      <button class="btn" data-act="preset" data-p="blank">Start empty</button>
      <label class="btn">Restore a backup… <input type="file" accept="application/json,.json" data-change="importFirst" hidden></label></div></section>`;
  }

  const views = { day, habits, tasks, goals, dashboard, report, history, settings };
  return { st, views, welcome };
})();
