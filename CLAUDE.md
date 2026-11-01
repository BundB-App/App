# B&B Lager – Projektwissen für Claude

Web-App (PWA) für das Lager der B&B Eventagentur (Hochzeiten, Firmenfeiern, eigene Veranstaltungen).
Läuft auf iPhone und Mac, synchronisiert über Dropbox, wird über GitHub Pages ausgeliefert.

- Live: https://bundb-app.github.io/App/
- Repository: https://github.com/BundB-App/App (Branch `main`, Pages aus `/ (root)`)
- Jeder Push auf `main` ist nach 1–2 Minuten live. **Nicht ungetestet auf `main` pushen**, die App ist im echten Einsatz.

## Zusammenarbeit mit Thomas (Inhaber)

- Auf Deutsch antworten, kurz, in Stichpunkten, ohne Abschweifen.
- Thomas ist kein Entwickler: Schritte in Dropbox, GitHub oder auf dem iPhone konkret und klickgenau erklären.
- Vor größeren Umbauten oder Datenformat-Änderungen kurz Rückfrage halten.
- Bei Fragen zur Dropbox-API vorher die aktuelle Doku prüfen.

## Aufbau

Kein Build-Schritt, kein Framework. Alles liegt im Repository-Root und wird so ausgeliefert:

| Datei | Zweck |
|---|---|
| `index.html` | Die ganze App: CSS, HTML-Gerüst, JavaScript |
| `sw.js` | Service Worker für Offline-Betrieb |
| `manifest.webmanifest`, `icon-*.png` | Home-Bildschirm-App |
| `tests/` | Tests (siehe unten) |
| `testdaten/` | Erfundene Beispielbelege zum Testen |

### Abschnitte in `index.html` (Marker `/* ===== … ===== */`)

1. **PARSER-START … PARSER-END** – reine Funktionen ohne DOM. Werden von `tests/parser.test.mjs` per Regex herausgelöst, daher Marker nicht umbenennen.
   - `parseNum` (deutsche/englische Zahlen), `parseItemLine` (eine Textzeile → Position, sucht Menge × Preis = Gesamt; Fallback: Menge aus Gesamt/Preis bei OCR), `parseHeader` (Lieferant, Belegnummer, Datum), `parseTextDoc`, `parseXmlDoc` (XRechnung/ZUGFeRD, CII und UBL), `parseCsv`, `guessFactor` („Kiste 20x0,5l“ → 20), `cleanName`, `similarity`.
2. **Zustand** – Datenmodell, `put`/`del`/`live`, `merge`, `stockMap`.
3. **Dropbox** – OAuth PKCE ohne Secret, `DBX.api/download/upload/list/move`, `sync()`.
4. **Beleg einlesen** – `readDocument` (PDF via pdf.js inkl. eingebetteter ZUGFeRD-XML, Foto/Scan via Tesseract, XML, CSV), Regeln/Vorschläge, Posteingang-Warteschlange (`scanInbox`, `runQueue`), `bookImport`.
5. **Schnellbuchung** – Bottom-Sheet für Bruch/Schwund/Rückgabe usw., mit Rückgängig. Die Knöpfe „Schnell buchen“ (Lager und Personal) gibt es nur auf der Startseite (Wunsch Thomas).
6. **Bestand aus Excel/CSV** – Import unter Inventur (SheetJS), setzt Bestand per Inventurbuchung.
7. **Personal** – Ampel (`evState`), Doppelbuchung (`conflicts`), WhatsApp-Text (`waText`/`waShare`), Ansichten `vPersonal` (Events), `vPEvent`, `vPPersonen`, Schnell buchen Personal (`pqOpen`/`renderPQ`/`pqBook`, rechter Knopf `fab-personal`). Konzept: `docs/personal.md`.
8. **Ansichten** – `vBestand`, `vBelege`, `vReview`, `vBuchungen`, `vInventur`, `vXl`, `vSetup`, `vAnleitung`, `vHome`; `render()` schreibt `#view` komplett neu.
9. **Ereignisse** – zentrale Delegation über `data-act` / `data-go` / `data-li` usw.

