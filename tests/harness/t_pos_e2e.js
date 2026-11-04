// (TASK-0320 · المالك seq 513) «اختبر كل عمليات نقطة البيع كأنك عم تجربها: الخصم والفوترة والربح والنسبة وخصم المخزون
// وفواتير النقل وإنشاء الكفالة وتخزين اسم العميل …» — كاشير حقيقي على نقطة «درعا» يضغط الأزرار نفسها، ثمّ نقرأ القاعدة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.006;
const round = x => Math.round(x * 100) / 100;
const W = Number(process.env.W || 390), MOB = W < 700;
const closeDialogs = async pg => { for (let i = 0; i < 5 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.click('.gmtask-ov .gmtask-b.pri').catch(() => pg.keyboard.press('Escape')); await pg.waitForTimeout(300); } };
const view = pg => pg.evaluate(() => (document.querySelector('.view.active') || {}).id || '');

async function sell(pg, { lines, name, phone, type, partial, coupon, price }) {
  await pg.evaluate(() => { newInvoice(); goTo('v-products'); });
  await pg.waitForTimeout(300);
  for (const [id, n] of lines) for (let k = 0; k < n; k++) {
    await pg.evaluate(i => toggleProd(i), id);   // ما ينادِيه زرّ «+» على بطاقة المنتج
    await pg.waitForTimeout(120);
  }
  await pg.evaluate(() => { goTo('v-cart'); renderCart(); }); await pg.waitForTimeout(300);
  if (price) for (const [id, v] of price) { await pg.fill('#cart-pinput-' + id, String(v)); await pg.waitForTimeout(150); }
  await pg.evaluate(() => { goTo('v-checkout'); renderCheckout(); }); await pg.waitForTimeout(300);
  if (type) await pg.click(`#saleTypeBtns [data-type="${type}"]`);
  await pg.fill('#custName', ''); await pg.type('#custName', name, { delay: 10 });
  if (phone) { await pg.fill('#custPhone', ''); await pg.type('#custPhone', phone, { delay: 10 }); }
  if (partial != null) await pg.fill('#partialPaymentAmount', String(partial));
  const okv = await pg.evaluate(() => { const r = validateCheckout(); if (r) { goTo('v-print'); renderPrint(); } return !!r; });
  if (!okv) return { blocked: true };
  await pg.waitForTimeout(300);
  if (coupon) { await pg.fill('#couponCode', coupon); await pg.click('[onclick="applyCouponCode()"]'); await pg.waitForTimeout(1200); }
  await pg.click('#btn-save-invoice');
  for (let i = 0; i < 40 && (await view(pg)) !== 'v-success'; i++) { await pg.waitForTimeout(250); if (i === 20) await closeDialogs(pg); }
  await closeDialogs(pg);
  return { blocked: false, view: await view(pg), msg: await pg.evaluate(() => (document.getElementById('successMsg') || {}).textContent || '') };
}

