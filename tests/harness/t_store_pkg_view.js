// (TASK-B0387 · المالك seq B678) «صورة البكج ما ظهرت في الأوّل … ما ظهرت بالخارج ما عم تحمّل لحتى أدخل · ومعاينة الصور بالبكج مو زابطة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const B = H.BASE, POSTER = B + 'img/p/s/pkg_content_creator_2026-11-14.jpg', STUDIO = B + 'img/p/s/pkg_content_creator_studio_2026-11-14.jpg';
const st = { categories: [{ id: 'c_bundles', name: 'باقات وعروض', order: 0 }, { id: 'c0', name: 'قسم', order: 1 }], banners: [], offers: [], branches: [],
  products: [{ id: 'x1', name: 'منتج', price: 10, category_id: 'c0', images: [B + 'img/p/lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png'] }] };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  await H.call('/rest/v1/gmt_offers', { name: 'بكج صناعة المحتوى المتكامل', offer_type: 'bundle', offer_price: 300, original_price: 525, is_active: true, targets: { site: true, store: true, cats: ['c_bundles'] },
    image_url: POSTER, images: [POSTER, STUDIO], products: JSON.stringify([{ id: 'a', name: 'Led 660 pro', qty: 1, price: 77.4 }, { id: 'b', name: 'Stand 205 cm ستاند', qty: 5, price: 10 }]) });
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(6000);
  const c = await o.pg.evaluate(async () => { const im = document.querySelector('[data-pkg] img'); if (!im) return null; im.scrollIntoView(); for (let i = 0; i < 30 && !(im.complete && im.naturalWidth); i++) await new Promise(r => setTimeout(r, 100));
    return { src: im.getAttribute('src'), ok: im.complete && im.naturalWidth > 0 }; });
  ok(c && c.ok && /pkg_content_creator_2026-11-14/.test(c.src), '① صورة الباقة تظهر على البطاقة في الخارج (البوستر أوّلاً) دون الدخول ' + JSON.stringify(c));
  ok(c && /\/img\/t\/s\/pkg_content_creator_2026-11-14\.webp$/.test(c.src), '① البطاقة تطلب المصغّرة الموجودة (لا 404 ثمّ إعادة)');
  await o.pg.evaluate(() => document.querySelector('[data-pkg]').click()); await o.pg.waitForTimeout(900);
  const d = await o.pg.evaluate(() => { const v = document.getElementById('pkg-view'); const sl = [...document.querySelectorAll('#pkg-slides > div img')].map(i => i.getAttribute('src'));
    return { h: v.getBoundingClientRect().height, first: sl[0], second: sl[1], n: sl.length }; });
  ok(d.h > 420 && /pkg_content_creator_2026/.test(d.first) && /studio/.test(d.second), '② العارض بطول البوستر والصورتان أوّلاً (البوستر ثمّ الاستوديو) ' + JSON.stringify(d));
  const sw = await o.pg.evaluate(async () => { const v = document.getElementById('pkg-view'); const T = (x) => new Touch({ identifier: 1, target: v, clientX: x, clientY: 300 });
    v.dispatchEvent(new TouchEvent('touchstart', { touches: [T(100)], changedTouches: [T(100)], bubbles: true }));
    v.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [T(260)], bubbles: true })); await new Promise(r => setTimeout(r, 400)); return window._pkgIdx; });
  ok(sw === 1, '② السحب بالإصبع ينقل للصورة التالية: ' + sw);
  const z = await o.pg.evaluate(async () => { document.querySelector('#pkg-slides > div img').click(); await new Promise(r => setTimeout(r, 400));
    const zz = document.getElementById('pm-zoom'); return { on: zz && zz.classList.contains('on'), c: (document.getElementById('pz-count') || {}).textContent, src: (zz.querySelector('img') || {}).getAttribute('src') }; });
  ok(z.on && /^1 \/ \d/.test(z.c) && /pkg_content_creator_2026-11-14\.jpg$/.test(z.src), '③ الضغط على الصورة يفتح العارض الكامل (تكبير وتنقّل) ' + JSON.stringify(z));
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
