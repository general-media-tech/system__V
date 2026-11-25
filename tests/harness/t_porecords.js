// TASK-B0547 · A1004 P2 · طابور Q1 (seq B1078 «تحديث شامل للمشتريات»): سجلّات موحّدة — بحث واحد (رقم · مورّد · منتج · باركود · شحنة · دفعة)
// + فلاتر (بالطريق · واصلة · فورية · باقي · مستحقّة · فيها نقص · بلا مورّد) محفوظة + فرز + مجاميع + تصدير
const H = require('./h.js');
require('../../gmt-popay.js'); const R = require('../../gmt-porecords.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const S = [
    { id: 1, inv_number: 'IMP-A', inv_type: 'china', status: 'transit', supplier: 'Shenzhen Godox', inv_date: '2026-11-01', total_amount: 100, cash_payment: 0, tracking_number: 'TRK777', items_snapshot: [{ id: 'p1', name: 'Godox SL60W', barcode: '6952', qty: 2, unit_price: 50 }] },
    { id: 2, inv_number: 'IMP-B', inv_type: 'germany', status: 'arrived', supplier: 'Berlin Foto', inv_date: '2026-10-01', total_amount: 300, cash_payment: null, items_snapshot: [{ id: null, name: 'Canon LP-E6', qty: 3, unit_price: 0 }] },
    { id: 3, inv_number: 'INS-1', inv_type: 'instant', status: 'arrived', supplier: '', inv_date: '2026-11-10', total_amount: 20, items_snapshot: [{ id: 'p3', name: 'كرت ذاكرة', qty: 1, unit_price: 20 }] }];
  const pays = { 1: [{ ref_no: 'HW-55', usd: 40, amount: 40, currency: 'USD', due_at: '2020-01-01' }] };
  const payOf = id => pays[id] || [];
  const ids = o => R.query(S, payOf, o).map(x => x.p.id).join(',');
  ok(ids({ q: 'sl60' }) === '1' && R.query(S, payOf, { q: 'sl60' })[0].why.startsWith('منتج'), 'بحث باسم منتج ⇒ الفاتورة + «منتج: …»');
  ok(ids({ q: '6952' }) === '1', 'بحث بالباركود');
  ok(ids({ q: 'trk777' }) === '1', 'بحث برقم تتبّع الشحنة');
  ok(ids({ q: 'hw-55' }) === '1' && /دفعة/.test(R.query(S, payOf, { q: 'hw-55' })[0].why), 'بحث برقم إيصال الدفعة');
  ok(ids({ q: 'berlin' }) === '2' && ids({ q: 'imp' }) === '1,2', 'بحث بالمورّد وبالرقم');
  ok(ids({ f: 'transit' }) === '1' && ids({ f: 'arrived' }) === '2' && ids({ f: 'instant' }) === '3', 'فلاتر: بالطريق · واصلة · فورية');
  ok(ids({ f: 'owed' }) === '1' && ids({ f: 'due' }) === '1', 'باقي للمورّد (60) · مستحقّة (استحقاق فات)');
  ok(ids({ f: 'gaps' }) === '2' && ids({ f: 'nosup' }) === '3', 'فيها نقص (سعر 0 / غير مربوط) · بلا مورّد');
  ok(ids({ sort: 'value' }) === '2,1,3' && ids({ sort: 'old' }) === '2,1,3' && ids({ sort: 'owed' }).startsWith('1'), 'فرز: القيمة · الأقدم · الأكبر باقي');
  const csv = R.csv(R.query(S, payOf, {}));
  ok(/^﻿الرقم,/.test(csv) && /IMP-A,china,Shenzhen Godox/.test(csv), 'تصدير CSV (يفتح بإكسل بالعربي)');
  // الواجهة
  await H.seed();
  await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-UI-1', inv_type: 'china', status: 'transit', supplier: 'مورد السجل', inv_date: '2026-11-02', total_amount: 50, cash_payment: 0, items_snapshot: [{ name: 'منتج فريد XQ9', qty: 1, unit_price: 50 }], created_at: '2026-11-02T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_porec_v1'); } catch (_) {} switchTab('log'); });
  await pg.waitForSelector('[data-porec]', { timeout: 10000 }).catch(() => {});
  await pg.fill('[data-pr-q]', 'xq9'); await pg.waitForTimeout(300);
  const r = await pg.evaluate(() => ({ n: document.querySelectorAll('[data-pr-row]').length, t: document.querySelector('[data-pr-tot]').textContent, why: (document.querySelector('[data-pr-row]') || {}).innerText }));
  ok(r.n === 1 && /منتج فريد XQ9/.test(r.why) && /1 فاتورة/.test(r.t), 'الواجهة: بحث «xq9» ⇒ الفاتورة مع «↳ منتج» والمجاميع: ' + r.t);
  await pg.click('[data-pr-f] [data-f="owed"]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_porec_v1')).f === 'owed'), 'الفلتر بينحفظ (بيرجع متل ما تركته)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
