// طبقات القراءة الجديدة: صور باهتة/ضبابية/مائلة (تحسين التباين) + إيصال بلا باركود (OCR) + لا نتيجة كاذبة
const H = require('./h.js'); const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 4000 });
  await pg.addScriptTag({ url: H.BASE + 'lib/JsBarcode.all.min.js' }).catch(() => {});
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js' }).catch(() => {});
  // نسخة المحرّك القديم للمقارنة
  await pg.evaluate((src) => { const NEW = window.GMTReceipt; delete window.GMTReceipt; (0, eval)(src); window.GMTReceiptOld = window.GMTReceipt; window.GMTReceipt = NEW; }, fs.readFileSync('/tmp/gmt-receipt-old.js', 'utf8'));
  const build = (spec) => pg.evaluate(async (spec) => {
    const W = 1200, Hh = 1700; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
    c.fillStyle = spec.paper || '#fff'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#222'; c.font = 'bold 38px sans-serif';
    for (let i = 0; i < 16; i++) c.fillText('MUFTI TRANSPORT line ' + i + '  0933' + (100000 + i * 777) + '  qty ' + i, 80, 520 + i * 52);
    if (spec.digits) { c.font = 'bold 110px sans-serif'; c.fillStyle = '#111'; c.fillText(spec.digits, 120, 190); c.font = 'bold 34px sans-serif'; c.fillText('Tracking No.', 120, 120); }
    if (spec.barcode) {
      const t = document.createElement('canvas'); JsBarcode(t, spec.barcode, { format: 'CODE128', width: 3, height: 140, displayValue: false, margin: 12, lineColor: spec.ink || '#000', background: spec.paper || '#fff' });
      c.drawImage(t, 100, 260);
    }
    const turned = Math.abs((spec.rot || 0)) === 90; const out = document.createElement('canvas'); out.width = turned ? Hh : W; out.height = turned ? W : Hh; const oc = out.getContext('2d');
    oc.fillStyle = '#9a9a9a'; oc.fillRect(0, 0, out.width, out.height);
    if (spec.blur) oc.filter = 'blur(' + spec.blur + 'px)';
    oc.translate(out.width / 2, out.height / 2); oc.rotate((spec.rot || 0) * Math.PI / 180); oc.drawImage(cv, -W / 2, -Hh / 2);
    const blob = await new Promise(ok => out.toBlob(ok, 'image/jpeg', 0.55));
    window.__f = new File([blob], 'rcpt.jpg', { type: 'image/jpeg' }); return Math.round(blob.size / 1024);
  }, spec);
  const read = (which, opts) => pg.evaluate(async ([which, opts]) => { const t0 = performance.now(); const R = which === 'old' ? window.GMTReceiptOld : window.GMTReceipt; const r = await R.readTracking(window.__f, opts || {}); return { number: r.number, method: r.method, cands: r.candidates, how: r.how, ms: Math.round(performance.now() - t0) }; }, [which, opts]);

  console.log('— ١) باركود باهت + ميلان ٨° (طبقة تحسين التباين والميلان)');
  await build({ barcode: '1966820', paper: '#d0d0d0', ink: '#909090', rot: 8 });
  const oldA = await read('old'); const newA = await read('new', { ocr: false });
  console.log('   القديم:', JSON.stringify(oldA)); console.log('   الجديد (بلا OCR):', JSON.stringify(newA));
  ok(newA.number === '1966820', 'الجديد يقرأ الباركود الباهت المائل'); console.log('   (القديم ' + (oldA.number ? 'نجح أيضاً' : 'فشل') + ')');

  console.log('— ٢) إيصال بلا باركود: الرقم مطبوع فقط (OCR)');
  await build({ digits: '1966820', rot: 0 });
  const oldB = await read('old'); const newB = await read('new');
  console.log('   القديم:', JSON.stringify(oldB)); console.log('   الجديد:', JSON.stringify(newB));
  ok(!oldB.number, 'القديم لا يجد شيئاً'); ok(newB.method === 'ocr' && (newB.cands || []).includes('1966820'), 'OCR يضع 1966820 بين المرشّحين: ' + JSON.stringify(newB.cands));
  ok(newB.number === '1966820', 'ويكون الأول (الأعلى الأكبر)');

  console.log('— ٣) إيصال مدار ٩٠° بلا باركود (OCR بعد التدوير)');
  await build({ digits: '1966820', rot: 90 });
  const newC = await read('new'); console.log('   ', JSON.stringify(newC));
  ok(newC.method === 'ocr' && (newC.cands || []).includes('1966820'), 'يجد المرشّح بعد تدوير الصورة');

  console.log('— ٤) لا باركود ولا رقم تتبّع (أرقام هواتف وكميات فقط) ⇒ لا نتيجة كاذبة');
  await build({});
  const newD = await read('new'); console.log('   ', JSON.stringify(newD));
  ok(!newD.number || !/^09/.test(newD.number), 'لا يُرجَع رقم هاتف كرقم تتبّع'); 

  console.log('— ٥) أرقام التصنيف');
  const rk = await pg.evaluate(() => GMTReceipt._rank([{ text: '0933111222', bbox: { y0: 10, y1: 30 }, confidence: 90 }, { text: '20261016', bbox: { y0: 10, y1: 30 }, confidence: 90 }, { text: '1966820', bbox: { y0: 20, y1: 80 }, confidence: 80 }, { text: 'l966B20', bbox: { y0: 700, y1: 720 }, confidence: 60 }], 1000).map(x => x.number));
  ok(rk[0] === '1966820' && !rk.includes('0933111222') && !rk.includes('20261016'), 'ترتيب المرشّحين يستبعد الهاتف والتاريخ: ' + JSON.stringify(rk));
  console.log('errors:', errs.filter(e => !/400|404|Failed|resolution/.test(e)).slice(0, 4));
  await browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
