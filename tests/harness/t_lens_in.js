// (TASK-0323 · المالك seq 514) عدسة غوغل وصور غوغل **داخل النظام** في صفحة تعديل المنتج: الطلب يحمل صورة المنتج/اسمه ·
// النتائج تُعرض (صورة · عنوان · مصدر · سعر · صفحة) · «+ أضف» تضيف الصورة لصور المنتج · بلا مفتاح ⇒ رسالة الخطوات.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const EP = 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain';
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'عدسة Canon RF 50mm f/1.8 STM', brand: 'Canon', barcode: 'LN1', price: 200, daraa: 2, image_url: 'https://x.example/rf50.jpg' }]);
  const { browser, ctx, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT + `;try{localStorage.setItem('gmt_brain_endpoint','${EP}')}catch(e){}`, w: 1366, h: 900, mobile: false, wait: 7000 });
  const seen = []; let mode = 'ok';
  await ctx.route('**/functions/v1/gmt-search', async route => {
    const b = JSON.parse(route.request().postData() || '{}'); seen.push(b);
    if (mode === 'nokey') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no', code: 'no_keys' }) });
    if (b.kind === 'lens') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ provider: 'serpapi', kind: 'lens', guess: 'Canon RF 50mm F1.8 STM', matches: [
      { title: 'Canon RF 50mm F1.8 STM Lens', page: 'https://www.canon.com/rf50', source: 'Canon', thumb: 'https://x.example/t1.jpg', image: 'https://x.example/i1.jpg', price: '$199' },
      { title: 'RF 50mm f/1.8 — B&H', page: 'https://www.bhphotovideo.com/rf50', source: 'B&H Photo', thumb: 'https://x.example/t2.jpg', image: 'https://x.example/i2.jpg', price: '' }] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ provider: 'serpapi', kind: 'images', images: [
      { url: 'https://x.example/g1.jpg', thumb: 'https://x.example/gt1.jpg', page: 'https://shop.example/a', title: 'RF 50 front', source: 'Shop' },
      { url: 'https://x.example/g2.jpg', thumb: 'https://x.example/gt2.jpg', page: 'https://shop.example/b', title: 'RF 50 side', source: 'Shop' },
      { url: 'https://x.example/g3.jpg', thumb: '', page: '', title: 'RF 50 box', source: '' }] }) });
  });
  await ctx.route(/x\.example\/.*\.jpg/, r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#c00"/></svg>' }));
  await pg.evaluate(id => invOpenFullEdit(id), P.id); await pg.waitForSelector('#gmt-pe [data-pe-lensin]', { timeout: 8000 });
  ok(!!(await pg.$('#gmt-pe [data-pe-gimgin]')), 'الزرّان ظاهران: «🔎 عدسة غوغل هنا» و«🔍 صور غوغل هنا»');
  await pg.click('#gmt-pe [data-pe-lensin]'); await pg.waitForTimeout(1200);
  ok(seen[0] && seen[0].kind === 'lens' && seen[0].url === 'https://x.example/rf50.jpg', 'العدسة تُرسل صورة المنتج نفسها: ' + JSON.stringify(seen[0]));
  const L = await pg.evaluate(() => ({ hidden: document.querySelector('#gmt-pe [data-pe-lensbox]').hidden, n: document.querySelectorAll('#gmt-pe [data-pe-lens-res] figure').length,
    title: document.querySelector('#gmt-pe [data-pe-lenstitle]').textContent, txt: document.querySelector('#gmt-pe [data-pe-lens-res]').innerText, links: [...document.querySelectorAll('#gmt-pe [data-pe-lens-res] a')].map(a => a.href) }));
  ok(!L.hidden && L.n === 2 && /غوغل يظنّه «Canon RF 50mm F1.8 STM»/.test(L.title), 'النتائج داخل الصفحة + تخمين غوغل: ' + L.title);
  ok(/Canon · \$199/.test(L.txt) && /B&H Photo/.test(L.txt) && L.links[0] === 'https://www.canon.com/rf50', 'كلّ نتيجة: العنوان · المصدر · السعر · رابط الصفحة');
  const before = await pg.evaluate(() => document.querySelectorAll('#gmt-pe [data-pe-invimgs] img').length);
  await pg.click('#gmt-pe [data-pe-lens-res] figure:first-child [data-a=add]'); await pg.waitForTimeout(1500);
  const after = await pg.evaluate(() => [...document.querySelectorAll('#gmt-pe [data-pe-invimgs] img')].map(i => i.getAttribute('src')));
  ok(after.length === before + 1, '«+ أضف» أضاف الصورة لصور المنتج: ' + before + ' ⇐ ' + after.length + ' · ' + String(after[after.length - 1]).slice(0, 70));
  await pg.click('#gmt-pe [data-pe-gimgin]'); await pg.waitForTimeout(1200);
  const s2 = seen[seen.length - 1];
  ok(s2 && s2.kind === 'images' && /RF 50mm/.test(s2.q) && /Canon/.test(s2.q), 'صور غوغل باسم المنتج (والماركة): ' + (s2 && s2.q));
  ok(await pg.evaluate(() => document.querySelectorAll('#gmt-pe [data-pe-lens-res] figure').length) === 3, 'صور غوغل معروضة (3)');
  mode = 'nokey';
  await pg.click('#gmt-pe [data-pe-lensin]'); await pg.waitForTimeout(1000);
  const msg = await pg.evaluate(() => (document.querySelector('#gmt-pe [data-pe-msg]') || document.querySelector('#gmt-pe .pe-msg') || {}).textContent || document.querySelector('#gmt-pe').innerText);
  ok(/SerpApi/.test(msg), 'بلا مفتاح ⇒ يقول ما ينقص (مفتاح SerpApi المجاني)');
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406|503)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
