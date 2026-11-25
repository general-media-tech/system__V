// TASK-B0540 · المالك seq B1065: المشاكل بأداة التسويات للتصليح اليدوي — منتجات أسعارها ناقصة (مع/بلا فاتورة) · بنود غير مربوطة كلّها · المعدّات بلا فاتورة كاملة بزرّ تعديل
const H = require('./h.js');
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [
    { id: 'np-a', name: 'منتج بلا مبيع بلا فاتورة', barcode: 'NPA1', price: 0, cost_price: 10, net_cost: 0, haleb: 3 },
    { id: 'np-b', name: 'منتج بلا كلفة بفاتورة', barcode: 'NPB1', price: 50, cost_price: 0, net_cost: 0, haleb: 0 },
    { id: 'np-c', name: 'منتج سليم الأسعار', barcode: 'NPC1', price: 50, cost_price: 30, net_cost: 0, haleb: 2 },
    { id: 'np-d', name: 'منتج فاضي بلا كمّية ولا فاتورة', barcode: 'NPD1', price: 0, cost_price: 0, net_cost: 0, haleb: 0 }
  ]);
  const unl = Array.from({ length: 5 }, (_, i) => ({ id: null, name: 'كفر مجهول ' + (i + 1), qty: 1, unit_price: 2 }));
  await H.call('/rest/v1/import_log', [{ id: 7801, inv_number: 'IMP-NP-1', inv_type: 'china', supplier: 'مورد', inv_date: '2026-11-01', status: 'arrived', total_amount: 10,
    items_snapshot: [{ id: 'np-b', barcode: 'NPB1', name: 'منتج بلا كلفة بفاتورة', qty: 1, unit_price: 0 }].concat(unl), created_at: '2026-11-01T00:00:00Z' }]);
  const { browser, pg } = await H.open('أداة_التسويات.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 6000 });
  await pg.waitForFunction(() => document.querySelectorAll('.card').length >= 9, null, { timeout: 25000 });
  const r = await pg.evaluate(() => {
    const c = [...document.querySelectorAll('.card')].find(x => /أسعارها ناقصة/.test(x.querySelector('b').textContent));
    const pg = [...document.querySelectorAll('.card')].find(x => /فواتير شراء فيها نقص/.test(x.querySelector('b').textContent));
    return c && { n: c.querySelector('.cnt').textContent, ids: [...c.querySelectorAll('[data-np]')].map(e => e.dataset.np), txt: c.innerText,
      edit: (c.querySelector('[data-np="np-a"] a') || {}).getAttribute && c.querySelector('[data-np="np-a"] a').getAttribute('href'), pgTxt: pg ? pg.innerText : '' };
  });
  ok(r, 'بطاقة «منتجات أسعارها ناقصة» موجودة');
  ok(r.ids.includes('np-a') && r.ids.includes('np-b'), 'تعرض الناقص: بلا مبيع (بكمّية) · بلا كلفة (بفاتورة)');
  ok(!r.ids.includes('np-c') && !r.ids.includes('np-d'), 'لا تعرض السليم ولا المنتج بلا كمّية ولا فاتورة');
  ok(r.ids.indexOf('np-a') < r.ids.indexOf('np-b'), '«بلا فاتورة» أوّلاً');
  ok(/بلا فاتورة/.test(r.txt) && /ناقص: سعر المبيع/.test(r.txt) && /ناقص: الكلفة/.test(r.txt), 'تكتب الناقص و«بلا فاتورة»');
  ok(r.edit === 'inventory.html?pid=np-a&view=edit', 'زرّ تعديل مباشر للمنتج: ' + r.edit);
  ok(/كفر مجهول 5/.test(r.pgTxt), 'بطاقة الفواتير تعرض كلّ البنود غير المربوطة (لا أوّل ٣ بس)');
  await browser.close();
  console.log(process.exitCode ? 'FAIL' : 'ALL PASS');
})().catch(e => { console.error(e); process.exit(1); });
