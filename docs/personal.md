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
  events:  { [id]: {id, name, date /* YYYY-MM-DD */, start /* HH:MM */, end,
                    need: { gastro: 4, technik: 1, aufbau: 2, abbau: 2 },
                    shifts?: [{id, label, start, end}] /* optional */, updatedAt, deleted?} },
  assignments: { [id]: {id, eventId, personId, role, shiftId?,
                        planStart, planEnd /* vorausgefüllt aus Event/Schicht */,
                        status: 'angefragt'|'bestaetigt'|'abgesagt',
                        actualStart?, actualEnd? /* von der Teamleitung nach dem Event */,
                        updatedAt, deleted?} },
  meta: { v:1, savedAt, by, resetAt }
}
```

- Rollen: Gastronomie, Technik, Aufbauhelfer, Abbauhelfer. Eine Person kann mehrere haben.
- Bezahlung: **entweder** Stundensatz **oder** Tagespauschale. Nur als Info, die App rechnet keine Kosten aus.
- Event: nur Name, Datum, Beginn und Ende. Kein Kunde, kein Ort. Die Dauer wird berechnet. Schichten sind optional.
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
