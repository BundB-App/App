// Backup (v63): automatisch beim Öffnen, Anzahl begrenzen, Wiederherstellen für alle Geräte, Programm als ZIP.
import { assert, ok, device, syncNow, noHScroll, done, seedRealData, putF, files, BASE, liveOf, lager, einkauf, OUT } from './harness.mjs';
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

seedRealData({ einkaufJson: true });
const BK = '/bundb app backup/';
const backups = () => [...files.keys()].filter(k => k.startsWith(BK)).sort();
const regular = () => backups().filter(k => /\/backup_\d{4}-\d{2}-\d{2}_\d{4,6}\.json$/.test(k));

// 0) Standard: aus. Ohne Einschalten kein Backup
const Z = await device(); await Z.page.waitForTimeout(2500); assert.equal(backups().length, 0);
await Z.page.click('[data-go="lager"]'); await Z.page.click('#tabs [data-go="setup"]');
assert.equal(await Z.page.isChecked('#bk-on'), false); assert.equal(await Z.page.$('[data-act=bkNow]'), null); ok('Standard: Backup aus, kein Backup angelegt, nur der Schalter sichtbar');
await Z.page.check('#bk-on'); await Z.page.waitForFunction(() => bkList && bkList.length === 1 && !bkBusy, null, { timeout: 20000 });
assert.equal(regular().length, 1); ok('Einschalten: erstes Backup sofort angelegt'); files.delete(regular()[0]); await Z.ctx.close();
// 1) Automatisch beim Öffnen, außerhalb des geteilten Ordners (Gerät mit eingeschaltetem Backup)
const A = await device({ cfg: { bkOn: true } }); const pa = A.page;
await pa.waitForFunction(() => !bkBusy && bkList && bkList.length === 1, null, { timeout: 20000 });
assert.equal(regular().length, 1); assert.ok(!regular()[0].startsWith(BASE)); ok('Beim Öffnen automatisch gesichert: ' + files.get(regular()[0]).display);
const bk1 = JSON.parse(files.get(regular()[0]).body.toString());
assert.equal(bk1.kind, 'backup'); assert.ok(Object.keys(bk1.lager.articles).length >= 394 && bk1.personal.persons && bk1.einkauf.ekEvents); ok('Backup enthält Lager, Personal und Einkauf (' + Math.round(files.get(regular()[0]).body.length / 1000) + ' KB)');
// 2) Zweites Gerät desselben Kontos: nicht doppelt
const B = await device({ viewport: { width: 390, height: 844 }, scheme: 'dark', cfg: { bkOn: true } }); const pb = B.page;
await pb.waitForTimeout(2500); assert.equal(regular().length, 1); ok('Zweites Gerät (iPhone): kein doppeltes Backup, wöchentlich noch nicht fällig');

