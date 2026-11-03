// (TASK-0315 · المالك seq 416) حفظ فاتورة صينية «في الطريق» يضيف كمياتها لمخزون العبور (عمود china)
// حتى حين ترجع add_branch_stock خطأ 300 (PGRST203 — نسخ متضاربة · TASK-0149): المسار الاحتياطي المتحقَّق عبر GMTStock.move
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  for (const mode of ['rpc300', 'rpcok']) {
    const { prods } = await H.seed();
    const A = prods[0], B = prods[1];
    await H.call('/rest/v1/products?id=eq.' + A.id, { china: 2 }, 'PATCH');
    await H.call('/rest/v1/products?id=eq.' + B.id, { china: 0 }, 'PATCH');
    const { browser, ctx, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
    if (mode === 'rpc300') await ctx.route('**/rpc/add_branch_stock', r => r.fulfill({ status: 300, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST203', message: 'Could not choose the best candidate function between: public.add_branch_stock(p_product_id => text ...' }) }));
    const res = await pg.evaluate(async (ids) => syncTransitToInv([{ id: ids[0], qty: 10 }, { id: ids[1], qty: 5 }], [], 'china'), [A.id, B.id]);
    const a = await inv(A.id), b = await inv(B.id);
    ok(res && res.ok && !res.failed.length, mode + ': المزامنة نجحت بلا فشل: ' + JSON.stringify(res && res.failed));
    ok(Number(a.china) === 12 && Number(b.china) === 5, mode + ': مخزون العبور (الصين) = 2+10 و 0+5: ' + a.china + ' · ' + b.china);
    // تعديل الفاتورة: إنقاص كمية A من 10 إلى 4 ⇒ ينقص 6
    const res2 = await pg.evaluate(async (ids) => syncTransitToInv([{ id: ids[0], qty: 4 }, { id: ids[1], qty: 5 }], [{ id: ids[0], qty: 10 }, { id: ids[1], qty: 5 }], 'china'), [A.id, B.id]);
    const a2 = await inv(A.id);
    ok(res2.ok && Number(a2.china) === 6, mode + ': تعديل الكمية 10⇐4 يُنقص مخزون العبور: ' + a2.china);
    const real = errs.filter(e => !/status of (300|400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, mode + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
