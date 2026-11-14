// (TASK-B0401 · المالك seq B703) «اعمل هاد البكج وخود منتجاته وضيفه وحط معه هالفيديو» — فيديو الباقة داخل المتجر: النقطة الحمراء + شريحة ثانية تُشغَّل داخله
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const B = H.BASE, POSTER = B + 'img/v/DWcYG-lDJhc.jpg', VID = 'https://general-media-tech.github.io/system__V/img/v/DWcYG-lDJhc.mp4';
const st = { categories: [{ id: 'c_bundles', name: 'باقات وعروض', order: 0 }, { id: 'c0', name: 'قسم', order: 1 }], banners: [], offers: [], branches: [],
  products: [{ id: 'x1', name: 'منتج', price: 10, category_id: 'c0', images: [B + 'img/p/lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png'] }] };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  await H.call('/rest/v1/gmt_offers', { name: 'بكج إضاءة MAMIN 500W RGBW الكامل', offer_type: 'bundle', offer_price: 200, original_price: 238, is_active: true, targets: { site: true, store: true, cats: ['c_bundles'] },
    image_url: POSTER, images: [POSTER], reel_url: VID, products: JSON.stringify([{ id: 'a', name: 'M8518 رأس 500w', qty: 1, price: 125 }, { id: 'b', name: 'سوفت بوكس جريد 90×70', qty: 1, price: 80 }]) });
  await H.call('/rest/v1/gmt_offers', { name: 'باقة بلا فيديو', offer_type: 'bundle', offer_price: 50, is_active: true, targets: { site: true, store: true, cats: ['c_bundles'] },
    image_url: POSTER, images: [POSTER], products: JSON.stringify([{ id: 'a', name: 'قطعة', qty: 1, price: 60 }]) });
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(6000);
  const cards = await o.pg.evaluate(() => [...document.querySelectorAll('[data-pkg]')].map(c => ({ n: c.innerText.split('\n').find(t => /بكج|باقة/.test(t)) || '', dot: !!c.querySelector('.pc-vid') })));
  const withV = cards.find(c => /MAMIN/.test(c.n)), noV = cards.find(c => /بلا فيديو/.test(c.n));
  ok(withV && withV.dot && noV && !noV.dot, '① النقطة الحمراء على بطاقة الباقة التي لها فيديو فقط ' + JSON.stringify(cards));
  await o.pg.evaluate(() => [...document.querySelectorAll('[data-pkg]')].find(c => /MAMIN/.test(c.innerText)).click()); await o.pg.waitForTimeout(900);
  const d = await o.pg.evaluate(() => { const sl = [...document.querySelectorAll('#pkg-slides > div')]; const v = sl[1] && sl[1].querySelector('video');
    return { n: sl.length, firstImg: !!sl[0].querySelector('img'), v: !!v, srcs: v ? [...v.querySelectorAll('source')].map(s => s.src.split('/').pop()) : [], poster: v && v.poster.split('/').pop(), dots: document.querySelectorAll('#pkg-dots span').length, arrows: document.querySelectorAll('#pkg-view button').length }; });
  ok(d.n === 2 && d.firstImg && d.v, '② الفيديو شريحةٌ ثانية بعد صورة الواجهة ' + JSON.stringify(d));
  ok(JSON.stringify(d.srcs) === '["DWcYG-lDJhc.mp4","DWcYG-lDJhc.webm"]' && d.poster === 'DWcYG-lDJhc.jpg', '② يُشغَّل من استضافتنا (mp4 ثمّ webm) بغلافه — لا إنستغرام');
  ok(d.dots === 2 && d.arrows === 2, '② صورة واحدة + فيديو ⇒ أسهم ونقطتان للتنقّل');
  const p = await o.pg.evaluate(async () => { const v = document.querySelector('.pkg-video'); let n = 0; v.pause = () => { n++; }; closeModal('package-modal'); await new Promise(r => setTimeout(r, 200)); return { pausedAfter: n > 0, n }; });   // (المتصفّح الآلي بلا H.264 ⇒ نراقب الإيقاف بدل التشغيل)
  ok(p.pausedAfter, '③ إغلاق نافذة الباقة يوقف الفيديو ' + JSON.stringify(p));
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext|play\(\)/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
