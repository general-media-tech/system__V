// (OWN-10#12) سجل العمليات: رموز العمليات الإنجليزية (qty_unlock …) تظهر بعربية واضحة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const now = new Date().toISOString();
  const acts = ['qty_unlock', 'transfer_cancel', 'order_returned', 'branch_stock_set', 'some_new_unknown'];
  await H.call('/rest/v1/gmt_audit', acts.map((a, i) => ({ actor: 'محمد', page: 'inventory', action: a, entity: 'products', entity_name: 'اختبار ' + i, at: now })));
  const o = await H.open('سجل_العمليات.html', { w: 1100, h: 800, mobile: false, wait: 5000 });
  const txt = await o.pg.evaluate(() => Array.from(document.querySelectorAll('.ol-what')).map(e => e.textContent));
  ok(txt.length >= 5, 'ظهرت صفوف السجل: ' + txt.length);
  ok(!txt.some(t => /^(qty_unlock|transfer_cancel|order_returned|branch_stock_set)$/.test(t)), 'لا رمزٌ إنجليزي خام للعمليات المعروفة');
  ok(txt.includes('فكّ قفل الكميات (تعديل يدوي)'), 'qty_unlock ⇒ عربية');
  ok(txt.includes('عملية: some_new_unknown'), 'الرمز المجهول مسبوقٌ بكلمة عربية');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
