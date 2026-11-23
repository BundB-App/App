// iPhone: Kein Hineinzoomen beim Antippen von Feldern (v69). Safari zoomt bei Schrift < 16 px, also müssen alle Felder ≥ 16 px sein.
import { assert, ok, device, noHScroll, done, seedRealData, OUT } from './harness.mjs';
import { join } from 'node:path';

seedRealData({ einkaufJson: true });
const small = page => page.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea')]
  .filter(el => el.offsetParent).map(el => [el.id || el.className || el.dataset.edit || el.name || el.type, parseFloat(getComputedStyle(el).fontSize)]).filter(([, f]) => f < 16));
const check = async (page, name) => { const s = await small(page); assert.deepEqual(s, [], `${name}: Felder unter 16 px: ${JSON.stringify(s)}`); await noHScroll(page); };

const A = await device({ viewport: { width: 390, height: 844 }, touch: true }); const p = A.page;
const views = [];
// Startseite: Schnellsuche und Schnellbuchung
await p.click('[data-act=avOpen]'); await check(p, 'Schnellsuche'); views.push('Schnellsuche'); await p.keyboard.press('Escape');
await p.click('[data-act=qbOpen]'); await check(p, 'Schnell buchen'); views.push('Schnell buchen'); await p.click('[data-act=qbClose]');
// Lager
await p.click('[data-go="lager"]'); await check(p, 'Bestand'); views.push('Bestand');
await p.fill('#search', 'gas grill'); await p.click('.item:has-text("Gas Grill") button.head'); await check(p, 'Artikel-Detail'); views.push('Artikel-Detail');
await p.fill('#search', '');
for (const [tab, open, name] of [['reserv', true, 'Reservierung'], ['einkauf', true, 'Einkauf'], ['packliste', true, 'Packliste'], ['setup', false, 'Einstellungen']]) {
  await p.click(`#tabs [data-go="${tab}"]`); await check(p, name + ' (Liste)');
  if (open) { await p.evaluate(() => document.querySelectorAll('details.grp').forEach(d => d.open = true)); const c = await p.$('.item-card'); if (c) { await c.click(); await check(p, name); } }
  views.push(name);
}
await p.evaluate(() => { view = 'inventur'; render(); }); await check(p, 'Inventur'); views.push('Inventur');
// Personal
await p.evaluate(() => { view = 'personal'; render(); }); await check(p, 'Personal'); await p.click('[data-act=pAddEvent]'); await check(p, 'Neues Event'); views.push('Personal, neues Event');
await p.evaluate(() => { pAddEvent = false; peRoles = null; const e = live('events')[0]; if (e) { pEventId = e.id; view = 'pEvent'; } render(); }); await check(p, 'Event'); views.push('Personal-Event');
await p.evaluate(() => { view = 'pPersonen'; render(); }); await check(p, 'Personen'); views.push('Personen');
await p.screenshot({ path: join(OUT, 'kein-zoom_iphone.png') });
ok('iPhone: alle Eingabefelder mindestens 16 px, kein seitliches Scrollen in: ' + views.join(', '));
// Mac bleibt wie bisher
const M = await device(); await M.page.click('[data-go="lager"]');
assert.equal(await M.page.$eval('#search', el => getComputedStyle(el).fontSize), '15px'); ok('Mac: Felder unverändert 15 px');
await done();
