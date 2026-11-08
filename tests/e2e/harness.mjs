// UI-Tests mit Playwright: index.html im Browser, Dropbox simuliert (Dateien im Speicher), CDN-Bibliotheken aus .cache.
// Einrichtung einmalig:  cd tests/e2e && npm install && npx playwright install chromium
// Start:                 node tests/e2e/<name>.e2e.mjs
// Echte Daten (nur lesend): lager.json, personal.json und ein Angebot aus der Dropbox von Thomas.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
export { assert };

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');
export const DBXDIR = process.env.BB_DROPBOX || join(process.env.HOME, 'Library/CloudStorage/Dropbox/Apps/BundB App') + '/';
export const OUT = join(HERE, '.cache', 'out'); mkdirSync(OUT, { recursive: true });
const CACHE = join(HERE, '.cache');
const LIBS = {
  'pdf.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'pdf.worker.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'jspdf.umd.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'xlsx.full.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
};
for (const [f, url] of Object.entries(LIBS)) {
  if (!existsSync(join(CACHE, f))) { const r = await fetch(url); if (!r.ok) throw new Error('Download ' + url); writeFileSync(join(CACHE, f), Buffer.from(await r.arrayBuffer())); }
}
export const NEW = readFileSync(join(ROOT, 'index.html'), 'utf8');

// ---------- simulierte Dropbox
export const BASE = '/apps/bundb app/';
export const files = new Map(); let revN = 1;
export const putF = (path, body) => files.set(path.toLowerCase(), { name: path.split('/').pop(), display: path, body: Buffer.from(body), rev: 'r' + (revN++) });
export const lager = () => JSON.parse(files.get(BASE + 'lager.json').body.toString());
export const einkauf = () => { const f = files.get(BASE + 'einkauf.json'); return f ? JSON.parse(f.body.toString()) : null; };
export const liveOf = (st, c) => Object.values(st[c] || {}).filter(o => !o.deleted);
export const errors = [];
export const ok = msg => console.log('✔ ' + msg);

/** Startdaten: echte lager.json/personal.json; optional einkauf.json leer */
export function seedRealData({ einkaufJson = false } = {}) {
  putF('/Apps/BundB App/lager.json', readFileSync(DBXDIR + 'lager.json'));
  putF('/Apps/BundB App/personal.json', readFileSync(DBXDIR + 'personal.json'));
  if (einkaufJson && existsSync(DBXDIR + 'einkauf.json')) putF('/Apps/BundB App/einkauf.json', readFileSync(DBXDIR + 'einkauf.json'));
  return readFileSync(DBXDIR + 'personal.json', 'utf8');
}

async function routes(ctx, html) {
  await ctx.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (url.startsWith('http://app.test/')) return /sw\.js|manifest|icon/.test(url) ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ contentType: 'text/html', body: html });
    for (const f of Object.keys(LIBS)) if (url.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: readFileSync(join(CACHE, f)) });
    if (url.includes('api.dropboxapi.com/oauth2/token')) return route.fulfill({ json: { access_token: 'tok', expires_in: 14400 } });
    if (url.includes('api.dropboxapi.com/2/')) {
      const ep = url.split('/2/')[1]; const b = JSON.parse(req.postData() || '{}');
      if (ep === 'files/list_folder') {
        const dir = b.path.toLowerCase().replace(/\/$/, '') + '/';
        const entries = [...files.entries()].filter(([k]) => k.startsWith(dir) && !k.slice(dir.length).includes('/'))
          .map(([k, f]) => ({ '.tag': 'file', name: f.name, path_lower: k, path_display: f.display, rev: f.rev }));
        const subs = new Map(); for (const [k, f] of files) if (k.startsWith(dir) && k.slice(dir.length).includes('/')) { const n = k.slice(dir.length).split('/')[0]; subs.set(n, f.display.split('/').slice(0, dir.split('/').length).join('/')); }
        for (const [n, disp] of subs) entries.push({ '.tag': 'folder', name: disp.split('/').pop(), path_lower: dir + n, path_display: disp });
        return route.fulfill({ json: { entries, has_more: false } });
      }
      if (ep === 'files/get_metadata') { const f = files.get(b.path.toLowerCase()); return f ? route.fulfill({ json: { rev: f.rev } }) : route.fulfill({ status: 409, json: { error_summary: 'path/not_found/' } }); }
      if (ep === 'files/move_v2') { const f = files.get(b.from_path.toLowerCase()); if (!f) return route.fulfill({ status: 409, json: { error_summary: 'from_lookup/not_found/' } }); files.delete(b.from_path.toLowerCase()); putF(b.to_path, f.body); return route.fulfill({ json: { metadata: { path_display: b.to_path } } }); }
      return route.fulfill({ json: {} });
    }
    if (url.includes('content.dropboxapi.com/2/files/download')) {
      const arg = JSON.parse(req.headers()['dropbox-api-arg']); const f = files.get(arg.path.toLowerCase());
      if (!f) return route.fulfill({ status: 409, body: '{"error_summary":"path/not_found/"}' });
      return route.fulfill({ body: f.body, headers: { 'Dropbox-API-Result': JSON.stringify({ rev: f.rev }), 'Access-Control-Expose-Headers': 'Dropbox-API-Result' } });
    }
    if (url.includes('content.dropboxapi.com/2/files/upload')) {
      const arg = JSON.parse(req.headers()['dropbox-api-arg']); const k = arg.path.toLowerCase(); const cur = files.get(k); const m = arg.mode;
      if (m && m['.tag'] === 'update' && (!cur || cur.rev !== m.update)) return route.fulfill({ status: 409, body: '{"error_summary":"path/conflict/file/"}' });
      if (m && m['.tag'] === 'add' && cur) return route.fulfill({ status: 409, body: '{"error_summary":"path/conflict/file/"}' });
      let path = arg.path; if (m === 'add' && cur) path = path.replace(/(\.\w+)$/, ' (1)$1');
      putF(path, req.postDataBuffer()); const f = files.get(path.toLowerCase());
      return route.fulfill({ json: { rev: f.rev, path_display: path } });
    }
    if (/fonts\.(googleapis|gstatic)/.test(url)) return route.fulfill({ body: '' });
    return route.abort();
  });
}
export const browser = await chromium.launch();
/** Ein Gerät (eigener Browser-Kontext mit eigenem localStorage), mit Dropbox verbunden und synchronisiert */
export async function device({ html = NEW, origin = 'http://app.test/', viewport, scheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 }, colorScheme: scheme });
  await routes(ctx, html);
  await ctx.addInitScript(cfg => { if (!localStorage.getItem('bb-lager-cfg-v1')) localStorage.setItem('bb-lager-cfg-v1', cfg); },
    JSON.stringify({ appKey: 'k', base: '/Apps/BundB App', refresh: 'r', access: 'tok', accessExp: Date.now() + 3e6, lastSync: 1, ownName: 'B&B' }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(origin + ' ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(origin + ' console: ' + m.text()); });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#sync')?.dataset.s === 'ok', null, { timeout: 15000 });
  return { ctx, page };
}
export const syncNow = async page => { await page.evaluate(() => sync()); await page.waitForFunction(() => document.querySelector('#sync').dataset.s === 'ok'); };
export const noHScroll = async page => { const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(w[0] <= w[1], 'horizontal scroll ' + w); };
/** Datei über den nächsten Datei-Dialog auswählen, den ein Klick auf selector öffnet */
export async function pickFile(page, selector, path) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(selector)]);
  await fc.setFiles(path);
}
export async function done() {
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : '✔ keine JS-Fehler');
  await browser.close(); if (errors.length) process.exit(1);
}
