// Angebote per Dateiauswahl einlesen (v61): in Einkauf und Reservierungen, neue und vorhandene Veranstaltung, nie doppelt.
import { assert, ok, device, syncNow, pickFile, noHScroll, done, seedRealData, putF, files, BASE, liveOf, lager, einkauf, OUT, DBXDIR } from './harness.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const personalBefore = seedRealData();
const A187 = DBXDIR + 'Angebote/2026/A_187_Karnevalsverein Langebrück e.V..pdf';
putF('/Apps/BundB App/Angebote/Liegt_im_Ordner.pdf', readFileSync(A187));   // Ordner-Prüfung ist abgeschaltet: darf nicht angefasst werden
const copy = join(OUT, 'Kopie anderer Name.pdf'); writeFileSync(copy, readFileSync(A187));
const csv = join(OUT, 'A300.csv'); writeFileSync(csv, 'Bezeichnung;Menge;Einheit;Einzelpreis;Gesamt;Kunde;Angebotsnr;Datum\r\nFaltzelt creme 3x3m;2;Stück;80,00;160,00;Kunde Q;A-300;01.11.2026\r\nCoca Cola 12 x 1l;3;Kästen;15,96;47,88;;;\r\n');

const A = await device(); const pa = A.page;
await pa.waitForTimeout(1500);
assert.equal(await pa.evaluate(() => live('ekEvents').length), 0); assert.ok(files.has(BASE + 'angebote/liegt_im_ordner.pdf')); ok('Kein automatisches Einlesen mehr aus Dropbox/Angebote, Datei bleibt liegen');

// Einkauf: neues Angebot per Dateiauswahl
await pa.click('[data-go="lager"]'); await pa.click('#tabs [data-go="einkauf"]');
assert.equal(await pa.$('[data-act=ekScan]'), null); ok('„Jetzt prüfen“ ist weg');
const nFiles = files.size;
await pickFile(pa, '[data-act=ekImportNew]', A187);
await pa.waitForFunction(() => view === 'ekEvent' && live('ekEvents').length === 1, null, { timeout: 30000 });
const ev = await pa.evaluate(() => { const e = ES.ekEvents[ekId]; return { name: e.name, date: e.date, from: e.from, to: e.to, no: e.offerNo, file: e.file, n: ekLinesOf(e.id).length, open: ekOpenCount(e.id) }; });
console.log('  ', JSON.stringify(ev));
assert.equal(ev.name, 'Karneval Auftakt'); assert.equal(ev.no, 'A-187'); assert.equal(ev.n, 19); assert.equal(ev.from, '2026-11-13'); assert.equal(ev.to, '2026-11-15');
ok('Einkauf → Angebot einlesen: Veranstaltung „Karneval Auftakt“ angelegt und geöffnet (19 Positionen, Mietzeitraum 13.–15.11.)');
await syncNow(pa); assert.equal([...files.keys()].filter(k => k.includes('/angebote/')).length, 1); ok('Keine Kopie des Angebots in der Dropbox abgelegt');

// gleiches Angebot noch einmal, auch mit anderem Dateinamen und aus Reservierungen
await pa.click('a.back'); await pickFile(pa, '[data-act=ekImportNew]', A187);
await pa.waitForFunction(() => /schon eingelesen/.test(document.querySelector('#toast').textContent), null, { timeout: 30000 });
assert.equal(await pa.evaluate(() => live('ekEvents').length), 1); assert.equal(await pa.evaluate(() => view), 'ekEvent'); ok('Gleiches Angebot erneut: nichts doppelt, vorhandene Veranstaltung geöffnet');
await pa.click('#tabs [data-go="reserv"]'); await pickFile(pa, '[data-act=ekImportNew]', copy);
await pa.waitForFunction(() => view === 'rvEvent', null, { timeout: 30000 });
assert.equal(await pa.evaluate(() => live('ekEvents').length), 1); assert.match(await pa.textContent('h1'), /Karneval Auftakt/); ok('Reservierungen → Angebot einlesen (Kopie, anderer Name): gleiche Veranstaltung geöffnet');

