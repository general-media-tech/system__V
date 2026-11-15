// (TASK-A0501 · خطّة التنفيذ VER-1#REQ-0016 · Fable) المرتجع يعكس العمولة **المسجَّلة فعلاً** على الفاتورة —
// حتى لو كانت الفاتورة مربوطة بأوردر (عمولة استثنائية من الأدمن ن٤ أو فاتورة قديمة). كان الشرط «لا order_id» يتخطّى العكس كلّياً
// فيبقى للموظّف عمولة بيعٍ أُرجع. ولا تُنشأ عمولة جديدة لفاتورة أوردر بلا عمولة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
const closeDialogs = async pg => { for (let i = 0; i < 5 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); } };
const commOf = async invId => ((await dump()).invoice_commissions || []).filter(c => String(c.invoice_id) === String(invId));
const refundsOf = async invId => ((await dump()).invoices || []).filter(i => String(i.original_invoice_id) === String(invId));
async function sale(pg, pid, cust, qty) {
  await pg.evaluate(([pid, cust, qty]) => { newInvoice(); for (let k = 0; k < qty; k++) addToCartFromDetail(pid); saleType = 'نقدي'; document.getElementById('custName').value = cust; document.getElementById('custPhone').value = '0999000111'; }, [pid, cust, qty]);
  await pg.evaluate(() => saveAndFinish());
  for (let i = 0; i < 30; i++) { await pg.waitForTimeout(250); if (((await dump()).invoices || []).some(x => x.customer_name === cust)) break; }
  await pg.waitForTimeout(600); await closeDialogs(pg);
  return ((await dump()).invoices || []).find(x => x.customer_name === cust);
}
async function openRefund(pg, invId) {
  await pg.evaluate(async () => { openInvoiceHistory(); await new Promise(r => setTimeout(r, 1500)); });
  await pg.evaluate(id => startRefundFromHistory(id), invId); await pg.waitForTimeout(1500);
}
// يحوّل فاتورة مبيعٍ إلى «فاتورة أوردر»: order_id عليها، وعمولتها التلقائية تُزال (الأصل: فاتورة الأوردر بلا عمولة)
async function makeOrderInvoice(inv, orderId, adminComm) {
  await H.call('/rest/v1/invoices?id=eq.' + inv.id, { order_id: orderId }, 'PATCH');
  await H.call('/rest/v1/invoice_commissions?invoice_id=eq.' + inv.id, undefined, 'DELETE');
  if (adminComm) await H.call('/rest/v1/invoice_commissions', [{ invoice_id: inv.id, branch_key: inv.branch_key || 'daraa', cashier_name: inv.cashier_name || 'موظّف', amount: adminComm, note: 'عمولة استثنائية — الأدمن', paid: false, approved: true, created_by: 'admin' }]);
}
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'عدسة عمولة الأوردر', barcode: 'ROC1', price: 100, wholesale_price: 80, net_cost: 70, cost_price: 70, daraa: 20 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });

  // ① فاتورة أوردر عليها عمولة استثنائية 5$ ⇐ مرتجع كامل من نقطة البيع ⇐ صفّ عكس −5
  let inv = await sale(pg, P.id, 'زبون أوردر بعمولة', 2);
  await makeOrderInvoice(inv, 9001, 5);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('full')); await pg.waitForTimeout(300);
  await pg.evaluate(() => confirmRefund()); await pg.waitForTimeout(2500); await closeDialogs(pg);
  ok((await refundsOf(inv.id)).length === 1, '① مرتجع كامل لفاتورة أوردر تمّ');
  let cm = await commOf(inv.id); let net = cm.reduce((s, c) => s + Number(c.amount), 0);
  let rev = cm.filter(c => c.created_by === 'auto_refund_reversal');
  ok(rev.length === 1 && near(rev[0].amount, -5) && near(net, 0), '① عمولة الأوردر الاستثنائية 5$ انعكست: صفّ −5 والصافي 0 (الصفوف ' + cm.length + ' · العكس ' + (rev[0] && rev[0].amount) + ' · الصافي ' + net + ')');

  // ② فاتورة أوردر بعمولة 6$ ⇐ مرتجع جزئي (قطعة من قطعتين) ⇐ عكس نصفها −3
  inv = await sale(pg, P.id, 'زبون أوردر جزئي', 2);
  await makeOrderInvoice(inv, 9002, 6);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('partial')); await pg.waitForTimeout(300);
  await pg.evaluate(() => { refundSelections = {}; refundItems.forEach(i => refundSelections[i.id || i.product_id] = 1); });
  await pg.evaluate(() => confirmRefund()); await pg.waitForTimeout(2500); await closeDialogs(pg);
  cm = await commOf(inv.id); rev = cm.filter(c => c.created_by === 'auto_refund_reversal');
  ok(rev.length === 1 && near(rev[0].amount, -3), '② مرتجع نصف فاتورة أوردر ⇒ عكس نصف العمولة −3 (' + (rev[0] && rev[0].amount) + ')');

  // ③ فاتورة أوردر بلا عمولة ⇐ مرتجع ⇐ لا صفّ عمولة يُنشأ
  inv = await sale(pg, P.id, 'زبون أوردر بلا عمولة', 1);
  await makeOrderInvoice(inv, 9003, 0);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('full')); await pg.waitForTimeout(300);
  await pg.evaluate(() => confirmRefund()); await pg.waitForTimeout(2500); await closeDialogs(pg);
  ok((await refundsOf(inv.id)).length === 1 && (await commOf(inv.id)).length === 0, '③ فاتورة أوردر بلا عمولة ⇒ مرتجع بلا أيّ صفّ عمولة (' + (await commOf(inv.id)).length + ')');

  // ④ مسار الأوردرات (GMTRefund.full · orderLinked) ⇐ يعكس العمولة المسجَّلة أيضاً
  inv = await sale(pg, P.id, 'زبون أوردر من الأوردرات', 1);
  await makeOrderInvoice(inv, 9004, 4);
  const r4 = await pg.evaluate(async id => {
    if (!window.GMTRefund) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'gmt-refund.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    const x = await GMTRefund.full({ url: CONFIG.SUPABASE_URL, headers: () => sbHeaders(), invoiceId: id, orderLinked: true });
    return { ok: !!(x && (x.ok || x.refund || x.done)), issues: (x && x.issues) || [], raw: Object.keys(x || {}) };
  }, inv.id);
  cm = await commOf(inv.id); rev = cm.filter(c => c.created_by === 'auto_refund_reversal');
  ok(rev.length === 1 && near(rev[0].amount, -4), '④ مرتجع من الأوردرات لفاتورة أوردر بعمولة 4$ ⇒ صفّ −4 (' + (rev[0] && rev[0].amount) + ' · ' + JSON.stringify(r4).slice(0, 120) + ')');

  // ⑤ بلا تراجع: فاتورة عادية (بلا أوردر) بعمولتها التلقائية ⇐ مرتجع كامل ⇐ الصافي 0
  inv = await sale(pg, P.id, 'زبون عادي', 1);
  const c0 = (await commOf(inv.id)).reduce((s, c) => s + Number(c.amount), 0);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('full')); await pg.waitForTimeout(300);
  await pg.evaluate(() => confirmRefund()); await pg.waitForTimeout(2500); await closeDialogs(pg);
  net = (await commOf(inv.id)).reduce((s, c) => s + Number(c.amount), 0);
  ok(near(net, 0), '⑤ فاتورة عادية: العمولة ' + c0 + ' ⇒ بعد المرتجع الكامل الصافي ' + net);

  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|ERR_FAILED|net::|navigator\.vibrate/.test(e));
  ok(real.length === 0, 'بلا أخطاء JS' + (real.length ? ' → ' + real.slice(0, 2).join(' | ') : ''));
  console.log('\nRESULT ' + (fails ? 'FAIL' : 'ALL PASS') + ' (' + pass + ' ✔ · ' + fails + ' ✘)');
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
