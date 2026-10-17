// قالب الفاتورة المشترك: نقطة البيع (إعادة طباعة) + أوردر المتجر + صفحة المتجر
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const CAP = ' window.__bufs=[]; window.open=function(){ var b=[]; var w={closed:false,document:{write:function(h){b.push(h)},open:function(){},close:function(){}},focus:function(){},print:function(){},close:function(){}}; window.__bufs.push(b); return w; };';
(async () => {
  await H.seed();
  // ١) نقطة البيع
  const inv = await H.call('/rest/v1/invoices', [{ inv_number: 'INV-T1', customer_name: 'زبون اختبار', customer_phone: '0933000111', total: 120, sale_type: 'نقدي', branch_key: 'daraa', branch_name: 'درعا', paid_amount: 120, created_at: new Date().toISOString() }]);
  await H.call('/rest/v1/invoice_items', [{ invoice_id: inv[0].id, product_name: 'كاميرا تجربة 1', qty: 1, unit_price: 120 }]);
  const p = await H.open('pos.html', { init: H.STAFF_INIT + CAP, w: 1280, h: 900, wait: 5000 });
  ok(await p.pg.evaluate(() => !!window.GMTInvoiceTpl && TEMPLATE_B === GMTInvoiceTpl.B && TEMPLATE_B.length > 10000), 'pos.html يقرأ القالب من الوحدة المشتركة (' + await p.pg.evaluate(() => TEMPLATE_B.length) + ' حرفاً)');
  await p.pg.evaluate((row) => printHistoricalInvoice(row, 'a4'), inv[0]);
  await p.pg.waitForTimeout(1500);
  const html = await p.pg.evaluate(() => (window.__bufs || []).map(b => b.join('')).join('\n====\n'));
  ok(/فاتورة مبيع/.test(html) && /زبون اختبار/.test(html) && /INV-T1/.test(html) && /كاميرا تجربة 1/.test(html), 'إعادة طباعة فاتورة مبيع A4 تعمل بالقالب المشترك (اسم الزبون · الرقم · البند)');
  ok(!/{{[a-z_]+}}/i.test(html.replace(/\{\{ITEMS_ROWS\}\}/g, '')), 'لا مفاتيح {{...}} متروكة بلا ملء');
  console.log('   errs(pos):', p.errs.filter(e => !/400|404|Failed|أصول ناقصة/.test(e)).slice(0, 3));
  await p.browser.close();
  // ٢) أوردر المتجر
  await H.call('/rest/v1/gmt_orders', [{ name: 'زبون المتجر', phone: '0933999888', address: 'دمشق — القدم', product: 'x', qty: 1, price: 240, status: 'pending', branch: 'حلب', store_order_id: 'ST-77', items_json: JSON.stringify([{ name: 'عدسة 50mm', qty: 1, price: 200 }, { name: 'بطارية', qty: 2, price: 20 }]) }]);
  const o = await H.open('orders.html', { w: 390, h: 900, wait: 4500, init: H.ADMIN_INIT + CAP });
  await o.pg.evaluate(() => { const ord = orders.find(x => x.name === 'زبون المتجر'); window.__sid = ord && ord.id; });
  const sid = await o.pg.evaluate(() => window.__sid);
  if (sid) {
    await o.pg.evaluate((id) => storeOrderInvoice(id), sid); await o.pg.waitForTimeout(600);
    const h2 = await o.pg.evaluate(() => (window.__bufs || []).map(b => b.join('')).join(''));
    ok(/فاتورة طلب/.test(h2) && /ST-77/.test(h2) && /عدسة 50mm/.test(h2) && /240\.00/.test(h2), 'أوردر المتجر: فاتورته بنفس قالب المبيع (الرقم ST-77 · البنود · 240.00)');
    ok(/<script>setTimeout\(function\(\)\{window\.print\(\)\}/.test(h2), 'تُطبَع تلقائياً');
  } else ok(false, 'لم أجد أوردر المتجر في الصفحة');
  await o.browser.close();
  // ٣) صفحة المتجر
  const s = await H.open('store.html', { w: 390, h: 900, wait: 4500, init: H.ADMIN_INIT + CAP });
  const r = await s.pg.evaluate(async () => {
    showInvoice({ orderId: 'ST-88', name: 'ليلى', phone: '0944000222', address: 'حلب', notes: '', payment: 'cod', items: [{ name: 'منتج أ', qty: 2, price: 10, images: [] }], subtotal: 20, total: 21 });
    await new Promise(r => setTimeout(r, 800));
    const fr = document.getElementById('invoice-frame');
    return { has: !!fr, src: fr ? fr.getAttribute('srcdoc') || '' : '', tf: fr ? fr.style.transform : '', h: document.getElementById('invoice-frame-wrap') ? document.getElementById('invoice-frame-wrap').style.height : '' };
  });
  ok(r.has && /فاتورة طلب/.test(r.src) && /ST-88/.test(r.src) && /منتج أ/.test(r.src), 'المتجر: الفاتورة تُعرض بقالب المبيع داخل الإطار');
  ok(/scale\(0\.\d+\)/.test(r.tf), 'مصغّرةٌ لتناسب الهاتف: ' + r.tf + ' · ارتفاع ' + r.h);
  await s.pg.screenshot({ path: '/tmp/store_page_inv.png' });
  await s.pg.evaluate(() => downloadInvoice()); await s.pg.waitForTimeout(400);
  ok(await s.pg.evaluate(() => (window.__bufs || []).some(b => /window\.print\(\)/.test(b.join('')) && /ST-88/.test(b.join('')))), 'زرّ «تحميل الفاتورة» يطبع نفس الورقة');
  console.log('   errs(store):', s.errs.filter(e => !/400|404|Failed|أصول ناقصة|supabase/i.test(e)).slice(0, 3));
  await s.browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
