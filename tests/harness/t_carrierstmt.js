// TASK-B0554 · المالك seq B1041 «ملفّ الأوردرات ناقصه: مرتجعات والكشوفات والأجور» · طابور Q3: كشف شركات الشحن — «شو عند الشركة إلنا؟»
const H = require('./h.js');
const C = require('../../gmt-carrierstmt.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const O = [
    { id: 1, shipping_company: 'المفتي', status: 'delivered', price: 100, collect_amount: 103, notes: 'أجور شحن مضافة على المطلوب تحصيله: $3', shipped_at: '2026-11-10T10:00:00Z' },
    { id: 2, shipping_company: 'المفتي', status: 'completed', price: 50, shipped_at: '2026-11-05T10:00:00Z' },
    { id: 3, shipping_company: 'المفتي', status: 'shipped', price: 40, shipped_at: '2026-11-20T10:00:00Z' },
    { id: 4, shipping_company: 'المفتي', status: 'returned', price: 70, shipped_at: '2026-11-01T10:00:00Z', return_info: { stage: 'received', ship_out: 2, ship_back: 2, history: [{ total: 3 }] } },
    { id: 5, shipping_company: 'القدموس', status: 'delivered', price: 20, shipped_at: '2026-10-01T10:00:00Z' },
    { id: 6, shipping_company: 'المفتي', status: 'pending', price: 999 },
    { id: 7, shipping_company: 'المفتي', status: 'completed', price: 30, is_deleted: true, shipped_at: '2026-11-02T10:00:00Z' }];
  const R = C.build(O, {}), M = R.companies.find(c => c.name === 'المفتي');
  ok(M.awaiting === 103 && M.collected === 50 && M.transit === 40, 'المفتي: عندهم إلنا 103 (المطلوب تحصيله مع الأجور) · تمّ التحصيل 50 · بالطريق 40');
  ok(M.returned === 1 && M.retFees === 7, 'مرتجع واحد بأجوره (2+2 + سابق 3 = 7)');
  ok(M.fees === 3 && C.feeOf(O[0]) === 3, 'أجور الشحن من الملاحظات (3$)');
  ok(M.n === 4, 'قبل الشحن والمحذوف ما بيدخلوا الكشف');
  ok(R.companies[0].name === 'المفتي' && R.totals.awaiting === 123, 'الترتيب: الأكبر «عندهم إلنا» أوّلاً · المجموع 123');
  ok(C.build(O, { from: '2026-11-01', to: '2026-11-30T23:59:59Z' }).companies.every(c => c.name !== 'القدموس'), 'الفترة: القدموس (تشرين الأوّل) بيطلع برّا تشرين التاني');
  ok(/^﻿الأوردر,/.test(C.csv(M)), 'تصدير Excel بالعربي');
  await H.seed();
  await H.call('/rest/v1/gmt_orders', [{ name: 'زبون الكشف', phone: '0933', product: 'x', qty: 1, price: 80, status: 'delivered', shipping_company: 'المفتي', shipped_at: '2026-11-15T10:00:00Z', serial_code: 'G-KSHF' }]);
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  ok(await pg.evaluate(() => [...document.querySelectorAll('button')].some(b => /كشف شركات الشحن/.test(b.textContent))), 'زرّ «📑 كشف شركات الشحن» بالأوردرات');
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(b => /كشف شركات الشحن/.test(b.textContent)).click());
  await pg.waitForSelector('#gmt-carrier', { timeout: 8000 }).catch(() => {});
  const t = await pg.evaluate(() => (document.getElementById('gmt-carrier') || {}).innerText || '');
  ok(/عند الشركة إلنا/.test(t) && /G-KSHF/.test(t) && /80\.00\$/.test(t), 'الكشف انفتح بالأوردر وبـ«عندهم إلنا 80$»');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
