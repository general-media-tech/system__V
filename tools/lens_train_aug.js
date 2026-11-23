#!/usr/bin/env node
/* tools/lens_train_aug.js — تدريب «عين» العدسة على منتجاتنا نحن (TASK-A0580 · المالك seq A1016 «درّبها أنت … مثل عدسة جوجل»)
   لكلّ صورة منتج نولّد «لقطات موبايل» صناعيّة: خلفيات مختلفة (بما فيها صور منتجاتٍ أخرى كفوضى الرفّ) · ميلان ±18° · قرب/بعد · قصّ جزئيّ ·
   إضاءة وتباين وضبابيّة ⇒ بصمة خام لكلّ لقطة بالكود نفسه الذي على الجهاز (gmt-lens-local.js · وضع «shot»).
   الناتج .lens_raw/aug.f32 + aug_ids.json ⇒ tools/lens_index_pca.py --train يتعلّم إسقاطاً يجمع لقطات المنتج الواحد ويفرّق بين المنتجات (LDA منظَّم).
   الاستعمال: (python3 -m http.server 8765 --bind 127.0.0.1 &) ; node tools/lens_train_aug.js [--per 5] [--imgs 2] [--seed 1] [--out aug] */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHARD = arg('shard', '0/1').split('/').map(Number), PER = +arg('per', 5), IMGS = +arg('imgs', 2), SEED = +arg('seed', 1), OUT = arg('out', 'aug'), SKIP = +arg('skip', 0);
