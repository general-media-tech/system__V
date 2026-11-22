// (TASK-A0556 · سجلّ الأخطاء: «كتابة مزدوجة: rpc/add_branch_stock مرّتين خلال ٣ ثوانٍ»)
//  ① إرجاع مخزون أوردر المتجر بضغطتين متزامنتين ⇒ يُضاف مرّةً واحدة
//  ② جهازٌ آخر حجز الإرجاع (restoring_at في القاعدة) ⇒ هذا الجهاز لا يضيف شيئاً
//  ③ الإرجاع العاديّ يعمل ويكتب restored_at
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'منتج إرجاع', barcode: 'RS0001', price: 10, haleb: 5 }]);
  const sd = { at: '2026-11-22T10:00:00Z', branch: 'haleb', by: 'x', state: 'done', lines: [{ pid: P.id, name: P.name, qty: 2, ok: true }] };
  await H.call('/rest/v1/gmt_orders', [
    { id: 9501, name: 'زبون ١', phone: '0933', status: 'cancelled', product: 'x', qty: 2, price: 20, branch: 'المتجر الإلكتروني', stock_deducted: sd },
    { id: 9502, name: 'زبون ٢', phone: '0934', status: 'cancelled', product: 'x', qty: 2, price: 20, branch: 'المتجر الإلكتروني', stock_deducted: Object.assign({}, sd, { restoring_at: '2026-11-22T10:01:00Z' }) }]);
  const { browser, pg } = await H.open('orders.html', { w: 1280, h: 900, mobile: false, wait: 6000 });
  const stock = async () => (await H.call('/__dump', undefined, 'GET')).products.find(p => p.id === P.id).haleb;
  // ①
  const r1 = await pg.evaluate(async (sd) => { const o = { id: 9501, stock_deducted: JSON.parse(JSON.stringify(sd)) }; const o2 = { id: 9501, stock_deducted: JSON.parse(JSON.stringify(sd)) };
    const [a, b] = await Promise.all([restoreStoreOrderStock(o), restoreStoreOrderStock(o2)]); return [a, b].map(x => x && (x.rec ? 'done' : (x.busy ? 'busy' : x.already ? 'already' : JSON.stringify(x)))); }, sd);
  ok(+(await stock()) === 7, '① ضغطتان متزامنتان ⇒ +2 مرّةً واحدة (5 ⇐ ' + (await stock()) + ') ' + JSON.stringify(r1));
  const row = (await H.call('/__dump', undefined, 'GET')).gmt_orders.find(o => o.id === 9501);
  ok(row.stock_deducted && row.stock_deducted.restored_at, '③ restored_at كُتب');
  // ② جهازٌ آخر حجز (النسخة في هذه الصفحة قديمة بلا restoring_at)
  const r2 = await pg.evaluate(async (sd) => { const x = await restoreStoreOrderStock({ id: 9502, stock_deducted: JSON.parse(JSON.stringify(sd)) }); return x && (x.already ? 'already' : JSON.stringify(x)); }, sd);
  ok(r2 === 'already' && +(await stock()) === 7, '② محجوزٌ من جهازٍ آخر ⇒ لا إضافة (' + r2 + ')');
  // بعد الإرجاع: محاولةٌ ثالثة لا تضيف
  const r3 = await pg.evaluate(async (sd) => { const x = await restoreStoreOrderStock({ id: 9501, stock_deducted: JSON.parse(JSON.stringify(sd)) }); return x && (x.already ? 'already' : JSON.stringify(x)); }, sd);
  ok(r3 === 'already' && +(await stock()) === 7, '① محاولةٌ ثالثة بنسخةٍ قديمة لا تضيف (' + r3 + ')');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
