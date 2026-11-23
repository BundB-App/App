// Startseite: „Schnell buchen Personal“ ersetzt durch Schnellsuche Verfügbarkeit von Leistungen (v68).
import { assert, ok, device, noHScroll, done, seedRealData, OUT } from './harness.mjs';
import { join } from 'node:path';

seedRealData();
const A = await device(); const pa = A.page;
const fabs = await pa.$$eval('#fabs .fab', b => b.filter(x => x.offsetParent).map(x => x.innerText.replace(/\s+/g, ' ').trim().toLowerCase()));
assert.deepEqual(fabs, ['± schnell buchen lager', '⌕ schnell suchen verfügbarkeit']); ok('Startseite: Schnell buchen Lager + Schnell suchen Verfügbarkeit (Personal-Knopf weg)');
const grill = await pa.evaluate(() => live('articles').find(a => a.name === 'Gas Grill').id);
const total = await pa.evaluate(g => rvOwned()[g] || 0, grill);
await pa.evaluate(g => { for (const [n, take] of [['Fest A', true], ['Fest B', false]]) { const e = put('ekEvents', { id: uid(), name: n, date: '2026-12-12', from: '2026-12-11', to: '2026-12-13', party: '', offerNo: '', file: '', note: '' });
  put('ekLines', { id: uid(), eventId: e.id, desc: '', qty: 1, unit: '', articleId: g, how: 'manuell', src: 'reserv', pos: 1 }); if (take) rvTake(e.id); } persist(); }, grill);
await pa.click('[data-act=avOpen]'); await pa.fill('#av-q', 'gas grill');
const row = () => pa.textContent('.av-row:has-text("Gas Grill")');
assert.match(await row(), new RegExp(`${total} von ${total} frei`)); ok(`Heute: Gas Grill ${total} von ${total} frei`);
await pa.fill('#av-from', '2026-12-12'); await pa.dispatchEvent('#av-from', 'change'); await pa.waitForTimeout(100);
assert.equal(await pa.inputValue('#av-to'), '2026-12-12');
const r = await row(); console.log('  ', r.replace(/\s+/g, ' ').trim());
assert.match(r, new RegExp(`${total - 1} von ${total} frei`)); assert.match(r, /1 entnommen bei „Fest A“/); assert.match(r, /1 geplant bei „Fest B“/);
ok('12.12.: Entnahme von Fest A abgezogen, Fest B als „geplant“ angezeigt');
await pa.fill('#av-from', '2026-12-20'); await pa.dispatchEvent('#av-from', 'change'); await pa.fill('#av-to', '2026-12-22'); await pa.dispatchEvent('#av-to', 'change'); await pa.waitForTimeout(100);
assert.match(await row(), new RegExp(`${total} von ${total} frei`)); ok('20.–22.12. (anderer Zeitraum): wieder alles frei');
await pa.fill('#av-q', ''); await pa.waitForTimeout(100); assert.ok(await pa.$$eval('.av-row', r => r.length) > 50); ok('Ohne Suchwort: alle Leistungen mit Bestand');
await pa.keyboard.press('Escape'); assert.equal(await pa.$('.av-row'), null); ok('Escape schließt');
const B = await device({ viewport: { width: 390, height: 844 }, scheme: 'dark' }); const pb = B.page;
await pb.screenshot({ path: join(OUT, 'schnellsuche_home_iphone.png') });
await pb.click('[data-act=avOpen]'); await pb.fill('#av-q', 'faltzelt'); await noHScroll(pb);
await pb.screenshot({ path: join(OUT, 'schnellsuche_iphone.png') }); ok('iPhone: Suche passt');
await done();