// manuell angelegte Veranstaltung, dann Angebot einlesen
await pa.click('a.back'); await pa.click('[data-act=ekNew]'); await pa.fill('#ek-name', 'Sommerfest Q'); await pa.fill('#ek-date', '2026-12-05'); await pa.click('#ekForm button[type=submit]');
await pickFile(pa, '[data-act=ekReadOffer]', csv);
await pa.waitForFunction(() => ekLinesOf(rvId).length === 2, null, { timeout: 20000 });
const m = await pa.evaluate(() => { const e = ES.ekEvents[rvId]; return [e.name, e.date, e.offerNo, rvCalc(e.id).rows.map(r => r.a.name + ':' + r.need).join(',')]; });
assert.deepEqual(m.slice(0, 3), ['Sommerfest Q', '2026-12-05', 'A-300']); assert.equal(m[3], 'Faltzelt creme 3x3m:2'); ok('Manuelle Veranstaltung + Angebot einlesen: Name/Datum bleiben, Faltzelt reserviert');
await pa.click('#tabs [data-go="einkauf"]'); assert.equal(await pa.$$eval('.item-card', c => c.length), 2); ok('Beide Veranstaltungen auch unter Einkauf');

// Einkauf, Packliste, PDF laufen weiter
await pa.click('.item-card:has-text("Karneval")');
const cola = await pa.evaluate(() => ekCalc(ekId).rows.find(r => /Coca Cola/.test(r.art.name)));
assert.ok(cola && cola.needText === '5 Kästen'); await pa.click('[data-act=ekPdf]'); await pa.waitForSelector('[data-act=ekDownload]', { timeout: 15000 });
assert.ok([...files.keys()].some(k => k.startsWith(BASE + 'einkauf/') && k.endsWith('.pdf'))); ok('Einkaufsliste + PDF wie bisher');
await pa.click('#tabs [data-go="packliste"]'); await pa.click('.item-card:has-text("Karneval")');
assert.ok(await pa.evaluate(() => pkCalc(pkId).list.length > 10)); ok('Packliste wie bisher');

// iPhone
const B = await device({ viewport: { width: 390, height: 844 }, scheme: 'dark' }); const pb = B.page; await pb.waitForTimeout(500); await syncNow(pb);
await pb.click('[data-go="lager"]'); await pb.click('#tabs [data-go="einkauf"]'); await noHScroll(pb);
assert.ok(await pb.isVisible('[data-act=ekImportNew]')); await pb.screenshot({ path: join(OUT, 'angebot-datei_iphone.png') });
await pb.click('#tabs [data-go="reserv"]'); await noHScroll(pb); ok('iPhone: Knopf „Angebot einlesen“ in Einkauf und Reservierungen, kein seitliches Scrollen');
// Löschen einer Veranstaltung fasst das Angebot nicht an (auch alte Veranstaltung mit Pfad im Dropbox-Ordner)
putF('/Apps/BundB App/Angebote/2026/Alt.pdf', 'x'); const before = [...files.keys()].sort().join('|');
await pa.evaluate(() => { const e = put('ekEvents', { id: uid(), name: 'Alt', date: '2026-12-24', party: '', offerNo: 'A-1', file: '/Apps/BundB App/Angebote/2026/Alt.pdf', note: '' }); persist(); rvId = e.id; view = 'rvEvent'; render(); });
await pa.click('[data-act=ekDel]'); await pa.click('[data-act=ekDel]'); await pa.waitForTimeout(500); await syncNow(pa);
assert.deepEqual([...files.keys()].filter(k => k.includes('/angebote/')).sort(), before.split('|').filter(k => k.includes('/angebote/'))); ok('Veranstaltung gelöscht: Angebotsdatei bleibt unverändert liegen');
assert.equal(files.get(BASE + 'personal.json').body.toString(), personalBefore); ok('personal.json unverändert');
await done();
