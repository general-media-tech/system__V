// (TASK-0362 · المالك seq 637) «معاينة صور المنتج صغيرة بالنسبة للهاتف وغير عملية … من اللابتوب نفس الشيء» + «بدي الفيديو يشتغل داخل المتجر وما يفتح لي صفحة الانستقرام»
const H = require('./h.js');
const fs = require('fs'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const files = fs.readdirSync(path.join(__dirname, '..', '..', 'img/p/web/shixin')).filter(f => /\.jpg$/.test(f)).slice(0, 4);
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const store = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [],
  products: [{ id: 'g_1', name: 'منتج المعرض', price: 25, category_id: 'c0', images: files.map(f => H.BASE + 'img/p/web/shixin/' + f), video_url: 'https://www.instagram.com/reel/Cabc123XYZ/?igsh=abc' },
             { id: 'g_2', name: 'صورة واحدة', price: 5, category_id: 'c0', images: [H.BASE + 'img/p/web/shixin/' + files[0]] }] };
async function open(w, h, mobile) {
  const o = await H.open('logo.jpg', { init: VISITOR, w, h, mobile, wait: 0 });
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store) }));
  await o.ctx.route(/instagram\.com|youtube\.com/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>embed</body></html>' }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(6000);
  await o.pg.evaluate(() => { window.__opened = []; window.open = function (u) { window.__opened.push(String(u)); return null; }; });
  return o;
}
const st = pg => pg.evaluate(() => { const v = document.getElementById('pm-view').getBoundingClientRect(); const im = document.querySelector('#product-modal-slides > div:nth-child(' + (_pmIdx + 1) + ') img');
  return { vh: Math.round(v.height), vw: Math.round(v.width), thumbs: document.querySelectorAll('#pm-thumbs .pm-th').length, on: [...document.querySelectorAll('#pm-thumbs .pm-th')].findIndex(b => b.classList.contains('on')),
    count: document.getElementById('pm-count').textContent, countShown: !document.getElementById('pm-count').classList.contains('hidden'), idx: _pmIdx, imgW: im ? Math.round(im.getBoundingClientRect().width) : 0,
    slides: document.querySelectorAll('#product-modal-slides > div').length, iframes: document.querySelectorAll('#product-modal-slides iframe').length, dots: getComputedStyle(document.getElementById('product-modal-dots')).display }; });
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-12T10:00:00Z', ...store }]);
  let o = await open(412, 860, true), pg = o.pg;
  await pg.evaluate(() => openProductModal('g_1')); await pg.waitForTimeout(1500);
  let s = await st(pg);
  ok(s.vh >= 380 && s.vw >= 400 && s.imgW >= 300, 'الهاتف: مساحة الصورة كبيرة بعرض الشاشة (كانت 260px): ' + s.vw + '×' + s.vh + ' · عرض الصورة ' + s.imgW);
  ok(s.slides === 5 && s.thumbs === 5 && s.on === 0 && s.count === '1 / 5' && s.countShown && s.dots === 'none', 'شريط مصغّرات (4 صور + فيديو) وعدّاد «1 / 5» بدل النقاط: ' + JSON.stringify(s));
  await pg.click('#pm-thumbs .pm-th:nth-child(3)'); await pg.waitForTimeout(400); s = await st(pg);
  ok(s.idx === 2 && s.on === 2 && s.count === '3 / 5', 'ضغطة على المصغّرة الثالثة ⇒ الصورة الثالثة: ' + s.count);
  // سحب بالإصبع
  const swipe = (sel, dx) => pg.evaluate(([sel, dx]) => { const el = document.querySelector(sel), r = el.getBoundingClientRect(); const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: r.top + r.height / 2 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [mk(r.left + r.width / 2)], changedTouches: [mk(r.left + r.width / 2)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [mk(r.left + r.width / 2 + dx)] })); }, [sel, dx]);
  await swipe('#pm-view', 120); await pg.waitForTimeout(400); s = await st(pg);
  ok(s.idx === 3, 'سحبة بالإصبع ⇒ الصورة التالية (' + s.count + ')');
  await swipe('#pm-view', -120); await pg.waitForTimeout(400); s = await st(pg);
  ok(s.idx === 2, 'سحبة عكسية ⇒ السابقة (' + s.count + ')');
  // تكبير بملء الشاشة
  await pg.evaluate(() => document.querySelector('#product-modal-slides > div:nth-child(3) img').click()); await pg.waitForTimeout(500);
  let z = await pg.evaluate(() => { const z = document.getElementById('pm-zoom'), im = z.querySelector('img'), r = im.getBoundingClientRect(); return { on: z.classList.contains('on'), src: im.src.split('/').pop(), w: Math.round(r.width), cnt: document.getElementById('pz-count').textContent, cover: Math.round(z.getBoundingClientRect().height) }; });
  ok(z.on && z.src === files[2] && z.w >= 400 && z.cnt === '3 / 4' && z.cover >= 850, 'ضغطة على الصورة ⇒ ملء الشاشة بالصورة نفسها كاملة العرض (الفيديو لا يدخل العدّ): ' + JSON.stringify(z));
  await pg.evaluate(() => document.querySelector('#pm-zoom img').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /scale\(2\.5\)/.test(document.querySelector('#pm-zoom img').style.transform)), 'ضغطتان ⇒ تقريب ×2.5');
  await pg.evaluate(() => pmZoomStep(1)); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.querySelector('#pm-zoom img').src.split('/').pop()) === files[3] && await pg.evaluate(() => /scale\(1\)/.test(document.querySelector('#pm-zoom img').style.transform)), 'التالية داخل التكبير ⇒ الصورة الرابعة بحجمها الطبيعي');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); s = await st(pg);
  ok(!(await pg.evaluate(() => document.getElementById('pm-zoom').classList.contains('on'))) && s.idx === 3, 'الإغلاق يعيدك للمعرض على الصورة التي وصلت إليها (' + s.count + ')');
  // الفيديو داخل المتجر
  await pg.click('#pm-thumbs .pm-th:nth-child(5)'); await pg.waitForTimeout(400); s = await st(pg);
  ok(s.idx === 4 && s.iframes === 0 && await pg.evaluate(() => !!document.querySelector('#product-modal-slides > div:nth-child(5) .pm-vid')), 'شريحة الفيديو: زرّ «تشغيل الفيديو» (لا إطار إنستغرام مضغوط داخل مساحة الصورة)');
  await pg.click('#product-modal-slides > div:nth-child(5) .pm-vid'); await pg.waitForTimeout(600);
  let m = await pg.evaluate(() => { const g = document.getElementById('gmt-media'), f = g && g.querySelector('iframe'); return { on: !!g && g.classList.contains('on'), src: f && f.src, opened: window.__opened.length, h: f ? Math.round(f.getBoundingClientRect().height) : 0 }; });
  ok(m.on && m.src === 'https://www.instagram.com/reel/Cabc123XYZ/embed/' && m.opened === 0 && m.h >= 700, 'الفيديو يُشغَّل داخل المتجر بمشغّلٍ بملء الشاشة ولا تُفتح أيّ صفحة خارجية: ' + JSON.stringify(m));
  await pg.evaluate(() => closeStoreMedia());
  ok(await pg.evaluate(() => !document.getElementById('gmt-media').classList.contains('on') && !document.querySelector('#gmt-media iframe')), 'الإغلاق يوقف الفيديو (يُزال الإطار)');
  const e = await pg.evaluate(() => ({ yt: gmtMediaEmbed('https://youtu.be/dQw4w9WgXcQ?t=3'), sh: gmtMediaEmbed('https://www.youtube.com/shorts/abcDEF12345'), tt: gmtMediaEmbed('https://www.tiktok.com/@u/video/7301234567890123456'), mp: gmtMediaEmbed('https://x.com/v/clip.mp4?x=1'), ig: gmtMediaEmbed('https://instagram.com/p/AbC_1-2/'), no: gmtMediaEmbed('https://example.com/page') }));
  ok(/youtube\.com\/embed\/dQw4w9WgXcQ/.test(e.yt.src) && e.yt.wide && !e.sh.wide && /tiktok\.com\/embed\/v2\/7301234567890123456/.test(e.tt.src) && e.mp.kind === 'video' && /instagram\.com\/p\/AbC_1-2\/embed\//.test(e.ig.src) && e.no === null, 'يوتيوب · شورتس · تيك توك · ملفّ فيديو · منشور إنستغرام ⇒ مشغّل مضمَّن · صفحة عادية ⇒ لا');
  await pg.evaluate(() => gmtOpenLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.getElementById('gmt-media').classList.contains('on') && window.__opened.length === 0), 'بانر رابطه فيديو ⇒ يُشغَّل داخل المتجر');
  await pg.evaluate(() => { closeStoreMedia(); gmtOpenLink('https://example.com/offer'); });
  ok(await pg.evaluate(() => window.__opened.length === 1 && window.__opened[0] === 'https://example.com/offer'), 'بانر رابطه صفحة خارجية عادية ⇒ يُفتح خارجاً كما كان');
  // منتج بصورة واحدة: بلا مصغّرات ولا عدّاد
  await pg.evaluate(() => { closeModal('product-modal'); openProductModal('g_2'); }); await pg.waitForTimeout(1200); s = await st(pg);
  ok(s.thumbs === 0 && !s.countShown && s.slides === 1, 'منتج بصورة واحدة ⇒ لا شريط مصغّرات ولا عدّاد');
  let real = o.errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource/.test(x));
  ok(!real.length, 'الهاتف: لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  // اللابتوب
  o = await open(1366, 800, false); pg = o.pg;
  await pg.evaluate(() => openProductModal('g_1')); await pg.waitForTimeout(1500); s = await st(pg);
  const th = await pg.evaluate(() => { const t = document.getElementById('pm-thumbs').getBoundingClientRect(), m = document.getElementById('pm-media').getBoundingClientRect(); return { h: Math.round(t.height), inside: t.bottom <= m.bottom + 1 && t.top >= m.top }; });
  ok(s.vh >= 430 && s.vw >= 550 && s.imgW >= 350 && s.thumbs === 5 && th.inside && th.h >= 70, 'اللابتوب: الصورة تملأ عمودها (' + s.vw + '×' + s.vh + ' · عرض الصورة ' + s.imgW + ') والمصغّرات تحتها داخل العمود');
  await pg.evaluate(() => document.querySelector('#product-modal-slides > div:nth-child(1) img').click()); await pg.waitForTimeout(400);
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => document.getElementById('pm-zoom').classList.contains('on') && document.getElementById('pz-count').textContent === '2 / 4'), 'اللابتوب: التكبير يعمل، وأسهم لوحة المفاتيح تتنقّل');
  real = o.errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource/.test(x));
  ok(!real.length, 'اللابتوب: لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await pg.keyboard.press('Escape'); await pg.screenshot({ path: '/tmp/gmt-out/gallery_desk.png' });
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
