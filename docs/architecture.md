# Architecture

Deep technical reference for `index.html`. Written for whoever (human or Claude) needs to change this file later without re-deriving the structure from scratch by reading all ~4900 lines. Start here, then jump straight to the line range you need — `grep -n "function <name>"` still works fine, this doc just tells you which of the four scripts to look in.

For the **data model** (task/time-entry schema, storage keys) see [`data-model.md`](data-model.md). For the **product concept** (guardrails, linking rationale) see [`concept.md`](concept.md). For **hard constraints** (single file, no deps, German UI) see [`../CLAUDE.md`](../CLAUDE.md). This document is the missing piece between those: how the file is actually built.

## Why this shape

LocalWorkTracker is LocalTasks and LocalTimetracker pushed into one `index.html`. Rather than interleave their code line-by-line, each app's original script was kept close to verbatim as its own IIFE, and a small new "shell" layer on top handles only what's genuinely new: tab switching, the sticky live-timer/Pomodoro bar, and the unified Daten menu. This keeps future changes to "how tasks work" or "how time tracking works" scoped to one module, searchable independently, and low-risk to cross-break.

## The four `<script>` blocks, in document order

| # | Lines (current) | Role | Defines |
|---|---|---|---|
| 1 | ~812–856 | **Boot** | Legacy-key migration, initial theme (before first paint) |
| 2 | ~1214–3194 | **TimeModule** | Timer, Pomodoro, manual entries, filters/stats/chart, snapshots, ticket presets | `window.LWT.time` |
| 3 | ~3196–4739 | **TaskModule** | Inbox/Triage/Woche/Backlog/Archiv, escalation, daily backup | `window.LWT.tasks` |
| 4 | ~4741–4934 | **AppShell** | Main-tab switching, theme toggle, combined Daten menu | `window.LWT.shell` |

