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
   - `packOf` („Bionade 12 x 0,33l“ → {n:12, single:'Bionade 0,33l'}, nur mit Volumenangabe, Maße wie „3x3m“ zählen nicht), `parseNum` (deutsche/englische Zahlen), `parseItemLine` (eine Textzeile → Position, sucht Menge × Preis = Gesamt; Fallback: Menge aus Gesamt/Preis bei OCR), `parseHeader` (Lieferant, Belegnummer, Datum), `parseTextDoc`, `parseXmlDoc` (XRechnung/ZUGFeRD, CII und UBL), `parseCsv`, `guessFactor` („Kiste 20x0,5l“ → 20), `cleanName`, `similarity`.
2. **Zustand** – Datenmodell, `put`/`del`/`live`, `merge`, `stockMap`; Artikeltyp `KINDS` (Ware/Leistung)/`kindOf`, Einheit nach Menge `uL`, `pureService`, `sameName` (Name oder Zweitname), Kasten ↔ Flasche `packLink`/`packsFor`, Kasten anbrechen `openPacks`.
3. **Dropbox** – OAuth PKCE ohne Secret, `DBX.api/download/upload/list/move`, `sync()`.
4. **Beleg einlesen** – `readDocument` (PDF via pdf.js inkl. eingebetteter ZUGFeRD-XML, Foto/Scan via Tesseract, XML, CSV), Regeln/Vorschläge, Posteingang-Warteschlange (`scanInbox`, `runQueue`), `bookImport`.
   - `suggest`: gelernte Regel → exakter Name/Zweitname („exakt“) → Ähnlichkeit ≥ 0,8, aber nur zwischen Artikeln mit gleichem Gebinde (`packOf`). **Faktor immer 1** (Wunsch Thomas: aus Bezeichnungen wird nichts gerechnet; Kasten bucht auf den Kasten-Artikel), außer gelernt oder von Hand.
   - `applyKind`: Ausgangsrechnung wählt Leistungen ab (Leistung = vermietetes Gerät, Arbeit, Pauschale) („kein Lagerabgang“), von Hand einschaltbar. Rechnung nur daraus lässt sich ohne Buchung abschließen und ablegen. Eingangsrechnungen buchen alles.
   - Abgang von Einzelflaschen (Ausgangsrechnung, Schnellbuchung): reicht der Bestand nicht, bricht `openPacks` Kästen an (Kasten −1, Flaschen +n, `type:'manual'`, `reason:'Kasten angebrochen'`). Rückgängig in der Schnellbuchung nimmt den Anbruch mit.
   - Automatisch buchen nur, wenn alle Positionen über Regel oder exakten Namen bekannt sind.
