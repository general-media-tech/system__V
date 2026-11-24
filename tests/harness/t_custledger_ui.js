// (TASK-B0533 · seq B1045 «سجل لعملاء شراء دائمين مثل بلال بكور … بالدين … يبحث بالفواتير») أداة العملاء:
//   ⭐ عميل دائم بحدّ دين · 📒 كشف الحساب من فواتيره الآجلة · 📥 قبض دفعة ⇒ الرصيد ينقص · إلغاء السند (بسبب) ⇒ يعود · بحث بفواتيره · لا حذف لزبونٍ له سندات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [C] = await H.call('/rest/v1/gmt_customers', [{ name: 'بلال تجربة', phone: '0944555666', branch_key: 'haleb' }]);
  await H.call('/rest/v1/invoices', [
    { inv_number: 'L-1', branch_key: 'haleb', total: 120, paid_amount: 20, remaining_amount: 100, sale_type: 'آجل (شحن)', customer_phone: '0944555666', customer_name: 'بلال تجربة', created_at: '2026-11-01T10:00:00Z', items_json: JSON.stringify([{ name: 'كاميرا كانون 250D', qty: 1 }]) },
    { inv_number: 'L-2', branch_key: 'haleb', total: 30, paid_amount: 30, remaining_amount: 0, sale_type: 'نقدي', customer_phone: '+963 944 555 666', created_at: '2026-11-02T10:00:00Z', items_json: JSON.stringify([{ name: 'بطارية LP-E17', qty: 1 }]) },
    { inv_number: 'X-9', branch_key: 'haleb', total: 50, remaining_amount: 50, customer_phone: '0933000000', created_at: '2026-11-02T10:00:00Z' }]);
  const { browser, pg, errs } = await H.open('admin_pos.html?tab=customers', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const answers = []; await pg.evaluate(() => { window.__ans = []; const q = () => window.__ans.shift(); GMTAsk.form = async (m, o) => { const v = q(); if (v && o.submit) { const r = o.submit(v); if (r !== true) return null; } return v || null; }; GMTAsk.prompt = async () => q() || null; GMTAsk.confirm = async () => true; });
  await pg.evaluate(async () => { await loadCustomers(); switchTab('customers'); }); await pg.waitForTimeout(500);
  ok(await pg.evaluate(id => !!document.querySelector('[data-cust-ledger][onclick*="' + id + '"]'), C.id), 'زرّ «📒 الحساب والدين» على بطاقة العميل');
  await pg.evaluate(id => openCustLedger(id), C.id); await pg.waitForSelector('[data-gacc-bal]', { timeout: 10000 }).catch(() => {});
  const bal = () => pg.evaluate(() => (document.querySelector('[data-gacc-bal]') || {}).textContent || '');
  ok(/^100\.00\$/.test(await bal()), 'الرصيد = الباقي على فاتورته الآجلة (100$) · فاتورة زبون آخر لا تدخل · الهاتف بصيغة +963 يطابق: ' + await bal());
  await pg.evaluate(() => { window.__ans.push({ reg: '1', limit: '150' }); document.querySelector('[data-gacc-reg]').click(); }); await pg.waitForTimeout(800);
  let D = await H.call('/__dump', undefined, 'GET'); let c = D.gmt_customers.find(x => x.id === C.id);
  ok(c.is_regular === true && Number(c.credit_limit) === 150, '⭐ صار عميلاً دائماً بحدّ 150$');
  await pg.evaluate(() => { window.__ans.push({ amount: '440000', currency: 'SYP', rate: '11000', method: 'cash', note: 'دفعة أولى' }); document.querySelector('[data-gacc-rcpt]').click(); }); await pg.waitForTimeout(900);
  ok(/^60\.00\$/.test(await bal()), '📥 قبض 440000 ل.س بسعر 11000 = 40$ ⇒ الرصيد 60$: ' + await bal());
  D = await H.call('/__dump', undefined, 'GET'); const R = (D.gmt_receipts || [])[0] || {};
  ok(R.customer_id === C.id && Number(R.amount) === 440000 && R.currency === 'SYP' && Number(R.exchange_rate) === 11000, 'السند محفوظ بعملته وسعره وصاحبه');
  await pg.evaluate(() => { window.__ans.push('سُجّل بالغلط'); document.querySelector('[data-gacc-void]').click(); }); await pg.waitForTimeout(900);
  D = await H.call('/__dump', undefined, 'GET');
  ok(/^100\.00\$/.test(await bal()) && D.gmt_receipts.length === 1 && D.gmt_receipts[0].voided === true && D.gmt_receipts[0].void_reason === 'سُجّل بالغلط', 'إلغاء السند بسبب ⇒ يبقى مسجَّلاً (لا حذف) والرصيد يعود 100$');
  const srch = await pg.evaluate(() => { const i = document.querySelector('[data-gacc-q]'); i.value = 'LP-E17'; i.dispatchEvent(new Event('input')); return document.querySelector('[data-gacc-invs]').innerText; });
  ok(/L-2/.test(srch) && !/L-1/.test(srch), '🔎 البحث باسم منتج يجد فاتورته (L-2)');
  await pg.evaluate(() => document.querySelector('[data-gacc-close]').click());
  await pg.evaluate(async id => { await deleteCustomerSovereign(id, 'بلال تجربة'); }, C.id); await pg.waitForTimeout(500);
  D = await H.call('/__dump', undefined, 'GET');
  ok(D.gmt_customers.some(x => x.id === C.id), 'زبونٌ له سندات لا يُحذف');
  ok(!errs.filter(e => !/favicon|404|400|406/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
