// (المالك seq B1127) «مدى كلّهن إلّا آخر فاتورة · ضيف إنّو بحسن حطّلهن تسجيل دفعة» ⇒ «✅ سجّل دفعة» بملفّ المورّد:
// الفواتير اللي عليها باقي معلّمة ⇐ شيل العلامة عن الأخيرة ⇐ سجّل ⇐ الباقي مدفوع بتاريخ كلّ فاتورة · الأخيرة بتضلّ عليها
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const base = { inv_type: 'instant', supplier: 'شركة مدى تجربة', status: 'arrived', dest_branch: 'daraa', items_snapshot: [], cost_shipping: 0 };
  await H.call('/rest/v1/import_log', [
    Object.assign({ id: 971, inv_number: 'PO-M-1', inv_date: '2026-04-21', total_amount: 159.2, cash_payment: 0, created_at: '2026-04-21T00:00:00Z' }, base),
    Object.assign({ id: 972, inv_number: 'PO-M-2', inv_date: '2026-06-29', total_amount: 65.04, cash_payment: 0, created_at: '2026-06-29T00:00:00Z' }, base),
    Object.assign({ id: 973, inv_number: 'PO-M-3', inv_date: '2026-10-13', total_amount: 59.89, cash_payment: 0, created_at: '2026-10-13T00:00:00Z' }, base)]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 390, h: 844, mobile: true, wait: 7000 });
  await pg.evaluate(() => { GMTAsk.confirm = async () => true; });
  await pg.evaluate(() => openSuppliers()); await sleep(1200);
  await pg.evaluate(() => { const k = [...document.querySelectorAll('[data-sp-key]')].find(x => /مدى تجربة/.test(x.textContent)); k && k.click(); }); await sleep(500);
  ok(await pg.evaluate(() => !!document.querySelector('[data-sp-payall]')), 'ملفّ المورّد فيه «✅ سجّل دفعة»');
  await pg.evaluate(() => document.querySelector('[data-sp-payall]').click()); await sleep(400);
  const L = await pg.evaluate(() => [...document.querySelectorAll('[data-sp-pi]')].map(c => [c.getAttribute('data-sp-pi'), c.checked]));
  ok(L.length === 3 && L.every(x => x[1]) && L[0][0] === '973', 'الفواتير الـ٣ اللي عليها باقي معلّمة (الأحدث فوق): ' + JSON.stringify(L));
  /* المالك: كلّهن إلّا آخر فاتورة ⇐ شيل علامة PO-M-3 */
  await pg.evaluate(() => { document.querySelector('[data-sp-pi="973"]').checked = false; document.querySelector('[data-sp-paygo]').click(); });
  await sleep(3500);
  const D = await H.call('/__dump', undefined, 'GET');
  const pays = (D.gmt_po_payments || []).filter(x => !x.voided && [971, 972, 973].includes(Number(x.purchase_id)));
  ok(pays.length === 2 && pays.some(x => Number(x.purchase_id) === 971 && Number(x.usd) === 159.2 && String(x.paid_at).slice(0, 10) === '2026-04-21') && pays.some(x => Number(x.purchase_id) === 972 && Number(x.usd) === 65.04),
    'انسجّلت دفعتين كاملتين بتاريخ كلّ فاتورة: ' + JSON.stringify(pays.map(x => [x.purchase_id, x.usd, x.paid_at])));
  ok(!pays.some(x => Number(x.purchase_id) === 973), 'الفاتورة الأخيرة (المشالة علامتها) بتضلّ عليها');
  const inv = id => (D.import_log || []).find(x => Number(x.id) === id) || {};
  ok(Number(inv(971).cash_payment) === 159.2 && Number(inv(972).cash_payment) === 65.04, 'المدفوع انكتب على الفواتير');
  ok(await pg.evaluate(() => /59\.89/.test(document.getElementById('gmt-suppliers').innerText) && !document.querySelector('[data-sp-paypanel]')), 'الملفّ اتحدّث: الباقي علينا 59.89$');
  const exp = (D.gmt_expenses || []).filter(e => /\[PO:97[12]:g:/.test(e.note || ''));
  ok(exp.length >= 2, 'الدفتر انربط (قيود البضاعة): ' + exp.length);
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
