# Lager Etappe 2 – echter Bestand und erweiterte Artikeldaten

**Umgesetzt 2026-11-07.** Nachtrag (v45): Mietware wieder entfernt, alles Mietware ist Leistung. Leistungen werden standardmäßig nicht mehr ausgeblendet (Haken „Leistungen ohne Bestand ausblenden“). Alle fehlenden Einheiten auf Stück/Stück.

Abweichungen nach dem Interview mit Thomas (gelten vor dem Text unten):

- Dritter Typ **Mietware** (`kind:'miete'`): Geräte, kommen zurück, Ausgangsrechnung bucht nicht aus, immer sichtbar. Alle Leistungen in Eventausstattung * und Gastro Hardware sind Mietware, außer Gläserpauschale, Gastro Equipment, Kabelpauschale. Dazu Becher Mehrweg, Filterkaffeemaschine 1l, Cocktailglas, Fotobox, Brotkorb, Cocktaillöffel, Kaffeelöffel, Geschirrtuch. Auf Ware: Jim Beam, Deckel Kaffeebecher, Schwamm, Tischdecke Papier.
- **Kasten anbrechen** ist doch drin: reicht der Flaschenbestand bei einem Abgang nicht, Kasten −1 und Flaschen +n.
- **Nichts aus Bezeichnungen rechnen**: Faktor immer 1, `guessFactor` wird nicht mehr für Vorschläge genutzt.
- **Leere Einheiten bleiben leer** (Thomas trägt sie in der App nach), nur 3 Gebinde → Kasten und Servietten braun → Stück.
- **Tippfehler korrigiert** (Wassert, Gatronomie, 1ll, Schnapverschluss, Salatllöffel, Fleicherkiste, Kunstoff, Terassenheizer, „10 Fass“ → „10l Fass“); alter Name als `alias` für die Zuordnung von Rechnungen.
- Leerer Bestand = 0. Liste umschaltbar nach Artikelgruppe oder Artikeltyp.

Stand: 2026-11-07. Auftrag von Thomas: den echten Ist-Stand importieren, die Testdaten löschen und die App um die Spalten der Tabelle erweitern. Vorher `CLAUDE.md` lesen.

## Quelle

`Dropbox/Apps/BundB App/Eingang/_Neu/Claude1.numbers`, Blatt 1, Tabelle `Artikelexport_vom_2026-11-03(3)`. Es ist ein Export aus dem Rechnungsprogramm.

Spalten: `Bestand`, `Bezeichnung`, `Zusätzliche Beschreibung`, `Artikelgruppe`, `Artikeltyp`, `Einheit_(Einzahl)`, `Einheit_(Mehrzahl)`.

Befund:
- 419 Zeilen, davon 25 leer, also **394 Artikel**. Die Bezeichnungen sind eindeutig.
- Artikeltyp: 210 Ware, 184 Leistung.
- Bestand: 303 Artikel über 0, 78 mit 0, 13 leer. Keine negativen Werte. Leere Werte gelten als 0.
- Dezimalwerte sind echt (angebrochene Flaschen, z. B. 6,75). Gleitkomma-Reste wie `12.200000000000001` auf 3 Stellen runden.
- Die Einheit fehlt bei 253 Artikeln.
- Die Artikelgruppe fehlt nur bei „Küchenrolle 2-lagig weiß“. Vorschlag: Gastro Hilfsstoffe.
- 172 Artikel haben eine Beschreibung, bis 857 Zeichen, mit Zeilenumbrüchen.
- Mindestbestand, Preis und Artikelnummer fehlen im Export. `min` und `lastPrice` bleiben 0.
- 44 Getränke-Artikel sind Gebinde („Bionade Holunder 12 x 0,33l“) und meist separate Artikel neben der Einzelflasche. Beide haben einen eigenen Bestand.

## Datenmodell

Neue Felder an `articles` (abwärtskompatibel, fehlende Felder gelten als leer, keine neue Sammlung):

```js
{ desc /* Zusätzliche Beschreibung */, kind /* 'ware' | 'leistung' */, unit /* Einzahl */, unitPl /* Mehrzahl */ }
```

- `category` kommt aus `Artikelgruppe`.
- Fehlt `kind` (alte Artikel), gilt `ware`.
- Anzeige mit Einzahl/Mehrzahl: „1 Flasche“, „3 Flaschen“. Fehlt `unitPl`, wird `unit` genutzt.

## Funktionen

1. **Excel-Import erweitern** (`parseStockTable`, `bookXl`, `vXl`):
   - Er erkennt Beschreibung, Typ und beide Einheiten. Die Vorschau zeigt sie.
   - Leerer Bestand wird als 0 übernommen. Bisher wird so eine Zeile abgewählt, damit fehlte der Artikel.
   - Wiederholter Import bleibt möglich: Felder aktualisieren, Bestand per Differenz.
   - `Vorlage_Lagerbestand.xlsx` um die neuen Spalten ergänzen.
2. **Ausgangsrechnung bucht Leistungen nicht aus** (das ist die wichtigste Änderung):
   - Geräte wie „Faltzelt“ sind vermietet und kommen zurück, „Aufbau“ ist Arbeit.
   - Im Review stehen solche Positionen als „Leistung, kein Lagerabgang“ und sind abgewählt. Von Hand einschalten bleibt möglich.
   - Eine Rechnung nur aus Leistungen muss sich trotzdem abschließen und ablegen lassen. Heute blockiert `bookImport` mit „Keine Position“.
   - Das automatische Buchen muss das ebenso beachten.
   - Eingangsrechnungen buchen auch Leistungen normal (neues Gerät gekauft).
