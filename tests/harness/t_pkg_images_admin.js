// (TASK-B0391 · المالك seq B690) «الباقات ممكن أنا أتحكّم في تعديل الصور … المصمّمة هي الواجهة ثمّ صورة عدد القطع ثمّ بوستر كلّ منتج — وفيني أعدّل فيهم»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const D0 = await dump(); const P = (D0.products || []).filter(p => p.price > 0).slice(0, 2);
  const A = 'https://x.example/studio.png', Bp = 'https://x.example/poster.jpg';
  await H.call('/rest/v1/gmt_offers', { name: 'باقة الصور', offer_type: 'bundle', offer_price: 100, original_price: 150, is_active: true, targets: { pos: true, store: true, cats: ['c_bundles'], mode: 'price', value: 100 },
    image_url: Bp, images: [Bp, A, 'https://x.example/p1.jpg'], products: JSON.stringify(P.map(p => ({ id: p.id, name: p.name, qty: 1, price: p.price, image_url: 'https://x.example/item_' + p.id + '.jpg' }))) });
  const off = ((await dump()).gmt_offers || []).find(o => o.name === 'باقة الصور');
  const { browser, pg, errs } = await H.open('admin_pos.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 5000 });
  await pg.waitForFunction(() => !!window.GMTPackages, null, { timeout: 8000 });
  await pg.evaluate(o => GMTPackages.open({ offer: o, onSaved: () => { window.__saved = 1; } }), off); await pg.waitForSelector('#gmt-pkg [data-pimgs]'); await pg.waitForTimeout(1500);
  const order = () => pg.evaluate(() => [...document.querySelectorAll('#gmt-pkg [data-pimgs] .pim img')].map(i => (i.getAttribute('data-orig-src') || i.getAttribute('src')).split('/').pop()));
  let o1 = await order();
  ok(o1.join() === 'poster.jpg,studio.png,p1.jpg', '① المحرّر يعرض صور الباقة بترتيبها المحفوظ (لا يعيد بناءها): ' + o1.join());
  await pg.click('#gmt-pkg [data-imf="1"]'); o1 = await order();
  ok(o1[0] === 'studio.png' && o1[1] === 'poster.jpg', '② ⭐ تجعل الصورة المصمّمة واجهة والبوستر بعدها: ' + o1.join());
  await pg.click('#gmt-pkg [data-imx="2"]'); o1 = await order();
  ok(o1.join() === 'studio.png,poster.jpg', '③ حذف صورة: ' + o1.join());
  const cand = await pg.evaluate(() => document.querySelectorAll('#gmt-pkg [data-imgs] img[data-img]').length);
  await pg.click('#gmt-pkg [data-imgs] img[data-img]'); o1 = await order();
  ok(cand === 2 && o1.length === 3 && /^item_/.test(o1[2]), '④ إضافة بوستر منتج من صور منتجاتها (بعد الصورتين): ' + o1.join());
  await pg.fill('#gmt-pkg [data-cover]', 'https://x.example/extra.jpg'); await pg.click('#gmt-pkg [data-addurl]');
  await pg.click('#gmt-pkg [data-imv="3:-1"]'); o1 = await order();
  ok(o1.length === 4 && o1[2] === 'extra.jpg' && /^item_/.test(o1[3]), '⑤ إضافة برابط ثمّ تقديمها بالسهم: ' + o1.join());
  await pg.click('#gmt-pkg [data-save]'); await pg.waitForTimeout(1500);
  const sv = ((await dump()).gmt_offers || []).find(o => o.name === 'باقة الصور');
  const imgs = (typeof sv.images === 'string' ? JSON.parse(sv.images) : sv.images).map(u => u.split('/').pop());
  ok(imgs.join() === o1.join() && /studio\.png$/.test(sv.image_url), '⑥ الحفظ يكتب الصور بالترتيب نفسه والواجهة = الأولى: ' + imgs.join() + ' · ' + sv.image_url);
  const real = errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource|x\.example/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
