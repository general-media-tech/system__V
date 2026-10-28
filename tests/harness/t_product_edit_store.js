// (TASK-0247 · المالك seq 165) «في هذه الصفحة فيني ابحث عن صور من غوغل ايضا الربط بالمتجر او الانشاء»
// (TASK-0245 · seq 164) «البحث على جوجل باستخدام الصوره … في العدسه» · (TASK-0241) «البحث عن الصور مع البحث عن المواصفات»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const { prods } = await H.seed();
  const A = prods[0], B = prods[1];
  await H.call('/rest/v1/products?id=eq.' + A.id, { name: 'رأس إضاءة BD400 شمسي', brand: 'Jinbei', store_url: null, image_url: 'https://img.example/inv-a.png', specs: { 'القدرة': '400W', '__desc': 'رأس إضاءة استوديو.' }, compat: 'Bowens' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { name: 'مظلّة تصوير 110', store_url: null, image_url: 'https://img.example/inv-b.png', specs: { 'القطر': '110 سم' } }, 'PATCH');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-28T10:00:00Z', categories: [{ id: 'c1', name: 'إضاءة', order: 1 }, { id: 'c2', name: 'إكسسوارات', order: 2 }],
    products: [{ id: 's_bd', name: 'رأس إضاءة BD400', price: 120, images: ['https://img.example/s1.png'], category_id: 'c1', description: 'شحن مجاني.' },
      { id: 's_other', name: 'رأس إضاءة آخر', price: 90, inv_id: 'someone-else', images: [], category_id: 'c1' }] }]);
  const { browser, ctx, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png' } }));
  await pg.evaluate(() => { window.GMTBrain = Object.assign(window.GMTBrain || {}, { productImportDialog: cb => cb({ specs: [{ k: 'الوزن', v: '2 كغ' }], images: ['https://img.example/f1.png', 'https://img.example/f2.png', 'data:x'], source_url: 'https://www.alibaba.com/y' }) }); });
  await pg.evaluate(id => invOpenFullEdit(id), A.id);
  await pg.waitForSelector('#gmt-pe [data-pe-link]', { timeout: 10000 }).catch(() => {});
  // ① البحث عن الصور
  const l = await pg.evaluate(() => ({ g: document.querySelector('#gmt-pe [data-pe-gimg]').href, lens: document.querySelector('#gmt-pe [data-pe-lens]').href }));
  ok(/google\.com\/search\?tbm=isch&q=/.test(l.g) && decodeURIComponent(l.g).includes('رأس إضاءة BD400 شمسي Jinbei') && /lens\.google\.com\/uploadbyurl\?url=https%3A%2F%2Fimg\.example%2Finv-a\.png/.test(l.lens),
    '«🔍 صور من غوغل» باسم المنتج وماركته · «🔎 عدسة غوغل» بصورة المنتج: ' + JSON.stringify(l).slice(0, 160));
  await pg.evaluate(() => { const i = document.querySelector('#gmt-pe [data-f="image_url"]'); i.value = 'data:image/png;base64,xx'; i.dispatchEvent(new Event('change')); });
  ok(await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-lens]').getAttribute('aria-disabled') === 'true'), 'صورةٌ بلا رابط https ⇒ العدسة معطّلة (لا رابط مكسور)');
  await pg.evaluate(() => { const i = document.querySelector('#gmt-pe [data-f="image_url"]'); i.value = 'https://img.example/inv-a.png'; i.dispatchEvent(new Event('change')); });
  // (TASK-0245 · seq 175 · 176) شريط البحث فوق جدول المواصفات: المواصفات التلقائية · عدسة غوغل · صور غوغل
  const bar = await pg.evaluate(() => { const b = document.querySelector('#gmt-pe [data-pe-searchbar]'); const rows = document.querySelector('#gmt-pe [data-pe-rows]');
    return b && { auto: !!b.querySelector('[data-pe-auto]'), lens: !!b.querySelector('[data-pe-lensgo]'), g: /tbm=isch/.test((b.querySelector('[data-pe-gimg2]') || {}).href || ''), above: !!(b.compareDocumentPosition(rows) & 4) }; });
  ok(bar && bar.auto && bar.lens && bar.g && bar.above, 'شريط البحث ظاهر فوق جدول المواصفات: 🤖 · 🔎 عدسة غوغل · 🔍 صور غوغل: ' + JSON.stringify(bar));
  await pg.evaluate(() => { window.__opened = []; window.open = (u) => { const w = { location: { set href(v) { window.__opened.push(v); } }, close() { window.__opened.push('closed'); } }; window.__opened.push(u); return w; }; });
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-lensgo]').click()); await sleep(300);
  let op = await pg.evaluate(() => window.__opened);
  ok(op[0] === 'about:blank' && /^https:\/\/lens\.google\.com\/uploadbyurl\?url=https%3A%2F%2Fimg\.example%2Finv-a\.png$/.test(op[1] || ''), '«🔎 عدسة غوغل» ⇒ تُفتح بصورة المنتج: ' + JSON.stringify(op));
  await ctx.route(/\/storage\/v1\/object\/products-images\//, r => r.fulfill({ status: 200, body: '{}', headers: { 'Content-Type': 'application/json' } }));
  await pg.evaluate(() => { window.__opened = []; const i = document.querySelector('#gmt-pe [data-f="image_url"]'); i.value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; i.dispatchEvent(new Event('change')); document.querySelector('#gmt-pe [data-pe-lensgo]').click(); });
  await sleep(1500);
  op = await pg.evaluate(() => ({ o: window.__opened, img: document.querySelector('#gmt-pe [data-f="image_url"]').value }));
  ok(/products-images\/lens_/.test(op.img) && /lens\.google\.com\/uploadbyurl\?url=.*products-images/.test(op.o[1] || ''), 'صورةٌ مضمَّنة ⇒ تُرفع وتصير رابطاً ثمّ تُفتح العدسة: ' + JSON.stringify(op).slice(0, 200));
  await pg.evaluate(() => { const i = document.querySelector('#gmt-pe [data-f="image_url"]'); i.value = 'https://img.example/inv-a.png'; i.dispatchEvent(new Event('change')); });
  // ② صور البحث التلقائي
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-auto]').click()); await sleep(800);
  const sg = await pg.evaluate(() => ({ shown: !document.querySelector('#gmt-pe [data-pe-suggbox]').hidden, n: document.querySelectorAll('#gmt-pe [data-pe-sugg] figure').length }));
  ok(sg.shown && sg.n === 2, 'المواصفات التلقائية ⇒ «🖼️ صور وجدها البحث» (روابط https فقط): ' + JSON.stringify(sg));
  ok(/إعادة البحث التلقائي/.test(await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-auto]').textContent)), 'بعد البحث الأوّل يصير الزرّ «🔄 إعادة البحث التلقائي»');
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-sugg] figure [data-a="inv"]').click());
  ok(await pg.evaluate(() => document.querySelector('#gmt-pe [data-f="image_url"]').value) === 'https://img.example/f1.png', '«صورة الجرد» ⇒ تصير صورة الجرد في الحقل');
  // ③ الربط بمنتجٍ موجود
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-link]').click()); await sleep(200);
  const c = await pg.evaluate(() => [...document.querySelectorAll('#gmt-pe [data-linkto]')].map(b => b.getAttribute('data-linkto')));
  ok(c.length === 1 && c[0] === 's_bd', 'المرشّحون بالاسم — بلا منتجٍ مربوطٍ بغيره: ' + JSON.stringify(c));
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-linkto="s_bd"]').click());
  await pg.waitForSelector('#gmt-pe [data-s="name"]', { timeout: 10000 }).catch(() => {});
  let st = await store(), sp = st.products.find(x => x.id === 's_bd'), ia = await inv(A.id);
  ok(String(sp.inv_id) === String(A.id) && /store\.html#product=s_bd$/.test(ia.store_url || ''), 'الربط ⇒ المتجر يحمل inv_id · الجرد يحمل رابط المنتج: ' + ia.store_url);
  ok(sp.compat === 'Bowens' && /^رأس إضاءة استوديو\.\nشحن مجاني\.$/.test(sp.description || '') && Array.isArray(sp.specs) && sp.specs.some(r => r.label === 'القدرة'),
    'والجدول والتوافق والوصف انتقلت (وصف المتجر محفوظ): ' + JSON.stringify(sp.description));
  ok(await pg.evaluate(() => !!document.querySelector('#gmt-pe [data-s="name"]') && !document.querySelector('#gmt-pe [data-pe-link]')), 'بعد الربط: قسم المتجر يصير قابلاً للتعديل في الصفحة نفسها');
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-x]').click());
  // ④ الإنشاء في المتجر
  await pg.evaluate(id => invOpenFullEdit(id), B.id);
  await pg.waitForSelector('#gmt-pe [data-pe-create]', { timeout: 10000 }).catch(() => {});
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-create]').click());
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-docreate]').click()); await sleep(300);
  ok(/قسماً واحداً/.test(await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-msg]').textContent)), 'بلا قسم ⇒ «اختر قسماً واحداً على الأقلّ»');
  await pg.evaluate(() => { document.querySelector('#gmt-pe [data-ccat="c2"]').checked = true; document.querySelector('#gmt-pe [data-pe-docreate]').click(); });
  await pg.waitForSelector('#gmt-pe [data-s="name"]', { timeout: 10000 }).catch(() => {});
  st = await store(); const np = st.products.find(x => String(x.inv_id) === String(B.id)); const ib = await inv(B.id);
  ok(np && np.name === 'مظلّة تصوير 110' && np.category_id === 'c2' && np.images[0] === 'https://img.example/inv-b.png' && np.specs.some(r => r.label === 'القطر') && /store\.html#product=/.test(ib.store_url || ''),
    '«➕ إنشاء في المتجر» ⇒ منتجٌ جديد بالاسم والقسم والصورة والجدول · والجرد مربوط: ' + JSON.stringify(np && { n: np.name, c: np.category_id }));
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
