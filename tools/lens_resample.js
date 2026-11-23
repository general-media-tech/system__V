#!/usr/bin/env node
/* tools/lens_resample.js — بعد تغيير إسقاط العدسة (VER) تُعاد بصمات عيّنات التعلّم (gmt_lens_samples) من صورها المصغّرة المحفوظة
   فلا يضيع ما تعلّمته العدسة من اختيارات المالك والموظّفين والعقل (TASK-A0580 · seq A1025).
   الاستعمال: (python3 -m http.server 8765 --bind 127.0.0.1 &) ; node tools/lens_resample.js [--dry] */
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..'), DRY = process.argv.includes('--dry');
function cfg() { const t = fs.readFileSync(path.join(ROOT, 'gmt-config.js'), 'utf8'), b = t.slice(t.indexOf('MAIN:'), t.indexOf('MAIN:') + 900); return { url: /url\s*:\s*'([^']+)'/.exec(b)[1], key: /key\s*:\s*'([^']+)'/.exec(b)[1] }; }
(async () => {
  const { url, key } = cfg(), H = { apikey: key, Authorization: 'Bearer ' + key };
  const rows = await (await fetch(url + '/rest/v1/gmt_lens_samples?select=id,product_name,vec,thumb&thumb=not.is.null&order=id.asc', { headers: H })).json();
  const b = await chromium.launch(), pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8765/robots.txt').catch(() => {});
  await pg.addScriptTag({ url: 'http://127.0.0.1:8765/gmt-lens-local.js?r=' + Date.now() });
  await pg.evaluate(() => Promise.all([GMTLensLocal.loadModel(), GMTLensLocal.loadIndex()]).then(() => true));
  let n = 0;
  for (const r of rows) {
    if (String(r.vec || '').startsWith((await pg.evaluate(() => GMTLensLocal.VER)) + ':')) continue;
    const v = await pg.evaluate(async (src) => { const im = await new Promise(ok => { const x = new Image(); x.onload = () => ok(x); x.onerror = () => ok(null); x.src = src; }); if (!im) return null; const q = await GMTLensLocal.embed(im, 'full'); return q ? GMTLensLocal.pack(q) : null; }, r.thumb);
    if (!v) { console.log('✗', r.id, r.product_name); continue; }
    if (!DRY) { const p = await fetch(url + '/rest/v1/gmt_lens_samples?id=eq.' + r.id, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, H), body: JSON.stringify({ vec: v }) }); if (!p.ok) { console.log('✗ PATCH', r.id, p.status); continue; } }
    n++; console.log('✓', r.id, r.product_name, v.slice(0, 12));
  }
  await b.close(); console.log('أُعيدت بصمات', n, 'عيّنة' + (DRY ? ' (تجربة)' : ''));
})();
