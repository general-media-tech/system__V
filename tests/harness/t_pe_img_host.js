// (TASK-0348 · المالك seq 523) «اذا عدلت انا منتج من داخل المتجر ما ترجع الصور للقاعدة بعد زر الحفظ»
//  الجذر: الصور نُقلت لاستضافة GitHub وبقي image_url القديم على مخزن Supabase ⇒ المحرّر يضيفه صورةً أولى «زائدة» فيرجع مع الحفظ.
//  ① التعديل الكامل من داخل المتجر + «احفظ» ⇒ لا رابط Supabase يعود للصور · image_url = أولى صور GitHub · العدد كما هو
//  ② صورةٌ على Supabase بلا نسخة GitHub تبقى (لا تُحذف) · ③ صورة من رابطنا على GitHub لا تُنسخ للمخزن
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const GH = 'https://general-media-tech.github.io/system__V/img/p/', SB = 'https://ysawzwtmodkqqbqoiojj.supabase.co/storage/v1/object/public/products-images/';
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'غطاء EF-M تجربة', barcode: 'IH1', price: 25, haleb: 3, image_url: SB + 'catalog/x1/a.jpg', images: [GH + 'catalog/x1/a.jpg', GH + 'catalog/x1/b.jpg', GH + 'catalog/x1/c.jpg'], store_url: '#product=s_a' },
    { name: 'هيد بصورة قديمة', barcode: 'IH2', price: 90, haleb: 2, image_url: SB + 'products/x2/old.jpg', images: [GH + 'catalog/x2/n.jpg'], store_url: '#product=s_b' }]);
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-10T08:00:00Z', banners: [], categories: [{ id: 'c1', name: 'إكسسوارات' }], products: [
    { id: 's_a', name: A.name, price: 25, inv_id: A.id, category_ids: ['c1'], images: [GH + 'catalog/x1/a.jpg', GH + 'catalog/x1/b.jpg'] },
    { id: 's_b', name: B.name, price: 90, inv_id: B.id, category_ids: ['c1'], images: [GH + 'catalog/x2/n.jpg'] }] }]);
  const { browser, ctx, pg, errs } = await H.open('store.html', { init: H.ADMIN_INIT, w: 1366, h: 900, wait: 5000 });
  await ctx.route(/general-media-tech\.github\.io\/.*\.jpg/, r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } }));
  const ups = []; await ctx.route(/\/storage\/v1\/object\/products-images\//, r => { if (!/home\.json/.test(r.request().url())) ups.push(r.request().url()); r.fulfill({ status: 200, body: '{}', headers: { 'Content-Type': 'application/json' } }); });
  const edit = async sid => {
    await pg.evaluate(id => _adminFullEdit(store.products.find(p => p.id === id)), sid);
    await pg.waitForSelector('#gmt-pe [data-pe-save]', { timeout: 10000 }); await sleep(800);
  };
  await edit('s_a');
  await pg.click('#gmt-pe [data-pe-save]'); await sleep(2500);
  let d = await H.call('/__dump', undefined, 'GET'); let a = d.products.find(p => p.id === A.id);
  const imgs = Array.isArray(a.images) ? a.images : JSON.parse(a.images || '[]');
  ok(!imgs.some(u => /supabase\.co\/storage/.test(u)) && imgs.length === 3, '① بعد «احفظ» من داخل المتجر: لا رابط Supabase رجع للصور · 3 صور كما هي: ' + imgs.map(u => u.replace(/^.*\//, '')).join(','));
  ok(a.image_url === GH + 'catalog/x1/a.jpg', '① الصورة الرئيسية = نسخة GitHub نفسها: ' + String(a.image_url).replace(/^https:\/\/[^/]+/, ''));
  await pg.evaluate(() => { const c = document.getElementById('gmt-pe'); if (c) c.remove(); });
  await edit('s_b');
  await pg.evaluate(u => { const i = document.querySelector('#gmt-pe [data-f="image_url"]'); i.value = u; i.dispatchEvent(new Event('change')); }, GH + 'catalog/x2/n.jpg');
  await pg.click('#gmt-pe [data-pe-save]'); await sleep(2500);
  d = await H.call('/__dump', undefined, 'GET'); const b = d.products.find(p => p.id === B.id);
  const bi = Array.isArray(b.images) ? b.images : JSON.parse(b.images || '[]');
  ok(bi.some(u => /old\.jpg$/.test(u)) && bi.some(u => /n\.jpg$/.test(u)), '② صورة Supabase بلا نسخة على GitHub تبقى (لا تُحذف): ' + bi.map(u => u.replace(/^.*\//, '')).join(','));
  ok(!ups.length, '③ لا رفع للمخزن — صورنا على GitHub لا تُنسخ: ' + ups.length + ' ' + ups.join(' '));
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