5. **Schnellbuchung** – Bottom-Sheet für Bruch/Schwund/Rückgabe usw., mit Rückgängig. Die Knöpfe „Schnell buchen“ (Lager und Personal) gibt es nur auf der Startseite (Wunsch Thomas).
6. **Bestand aus Excel/CSV** – Import unter Inventur (SheetJS), setzt Bestand per Inventurbuchung (Differenz). Spalten wie der Export des Rechnungsprogramms plus „Name im Rechnungsprogramm“ (→ `alias`). Leerer Bestand = 0, Stichtag aus dem Dateinamen. Wiederholter Import: nur gefüllte Zellen überschreiben, Treffer auch über `alias`.
5b. **Backup** (`bkPanel`, `bkAuto`, `bkRestore`, `bkProgram`, v63): Panel oben in Einstellungen → Allgemein. Eine Datei `Backup_<Datum>_<HHMMSS>.json` mit `{kind:'backup', lager:S, personal:PS, einkauf:ES}` in der **eigenen Dropbox jedes Nutzers** unter `/BundB App Backup` (absoluter Pfad, außerhalb des geteilten Ordners). Automatisch nach dem Sync beim Öffnen/Zurückkehren, wenn fällig (`CFG.bkInterval` day/week/month, Standard week; Fälligkeit nach dem jüngsten Backup im Ordner, damit Geräte desselben Kontos nicht doppelt sichern), danach `bkPrune` auf `CFG.bkKeep` (Standard 13 ≈ 3 Monate; löscht nur reguläre Backups per `files/delete_v2`). Wiederherstellen: Bereiche wählbar, Bestätigung mit WIEDERHERSTELLEN, vorher `…_vor-Wiederherstellung.json`; `bkRestoreState` stempelt alle Datensätze des Backups neu und markiert nicht enthaltene als gelöscht, damit der Stand auf alle Geräte geht. „Programm sichern“ = ZIP (eigener Zip-Schreiber, ohne Kompression) der App-Dateien in denselben Ordner + Herunterladen.
6a. **Menü Lager (seit v54):** Bestand | Reservierungen (iPhone „Reserv.“) | Einkauf | Packliste | Einstellungen. Inventur und Buchungen über Einstellungen → Lager. **Belege abgeschaltet** (`BELEGE_AKTIV = false`, Wunsch Thomas): kein Einlesen von `Eingang/_Neu`/`Ausgang/_Neu`, das Lager wird über „Aus Lager entnehmen“ im Einkauf und Inventur geführt. Code der Belege bleibt für später.
6b. **Einkauf** – Veranstaltungen mit Bedarf (`einkauf.json`, getrennt von den Personal-Events, Wunsch Thomas). **Seit v61 werden Angebote nur per Dateiauswahl eingelesen** (Wunsch Thomas: die Angebote liegen in einem eigenen Dropbox-Ordner): Knopf „Angebot einlesen“ in den Listen Einkauf/Reservierungen (`ekImportNew` → `ekFromFile`, legt an oder aktualisiert die vorhandene Veranstaltung und öffnet sie) und in jeder Veranstaltung (`ekReadOffer` → `ekIntoEvent`). Keine Kopie in der Dropbox, `e.file` = Dateiname. Die Ordner-Prüfung unten ist abgeschaltet (`OFFER_SCAN = false`). Früher: `scanOffers` liest Angebote aus Dropbox `Angebote/` (PDF/CSV/XML) automatisch; „Jetzt prüfen“ synchronisiert erst und liest dann zusätzlich Angebote, die direkt in `Angebote/<Jahr>/` liegen und zu keiner bestehenden Veranstaltung gehören (`e.file`/`e.seen`), mit Rückmeldung „Keine neuen Angebote“. Ablauf Ordner `Angebote/`: Datei zuerst nach `Angebote/<Jahr>/` verschieben (nur ein Gerät gewinnt), dann `readDocument` + `parseOffer` (Titel in Anführungszeichen, Liefer-/Leistungsdatum) → Veranstaltung + Positionen (`ekLineFrom`: Regel/exakt sicher, „ähnlich“ mit „✓ passt“ bestätigen, offen = zuordnen, unbekannte Pauschale/Stunde = nicht berücksichtigt). Zuordnung von Hand lernt eine Regel (`ekLearn`, gleiche `rules` wie Belege). **Nie doppelt** (`ekKeyOf`/`ekOfferOwner`/`ekPutOffer`): Schlüssel = Angebotsnummer, sonst Inhalt; jede Position trägt `offer` (Schlüssel) und `oq` (Menge laut Angebot). Gleiches Angebot erneut (Ordner oder Knopf) → nichts; gleiche Nummer, anderer Inhalt → Positionen dieses Angebots ersetzen (Zuordnungen von Hand, Hand-Positionen und Listenänderungen bleiben); Angebot einer anderen Veranstaltung → dort aktualisieren bzw. Knopf lehnt ab. Positionen aus v47/v48 ohne `offer` gelten über `offerNo` der Veranstaltung. Korrekturen (v53): Knopf mit **anderer** Angebotsnummer ersetzt alle Angebotspositionen der Veranstaltung (`replaceAll`, Hand-Positionen bleiben, `offerNo` wird die neue); neues Veranstaltungsdatum aus dem Angebot wird übernommen (`opt.off`); war schon entnommen, wird die Entnahme automatisch neu gebucht; Packliste-Haken merken die Menge (`q`), ändert sie sich, ist der Haken weg („neu packen“). Gelöschte Veranstaltung: Angebotsdatei wandert nach `Angebote/<Jahr>/Gelöscht/`, gelöschte Veranstaltungen blockieren „Jetzt prüfen“ nicht mehr. `ekCalc`: Ware und Leistungen (außer Positionen mit Einheit Pauschale/Stunde); Kasten + Flasche in Flaschen zusammengerechnet, gekauft in ganzen Kästen (`packLink`/`packsFor`), Dezimalbestand aufgerundet. Einkaufsliste von Hand änderbar: `ekLines` mit `list:'set'` (Menge einer berechneten Zeile, 0 = von der Liste genommen, `ekSetBuy`) oder `list:'add'` (Zusatzposition, Lagerartikel oder Freitext `name`/`unit`, Gruppe „Zusätzlich“). Liste und PDF: erst Waren, dann (dicke Trennlinie) Leistungen (`r.sec`), darin nach Artikelgruppe. `ekLinesOf` = nur Bedarf, `ekListOf` = nur Listenänderungen. „Angebot einlesen“ in einer Veranstaltung (`ekIntoEvent`): Positionen kommen dazu, Name/Datum bleiben, Datei wird nach `Angebote/<Jahr>/` hochgeladen. Jede Veranstaltung eigene Liste; gebucht wird nur über „Aus Lager entnehmen“. `ekPdf`: jsPDF, Spalten Artikel/Bedarf/Einkaufen/Einheit/Abhaken, Ablage `Einkauf/Einkaufsliste_<Datum>_<Name>.pdf`, danach Teilen/Herunterladen (eigener Klick, wegen iOS-Nutzergeste). Ansichten `vEinkauf`, `vEkEvent`.
   - **Aus Lager entnehmen** (`ekTake`/`ekUntake`): Ware wird echt ausgebucht (`movements` mit `ekId`, `type:'manual'`, `reason:'Entnahme Veranstaltung'`; erst ganze Kästen, dann Flaschen, notfalls ein Kasten mehr). Leistungen (Geräte) nur reserviert in `e.took.res`, gilt für andere Veranstaltungen am selben Datum. `ekCalc` rechnet die eigene Entnahme als Bestand zurück und zieht fremde Reservierungen ab; `ekTakeDiff` warnt, wenn sich der Bedarf seither geändert hat; `ekOtherTookHtml` zeigt, was andere Veranstaltungen entnommen haben.