function cfg() { const t = fs.readFileSync(path.join(ROOT, 'gmt-config.js'), 'utf8'), b = t.slice(t.indexOf('MAIN:'), t.indexOf('MAIN:') + 900); return { url: /url\s*:\s*'([^']+)'/.exec(b)[1], key: /key\s*:\s*'([^']+)'/.exec(b)[1] }; }
(async () => {
  const { url, key } = cfg();
  const prods = await (await fetch(url + '/rest/v1/products?select=id,image_url,images&limit=5000', { headers: { apikey: key, Authorization: 'Bearer ' + key } })).json();
  const jobs = [];
  for (const p of prods) {
    const urls = [p.image_url].concat(Array.isArray(p.images) ? p.images : []).filter(u => typeof u === 'string' && u).filter((u, i, a) => a.indexOf(u) === i).slice(SKIP, SKIP + IMGS);
    urls.forEach((u, ui) => { const m = /\/system__V\/(img\/.+)$/.exec(u); jobs.push([String(p.id) + '|' + (SKIP + ui), m ? 'http://127.0.0.1:8765/' + m[1] : u]); });   /* «المنتج|رقم الصورة» ⇒ تقييمٌ صادق على صورةٍ لم يُتدرَّب عليها */
  }
  const mine = jobs.filter((_, i) => i % SHARD[1] === SHARD[0]); jobs.length = 0; jobs.push(...mine);
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('http://127.0.0.1:8765/robots.txt').catch(() => {});
  await pg.addScriptTag({ url: 'http://127.0.0.1:8765/gmt-lens-local.js?t=' + Date.now() });
  console.log('backend:', await pg.evaluate(() => GMTLensLocal.loadModel().then(() => tf.getBackend())));
  /* مولّد عشوائيّ ثابت البذرة ⇒ نتائج قابلة للإعادة */
  await pg.evaluate((seed) => {
    let s = seed >>> 0; window.__rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    window.__bgPool = [];
    window.__loadImg = src => new Promise(ok => { const x = new Image(); x.crossOrigin = 'anonymous'; const t = setTimeout(() => ok(null), 20000); x.onload = () => { clearTimeout(t); ok(x); }; x.onerror = () => { clearTimeout(t); ok(null); }; x.src = src; });
    window.__aug = (im) => {
      const R = window.__rnd, W = 320, H = 240, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      /* الخلفية: لون/تدرّج ⇐ أو صورة منتجٍ آخر مكبّرة ضبابية (رفّ مزدحم) */
      const bgKind = R();
      if (bgKind < 0.35 && window.__bgPool.length) { const bi = window.__bgPool[Math.floor(R() * window.__bgPool.length)]; g.filter = 'blur(' + (1 + R() * 3).toFixed(1) + 'px)'; g.drawImage(bi, -40, -30, W + 80, H + 60); g.filter = 'none'; }
      else { const h1 = Math.floor(R() * 360), l1 = 25 + R() * 60, gr = g.createLinearGradient(0, 0, W * R(), H); gr.addColorStop(0, `hsl(${h1},${Math.floor(R() * 30)}%,${l1}%)`); gr.addColorStop(1, `hsl(${(h1 + 40) % 360},${Math.floor(R() * 30)}%,${Math.max(10, l1 - 20 + R() * 40)}%)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      if (R() < 0.4) { g.fillStyle = `rgba(${R() * 255 | 0},${R() * 255 | 0},${R() * 255 | 0},.5)`; g.fillRect(R() * W, R() * H, 40 + R() * 100, 15 + R() * 60); }
      /* المنتج: حجمٌ ٤٥–٩٥٪ · إزاحة · ميلان · قصّ جزئيّ أحياناً */
      const iw = im.naturalWidth, ih = im.naturalHeight, sc = (0.45 + R() * 0.5) * Math.min(W / iw, H / ih) * (R() < 0.2 ? 1.5 : 1);
      g.save(); g.translate(W / 2 + (R() - 0.5) * W * 0.25, H / 2 + (R() - 0.5) * H * 0.25); g.rotate((R() - 0.5) * 0.63);
      g.transform(1, (R() - 0.5) * 0.12, (R() - 0.5) * 0.12, 1, 0, 0);
      g.filter = `brightness(${(0.65 + R() * 0.6).toFixed(2)}) contrast(${(0.75 + R() * 0.55).toFixed(2)}) saturate(${(0.6 + R() * 0.7).toFixed(2)})` + (R() < 0.4 ? ` blur(${(R() * 1.6).toFixed(1)}px)` : '');
      g.drawImage(im, -iw * sc / 2, -ih * sc / 2, iw * sc, ih * sc); g.restore(); g.filter = 'none';
      /* ضوءٌ منعكس / ظلّ */
      if (R() < 0.35) { const rg = g.createRadialGradient(R() * W, R() * H, 10, R() * W, R() * H, 150); rg.addColorStop(0, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
      return c;
    };
  }, SEED);
  const outDir = path.join(ROOT, '.lens_raw'); fs.mkdirSync(outDir, { recursive: true });
  const ids = [], bufs = []; let ok = 0, bad = 0;
  for (let i = 0; i < jobs.length; i += 8) {
    const part = jobs.slice(i, i + 8);
    const res = await pg.evaluate(async ({ part, PER }) => {
      const out = [];
      for (const [id, src] of part) {
        const im = await window.__loadImg(src); if (!im) { out.push([id, null]); continue; }
        if (window.__bgPool.length < 40 && window.__rnd() < 0.3) window.__bgPool.push(im);
        for (let k = 0; k < PER; k++) {
          try { const v = await GMTLensLocal.embedRaw(window.__aug(im), 'shot'); let s = ''; const u8 = new Uint8Array(v.buffer); for (let j = 0; j < u8.length; j++) s += String.fromCharCode(u8[j]); out.push([id, btoa(s)]); }
          catch (e) { out.push([id, null]); }
        }
      }
      return out;
    }, { part, PER });
    for (const [id, x] of res) { if (x) { ids.push(id); bufs.push(Buffer.from(x, 'base64')); ok++; } else bad++; }
    if (i % 80 === 0) process.stdout.write(`\r${Math.min(i + 8, jobs.length)}/${jobs.length} ✓${ok} ✗${bad}   `);
  }
  await b.close();
  fs.writeFileSync(path.join(outDir, OUT + '.f32'), Buffer.concat(bufs));
  fs.writeFileSync(path.join(outDir, OUT + '_ids.json'), JSON.stringify(ids));
  console.log(`\n.lens_raw/${OUT}: ${ids.length} لقطة صناعيّة (${bad} تعذّرت)`);
})();
