# CLAUDE.md — Project Scope

## Project

**LocalWorkTracker** — a fully client-side personal work companion that merges two prior single-file apps, **LocalTasks** (personal task management below the company ticket system) and **LocalTimetracker** (time tracking), into one app. The user-facing UI is in German.

A sticky bar at the top always shows the live timer and the Pomodoro timer, regardless of which of the two main tabs is active:

- **Zeit** — the former LocalTimetracker: start/stop a timer, log manual entries, filter/analyze, Pomodoro, ticket presets, snapshots.
- **Aufgaben** — the former LocalTasks: Posteingang (inbox capture) → Triage (priority/effort) → Woche (weekly planning + "Heute" focus list) → Archiv, with the same two guardrails as before (quick wins pushed to "just do it now"; anything bigger than half a day is escalated to the company system, never scheduled here).

The two areas are linked: a time entry may carry an optional `taskId` back to a task, task cards show cumulative tracked time, and the "Heute" focus list can start a timer directly on a task via a ▶ button.

## Hard Constraints

- **Single artifact**: the entire app lives in `index.html` (HTML, CSS, and JS in the same file). No additional source folders, no module splits.
- **No external dependencies**: no npm/CDN packages, no web fonts, no trackers, no external API calls. The CSP (`default-src 'self'`) is intentionally strict and must not be weakened.
- **No build step**: the file is opened directly in the browser (or via `tests/*.html` for regression checks). No bundler, no transpiler.
- **Persistence via `localStorage` only.** No IndexedDB, no server.
- **Language**: all user-facing strings, labels, buttons, hints, and alerts must remain in German. Code, comments, and documentation (including this file) are in English.

## Script architecture

`index.html`'s `<script>` section is four separate top-level IIFEs, in this order:

1. **Boot** — runs the one-time legacy-storage migration (see below) and applies the persisted/preferred theme to `<body>` before anything renders, to avoid a flash of the wrong theme.
2. **TimeModule** — the former LocalTimetracker script, close to verbatim. Defines `window.LWT.time` as its public surface for the shell and TaskModule.
3. **TaskModule** — the former LocalTasks script, close to verbatim. Defines `window.LWT.tasks`. Loads after TimeModule so it can safely read `window.LWT.time` while rendering (tracked-minutes pill, ticket-to-task resolution).
4. **AppShell** — new glue code only: main-tab switching (Zeit/Aufgaben/Daten), the unified theme toggle, and the Daten tab (backup/export/import/clear across both datasets, plus TimeModule's relocated snapshot and ticket-preset management).

**Read [`docs/architecture.md`](docs/architecture.md) before making a structural change** (new cross-module feature, renamed/removed DOM id, anything touching the sticky bar, tab switching, theming, or the Daten tab). It has the full DOM tree, the renamed-id table, the complete `window.LWT` surface with what each method does and who calls it, and a "where do I make this change" decision guide — everything below in this section is the short version.

Each module keeps its own internal state, storage keys, and rendering — they do **not** share DOM ids beyond a handful of deliberately centralized elements (`#themeToggleBtn`, `#toastRoot`, the sticky `#currentTimer`/`#pomodoroBar` pair, and the Daten-tab controls — `#lastBackupInfo`, `#backupIntervalSelect`, `#backupNowBtn`, `#exportJsonBtn`, `#exportTasksCsvBtn`, `#exportTimeCsvBtn`, `#importBtn`/`#importFile`, `#clearAllBtn`). Task- and time-specific ids that existed in both source apps were prefixed (`task-tabbar`, `task-viewRoot`, `taskConfirmDialog`, `taskPromptDialog`, `timeEditDialog`, `timeConfirmDialog`) to avoid collisions.

**`window.LWT` surface:**
- `LWT.time.getActiveTimer()`, `LWT.time.startTimerFromTask(taskId, ticketLabel, notes)`, `LWT.time.getTrackedMinutesLabel(taskId)`, `LWT.time.getExportPayload()`, `LWT.time.exportCsv()`, `LWT.time.importPayload(parsed)`, `LWT.time.clearAllData()`, `LWT.time.refreshChartTheme()`.
- `LWT.tasks.findTask(id)`, `LWT.tasks.focusTasks()`, `LWT.tasks.searchableTasks()`, `LWT.tasks.getExportPayload()` / `exportJson()` / `exportCsv()`, `LWT.tasks.importPayload(parsed)`, `LWT.tasks.clearAllData()`, `LWT.tasks.isBackupDue()`, `LWT.tasks.setBackupInterval(days)`, `LWT.tasks.getBackupStatus()`, `LWT.tasks.runBackup(manual)`.
- `LWT.shell.switchTab(name)` — `'time'`, `'tasks'`, or `'daten'`.

When adding to either module, prefer extending this surface over reaching into the other module's internals directly.

## Data Model

### Tasks (`local-work-tracker-v1-tasks`, contexts under `local-work-tracker-v1-contexts`)

Unchanged from LocalTasks:

```js
{
  id: string,
  title: string,          // sanitized, max 120 characters
  notes: string,          // sanitized, max 2000 characters
  context: string,        // sanitized, max 40 characters
  priority: 'zero' | 'eighty' | 'nice' | null,
  effort: 'quick' | 'small' | 'medium' | 'toolarge' | null,
  status: 'inbox' | 'backlog' | 'planned' | 'done' | 'dropped' | 'escalated',
  plannedWeek: string | null,   // ISO week key 'YYYY-Www'
  todayFlag: boolean,           // member of the "Heute" focus list
  carryCount: number,
  externalRef: string,          // sanitized, max 60 — story key once escalated
  orderKey: number,             // manual drag&drop order — see below
  createdAt: number, updatedAt: number, doneAt: number | null
}
```

`orderKey` drives manual priorisation within Woche/Geplant (`reorderTask`, `attachReorder`, `moveTaskStep` in TaskModule) — ascending within a priority bucket (`byPriority`). Legacy records without it default to `-updatedAt` in `normalizeTask`, reproducing the old "most recently touched first" order until a drag or the ▲/▼ buttons assign real values. `todayFlag` tasks are not force-sorted within their priority group — `renderPlannedCard` highlights them there (`.task-card.focus`), wherever `orderKey` places them, so starring a task never fights a manual drag&drop reorder. Every planned card, regardless of `todayFlag`, additionally gets a compact ▶ icon button (title/aria-label "Timer für diese Aufgabe starten") that starts a timer via `LWT.time.startTimerFromTask`. They additionally appear, priority-sorted (via `focusTasks`), in a dedicated "Heute im Fokus" panel above the weekly groups (`renderWeekView`, current week only) — a non-draggable duplicate of the same cards (`renderPlannedCard(task, now, { draggable: false })`), not a replacement for the highlighted entry below.

### Time entries (`local-work-tracker-v1-time-entries`)

Same as LocalTimetracker, **plus `taskId`**:

```js
{
  id: string,
  ticket: string,          // sanitized, max 60 characters
  notes: string,           // sanitized, max 2000 characters
  startTs: number, endTs: number,   // ms epoch, endTs > startTs
  pauseMinutes: number,    // 0..1440
  createdAt: number,
  source: 'timer' | 'manual',
  taskId: string | null    // links back to a task.id; null when untracked or the ticket is free-form
}
```

A running timer (`state.activeTimer`) has the same shape as an entry minus `endTs`, plus `taskId`.

`taskId` is set either explicitly (the "Heute" ▶ button) or resolved automatically when the typed ticket text matches an existing task's `externalRef` or title (`resolveTaskIdForTicket`, case-insensitive exact match). Tracked minutes per task are computed on render (`getTrackedMs`/`getTrackedMinutesLabel`) — never persisted on the task itself, so they stay correct even after entries are edited or deleted.

## Storage keys

| Key | Holds |
|---|---|
| `local-work-tracker-v1-tasks` | tasks |
| `local-work-tracker-v1-contexts` | remembered context tags |
| `local-work-tracker-v1-time-entries` | entries + active timer |
| `local-work-tracker-v1-time-entries-ticket-suggestions` | ticket autocomplete presets |
| `local-work-tracker-v1-time-entries-ui-state` | collapsed/expanded `<details>` panels in the Zeit tab |
| `local-work-tracker-v1-time-entries-pomodoro` | Pomodoro timer state |
| `local-work-tracker-v1-time-entries-snapshot-*` | manual local backups (Zeit tab) |
| `local-work-tracker-v1-theme` | `'light'` \| `'dark'`, owned exclusively by AppShell |

### Legacy migration

The boot IIFE copies data from the pre-merge standalone apps' keys (`local-tasks-v1`, `local-tasks-v1-contexts`, `local-time-tracker-v1`, `local-time-tracker-v1-ticket-suggestions`, `local-time-tracker-v1-ui-state`, `local-time-tracker-v1-pomodoro`, and either app's `*-theme` key) into the keys above, once, the first time the merged app runs with a browser profile that still has that old data. It only writes a new key if that key doesn't already exist, and it never deletes the legacy keys — so the standalone apps, if still in use, are unaffected.

