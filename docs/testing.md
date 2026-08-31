# Testing

Alle Testseiten liegen unter `tests/` und folgen der Namenskonvention `t\d\d-*.html` (Verhaltenstests) bzw. `s\d\d-*.html` (Regressions-/Storage-Tests). Jede Seite ist eigenständig: sie öffnet `../index.html` in einem `<iframe>` und steuert die echte App, oder — bei reinen Logik-/Storage-Tests — dupliziert die zu prüfende Funktion inline, statt sie aus `index.html` zu importieren (bewusste Entscheidung, siehe `CLAUDE.md`).

## Ausführen

Alle Seiten einzeln im Browser über [`tests/index.html`](../tests/index.html), oder headless:

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```

`tests/run-headless.mjs` startet einen lokalen HTTP-Server, öffnet jede `t*`/`s*`-Seite in Chromium, wartet auf die Ergebnistabelle und schlägt fehl, sobald irgendein `FAIL` auftaucht.

## Eine neue Testseite schreiben

Der Runner erwartet:

- Dateiname passt auf `/^(t|s)\d\d-.*\.html$/`.
- Ein Element `#status` und eine Tabelle mit `<tbody id="results">`.
- Mindestens drei Prüfungen (`record(name, pass, details)` o.ä.), jede als Zeile mit dem Ergebnis exakt `PASS` oder `FAIL` in der zweiten Zelle.

Für Tests, die die echte App im Iframe steuern (wie die meisten `t*`-Seiten des Zeit-Tabs): beim Lesen von `localStorage` direkt aus dem Iframe-Fenster den **aktuellen** Storage-Key verwenden (`local-work-tracker-v1-tasks`, `local-work-tracker-v1-time-entries`, …, siehe [`data-model.md`](data-model.md#speicher-keys)) — nicht die alten Einzel-App-Keys. Ebenso: `#toastRoot` kann mehr als einen Toast gleichzeitig enthalten (z. B. einen fälligen Tagesbackup-Toast beim ersten Laden), daher beim Prüfen eines bestimmten Toasts nach Inhalt filtern statt blind das erste `.toast`-Element zu nehmen.

`s04-legacy-migration.html` und `t16-task-timer-linking.html` sind die beiden Tests, die neu für den Merge hinzugekommen sind — sie decken die Legacy-Migration bzw. die `taskId`-Verknüpfung ab, alles andere ist von LocalTasks/LocalTimetracker übernommen. `t18-notes-widget.html` deckt das später hinzugekommene Sticky-Bar-Notiz-Widget ab (newline-erhaltendes `sanitizeNotes`, defensives Parsen beim Laden/Import). `t19-tbd-effort-guardrail.html` deckt den dritten Aufwand-Guardrail ab (`tbd`/„Rahmen unklar": `planTask`-Ablehnung, rückwirkendes Zurückfallen ins Backlog bei `changeEffort`, Aktionsmengen in Guard- und Backlog-Karte).
