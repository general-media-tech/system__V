// (TASK-0312 · المالك seq 399) «لازم تحط للمنتج سجل اسعار وربط بالفواتير» — صفحة تعديل المنتج تعرض كل فواتير الشراء التي فيها المنتج
// (التاريخ · المورّد · الفاتورة · الكمية · السعر · رأس المال) مع تنبيه «اشتُري بأسعار مختلفة» · ورابط الفاتورة يفتحها في المشتريات (?inv=)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const A = prods[0], B = prods[1];
    await H.call('/rest/v1/v_product_purchase_history', [
      { product_id: A.id, invoice_id: 901, inv_number: 'IMP-2026-0006', inv_type: 'china', supplier: 'Shenzhen Shixin', supplier_inv: 'SX20251104LZ', inv_date: '2025-11-03', qty: 10, unit_price: 38.5, landed_cost: 53.84 },
      { product_id: A.id, invoice_id: 902, inv_number: 'PO-2026-0018', inv_type: 'instant', supplier: 'عالم الإكسسوار', supplier_inv: '2908', inv_date: '2026-04-06', qty: 4, unit_price: 75, landed_cost: null }]);
    await H.call('/rest/v1/import_log', [{ id: 902, inv_number: 'PO-2026-0018', inv_type: 'instant', source_branch: 'haleb', dest_branch: 'haleb', supplier: 'عالم الإكسسوار', inv_date: '2026-04-06', status: 'arrived', total_amount: 300, items_count: 1, total_qty: 4, created_at: '2026-04-06T12:00:00Z',
      items_snapshot: [{ id: A.id, name: A.name, qty: 4, unit_price: 75, total: 300 }] }]);
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: 900, mobile: W < 500, wait: 5000, init: H.ADMIN_INIT });
    const open = async id => { await pg.evaluate(id => { const p = (window.products || []).find(x => String(x.id) === String(id)) || { id }; GMTProductEdit.open(p, { saveInv: async () => ({}) }); }, id); await pg.waitForFunction(() => { const b = document.querySelector('#gmt-pe [data-pe-phist]'); return b && !/⏳/.test(b.textContent); }, null, { timeout: 10000 }).catch(() => {}); };
    await open(A.id);
    const a = await pg.evaluate(() => { const b = document.querySelector('#gmt-pe [data-pe-phist]'); return { t: b.innerText.replace(/\s+/g, ' '), rows: b.querySelectorAll('tbody tr').length, open: !!b.querySelector('details[open]'), first: (b.querySelector('tbody tr td') || {}).textContent, href: (b.querySelector('[data-pe-phist-inv]') || {}).getAttribute && b.querySelector('[data-pe-phist-inv]').getAttribute('href') }; });
    ok(a.rows === 2 && /2 فاتورة/.test(a.t) && /بأسعار مختلفة/.test(a.t) && a.open, W + ': سجلّ أسعار الشراء: فاتورتان + «⚠️ اشتُري بأسعار مختلفة» مفتوح: ' + a.t.slice(0, 120));
    ok(a.first === '2026-04-06' && /عالم الإكسسوار/.test(a.t) && /Shenzhen Shixin/.test(a.t) && /38.5/.test(a.t) && /53.84/.test(a.t) && /75/.test(a.t), W + ': الأحدث أوّلاً · المورّدان · السعر ورأس المال');
    ok(a.href === 'purchase.html?inv=902', W + ': رابط الفاتورة: ' + a.href);
    await pg.evaluate(() => document.getElementById('gmt-pe').remove());
    await open(B.id);
    const b = await pg.evaluate(() => (document.querySelector('#gmt-pe [data-pe-phist]') || {}).innerText || '');
    ok(/لا فاتورة شراء مربوطة/.test(b), W + ': منتج بلا فواتير ⇒ «لا فاتورة شراء مربوطة بهذا المنتج بعد»');
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
    // صفحة المشتريات تفتح ?inv=902
    const P = await H.open('purchase.html?inv=902', { w: W, h: 900, mobile: W < 700, wait: 6000 });
    const shown = await P.pg.evaluate(() => { const e = document.getElementById('invPage'); return !!e && getComputedStyle(e).display !== 'none' && /PO-2026-0018/.test(e.innerText); });
    ok(shown, W + ': purchase.html?inv=902 يفتح الفاتورة PO-2026-0018');
    await P.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
