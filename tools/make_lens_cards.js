#!/usr/bin/env node
/* بطاقات «اسأل جوجل» الجاهزة (TASK-0369 · المالك seq 643 «عم يطول — يا تكون جاهزة من الأساس»).
   لكلّ منتج في المتجر بطاقة ثابتة img/lens/<المعرّف>.jpg فيها صورته واسمه وجدول مواصفاته وتوافقه — تفتحها عدسة جوجل فوراً بلا تجهيزٍ ولا رفع.
   img/lens/index.json يحمل بصمة بيانات كلّ منتج؛ إن تغيّرت بياناته بعد التوليد يعود المتجر تلقائياً للمسار القديم حتى يُعاد التوليد.
   التشغيل:  node tools/make_lens_cards.js <ملفّ JSON فيه {products:[…]}>   (يتخطّى ما لم يتغيّر) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'img', 'lens'), SITE = 'https://general-media-tech.github.io/system__V/';
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const key = p => hash([p.name || '', (Array.isArray(p.specs) ? p.specs : []).map(x => x ? String(x.label || '') + ':' + String(x.value == null ? '' : x.value) : '').join('|'), p.compat || '', (p.images || [])[0] || ''].join('§'));
const safe = id => String(id).replace(/[^A-Za-z0-9_-]/g, '_');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const du = f => 'data:' + (/\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : /\.woff2$/.test(f) ? 'font/woff2' : 'image/jpeg') + ';base64,' + fs.readFileSync(f).toString('base64');
(async () => {
  const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const prods = src.products || src;
  fs.mkdirSync(OUT, { recursive: true });
  const idxFile = path.join(OUT, 'index.json'); const old = fs.existsSync(idxFile) ? (JSON.parse(fs.readFileSync(idxFile, 'utf8')).items || {}) : {};
  const items = {}; let made = 0, kept = 0, skipped = 0;
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 720, height: 900 } });
  const font = `@font-face{font-family:Cairo;src:url(${du(path.join(ROOT, 'lib/fonts/Cairo-var-arabic.woff2'))}) format('woff2');unicode-range:U+0600-06FF,U+FB50-FDFF,U+FE70-FEFF}@font-face{font-family:Cairo;src:url(${du(path.join(ROOT, 'lib/fonts/Cairo-var-latin.woff2'))}) format('woff2')}`;
  for (const p of prods) {
    const img = (p.images || [])[0] || ''; const id = String(p.id), k = key(p), file = path.join(OUT, safe(id) + '.jpg');
    let local = img.indexOf(SITE) === 0 ? path.join(ROOT, decodeURIComponent(img.slice(SITE.length).split('?')[0])) : '';
    if (!local || !fs.existsSync(local)) { skipped++; continue; }                      // صورة خارج الموقع ⇒ المسار القديم في المتجر
    if (old[id] === k && fs.existsSync(file)) { items[id] = k; kept++; continue; }
    const specs = (Array.isArray(p.specs) ? p.specs : []).filter(x => x && x.label && x.value != null && String(x.value).trim()).slice(0, 14);
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${font}*{box-sizing:border-box;margin:0}body{width:720px;background:#fff;font-family:Cairo,Tahoma,sans-serif;color:#111}
      .im{width:720px;height:640px;display:flex;align-items:center;justify-content:center;background:#fff}.im img{max-width:700px;max-height:620px;object-fit:contain}
      .tx{padding:14px 28px 26px}h1{font-size:30px;font-weight:900;line-height:1.4;margin-bottom:8px}.d{font-size:19px;line-height:1.7;color:#333;margin-bottom:12px}
      h2{font-size:21px;font-weight:800;margin:6px 0 8px}table{width:100%;border-collapse:collapse;font-size:20px}td{padding:8px 12px;border-bottom:1px solid #e7e9ec}td:first-child{font-weight:800;width:36%;background:#f6f7f9}
      .c{font-size:19px;margin-top:12px;line-height:1.6}.f{margin-top:14px;font-size:15px;color:#D5001C;font-weight:800;letter-spacing:3px;direction:ltr;text-align:left}</style></head><body>
      <div class="im"><img src="${du(local)}"></div><div class="tx"><h1>${esc(p.name)}</h1>${p.description ? `<div class="d">${esc(String(p.description).slice(0, 260))}</div>` : ''}
      ${specs.length ? `<h2>المواصفات</h2><table>${specs.map(x => `<tr><td>${esc(x.label)}</td><td>${esc(x.value)}</td></tr>`).join('')}</table>` : ''}
      ${p.compat ? `<div class="c"><b>متوافق مع:</b> ${esc(String(p.compat).slice(0, 220))}</div>` : ''}<div class="f">GENERAL MEDIA TECH</div></div></body></html>`;
    await pg.setContent(html, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: file, type: 'jpeg', quality: 78, fullPage: true }); items[id] = k; made++;
  }
  await b.close();
  for (const f of fs.readdirSync(OUT)) if (/\.jpg$/.test(f) && !Object.keys(items).some(id => safe(id) + '.jpg' === f)) fs.unlinkSync(path.join(OUT, f));   // بطاقة منتجٍ حُذف
  fs.writeFileSync(idxFile, JSON.stringify({ v: 1, built: new Date().toISOString(), items }));
  console.log('made', made, 'kept', kept, 'skipped(no local image)', skipped, 'total', Object.keys(items).length);
})();
