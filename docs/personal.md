# Modul Personal – Konzept

Stand: Interview mit Thomas, 2026-11-01. Grundlage für den Bau. Vorher `CLAUDE.md` lesen.

## Ziel

Die Teamleitung (ca. 2 Personen) plant freie Mitarbeiter für Events. Heute läuft das über Telefon, WhatsApp und Zettel.
Die Mitarbeiter selbst nutzen die App **nicht**: Sie sagen nicht in der App zu und sehen nichts.
Zugriff haben nur Thomas und die Teamleitung, denn nur sie teilen den Dropbox-Ordner `BundB App`.

## Daten

Eigene Datei **`personal.json`** im selben Dropbox-Ordner wie `lager.json`, mit demselben Mechanismus (Merge pro Datensatz, neueres `updatedAt` gewinnt, Soft-Delete, `meta.resetAt`).
Sie kommt **nicht** in `lager.json`: `merge()` übernimmt nur Sammlungen aus `COLLS`. Ältere Geräte würden neue Sammlungen beim Hochladen verwerfen.

```js
{
  persons: { [id]: {id, name, phone, roles: ['gastro','technik','aufbau','abbau'],
                    payType: 'hour'|'day', rate /* € pro Stunde oder Tagespauschale */, note, updatedAt, deleted?} },
  events:  { [id]: {id, name,
                    roles: [{id, name}] /* Kategorien des Events: Vorschläge gastro/technik/aufbau/abbau (id = Schlüssel) oder eigene */,
                    days: [{id, date /* YYYY-MM-DD */, label /* frei, z. B. „Aufbau“ */,
                            need: { gastro: 4, technik: 1, aufbau: 2, abbau: 2 },
                            times: { gastro: {start, end}, … } /* eigene Zeiten pro Rolle */,
                            start, end /* abgeleitet: frühester Beginn bis spätestes Ende */}],  /* ein Eintrag pro Tag (Unter-Event) */
                    date, dateEnd, start, end /* Kopie: erster/letzter Tag, für Listen und Reservierung */,
                    shifts?: [{id, label, start, end}] /* optional, gelten für jeden Tag */, updatedAt, deleted?} },
  assignments: { [id]: {id, eventId, dayId, personId, role, shiftId?,
                        planStart, planEnd /* vorausgefüllt aus Event/Schicht */,
                        status: 'angefragt'|'bestaetigt'|'abgesagt',
                        actualStart?, actualEnd? /* von der Teamleitung nach dem Event */,
                        updatedAt, deleted?} },
  meta: { v:1, savedAt, by, resetAt }
}
```

- Rollen: Gastronomie, Technik, Aufbauhelfer, Abbauhelfer. Eine Person kann mehrere haben.
- Bezahlung: **entweder** Stundensatz **oder** Tagespauschale. Nur als Info, die App rechnet keine Kosten aus.
- Event: Name und Zeitraum von–bis. Jeder Tag ist ein Unter-Event mit eigenem Beginn, Ende und Bedarf (Wunsch Thomas, 2026-11-01). Kein Kunde, kein Ort. Die Dauer wird berechnet. Schichten sind optional.
- Ältere Events ohne `days` gelten als ein Tag mit der id des Events; Einsätze ohne `dayId` gehören zum ersten Tag.
- Pro Tag und Rolle eigene Anzahl und Zeiten; die Einplanen-Zeile jeder Rolle zeigt diese Zeiten, die Planzeit wird daraus vorausgefüllt.
- Kategorien (früher feste Rollen) legt jedes Event selbst fest, frei benennbar; die vier Rollen sind Vorschläge. need/times/assignment.role verweisen auf die Kategorie-id. Ältere Events ohne `roles` haben die vier Vorschläge.
- Status je Einsatz: kleines Auswahlfeld neben dem Namen (bewusst unauffällig).
- WhatsApp-Bestätigung nur noch über die Rollen-Kacheln im Event (aufklappbar, Liste der Bestätigten), nicht mehr in jeder Einsatz-Zeile.
- Status wird im Event über drei Knöpfe gesetzt (angefragt / bestätigt / abgesagt). Formularfelder für Zeiten und Bedarf sind leer statt 0.
- Benötigte Anzahl **pro Rolle**. „Bestätigt“ wird gezählt (Status `bestaetigt`), nicht gespeichert.
- Absagen bleiben als `abgesagt` sichtbar, damit niemand erneut angefragt wird. Das ist Thomas wichtig.
- Ist-Zeiten: Beginn und Ende, **ohne Pausen**.
- **Events sind gemeinsam:** Die spätere Material-Reservierung (Packliste, siehe `CLAUDE.md`) hängt sich an dieselben `events`. Deshalb die Events nicht als Personal-Interna bauen.

## Ansichten (`vPersonal` und Unteransichten)

1. **Start:** Liste der nächsten Events mit Ampel.
   - Rot: Es sind noch Plätze offen (bestätigte und angefragte Personen zusammen unter dem Bedarf einer Rolle).
   - Gelb: Alle Plätze sind besetzt, aber jemand ist erst angefragt.
   - Grün: Alles ist bestätigt.
   - Vergangene Events sind eingeklappt. Wo noch Ist-Zeiten fehlen, steht ein Hinweis.
2. **Event:** Bedarf pro Rolle (z. B. Gastro 3/4), die Einsätze nach Rolle und den Status per Antippen umschalten.
   - Nach dem Event: Ist-Zeiten eintragen. Pro Person die Differenz Plan/Ist anzeigen (z. B. „+0:45“).
3. **Personen:** Liste mit Anlegen und Bearbeiten.
4. **Warnung bei Doppelbuchung:** Ist eine Person am selben Tag schon in einem anderen Event eingesetzt (angefragt oder bestätigt), erscheint eine Warnung. Die Buchung bleibt trotzdem möglich.
5. **WhatsApp-Knopf pro Einsatz:** erzeugt eine Terminbestätigung und teilt sie über `navigator.share`, ersatzweise `wa.me` oder Kopieren. Beispiel:
   „Hallo Anna, Terminbestätigung: Hochzeit Müller am Sa, 12.06.2027, 14:00–23:00 Uhr, Rolle Gastronomie. Danke!“

## Schnell buchen Personal

Der rechte Knopf in der `.fabs`-Leiste (`fab-personal`). Er ist auf der Startseite und im Bereich Personal zu sehen, aber nicht im Bereich Lager.
Bottom-Sheet wie die Lager-Schnellbuchung:
- Ablauf: **Event** wählen (oder direkt neu anlegen: Name, Datum, Zeiten) → **Person** → **Rolle** → **geplante Zeit** (vorausgefüllt) → Status `angefragt`.
- Die Warnung bei Doppelbuchung erscheint schon hier.

## Nicht gewünscht

Monatsauswertung, Export, Kostenberechnung, Pausen, Zugang für Mitarbeiter, Kunde/Ort am Event.

## Bauhinweise

- Muster aus dem Lager übernehmen: `put`/`del`/`live`, `sync()`, Ereignis-Delegation über `data-act`. Sync für `personal.json` einbauen: eigener Zustand, eigener `localStorage`-Schlüssel, derselbe Sync-Knopf. Fehlt die Datei, wird sie beim ersten Speichern angelegt.
- Release wie in `CLAUDE.md` (APP_CACHE hochzählen, sofort live, Dropbox-Spiegel). Am iPhone in 390 px Breite und im Dunkelmodus testen.
