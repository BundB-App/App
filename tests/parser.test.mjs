// Parser-Tests: node --test   (im Repository-Root)
// Lädt den Abschnitt PARSER-START … PARSER-END aus index.html und prüft ihn ohne Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const src = html.slice(html.indexOf('/* ===================== PARSER-START'), html.indexOf('/* ===================== PARSER-END'));
const P = new Function(src + '\nreturn {parseNum,parseItemLine,parseHeader,parseTextDoc,parseCsv,guessFactor,cleanName,similarity};')();

test('parseNum: deutsche und englische Zahlen', () => {
  assert.equal(P.parseNum('1.234,56'), 1234.56);
  assert.equal(P.parseNum('14,90'), 14.9);
  assert.equal(P.parseNum('1,234.50'), 1234.5);
  assert.equal(P.parseNum('7.20'), 7.2);
  assert.equal(P.parseNum('12'), 12);
  assert.ok(Number.isNaN(P.parseNum('Kiste')));
});

test('Gebindefaktor und Artikelname', () => {
  assert.equal(P.guessFactor('Elbtaler Pils Kiste 20x0,5l'), 20);
  assert.equal(P.guessFactor('Riesling trocken 0,75l'), 1);
  assert.equal(P.cleanName('Elbtaler Pils Kiste 20x0,5l'), 'Elbtaler Pils 0,5l');
  assert.equal(P.similarity('Elbtaler Pils Kiste 20x0,5l', 'Elbtaler Pils 0,5l'), 1);
  assert.ok(P.similarity('Elbtaler Radler 0,5l', 'Elbtaler Pils 0,5l') < 0.8);
});

// pdftotext-Ausgabe von testdaten/Eingang/2026-10-02_Elbtal-Getraenke_RE-24117.pdf (gekürzt)
const elbtal = [
  'Elbtal Getränke GmbH',
  'Industriestraße 12 · 01129 Dresden · USt-IdNr. DE298765432',
  'B&B Eventagentur Rechnungs-Nr.: RE-24117',
  'Lager / Warenannahme Rechnungsdatum: 02.10.2026',
  '01099 Dresden Lieferdatum: 02.10.2026',
  'Rechnung',
  'Pos Art.-Nr. Bezeichnung Menge Einheit Einzelpreis Gesamt',
  '1 10020 Elbtaler Pils Kiste 20x0,5l 12 Kiste 14,90 178,80',
  '2 10031 Elbtaler Radler Kiste 20x0,5l 4 Kiste 15,40 61,60',
  '3 20110 Cola Kiste 24x0,33l 6 Kiste 16,80 100,80',
  'Summe netto 341,20',
  'zzgl. 19% MwSt. 64,83',
  'Gesamtbetrag EUR 406,03',
];

test('Lieferantenrechnung (PDF-Text)', () => {
  const r = P.parseTextDoc(elbtal, 'B&B');
  assert.equal(r.party, 'Elbtal Getränke GmbH');
  assert.equal(r.number, 'RE-24117');
  assert.equal(r.date, '2026-10-02');
  assert.equal(r.items.length, 3, 'Summenzeilen dürfen keine Positionen werden');
  assert.deepEqual(
    { art: r.items[0].art, desc: r.items[0].desc, qty: r.items[0].qty, unit: r.items[0].unit, price: r.items[0].price, total: r.items[0].total },
    { art: '10020', desc: 'Elbtaler Pils Kiste 20x0,5l', qty: 12, unit: 'Kiste', price: 14.9, total: 178.8 });
});

test('Ausgangsrechnung: Kunde statt eigener Firma, Artikelnummer mit Bindestrich', () => {
  const lines = [
    'B&B Eventagentur',
    'Lager / Warenannahme · 01099 Dresden · USt-IdNr. DE355667788',
    'Familie Krause Rechnungs-Nr.: AR-2026-041',
    'Am Lindenhof 3 Rechnungsdatum: 12.10.2026',
    '01465 Dresden-Langebrück Lieferdatum: 12.10.2026',
    'Rechnung',
    'Pos Art.-Nr. Bezeichnung Menge Einheit Einzelpreis Gesamt',
    '3 BB-RS Riesling trocken 0,75l 18 Fl 24,00 432,00',
  ];
  const r = P.parseTextDoc(lines, 'B&B');
  assert.equal(r.party, 'Familie Krause');
  assert.equal(r.items[0].art, 'BB-RS');
  assert.equal(r.items[0].desc, 'Riesling trocken 0,75l');
});

test('OCR ohne Mengenspalte: Menge aus Gesamt / Einzelpreis', () => {
  const it = P.parseItemLine('K-120 Café Crema Bohnen 1kg Pck 19,90 59,70');
  assert.equal(it.qty, 3);
  assert.equal(it.unit, 'Pck');
  assert.equal(it.calc, true);
});

test('CSV-Lieferliste', () => {
  const csv = '﻿Lieferant;Belegnummer;Datum;Artikelnummer;Bezeichnung;Menge;Einheit;Einzelpreis;Gesamt\n' +
              'Gastro-Großhandel Sachsen;LS-88120;23.10.2026;G-5501;Gin London Dry 0,7l;6;Fl;14,90;89,40\n';
  const r = P.parseCsv(csv);
  assert.equal(r.party, 'Gastro-Großhandel Sachsen');
  assert.equal(r.number, 'LS-88120');
  assert.equal(r.date, '2026-10-23');
  assert.equal(r.items[0].qty, 6);
  assert.equal(r.items[0].price, 14.9);
});
