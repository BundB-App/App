// iPhone: Fenster (Schnellsuche, Schnell buchen) bleiben über der Tastatur sichtbar (v70).
// Die Tastatur wird simuliert: sichtbarer Bereich (visualViewport) 844 → 420 px hoch.
import { assert, ok, device, done, seedRealData, OUT } from './harness.mjs';
import { join } from 'node:path';

seedRealData();
const A = await device({ viewport: { width: 390, height: 844 }, touch: true }); const p = A.page;
const keyboard = h => p.evaluate(h => { const r = document.documentElement.style; r.setProperty('--vvh', h + 'px'); r.setProperty('--vvt', '0px'); document.body.classList.toggle('kb', h < 700); }, h);
const box = sel => p.$eval(sel, el => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; });
for (const [open, field, name] of [['[data-act=avOpen]', '#av-q', 'Schnellsuche'], ['[data-act=qbOpen]', '#qb-q', 'Schnell buchen']]) {
  await p.click(open); await p.focus(field);
  const sheetFull = await box('.qb'); assert.ok(sheetFull.bottom <= 844);
  await keyboard(420); await p.waitForTimeout(50);
  const sheet = await box('.qb'), inp = await box(field);
  assert.ok(sheet.bottom <= 420 && sheet.top >= 0, `${name}: Fenster ${JSON.stringify(sheet)}`); assert.ok(inp.bottom <= 420 && inp.top >= 0, `${name}: Feld ${JSON.stringify(inp)}`);
  await p.screenshot({ path: join(OUT, `tastatur_${name.replace(/\s/g, '_')}.png`), clip: { x: 0, y: 0, width: 390, height: 420 } });
  ok(`${name}: mit Tastatur (420 px sichtbar) Fenster ${sheet.top}–${sheet.bottom}, Eingabefeld ${inp.top}–${inp.bottom}: sichtbar`);
  // Buchstabe für Buchstabe tippen: das Feld darf nicht wandern (Fehlerbild: ab dem 2. Buchstaben rutschte es unter die Tastatur)
  const tops = [];
  for (const ch of 'faltzelt x') { await p.type(field, ch); await p.waitForTimeout(30); const b = await box(field); tops.push(b.top); assert.ok(b.bottom <= 420, `${name}: nach „${ch}“ Feld bei ${b.top}–${b.bottom}`); }
  assert.equal(new Set(tops).size, 1, `${name}: Feld wandert beim Tippen: ${tops}`); ok(`${name}: beim Tippen von „faltzelt x“ bleibt das Feld stehen (oben ${tops[0]} px)`);
  await keyboard(844); await p.keyboard.press('Escape'); if (await p.$('[data-act=qbClose]')) await p.click('[data-act=qbClose]');
}
await done();
