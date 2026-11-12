// (المالك seq 618/620/624 · التدقيق العدائي · المبيع ونقاط البيع) المال: كوبون فوق 100% / أكبر من الإجمالي · خصم حلب من موظّف ·
// دفعة آجل شاذّة · تقريب السنت · فاتورة بأسطر كثيرة · عبث بنسبة العمولة. كلّ ✘ = ثغرة أو قرارٌ للمالك.
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
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'عدسة المال', barcode: 'ADVM1', price: 200, wholesale_price: 160, net_cost: 140, cost_price: 140, daraa: 50 },
    { name: 'سلعة الكسور', barcode: 'ADVM2', price: 33.33, wholesale_price: 20, net_cost: 15, cost_price: 15, daraa: 50 },
    { name: 'سلعة السنت', barcode: 'ADVM3', price: 0.1, wholesale_price: 0.05, net_cost: 0.02, cost_price: 0.02, daraa: 80 }]);
  await H.call('/rest/v1/gmt_coupons', [
    { code: 'OVER150', discount_type: 'percent', discount_value: 150, is_used: false },
    { code: 'FIX999', discount_type: 'fixed', discount_value: 999, is_used: false },
    { code: 'NEG', discount_type: 'fixed', discount_value: -50, is_used: false }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });

  // ① كوبون 150% / ثابت أكبر من الإجمالي / سالب
  for (const [code, nm] of [['OVER150', 'كوبون 150%'], ['FIX999', 'كوبون ثابت 999 على فاتورة 200'], ['NEG', 'كوبون سالب −50']]) {
    await sell(pg, { lines: [[A.id, 1]], name: 'زبون ' + code, coupon: code });
    const inv = (await invOf('زبون ' + code))[0];
    if (code === 'NEG') ok(!inv || (near(inv.total, 200) && !(Number(inv.discount_amount) < 0)), nm + ' ⇒ لا يزيد الفاتورة ولا خصم سالب: ' + (inv ? inv.total + ' · خصم ' + inv.discount_amount : 'لم تُحفظ'));
    else ok(!inv || Number(inv.total) > 0, nm + ' ⇒ لا تُحفظ فاتورة بإجمالي صفر من موظّف (' + (inv ? 'حُفظت بإجمالي ' + inv.total + ' · خصم ' + inv.discount_amount : 'لم تُحفظ') + ')');
    if (inv) ok(Number(inv.total) >= 0 && Number(inv.discount_amount || 0) <= 200.011, nm + ': الخصم لا يتجاوز الإجمالي والإجمالي غير سالب');
  }

  // ② خصم حلب اليدوي من موظّف درعا (عبث بالحقل)
  await sell(pg, { lines: [[A.id, 1]], name: 'زبون خصم حلب', pre: `(() => { let e = document.getElementById('haleb-manual-discount'); if (!e) { e = document.createElement('input'); e.id = 'haleb-manual-discount'; document.body.appendChild(e); } e.value = '150'; })()` });
  let inv = (await invOf('زبون خصم حلب'))[0];
  ok(inv && near(inv.total, 200) && !Number(inv.discount_amount), 'خصم حلب اليدوي من موظّف درعا (عبث) ⇒ لا خصم: ' + (inv && inv.total + ' · ' + inv.discount_amount));

  // ③ دفعة الآجل الشاذّة
  for (const [v, nm] of [[-5, 'سالبة'], [201, 'أكبر من الإجمالي']]) {   // الحقل رقميّ: المتصفّح نفسه يرفض النصّ
    await sell(pg, { lines: [[A.id, 1]], name: 'زبون دفعة ' + nm, phone: '0944000' + String(100 + Math.abs(parseInt(v) || 7)).slice(-3), type: 'آجل (شحن)', partial: v });
    ok(!(await invOf('زبون دفعة ' + nm)).length, 'آجل بدفعة ' + nm + ' (' + v + ') ⇒ لا تُحفظ');
    await closeDialogs(pg);
  }
  await sell(pg, { lines: [[A.id, 1]], name: 'زبون دفعة سليمة', phone: '0944000999', type: 'آجل (شحن)', partial: 50.5 });
  inv = (await invOf('زبون دفعة سليمة'))[0];
  ok(inv && near(inv.paid_amount, 50.5) && near(inv.remaining_amount, 149.5) && near(Number(inv.paid_amount) + Number(inv.remaining_amount), inv.total), 'آجل بدفعة 50.5 ⇒ مقبوض 50.5 · متبقٍّ 149.5 · المجموع = الإجمالي');

  // ④ تقريب السنت: 3×33.33 + 7×0.1
  await sell(pg, { lines: [[B.id, 3], [C.id, 7]], name: 'زبون الكسور' });
  inv = (await invOf('زبون الكسور'))[0];
  let its = inv ? ((await dump()).invoice_items || []).filter(i => String(i.invoice_id) === String(inv.id)) : [];
  const sumIt = its.reduce((s, i) => s + Number(i.total), 0);
  ok(inv && near(inv.total, 100.69) && near(sumIt, inv.total) && near(inv.paid_amount, inv.total) && /^\d+(\.\d{1,2})?$/.test(String(inv.total)), 'كسور: 3×33.33 + 7×0.1 = 100.69 · مجموع البنود = الإجمالي = المقبوض · بلا كسورٍ عائمة: ' + (inv && inv.total + ' · ' + sumIt));

  // ⑤ فاتورة بـ40 قطعة من 3 أصناف
  await sell(pg, { lines: [[A.id, 12], [B.id, 14], [C.id, 14]], name: 'زبون الأسطر' });
  inv = (await invOf('زبون الأسطر'))[0];
  its = inv ? ((await dump()).invoice_items || []).filter(i => String(i.invoice_id) === String(inv.id)) : [];
  const exp = Math.round((12 * 200 + 14 * 33.33 + 14 * 0.1) * 100) / 100;
  ok(inv && near(inv.total, exp) && near(its.reduce((s, i) => s + Number(i.total), 0), exp) && Number(inv.items_count) === 40, '40 قطعة: الإجمالي ' + exp + ' = مجموع البنود · العدد 40: ' + (inv && inv.total + ' · ' + inv.items_count));

  // ⑥ عبث بنسبة العمولة (F12)
  const rates = await pg.evaluate(() => { const o = {}; for (const v of [5, -1, NaN, 'x', 1.01]) { COMMISSION_RATE = v; o[String(v)] = commissionRate(); } COMMISSION_RATE = 0.5; return o; });
  ok(Object.values(rates).every(v => v === 0.5), 'نسبة عمولة خارج 0..1 (5 · −1 · NaN · نص · 1.01) ⇒ تعود 50%: ' + JSON.stringify(rates));

  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
