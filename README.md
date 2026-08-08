# LocalWorkTracker

Persönlicher Arbeitsbegleiter als einzelne lokale HTML-Datei — die Verschmelzung von [LocalTasks](https://github.com/marbuilder/LocalTasks) und [LocalTimetracker](https://github.com/marbuilder/LocalTimetracker) zu einer App. Gebaut mit KI.

Diese App deckt die Ebene *unterhalb* des Unternehmens-Ticketsystems ab: sich persönlich organisieren, fokussiert an einer Sache arbeiten, und dabei die Zeit erfassen — ohne dass dafür zwei getrennte Werkzeuge nötig sind.

## Runtime

- `index.html` direkt im Browser öffnen.
- Die App bleibt ein einzelnes eigenständiges HTML-Artefakt mit eingebettetem Vanilla-JavaScript und CSS. Kein Build, keine externen Abhängigkeiten.
- Persistenz ausschließlich über `localStorage`.
- Wer vorher LocalTasks und/oder LocalTimetracker im selben Browser genutzt hat: die Daten werden beim ersten Start automatisch übernommen (siehe [`docs/backup.md`](docs/backup.md)).

## Aufbau

Ganz oben, immer sichtbar, unabhängig davon welcher Tab gerade aktiv ist:

- **Live-Timer** — läuft ein Timer, zeigt die Leiste Ticket und verstrichene Zeit mit Stop-Button; läuft keiner, ein Schnellstart-Feld.
- **Pomodoro** — eigener Countdown daneben, ebenfalls immer sichtbar.

Darunter zwei Tabs:

- **⏱ Zeit** — Timer starten/stoppen, manuelle Einträge, Filter & Auswertung, Diagramm, Ticket-Presets, lokale Snapshots.
- **✅ Aufgaben** — Posteingang (Schnellerfassung) → Triage (Priorität/Aufwand) → Woche (Planung + „Heute“-Fokus) → Archiv. Zwei Leitplanken wie zuvor: Aufgaben bis 15 Minuten werden zum Sofort-erledigen gedrängt statt geplant; alles größer als ein halber Tag wird als Story ins Unternehmenssystem eskaliert, nie hier geplant.

**Verknüpfung:** Ein Zeiteintrag kann optional auf eine Aufgabe zeigen. In der „Heute“-Fokusliste startet ein ▶-Button den Timer direkt für diese Aufgabe (wechselt automatisch in den Zeit-Tab). Tippt man stattdessen manuell eine Ticket-Nr., die zu einer offenen Aufgabe passt (Story-Key oder Titel), wird sie automatisch verknüpft. Aufgabenkarten zeigen dann die kumulierte getrackte Zeit.

## Daten

Ein gemeinsames „Daten ▾“-Menü im Header:

- Tagesbackup (JSON, Aufgaben + Zeiteinträge zusammen), fällig je nach eingestelltem Intervall.
- Export als JSON (kombiniert) oder CSV (Aufgaben und Zeiteinträge getrennt, da unterschiedliche Tabellenform).
- Import (JSON, ersetzt den aktuellen Bestand nach Bestätigung).
- Alles löschen.

Details zum Backup-Mechanismus und den Browser-Grenzen dabei: [`docs/backup.md`](docs/backup.md).

## Dokumentation

- [`docs/concept.md`](docs/concept.md) — Problem, Abgrenzung, Verknüpfungskonzept
- [`docs/architecture.md`](docs/architecture.md) — technische Tiefe: Skript-/DOM-Aufbau, vollständige `window.LWT`-Schnittstelle, "wo ändere ich was"-Leitfaden
- [`docs/data-model.md`](docs/data-model.md) — Schema, Speicher-Keys, Migration
- [`docs/backup.md`](docs/backup.md) — Backup-Mechanik und Browser-Grenzen
- [`docs/testing.md`](docs/testing.md) — Testharness und wie man einen Test schreibt
- [`CLAUDE.md`](CLAUDE.md) — Projekt-Scope und Hard Constraints, verweist für Details auf `docs/architecture.md`

## Tests

Alle Testseiten einzeln im Browser über [`tests/index.html`](tests/index.html), oder headless:

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```

## Notes

- Entwicklungs-Testseiten sind unter `tests/` erlaubt.
- Das ausgelieferte Artefakt bleibt `index.html`.

---
