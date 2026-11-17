// (REQ-0363 · REQ-0334) فحص صحة القاعدة + اختبارات الترابط:
//  ① GMTHealth لا يستعلم أعمدة غير موجودة (invoice_number/items_json) ويكشف «فاتورة بلا بنود» من invoice_items
//  ② الفحص الذي يفشل (400) يظهر «تعذّر» باسمه — لا يُحسب سليماً
//  ③ ترابط المشتريات←الجرد يقرأ أعمدة الفروع الحيّة · الجرد←المتجر: متجرٌ فارغ ليس نجاحاً، ومنتج متجر بلا مقابل يُكشف
const H = require('./h.js');
(async () => {
  await H.seed();
  const old = new Date(Date.now() - 3 * 864e5).toISOString();
  const inv = await H.call('/rest/v1/invoices', [
    { inv_number: 'H-1', branch_key: 'haleb', total: 100, created_at: old },
    { inv_number: 'H-2', branch_key: 'haleb', total: 50, created_at: old },
  ]);
  await H.call('/rest/v1/invoice_items', { invoice_id: inv[0].id, product_name: 'x', qty: 1, unit_price: 100, total: 100 });
  let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };

  const { browser, pg, errs } = await H.open('checks.html', { w: 1200, h: 900, wait: 3500 });
  const urls = [];
  pg.on('request', r => { if (/\/rest\/v1\//.test(r.url())) urls.push(decodeURIComponent(r.url())); });
  await pg.route('**/rest/v1/gmt_manual_debts*', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"42703","message":"column x does not exist"}' }));

  const res = await pg.evaluate(async () => (await GMTHealth.runAll()).map(r => ({ id: r.id, failed: r.failed, error: r.error, hits: r.hits.map(h => h.inv_number || h.id) })));
  const by = Object.fromEntries(res.map(r => [r.id, r]));
  ok(!urls.some(u => /invoices\?[^ ]*(invoice_number|items_json)/.test(u)), 'لا استعلام لـ invoices.invoice_number / items_json');
  ok(by.inv_no_items && !by.inv_no_items.failed && JSON.stringify(by.inv_no_items.hits) === '["H-2"]', 'فاتورة بلا بنود = H-2 فقط ← ' + JSON.stringify(by.inv_no_items));
  ok(by.dup_invoice_no && !by.dup_invoice_no.failed, 'فحص الرقم المكرّر يعمل (inv_number)');
  ok(by.void_no_reason && by.void_no_reason.failed && /400/.test(by.void_no_reason.error), 'الفحص الفاشل يحمل failed + السبب ← ' + JSON.stringify(by.void_no_reason));

  await pg.evaluate(() => GMTHealth.open());
  await pg.waitForFunction(() => !/جارٍ الفحص/.test((document.getElementById('gh-body') || {}).textContent || ''), null, { timeout: 15000 });
  const txt = await pg.evaluate(() => document.getElementById('gh-body').innerText);
  ok(/تعذّر تشغيله/.test(txt) && /إبطال مالي بلا سبب/.test(txt), 'اللوحة تعرض الفحص المتعذّر باسمه');
  ok(!/القاعدة سليمة/.test(txt), 'لا «القاعدة سليمة» مع وجود فحص متعذّر');

  // ③ الترابط — متجر فارغ
  let L = await pg.evaluate(async () => Object.fromEntries((await GMTIntegrationTests.run()).map(x => [x.id, x])));
  ok(L['purchase-inventory'] && !/تعذّر قراءة المنتجات/.test(L['purchase-inventory'].msg), 'المشتريات←الجرد يقرأ المنتجات ← ' + (L['purchase-inventory'] || {}).msg);
  ok(L['inventory-store'] && L['inventory-store'].ok === false, 'متجر فارغ والجرد ممتلئ ⇒ ليس ناجحاً ← ' + (L['inventory-store'] || {}).msg);
  // متجر فيه منتج مربوط ومنتج يتيم
  await H.call('/rest/v1/gmt_store', { id: 1, products: [{ id: 's1', name: 'مربوط', barcode: 'BC0001' }, { id: 's2', name: 'يتيم', barcode: 'NOPE-9' }] });
  L = await pg.evaluate(async () => Object.fromEntries((await GMTIntegrationTests.run()).map(x => [x.id, x])));
  ok(L['inventory-store'].ok === false && /يتيم/.test(L['inventory-store'].detail || ''), 'منتج متجر بلا مقابل يُكشف ← ' + L['inventory-store'].msg);
  await H.call('/rest/v1/gmt_store?id=eq.1', { products: [{ id: 's1', name: 'مربوط', barcode: 'BC0001' }] }, 'PATCH');
  L = await pg.evaluate(async () => Object.fromEntries((await GMTIntegrationTests.run()).map(x => [x.id, x])));
  ok(L['inventory-store'].ok === true, 'متجر كلّه مربوط ⇒ سليم ← ' + L['inventory-store'].msg);

  const real = errs.filter(e => !/vibrate|favicon|ERR_|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ← ' + real.slice(0, 3).join(' | '));
  await browser.close();
  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
  process.exit(bad ? 1 : 0);
})();