6e. **Reservierungen** (`vReserv`, `vRvEvent`, `rvCalc`, v54): dieselben Veranstaltungen und dieselbe Bedarfsliste (`ekLines`) wie Einkauf/Packliste, gezeigt werden nur Leistungen (ohne Pauschale/Stunde) plus Leistungen aus Produktgruppen. Zeitraum `e.from`/`e.to` (aus „Mietzeitraum“ im Angebot via `parseOffer`, sonst `e.date`), Überschneidung = gleicher Zeitraum. „Aus Lager entnehmen“ (`rvTake`) gibt Vorrang (`e.rv = {at, items, v:2}`) und bucht sofort zwei `movements` mit fester ID: Abgang `rv|<Veranstaltung>|<Artikel>|out` am ersten Tag des Zeitraums, Rückgabe `…|back` am Tag nach dem Ende (`rvId`). **`stockMap` zählt Buchungen erst ab ihrem Datum** (Datum > heute zählt nicht), dadurch fehlt das Gerät im Bestand nur im Zeitraum. Zeitraum geändert → `rvTake` bucht um. `rvAutoReturn` stellt nur noch alte v54-Entnahmen um. `rvOwned` = Gerätebestand ohne Reservierungsbuchungen; frei = eigenes Lager − Entnahmen anderer im Zeitraum. Rot „ACHTUNG Konflikt“ nur, wenn Entnahmen anderer das Gerät belegen; orange, wenn das Lager insgesamt zu wenig hat oder andere im Zeitraum nur geplant haben. Einkauf entnimmt seitdem nur Ware; die Einkaufsliste rechnet Leistungen mit `rvOwned` − Entnahmen anderer.
6c. **Produktgruppen** (`pgHtml`, `pgMembers`): `article.groups = {[Artikel-ID der Gruppe]: Menge je Einheit}`. Die Gruppe heißt wie ein Angebotsartikel (z. B. „Zuckerwatte Maschine - 1200W“), ein Artikel kann in mehreren Gruppen sein. Zuordnen im Bestand-Detail.
6d. **Packliste** (`vPackliste`, `vPkEvent`, `pkCalc`, `pkPdf`): dieselben Veranstaltungen wie Einkauf. Alle sicheren Angebotspositionen in voller Menge (ohne Pauschale/Stunde) plus Produktgruppen-Artikel (Menge × Angebotsmenge, auch bei Pauschalen wie Gastro Equipment). Waren oben, Leistungen unten. Von Hand: `ekLines` `list:'pkset'` (Menge, 0 = entfernt), `list:'pkadd'` (Zusatz), Haken `list:'pkcheck'` mit fester ID `pk|<eventId>|<key>`. PDF nach `Packlisten/`. Bucht nichts.
7. **Personal** – Neues Event: Knopf „Angebot einlesen“ in der Formularleiste (`peOffer`, v62) übernimmt Name (Titel/Kunde) und Leistungsdatum aus dem Angebot (`ekReadOffer`), legt aber keine Einkauf-Veranstaltung an. – Ampel (`evState`), Doppelbuchung (`conflicts`), WhatsApp-Text (`waText`/`waShare`), Ansichten `vPersonal` (Events), `vPEvent`, `vPPersonen`, Schnell buchen Personal (`pqOpen`/`renderPQ`/`pqBook`, rechter Knopf `fab-personal`). Konzept: `docs/personal.md`.
8. **Ansichten** – Bestand und Inventur gegliedert nach Artikelgruppe (`groupArts`; Umschalter nach Typ und „ohne Einheit“ auf Wunsch von Thomas entfernt), aufklappbare `details.grp`, Inhalt erst beim Aufklappen (`toggle`-Listener, `GRP`), Filter Alle/Ware/Leistung (`bKind`, gilt nicht während einer Suche); im Bestand keine Kästchen mehr („nur Nachbestellen“, „Leistungen ohne Bestand ausblenden“ entfernt, Wunsch Thomas), in der Inventur bleibt „Leistungen ohne Bestand ausblenden“; jede Zeile zeigt Ware (grün, `.pill.k-ware`) oder Leistung (blau, `.pill.k-leistung`), Leistungen ohne Bestand nur auf Wunsch ausgeblendet (`hideSvc`, Standard aus), Suche auch in Beschreibung und Zweitname. `vBestand`, `vBelege`, `vReview`, `vBuchungen`, `vInventur`, `vXl`, `vSetup`, `vAnleitung`, `vHome`; `render()` schreibt `#view` komplett neu.
9. **Ereignisse** – zentrale Delegation über `data-act` / `data-go` / `data-li` usw.

