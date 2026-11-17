// (ARC-MD-04#63) قالب الفاتورة الحرارية Canon انتقل من pos.html إلى gmt-invoice-tpl.js — مطابقٌ بايتاً ببايت ويُستعمل في نقطة البيع
const crypto = require('crypto');
const H = require('./h.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
const SHA_BEFORE = '7d6c06d87414065f037ed057b5916b59398e0b0e';   // بصمة TEMPLATE_CANON في pos.html قبل النقل (10578 حرفاً)
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 1200, h: 900, wait: 4000 });
  const r = await pg.evaluate(() => ({ canon: (window.GMTInvoiceTpl && GMTInvoiceTpl.CANON) || '', same: typeof TEMPLATE_CANON !== 'undefined' && TEMPLATE_CANON === (window.GMTInvoiceTpl || {}).CANON }));
  ok(crypto.createHash('sha1').update(r.canon, 'utf8').digest('hex') === SHA_BEFORE && r.canon.length === 10578, 'GMTInvoiceTpl.CANON مطابق للقالب القديم بايتاً ببايت');
  ok(r.same, 'نقطة البيع تقرأ القالب من المصدر المشترك (TEMPLATE_CANON === GMTInvoiceTpl.CANON)');
  ok(/{{ITEMS_ROWS}}/.test(r.canon) && /size: 70mm auto/.test(r.canon), 'القالب الحراري 70mm بعلامة البنود');
  const real = errs.filter(e => !/vibrate|favicon|ERR_|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ← ' + real.slice(0, 2).join(' | '));
  await browser.close();
  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت'); process.exit(bad ? 1 : 0);
})();
