#!/usr/bin/env node
/* tools/lens_index_build.js — يبني lens-index.json لـ«العدسة الذكيّة 2.0» (TASK-A0580 · seq 979 · 1001).
   ① بصمة كلّ صورة منتج بالعين المحلّية (lib/lens-model) — بالكود نفسه الذي يعمل على الجهاز (gmt-lens-local.js) داخل Chromium
   ② tools/lens_index_pca.py يضغطها إلى ١٢٨ بُعداً ويكتب الفهرس
   الاستعمال (من جذر المستودع):
     (python3 -m http.server 8765 --bind 127.0.0.1 &) ; node tools/lens_index_build.js [--max 3] && python3 tools/lens_index_pca.py
   صور الموقع (…/system__V/img/…) تُقرأ من الملفّات المحلّية؛ صور التخزين تُجلب من الشبكة. الناتج الخام: .lens_raw/ (لا يُرفع) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const MAX = +(process.argv[process.argv.indexOf('--max') + 1] || 0) || 3;
function cfg() {
  const t = fs.readFileSync(path.join(ROOT, 'gmt-config.js'), 'utf8');
  const blk = t.slice(t.indexOf('MAIN:'), t.indexOf('MAIN:') + 900);
  return { url: /url\s*:\s*'([^']+)'/.exec(blk)[1], key: /key\s*:\s*'([^']+)'/.exec(blk)[1] };
}
(async () => {
  const { url, key } = cfg();
  const r = await fetch(url + '/rest/v1/products?select=id,image_url,images&limit=5000', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  const prods = await r.json();
  const jobs = [];
  for (const p of prods) {
    const urls = [p.image_url].concat(Array.isArray(p.images) ? p.images : []).filter(u => typeof u === 'string' && u).filter((u, i, a) => a.indexOf(u) === i).slice(0, MAX);
    urls.forEach(u => jobs.push([String(p.id), u]));
  }
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8765/robots.txt').catch(() => {});
  await pg.addScriptTag({ url: 'http://127.0.0.1:8765/gmt-lens-local.js?b=' + Date.now() });
  console.log('backend:', await pg.evaluate(() => GMTLensLocal.loadModel().then(() => tf.getBackend())));
  const outDir = path.join(ROOT, '.lens_raw'); fs.mkdirSync(outDir, { recursive: true });
  const ids = [], bufs = []; let ok = 0, bad = 0;
  for (let i = 0; i < jobs.length; i += 12) {
    const part = jobs.slice(i, i + 12).map(([id, u]) => { const m = /\/system__V\/(img\/.+)$/.exec(u); return [id, m ? 'http://127.0.0.1:8765/' + m[1] : u]; });
    const res = await pg.evaluate(async (part) => {
      const out = [];
      for (const [id, src] of part) {
        const im = await new Promise(ok => { const x = new Image(); x.crossOrigin = 'anonymous'; const t = setTimeout(() => ok(null), 20000); x.onload = () => { clearTimeout(t); ok(x); }; x.onerror = () => { clearTimeout(t); ok(null); }; x.src = src; });
        if (!im) { out.push([id, null]); continue; }
        try { const v = await GMTLensLocal.embedRaw(im, 'catalog'); let s = ''; const u8 = new Uint8Array(v.buffer); for (let k = 0; k < u8.length; k++) s += String.fromCharCode(u8[k]); out.push([id, btoa(s)]); }
        catch (e) { out.push([id, null]); }
      }
      return out;
    }, part);
    for (const [id, x] of res) { if (x) { ids.push(id); bufs.push(Buffer.from(x, 'base64')); ok++; } else bad++; }
    process.stdout.write(`\r${Math.min(i + 12, jobs.length)}/${jobs.length} ✓${ok} ✗${bad}   `);
  }
  await b.close();
  fs.writeFileSync(path.join(outDir, 'raw.f32'), Buffer.concat(bufs));
  fs.writeFileSync(path.join(outDir, 'ids.json'), JSON.stringify(ids));
  console.log(`\n.lens_raw: ${ids.length} بصمة (${bad} تعذّرت) ⇒ python3 tools/lens_index_pca.py`);
})();
