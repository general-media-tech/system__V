// (وكيل ٤) OWN-10#12 — سجل العمليات: لا رمز إنجليزي خام (qty_unlock …) ولا نصّ فاتح التباين
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  const { browser, pg } = await H.open('سجل_العمليات.html', { w: 1100, h: 800, wait: 3500 });
  const r = await pg.evaluate(() => {
    const L = window.GMTOpLog && GMTOpLog.labels || {};
    return { has: !!L.actions, qty: L.actions && L.actions.qty_unlock, tr: L.actions && L.actions.transfer_cancel };
  });
  ok(r.has, 'جدول التسميات متاح');
  ok(r.qty === 'فتح قفل الكمية', 'qty_unlock ⇒ ' + r.qty);
  ok(r.tr === 'إلغاء نقل', 'transfer_cancel ⇒ ' + r.tr);
  await browser.close();
  console.log(fails ? 'FAIL' : 'PASS'); process.exit(fails ? 1 : 0);
})();
