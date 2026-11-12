// (المالك seq 632/636 · البرومبت الرئيسي §8.3 «العمولات بجميع الحالات» و§8.4 «حدود السعر والعمولة معاً») — الحالات المنطبقة على نموذج النظام:
// نسبة واحدة من الإعدادات × (السعر الفعلي بعد الخصم − الجملة) × الكمية، تُحفظ لحظة البيع. أرقام الدوائر = رقم الحالة في البرومبت.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
const closeDialogs = async pg => { for (let i = 0; i < 5 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); } };
const view = pg => pg.evaluate(() => (document.querySelector('.view.active') || {}).id || '');
const invOf = async n => ((await dump()).invoices || []).filter(i => i.customer_name === n);
async function sell(pg, { lines, name, phone, type, partial, coupon, pre }) {
  await pg.evaluate(() => { newInvoice(); goTo('v-products'); }); await pg.waitForTimeout(300);
  for (const [id, n] of lines) for (let k = 0; k < n; k++) { await pg.evaluate(i => toggleProd(i), id); await pg.waitForTimeout(60); }
  await pg.evaluate(() => { goTo('v-cart'); renderCart(); }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { goTo('v-checkout'); renderCheckout(); }); await pg.waitForTimeout(300);
  if (type) await pg.click(`#saleTypeBtns [data-type="${type}"]`);
  await pg.fill('#custName', name);
  if (phone) await pg.fill('#custPhone', phone);
  if (partial != null) await pg.fill('#partialPaymentAmount', String(partial));
  const okv = await pg.evaluate(() => { const r = validateCheckout(); if (r) { goTo('v-print'); renderPrint(); } return !!r; });
  if (!okv) return { blocked: true };
  await pg.waitForTimeout(300);
  if (coupon) { await pg.fill('#couponCode', coupon); await pg.click('[onclick="applyCouponCode()"]'); await pg.waitForTimeout(1200); }
  if (pre) await pg.evaluate(pre);
  await pg.click('#btn-save-invoice');
  for (let i = 0; i < 24 && (await view(pg)) !== 'v-success'; i++) { await pg.waitForTimeout(250); if (i === 12) await closeDialogs(pg); }
  await closeDialogs(pg);
  return { blocked: false, view: await view(pg) };
}
async function openRefund(pg, invId) {
  await pg.evaluate(async () => { openInvoiceHistory(); await new Promise(r => setTimeout(r, 1500)); });
  await pg.evaluate(id => startRefundFromHistory(id), invId); await pg.waitForTimeout(1500);
}
const comm = async invId => ((await dump()).invoice_commissions || []).filter(c => String(c.invoice_id) === String(invId));
const sum = rows => Math.round(rows.reduce((t, r) => t + Number(r.amount || 0), 0) * 100) / 100;
(async () => {
  await H.seed();
  const [A, B, Z] = await H.call('/rest/v1/products', [
    { name: 'عدسة العمولة', barcode: 'CMX1', price: 200, wholesale_price: 160, net_cost: 140, cost_price: 140, daraa: 90 },
    { name: 'سلعة الكسور', barcode: 'CMX2', price: 33.33, wholesale_price: 20, net_cost: 15, cost_price: 15, daraa: 90 },
    { name: 'بلا جملة', barcode: 'CMX3', price: 50, wholesale_price: 0, net_cost: 30, cost_price: 30, daraa: 90 }]);
  await H.call('/rest/v1/gmt_coupons', [{ code: 'TEN', discount_type: 'percent', discount_value: 10, is_used: false }]);
  let { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const one = async (name, o) => { await sell(pg, Object.assign({ name }, o)); const inv = (await invOf(name))[0]; return { inv, rows: inv ? await comm(inv.id) : [] }; };

  // ③ عمولة طبيعية · ⑱ تتغيّر مع الكمية
  let r = await one('ع طبيعية', { lines: [[A.id, 1]] });
  ok(r.inv && near(sum(r.rows), 20), '③ عمولة طبيعية: (200−160)×50% = 20 ⇒ ' + sum(r.rows));
  r = await one('ع كمية', { lines: [[A.id, 3]] });
  ok(r.inv && near(sum(r.rows), 60), '⑱ الكمية ×3 ⇒ العمولة 60 ⇒ ' + sum(r.rows));
  // ⑨⑩ عشرية ودقّة كبيرة: 3 × (33.33−20) × 50% = 19.995 ⇒ تُقرَّب لسنتين ولا كسور عائمة
  r = await one('ع كسور', { lines: [[B.id, 3]] });
  ok(r.inv && Math.abs(sum(r.rows) - 19.995) <= 0.0051 && r.rows.every(x => Math.abs(x.amount * 100 - Math.round(x.amount * 100)) < 1e-6), '⑨⑩ عمولة عشرية تُخزَّن بسنتين بلا كسور عائمة: ' + JSON.stringify(r.rows.map(x => x.amount)));
  // ① عمولة صفرية: منتج بلا سعر جملة
  r = await one('ع صفر', { lines: [[Z.id, 2]] });
  ok(r.inv && near(sum(r.rows), 0), '① منتج بلا سعر جملة ⇒ لا عمولة (لا صفّ أو صفر): ' + sum(r.rows) + ' · صفوف ' + r.rows.length);
  // ⑲ بعد الخصم: كوبون 10% ⇒ السعر الفعلي 180 ⇒ (180−160)×50% = 10
  r = await one('ع خصم', { lines: [[A.id, 1]], coupon: 'TEN' });
  ok(r.inv && near(r.inv.total, 180) && near(sum(r.rows), 10), '⑲ العمولة على ما دفعه الزبون بعد الخصم (180) = 10 لا 20 ⇒ ' + sum(r.rows) + ' · إجمالي ' + (r.inv && r.inv.total));
  // ㉑ آجل بدفعة جزئية: العمولة كاملة مسجَّلة ومعلّقة الدفع (لا تُصرف) — تحصيلها لاحقاً لا يضاعفها
  r = await one('ع آجل', { lines: [[A.id, 1]], type: 'آجل (شحن)', phone: '0944000111', partial: 50 });
  ok(r.inv && near(sum(r.rows), 20) && r.rows.every(x => x.paid !== true), '㉑ فاتورة آجل بدفعة جزئية: عمولة 20 مسجَّلة وغير مصروفة: ' + JSON.stringify(r.rows.map(x => [x.amount, x.paid])));
  // ⑰ السعر المعدَّل يدوياً: 170 (فوق الجملة) ⇒ (170−160)×50% = 5
  r = await one('ع سعر معدّل', { lines: [[A.id, 1]], pre: null });
  const N = 'ع سعر يدوي';
  await pg.evaluate(() => { newInvoice(); goTo('v-products'); }); await pg.waitForTimeout(300);
  await pg.evaluate(id => toggleProd(id), A.id); await pg.evaluate(id => { goTo('v-cart'); renderCart(); updPriceCart(id, 170); }, A.id); await pg.waitForTimeout(400); await closeDialogs(pg);
  await pg.evaluate(() => { goTo('v-checkout'); renderCheckout(); }); await pg.fill('#custName', N);
  await pg.evaluate(() => { if (validateCheckout()) { goTo('v-print'); renderPrint(); } }); await pg.waitForTimeout(300); await pg.click('#btn-save-invoice');
  for (let i = 0; i < 24 && (await view(pg)) !== 'v-success'; i++) { await pg.waitForTimeout(250); if (i === 12) await closeDialogs(pg); } await closeDialogs(pg);
  let iv = (await invOf(N))[0];
  ok(iv && near(iv.total, 170) && near(sum(await comm(iv.id)), 5), '⑰ سعر عُدِّل يدوياً إلى 170 ⇒ العمولة 5 ⇒ ' + (iv ? sum(await comm(iv.id)) : 'لم تُحفظ'));
  // ㉔ استرداد كامل ⇒ صافي عمولة الفاتورة صفر · ㉕ لا يُعكس مرّتين
  iv = (await invOf('ع كمية'))[0];
  await openRefund(pg, iv.id); await pg.evaluate(() => setRefundType('full')); await pg.waitForTimeout(300);
  await pg.evaluate(() => Promise.all([confirmRefund(), confirmRefund()]).catch(() => {})); await pg.waitForTimeout(3000); await closeDialogs(pg);
  let rows = await comm(iv.id);
  ok(near(sum(rows), 0) && rows.filter(x => x.amount < 0).length === 1, '㉔㉕ استرداد كامل (بضغطتين معاً) ⇒ صافي العمولة 0 وعكسٌ واحد لا اثنان: ' + JSON.stringify(rows.map(x => x.amount)));
  // §8.4 تغيير إعدادات العمولة بعد الفاتورة ⇒ القديم لا يتغيّر والجديد بالنسبة الجديدة
  const before = sum(await comm((await invOf('ع طبيعية'))[0].id));
  await H.call('/rest/v1/gmt_settings?key=eq.commission_rate', undefined, 'DELETE').catch(() => {});
  await H.call('/rest/v1/gmt_settings', [{ key: 'commission_rate', value: '0.2' }]);
  await browser.close(); ({ browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }));
  r = await one('ع نسبة جديدة', { lines: [[A.id, 1]] });
  const after = sum(await comm((await invOf('ع طبيعية'))[0].id));
  ok(near(before, 20) && near(after, 20), '§8.4 تغيير نسبة العمولة إلى 20% ⇒ عمولة الفاتورة القديمة لم تتغيّر (20 ⇒ ' + after + ')');
  ok(r.inv && near(sum(r.rows), 8), '§8.4 الفاتورة الجديدة بالنسبة الجديدة: (200−160)×20% = 8 ⇒ ' + sum(r.rows));
  // ㉙ إعدادات تالفة ⇒ ترجع 50%
  await H.call('/rest/v1/gmt_settings?key=eq.commission_rate', { value: 'abc' }, 'PATCH');
  await browser.close(); ({ browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 }));
  r = await one('ع إعداد تالف', { lines: [[A.id, 1]] });
  ok(r.inv && near(sum(r.rows), 20), '㉙ قيمة الإعداد «abc» ⇒ النسبة الافتراضية 50% ⇒ ' + sum(r.rows));
  const real = errs.filter(e => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
