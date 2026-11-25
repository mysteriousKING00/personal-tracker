# Personal Tracker

> **Note:** This application was generated with the help of AI (Claude, by Anthropic) and is intended for **personal use**. It is provided as-is, without warranty. Your data never leaves your browser.

A local-first tracker for time, habits, tasks and goals, with a GitHub-style contribution calendar and printable weekly reports. Think Toggl Track and a GitHub contribution graph in one small web app.

- **No account, no server, no tracking.** All data stays in your browser's local storage.
- **No dependencies and no build step.** Plain HTML, CSS and JavaScript.
- **Works offline**, on a laptop or installed on a phone (PWA).

## Features

| Area | What it does |
|---|---|
| Time tracking | Live timer or manual entries per project; projects are grouped into areas; edit and delete past entries |
| Habits | Yes/no habits and number habits (e.g. screen time ≤ 120 min) on chosen weekdays; streaks; 7- and 30-day rates |
| Tasks & milestones | Due dates, planned minutes, milestones; overdue tasks are marked as **missed** automatically |
| Goals | Hours in a project or area, habit completion %, linked tasks, or a manual counter, with expected-pace comparison |
| Weekly plan | Planned hours per project (a default plan plus per-week overrides) vs. actual time |
| Dashboard | KPIs, 12-month contribution heatmap, planned vs. actual, habit adherence, 30-day and 12-week trends |
| Weekly report | Time, habits, tasks (done / missed / pending), goals, comparison with the previous week, review questions. **Save as PDF** via the browser's print dialog |
| Exports | Weekly **JSON** (machine-readable, schema `personal-tracker.week.v1`) and **CSV**; full backup JSON; all time entries as CSV |
| History | Every week since you started, plus your recurring weak spots |

## Run it

**Locally:** download or clone this repo and open `index.html` in Chrome, Edge or Firefox. That's all.
(Optional, for offline/PWA support: `python3 -m http.server 8000` in this folder, then open `http://localhost:8000`.)

**On GitHub Pages:**
1. Push this folder to a repository (e.g. `personal-tracker`).
2. Repository → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
3. After a minute the app is at `https://<username>.github.io/personal-tracker/`.
4. On your phone, open that URL and choose *Add to Home Screen*.

The code is public on GitHub Pages; **your data is not**. It never leaves the browser you enter it in.

## Your data

- Stored in `localStorage` under the key `personal-tracker-v1`, per browser and per device.
- **Back up weekly:** Settings → *Download full backup (JSON)*. The app reminds you after 7 days without a backup.
- **Moving or combining devices:** download a backup on one device, then *Import backup* on the other with **merge** (adds missing records; existing ones are kept) or **replace**.
- Clearing site data in the browser deletes the data. Keep your backup files somewhere safe (e.g. a cloud folder).

## Weekly routine

1. Every day: log time (timer or manual) and tick habits on the **Day** page (about 1–2 minutes).
2. Sunday: open **Weekly report**, answer the three review questions, click **Save as PDF**, then **Export JSON**.
3. Hand the JSON to whoever (or whatever) does your weekly analysis.

## Project structure

```
index.html            app shell
css/styles.css        layout, light/dark theme, print styles for the PDF report
js/util.js            dates, ISO weeks, formatting, CSV, downloads
js/store.js           persistence, import (merge/replace), schema migration
js/presets.js         starting configurations (semester preset, empty)
js/calc.js            time, habit, task, goal and weekly calculations
js/charts.js          dependency-free SVG charts (heatmap, bars, columns, lines)
js/views.js           all screens
js/app.js             routing, actions, forms, exports
sw.js                 offline cache of the app files (not your data)
```

## License

MIT, see `LICENSE`.
