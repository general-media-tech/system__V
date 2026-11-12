// (المالك seq 618/620/624 · التدقيق العدائي · المبيع ونقاط البيع) المرتجع والانقطاع:
// ضغطتان معاً على «تأكيد الإرجاع» · كمّية مرتجع أكبر من المباع/سالبة (عبث) · فحص المرتجعات السابقة يفشل (شبكة) · مرتجع المرتجع ·
// بيعٌ والشبكة مقطوعة ثمّ عودتها. كلّ ✘ = ثغرة يجب سدّها.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
const closeDialogs = async pg => { for (let i = 0; i < 5 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); } };
const stock = async id => Number((((await dump()).products || []).find(p => String(p.id) === String(id)) || {}).daraa);
const refundsOf = async invId => ((await dump()).invoices || []).filter(i => String(i.original_invoice_id) === String(invId));
async function sale(pg, pid, cust, qty) {
  await pg.evaluate(([pid, cust, qty]) => { newInvoice(); for (let k = 0; k < qty; k++) addToCartFromDetail(pid); saleType = 'نقدي'; document.getElementById('custName').value = cust; document.getElementById('custPhone').value = ''; }, [pid, cust, qty]);
  await pg.evaluate(() => saveAndFinish());
  for (let i = 0; i < 30; i++) { await pg.waitForTimeout(250); if (((await dump()).invoices || []).some(x => x.customer_name === cust)) break; }
  await pg.waitForTimeout(600); await closeDialogs(pg);
  return ((await dump()).invoices || []).find(x => x.customer_name === cust);
}
async function openRefund(pg, invId) {
  await pg.evaluate(async () => { openInvoiceHistory(); await new Promise(r => setTimeout(r, 1500)); });
  await pg.evaluate(id => startRefundFromHistory(id), invId); await pg.waitForTimeout(1500);
}
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'كاميرا المرتجع', barcode: 'ADVR1', price: 100, wholesale_price: 80, net_cost: 70, cost_price: 70, daraa: 20 }]);
  const { browser, ctx, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });

  // ① ضغطتان معاً على «تأكيد الإرجاع» (فاتورة قطعتين · إرجاع كامل)
  let inv = await sale(pg, P.id, 'زبون الإرجاع المزدوج', 2);
  ok(inv && near(inv.total, 200), 'بيع قطعتين: الإجمالي 200');
  let s0 = await stock(P.id);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('full')); await pg.waitForTimeout(300);
  await pg.evaluate(() => Promise.all([confirmRefund(), confirmRefund()]));
  await pg.waitForTimeout(2500); await closeDialogs(pg);
  let rf = await refundsOf(inv.id); let tot = rf.reduce((s, i) => s + Number(i.total), 0);
  ok(rf.length === 1 && near(tot, -200), 'ضغطتان معاً على «تأكيد الإرجاع» ⇒ مرتجعٌ واحد بـ−200 (' + rf.length + ' · ' + tot + ')');
  ok(await stock(P.id) === s0 + 2, 'والمخزون عاد مرّة واحدة: ' + s0 + ' ⇐ ' + await stock(P.id));

  // ② إعادة الإرجاع بعد اكتماله ⇒ مرفوض
  await openRefund(pg, inv.id); await pg.evaluate(() => { try { setRefundType('full'); } catch (_) {} }); await pg.waitForTimeout(300);
  await pg.evaluate(() => confirmRefund().catch(() => {})); await pg.waitForTimeout(2000); await closeDialogs(pg);
  rf = await refundsOf(inv.id);
  ok(rf.length === 1, 'إرجاع فاتورةٍ مُرجَعة بالكامل ⇒ لا مرتجع ثانٍ (' + rf.length + ')');

  // ③ عبث: كمّية مرتجع أكبر من المباع، وسالبة
  inv = await sale(pg, P.id, 'زبون العبث بالكمّية', 2); s0 = await stock(P.id);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('partial')); await pg.waitForTimeout(300);
  await pg.evaluate(() => { refundSelections = {}; refundItems.forEach(i => refundSelections[i.id || i.product_id] = 50); });
  await pg.evaluate(() => confirmRefund().catch(() => {})); await pg.waitForTimeout(2500); await closeDialogs(pg);
  rf = await refundsOf(inv.id); tot = rf.reduce((s, i) => s + Number(i.total), 0);
  ok(tot >= -200.011 && await stock(P.id) <= s0 + 2, 'مرتجع 50 قطعة من فاتورة قطعتين (عبث) ⇒ لا يتجاوز المباع: المرتجع ' + tot + ' · المخزون ' + s0 + ' ⇐ ' + await stock(P.id));
  inv = await sale(pg, P.id, 'زبون الكمّية السالبة', 2); s0 = await stock(P.id);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('partial')); await pg.waitForTimeout(300);
  await pg.evaluate(() => { refundSelections = {}; refundItems.forEach(i => refundSelections[i.id || i.product_id] = -3); });
  await pg.evaluate(() => confirmRefund().catch(() => {})); await pg.waitForTimeout(2000); await closeDialogs(pg);
  rf = await refundsOf(inv.id);
  ok(rf.length === 0 && await stock(P.id) === s0, 'مرتجع بكمّيةٍ سالبة (عبث) ⇒ لا مرتجع ولا تغيير مخزون (' + rf.length + ')');

  // ④ فحص المرتجعات السابقة يفشل (شبكة) ⇒ يجب أن يتوقّف الإرجاع لا أن يكمل بلا فحص
  inv = await sale(pg, P.id, 'زبون فشل الفحص', 1);
  await openRefund(pg, inv.id); await pg.evaluate(() => setRefundType('full')); await pg.waitForTimeout(300);
  await pg.evaluate(() => confirmRefund().catch(() => {})); await pg.waitForTimeout(2500); await closeDialogs(pg);
  ok((await refundsOf(inv.id)).length === 1, 'مرتجعٌ أوّل سليم (قطعة واحدة)');
  s0 = await stock(P.id);
  let cutCheck = true; await ctx.route(/original_invoice_id=eq\./, r => cutCheck ? r.abort() : r.fallback());           // الفحص ينقطع (fallback ⇒ يعود لمعترض القاعدة الوهمية — لا unroute أبداً)
  await openRefund(pg, inv.id); await pg.evaluate(() => { try { setRefundType('full'); } catch (_) {} }); await pg.waitForTimeout(300);
  await pg.evaluate(() => confirmRefund().catch(() => {})); await pg.waitForTimeout(3000); await closeDialogs(pg);
  cutCheck = false;
  rf = await refundsOf(inv.id); tot = rf.reduce((s, i) => s + Number(i.total), 0);
  ok(rf.length === 1 && near(tot, -100) && await stock(P.id) === s0, 'فحص المرتجعات السابقة انقطع ⇒ لا مرتجع ثانٍ فوق المباع (المرتجعات ' + rf.length + ' · ' + tot + ' · المخزون ' + s0 + ' ⇐ ' + await stock(P.id) + ')');

  // ⑤ مرتجع المرتجع
  const rInv = rf[0];
  await pg.evaluate(async () => { openInvoiceHistory(); await new Promise(r => setTimeout(r, 1500)); });
  await pg.evaluate(id => { try { startRefundFromHistory(id); } catch (_) {} }, rInv.id); await pg.waitForTimeout(1200);
  await pg.evaluate(() => { try { setRefundType('full'); } catch (_) {} }); await pg.evaluate(() => confirmRefund().catch(() => {})); await pg.waitForTimeout(2000); await closeDialogs(pg);
  ok((await refundsOf(rInv.id)).length === 0, 'إرجاع فاتورة المرتجع نفسها ⇒ مرفوض (' + (await refundsOf(rInv.id)).length + ')');

  // ⑥ بيعٌ والشبكة مقطوعة ⇒ لا يضيع ولا يتكرّر بعد عودتها
  s0 = await stock(P.id);
  await pg.evaluate(([pid]) => { newInvoice(); addToCartFromDetail(pid); saleType = 'نقدي'; document.getElementById('custName').value = 'زبون الانقطاع'; }, [P.id]);
  let cutAll = true; await ctx.route(/supabase\.co\//, r => cutAll ? r.abort() : r.fallback());
  await pg.evaluate(() => saveAndFinish().catch(() => {})); await pg.waitForTimeout(4000); await closeDialogs(pg);
  let lost = await pg.evaluate(() => ({ saved: typeof isSaved !== 'undefined' && isSaved, cart: Object.keys(cart).length, q: Object.keys(localStorage).filter(k => /queue|offline|pending/i.test(k)).map(k => k + ':' + (localStorage.getItem(k) || '').length) }));
  ok(lost.saved || lost.cart > 0 || lost.q.some(x => !/:0$|:2$/.test(x)), 'انقطاع أثناء الحفظ ⇒ البيع لم يضع (محفوظ محلّياً أو السلّة باقية): ' + JSON.stringify(lost).slice(0, 200));
  cutAll = false;
  await pg.evaluate(async () => { try { _syncNextAt = 0; await syncPendingInvoices(); } catch (_) {} });   // المزامنة الدورية (كلّ 15 ث) — نطلبها الآن
  for (let i = 0; i < 30; i++) { await pg.waitForTimeout(500); if (((await dump()).invoices || []).some(x => x.customer_name === 'زبون الانقطاع')) break; if (i === 12) await pg.evaluate(async () => { try { _syncNextAt = 0; await syncPendingInvoices(); } catch (_) {} }); }
  await pg.waitForTimeout(1500); await closeDialogs(pg);
  const off = ((await dump()).invoices || []).filter(x => x.customer_name === 'زبون الانقطاع');
  ok(off.length === 1 && await stock(P.id) === s0 - 1, 'بعد عودة الشبكة ⇒ فاتورة واحدة وخصمٌ واحد (' + off.length + ' · المخزون ' + s0 + ' ⇐ ' + await stock(P.id) + ')');

  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|ERR_FAILED|net::/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