Externe Bibliotheken (versionsgenau gepinnt, per `loadScript` erst bei Bedarf geladen):
pdf.js 3.11.174 (cdnjs), tesseract.js 5.1.1 (jsDelivr, Sprache `deu`), SheetJS xlsx 0.18.5 (cdnjs).

## Datenmodell (`lager.json` in Dropbox, gleiche Struktur in `localStorage` `bb-lager-data-v1`)

```js
{
  articles:  { [id]: {id, name, unit, category, min, lastPrice, updatedAt, deleted?} },
  movements: { [id]: {id, articleId, qty /* ± in Lagereinheit */, type /* in|out|inv|manual */,
                      date /* YYYY-MM-DD */, docId?, note?, reason?, price?, updatedAt, deleted?} },
  docs:      { [id]: {id, dir /* in|out */, party, number, date, source, file /* Dropbox-Pfad */, lines, updatedAt} },
  rules:     { [key]: {id:key, articleId, factor, sample, party, updatedAt} },  // key: 'a:<lieferant>|<artnr>' oder 't:<text>'
  meta:      { v:1, savedAt, by, resetAt }
}
```

- **Bestand wird nie gespeichert**, sondern immer aus `movements` summiert (`stockMap`).
- **Löschen = Soft-Delete** (`deleted:true`, neues `updatedAt`), damit der Merge Löschungen übernimmt.
- **Merge** pro Datensatz: neueres `updatedAt` gewinnt. Mehrere Geräte/Mitarbeiter können offline buchen.
- **Neustart** (Einstellungen): setzt `meta.resetAt`; beim Sync werden auf beiden Seiten alle Datensätze mit `updatedAt <= resetAt` verworfen.
- Schutz: Fehlt `lager.json` nach einem früheren Sync, wird **nicht** neu angelegt (Ordner umbenannt?), außer `CFG.allowNew`.
- Gerätekonfiguration in `localStorage` `bb-lager-cfg-v1`: `appKey` (leer → `APP_KEY`), `base` (Standard `/Apps/BundB App`; fehlt dort `lager.json`, sucht `findBase()` auch unter `/BundB App` und stellt um), `ownName`, Tokens, `autoBook`.
- Datenformat-Änderungen müssen abwärtskompatibel sein (ältere Geräte syncen weiter mit). Neue Sammlungen in `COLLS` aufnehmen.
- **`personal.json`** (Personal: `persons`, `events`, `assignments`, Format in `docs/personal.md`): eigener Zustand `PS`, `localStorage` `bb-personal-data-v1`, Sammlungen `PCOLLS`. `put`/`del`/`live` wählen den Zustand über den Sammlungsnamen. `sync()` ruft nach `lager.json` `syncPersonal()` auf (gleicher Merge, Upload nur bei Änderungen, Datei entsteht erst mit dem ersten Datensatz).

## Dropbox

