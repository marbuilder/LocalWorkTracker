# Konzept

## Problem

Es gibt ein führendes Ticket-System im Unternehmen. Was darin fehlt, ist eine persönliche Schicht davor: der Ort für die Aufgabe, die während eines Meetings auffällt, den Gedanken, den man nicht sofort verfolgen kann, und die schlichte Frage „woran habe ich heute eigentlich gearbeitet". Zwei getrennte Apps haben das bisher abgedeckt — LocalTasks für die Aufgaben, LocalTimetracker für die Zeit. LocalWorkTracker ist beides in einer Oberfläche, weil beide Fragen im Alltag zusammengehören: fokussiert an *einer* Sache arbeiten heißt auch, zu wissen, was das gerade ist, und wie lange man schon dabei ist.

## Abgrenzung

- **Nach unten**: alles, was während der Arbeit auffällt, wird im Posteingang erfasst statt sofort bearbeitet — außer es dauert ≤ 15 Minuten, dann lieber direkt erledigen als planen.
- **Nach oben**: alles, was größer als ein halber Tag ist, gehört als Story ins Unternehmenssystem. Die App bietet die Eskalation explizit an und verweigert das Planen darüber hinaus.
- **Zeit ist nicht Pflicht**: die App zwingt nicht dazu, jede Aufgabe zu tracken. Zeiterfassung bleibt ein eigener Tab mit eigenem Ticket-Feld — die Verknüpfung zu einer Aufgabe ist optional und passiert entweder explizit (▶-Button) oder automatisch beim Tippen einer passenden Ticket-Nr.

## Verknüpfungskonzept

Ein Zeiteintrag *kann* eine `taskId` tragen, muss aber nicht — freie Zeiterfassung auf ein Firmenticket, das keine lokale Aufgabe hat, bleibt genauso möglich wie zuvor. Verknüpft wird auf zwei Wegen:

1. **Explizit**: die „Heute"-Fokusliste im Aufgaben-Tab zeigt bei jeder Aufgabe einen ▶-Button. Klick startet den Timer mit dem Story-Key (oder Titel) der Aufgabe als Ticket-Nr., setzt die Verknüpfung, und wechselt in den Zeit-Tab.
2. **Automatisch**: wird im Zeit-Tab eine Ticket-Nr. eingetippt, die exakt (case-insensitive) dem Story-Key oder Titel einer offenen Aufgabe entspricht, wird die Verknüpfung beim Start automatisch gesetzt — ohne dass man dafür extra etwas anklicken muss.

Aufgabenkarten zeigen daraufhin die kumulierte getrackte Zeit als Pille (⏱). Die Berechnung passiert bei jedem Rendern neu aus den Zeiteinträgen — es gibt kein separates, potenziell veraltendes Zeitfeld auf der Aufgabe selbst.

## Status-Lebenszyklus (Aufgaben)

Unverändert gegenüber LocalTasks: `inbox → (backlog | planned) → (done | dropped | escalated)`. Details siehe [`data-model.md`](data-model.md).

## Glossar

- **Zero-Tolerance / 80-80 / Nice-to-have** — Prioritätsstufen.
- **Quick Win** — Aufwand ≤ 15 Minuten, Guardrail drängt zum Sofort-erledigen.
- **Story** — Eskalationsziel im Unternehmenssystem für Aufgaben > ½ Tag.
- **Heute-Fokus** — Teilmenge der für die aktuelle Woche geplanten Aufgaben, die man sich für den aktuellen Tag markiert hat (`todayFlag`).
- **Live-Timer** — der laufende Zeiteintrag, sticky oben in der App sichtbar, unabhängig vom aktiven Tab.
