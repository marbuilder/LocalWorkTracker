# Datenmodell

Vollständige Feldreferenz und die `window.LWT`-Schnittstelle stehen in [`CLAUDE.md`](../CLAUDE.md#data-model) — dieses Dokument beschreibt nur den Überblick und die Übergänge.

## Speicher-Keys

| Key | Modul | Inhalt |
|---|---|---|
| `local-work-tracker-v1-tasks` | Aufgaben | Aufgaben-Array |
| `local-work-tracker-v1-contexts` | Aufgaben | gemerkte Kontext-Tags |
| `local-work-tracker-v1-time-entries` | Zeit | Zeiteinträge + laufender Timer |
| `local-work-tracker-v1-time-entries-ticket-suggestions` | Zeit | Autocomplete-Presets |
| `local-work-tracker-v1-time-entries-pomodoro` | Zeit | Pomodoro-Zustand |
| `local-work-tracker-v1-theme` | App-Shell | `'light'` \| `'dark'` |

## Status-Übergänge (Aufgaben)

```
inbox ──(Priorität + Aufwand setzen)──▶ [Guardrail]
  ├─ Aufwand "quick"     → Sofort erledigt (done)  ODER  trotzdem planen
  ├─ Aufwand "toolarge"  → escalated (Story-Key) ODER verworfen (dropped)
  └─ sonst               → planned (Kalenderwoche) ODER backlog

planned ──▶ done | dropped | verschoben (carryCount++) | zurück ins backlog
backlog ──▶ planned | dropped
```

`done`, `dropped`, `escalated` sind terminal und landen im Archiv, gruppiert nach Kalenderwoche.

## Zeiteinträge und die `taskId`-Verknüpfung

Ein Zeiteintrag ist unabhängig von Aufgaben gültig — `taskId` ist optional und `null`, solange kein Bezug hergestellt wurde. Gesetzt wird sie:

- explizit beim Start aus der „Heute"-Liste heraus (`LWT.time.startTimerFromTask`),
- oder automatisch, wenn die eingetippte Ticket-Nr. exakt (case-insensitive) dem `externalRef` oder Titel einer offenen Aufgabe entspricht (`resolveTaskIdForTicket`).

Die kumulierte Zeit pro Aufgabe wird nicht persistiert, sondern bei jedem Rendern aus allen Zeiteinträgen mit passender `taskId` neu berechnet (`getTrackedMs`/`getTrackedMinutesLabel`) — bearbeitet oder löscht man einen Zeiteintrag, ist die Anzeige auf der Aufgabenkarte beim nächsten Rendern automatisch korrekt.

## Migration

Siehe [`backup.md`](backup.md#migration-von-den-einzel-apps).
