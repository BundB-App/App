// Roter Hinweis am Menüpunkt Reservierungen bei Konflikten (v64), auch auf dem zweiten Gerät.
import { assert, ok, device, syncNow, noHScroll, done, seedRealData, OUT } from './harness.mjs';
import { join } from 'node:path';

seedRealData();
const A = await device(); const pa = A.page;
await pa.click('[data-go="lager"]');
const badge = p => p.$eval('#tabs [data-go="reserv"]', b => b.dataset.bad || '');
assert.equal(await badge(pa), ''); ok('Ohne Konflikt: kein Hinweis');
// zwei Veranstaltungen im selben Zeitraum brauchen den einzigen Gas Grill
const ids = await pa.evaluate(() => { const g = live('articles').find(a => a.name === 'Gas Grill').id, out = [];
  for (const n of ['Fest A', 'Fest B']) { const e = put('ekEvents', { id: uid(), name: n, date: '2026-11-21', from: '2026-11-20', to: '2026-11-22', party: '', offerNo: '', file: '', note: '' });
    put('ekLines', { id: uid(), eventId: e.id, desc: '', qty: stockMap()[g] || 1, unit: '', articleId: g, how: 'manuell', src: 'reserv', pos: 1 }); out.push(e.id); }
  persist(); render(); return out; });
assert.equal(await badge(pa), ''); ok('Beide nur geplant: noch kein roter Hinweis (orange „knapp“ in der Veranstaltung)');
await pa.evaluate(id => { rvTake(id); render(); }, ids[0]);
assert.equal(await badge(pa), '1'); assert.match(await pa.getAttribute('#tabs [data-go="reserv"]', 'title'), /1 Veranstaltung mit Konflikt/);
const shadow = await pa.$eval('#tabs [data-go="reserv"]', b => getComputedStyle(b).boxShadow); assert.match(shadow, /inset/);
await pa.locator('header').screenshot({ path: join(OUT, 'reserv-hinweis_mac.png') }); ok('Fest A entnimmt → Menüpunkt Reservierungen rot umrandet mit „1“');
await syncNow(pa);
const B = await device({ viewport: { width: 390, height: 844 }, scheme: 'dark' }); const pb = B.page;
await pb.click('[data-go="lager"]'); assert.equal(await badge(pb), '1'); await noHScroll(pb);
assert.ok(await pb.$$eval('#tabs button', b => b.every(x => x.scrollWidth <= x.clientWidth + 1)));
await pb.locator('#tabs').screenshot({ path: join(OUT, 'reserv-hinweis_iphone.png') }); ok('iPhone sieht den Hinweis auch, Menüleiste passt');
await pa.evaluate(id => { rvUntake(id, true); render(); }, ids[0]); assert.equal(await badge(pa), ''); ok('Konflikt gelöst (Entnahme zurückgenommen): Hinweis weg');
await done();