- Ordner `/Apps/BundB App` (Thomas' Mac: `~/Library/CloudStorage/Dropbox/Apps/BundB App`, seit 2026-11-01; vorher `/BundB App`), wird mit Mitarbeitern geteilt. Bei Mitarbeitern liegt der geteilte Ordner meist als `/BundB App` – beides wird gefunden.
- `Dropbox/Apps/` sammelt alle eigenen Apps (z. B. auch `Time Tracker`).
  - `lager.json` – Datenbank, nie von Hand ändern
  - `Eingang/_Neu`, `Ausgang/_Neu` – Posteingang; die App liest dort beim Start und bei Rückkehr in den Vordergrund automatisch ein
  - `Eingang/<Jahr>`, `Ausgang/<Jahr>` – Archiv nach dem Buchen (nur Ablage, für den Bestand nicht nötig)
  - `Inventur/` – CSV-Protokolle der Inventuren
  - `App/` – Kopie der App-Dateien, wird bei jedem Release mitgespiegelt (maßgeblich ist das Repository); per Doppelklick geöffnet (`file://`) leitet `index.html` auf die Online-Version weiter
  - `Vorlage_Lagerbestand.xlsx` – Vorlage für den Bestandsimport
- Dropbox-App: „Scoped access“, „Full Dropbox“, Rechte `files.metadata.read`, `files.content.read`, `files.content.write`. App key steht fest im Code (`APP_KEY` in `index.html`, nicht geheim, PKCE ohne App secret); Geräte tippen nur „Verbinden“. Unter Einstellungen → Erweitert lässt er sich überschreiben. „Enable additional users“ ist für Mitarbeiter nötig.

## Release-Ablauf

1. Änderung auf einem Branch machen, testen (unten).
2. **In `sw.js` `APP_CACHE` hochzählen** (`bb-lager-app-vN`) – sonst bekommen installierte Geräte das Update nicht zuverlässig.
3. **Sofort live, ohne Rückfrage** (Wunsch von Thomas): nach dem Test nach `main` mergen/pushen. Geräte holen das Update beim nächsten Öffnen mit Netz.
4. Direkt danach die App-Dateien (`index.html`, `sw.js`, `manifest.webmanifest`, `icon-*.png`) nach `~/Library/CloudStorage/Dropbox/Apps/BundB App/App/` kopieren und mit `cmp` prüfen (keine `tests/`, `testdaten/`, `CLAUDE.md`).
5. Thomas kurz sagen, was neu ist und ob er etwas tun muss.

## Tests

- `node --test` (im Root) – Parser-Tests (Node ≥ 20, keine Abhängigkeiten). Laufen gegen den PARSER-Abschnitt aus `index.html`.
- UI/End-to-End: mit Playwright `index.html` öffnen, Dropbox-API per `page.route('https://*.dropboxapi.com/**', …)` simulieren (list_folder, download, upload, move_v2), CDN-Bibliotheken bei Bedarf stubben. Geprüft wurden so: Posteingang-Warteschlange, manuelle Zuordnung, Neustart über zwei Geräte, Schnellbuchung, Handybreite 390 px ohne horizontales Scrollen, Dark Mode.
- `testdaten/` enthält erfundene Belege (PDF mit Textebene, PDF mit eingebetteter ZUGFeRD-XML, XRechnung-XML, Handyfoto, CSV-Lieferliste, Ausgangsrechnungen).

## Design

- Eigene Tokens in `:root` (Flaschengrün `--accent`), Hell- und Dunkelmodus über `prefers-color-scheme` **und** `[data-theme]`.
- Darstellung pro Gerät unter Einstellungen (Automatisch/Hell/Dunkel): `CFG.theme`, wird schon im `<head>` als `data-theme` gesetzt (kein Aufblitzen).
- Schriften: Barlow Condensed (Zahlen/Überschriften), IBM Plex Sans/Mono.
- Mobil: untere Tab-Leiste, Safe-Area-Insets beachten, Mindestbreite 390 px testen.

## Offene Ideen / nächste Etappen

1. **Packliste** (neuer Menüpunkt):
   - Produkte aus mehreren Lagerpositionen, z. B. Zuckerwatte = Maschine, Zucker, Stäbe, Dosierer.
   - Produkt antippen → Bestand jeder zugehörigen Position, knappe Positionen markiert.
   - Zugehörigkeiten als selbst angelegte Regeln.
   - Menge pro Einsatz → „reicht noch für X Events“.
   - „Für Event packen“: alles auf einmal als Entnahme buchen.
   - **Reservierungen für bestimmte Daten**: reservierte Menge bleibt im Bestand, ist für andere Termine belegt; Geräte nach dem Event wieder frei, Verbrauchsmaterial weg; Konflikte (z. B. nur eine Maschine) anzeigen; am Event-Tag Reservierung → Entnahme, Reste zurückbuchen.
2. **„Wer hat gebucht“** – Name pro Gerät/Nutzer an jeder Buchung.
3. ~~Personal~~ – gebaut 2026-11-01 (siehe `docs/personal.md`). Events in `personal.json` sollen von der Packliste/Reservierung mitgenutzt werden.
4. **Code aufteilen**, sobald weitere Module kommen: `index.html` ist groß; Aufteilung in mehrere JS-Dateien ohne Build-Schritt (ES-Module) und `CORE` in `sw.js` entsprechend erweitern.
