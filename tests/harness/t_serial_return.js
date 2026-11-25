// TASK-B0544 · المالك seq B1038 «المرتجع/الاستبدال يطابق الرقم»: إرجاع بند بأرقام أجهزة ⇒ الأجهزة «مرتجع» بسجلّها (+ حدث بتاريخها)
// جزئي ⇒ تختار أيّ جهاز رجع (لا تخمين) · جهاز مبيوع بفاتورة تانية ما بيتلمس · المرتجع الكامل من الأوردرات (GMTRefund) كمان
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const closeDialogs = async pg => { for (let i = 0; i < 5 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); } };
const A = '356938035643809', B = '490154203237518', C = 'SNX12345AB';
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'موبايل تجربة', barcode: 'SRT1', price: 100, cost_price: 70, daraa: 5, serial_req: 'imei' }]);
  const [I] = await H.call('/rest/v1/invoices', [{ inv_number: 'S-SR1', branch_key: 'daraa', branch_name: 'درعا', total: 200, paid_amount: 200, remaining_amount: 0, payment_status: 'paid', sale_type: 'نقدي', customer_name: 'زبون الأرقام', created_at: new Date().toISOString(), is_refund: false }]);
  await H.call('/rest/v1/invoice_items', [{ invoice_id: I.id, product_id: P.id, product_name: P.name, qty: 2, unit_price: 100, price: 100, serials: [{ code: A, kind: 'imei' }, { code: B, kind: 'imei' }] }]);
  await H.call('/rest/v1/gmt_serials', [
    { code: A, kind: 'imei', status: 'sold', product_id: P.id, sale_invoice_id: String(I.id), sale_inv_number: 'S-SR1', history: [{ ev: 'sold', ref: 'S-SR1' }] },
    { code: B, kind: 'imei', status: 'sold', product_id: P.id, sale_invoice_id: String(I.id), sale_inv_number: 'S-SR1', history: [{ ev: 'sold', ref: 'S-SR1' }] },
    { code: C, kind: 'serial', status: 'sold', product_id: P.id, sale_invoice_id: '999999', sale_inv_number: 'S-OTHER', history: [] }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  await pg.evaluate(() => { window.__pick = null; GMTAsk.form = async (m, o) => { window.__formMsg = m; const v = {}; o.fields.forEach(f => v[f.k] = window.__pick); if (o.submit && o.submit(v) !== true) return null; return v; }; });
  await pg.evaluate(async () => { openInvoiceHistory(); await new Promise(r => setTimeout(r, 1800)); });
  await pg.evaluate(id => startRefundFromHistory(id), I.id); await pg.waitForTimeout(1500);
  // جزئي: قطعة وحدة — الجهاز التاني (B)
  await pg.evaluate(([B]) => { window.__pick = B; setRefundType('partial'); const it = refundItems[0]; refundSelections[it.id || it.product_id] = 1; }, [B]);
  await pg.evaluate(() => confirmRefund()); await pg.waitForTimeout(2500); await closeDialogs(pg);
  let S = (await dump()).gmt_serials; const st = c => (S.find(x => x.code === c) || {}).status;
  ok(await pg.evaluate(() => /أيّ جهاز رجع/.test(window.__formMsg || '')), 'المرتجع الجزئي بيسأل: أيّ جهاز رجع؟');
  ok(st(B) === 'returned' && st(A) === 'sold', 'الجهاز يلي اخترته بس صار «مرتجع» — التاني ضلّ «مبيوع» (' + st(A) + ' · ' + st(B) + ')');
  const hb = (S.find(x => x.code === B).history || []).slice(-1)[0] || {};
  ok(hb.ev === 'returned' && /^R-/.test(hb.ref || ''), 'حدث «أُرجع» بتاريخ الجهاز مع رقم فاتورة الإرجاع: ' + JSON.stringify(hb));
  ok(st(C) === 'sold', 'جهاز مبيوع بفاتورة تانية ما بيتلمس');
  // المرتجع الكامل من الأوردرات (GMTRefund) ⇒ الجهاز الباقي A
  const r = await pg.evaluate(async id => { const o = { url: CONFIG.SUPABASE_URL, headers: sbHeaders, invoiceId: id, reason: 'تجربة', stockBranch: 'daraa', cashier: 'اختبار' };
    if (!window.GMTRefund) { await new Promise(res => { const s = document.createElement('script'); s.src = 'gmt-refund.js'; s.onload = res; document.head.appendChild(s); }); }
    const x = await GMTRefund.full(o); return { sr: x.serialsReturned, already: x.already }; }, I.id);
  S = (await dump()).gmt_serials;
  ok(st(A) === 'returned', 'المرتجع الكامل من الأوردرات ⇒ الجهاز الباقي «مرتجع» كمان (' + JSON.stringify(r) + ')');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
