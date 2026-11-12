// (TASK-0342 · المالك seq 626) «عم افتح المتجر ولكن صور المنتجات ما عم تحمل إلا القليل»
// الجذر: البطاقات كانت تطلب كلّ صورة بحجمها الكامل (median 86 ك.ب · حتى 3.6 م.ب) دفعةً واحدة (~600 صورة ≈ 80 م.ب) ⇒ على اتّصال ضعيف لا يكتمل إلا القليل.
// الآن: ① بطاقة المنتج تطلب المصغّرة img/t/*.webp (≤400px) ② loading=lazy ⇒ الأقسام البعيدة لا تُطلب قبل التمرير
// ③ غياب المصغّرة ⇒ ترجع للأصلية تلقائياً ④ صفحة المنتج تعرض الصورة الكاملة img/p.
const H = require('./h.js');
const fs = require('fs'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const ROOT = path.join(__dirname, '..', '..');
const files = fs.readdirSync(path.join(ROOT, 'img/p/web/shixin')).filter(f => /\.jpg$/.test(f)).slice(0, 40);
const cats = Array.from({ length: 20 }, (_, i) => ({ id: 'c' + i, name: 'قسم ' + i, order: i }));
const prods = files.map((f, i) => ({ id: 's_' + i, name: 'منتج ' + i, price: 10 + i, category_id: 'c' + (i % 20),
  images: [H.BASE + 'img/p/web/shixin/' + f, H.BASE + 'img/p/web/shixin/' + files[(i + 1) % files.length]] }));
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  const rec = { store: { categories: cats, banners: [], offers: [], branches: [], products: prods } };
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-12T10:00:00Z', ...rec.store }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rec.store) }));
  const reqT = new Set(), reqP = new Set();
  o.pg.on('request', r => { const u = r.url(); if (/\/img\/t\//.test(u)) reqT.add(u); else if (/\/img\/p\//.test(u)) reqP.add(u); });
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' });
  await o.pg.waitForTimeout(7000);
  const a = await o.pg.evaluate(() => {
    const im = [...document.querySelectorAll('[data-category-section] img, img')].filter(i => /\/img\/[pt]\//.test(i.getAttribute('src') || ''));
    const cardImgs = im.filter(i => /\/img\/t\//.test(i.src));
    const loaded = cardImgs.filter(i => i.complete && i.naturalWidth > 0);
    return { total: im.length, thumbs: cardImgs.length, lazy: cardImgs.filter(i => i.loading === 'lazy').length,
      loaded: loaded.length, maxW: Math.max(0, ...loaded.map(i => Math.max(i.naturalWidth, i.naturalHeight))), webp: cardImgs.every(i => /\.webp$/.test(i.src)) };
  });
  ok(a.thumbs >= 8 && a.thumbs === a.lazy && a.webp, '① بطاقات المنتجات تطلب المصغّرة img/t/*.webp وكلّها loading=lazy ' + JSON.stringify(a));
  ok(a.loaded > 0 && a.maxW <= 400, '① المصغّرات المحمّلة ≤ 400px (لا صور كاملة في البطاقات) maxW=' + a.maxW);
  ok(reqP.size === 0, '① لا تُطلب أيّ صورة كاملة img/p قبل فتح منتج: ' + reqP.size);
  ok(reqT.size > 0 && reqT.size < prods.length, '② التحميل عند الاقتراب: طُلبت ' + reqT.size + ' مصغّرة من ' + prods.length + ' قبل التمرير');
  // ③ غياب المصغّرة ⇒ الأصلية
  const fb = await o.pg.evaluate(async (orig) => {
    const d = document.createElement('div'); d.innerHTML = `<img ${gmtThumbAttrs(orig)}>`; const img = d.firstChild;
    img.src = orig.replace('/img/p/', '/img/t/').replace(/\.jpg$/, '_لا_توجد.webp'); document.body.appendChild(d); img.scrollIntoView();   // الصورة lazy: خارج الشاشة لا تُطلب أصلاً فلا يُختبر الرجوع
    for (let i = 0; i < 40 && !(img.complete && img.naturalWidth); i++) await new Promise(r => setTimeout(r, 100));
    return { src: img.src === orig, w: img.naturalWidth };
  }, prods[0].images[0]);
  ok(fb.src && fb.w > 400, '③ مصغّرة غائبة ⇒ تُعرض الأصلية تلقائياً ' + JSON.stringify(fb));
  // ④ صفحة المنتج بالصورة الكاملة
  await o.pg.evaluate(() => openProductModal('s_0')); await o.pg.waitForTimeout(1500);
  const m = await o.pg.evaluate(() => { const i = document.querySelector('#product-modal-slides img'); return i ? { full: /\/img\/p\//.test(i.src), w: i.naturalWidth } : null; });
  ok(m && m.full && m.w > 400, '④ صفحة المنتج تعرض الصورة الكاملة ' + JSON.stringify(m));
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