3. **Zuordnung beim Einlesen:**
   - Die Ausgangsrechnungen kommen aus demselben Programm wie der Export. Exakter Treffer über `normText` hat deshalb Vorrang vor der Ähnlichkeit.
   - **Falle Gebinde:** „… 12 x 1l“ und „… 1l“ sind sich sehr ähnlich, dürfen aber nicht verwechselt werden.
   - **Falle Faktor:** Ist der Treffer selbst ein Gebinde-Artikel, muss der Faktor 1 sein, nicht 12 aus `guessFactor`. Sonst wird der Bestand zwölffach gebucht.
4. **Bestand-Ansicht für 394 Artikel:**
   - Gruppiert und aufklappbar nach Artikelgruppe, Filter Ware/Leistung, Suche auch in der Beschreibung.
   - Reine Leistungen sind in Bestand und Inventur standardmäßig ausgeblendet (Typ Leistung und Bestand 0, z. B. Aufbau, Transportkosten, Porto). Für die Zuordnung bei Belegen bleiben sie wählbar.
   - Details: Beschreibung mit Zeilenumbrüchen, alle neuen Felder bearbeitbar.
   - Inventur ebenfalls gruppiert. Am iPhone bleiben Scrollen und Tippen flüssig.
   - Dezimalwerte funktionieren in Anzeige, Schnellbuchung und Inventur.

## Daten aufbereiten

Nach `Dropbox/Apps/BundB App/Inventur/Startbestand_2026-11-03.xlsx` eine bereinigte Datei schreiben. `lager.json` nie von Hand ändern.

- **Bezeichnungen nicht korrigieren,** auch Tippfehler nicht („Wassert“, „Gatronomie“, „12 x 1ll“). Sonst passen die Namen auf den Rechnungen nicht mehr. Nur außen trimmen.
- Leere Einheiten füllen:
  - Getränke mit „N x …“: Kasten/Kästen
  - sonstige Getränke mit Literangabe: Flasche/Flaschen
  - alles andere: Stück/Stück
- 3 Gebinde stehen auf „Flasche“ und werden Kasten: Lichtenauer Himbeerbrause 12 x 1l, Fritz Kola 24 x 0,33l, Fritz Zitrone 24 x 0,33l.
- Die Liste aller Korrekturen Thomas zeigen.
- `.numbers` kann die App nicht lesen. Die Datei muss aus `Eingang/_Neu` nach `Inventur/` verschoben werden, sonst landet sie als unlesbarer Beleg in der Warteschlange.

## Fragen an Thomas

Zu Beginn einmal gesammelt fragen, in Stichpunkten. Ohne Antwort gelten die Vorschläge.

1. **Typ passt nicht zum Lager:**
   - Becher Mehrweg 0,2/0,3/0,4l sind `Ware`, kommen aber zurück. Soll eine Rechnung sie ausbuchen? Vorschlag: auf Leistung.
   - Jim Beam, Deckel für Kaffeebecher, Schwamm und Geschirrtuch sind `Leistung`, werden aber verbraucht oder verkauft. Vorschlag: Jim Beam, Deckel und Schwamm auf Ware.
   - Die Filterkaffeemaschine 1l ist `Ware`. Vorschlag: auf Leistung.
2. **„Servietten braun (100er Pack)“ mit Bestand 2400:** Einzelstücke oder Packs? Das bestimmt die Einheit. Vorschlag: Stück.
3. **Test-Belege** in `Eingang/<Jahr>` und `Ausgang/<Jahr>`: mitlöschen oder liegen lassen? Vorschlag: liegen lassen, die App braucht sie nicht. Nichts ohne sein OK löschen.

## Umstellung

Der Neustart löscht alle Artikel, Buchungen, Belege und gelernten Zuordnungen des Lagers. Es sind nur Testdaten: 25 Artikel, 50 Buchungen, 10 Belege, 71 Regeln. `personal.json` bleibt unberührt, das vorher im Code prüfen.

1. Session: `lager.json` als `Inventur/Sicherung_lager_vor_Neustart_2026-11-07.json` kopieren.
2. Session: Code live schalten (Release-Ablauf in `CLAUDE.md`) und die `.numbers`-Datei verschieben.
3. Thomas: klickgenaue Anleitung geben. Am Mac unter Einstellungen → Lager den Neustart auslösen, dann unter Inventur → Bestand aus Excel die Datei `Startbestand_2026-11-03.xlsx` einlesen, Datum 2026-11-03.
4. Danach prüfen: 394 Artikel, Summen je Gruppe wie im Export, Sync auf das iPhone.

## Nicht in dieser Etappe

Packliste und Reservierungen, Verknüpfung Kasten ↔ Flasche (Kasten anbrechen), Mindestbestände, Preise.

## Tests

- Echter Import der aufbereiteten Datei, Dropbox simuliert.
- Ausgangsrechnung mit Ware, Leistung, Gebinde und Einzelflasche: Bestand stimmt. Rechnung nur aus Leistungen lässt sich abschließen.
- 390 px Breite, Dunkelmodus, Sync zwischen zwei simulierten Geräten, ein altes Gerät ohne neue Felder.
- Am Ende `CLAUDE.md` aktualisieren (Datenmodell, erledigte Etappe).