## Security

- **Never** inject user data as HTML — only via `textContent` or DOM APIs. No `innerHTML` assignments with user strings.
- Reuse the existing sanitizers rather than re-implementing them: `sanitizeText(value, maxLen)`, `clampNumber(value, min, max)`, plus each module's date/ISO-week helpers.
- `loadState()` in both modules must normalize every field defensively, drop malformed records, and never throw.

## Tests

Standalone HTML pages under `tests/`, listed in `tests/index.html`. Open them in the browser and read the pass/fail table, or run everything headless with `npm test`. Each test page is self-contained and duplicates the logic under test rather than importing from `index.html`.

Requirements imposed by `tests/run-headless.mjs`:

- The file name must match `/^(t|s)\d\d-.*\.html$/`.
- The page needs `#status`, a `#results` tbody, and at least **three** assertions.
- The second cell of each result row must read exactly `PASS` or `FAIL`.

`s04-legacy-migration.html` and `t16-task-timer-linking.html` cover the two things that are new in the merge (storage migration, `taskId` linking); everything else is close to what LocalTasks/LocalTimetracker already had.

## Working Approach

- Minimal, focused diffs. Consistently reuse existing patterns (`row` / `field s*`, `panel`, `pill`, `tabbar`, CSS variables `--bg`, `--panel`, `--accent`, `--gap-outer`, `--gap-inner`, …).
- Before changing code, read the relevant section of `index.html` — the file is large but searchable, and the four-IIFE structure above tells you where to look.
- German labels for priorities, efforts and statuses are defined once in the `PRIORITIES`, `EFFORTS` and `STATUSES` lookup tables inside TaskModule. Do not hardcode them elsewhere.
- For UI changes, check the breakpoints (`1050px`, `700px`) and the light theme (`body[data-theme="light"]`).
- If a change needs both modules to know about each other, extend `window.LWT.*` rather than reaching into the other module's private closures.
- **Keep [`docs/architecture.md`](docs/architecture.md) in sync, in the same change**, whenever you: add, rename, or remove a DOM id; add or change a `window.LWT.*` method; move a function across the four script-block boundaries; add a data-model field (update this file's Data Model section too); or add a CSS custom property/component shared across TimeModule and TaskModule. Anchor additions to `docs/architecture.md`'s feature→function table on stable function names, not line numbers — line numbers drift on every edit.
