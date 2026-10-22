// (22 ت1 · TASK-0122) المالك: «ثانياً. عم تطوّل» — ① نواة SIMD تُختار على الأجهزة التي تدعمها ② ملفّات القارئ «الكاش أوّلاً» في كاشٍ
// ثابت لا يُحذف مع كل نشرة (كانت تُطلب من الشبكة في كل فتحة) ③ القارئ يُحمَّل مسبقاً عند فتح نافذة الشحن للمفتي.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  // ① + ③ (الحزمة العاديّة)
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون سرعة٢', phone: '0933000411', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }]);
  const src = require('fs').readFileSync(__dirname + '/t_mufti_read.js', 'utf8');
  const SYNTH = src.slice(src.indexOf('const SYNTH = `') + 15, src.indexOf('};`;') + 2);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 4000, init: H.ADMIN_INIT + SYNTH });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
  const coreReq = []; pg.on('request', r => { if (/lib\/ocr\/tesseract-core/.test(r.url())) coreReq.push(r.url().split('/').pop()); });
  ok(await pg.evaluate(() => GMTReceipt._core) === 'tesseract-core-simd-lstm.wasm.js', 'المتصفّح يدعم SIMD ⇒ النواة السريعة مختارة');
  await pg.evaluate(id => openShipModal(id), o1.id);
  await pg.waitForTimeout(4000);
  ok(coreReq.length >= 1 && coreReq.every(u => u === 'tesseract-core-simd-lstm.wasm.js'), 'فتح نافذة الشحن للمفتي يحمّل القارئ مسبقاً (بالنواة السريعة): ' + coreReq.join(','));
  const t = await pg.evaluate(async () => {
    const blob = await new Promise(r => __rcpt({ qr: '0451300', src: 'حلب-السريان' }).toBlob(r, 'image/jpeg', 0.92));
    const t0 = performance.now(); let br = null; const x = await GMTReceipt.readMufti(blob, { onBranch: () => { br = performance.now() - t0; } });
    return { br, key: x.branch && x.branch.key };
  });
  ok(t.key === 'حلب|السريان' && t.br != null && t.br < 2500, 'بعد التحميل المسبق: الفرع خلال ' + Math.round(t.br) + 'ms (لا انتظار لتحميل المكتبة)');
  const real = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground|Image too small|Empty page/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();

  // هاتفٌ قديم بلا SIMD ⇒ النواة العاديّة كما كانت، والقراءة تعمل
  {
    const { browser: b0, pg: p0 } = await H.open('orders.html', { w: 390, h: 844, wait: 4000, init: H.ADMIN_INIT + SYNTH + ';WebAssembly.validate = () => false;' });
    await p0.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
    const x = await p0.evaluate(async () => {
      const blob = await new Promise(r => __rcpt({ qr: '0451301', src: 'حلب-الفرقان' }).toBlob(r, 'image/jpeg', 0.92));
      const y = await GMTReceipt.readMufti(blob); return { core: GMTReceipt._core, key: y.branch && y.branch.key };
    });
    ok(x.core === 'tesseract-core-lstm.wasm.js' && x.key === 'حلب|الفرقان', 'بلا SIMD: النواة العاديّة (' + x.core + ') والفرع يُقرأ: ' + x.key);
    await b0.close();
  }

  // ② عامل الخدمة الحقيقي (الحزمة العاديّة تحجبه)
  const b2 = await chromium.launch(); const ctx = await b2.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  const p2 = await ctx.newPage();
  await p2.goto(H.BASE + 'track_order.html', { waitUntil: 'load' });
  await p2.evaluate(() => navigator.serviceWorker.ready); await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(800);
  const sw = await p2.evaluate(async () => {
    const ctl = !!navigator.serviceWorker.controller;
    const r1 = await fetch('lib/ocr/ara.traineddata.gz'); await r1.arrayBuffer();
    const keys = await caches.keys(), c = await caches.open('gmt-ocr-tess7.0.0'), hit = await c.match('lib/ocr/ara.traineddata.gz');
    return { ctl, keys, hit: !!hit, size: hit ? (await hit.arrayBuffer()).byteLength : 0 };
  });
  ok(sw.ctl && sw.hit && sw.size > 1000000, 'نموذج العربية في كاش القارئ الثابت (' + sw.size + ' بايت) · الكاشات: ' + sw.keys.join(', '));
  // من الكاش حتى لو تعذّرت الشبكة
  await ctx.route('**/lib/ocr/**', r => r.abort());
  const off = await p2.evaluate(async () => { try { const r = await fetch('lib/ocr/ara.traineddata.gz'); return r.ok ? (await r.arrayBuffer()).byteLength : -r.status; } catch (e) { return 'ERR ' + e.message; } });
  ok(off > 1000000, 'يُقدَّم من الكاش بلا شبكة: ' + off);
  await b2.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
