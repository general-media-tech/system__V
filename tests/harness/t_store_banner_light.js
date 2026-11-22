// (TASK-A0563 · المالك seq 961 — سجلّ الأخطاء: «فشل تحميل IMG» لبانر PNG ٥٢٩ك.ب)
//  ① بانرٌ له نسخةٌ خفيفة (img/b/…webp) ⇒ تُحمَّل هي (٤٠ك.ب بدل ٥٢٩)
//  ② بانرٌ بلا نسخة خفيفة ⇒ يعود للأصليّة تلقائياً (لا صورة مكسورة)
//  ③ بانر القسم كذلك
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  const B = H.BASE;
  const cats = [{ id: 'c1', name: 'كانون', order: 1, banners: [{ image: B + 'img/p/s/1000554967_1776016936780.png' }] }];
  const prods = [{ id: 'p1', name: 'منتج', price: 10, category_id: 'c1', category_ids: ['c1'], images: [] }];
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-22T10:00:00Z', categories: cats, offers: [], branches: [], products: prods,
    banners: [{ image: B + 'img/p/s/1000554967_1776016936780.png', title: 'ثقيل' }, { image: B + 'img/p/s/1000571728_1776016874032.jpg', title: 'ب' }, { image: B + 'img/p/s/1000047907_1778920591525.jpg', title: 'بلا خفيفة' }] }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 404, body: '' }));
  await o.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(6000);
  const r = await o.pg.evaluate(() => ({
    main: [...document.querySelectorAll('#main-banner-slider img')].map(i => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0 })),
    cat: [...document.querySelectorAll('.cat-section-banner img')].map(i => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0 })) }));
  ok(r.main[0] && /\/img\/b\/s\/1000554967_1776016936780\.webp$/.test(r.main[0].src) && r.main[0].ok, '① البانر الثقيل ⇒ النسخة الخفيفة ' + (r.main[0] || {}).src);
  ok(r.main[2] && /\/img\/p\/s\/1000047907_1778920591525\.jpg$/.test(r.main[2].src), '② بلا نسخة خفيفة ⇒ الأصليّة ' + (r.main[2] || {}).src);
  ok(r.cat[0] && /\/img\/b\/s\//.test(r.cat[0].src) && r.cat[0].ok, '③ بانر القسم ⇒ الخفيفة');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