// 3) Fälligkeit und Aufräumen: 15 alte wöchentliche Backups, behalten 13
files.delete(regular()[0]);
const day = n => { const d = new Date(Date.now() - n * 864e5); const z = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_0900`; };
for (let i = 1; i <= 15; i++) putF(`/BundB App Backup/Backup_${day(i * 7 + 1)}.json`, JSON.stringify(bk1));
putF('/BundB App Backup/Backup_2020-01-01_0000_vor-Wiederherstellung.json', '{}');
await pa.evaluate(() => { bkList = null; return bkAuto(); });
assert.equal(regular().length, 13); assert.ok(regular().at(-1).includes(new Date().getFullYear() + '')); assert.ok(!regular().some(k => k.includes(day(16 * 7 + 1).slice(0, 10))));
assert.ok(backups().some(k => k.includes('vor-wiederherstellung'))); ok('Fällig nach 8 Tagen: neues Backup, älteste gelöscht, 13 bleiben; „vor-Wiederherstellung“ bleibt');
await pa.evaluate(() => { CFG.bkInterval = 'month'; saveCfg(); bkList = null; }); const n0 = regular().length;
for (const k of regular().slice(-1)) files.delete(k); putF(`/BundB App Backup/Backup_${day(10)}.json`, JSON.stringify(bk1));
await pa.evaluate(() => bkAuto()); assert.equal(regular().length, n0); ok('Monatlich: Backup von vor 10 Tagen → noch nicht fällig');
await pa.evaluate(() => { CFG.bkInterval = 'day'; saveCfg(); bkList = null; return bkAuto(); }); assert.equal(regular().length, 13); ok('Täglich: fällig, gesichert und wieder auf 13 aufgeräumt');
await pa.evaluate(() => { CFG.bkInterval = 'week'; CFG.bkKeep = 13; saveCfg(); });

// 4) Panel in Einstellungen → Allgemein
await pa.click('[data-go="lager"]'); await pa.click('#tabs [data-go="setup"]');
const order = await pa.$$eval('#view h2', h => h.map(x => x.textContent.trim()));
assert.deepEqual(order.slice(0, 3), ['Allgemein', 'Backup', 'Darstellung auf diesem Gerät']); ok('Panel „Backup“ oben in Einstellungen → Allgemein');
assert.equal(await pa.inputValue('#bk-int'), 'week'); assert.equal(await pa.inputValue('#bk-keep'), '13'); assert.match(await pa.textContent('#view'), /etwa 3 Monate zurück/); ok('Voreinstellung: wöchentlich, 13 behalten (≈ 3 Monate)');
await pa.click('details:has-text("Backup einspielen") > summary');
assert.match(await pa.textContent('#view'), /Zum Bestätigen musst du unten WIEDERHERSTELLEN eintippen/); ok('Beschreibung nennt WIEDERHERSTELLEN');
await pa.screenshot({ path: join(OUT, 'backup_mac.png'), fullPage: true });

// 5) Wiederherstellen: Unfall simulieren (Artikel, Veranstaltung, Person gelöscht) und zurückholen
await pa.click('[data-act=bkNow]'); await pa.waitForFunction(() => !bkBusy); await syncNow(pa);
const ref = await pa.evaluate(() => ({ art: live('articles').find(a => a.name === 'Gas Grill').id, ev: live('ekEvents')[0]?.id, pers: live('persons')[0]?.id, nArt: live('articles').length, nEv: live('ekEvents').length, nP: live('persons').length }));
await pa.evaluate(r => { del('articles', r.art); if (r.ev) del('ekEvents', r.ev); if (r.pers) del('persons', r.pers); persist(); }, ref); await syncNow(pa); await syncNow(pb);
assert.equal(await pb.evaluate(() => live('articles').length), ref.nArt - 1); ok('Unfall: gelöschter Artikel/Veranstaltung/Person auch auf dem iPhone weg');
await pa.evaluate(() => render()); await pa.click('details:has-text("Backup einspielen") > summary');
await pa.click('[data-act=bkRestore]'); assert.match(await pa.textContent('#toast'), /WIEDERHERSTELLEN eintippen/); ok('Ohne Bestätigungswort passiert nichts');
await pa.fill('#bk-word', 'WIEDERHERSTELLEN'); await pa.evaluate(() => { $('#toast').textContent = ''; }); await pa.click('[data-act=bkRestore]');
await pa.waitForFunction(() => /Backup eingespielt/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 });
await syncNow(pb);
const after = await pb.evaluate(() => ({ nArt: live('articles').length, nEv: live('ekEvents').length, nP: live('persons').length }));
assert.deepEqual(after, { nArt: ref.nArt, nEv: ref.nEv, nP: ref.nP }); ok(`Wiederhergestellt, auch auf dem iPhone: ${after.nArt} Artikel, ${after.nEv} Veranstaltungen, ${after.nP} Personen`);
assert.ok(backups().some(k => /vor-wiederherstellung/.test(k) && !k.includes('2020'))); ok('Vorher automatisch „vor-Wiederherstellung“ gesichert');
// nur Lager wiederherstellen
await pa.evaluate(r => { del('articles', r.art); if (r.pers) del('persons', r.pers); persist(); }, ref);
await pa.evaluate(() => render()); await pa.click('details:has-text("Backup einspielen") > summary');
await pa.uncheck('.bk-part[value=personal]'); await pa.uncheck('.bk-part[value=einkauf]'); await pa.fill('#bk-word', 'wiederherstellen'); await pa.evaluate(() => { $('#toast').textContent = ''; }); await pa.click('[data-act=bkRestore]');
await pa.waitForFunction(() => /Backup eingespielt/.test(document.querySelector('#toast').textContent), null, { timeout: 20000 });
assert.ok(await pa.evaluate(r => !S.articles[r.art].deleted && (!r.pers || PS.persons[r.pers].deleted), ref)); ok('Nur „Lager“ gewählt: Artikel zurück, Personal unverändert');

// 6) Programm als ZIP
await pa.click('[data-act=bkProgram]'); await pa.waitForSelector('[data-act=bkProgDl]', { timeout: 15000 });
const zipKey = backups().find(k => /programm_v\d+_.*\.zip$/.test(k)); assert.ok(zipKey); const zp = join(OUT, 'programm.zip'); writeFileSync(zp, files.get(zipKey).body);
const list = execSync(`unzip -l "${zp}"`).toString(); assert.ok(['index.html', 'sw.js', 'manifest.webmanifest', 'icon-512.png'].every(f => list.includes(f)));
execSync(`cd "${OUT}" && rm -rf zipcheck && mkdir zipcheck && cd zipcheck && unzip -q ../programm.zip && cmp index.html "${join(process.cwd(), 'index.html')}"`);
ok(`Programm gesichert: ${files.get(zipKey).display} (${Math.round(files.get(zipKey).body.length / 1000)} KB), ZIP gültig, index.html identisch`);

// 7) iPhone
await pb.click('[data-go="lager"]'); await pb.click('#tabs [data-go="setup"]'); await noHScroll(pb);
await pb.locator('.panel:has(h2:text-is("Backup"))').screenshot({ path: join(OUT, 'backup_iphone.png') }); ok('iPhone: Panel passt');
await done();
