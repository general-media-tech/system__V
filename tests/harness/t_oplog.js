const H = require('./h.js');
const OUT = __dirname + '/';
const INIT = H.ADMIN_INIT + " sessionStorage.setItem('gmt_admin_name','محمد خير');";
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const audit = async () => ((await H.call('/__dump', undefined, 'GET')).gmt_audit || []);
(async () => {
  const { prods } = await H.seed();
  const orders = await H.call('/rest/v1/gmt_orders', [{ name: 'أحمد', phone: '0933000111', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب' }]);
  // ═ الأوردرات
  let { browser, pg, errs } = await H.open('orders.html', { init: INIT, w: 390, h: 850, wait: 5000 });
  ok(await pg.evaluate(() => !!window.GMTOpLog), 'gmt-oplog.js حُمِّل تلقائياً على صفحة الأوردرات');
  await pg.evaluate(async (id) => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/gmt_orders?id=eq.' + id, { method: 'PATCH', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'shipped', tracking_number: '196682' }) }); }, orders[0].id);
  await pg.evaluate(() => GMTOpLog.flush()); await pg.waitForTimeout(800);
  let a = await audit(); let r = a.find(x => x.action === 'order_status');
  ok(!!r && r.actor === 'الأدمن محمد خير' && r.entity === 'gmt_orders' && /أحمد|أوردر/.test(r.entity_name), 'سجلّ تغيير حالة الأوردر: ' + JSON.stringify(r && { actor: r.actor, name: r.entity_name, f: r.field, o: r.old_value, n: r.new_value, p: r.page }));
  ok(r && JSON.parse(r.old_value).status === 'pending' && JSON.parse(r.new_value).status === 'shipped', 'القيمة القديمة والجديدة (قيد التجهيز ← في الطريق)');
  // خطأ: طلب فاشل لا يُسجَّل
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/nonexistent_tbl?id=eq.1', { method: 'PATCH', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }, body: '{"x":1}' }); });
  // جدول غير مراقَب
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/invoice_items', { method: 'POST', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }, body: '{"qty":1}' }); });
  await pg.evaluate(() => GMTOpLog.flush()); await pg.waitForTimeout(500);
  ok((await audit()).length === a.length, 'جدول غير مراقَب/طلب فاشل لا يُسجَّل');
  // كلمات السرّ لا تُسجَّل
  await pg.evaluate(async () => { const d = GMT_DB.MAIN; await fetch(d.url + '/rest/v1/gmt_users?id=eq.1', { method: 'PATCH', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ password_hash: 'c2VjcmV0cGFzcw==' }) }); });
  await pg.evaluate(() => GMTOpLog.flush()); await pg.waitForTimeout(500);
  a = await audit(); const secretRow = a.find(x => x.entity === 'gmt_users');
  ok(!JSON.stringify(a).includes('c2VjcmV0cGFzcw==') , 'قيمة كلمة السرّ لا تصل السجلّ' + (secretRow ? ' (' + secretRow.new_value + ')' : ''));
  await browser.close();

  // ═ الجرد
  ({ browser, pg, errs } = await H.open('inventory.html', { init: INIT, w: 390, h: 850, wait: 6000 }));
  const pid = (await H.call('/__dump', undefined, 'GET')).products[0].id;
  await pg.evaluate(async (id) => { const d = (window.GMT_DB || {}).MAIN; await fetch(d.url + '/rest/v1/products?id=eq.' + id, { method: 'PATCH', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ price: 777 }) }); }, pid);
  await pg.evaluate(() => GMTOpLog.flush()); await pg.waitForTimeout(800);
  a = await audit(); const pe = a.filter(x => x.entity === 'products');
  ok(pe.length === 1 && pe[0].action === 'product_edit' && JSON.parse(pe[0].new_value).price === 777 && JSON.parse(pe[0].old_value).price === 100, 'تعديل منتج: مرّةً واحدة بقبل/بعد (' + pe.length + ' سطر): ' + (pe[0] ? pe[0].old_value + ' ← ' + pe[0].new_value : ''));
  // زرّ سجل العمليات بالجرد
  await pg.evaluate(() => gmtOpLogOpen()); await pg.waitForSelector('#gmt-oplog-ov .ol-row', { timeout: 8000 });
  await pg.screenshot({ path: OUT + 'oplog_panel.png' });
  const rows = await pg.evaluate(() => document.querySelectorAll('#gmt-oplog-ov .ol-row').length);
  ok(rows >= 1, 'اللوحة تعرض ' + rows + ' سطراً (فئة المخزون)');
  await browser.close();

  // ═ الصفحة الكاملة
  ({ browser, pg, errs } = await H.open('سجل_العمليات.html', { init: INIT, w: 1100, h: 800, wait: 4500, mobile: false }));
  const n = await pg.evaluate(() => document.querySelectorAll('#log .ol-row').length);
  ok(n >= 2, 'الصفحة الكاملة تعرض ' + n + ' سطراً');
  await pg.click('[data-c="orders"]'); const n2 = await pg.evaluate(() => document.querySelectorAll('#log .ol-row').length);
  ok(n2 >= 1 && n2 < n + 1, 'فلتر «الأوردرات والزبائن»: ' + n2);
  await pg.fill('.ol-q', 'ما-من-نتيجة-xyz'); ok(/لا نتائج/.test(await pg.evaluate(() => document.querySelector('.ol-list').textContent)), 'بحثٌ بلا نتائج');
  await pg.fill('.ol-q', ''); await pg.screenshot({ path: OUT + 'oplog_page.png' });
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();
})();