Externe Bibliotheken (versionsgenau gepinnt, per `loadScript` erst bei Bedarf geladen):
pdf.js 3.11.174 (cdnjs), tesseract.js 5.1.1 (jsDelivr, Sprache `deu`), SheetJS xlsx 0.18.5 (cdnjs), jsPDF 2.5.1 (cdnjs, Einkaufsliste).

## Datenmodell (`lager.json` in Dropbox, gleiche Struktur in `localStorage` `bb-lager-data-v1`)

```js
{
  articles:  { [id]: {id, name, groups? /* Produktgruppen {leaderId: Menge je Einheit} */, unit /* Einzahl */, unitPl /* Mehrzahl */, category /* Artikelgruppe */, kind /* ware|leistung, fehlt = ware; altes 'miete' (v44) gilt als leistung */,
                      desc /* Zusätzliche Beschreibung, mit Zeilenumbrüchen */, alias /* Name im Rechnungsprogramm, falls korrigiert */,
                      min, lastPrice, updatedAt, deleted?} },
  movements: { [id]: {id, articleId, qty /* ± in Lagereinheit, Dezimal möglich */, type /* in|out|inv|manual */,
                      date /* YYYY-MM-DD */, docId?, note?, reason?, price?, open? /* Kennung Kasten-Anbruch */, ekId? /* Entnahme Ware für Veranstaltung */, rvId? /* Entnahme/Rückgabe Leistung (Reservierung) */, updatedAt, deleted?} },
  docs:      { [id]: {id, dir /* in|out */, party, number, date, source, file /* Dropbox-Pfad */, lines, updatedAt} },
  rules:     { [key]: {id:key, articleId, factor, sample, party, updatedAt} },  // key: 'a:<lieferant>|<artnr>' oder 't:<text>'
  meta:      { v:1, savedAt, by, resetAt }
}
```

