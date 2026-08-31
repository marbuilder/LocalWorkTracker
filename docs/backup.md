# Backup

## Tagesbackup

Beim ersten Laden an einem neuen Tag (abhängig vom eingestellten Intervall — täglich, alle 3 Tage, wöchentlich oder aus) versucht die App, ein kombiniertes JSON-Backup herunterzuladen: Aufgaben, Kontexte, Zeiteinträge, Ticket-Presets und die Sticky-Bar-Notiz in einer Datei. Browser blockieren Downloads ohne Nutzergeste — falls das passiert, bleibt ein Banner „Tagesbackup fällig" mit Ein-Klick-Button stehen (der Banner sitzt im Header, sichtbar unabhängig vom aktiven Tab).

Das Tagesbackup wird von TaskModule ausgelöst (`init()`), aber erst einen Makrotask später (`setTimeout(runDailyBackup, 0)`) — AppShell, der vierte `<script>`-Block, definiert `window.LWT.notes` erst nach TaskModule und muss beim Bauen des Payloads bereits verfügbar sein.

Ein Fehlschlag beim Download wird erkannt (die Datei landet aber nicht zwangsläufig auf der Platte — eine Seite kann das nicht zuverlässig prüfen; kein Fehler wird deshalb als Erfolg gewertet, siehe `runBackup()` in `index.html`).

## Daten-Tab

Tab „🗂 Daten":

- **Backup jetzt herunterladen** — löst denselben kombinierten Download manuell aus.
- **Alles exportieren (JSON)** — dasselbe kombinierte Format, für Archivierung oder Migration auf ein anderes Gerät.
- **Aufgaben exportieren (CSV)** / **Zeiteinträge exportieren (CSV)** — getrennt, da unterschiedliche Tabellenform (Aufgaben haben Priorität/Status/Woche, Zeiteinträge haben Start/Ende/Pause).
- **Importieren (JSON)** — erwartet das kombinierte Format (oder ein reines Aufgaben- bzw. Zeiteinträge-JSON aus einer der ursprünglichen Einzel-Apps; fehlende Teile werden übersprungen — eine Datei ohne `notes`-Schlüssel lässt die bestehende Notiz unangetastet). Ersetzt nach Bestätigung den aktuellen Bestand des jeweils enthaltenen Teils.
- **Alles löschen** — leert alle drei Datentöpfe (Aufgaben, Zeiteinträge, Notiz) nach Bestätigung.

## Migration von den Einzel-Apps

Wer vorher LocalTasks und/oder LocalTimetracker im selben Browser genutzt hat, muss nichts tun: beim allerersten Start liest LocalWorkTracker die alten `localStorage`-Schlüssel dieser Apps aus und übernimmt sie einmalig unter den neuen, gemeinsamen Schlüsseln (siehe [`data-model.md`](data-model.md#speicher-keys)). Die alten Schlüssel werden dabei **nicht** gelöscht — falls eine der Einzel-Apps parallel weiterverwendet wird, bleibt deren Datenbestand unangetastet. Ein zweiter Start überschreibt bereits migrierte Daten nicht erneut.

## Snapshots (Daten-Tab)

Zusätzlich zum Tagesbackup bietet der Daten-Tab weiterhin lokale Snapshots (bis zu 5, ältere fallen automatisch raus) — inhaltlich unverändert gegenüber LocalTimetracker (reine Zeiterfassungsdaten, keine Aufgaben), unabhängig vom kombinierten Backup.

## Browser-Grenzen

- Downloads ohne vorherige Nutzeraktion werden von den meisten Browsern blockiert — daher der manuelle Fallback-Button im Banner.
- `localStorage` ist pro Browser-Profil und Origin isoliert. Ein Wechsel des Browsers, Profils oder Geräts erfordert manuellen Export/Import.
