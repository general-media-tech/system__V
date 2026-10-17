// معايرة: أيّ تشويهات تفشل في القديم وتنجح في الجديد؟
const H = require('./h.js'); const fs = require('fs');
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
  await pg.addScriptTag({ url: H.BASE + 'lib/JsBarcode.all.min.js' }).catch(() => {});
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js' }).catch(() => {});
  await pg.evaluate((src) => { const NEW = window.GMTReceipt; delete window.GMTReceipt; (0, eval)(src); window.GMTReceiptOld = window.GMTReceipt; window.GMTReceipt = NEW; }, fs.readFileSync('/tmp/gmt-receipt-old.js', 'utf8'));
  const cases = [
    { n: 'تباين منخفض', paper: '#c8c8c8', ink: '#9a9a9a' },
    { n: 'ميلان 11°', rot: 11 },
    { n: 'ميلان 20°', rot: 20 },
    { n: 'ضباب 1.2', blur: 1.2 },
    { n: 'ضباب 2', blur: 2 },
    { n: 'باهت+ميلان 8°', paper: '#d0d0d0', ink: '#909090', rot: 8 },
    { n: 'ضباب 1.5 + ميلان 10°', blur: 1.5, rot: 10 },
    { n: 'رمز صغير بزاوية + باهت', paper: '#cfcfcf', ink: '#8c8c8c', small: true },
  ];
  for (const sp of cases) {
    await pg.evaluate(async (spec) => {
      const W = 1200, Hh = 1700; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
      c.fillStyle = spec.paper || '#fff'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#222'; c.font = 'bold 38px sans-serif';
      for (let i = 0; i < 16; i++) c.fillText('MUFTI TRANSPORT line ' + i + '  0933' + (100000 + i * 777), 80, 520 + i * 52);
      const t = document.createElement('canvas'); JsBarcode(t, '1966820', { format: 'CODE128', width: spec.small ? 1.6 : 3, height: spec.small ? 90 : 140, displayValue: false, margin: 12, lineColor: spec.ink || '#000', background: spec.paper || '#fff' });
      c.drawImage(t, 100, 260);
      const out = document.createElement('canvas'); out.width = W; out.height = Hh; const oc = out.getContext('2d');
      oc.fillStyle = '#9a9a9a'; oc.fillRect(0, 0, W, Hh); if (spec.blur) oc.filter = 'blur(' + spec.blur + 'px)';
      oc.translate(W / 2, Hh / 2); oc.rotate((spec.rot || 0) * Math.PI / 180); oc.drawImage(cv, -W / 2, -Hh / 2);
      const blob = await new Promise(ok => out.toBlob(ok, 'image/jpeg', 0.6)); window.__f = new File([blob], 'r.jpg', { type: 'image/jpeg' });
    }, sp);
    const o = await pg.evaluate(async () => { const t = performance.now(); const r = await GMTReceiptOld.readTracking(window.__f); return { n: r.number, ms: Math.round(performance.now() - t) }; });
    const nw = await pg.evaluate(async () => { const t = performance.now(); const r = await GMTReceipt.readTracking(window.__f, { ocr: false }); return { n: r.number, m: r.method, ms: Math.round(performance.now() - t) }; });
    console.log(sp.n.padEnd(28), '| قديم:', String(o.n).padEnd(8), o.ms + 'ms', '| جديد:', String(nw.n).padEnd(8), nw.m || '-', nw.ms + 'ms');
  }
  await browser.close();
})();
