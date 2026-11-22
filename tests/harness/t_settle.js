const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const all = (await H.call('/__dump', undefined, 'GET')).products;
  const it = (i, q) => ({ id: all[i].id, barcode: all[i].barcode, name: all[i].name, qty: q });
  // مشتريات: واحدة مختومة لم تصل كمياتها، رقمٌ مكرّر، وفاتورة تغطّي منتجاً مخزونه أكبر
  await H.call('/rest/v1/import_log', [
    { inv_number: 'IMP-2026-0001', inv_type: 'china', supplier: 'Shenzhen', status: 'arrived', transferred: true, transfer_moved: { [all[0].id]: 10, [all[1].id]: 0 }, items_snapshot: [it(0, 10), it(1, 5)], created_at: '2026-01-01T00:00:00Z' },
    { inv_number: 'IMP-2026-0001', inv_type: 'china', supplier: 'Shenzhen 2', status: 'arrived', transferred: false, items_snapshot: [it(2, 3)], created_at: '2026-02-01T00:00:00Z' },
    { inv_number: 'IMP-2026-0002', inv_type: 'germany', supplier: 'Berlin', status: 'arrived', transferred: true, transfer_moved: { [all[3].id]: 2 }, items_snapshot: [it(3, 2)], created_at: '2026-03-01T00:00:00Z' },
    // (TASK-A0549) سليمة: سعرٌ لكلّ بند · وبندٌ بسعر 0 مكتوبٌ «هدية» ليس نقصاً
    { id: 7701, inv_number: 'IMP-2026-0003', inv_type: 'china', supplier: 'سليمة', inv_date: '2026-03-02', status: 'arrived', total_amount: 20, items_snapshot: [Object.assign(it(4, 2), { unit_price: 10 }), Object.assign(it(5, 1), { unit_price: 0, notes: 'هدية مع الطلبية' })], created_at: '2026-03-02T00:00:00Z' },
    // ناقصة: بندٌ غير مربوط + بلا مورّد
    { id: 7702, inv_number: 'IMP-2026-0004', inv_type: 'china', inv_date: '2026-03-03', status: 'transit', total_amount: 5, items_snapshot: [{ id: null, name: 'بند يتيم', barcode: 'NOPE-1', qty: 1, unit_price: 5 }], created_at: '2026-03-03T00:00:00Z' },
    // سليمة أيضاً: أصلٌ للمحل غير مربوط عمداً + كمية 0 بملاحظةٍ تشرحها
    { id: 7703, inv_number: 'IMP-2026-0005', inv_type: 'china', supplier: 'أصول', inv_date: '2026-03-04', status: 'transit', total_amount: 20, items_snapshot: [{ id: null, name: 'ستاند عرض', barcode: 'ASSET-1', qty: 2, unit_price: 10, notes: 'أصل للمحل — سُجّل في «سجلّ الأصول»' }, Object.assign(it(6, 0), { unit_price: 3, notes: 'الكمية 0 بطلب المالك' }), Object.assign(it(7, 4), { unit_price: 0, notes: 'السعر 0 كما هو — بطلب المالك seq 397' })], created_at: '2026-03-04T00:00:00Z' }]);
  // نقل بحاجة تسوية
  const tr = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-00004', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا', status: 'needs_settlement', settled: false }]);
  await H.call('/rest/v1/stock_transfer_items', [{ transfer_id: tr[0].id, product_name: 'كاميرا تجربة 0', qty: 0, requested_qty: 4, deduction_failed: true }]);
  // أوردرات بلا فاتورة
  await H.call('/rest/v1/gmt_orders', [{ name: 'أحمد', phone: '0933', product: 'x', qty: 1, price: 100, status: 'shipped' }, { name: 'سامر', phone: '0934', product: 'y', qty: 1, price: 50, status: 'pending' }, { name: 'مفوتَر', phone: '0935', product: 'z', qty: 1, price: 10, status: 'shipped', invoice_id: 77 }]);
  await H.call('/rest/v1/gmt_expenses', [{ title: 'إيجار', amount: 300, currency: 'usd', approved: false, branch_name: 'حلب' }, { title: 'معتمد', amount: 5, approved: true }]);
  const { browser, pg, errs } = await H.open('أداة_التسويات.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 7000 });
  await pg.waitForFunction(() => document.querySelectorAll('.card').length >= 8, null, { timeout: 20000 });
  const cards = await pg.evaluate(() => [...document.querySelectorAll('.card')].map(c => ({ t: c.querySelector('b').textContent, n: c.querySelector('.cnt').textContent, cls: c.className.replace('card', '').trim(), acts: [...c.querySelectorAll('.act a')].map(a => a.getAttribute('href')) })));
  cards.forEach(c => console.log('  ', c.cls.padEnd(2), c.n.padStart(2), c.t, c.acts.join(' ')));
  const by = Object.fromEntries(cards.map(c => [c.t, c]));
  ok(by['فواتير نقل مخزون تحتاج تسوية'].n === '1', 'نقل يحتاج تسوية: ١');
  ok(by['فواتير شراء مختومة «واصلة» وكمّياتها لم تدخل المخزون'].n === '1' && /purchase.html\?q=IMP-2026-0001/.test(by['فواتير شراء مختومة «واصلة» وكمّياتها لم تدخل المخزون'].acts.join()), 'مختومة لم تصل: ١ + رابط الفاتورة');
  ok(by['فواتير شراء برقمٍ مكرَّر'].n === '1', 'رقم مكرّر: ١');
  const pg_ = by['فواتير شراء فيها نقص (سعر · ربط · كمية · مورّد · مجموع)'];
  const pgTxt = await pg.evaluate(() => { const c = [...document.querySelectorAll('.card')].find(c => /فواتير شراء فيها نقص/.test(c.textContent)); return c ? c.innerText : ''; });
  ok(pg_ && pg_.n === '4' && /بند بسعر شراء 0/.test(pgTxt) && /غير مربوط بمنتج/.test(pgTxt) && /بلا مورّد/.test(pgTxt) && !/IMP-2026-0003|IMP-2026-0005/.test(pgTxt), '(A0549) فواتير فيها نقص: ٤ (الثلاث بلا سعر + اليتيمة بلا مورّد) · «هدية» و«أصل للمحل» و«كمية 0 بملاحظة» ليست نقصاً ' + (pg_ && pg_.n));
  ok(await pg.evaluate(() => !!document.querySelector('a[href="purchase.html?open=7702"]')), '(A0549) «فتح ←» بمعرّف الفاتورة لا برقمها');
  ok(by['معدّات لها كمّية بلا فاتورة شراء'] && by['معدّات لها كمّية بلا فاتورة شراء'].n !== '؟', '(A0549) معدّات لها كمّية بلا فاتورة: ' + (by['معدّات لها كمّية بلا فاتورة شراء'] || {}).n);
  ok(by['أوردرات متقدّمة بلا فاتورة'].n === '1', 'أوردر متقدّم بلا فاتورة: ١ (المفوتَر و«قيد التجهيز» لا يُعدّان)');
  ok(by['مصاريف بانتظار موافقتك'].n === '1', 'مصاريف معلّقة: ١');
  ok(by['مخزونٌ أكبر من مجموع فواتير شرائه'].n !== '؟', 'حالة الفائض تُحسب (' + by['مخزونٌ أكبر من مجموع فواتير شرائه'].n + ')');
  ok(await pg.evaluate(() => /ما هذا\؟/.test(document.body.innerText) && /ما أثره\؟/.test(document.body.innerText) && /التصرّف الصحيح/.test(document.body.innerText)), 'كل حالة تشرح: ما هذا · الأثر · التصرّف الصحيح');
  await pg.screenshot({ path: OUT + 'settle.png', fullPage: false });
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();
  // الروابط المباشرة
  const b2 = await H.open('inventory.html?settle=1', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 9000 });
  ok(await b2.pg.evaluate(() => { const o = document.getElementById('st-settle-ov'); return !!o && getComputedStyle(o).display !== 'none'; }), 'inventory.html?settle=1 يفتح لوحة تسوية النقل مباشرةً');
  await b2.browser.close();
  const b3 = await H.open('inventory.html?audit=1', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 9000 });
  ok(await b3.pg.evaluate(() => !!document.getElementById('intg-ov')), 'inventory.html?audit=1 يفتح تدقيق الفواتير والجرد مباشرةً');
  await b3.browser.close();
  const b4 = await H.open('purchase.html?q=IMP-2026-0002', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 9000 });
  ok(await b4.pg.evaluate(() => document.getElementById('searchInput').value === 'IMP-2026-0002'), 'purchase.html?q= يملأ البحث');
  await b4.browser.close();
})();
