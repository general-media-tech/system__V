// (TASK-B0533 · seq B1045) نقطة البيع: رقمُ عميلٍ دائم ⇒ «⭐ عميل دائم · عليه X$ · حدّ Y$» (+ تنبيه التجاوز) · رقمٌ عاديّ ⇒ لا شيء
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [C] = await H.call('/rest/v1/gmt_customers', [{ name: 'بلال دائم', phone: '0944777888', branch_key: 'haleb', is_regular: true, credit_limit: 80 }, { name: 'عادي', phone: '0933111222', branch_key: 'haleb', is_regular: false }]);
  await H.call('/rest/v1/invoices', [{ inv_number: 'P-1', branch_key: 'haleb', total: 150, paid_amount: 50, remaining_amount: 100, sale_type: 'آجل (شحن)', customer_phone: '0944777888', created_at: '2026-11-01T10:00:00Z' }]);
  await H.call('/rest/v1/gmt_receipts', [{ customer_id: C.id, amount: 10, currency: 'USD', method: 'cash', voided: false, created_at: '2026-11-02T10:00:00Z' }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  const typeP = async v => { await pg.evaluate(v => { const i = document.getElementById('inv-cust-phone'); i.value = v; i.dispatchEvent(new Event('input')); }, v); await pg.waitForTimeout(1500); return pg.evaluate(() => { const b = document.getElementById('inv-cust-acct'); return { show: b && b.style.display !== 'none', t: b ? b.textContent : '' }; }); };
  let r = await typeP('+963 944 777 888');
  ok(r.show && /بلال دائم/.test(r.t) && /عليه 90\.00\$/.test(r.t) && /حدّ الدين 80\.00\$/.test(r.t) && /تجاوز/.test(r.t), 'العميل الدائم: عليه 90$ (100 − سند 10) · حدّ 80$ ⇒ تنبيه التجاوز: ' + r.t);
  r = await typeP('0933111222');
  ok(!r.show, 'رقم عميلٍ غير دائم ⇒ لا سطر');
  ok(!errs.filter(e => !/favicon|404|400|406/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
