// (seq B1043 «راجع صحّة العطلين» · الفحص الشامل) ① المشتريات←الجرد: مصادر المخزون المعروفة لا تُعدّ خللاً —
//   بالطريق (ألمانيا/الصين) · شراء فوري · إعادة إنشاء مستلَمة · والخلل الحقيقي (مخزون محلّي بلا أيّ مصدر) يُذكر باسمه
// ② العمولة←التسوية: عمولةٌ دُفعت قبل وجود التسويات = بيانات قديمة لا خلل · بعد أوّل تسوية بلا ربط = خلل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/inv_columns', { key_name: 'china', display_name: 'الصين', col_type: 'number', include_in_total: false, is_branch: true, show_form: true, show_table: true, sort_order: 9 });
  const old = new Date(Date.now() - 30 * 864e5).toISOString(), now = new Date().toISOString();
  const P = await H.call('/rest/v1/products', [
    { name: 'مستلَم', barcode: 'S1', haleb: 2, created_at: now }, { name: 'بالطريق', barcode: 'S2', china: 5, created_at: now },
    { name: 'فوري', barcode: 'S3', haleb: 1, created_at: now }, { name: 'إعادة إنشاء', barcode: 'S4', haleb: 1, created_at: now },
    { name: 'يتيم حقيقي', barcode: 'S5', haleb: 1, created_at: now }]);
  await H.call('/rest/v1/stock_receipts', [{ product_id: 'zzz', branch_key: 'haleb', qty: 1, kind: 'transfer_arrive', created_at: old }, { product_id: P[0].id, branch_key: 'haleb', qty: 2, kind: 'transfer_arrive', created_at: now }]);
  await H.call('/rest/v1/import_log', { inv_number: 'PO-2026-0901', inv_type: 'instant', status: 'arrived', dest_branch: 'haleb', items_snapshot: [{ id: P[2].id, name: 'فوري', qty: 1 }] });
  const [T] = await H.call('/rest/v1/branch_stock_transfers', { transfer_number: 'TRF-00901', from_branch: 'rebuild', to_branch: 'haleb', status: 'received' });
  await H.call('/rest/v1/stock_transfer_items', { transfer_id: T.id, product_id: P[3].id, product_name: 'إعادة إنشاء', qty: 1 });
  await H.call('/rest/v1/invoice_commissions', { invoice_id: 'legacy-1', branch_key: 'homs', amount: 9, paid: true, paid_at: old });
  const run = async () => { const o = await H.open('checks.html', { w: 1200, h: 900, wait: 3500 });
    const L = await o.pg.evaluate(async () => Object.fromEntries((await GMTIntegrationTests.run()).map(x => [x.id, x]))); await o.browser.close(); return L; };
  let L = await run();
  const pi = L['purchase-inventory'] || {}, cs = L['commission-settlement'] || {};
  ok(pi.ok === false && /^1 منتج/.test(pi.msg) && /يتيم حقيقي/.test(pi.detail || '') && !/فوري ·|بالطريق ·/.test((pi.detail || '').split('—')[0]), '① الخلل الحقيقي وحده يُذكر باسمه: ' + pi.msg + ' | ' + pi.detail);
  ok(/1 بالطريق/.test(pi.detail || '') && /1 شراء فوري/.test(pi.detail || '') && /1 إعادة إنشاء/.test(pi.detail || ''), '① المصادر المعروفة معدودة لا خلل: بالطريق · شراء فوري · إعادة إنشاء');
  ok(cs.ok === true && /قبل وجود التسويات/.test(cs.msg), '② عمولة دُفعت قبل التسويات ⇒ بيانات قديمة لا خلل: ' + cs.msg);
  await H.call('/rest/v1/gmt_settlements', { branch_key: 'homs', amount: 5, created_at: new Date(Date.now() - 10 * 864e5).toISOString() });
  await H.call('/rest/v1/invoice_commissions', { invoice_id: 'new-1', branch_key: 'homs', amount: 4, paid: true, paid_at: now });
  L = await run();
  ok(L['commission-settlement'].ok === false && /^1 عمولة/.test(L['commission-settlement'].msg), '② مدفوعة بعد بدء التسويات بلا ربط ⇒ خلل: ' + L['commission-settlement'].msg);
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
