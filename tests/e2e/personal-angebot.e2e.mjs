// Personal: „+ Event“ → „Angebot einlesen“ übernimmt Name und Leistungsdatum ins neue Event (v62).
import { assert, ok, device, syncNow, pickFile, noHScroll, done, seedRealData, files, BASE, DBXDIR, OUT } from './harness.mjs';
import { join } from 'node:path';

seedRealData();
const A187 = DBXDIR + 'Angebote/2026/A_187_Karnevalsverein Langebrück e.V..pdf';
const A = await device(); const pa = A.page;
const evBefore = await pa.evaluate(() => live('events').length);
await pa.click('.module[data-go="personal"]'); await pa.click('[data-act=pAddEvent]');
const bar = await pa.$$eval('#pEventForm .save-bar button', b => b.map(x => `${x.textContent.trim()}|${x.className}`));
assert.deepEqual(bar, ['Angebot einlesen|btn', 'Anlegen|btn primary', 'Abbrechen|btn']); ok('Formular: Angebot einlesen | Anlegen (grün) | Abbrechen');
await pickFile(pa, '[data-act=peOffer]', A187);
await pa.waitForFunction(() => $('#pe-name').value === 'Karneval Auftakt', null, { timeout: 30000 });
assert.equal(await pa.inputValue('#pe-from'), '2026-11-14'); assert.equal(await pa.inputValue('#pe-to'), '');
ok('Name „Karneval Auftakt“ und Datum 14.11.2026 übernommen');
await pa.screenshot({ path: join(OUT, 'personal-angebot_mac.png') });
await pa.click('#pe-cats [data-act=peAddCat][data-id]'); assert.equal(await pa.$$eval('#pe-days .pday', d => d.length), 1); ok('Nach Wahl der Kategorie: ein Tag (14.11.)');
await pa.click('#pEventForm button[type=submit]');
await pa.waitForFunction(n => live('events').length === n + 1, evBefore);
const ev = await pa.evaluate(() => { const e = live('events').sort((a, b) => b.updatedAt - a.updatedAt)[0]; return [e.name, daysOf(e).map(d => d.date).join(',')]; });
assert.deepEqual(ev, ['Karneval Auftakt', '2026-11-14']); ok('Event angelegt: Karneval Auftakt am 14.11.2026');
assert.equal(await pa.evaluate(() => live('ekEvents').length), 0); ok('Personal bleibt getrennt: keine Veranstaltung unter Einkauf angelegt');
await syncNow(pa); assert.ok(files.get(BASE + 'personal.json').body.toString().includes('Karneval Auftakt')); ok('In personal.json gespeichert');
// Bearbeiten zeigt den Knopf nicht
await pa.evaluate(() => { const e = live('events').sort((a, b) => b.updatedAt - a.updatedAt)[0]; pEventId = e.id; view = 'pEvent'; pEditEvent = true; render(); });
assert.equal(await pa.$('[data-act=peOffer]'), null); ok('Beim Bearbeiten eines Events kein Einlese-Knopf');
const B = await device({ viewport: { width: 390, height: 844 }, scheme: 'dark' }); const pb = B.page;
await pb.click('.module[data-go="personal"]'); await pb.click('[data-act=pAddEvent]'); await noHScroll(pb);
await pb.locator('#pEventForm .save-bar').screenshot({ path: join(OUT, 'personal-angebot_iphone.png') }); ok('iPhone: Knopfleiste passt');
await done();