(async () => {
  await H.seed();
  const [R50, LENS, BATT, BOX] = await H.call('/rest/v1/products', [
    { name: 'كاميرا Canon EOS R50', barcode: 'R50A', price: 700, wholesale_price: 600, net_cost: 550, daraa: 5, haleb: 2 },
    { name: 'عدسة Canon RF 50mm f/1.8', barcode: 'RF50', price: 200, wholesale_price: 160, net_cost: 140, daraa: 4 },
    { name: 'بطارية LP-E17', barcode: 'LPE17', price: 30, net_cost: 15, daraa: 10 },
    { name: 'صندوق إضاءة', barcode: 'BOX1', price: 90, wholesale_price: 70, net_cost: 60, daraa: 1 }]);
  await H.call('/rest/v1/gmt_coupons', { code: 'GMT10', discount_type: 'percent', discount_value: 10, is_used: false });
  const { browser, ctx, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT + ';window.open=function(u){(window.__opened=window.__opened||[]).push(String(u));return null;};', w: W, mobile: MOB, wait: 7000 });
  const stock = async id => Number(((await dump()).products.find(p => String(p.id) === String(id)) || {}).daraa);
  const invOf = async name => (await dump()).invoices.filter(i => i.customer_name === name);

  /* ① بيع نقدي: قطعتا R50 + عدسة بسعر مُخفَّض 180 · زبون جديد باسم ورقم */
  console.log('① بيع نقدي');
  let r = await sell(pg, { lines: [[R50.id, 2], [LENS.id, 1]], price: [[LENS.id, 180]], name: 'أحمد التجربة', phone: '0933000111' });
  ok(r.view === 'v-success' && /تم حفظ الفاتورة/.test(r.msg), 'الحفظ ⇒ شاشة النجاح: ' + r.msg);
  let D = await dump(); let inv = D.invoices.find(i => i.customer_name === 'أحمد التجربة');
  ok(inv && near(inv.total, 1580) && inv.items_count === 3, 'الإجمالي 2×700 + 180 = 1580 · 3 قطع: ' + (inv && inv.total + ' · ' + inv.items_count));
  ok(inv && inv.sale_type === 'نقدي' && inv.payment_status === 'paid' && near(inv.paid_amount, 1580) && near(inv.remaining_amount, 0), 'نقدي · مدفوعة · المقبوض 1580 · المتبقّي 0');
  ok(inv && inv.customer_phone === '0933000111' && inv.cashier_name === 'سامر' && inv.branch_key === 'daraa', 'الزبون ورقمه · الكاشير «سامر» · فرع درعا');
  ok(inv && !inv.review_status && !inv.discount_amount, 'لا مراجعة ولا «خصم فاتورة» (السعر عُدّل على البند)');
  let its = D.invoice_items.filter(x => x.invoice_id === inv.id);
  const iR = its.find(x => x.product_id === R50.id) || {}, iL = its.find(x => x.product_id === LENS.id) || {};
  ok(iR.qty === 2 && near(iR.unit_price, 700) && near(iR.commission, 50) && near(iR.cost_price, 550), 'بند R50: 2 × 700 · عمولة القطعة (700−600)×50% = 50 · الكلفة 550');
  ok(iL.qty === 1 && near(iL.unit_price, 180) && near(iL.commission, 10), 'بند العدسة: 180 · عمولتها (180−160)×50% = 10');
  let cms = D.invoice_commissions.filter(c => c.invoice_id === inv.id);
  ok(cms.length === 2 && near(cms.reduce((s, c) => s + Number(c.amount), 0), 110) && cms.every(c => c.cashier_name === 'سامر' && !c.awaiting_collection), 'العمولات: 100 + 10 = 110 لسامر · مستحقّة (نقدي)');
  const profit = its.reduce((s, x) => s + (Number(x.unit_price) - Number(x.cost_price)) * x.qty, 0);
  ok(near(profit, 340), 'الربح من البنود: (700−550)×2 + (180−140) = 340 → ' + profit);
  ok(await stock(R50.id) === 3 && await stock(LENS.id) === 3, 'المخزون: R50 5⇐3 · العدسة 4⇐3');
  ok(D.gmt_customers.some(c => c.phone === '0933000111' && c.name === 'أحمد التجربة' && c.branch_key === 'daraa'), 'الزبون الجديد خُزّن في «الزبائن»');
  const inv1 = inv;

  /* ② الكفالة من شاشة النجاح ⇒ صفحة الكفالة معبّأة ⇒ إصدار */
  console.log('② الكفالة');
  await pg.evaluate(() => { window.__opened = []; });
  await pg.click('[onclick="openWarrantyForInvoice()"]').catch(async () => pg.evaluate(() => openWarrantyForInvoice()));
  await pg.waitForTimeout(400);
  const wurl = (await pg.evaluate(() => window.__opened || []))[0] || '';
  const wq = new URL(wurl, H.BASE).searchParams;
  ok(/guarantee\.html/.test(wurl) && wq.get('name') === 'أحمد التجربة' && wq.get('phone') === '0933000111' && wq.get('inv') === String(inv1.inv_number), 'زرّ «🛡 كفالة» يفتح صفحة الكفالة بالاسم والرقم ورقم الفاتورة: inv=' + wq.get('inv'));
  let items = []; try { items = JSON.parse(decodeURIComponent(wq.get('items') || '[]')); } catch (_) {}
  ok(items.length === 2 && wq.get('product') === 'كاميرا Canon EOS R50', 'قطع الفاتورة كلّها في الرابط (' + items.map(x => x.name).join(' · ') + ')');
  ok(wq.get('serial') !== 'R50A', 'السيريال لا يُعبّأ بباركود الصنف (الباركود ليس رقم القطعة التسلسلي): serial=' + wq.get('serial'));
  {
    const g = await ctx.newPage(); const gerr = []; g.on('pageerror', e => gerr.push(String(e).slice(0, 150)));
    await ctx.addInitScript(() => {}); await g.addInitScript(H.ADMIN_INIT);
    await g.goto(new URL(wurl, H.BASE).href, { waitUntil: 'domcontentloaded' }); await g.waitForTimeout(4000);
    const f = await g.evaluate(() => ['customerName', 'phoneNo', 'invoiceNo', 'productName', 'serialNo'].map(i => (document.getElementById(i) || {}).value || ''));
    ok(f[0] === 'أحمد التجربة' && f[1] === '0933000111' && f[2] === String(inv1.inv_number) && f[3] === 'كاميرا Canon EOS R50', 'صفحة الكفالة معبّأة: ' + f.slice(0, 4).join(' · '));
    await g.fill('#serialNo', 'SN-R50-778899');
    const pick = await g.$$('[data-pi]'); ok(pick.length === 2, 'تعرض قطع الفاتورة لاختيار القطعة: ' + pick.length);
    await g.click('#generateBtn'); await g.waitForTimeout(2500);
    for (let i = 0; i < 3 && await g.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await g.click('.gmtask-ov .gmtask-b.pri').catch(() => {}); await g.waitForTimeout(800); }
    D = await dump();
    const w = (D.warranties || []).find(x => x.invoice_no === String(inv1.inv_number));
    ok(w && w.customer_name === 'أحمد التجربة' && w.phone_no === '0933000111' && w.serial_no === 'SN-R50-778899' && w.status === 'active', 'الكفالة صدرت ومحفوظة: ' + (w ? w.short_id + ' · ' + w.product_name + ' · ' + w.expiry_date : 'لا شيء'));
    ok(!gerr.length, 'لا أخطاء JS في صفحة الكفالة: ' + gerr.join(' | '));
    await g.close();
  }

  /* ③ كوبون 10% على العدسة ⇒ الخصم يُوزَّع والعمولة على السعر الفعلي · الكوبون يُستهلك */
  console.log('③ الكوبون');
  r = await sell(pg, { lines: [[LENS.id, 1]], name: 'زبون الكوبون', coupon: 'GMT10' });
  D = await dump(); inv = D.invoices.find(i => i.customer_name === 'زبون الكوبون');
  ok(inv && near(inv.total, 180) && near(inv.discount_amount, 20) && inv.coupon_code === 'GMT10', 'كوبون 10%: 200 ⇐ 180 · خصم 20 · الكود محفوظ: ' + (inv && [inv.total, inv.discount_amount, inv.coupon_code].join(' · ')));
  cms = D.invoice_commissions.filter(c => inv && c.invoice_id === inv.id);
  ok(cms.length === 1 && near(cms[0].amount, 10), 'العمولة على ما دفعه الزبون: (180−160)×50% = 10 → ' + (cms[0] && cms[0].amount));
  ok((D.gmt_coupons.find(c => c.code === 'GMT10') || {}).is_used === true, 'الكوبون صار مستعملاً');
  r = await sell(pg, { lines: [[BATT.id, 1]], name: 'زبون الكوبون 2', coupon: 'GMT10' });
  inv = (await invOf('زبون الكوبون 2'))[0];
  ok(inv && near(inv.total, 30) && !inv.discount_amount && !inv.coupon_code, 'الكوبون نفسه مرّةً ثانية ⇒ لا خصم ولا يُكتب رمزه على الفاتورة: ' + (inv && inv.total + ' · ' + inv.coupon_code));

  /* ④ بيع تحت سعر الجملة (فوق الكلفة) ⇒ يُحفظ «قيد المراجعة» وعمولة سالبة · تحت الكلفة ⇒ ممنوع */
  console.log('④ تحت الجملة / تحت الكلفة');
  r = await sell(pg, { lines: [[LENS.id, 1]], price: [[LENS.id, 150]], name: 'زبون تحت الجملة' });
  D = await dump(); inv = D.invoices.find(i => i.customer_name === 'زبون تحت الجملة');
  cms = D.invoice_commissions.filter(c => inv && c.invoice_id === inv.id);
  ok(inv && near(inv.total, 150) && inv.review_status === 'pending', 'تحت الجملة: محفوظة · «قيد المراجعة»');
  ok(cms.length === 1 && near(cms[0].amount, -5) && /دون سعر الجملة/.test(cms[0].note || ''), 'عمولة سالبة (150−160)×50% = −5 مع ملاحظة: ' + (cms[0] && cms[0].amount));
  const s0 = await stock(LENS.id);
  r = await sell(pg, { lines: [[LENS.id, 1]], price: [[LENS.id, 130]], name: 'زبون تحت الكلفة' });
  const low = await invOf('زبون تحت الكلفة'); const lowIt = low[0] ? (await dump()).invoice_items.filter(x => x.invoice_id === low[0].id) : [];
  ok(low.length === 1 && lowIt.length === 1 && near(lowIt[0].unit_price, 200) && near(low[0].total, 200), 'تحت الكلفة (130 < 140): السعر يُرفض ويعود 200 — الفاتورة لا تُحفظ بـ130 أبداً: ' + (low[0] && low[0].total));
  /* ولو تجاوز أحدٌ الحقل (سلّة معدّلة بالكود) فالحفظ نفسه يمنع */
  const sB = await stock(BOX.id);
  await pg.evaluate(id => { newInvoice(); toggleProd(id); cart[id].price = 50; document.getElementById('custName').value = 'زبون التفاف الكلفة'; }, BOX.id);
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(1200); await closeDialogs(pg);
  ok(!(await invOf('زبون التفاف الكلفة')).length && await stock(BOX.id) === sB, 'الحفظ نفسه يرفض سعراً تحت الكلفة حتى لو تجاوز الحقل — لا فاتورة ولا خصم');

  /* ⑤ بيع آجل (شحن) بدفعة مقدَّمة ⇒ جزئي · المتبقّي · العمولة معلّقة حتى التحصيل · الرقم إلزامي */
  console.log('⑤ آجل');
  r = await sell(pg, { lines: [[R50.id, 1]], name: 'زبون آجل بلا رقم', type: 'آجل (شحن)' });
  ok(r.blocked && !(await invOf('زبون آجل بلا رقم')).length, 'آجل بلا رقم هاتف ⇒ لا يُحفظ');
  r = await sell(pg, { lines: [[R50.id, 1]], name: 'زبون آجل', phone: '0944000222', type: 'آجل (شحن)', partial: 200 });
  D = await dump(); inv = D.invoices.find(i => i.customer_name === 'زبون آجل');
  ok(inv && inv.sale_type === 'آجل (شحن)' && inv.payment_status === 'partial' && near(inv.paid_amount, 200) && near(inv.remaining_amount, 500), 'آجل: جزئي · مقبوض 200 · متبقٍّ 500: ' + (inv && [inv.payment_status, inv.paid_amount, inv.remaining_amount].join(' · ')));
  cms = D.invoice_commissions.filter(c => inv && c.invoice_id === inv.id);
  ok(cms.length === 1 && cms[0].awaiting_collection === true && near(cms[0].amount, 50), 'عمولة الآجل 50 «بانتظار التحصيل»');
  ok(await stock(R50.id) === 2, 'المخزون خُصم في الآجل أيضاً: R50 ⇐ 2');

  /* ⑥ فاتورة تدريب ⇒ لا مخزون ولا عمولة */
  console.log('⑥ التدريب');
  const sT = await stock(BATT.id);
  r = await sell(pg, { lines: [[BATT.id, 2]], name: '[تدريب] متدرّب' });
  D = await dump(); inv = D.invoices.find(i => i.customer_name === '[تدريب] متدرّب');
  ok(inv && await stock(BATT.id) === sT && !D.invoice_commissions.some(c => c.invoice_id === inv.id), 'فاتورة «[تدريب]» محفوظة · لا خصم مخزون · لا عمولة');

  /* ⑦ اسم الزبون: الإكمال التلقائي من الرقم لا يضع زبوناً آخر */
  console.log('⑦ الزبون');
  await pg.evaluate(id => { newInvoice(); toggleProd(id); }, BATT.id); await pg.waitForTimeout(600);
  await pg.evaluate(() => { goTo('v-checkout'); renderCheckout(); }); await pg.waitForTimeout(500);
  await pg.fill('#custName', ''); await pg.fill('#custPhone', '');
  await pg.type('#custPhone', '09', { delay: 30 }); await pg.waitForTimeout(1200);
  const n1 = await pg.inputValue('#custName');
  await pg.type('#custPhone', '33000111', { delay: 30 }); await pg.waitForTimeout(1200);
  const n2 = await pg.inputValue('#custName');
  ok(n1 === '', 'كتابة «09» فقط لا تملأ اسم زبونٍ آخر: «' + n1 + '»');
  ok(n2 === 'أحمد التجربة', 'الرقم الكامل 0933000111 ⇒ اسمه «أحمد التجربة»: «' + n2 + '»');
  r = await sell(pg, { lines: [[BATT.id, 1]], name: 'أحمد التجربة', phone: '0933000111' });
  D = await dump();
  ok(D.gmt_customers.filter(c => c.phone === '0933000111').length === 1, 'زبونٌ واحد لا مكرّر بعد فاتورته الثانية');
  r = await sell(pg, { lines: [[BATT.id, 1]], name: 'زبون باسم فقط' });
  D = await dump(); inv = D.invoices.find(i => i.customer_name === 'زبون باسم فقط');
  ok(inv && inv.customer_name === 'زبون باسم فقط', 'نقدي باسمٍ بلا رقم: الاسم محفوظ على الفاتورة');

  /* ⑧ المرتجع الجزئي من «الفواتير»: قطعة R50 من الفاتورة ① */
  console.log('⑧ المرتجع');
  const sR = await stock(R50.id);
  await pg.evaluate(async () => { openInvoiceHistory(); await new Promise(r => setTimeout(r, 1500)); });
  await pg.evaluate(id => startRefundFromHistory(id), inv1.id); await pg.waitForTimeout(1500);
  await pg.evaluate(() => setRefundType('partial')); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const it = refundItems.find(i => /R50/.test(i.product_name || '')); refundSelections = {}; refundItems.forEach(i => refundSelections[i.id || i.product_id] = 0); refundSelections[it.id || it.product_id] = 1; updateRefundSummary(); });
  await pg.fill('#refund-reason', 'الزبون غيّر رأيه').catch(() => {});
  await pg.click('#btn-confirm-refund'); await pg.waitForTimeout(2500); await closeDialogs(pg);
  D = await dump();
  const rinv = D.invoices.find(i => String(i.original_invoice_id) === String(inv1.id));
  ok(rinv && near(rinv.total, -700) && rinv.sale_type === 'مرتجع' && near(rinv.paid_amount, -700), 'فاتورة مرتجع −700 (نقداً للزبون): ' + (rinv && rinv.inv_number + ' · ' + rinv.total));
  ok(await stock(R50.id) === sR + 1, 'المخزون عاد: R50 ' + sR + ' ⇐ ' + await stock(R50.id));
  const rev = D.invoice_commissions.filter(c => c.invoice_id === inv1.id && Number(c.amount) < 0);
  ok(rev.length === 1 && near(rev[0].amount, -50), 'عكس عمولة القطعة المرتجعة: −50 → ' + (rev[0] && rev[0].amount));
  const wAfter = (D.warranties || []).find(x => x.invoice_no === String(inv1.inv_number));
  ok(wAfter && (wAfter.status === 'cancelled' || /ملغ|cancel/i.test(String(wAfter.status) + String(wAfter.cancel_reason || ''))), 'كفالة القطعة المرتجعة أُلغيت: ' + (wAfter && wAfter.status + ' · ' + (wAfter.cancel_reason || '')));
  /* إرجاعٌ ثانٍ للقطعة نفسها يُقصّ بما بيع فعلاً */
  await pg.evaluate(async () => { openInvoiceHistory(); await new Promise(r => setTimeout(r, 1500)); });
  await pg.evaluate(id => startRefundFromHistory(id), inv1.id); await pg.waitForTimeout(1500);
  await pg.click('#btn-confirm-refund'); await pg.waitForTimeout(2500); await closeDialogs(pg);
  D = await dump();
  const rs = D.invoices.filter(i => String(i.original_invoice_id) === String(inv1.id));
  const back = rs.reduce((s, i) => s + Number(i.total), 0);
  ok(near(back, -1580), 'إرجاع الباقي كلّه ⇒ مجموع المرتجعات = الفاتورة بالضبط (−1580) لا أكثر: ' + back);
  ok(await stock(R50.id) === sR + 2 && await stock(LENS.id) >= 1, 'وكلّ القطع عادت للمخزون مرّة واحدة');

  /* ⑨ تقفيل اليوم: الأرقام من الفواتير نفسها (حسابٌ مستقلّ) */
  console.log('⑨ تقفيل اليوم');
  {   /* القاعدة الوهمية تختم created_at بتاريخٍ ثابت ⇒ نختمها «اليوم» كالقاعدة الحقيقية */
    const nowIso = new Date().toISOString();
    for (const t of ['invoices', 'invoice_commissions']) await H.call('/rest/v1/' + t + '?branch_key=eq.daraa', { created_at: nowIso }, 'PATCH');
  }
  await pg.evaluate(() => openDailyClose()); await pg.waitForTimeout(2500);
  const dc = await pg.evaluate(() => _dcData && { S: _dcData.S, box: _dcData.box });
  D = await dump();
  const mine = D.invoices.filter(i => i.branch_key === 'daraa' && !String(i.customer_name || '').startsWith('[تدريب]'));
  const sales = mine.filter(i => Number(i.total) >= 0 && i.sale_type !== 'مرتجع');
  const refs = mine.filter(i => Number(i.total) < 0 || i.sale_type === 'مرتجع');
  const sum = (a, f) => a.reduce((t, x) => t + (Number(f(x)) || 0), 0);
  const exp = { salesTotal: sum(sales, i => i.total), invCount: sales.length, cashSales: sum(sales.filter(i => i.sale_type === 'نقدي'), i => i.total),
    creditSales: sum(sales.filter(i => /آجل/.test(i.sale_type)), i => i.total), refunds: Math.abs(sum(refs, i => i.total)), discounts: sum(mine, i => i.discount_amount),
    commissions: sum(D.invoice_commissions.filter(c => c.branch_key === 'daraa'), c => c.amount) };
  const cash = sum(mine, i => i.paid_amount) - sum(mine, i => i.paid_external);   // الدفعة المقدَّمة عبر «شام كاش» (الاختيار الافتراضي) خارج الدرج
  console.log('    ', JSON.stringify(dc && dc.S), '| box', JSON.stringify(dc && dc.box), '| expected', JSON.stringify(exp), 'cash', cash);
  ok(dc && ['salesTotal', 'invCount', 'cashSales', 'creditSales', 'refunds', 'discounts', 'commissions'].every(k => near(dc.S[k], exp[k])) && dc.S.coupons === 1, 'ملخّص اليوم = الفواتير: مبيعات ' + exp.salesTotal + ' · نقدي ' + exp.cashSales + ' · آجل ' + exp.creditSales + ' · مرتجعات ' + exp.refunds + ' · خصومات ' + exp.discounts + ' · عمولات ' + round(exp.commissions));
  ok(dc && near(dc.box.cashReceived, cash), 'الصندوق: المقبوض في الدرج = النقد − ما رُدّ للزبائن − ما دُفع خارج الدرج (' + cash + ') · التدريب لا يدخل: ' + (dc && dc.box.cashReceived));

  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406|409)|favicon/.test(x));
  ok(!real.length, 'لا أخطاء JS في نقطة البيع: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
