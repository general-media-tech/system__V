// (TASK-B0418 · المالك seq 727) «العرض على الكمبيوتر كتير سيئ — عمللي ياه أفخم متل أمازون» — تفاصيل الباقة عمودان على الكمبيوتر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const B = H.BASE, POSTER = B + 'img/p/s/pkg_content_creator_2026-11-14.jpg', STUDIO = B + 'img/p/s/pkg_content_creator_studio_2026-11-14.jpg';
const st = { categories: [{ id: 'c_bundles', name: 'باقات وعروض', order: 0 }, { id: 'c0', name: 'قسم', order: 1 }], banners: [], offers: [], branches: [],
  products: [{ id: 'a', name: 'منتج أ', price: 400, category_id: 'c0', images: [POSTER] }, { id: 'b', name: 'منتج ب', price: 125, category_id: 'c0', images: [STUDIO] }] };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  await H.call('/rest/v1/gmt_offers', { name: 'باقة الاختبار', offer_type: 'bundle', offer_price: 300, original_price: 525, is_active: true, description: 'وصف', targets: { site: true, store: true, cats: ['c_bundles'] },
    image_url: POSTER, images: [POSTER, STUDIO], products: JSON.stringify([{ id: 'a', name: 'منتج أ', qty: 1, price: 400 }, { id: 'b', name: 'منتج ب', qty: 1, price: 125 }]) });
  for (const [w, mobile, label] of [[1366, false, 'كمبيوتر'], [412, true, 'هاتف']]) {
    const o = await H.open('logo.jpg', { init: VISITOR, w, h: 860, mobile, wait: 0 });
    await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
    await o.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(5500);
    await o.pg.evaluate(() => document.querySelector('[data-pkg]').click()); await o.pg.waitForTimeout(1000);
    const L = await o.pg.evaluate(() => { const r = id => { const e = document.getElementById(id); const b = e && e.getBoundingClientRect(); return e && b.width ? { x: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.top) } : null; };
      const amz = document.querySelector('.pkg-amz'), bx = document.querySelector('.pkg-boxes');
      return { sheet: r('package-modal') && document.querySelector('#package-modal .modal-sheet').getBoundingClientRect().width, view: r('pkg-view'), thumbs: r('pkg-thumbs'), nth: document.querySelectorAll('#pkg-thumbs button').length,
        amzShown: !!(amz && getComputedStyle(amz).display !== 'none'), boxesShown: !!(bx && getComputedStyle(bx).display !== 'none'), foot: r('package-foot'), info: (() => { const e = document.querySelector('.pkg-info'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left), w: Math.round(b.width) }; })() }; });
    if (!mobile) {
      ok(L.sheet > 1000 && L.sheet <= 1180, label + ': النافذة عريضة (لا شاشة هاتف وسط الصفحة): ' + Math.round(L.sheet));
      ok(L.view && L.info.x < L.view.x && L.info.w > 400 && L.view.w > 500, label + ': عمودان — المعرض في جهة والمعلومات في الأخرى');
      ok(L.nth === 2 && L.thumbs, label + ': شريط مصغّرات بعدد الصور');
      ok(L.amzShown && !L.boxesShown, label + ': كتلة السعر الكبيرة بدل الصناديق الثلاثة');
      await o.pg.click('#pkg-thumbs button:nth-child(2)'); await o.pg.waitForTimeout(500);
      const idx = await o.pg.evaluate(() => ({ i: window._pkgIdx, on: [...document.querySelectorAll('#pkg-thumbs button')].map(b => b.classList.contains('on')).join() }));
      ok(idx.i === 1 && idx.on === 'false,true', label + ': الضغط على مصغّرة ينقل للصورة ويُفعّلها ' + JSON.stringify(idx));
      const fb = await o.pg.evaluate(() => { const b = document.querySelector('#package-foot button, #package-foot a'); const r = b.getBoundingClientRect(), i = document.querySelector('.pkg-info').getBoundingClientRect(); return { bx: r.left, br: r.right, ix: i.left, ir: i.right }; });
      ok(fb.bx >= fb.ix && fb.br <= fb.ir + 1, label + ': زرّ السلّة تحت عمود المعلومات ومحاذٍ له');
    } else {
      ok(L.sheet <= 480 && !L.amzShown && L.boxesShown && !L.thumbs, label + ': الهاتف كما كان (صناديق الأسعار · بلا مصغّرات)');
    }
    const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
    ok(!real.length, label + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
