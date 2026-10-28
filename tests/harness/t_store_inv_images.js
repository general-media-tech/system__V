// (TASK-0253 · المالك seq 174) «في المتجر … صور المتجر ثم صور الجرد» و«في الجرد اول صوره هي صوره الجرد ثم صور المتجر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const { prods } = await H.seed();
  const A = prods[0], B = prods[1], C = prods[2];
  await H.call('/rest/v1/products?id=eq.' + A.id, { store_url: 'https://x/store.html#product=s_a', image_url: 'https://img.example/inv-a.png' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { store_url: null, image_url: 'https://img.example/inv-b.png' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + C.id, { store_url: 'https://x/store.html#product=s_c', image_url: 'https://img.example/same.png' }, 'PATCH');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-28T10:00:00Z', categories: [{ id: 'c1', name: 'عدسات', order: 1 }],
    products: [{ id: 's_a', name: 'منتج أ', price: 50, images: ['https://img.example/s1.png', 'https://img.example/s2.png'], category_id: 'c1' },
      { id: 's_b', name: 'منتج ب', price: 40, inv_id: B.id, images: ['https://img.example/sb.png'], category_id: 'c1' },
      { id: 's_c', name: 'منتج ج', price: 30, images: ['https://img.example/same.png'], category_id: 'c1' },
      { id: 's_x', name: 'غير مربوط', price: 20, images: ['https://img.example/sx.png'], category_id: 'c1' }] }]);
  // ① المتجر
  let { browser, ctx, pg, errs } = await H.open('store.html', { w: 390, h: 844, mobile: true, wait: 5000 });
  await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png' } }));
  const imgsOf = async id => { await pg.evaluate(id => openProductModal(id), id); await sleep(1500);
    return pg.evaluate(() => ({ imgs: _pmImgs.filter(x => typeof x === 'string').map(u => u.split('/').pop()), slides: document.querySelectorAll('#product-modal-slides img').length, dots: document.getElementById('product-modal-dots').children.length })); };
  let r = await imgsOf('s_a');
  ok(JSON.stringify(r.imgs) === '["s1.png","s2.png","inv-a.png"]' && r.slides === 3 && r.dots === 3, 'المتجر (مربوط برابط المتجر): صور المتجر ثمّ صورة الجرد: ' + JSON.stringify(r));
  r = await imgsOf('s_b');
  ok(JSON.stringify(r.imgs) === '["sb.png","inv-b.png"]', 'المتجر (مربوط بـ inv_id): صورة المتجر ثمّ صورة الجرد: ' + JSON.stringify(r.imgs));
  r = await imgsOf('s_c');
  ok(JSON.stringify(r.imgs) === '["same.png"]', 'نفس الصورة في الاثنين ⇒ لا تكرار: ' + JSON.stringify(r.imgs));
  r = await imgsOf('s_x');
  ok(JSON.stringify(r.imgs) === '["sx.png"]', 'غير مربوط ⇒ صور المتجر وحدها: ' + JSON.stringify(r.imgs));
  let real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'المتجر: لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  // ② الجرد: صورة الجرد أوّلاً ثمّ صور المتجر
  ({ browser, ctx, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT }));
  const inv = await pg.evaluate(async p => (await GMTGallery.imagesFor(p)).map(u => u.split('/').pop()), { id: A.id, image_url: 'https://img.example/inv-a.png', store_url: 'https://x/store.html#product=s_a' });
  ok(JSON.stringify(inv) === '["inv-a.png","s1.png","s2.png"]', 'الجرد: صورة الجرد ثمّ صور المتجر: ' + JSON.stringify(inv));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
