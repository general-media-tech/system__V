// (TASK-A0570 · نمط B0374 · المالك seq 969 «كمل») ساعة الجهاز المتقدّمة ونقطة مزامنة منتجات نقطة البيع
//  ① التحميل المسبق (gmt-warmup) يكتب وقت المزامنة من الخادم لا من ساعة الجهاز (كانت تكتب «المستقبل»)
//  ② جهازٌ كُتبت عنده نقطة «من المستقبل» قبل الإصلاح ⇒ المزامنة الخلفية تُشفى: تعديل السعر يصل · والنقطة تصير وقت الخادم
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SKEW = `;(function(){ const RD = Date, skew = 2 * 3600e3; window.Date = class extends RD { constructor(...a) { if (!a.length) super(RD.now() + skew); else super(...a); } static now() { return RD.now() + skew; } }; })();`;
(async () => {
  await H.seed();
  const t0 = new Date(Date.now() - 3600e3).toISOString();
  const [A] = await H.call('/rest/v1/products', [{ name: 'منتج مزامنة A0570', barcode: 'A0570', price: 15, wholesale_price: 10, net_cost: 6, cost_price: 6, daraa: 2, updated_at: t0 }]);
  // ①
  let o = await H.open('admin_pos.html', { init: H.ADMIN_INIT + SKEW, w: 1200, mobile: false, wait: 5000 });
  const w = await o.pg.evaluate(async () => {
    if (!window.GMTWarmup) return { err: 'no warmup' };
    try { localStorage.clear(); } catch (_) {}
    const rep = await GMTWarmup.data({});
    const v = await new Promise(res => { const rq = indexedDB.open('gmt_pos_db'); rq.onsuccess = () => { try { const g = rq.result.transaction('meta', 'readonly').objectStore('meta').get('last_products_sync'); g.onsuccess = () => res(g.result && g.result.value); g.onerror = () => res(null); } catch (e) { res('ERR ' + e.message); } }; rq.onerror = () => res(null); });
    return { pre: rep && rep.posPrefilled, v };
  });
  const realNow = Date.now();
  ok(w.pre === true && w.v && new Date(w.v).getTime() <= realNow + 60e3, '① التحميل المسبق: وقت المزامنة من الخادم (لا «بعد ساعتين») ' + JSON.stringify(w));
  await o.browser.close();
  // ②
  o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  await o.pg.evaluate(() => setMeta('last_products_sync', new Date(Date.now() + 2 * 3600e3).toISOString()));   // نقطة «من المستقبل»
  await H.call('/rest/v1/products?id=eq.' + A.id, { price: 19, updated_at: new Date().toISOString() }, 'PATCH');
  await o.pg.evaluate(() => _backgroundSync()); await sleep(1500);
  const st = await o.pg.evaluate((a) => { const p = allProducts.find(x => String(x.id) === String(a)); return { price: p && p.price }; }, A.id);
  const ls = await o.pg.evaluate(() => getMeta('last_products_sync'));
  ok(st.price === 19, '② تعديل السعر وصل رغم نقطة «المستقبل» (15 ⇐ 19): ' + st.price);
  ok(ls && new Date(ls).getTime() <= Date.now() + 60e3, '② نقطة المزامنة صُحّحت لوقت الخادم: ' + ls);
  const real = o.errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
