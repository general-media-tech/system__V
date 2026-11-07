// (TASK-0340 · المالك seq 567/573/574/575) استراتيجية «سعر العرض» + الاقتراح الفوري + «أيّ تغيير في أيّ مكان يؤدّي إلى الكلّ»
//  ① القاعدة: 380⇐379.99 · 45⇐44.97 · 33⇐32.93 · 2⇐1.99 · 550⇐547.84 · 1000⇐997.84 · فيه كسور يبقى · لا تحت الحدّ الأدنى/الجملة
//  ② الجرد: كتابة 380 في سعر البيع ⇐ يظهر اقتراح (القاعدة ↓ ↑) فوراً · الخروج من الخانة ⇐ 379.99 · النقر على ↑ يضع سعره
//  ③ المتجر يعرض قائمة سعرها 550 بـ 547.84 (حتى لو أُدخلت من إدارة المتجر)
//  ④ إدارة المتجر ⇐ الجرد: الاسم والسعر والصور (قائمة لمنتج واحد) · العائلة: سعر القيمة ⇐ سعر منتجها
//  ⑤ الجرد ⇐ المتجر: تغيير الاسم يصل لقائمة المنتج الواحد ولا يغيّر اسم العائلة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'كاميرا تجربة القاعدة', barcode: 'CH0001', price: 600, wholesale_price: 500, net_cost: 450, haleb: 1 },
    { name: 'فلتر UV 58mm', barcode: 'CH0002', price: 11.99, wholesale_price: 7, net_cost: 5, haleb: 3 }]);
  await H.call('/rest/v1/gmt_store', { id: 1, updated_at: '2026-11-01T00:00:00Z', products: [
    { id: 'p_cam', name: 'كاميرا تجربة القاعدة', price: 550, inv_id: A.id, images: ['https://example.com/a1.jpg', 'https://example.com/a2.jpg'] },
    { id: 'p_uv', name: 'فلتر UV', price: 11.99, options: [{ name: 'القطر', affectsPrice: true, values: [{ name: '58mm', inv_id: B.id, price: 11.99 }] }] }] });
  // ① القاعدة (في صفحة حقيقية — نفس الدالّة التي تستعملها كل الصفحات)
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 5000 });
  const r = await pg.evaluate(() => [380, 70, 45, 125, 33, 17, 2, 5, 550, 500, 1000, 12.5, 379.99].map(v => GMTPrice.charm(v))
    .concat([GMTPrice.charm(50, { min: 50 }), GMTPrice.charm(60, { whole: 60 }), GMTPrice.charm(550, { whole: 549 })]));
  ok(JSON.stringify(r) === JSON.stringify([379.99, 69.99, 44.99, 124.99, 32.99, 16.99, 1.99, 4.99, 549.99, 499.99, 999.99, 12.5, 379.99, 50, 60, 549.99]), '① القاعدة (المالك seq 576: سنتٌ واحد لكل سعر · الاستراتيجية مؤجّلة) ' + JSON.stringify(r));
  const o = await pg.evaluate(() => { GMTPrice.STRATEGY = true; const r = [GMTPrice.charm(45), GMTPrice.charm(550)].concat(GMTPrice.options(402).map(x => x.v)); GMTPrice.STRATEGY = false; return r; });
  ok(JSON.stringify(o) === '[44.97,547.84,401.93,399.99,404.97]', '① الاستراتيجية المؤجّلة جاهزة عند تفعيلها (45⇐44.97 · 550⇐547.84 · اقتراحات 402) ' + JSON.stringify(o));
  // ② الاقتراح الفوري في خانة «منتج جديد» بالمشتريات (#np-price) — نفس المستمع لكل الخانات
  await pg.evaluate(() => { const i = document.createElement('input'); i.id = 'tst-price'; i.setAttribute('data-f', 'price'); i.type = 'number'; document.body.appendChild(i); i.focus(); });
  await pg.type('#tst-price', '380'); await sleep(200);
  const hint = await pg.evaluate(() => { const h = document.getElementById('gmt-price-hint'); return h && h.style.display !== 'none' ? h.innerText.replace(/\s+/g, ' ') : ''; });
  ok(!hint, '② الاقتراحات مؤجّلة (seq 576) ⇒ لا نافذة اقتراح «' + hint + '»');
  await pg.evaluate(() => { const i = document.getElementById('tst-price'); i.value = ''; i.focus(); });
  await pg.type('#tst-price', '45'); await pg.evaluate(() => document.getElementById('tst-price').blur()); await sleep(100);
  ok(await pg.evaluate(() => document.getElementById('tst-price').value) === '44.99', '② الخروج من الخانة برقم صحيح ⇐ ناقص سنت 44.99');
  // ⑤ الجرد ⇐ المتجر: اسم جديد للمنتج A (PATCH مثل كل الصفحات)
  await pg.evaluate(async id => { await fetch(GMT_DB.MAIN.url + '/rest/v1/products?id=eq.' + id, { method: 'PATCH', headers: { apikey: GMT_DB.MAIN.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'كاميرا بالاسم الجديد' }) }); }, A.id);
  await pg.evaluate(async id => { await fetch(GMT_DB.MAIN.url + '/rest/v1/products?id=eq.' + id, { method: 'PATCH', headers: { apikey: GMT_DB.MAIN.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'فلتر UV 58mm جديد' }) }); }, B.id);
  await sleep(3500);
  let st = (await H.call('/rest/v1/gmt_store?id=eq.1&select=products', undefined, 'GET'))[0].products;
  ok(st.find(x => x.id === 'p_cam').name === 'كاميرا بالاسم الجديد', '⑤ اسم المنتج الجديد وصل لقائمته في المتجر');
  ok(st.find(x => x.id === 'p_uv').name === 'فلتر UV', '⑤ اسم العائلة «فلتر UV» لم يُستبدل باسم أحد أقطارها');
  // ④ إدارة المتجر ⇐ الجرد
  const oldL = st.map(x => JSON.parse(JSON.stringify(x)));
  const newL = st.map(x => x.id === 'p_cam' ? Object.assign({}, x, { name: 'كاميرا من إدارة المتجر', price: 579.99, images: ['https://example.com/a2.jpg', 'https://example.com/a1.jpg'] })
    : Object.assign({}, x, { options: [{ name: 'القطر', affectsPrice: true, values: [{ name: '58mm', inv_id: B.id, price: 13.97 }] }] }));
  const n = await pg.evaluate(async ([o, nw]) => GMTStoreSync.listingToInv(o, nw), [oldL, newL]);
  await sleep(500);
  const d = await H.call('/__dump', undefined, 'GET');
  const pA = d.products.find(p => p.id === A.id), pB = d.products.find(p => p.id === B.id);
  ok(n === 2 && pA.name === 'كاميرا من إدارة المتجر' && +pA.price === 579.99, '④ الاسم والسعر من إدارة المتجر وصلا للجرد ' + JSON.stringify([n, pA.name, pA.price]));
  ok(JSON.stringify(pA.images) === JSON.stringify(['https://example.com/a2.jpg', 'https://example.com/a1.jpg']) && pA.image_url === 'https://example.com/a2.jpg', '④ ترتيب الصور وصل للجرد (الأولى = صورة المنتج)');
  ok(+pB.price === 13.97, '④ سعر قيمة العائلة (58mm) ⇐ سعر منتجها 13.97 ' + pB.price);
  // ③ عرض المتجر
  const { browser: b2, pg: p2 } = await H.open('store.html', { w: 390, h: 800, wait: 6000, init: '' });
  await H.call('/rest/v1/gmt_store?id=eq.1', { products: [{ id: 'p_cam', name: 'كاميرا', price: 550, inv_id: A.id }] }, 'PATCH');
  await p2.reload(); await sleep(6000);
  const shown = await p2.evaluate(() => (typeof store !== 'undefined' && store.products || []).map(p => p.price));
  ok(shown.indexOf(549.99) !== -1, '③ المتجر يعرض 550 بـ 549.99 ' + JSON.stringify(shown));
  await b2.close();
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon|example\.com/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
