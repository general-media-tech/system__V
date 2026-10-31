// (TASK-0288 · المالك seq 229) «حط لي في نظام اداه تسعير تفرزني كل شيء بلا اسعار تعرض لي اياه لحتى اسعره»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const real = (errs) => errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'ستاند الإضاءة الجديد', barcode: 'PR0001', price: 0, wholesale_price: 0, cost_price: 2.24, haleb: 0, daraa: 0, group_name: 'ستاندات وترايبود', invoice_names: [{ n: '8819 stand', src: 'Shixin', usd: 2.24 }] },
    { name: 'منتج بلا سعر أصلاً', barcode: 'PR0002', price: null, cost_price: 0, haleb: 0, daraa: 0, group_name: 'متفرقات' },
    { name: 'منتج مسعَّر', barcode: 'PR0003', price: 50, cost_price: 20, haleb: 1, daraa: 0, group_name: 'متفرقات' }]);
  for (const [W, mob] of [[390, true], [1366, false]]) {
    await H.call('/rest/v1/products?id=eq.' + A.id, { price: 0, wholesale_price: 0 }, 'PATCH');
    const { browser, pg, errs } = await H.open('inventory.html?check=no_price', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 6000, init: H.ADMIN_INIT });
    await pg.waitForSelector('#bulk-content [data-price-row]', { timeout: 15000 }).catch(() => {});
    const v = await pg.evaluate(() => ({ rows: [...document.querySelectorAll('#bulk-content [data-price-row]')].map(r => r.innerText.replace(/\s+/g, ' ')), head: (document.querySelector('#bulk-content') || {}).innerText || '' }));
    ok(v.rows.length === 2, W + ': «💲 بدون سعر» يعرض المنتجين بلا سعر (السعر 0 والفارغ) لا المسعَّر: ' + v.rows.length);
    ok(v.rows.some(t => /8819 stand/.test(t) && /\$2\.24/.test(t)), W + ': سطر التسعير يُظهر اسمه في الفاتورة وسعر الشراء');
    ok(/أداة التسعير/.test(v.head), W + ': عنوان الأداة ظاهر');
    const sel = '[data-price-row="' + A.id + '"]';
    await pg.fill(sel + ' [data-pr-sale]', '6.5'); await pg.fill(sel + ' [data-pr-whole]', '5');
    await pg.click(sel + ' [data-pr-save]'); await pg.waitForTimeout(1200);
    const dump = (await H.call('/__dump', undefined, 'GET'));
    const a = dump.products.find(p => p.id === A.id);
    ok(Number(a.price) === 6.5 && Number(a.wholesale_price) === 5, W + ': حُفظ سعر المبيع والجملة في القاعدة: ' + a.price + ' / ' + a.wholesale_price);
    const aud = (dump.gmt_audit || []).filter(r => r.entity_id === String(A.id) && r.action === 'price_set');
    ok(aud.length >= 1, W + ': وسُجّل في سجلّ العمليات (gmt_audit)');
    const after = await pg.evaluate(() => [...document.querySelectorAll('#bulk-content [data-price-row]')].length);
    ok(after === 1, W + ': والمنتج خرج من القائمة: بقي ' + after);
    const sel2 = '[data-price-row="' + B.id + '"]';
    await pg.click(sel2 + ' [data-pr-save]'); await pg.waitForTimeout(500);
    const b = (await H.call('/__dump', undefined, 'GET')).products.find(p => p.id === B.id);
    ok(!(Number(b.price) > 0), W + ': بلا رقم ⇒ لا يُحفظ شيء');
    ok(!real(errs).length, W + ': لا أخطاء JS ' + real(errs).slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
