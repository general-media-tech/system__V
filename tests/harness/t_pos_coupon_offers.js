// (TASK-A0503 · خطّة التنفيذ VER-1#REQ-0092 · قرار المالك ق١٦ «الكوبون لا يُجمع مع سعر العرض») نقطة البيع:
// الكوبون يُحسب على البنود غير المعروضة فقط — كما في المتجر وكما يقول تلميح الزرّ. كان يُحسب على السلّة كلّها (خصم مزدوج على العرض).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;
const closeDialogs = async pg => { for (let i = 0; i < 5 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); } };
// سلّة: منتج «عرض» (موسوم _from_offer كما تفعل نقطة البيع عند بيع عرضٍ مفكّكاً) + منتج عادي، مع كوبون مفعَّل
const setCart = (pg, offerId, normalId, coupon) => pg.evaluate(([o, n, cp]) => {
  newInvoice(); if (o) { addToCartFromDetail(o); cart[o]._from_offer = 'OFFER_T'; cart[o]._offer_name = 'عرض اختبار'; } if (n) addToCartFromDetail(n);
  saleType = 'نقدي'; _activeCoupon = cp; document.getElementById('couponCode').value = cp ? cp.code : '';
  return computeOrderLinkedTotal();
}, [offerId, normalId, coupon]);
(async () => {
  await H.seed();
  const [PO] = await H.call('/rest/v1/products', [{ name: 'منتج بسعر عرض', barcode: 'CPO1', price: 100, wholesale_price: 60, net_cost: 50, cost_price: 50, daraa: 20 }]);
  const [PN] = await H.call('/rest/v1/products', [{ name: 'منتج عادي', barcode: 'CPN1', price: 50, wholesale_price: 30, net_cost: 25, cost_price: 25, daraa: 20 }]);
  await H.call('/rest/v1/gmt_coupons', [{ code: 'TEN', discount_type: 'percent', discount_value: 10, is_used: false }]).catch(() => {});
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const pct = { code: 'TEN', discount_type: 'percent', discount_value: 10 };

  // ① عرض بـ100 + عادي بـ50 + كوبون 10% ⇒ خصم 5 لا 15
  let ct = await setCart(pg, PO.id, PN.id, pct);
  ok(near(ct.rawTotal, 150) && near(ct.couponDiscount, 5) && near(ct.finalTotal, 145), '① عرض 100 + عادي 50 + كوبون 10% ⇒ خصم 5 والإجمالي 145 (' + ct.couponDiscount + ' · ' + ct.finalTotal + ')');
  ok(/غير المعروضة/.test(ct.couponNote || ''), '① يُقال السبب: «' + (ct.couponNote || '') + '»');
  const r1 = await pg.evaluate(([o, n]) => ({ o: itemNetRatio(computeOrderLinkedTotal(), cart[o]), n: itemNetRatio(computeOrderLinkedTotal(), cart[n]) }), [PO.id, PN.id]);
  ok(near(r1.o, 1) && near(r1.n, 0.9), '① توزيع الخصم: بند العرض بلا خصم (×' + r1.o + ') والعادي ×' + r1.n);

  // ② الحفظ: الفاتورة بنفس الرقم، والكوبون مكتوب عليها
  await pg.evaluate(() => { document.getElementById('custName').value = 'زبون كوبون وعرض'; document.getElementById('custPhone').value = '0999000222'; });
  const toasts = []; await pg.exposeFunction('__t', m => toasts.push(m)); await pg.evaluate(() => { const o = window.showToast; window.showToast = function (m) { try { __t(String(m)); } catch (_) {} return o.apply(this, arguments); }; });
  await pg.evaluate(() => saveAndFinish());
  let inv; for (let i = 0; i < 30; i++) { await pg.waitForTimeout(250); inv = ((await dump()).invoices || []).find(x => x.customer_name === 'زبون كوبون وعرض'); if (inv) break; }
  await pg.waitForTimeout(600); await closeDialogs(pg);
  ok(inv && near(inv.total, 145), '② الفاتورة المحفوظة 145 (' + (inv && inv.total) + (inv ? '' : ' · ' + toasts.slice(-3).join(' | ')) + ')');
  ok(inv && String(inv.coupon_code || '').toUpperCase() === 'TEN' && near(inv.discount_amount, 5), '② الكوبون مكتوب على الفاتورة بخصم 5 (' + (inv && inv.coupon_code) + ' · ' + (inv && inv.discount_amount) + ')');
  const d2 = await dump(); const cm2 = (d2.invoice_commissions || []).filter(x => String(x.invoice_id) === String(inv.id)).map(x => Number(x.amount)).sort((a, b) => a - b);
  ok(cm2.length === 2 && near(cm2[0], 7.5) && near(cm2[1], 20), '② العمولة: بند العرض على سعره كاملاً (20) والعادي على سعره بعد الكوبون (7.5) ⇒ ' + cm2.join(' · '));

  // ③ سلّة كلّها عروض ⇒ خصم 0 مع رسالة، ولا يُكتب الكوبون (لا يُستهلك)
  ct = await setCart(pg, PO.id, null, pct);
  ok(near(ct.couponDiscount, 0) && near(ct.finalTotal, 100) && ct.couponCode === null && /كلّ بنود السلّة/.test(ct.couponNote || ''), '③ سلّة كلّها عروض ⇒ خصم 0 · لا كوبون على الفاتورة · رسالة: «' + (ct.couponNote || '') + '» (' + ct.couponDiscount + ' · ' + ct.couponCode + ')');

  // ④ كوبون بقيمة ثابتة 80 على سلّة فيها عادي بـ50 فقط مؤهَّل ⇒ الخصم لا يتجاوز 50
  ct = await setCart(pg, PO.id, PN.id, { code: 'FIX80', discount_type: 'fixed', discount_value: 80 });
  ok(near(ct.couponDiscount, 50) && near(ct.finalTotal, 100), '④ كوبون ثابت 80 ⇒ يُقصّ على المؤهَّل 50 (' + ct.couponDiscount + ' · ' + ct.finalTotal + ')');

  // ⑤ بلا عروض: السلوك القديم كما هو (10% من 50 = 5) · والحدّ الأدنى يبقى على إجمالي السلّة
  ct = await setCart(pg, null, PN.id, pct);
  ok(near(ct.couponDiscount, 5) && near(ct.finalTotal, 45) && !ct.couponNote, '⑤ سلّة بلا عروض ⇒ 10% من 50 = 5 بلا ملاحظة (' + ct.couponDiscount + ')');
  ct = await setCart(pg, PO.id, PN.id, { code: 'MIN120', discount_type: 'percent', discount_value: 10, min_purchase: 120 });
  ok(!ct.couponRejected && near(ct.couponDiscount, 5), '⑤ الحدّ الأدنى 120 يُقاس على إجمالي السلّة 150 (مقبول) والخصم على المؤهَّل 5 (' + ct.couponRejected + ' · ' + ct.couponDiscount + ')');

  // ⑥ عرض موسوم _is_offer (باقة سطراً واحداً) لا يأخذ كوبوناً أيضاً
  ct = await pg.evaluate(([n, cp]) => { newInvoice(); addToCartFromDetail(n); cart['OFFER_X'] = { prod: { id: 'OFFER_X', name: 'باقة', price: 200, wholesale_price: 0, _is_offer: true }, qty: 1, price: 200, _is_offer: true, _seq: 99 };
    _activeCoupon = cp; document.getElementById('couponCode').value = cp.code; return computeOrderLinkedTotal(); }, [PN.id, pct]);
  ok(near(ct.rawTotal, 250) && near(ct.couponDiscount, 5), '⑥ باقة 200 + عادي 50 ⇒ الخصم 5 فقط (' + ct.couponDiscount + ')');
  await pg.evaluate(() => { newInvoice(); _activeCoupon = null; });

  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|ERR_FAILED|net::|navigator\.vibrate/.test(e));
  ok(real.length === 0, 'بلا أخطاء JS' + (real.length ? ' → ' + real.slice(0, 2).join(' | ') : ''));
  console.log('\nRESULT ' + (fails ? 'FAIL' : 'ALL PASS') + ' (' + pass + ' ✔ · ' + fails + ' ✘)');
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