- **Bestand wird nie gespeichert**, sondern immer aus `movements` summiert (`stockMap`).
- **Löschen = Soft-Delete** (`deleted:true`, neues `updatedAt`), damit der Merge Löschungen übernimmt.
- **Merge** pro Datensatz: neueres `updatedAt` gewinnt. Mehrere Geräte/Mitarbeiter können offline buchen.
- **Gleichzeitig offen (2 Geräte):** Hochladen nur mit Versionsprüfung (`rev` aus Header `Dropbox-API-Result`, Upload-Modus `update`); bei Konflikt neu holen, zusammenführen, erneut (bis 5×). Hochgeladen wird nur bei echten Änderungen (`differs`), sonst Ping-Pong. `pollRemote` fragt alle 25 s per `get_metadata` die revs ab. Jeder Datensatz trägt `by` (Geräte-ID `CFG.device`); `warnForeign` meldet fremde Änderungen am offenen Eintrag, `foreignChangeOk` fragt beim Speichern von Event/Person nach. `softRender` zeichnet offene Formulare nicht neu.
- **Neustart** (Einstellungen): setzt `meta.resetAt`; beim Sync werden auf beiden Seiten alle Datensätze mit `updatedAt <= resetAt` verworfen.
- Schutz: Fehlt `lager.json` nach einem früheren Sync, wird **nicht** neu angelegt (Ordner umbenannt?), außer `CFG.allowNew`.
- Gerätekonfiguration in `localStorage` `bb-lager-cfg-v1`: `appKey` (leer → `APP_KEY`), `base` (Standard `/Apps/BundB App`; fehlt dort `lager.json`, sucht `findBase()` auch unter `/BundB App` und stellt um), `ownName`, Tokens, `autoBook`.
- Datenformat-Änderungen müssen abwärtskompatibel sein (ältere Geräte syncen weiter mit). Neue Sammlungen in `COLLS` aufnehmen.
- **`einkauf.json`** (Einkauf): `ekEvents {id, name, date, from?, to? /* Reservierungszeitraum */, party, offerNo, file, seen?, note, took? /* Einkauf-Entnahme {at, res (alt, unbenutzt)} */, rv? /* {at, items:{articleId: Menge}, back?} */}`, `ekLines {id, eventId, list? /* set|add: Einkaufsliste von Hand */, offer? /* Angebots-Schlüssel nr:…|sig:… */, oq? /* Menge laut Angebot */, name? /* Freitext bei add */, desc /* Text aus dem Angebot */, qty, unit, articleId /* ''=offen, 'skip' */, how /* Regel|exakt|ähnlich|bestätigt|manuell|Pauschale|… */, src /* angebot|manuell */, pos}`. Eigener Zustand `ES`, `localStorage` `bb-einkauf-data-v1`, Sammlungen `ECOLLS`, `syncEinkauf` wie `syncPersonal` (ohne Neustart-Logik).
- **`personal.json`** (Personal: `persons`, `events`, `assignments`, Format in `docs/personal.md`): eigener Zustand `PS`, `localStorage` `bb-personal-data-v1`, Sammlungen `PCOLLS`. `put`/`del`/`live` wählen den Zustand über den Sammlungsnamen. `sync()` ruft nach `lager.json` `syncPersonal()` auf (gleicher Merge, Upload nur bei Änderungen, Datei entsteht erst mit dem ersten Datensatz).

## Dropbox

