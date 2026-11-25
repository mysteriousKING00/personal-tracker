'use strict';
/* Starting configurations. Everything here can be edited or archived inside the app.
   IDs are deterministic (not random), so two devices that both start from the same preset
   share the same areas, projects, habits, goals and tasks, and merging their backups does not duplicate them. */
const Presets = (() => {
  const slug = s => s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

  // Exam goals: hours of study per subject, finished the day before each exam.
  const SUBJECTS = [
    { name: 'ADS', hours: 55, deadline: '2027-01-17', exam: '2027-01-18' },
    { name: 'Physik', hours: 30, deadline: '2027-01-18', exam: '2027-01-19' },
    { name: 'OOP', hours: 55, deadline: '2027-01-19', exam: '2027-01-20' },
    { name: 'Mathe 1', hours: 30, deadline: '2027-01-20', exam: '2027-01-21' },
    { name: 'EidP', hours: 30, deadline: '2027-01-24', exam: '2027-01-25' },
    { name: 'DT', hours: 30, deadline: '2027-01-26', exam: '2027-01-27' },
    { name: 'Mathe 2', hours: 35, deadline: '2027-01-27', exam: '2027-01-28' }
  ];

  // Weekly minutes needed to reach a goal on time, spread evenly from start to deadline
  // (same day count as the pace calculation in Calc.goalPace), rounded up to 15 min.
  function weeklyMinutes(hours, startKey, deadlineKey) {
    const days = Math.round((U.parseKey(deadlineKey) - U.parseKey(startKey)) / 86400000) + 1;
    const weeks = Math.max(1, days / 7);
    return Math.ceil((hours * 60) / weeks / 15) * 15;
  }

  function semester() {
    const d = Store.empty();
    const today = U.todayKey();
    const area = (name, color) => { const a = { id: 'sem-area-' + slug(name), name, color }; d.areas.push(a); return a; };
    const proj = (name, a) => { const p = { id: 'sem-proj-' + slug(name), name, areaId: a.id, color: a.color }; d.projects.push(p); return p; };

    const study = area('Study', '#2f6fdf'), work = area('Work', '#6b7280'), worship = area('Worship', '#1f9d63'),
      fitness = area('Fitness', '#e07a1f'), admin = area('Admin', '#8b5cf6'), growth = area('Growth', '#0f9aa8');
    const subj = {};
    SUBJECTS.forEach(s => { subj[s.name] = proj(s.name, study); });
    proj('Job', work); proj('Quran', worship); proj('Walk', fitness); proj('Workout', fitness);
    proj('Errands', admin); proj('GitHub', growth); proj('Obsidian', growth);

    // Default weekly plan derived from the exam goals, so following the plan keeps every goal on pace.
    // Edit in Settings → Weekly plan.
    for (const s of SUBJECTS) d.settings.defaultPlan[subj[s.name].id] = weeklyMinutes(s.hours, today, s.deadline);

    let n = 0;
    const habit = (key, name, extra = {}) => d.habits.push({ id: 'sem-habit-' + key, name, type: 'check', days: [0, 1, 2, 3, 4, 5, 6], start: today, archived: false, order: n++, ...extra });
    habit('fajr', 'Fajr on time · stayed awake · 1 page Quran');
    habit('prayers', 'All 5 prayers on time · ≥1 at the mosque');
    habit('study', 'Study: B1 started within 2 min and finished');
    habit('body', 'Body: walk outdoors + workout');
    habit('food', 'Food: one plate · kitchen closed 22:00');
    habit('phone', 'Phone: none after waking · under target · out of bedroom');
    habit('sleep', 'Sleep: lights out by 22:30');
    habit('screen-time', 'Screen time', { type: 'number', unit: 'min', direction: 'max', target: null });
    habit('money', 'Money spent', { type: 'number', unit: '€', direction: 'max', target: null });
    habit('lectures', 'Lectures attended', { type: 'number', unit: '', direction: 'min', target: null });

    for (const s of SUBJECTS) d.goals.push({ id: 'sem-goal-' + slug(s.name), title: `${s.name} exam-ready`, type: 'time', projectId: subj[s.name].id, target: s.hours, start: today, deadline: s.deadline });

    const task = (key, title, due, project) => d.tasks.push({ id: 'sem-task-' + key, title, due, projectId: project ? project.id : null, plannedMin: null, milestone: true, status: 'todo', created: today, doneAt: null });
    task('block-1', 'Block 1 (ADS, Physik, OOP, Mathe 1) covered, level 2+', '2026-12-20', null);
    task('block-2', 'Block 2 (EidP, DT, Mathe 2) covered, level 2+', '2027-01-03', null);
    task('mocks', '≥2 timed mocks per subject', '2027-01-10', null);
    for (const s of SUBJECTS) task('exam-' + slug(s.name), 'Exam: ' + s.name, s.exam, subj[s.name]);
    return d;
  }
  function blank() {
    const d = Store.empty();
    d.areas.push({ id: 'blank-area-general', name: 'General', color: '#2f6fdf' });
    d.projects.push({ id: 'blank-proj-general', name: 'General', areaId: 'blank-area-general', color: '#2f6fdf' });
    return d;
  }
  return { semester, blank, weeklyMinutes, SUBJECTS };
})();
