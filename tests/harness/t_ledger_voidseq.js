// seq B1099 — خطأ حرج 409 gmt_expenses_pkey: الرقم التالي لقيد دفتر المشتريات لازم يتخطّى القيود الملغاة
global.window = globalThis; window.GMTCashTx = null;
require('../../gmt-ledger.js');
const L = window.GMTLedger;
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const DB = [
    { id: 'a1', title: 'دفعة شراء', amount: 3999.2, currency: 'usd', note: '[PO:99:g:1] دفعها: محمد خير', voided: false, created_at: '2026-11-07T18:02:31Z' },
    { id: 'a2', title: 'تصحيح', amount: -3259.2, currency: 'usd', note: '[PO:99:g:2] دفعها: محمد خير · تخفيض', voided: true, created_at: '2026-11-07T18:19:39Z' }];
  /* المعرّف المحسوب للقيد الملغى (g:2) — القاعدة الحقيقية بترفض نفس المعرّف */
  let posts = 0, conflicts = 0;
  const api = { sb: async (m, url, body) => {
    if (m === 'GET') return url.includes('gmt_expenses') ? DB.slice() : [];
    if (m === 'POST') { posts++; if (DB.some(x => x.id === body.id) || (body.note || '').includes('[PO:99:g:2]')) { conflicts++; throw new Error('HTTP 409 duplicate key value violates unique constraint "gmt_expenses_pkey" 23505'); } const r = Object.assign({}, body); DB.push(r); return [r]; }
    return [];
  } };
  const P = { id: 99, inv_number: 'CN-2026-0008', supplier: 'Shenzhen', total_amount: 3999.2, cash_payment: 2308, costs_paid: false, inv_type: 'china' };
  const res = await L.syncPurchase(api, P, { payer: 'الإدارة' });
  const live = DB.filter(x => !x.voided && /\[PO:99:g:/.test(x.note)), sum = Math.round(live.reduce((s, x) => s + Number(x.amount), 0) * 100) / 100;
  ok(!res.error && conflicts === 0, 'بلا تعارض 409 (كان يعيد الرقم 2 تبع القيد الملغى) ' + JSON.stringify({ err: res.error, conflicts, posts }));
  ok(live.some(x => /\[PO:99:g:3\]/.test(x.note) && Math.abs(Number(x.amount) + 1691.2) < 0.01), 'التصحيح انكتب بالرقم 3: −1691.20');
  ok(Math.abs(sum - 2308) < 0.01, 'الدفتر صار = المدفوع فعلاً (2308) — كان عالق على 3999.20: ' + sum);
  /* (B1099) «تكاليف الشحن في الصين بتندفع مع الفاتورة» */
  const CN = { inv_type: 'china', total_amount: 1000, cost_shipping: 200, cost_customs: 50, cost_transport: 10, cost_local: 5 }, DE = Object.assign({}, CN, { inv_type: 'germany' });
  ok(L.supplierDue(CN) === 1200 && L.supplierDue(DE) === 1000, 'مستحقّ المورّد: الصين = البضاعة + الشحن (1200) · أوروبا = البضاعة (1000)');
  ok(L.costsTotal(CN) === 65 && L.costsTotal(DE) === 265, 'التكاليف المؤجَّلة: الصين بلا الشحن (65) — ما بينعدّ مرّتين · أوروبا كلّها (265)');
  ok(L.paidGoods(Object.assign({ cash_payment: null }, CN)) === 1200, 'فاتورة صينية قديمة «مدفوعة كاملة» = مع الشحن');
  global.document = undefined; const PP = require('../../gmt-popay.js');
  const S1 = PP.summary(Object.assign({ cash_payment: 700 }, CN), []);
  ok(S1.value === 1200 && S1.goods === 1000 && S1.ship === 200 && S1.remaining === 500, 'الدفعات: الفاتورة + الشحن 1200 · دفعت 700 ⇐ باقي 500');
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