- Ordner `/Apps/BundB App` (Thomas' Mac: `~/Library/CloudStorage/Dropbox/Apps/BundB App`, seit 2026-11-01; vorher `/BundB App`), wird mit Mitarbeitern geteilt. Bei Mitarbeitern liegt der geteilte Ordner meist als `/BundB App` – beides wird gefunden.
- `Dropbox/Apps/` sammelt alle eigenen Apps (z. B. auch `Time Tracker`).
  - `lager.json` – Datenbank, nie von Hand ändern
  - `Eingang/_Neu`, `Ausgang/_Neu` – Posteingang; die App liest dort beim Start und bei Rückkehr in den Vordergrund automatisch ein
  - `Eingang/<Jahr>`, `Ausgang/<Jahr>` – Archiv nach dem Buchen (nur Ablage, für den Bestand nicht nötig)
  - `Inventur/` – CSV-Protokolle der Inventuren
  - `Angebote/` – Angebote hier hineinlegen, die App liest sie ein und legt sie unter `Angebote/<Jahr>` ab
  - `Einkauf/` – erzeugte Einkaufslisten (PDF)
  - `Packlisten/` – erzeugte Packlisten (PDF)
  - `einkauf.json` – Einkauf-Daten, nie von Hand ändern
  - `App/` – Kopie der App-Dateien, wird bei jedem Release mitgespiegelt (maßgeblich ist das Repository); per Doppelklick geöffnet (`file://`) leitet `index.html` auf die Online-Version weiter
  - `Inventur/Startbestand_2026-11-03.xlsx` – bereinigter Artikelexport (394 Artikel), Grundlage des echten Bestands; `Inventur/Claude1.numbers` ist das Original
  - `Vorlage_Lagerbestand.xlsx` – Vorlage für den Bestandsimport
- Dropbox-App: „Scoped access“, „Full Dropbox“, Rechte `files.metadata.read`, `files.content.read`, `files.content.write`. App key steht fest im Code (`APP_KEY` in `index.html`, nicht geheim, PKCE ohne App secret); Geräte tippen nur „Verbinden“. Unter Einstellungen → Erweitert lässt er sich überschreiben. „Enable additional users“ ist für Mitarbeiter nötig.

## Release-Ablauf

1. Änderung auf einem Branch machen, testen (unten).
2. **In `sw.js` `APP_CACHE` hochzählen** (`bb-lager-app-vN`) – sonst bekommen installierte Geräte das Update nicht zuverlässig.
3. **Sofort live, ohne Rückfrage** (Wunsch von Thomas): nach dem Test nach `main` mergen/pushen. Geräte holen das Update beim nächsten Öffnen mit Netz.
4. Direkt danach die App-Dateien (`index.html`, `sw.js`, `manifest.webmanifest`, `icon-*.png`) nach `~/Library/CloudStorage/Dropbox/Apps/BundB App/App/` kopieren und mit `cmp` prüfen (keine `tests/`, `testdaten/`, `CLAUDE.md`).
5. Thomas kurz sagen, was neu ist und ob er etwas tun muss.

## Tests

- **UI-Tests im Repo:** `tests/e2e/` (Playwright, simulierte Dropbox, echte `lager.json`/`personal.json` und Angebot A-187 aus Thomas' Dropbox nur lesend). Einmalig `cd tests/e2e && npm install && npx playwright install chromium`, dann z. B. `node tests/e2e/angebot-datei.e2e.mjs`. Gemeinsames Gerüst `harness.mjs` (Geräte, Dropbox-Simulation, `pickFile` für Datei-Dialoge), Bibliotheken und Screenshots in `tests/e2e/.cache/` (nicht im Repo). Neue Funktionen bekommen dort ein eigenes `*.e2e.mjs` (Namen ohne „test“, damit `node --test` sie nicht startet). Ältere Tests bis v60 lagen nur im Scratchpad und sind verloren.
- `node --test` (im Root) – Parser-Tests (Node ≥ 20, keine Abhängigkeiten). Laufen gegen den PARSER-Abschnitt aus `index.html`.
- UI/End-to-End: mit Playwright `index.html` öffnen, Dropbox-API per `page.route('https://*.dropboxapi.com/**', …)` simulieren (list_folder, download, upload, move_v2), CDN-Bibliotheken bei Bedarf stubben. Geprüft wurden so: Posteingang-Warteschlange, manuelle Zuordnung, Neustart über zwei Geräte, Schnellbuchung, Handybreite 390 px ohne horizontales Scrollen, Dark Mode.
- `testdaten/` enthält erfundene Belege (PDF mit Textebene, PDF mit eingebetteter ZUGFeRD-XML, XRechnung-XML, Handyfoto, CSV-Lieferliste, Ausgangsrechnungen).

## Design

- Eigene Tokens in `:root` (Flaschengrün `--accent`), Hell- und Dunkelmodus über `prefers-color-scheme` **und** `[data-theme]`.
- Einstellungsseite (`vSetup`): Allgemein (Darstellung, Anleitung) → Ganze App (Dropbox, Weitergeben/Mitarbeiter) → Bereiche Lager/Personal aufklappbar (`setSec`, offen ist der Bereich, aus dem man kommt).
- Darstellung pro Gerät unter Einstellungen (Automatisch/Hell/Dunkel): `CFG.theme`, wird schon im `<head>` als `data-theme` gesetzt (kein Aufblitzen).
- Schriften: Barlow Condensed (Zahlen/Überschriften), IBM Plex Sans/Mono.
- Mobil: untere Tab-Leiste, Safe-Area-Insets beachten, Mindestbreite 390 px testen.

## Offene Ideen / nächste Etappen

0. ~~Lager Etappe 2~~ – gebaut 2026-11-07 (siehe `docs/lager-etappe2.md`): 394 echte Artikel, Typ Ware/Leistung (Mietware gab es kurz, auf Wunsch von Thomas wieder entfernt), Einheit Einzahl/Mehrzahl (fehlende auf Stück gesetzt), Kasten anbrechen. Offen: Mindestbestände und Preise.
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