Line numbers drift as the file is edited — treat the table as "which script, in which order", and re-`grep -n "<script>"` if you need exact numbers. Order matters: TimeModule must load before TaskModule (TaskModule's card rendering reads `window.LWT.time` while rendering), and both must load before AppShell (AppShell wires buttons that call into both).

### Feature → function map

Jump straight to a feature by grepping for its function names (`grep -n "function <name>"`) instead of trusting line numbers, which drift on every edit. Keep this table current — see the CLAUDE.md rule under "Working Approach".

| Feature | Key functions | Module |
|---|---|---|
| Posteingang (inbox capture) | `renderInboxView`, `captureTask`, `inboxTasks` | TaskModule |
| Triage (priority/effort) | `changePriority`, `changeEffort`, `chipRow` | TaskModule |
| Woche (weekly planning) | `renderWeekView`, `plannedTasks`, `leftoverTasks`, `renderGroups`, `groupByPriority` | TaskModule |
| Heute im Fokus (inline highlight within Woche/Geplant, plus a priority-sorted duplicate panel above the weekly groups for the current week) | `toggleToday`, `focusTasks` (priority-sorted source for both), `renderWeekView` (renders the dedicated panel via `renderGroups`/`renderPlannedCard` with `{ draggable: false }`, current week only), `renderPlannedCard` (highlight + ▶ Timer starten driven by `task.todayFlag` directly, not an opts flag; `draggable` opts flag disables drag&drop for the duplicate panel) | TaskModule |
| Manual drag&drop priorisation (Woche/Geplant only, incl. today-flagged tasks) | `reorderTask`, `reorderPeers`, `moveTaskStep`, `attachReorder`, `getDragAfterElement` | TaskModule |
| Backlog | `renderBacklogView`, `backlogTasks`, `renderBacklogCard`, `isStale` | TaskModule |
| Archiv | `renderArchiveView`, `archivedTasks`, `renderArchiveCard` | TaskModule |
| Escalation guardrail | `escalateTask`, `changeEffort` ('toolarge' branch) | TaskModule |
| Daily backup | `isBackupDue`, `runBackup`, `getBackupStatus`, `buildBackupPayload` | TaskModule |
| Timer start/stop, manual entries | `startTimer`, `internalStopTimer`, `autoStopActiveTimerIfDayEnded` | TimeModule |
| Pomodoro | `renderPomodoro`, the Pomodoro `setInterval` tick | TimeModule |
| Filters/stats/chart | filter-row handlers, `renderChart` (canvas) | TimeModule |
| Snapshots, ticket presets | Snapshot `<details>` handlers, ticket-suggestion datalist wiring | TimeModule |
| Task ↔ time linking | `resolveTaskIdForTicket`, `startTimerFromTask`, `getTrackedMs`/`getTrackedMinutesLabel` | Time↔Task, see below |
| Tab switching, theme toggle, Daten menu | `switchTab`, theme click handler, Daten menu handlers | AppShell |
| Legacy storage migration | `LEGACY_MAP` copy loop | Boot |

Spacing is centralized in two CSS custom properties, `--gap-outer` (panel-to-panel) and `--gap-inner` (inside a panel), defined once per `:root` block (TimeModule's and TaskModule's) — see "CSS" below.

Each of scripts 2 and 3 is its own `(() => { 'use strict'; ... })();` — a private closure. They do not share variables. All cross-module communication goes through the `window.LWT.*` surface below.

## `window.LWT` — the only thing modules know about each other through

```js
window.LWT = {
  time: {
    getActiveTimer(),                              // current state.activeTimer or null
    startTimerFromTask(taskId, ticketLabel, notes), // used by the Aufgaben ▶ button
    getTrackedMinutesLabel(taskId),                 // "1 Std. 15 Min." or null — used by task cards
    getExportPayload(),                             // { entries, ticketSuggestions } — read by TaskModule's combined backup
    exportCsv(),                                    // triggers a download directly
    importPayload(parsed),                          // parsed.timeEntries (combined) or parsed.entries (legacy) — always replaces
    clearAllData(),                                 // no confirm dialog — caller confirms once
    refreshChartTheme()                             // redraw the canvas chart after a theme switch
  },
  tasks: {
    findTask(id), focusTasks(), searchableTasks(),  // searchableTasks() = inbox+backlog+planned, used to resolve typed tickets
    getExportPayload(), exportJson(), exportCsv(),  // exportJson() IS the combined backup — see below
    importPayload(parsed), clearAllData(),
    isBackupDue(), daysSinceLastBackup(), setBackupInterval(days), getBackupStatus(), runBackup(manual),
    getTaskCount()
  },
  shell: {
    switchTab(name)  // 'time' | 'tasks'
  }
};
```

If you need a module to react to the other module's data, **add a method here** — don't reach into the other IIFE's closure (you can't; it's private) and don't duplicate its logic. Example of the existing pattern: `TaskModule`'s `taskMeta()` calls `window.LWT.time.getTrackedMinutesLabel(task.id)` rather than TimeModule pushing task-aware data outward.

### The combined backup lives in TaskModule, not AppShell

`TaskModule.buildBackupPayload()` (called by both `exportJson()` and `runBackup()`) pulls `window.LWT.time.getExportPayload()` and merges it in:

```js
{ kind, exportedAt, version, tasks, contexts, timeEntries, ticketSuggestions }
```

This is why there is only **one** daily-backup-due mechanism (`state.lastBackupDate` / `backupIntervalDays` live in TaskModule's state) even though the payload covers both datasets — see [`backup.md`](backup.md). AppShell's Daten menu just calls `LWT.tasks.exportJson()` / `runBackup()` directly; it does not build its own combined payload.

### Import/Clear go through AppShell because they need one confirm, not two

`AppShell`'s import handler parses the dropped JSON once, shows one `window.confirm(...)`, then calls `LWT.tasks.importPayload(parsed)` and `LWT.time.importPayload(parsed)` in sequence (each is a no-op if its half of the payload is absent). Same pattern for "Alles löschen". Neither module's own `importPayload`/`clearAllData` asks for confirmation — that's deliberately AppShell's job, once, for both.

## DOM structure

```
<body>
  <script> boot: migration + initial theme </script>

  <div class="container">
    <header class="app-head">                 -- title, #dataMenu, #themeToggleBtn, #shortcutHelp (Zeit-only keyboard-shortcut popover, right of the theme toggle) (AppShell-owned)
    <div id="task-backupBanner" hidden>        -- rendered by TaskModule, placed in the header so it's visible from either tab
    <div class="current-row">                  -- sticky bar: #currentTimer + #pomodoroBar (TimeModule-owned, unchanged markup/JS from LocalTimetracker)
    <nav id="mainTabbar">                      -- 2 buttons, data-main-tab="time"|"tasks" (AppShell-owned)
    <main id="mainViewRoot">
      <section id="tabPanelTime">              -- everything from LocalTimetracker's <div class="grid"> (TimeModule-owned)
      <section id="tabPanelTasks" hidden>      -- #task-tabbar + #task-viewRoot (TaskModule's own inner router, unchanged)
    <footer class="app-footer">                -- static GitHub Pages / localStorage-only privacy note (AppShell-owned, no JS)
  </div>

  <div id="toastRoot">                         -- shared: both modules' showToast() append here, AppShell has its own copy too
  <dialog id="taskPromptDialog">, <dialog id="taskConfirmDialog">     -- TaskModule (renamed from promptDialog/confirmDialog)
  <dialog id="timeEditDialog">, <datalist id="ticketSuggestions">, <dialog id="timeConfirmDialog">  -- TimeModule (renamed from editDialog/confirmDialog)

  <script> TimeModule </script>
  <script> TaskModule </script>
  <script> AppShell </script>
</body>
```

**Why `#currentTimer`/`#pomodoroBar` "just work" in the sticky bar:** their markup and all of TimeModule's rendering code (`renderCurrentTimer()`, `renderPomodoro()`, the `setInterval` tick) are untouched from LocalTimetracker — only their *position* in the DOM moved (out of the Zeit-tab-only content, up into the always-visible header area). `getElementById` doesn't care where in the document a node lives, so no JS changed for this.

### Renamed ids (collision avoidance)

Both source apps used identical ids for conceptually different things. Renamed on the way in:

| Old (LocalTasks) | New | Old (LocalTimetracker) | New |
|---|---|---|---|
| `#tabbar` | `#task-tabbar` | — | — |
| `#viewRoot` | `#task-viewRoot` | — | — |
| `#promptDialog` | `#taskPromptDialog` | — | — |
| `#confirmDialog` | `#taskConfirmDialog` | `#confirmDialog` | `#timeConfirmDialog` |
| — | — | `#editDialog` | `#timeEditDialog` |

Not renamed, deliberately centralized (one instance, owned by AppShell, both modules point their `getElementById` at the same node): `#themeToggleBtn`, `#dataMenu` and everything inside it, `#toastRoot`.

**Removed entirely** from both modules' markup and JS wiring, because AppShell's Daten menu replaced them: LocalTasks' own theme toggle + `<details id="dataMenu">` block; LocalTimetracker's own theme toggle + its "Import / Export & Datenverwaltung" `<details>` block (its Snapshots and Ticket-Presets `<details>` blocks were kept — those are Zeit-tab-only features, not part of the unified menu).

## CSS

One `<style>` block (lines 8–809): LocalTimetracker's stylesheet (has the chart `--chart-*` variables) followed by LocalTasks' stylesheet (adds `.tabbar`, `.task-card`, `.chip-group`, etc.), followed by a small `shell` section (`#mainTabbar`, `.tab-panel[hidden]`). The two base stylesheets are ~90% identical (`--bg`, `--panel`, `--accent`, `--border`, `--muted`, button/input/dialog/toast styles, `panel`/`row`/`field` grid system) — duplicate rules are harmless since the values agree. `.tabbar` is reused as-is for **both** the main Zeit/Aufgaben tabs and TaskModule's inner Posteingang/Woche/Backlog/Archiv tabs — same visual language, no separate "main tab" styling needed beyond what's in the `shell` section.

Spacing between boxes is driven by two custom properties defined in **both** `:root` blocks (so Time and Task stay pixel-identical): `--gap-outer` (24px — `.container`, `.app-head`, `.grid`, `#viewRoot`, the space between panels) and `--gap-inner` (16px — `.row`, `.stats`, `.filter-row`, `.task-list`, `.task-main`, `.dialog-body`, the space inside a panel). Add new panel-to-panel or inside-panel gaps to the matching variable rather than a new hardcoded value.

Breakpoints unchanged: `1050px` (two-column grids collapse), `700px` (mobile — stacks `.current-row`, makes tables card-like). Light theme via `body[data-theme="light"]`, toggled by AppShell only — neither module has its own theme code anymore (see below).

## Theming — owned exclusively by AppShell

Both source apps had their own `loadTheme`/`applyTheme`/`toggleTheme`. Since the CSS is now one shared stylesheet keyed off `body[data-theme]`, that was collapsed to a single implementation:

- **Boot script** applies the initial theme (from `local-work-tracker-v1-theme`, falling back to `prefers-color-scheme`) directly to `<body>`, before either module renders — avoids a flash of the wrong theme.
- **AppShell** owns the `#themeToggleBtn` click handler, updates the icon, persists to `local-work-tracker-v1-theme`, and calls `LWT.time.refreshChartTheme()` afterward (the canvas chart needs an explicit redraw to pick up new CSS variable values; DOM/CSS-based UI doesn't).

If you're chasing a theme bug, it's in the boot script or AppShell — not in TimeModule or TaskModule.

## Tab switching

`AppShell` holds two DOM references (`#tabPanelTime`, `#tabPanelTasks`) and a list of `#mainTabbar button[data-main-tab]`. `switchTab(name)` toggles `hidden` on the panels and `.active`/`aria-current` on the buttons, and persists the choice to `local-work-tracker-v1-ui-active-tab` so a reload reopens the same tab. Both panels' content is always in the DOM (just hidden) — there's no re-render-on-switch, so switching tabs is instant and doesn't disturb in-progress form state in the other tab.

`#shortcutHelp` (⌨️, in `.app-head-actions` right of `#themeToggleBtn`) is **not** tab-gated, on purpose: `TimeModule`'s `handleGlobalShortcut` (Ctrl+Enter, Esc, Alt+arrows, Alt+T) is bound on `document` with no active-tab check, so a running timer can be stopped with Esc and the day shortcuts still work even while the Aufgaben tab is showing — hiding the legend there would hide documentation for shortcuts that are still live. (Any element that *would* need per-tab hiding still must pair its CSS `display` rule with a `[hidden] { display: none; }` override, same pattern as `.tab-panel[hidden]` — otherwise the plain rule's equal-or-higher specificity beats the UA default and the `hidden` attribute does nothing. `.shortcut-help[hidden]` is kept for exactly that reason, even though nothing sets it today.)

`window.LWT.shell.switchTab('time')` is how the Aufgaben ▶ button jumps to the Zeit tab after starting a timer (`TaskModule`, inside `renderPlannedCard`, guarded with `if (window.LWT.shell)`).

## Task ↔ time linking, precisely

- `TimeModule.startTimer(overrideTaskId)` — the internal function now takes an optional `taskId`. Called with no argument by the normal Start button; called with the task's id by `LWT.time.startTimerFromTask`.
- If no `overrideTaskId` is given, `resolveTaskIdForTicket(ticket)` tries a case-insensitive exact match against `window.LWT.tasks.searchableTasks()` (`externalRef` first, then `title`). No match → `taskId: null`, same as before the merge.
- `taskId` flows into `state.activeTimer`, then into the saved entry in both `internalStopTimer()` and `autoStopActiveTimerIfDayEnded()` (the end-of-day auto-stop path — both had to be updated, easy to miss if you touch this again).
- `normalizeEntry`/`normalizeActiveTimer` coerce a non-string `taskId` back to `null` — same defensive-normalization posture as every other field, so malformed imported/legacy data can't crash rendering.
- Tracked minutes are **never stored** — `getTrackedMs(taskId)` sums `getNetDurationMs(entry)` over `state.entries.filter(e => e.taskId === taskId)` fresh on every call. `taskMeta()` in TaskModule calls this (via `LWT.time.getTrackedMinutesLabel`) on every card render, so edits/deletes to time entries are reflected immediately without any cache-invalidation logic to maintain.

## Storage migration, precisely

The boot script's `LEGACY_MAP` is a flat list of `[oldKey, newKey]` pairs, copied only when `newKey` doesn't already hold a value — see [`data-model.md`](data-model.md#speicher-keys) for the full key table and [`backup.md`](backup.md#migration-von-den-einzel-apps) for the user-facing behavior. It runs synchronously, before TimeModule/TaskModule's own `loadState()` calls, so by the time either module reads `localStorage` the new keys are already populated if legacy data existed.

## If you're about to change something

- **Touching only Zeit-tab behavior?** Stay inside the TimeModule script block. Its internals (`state`, `dom`, all the `render*` functions) are private — the only way out is adding to the `window.LWT.time = {...}` object near the top of the module (right after the boot `setInterval`).
- **Touching only Aufgaben-tab behavior?** Stay inside the TaskModule script block, same pattern — extend `window.LWT.tasks = {...}` near its `init()` call at the bottom.
- **Touching the sticky bar, tab switching, or the Daten menu?** That's AppShell — the last script block, plain functions (not wrapped in as many closures as the modules, since there's less of it).
- **Adding a new cross-module feature?** Add a method to the relevant module's `window.LWT.*` object first, then consume it from the other module or from AppShell. Don't add a fifth script block or a new global unless it's genuinely shell-level (tab/theme/menu), matching what AppShell already owns.
- **Renaming or removing a DOM id?** Check the table above first — an id that looks unique might be intentionally shared (`#toastRoot`, `#themeToggleBtn`) or intentionally split (`task-viewRoot` vs the old `viewRoot`).
