# Datenmodell

Vollständige Feldreferenz und die `window.LWT`-Schnittstelle stehen in [`CLAUDE.md`](../CLAUDE.md#data-model) — dieses Dokument beschreibt nur den Überblick und die Übergänge.

## Speicher-Keys

| Key | Modul | Inhalt |
|---|---|---|
| `local-work-tracker-v1-tasks` | Aufgaben | Aufgaben-Array |
| `local-work-tracker-v1-contexts` | Aufgaben | gemerkte Kontext-Tags |
| `local-work-tracker-v1-time-entries` | Zeit | Zeiteinträge + laufender Timer |
| `local-work-tracker-v1-time-entries-ticket-suggestions` | Zeit | Autocomplete-Presets — `{ ticket, description }`-Paare |
| `local-work-tracker-v1-time-entries-pomodoro` | Zeit | Pomodoro-Zustand |
| `local-work-tracker-v1-notes` | App-Shell | Notiz-Widget der Sticky-Bar — `{ version, text, updatedAt }`, reines Markdown ohne Rendering, max. 20.000 Zeichen |
| `local-work-tracker-v1-theme` | App-Shell | `'light'` \| `'dark'` |

## Status-Übergänge (Aufgaben)

```
inbox ──(Priorität + Aufwand setzen)──▶ [Guardrail]
  ├─ Aufwand "quick"     → Sofort erledigt (done)  ODER  trotzdem planen
  ├─ Aufwand "toolarge"  → escalated (Story-Key) ODER verworfen (dropped)
  ├─ Aufwand "tbd"       → backlog (kein Planen möglich, bis Rahmen klar ist)
  └─ sonst               → planned (Kalenderwoche) ODER backlog

planned ──▶ done | dropped | verschoben (carryCount++) | zurück ins backlog
backlog ──▶ planned | dropped
```

Eine geplante Aufgabe, die nachträglich auf Aufwand `toolarge` oder `tbd` umklassifiziert wird (`changeEffort`), fällt automatisch zurück ins Backlog — beide Guardrails gelten rückwirkend, siehe `docs/architecture.md`'s Feature→Funktion-Tabelle.

`done`, `dropped`, `escalated` sind terminal und landen im Archiv, gruppiert nach Kalenderwoche.

## Zeiteinträge und die `taskId`-Verknüpfung

Ein Zeiteintrag ist unabhängig von Aufgaben gültig — `taskId` ist optional und `null`, solange kein Bezug hergestellt wurde. Gesetzt wird sie:

- explizit beim Start aus der „Heute"-Liste heraus (`LWT.time.startTimerFromTask`),
- oder automatisch, wenn die eingetippte Ticket-Nr. exakt (case-insensitive) dem `externalRef` oder Titel einer offenen Aufgabe entspricht (`resolveTaskIdForTicket`).

Die kumulierte Zeit pro Aufgabe wird nicht persistiert, sondern bei jedem Rendern aus allen Zeiteinträgen mit passender `taskId` neu berechnet (`getTrackedMs`/`getTrackedMinutesLabel`) — bearbeitet oder löscht man einen Zeiteintrag, ist die Anzeige auf der Aufgabenkarte beim nächsten Rendern automatisch korrekt.

## Ticket-Nr. und Beschreibung

`ticket` (Ticket-Nr., max. 60 Zeichen) und `ticketDescription` (Beschreibung, max. 120 Zeichen) sind seit der Trennung zwei getrennte Felder — vorher ein einziges Freitextfeld nach dem Muster „ABC-123: Beschreibung". Alte Einträge werden beim ersten Laden/Import/Snapshot-Restore einmalig am ersten `:` aufgesplittet (`splitLegacyTicket`, aufgerufen aus `normalizeEntry`/`normalizeActiveTimer`); ein bereits migrierter Eintrag (erkennbar daran, dass er schon ein — ggf. leeres — `ticketDescription` trägt) wird nie erneut gesplittet. Die Ticket-Vorschläge folgen demselben Muster: aus dem alten `string[]` wurden `{ ticket, description }`-Paare (`normalizeTicketPair`, `dedupeTicketPairs`). Details siehe `docs/architecture.md`'s Abschnitt „Ticket number/description split, precisely".

In der Schnellauswahl (Preset-Dropdown, Autocomplete-Datalist) wird immer „Ticketnummer: Beschreibung" gemeinsam angezeigt, aber nur die Nummer eingefügt. Die Gruppenauswertung im Zeit-Tab gruppiert ausschließlich nach `ticket` und zeigt die Beschreibung des jeweils jüngsten Eintrags dieser Gruppe (mit Hinweis, wenn mehrere unterschiedliche Beschreibungen vorkommen) sowie eine Schaltfläche zum Kopieren der Ticketnummer.

## Migration

Siehe [`backup.md`](backup.md#migration-von-den-einzel-apps).
