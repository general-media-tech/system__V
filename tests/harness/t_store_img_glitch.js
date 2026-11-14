// (seq B656) «في بطئ شديد بعرض الصور وخربطة واحيانا صورة عم يظهر جزء منها خارج الاطار او نصف الصورة التالية في المتجر»
// الجذور:
//  ① شرائح معرض المنتج كانت min-width:100% بلا عرضٍ ثابت ⇒ كلّ شريحة أعرض من الإطار ببكسلات (413–414 من 412) فيتراكم الانزياح
//     مع كلّ صورة ⇒ يظهر طرف الصورة التالية. الآن flex:0 0 100% ⇒ كلّ شريحة بعرض الإطار تماماً.
//  ② البطاقات object-fit:cover ⇒ الصورة غير المربّعة (بوستر عريض) تُقصّ. الآن gmtFit ⇒ contain إن اختلفت النسبة.
//  ③ صفحة المنتج كانت تنتظر الصورة الكاملة من الصفر. الآن المصغّرة فوراً ثمّ الكاملة للشريحة الحالية وجارتيها.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const B = H.BASE;
const WIDE = ['lens_8734105f-d549-4199-ac40-bc7582d36ca4_1793360185512.jpg', 'lens_8734105f-d549-4199-ac40-bc7582d36ca4_1793360184916.jpg', 'lens_46ac85b2-ebb0-4fd2-b4b4-f86dfbaa4dc2_1793360154149.jpg'];
const SQ = ['lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png', 'lens_f38182bf-d776-4639-bad5-cae938b73806_1793191631554.png'];
const mix = [SQ[0], WIDE[0], SQ[1], WIDE[1], WIDE[2]].map(f => B + 'img/p/' + f);
const prods = [
  { id: 'g1', name: 'منتج بخمس صور', price: 50, category_id: 'c0', images: mix },
  { id: 'g2', name: 'بوستر عريض', price: 20, category_id: 'c0', images: [B + 'img/p/' + WIDE[0]] },
  { id: 'g3', name: 'صورة مربّعة', price: 30, category_id: 'c0', images: [B + 'img/p/' + SQ[0]] },
];
const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  // الصورة الكاملة بطيئة (كشبكة ضعيفة) ⇒ نرى المصغّرة أوّلاً
  await o.ctx.route(/\/img\/p\//, async r => { await new Promise(z => setTimeout(z, 1200)); r.fallback(); });
  await o.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' });
  await o.pg.waitForTimeout(4500);
  // ② البطاقات
  const cards = await o.pg.evaluate(() => [...document.querySelectorAll('img')].filter(i => /\/img\/t\/lens_/.test(i.src) && i.closest('.min-w-\\[160px\\]'))
    .map(i => ({ wide: /8734105f|46ac85b2/.test(i.src), fit: getComputedStyle(i).objectFit, ok: i.complete && i.naturalWidth > 0 })));
  ok(cards.some(c => c.wide && c.ok) && cards.filter(c => c.wide && c.ok).every(c => c.fit === 'contain'), '② البوستر العريض في البطاقة يُعرض كاملاً (contain) لا مقصوصاً ' + JSON.stringify(cards));
  ok(cards.filter(c => !c.wide && c.ok).length > 0 && cards.filter(c => !c.wide && c.ok).every(c => c.fit === 'cover'), '② الصورة المربّعة تبقى ملء الإطار (cover)');
  // ③ صفحة المنتج: المصغّرة فوراً
  await o.pg.evaluate(() => openProductModal('g1'));
  await o.pg.waitForTimeout(400);
  const early = await o.pg.evaluate(() => { const i = document.querySelector('#product-modal-slides img'); return { src: i.getAttribute('src'), shown: i.complete && i.naturalWidth > 0 }; });
  ok(/\/img\/t\//.test(early.src) && early.shown, '③ عند الفتح تظهر المصغّرة فوراً (لا انتظار الكاملة) ' + JSON.stringify(early));
  await o.pg.waitForTimeout(2500);
  const late = await o.pg.evaluate(() => [...document.querySelectorAll('#product-modal-slides img')].map(i => /\/img\/p\//.test(i.src) ? 'p' : 't').join(''));
  ok(late.startsWith('pp') && late.slice(2).includes('t'), '③ الكاملة حلّت محلّ المصغّرة للشريحة الحالية وجارتها فقط، والبعيدة لم تُجلب بعد: ' + late);
  // ① المحاذاة عبر كلّ الشرائح
  const drift = [];
  for (let k = 0; k < mix.length; k++) {
    const r = await o.pg.evaluate(() => { const v = document.getElementById('pm-view').getBoundingClientRect(); const sl = [...document.querySelectorAll('#product-modal-slides > div')];
      return { w: sl.map(d => Math.round(d.getBoundingClientRect().width)), vw: Math.round(v.width), off: Math.round(sl[_pmIdx].getBoundingClientRect().left - v.left) }; });
    drift.push(r.off); if (k === 0) ok(r.w.every(x => x === r.vw), '① كلّ شريحة بعرض الإطار تماماً ' + JSON.stringify(r));
    if (k < mix.length - 1) { await o.pg.evaluate(() => productModalSlide(1)); await o.pg.waitForTimeout(450); }
  }
  ok(drift.every(x => x === 0), '① لا انزياح مع التنقّل (لا يظهر طرف الصورة التالية) ' + JSON.stringify(drift));
  await o.pg.waitForTimeout(1600);
  const allFull = await o.pg.evaluate(() => [...document.querySelectorAll('#product-modal-slides img')].map(i => /\/img\/p\//.test(i.src) ? 'p' : 't').join(''));
  ok(allFull === 'ppppp', '③ بعد التنقّل كلّ الشرائح بالصورة الكاملة ' + allFull);
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
