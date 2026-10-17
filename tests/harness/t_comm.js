const H = require('./h.js');
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const inv = await H.call('/rest/v1/invoices', [{ inv_number: 'INV-1', branch_key: 'haleb', branch_name: 'حلب', total: 200, customer_name: 'زبون', cashier_name: 'سامر', status: 'pending', created_at: new Date().toISOString() }, { inv_number: 'INV-2', branch_key: 'haleb', branch_name: 'حلب', total: 300, customer_name: 'زبون2', cashier_name: 'سامر', status: 'pending', created_at: new Date().toISOString() }]);
  const cm = await H.call('/rest/v1/invoice_commissions', [{ invoice_id: inv[1].id, branch_key: 'haleb', amount: 10, paid: false, approved: false }, { invoice_id: inv[1].id, branch_key: 'haleb', amount: 4, paid: false, approved: false }]);
  const { browser, pg, errs } = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1200, h: 900, wait: 7000, mobile: false });
  // ١) عمولة جديدة بلا موافقة ثانية
  await pg.evaluate((id) => { const i = document.createElement('input'); i.id = 'comm-amount-' + id; i.value = '12.5'; document.body.appendChild(i); const n = document.createElement('input'); n.id = 'comm-note-' + id; n.value = 'اختبار'; document.body.appendChild(n); }, inv[0].id);
  await pg.evaluate(([id]) => saveCommission(id, 'haleb'), [inv[0].id]); await pg.waitForTimeout(1200);
  let rows = (await H.call('/__dump', undefined, 'GET')).invoice_commissions;
  const nw = rows.find(r => String(r.invoice_id) === String(inv[0].id));
  ok(nw && nw.approved === true && nw.approved_at && nw.amount === 12.5, 'عمولة جديدة تُحفَظ معتمَدةً مباشرةً: ' + JSON.stringify(nw && { a: nw.amount, ap: nw.approved }));
  ok(await pg.evaluate(() => { const c = invComm(window.__id0 || allComm.find(x => x.amount === 12.5).invoice_id); return !!c && c.approved === true; }), 'الواجهة لا تعدّها «بانتظار موافقة»');
  // ٢) تعديل عمولة غير معتمدة ⇒ تُعتمد هي وصفوف فاتورتها
  await pg.evaluate(([id]) => { const a = document.createElement('input'); a.id = 'comm-edit-amount-' + id; a.value = '20'; document.body.appendChild(a); const n = document.createElement('input'); n.id = 'comm-edit-note-' + id; n.value = 'تعديل الأدمن'; document.body.appendChild(n); }, [cm[0].id]);
  await pg.evaluate(([id]) => editCommission(id), [cm[0].id]); await pg.waitForTimeout(1500);
  rows = (await H.call('/__dump', undefined, 'GET')).invoice_commissions;
  const mine = rows.filter(r => String(r.invoice_id) === String(inv[1].id));
  console.log('   ', JSON.stringify(mine.map(r => ({ id: r.id, a: r.amount, ap: r.approved }))));
  ok(mine.length === 2 && mine.every(r => r.approved === true), 'تعديل الأدمن للعمولة ⇒ تُعتمد كلّ صفوف الفاتورة (لا موافقة ثانية)');
  ok(Math.abs(mine.reduce((t, r) => t + r.amount, 0) - 20) < 0.01, 'مجموع صفوف الفاتورة = ما كتبه الأدمن (٢٠)');
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();
})();
