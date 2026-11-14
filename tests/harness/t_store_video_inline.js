// (TASK-B0387 · المالك seq B678) «معاينة الفيديو من المتجر كثير سيئة: ما عم تنعرض لما بقلّب بين الصور إذا كنت داخل معاين الصورة ·
// لما أدخل على الفيديو عم يقطّش وما عم يفتح من المتصفح وعم ياخذني على إنستغرام · لازم يظهر الفيديو كأنه في المتجر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const B = H.BASE;
const prods = [{ id: 'v1', name: 'رأس إضاءة بفيديو', price: 50, category_id: 'c0', video_url: 'https://www.instagram.com/reel/DQOtgYZjANt/?igsh=xx',
  images: [B + 'img/p/lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png', B + 'img/p/lens_f38182bf-d776-4639-bad5-cae938b73806_1793191631554.png'] },
  { id: 'v3', name: 'إضاءة قلب بفيديو الكتالوج', price: 15, category_id: 'c0', video_url: 'https://general-media-tech.github.io/system__V/img/v/cat_heart.mp4', images: [B + 'img/p/lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png'] },
  { id: 'v2', name: 'منتج بفيديو غير مستضاف', price: 20, category_id: 'c0', video_url: 'https://www.instagram.com/reel/ZZZnotLocal/', images: [B + 'img/p/lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png'] }];
const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){} window.__open=[]; window.open=function(u){ window.__open.push(u); return null; };`;
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  const ig = []; o.pg.on('request', r => { if (/instagram\.com/.test(r.url())) ig.push(r.url()); });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4000);
  const dots = await o.pg.evaluate(() => [...document.querySelectorAll('.pc-vid')].length);
  ok(dots === 3, '(seq B679) نقطة حمراء على بطاقة كلّ منتج له فيديو: ' + dots);
  await o.pg.evaluate(() => openProductModal('v1')); await o.pg.waitForTimeout(1200);
  const a = await o.pg.evaluate(() => { const sl = [...document.querySelectorAll('#product-modal-slides > div')]; const v = sl[2] && sl[2].querySelector('video');
    const th = [...document.querySelectorAll('#pm-thumbs .pm-th')]; return { n: sl.length, srcs: v ? v.querySelectorAll('source').length : 0, src: v && (v.querySelector('source') || {}).src, poster: v && v.getAttribute('poster'), pre: v && v.preload, inline: v && v.hasAttribute('playsinline'),
      btn: !!document.querySelector('#product-modal-slides .pm-vid'), thumbImg: th[2] && th[2].querySelector('img') && th[2].querySelector('img').getAttribute('src'), can: v ? v.canPlayType('video/mp4; codecs="avc1.4D401E"') : '' }; });
  ok(a.n === 3 && a.srcs === 2 && /img\/v\/DQOtgYZjANt\.mp4$/.test(a.src || '') && /DQOtgYZjANt\.jpg$/.test(a.poster || '') && a.inline && !a.btn, '① الفيديو شريحةٌ في المعرض: مشغّل داخلي من ملفّنا (لا إنستغرام) بغلافه ' + JSON.stringify(a));
  ok(a.pre === 'none', '① لا يُحمَّل الفيديو قبل الضغط (preload=none)');
  ok(/DQOtgYZjANt\.jpg$/.test(a.thumbImg || ''), '① مصغّرة الفيديو = غلافه مع علامة التشغيل');
  // التشغيل فعلاً
  const play = await o.pg.evaluate(async () => { _goToPMSlide(2); await new Promise(r => setTimeout(r, 400)); const v = document.querySelectorAll('#product-modal-slides video')[0]; v.muted = true;
    try { await v.play(); } catch (e) { return { err: String(e) }; } await new Promise(r => setTimeout(r, 1500)); return { t: v.currentTime, paused: v.paused, w: v.videoWidth }; });
  ok(play.t > 0.3 && !play.paused && play.w > 0, '② الفيديو يعمل داخل الصفحة (يتقدّم الوقت) ' + JSON.stringify(play));
  await o.pg.evaluate(() => productModalSlide(-1)); await o.pg.waitForTimeout(500);
  const pz = await o.pg.evaluate(() => document.querySelector('#product-modal-slides video').paused);
  ok(pz, '② الانتقال لصورة أخرى يوقف الفيديو');
  // ③ العارض الكامل: الفيديو بين الصور
  const z = await o.pg.evaluate(async () => { pmZoomOpen(0); await new Promise(r => setTimeout(r, 300)); const out = [];
    for (let k = 0; k < 3; k++) { const im = document.querySelector('#pm-zoom img'), vd = document.querySelector('#pm-zoom video');
      out.push({ c: document.getElementById('pz-count').textContent, img: im.style.display !== 'none', vid: vd.style.display !== 'none' ? (vd.querySelector('source') || {}).src : null }); pmZoomStep(1); await new Promise(r => setTimeout(r, 200)); }
    pmZoomClose(); return out; });
  ok(z.length === 3 && z[0].c === '1 / 3' && z[0].img && z[2].vid && /DQOtgYZjANt\.mp4$/.test(z[2].vid) && !z[2].img, '③ في العارض الكامل يظهر الفيديو عند التقليب بين الصور ' + JSON.stringify(z));
  ok(!ig.length && !(await o.pg.evaluate(() => window.__open.length)), '④ لا طلب لإنستغرام ولا فتح نافذة خارجية: ' + ig.length);
  // ⑥ (seq B687) فيديو كتالوج المورد المستضاف مباشرةً ⇒ نفس المشغّل الداخلي بغلافه
  await o.pg.evaluate(() => openProductModal('v3')); await o.pg.waitForTimeout(800);
  const c3 = await o.pg.evaluate(() => { const v = document.querySelector('#product-modal-slides video'); return v ? { src: (v.querySelector('source') || {}).src, poster: v.getAttribute('poster'), n: v.querySelectorAll('source').length } : null; });
  ok(c3 && /img\/v\/cat_heart\.mp4$/.test(c3.src) && /cat_heart\.jpg$/.test(c3.poster) && c3.n === 2, '⑥ فيديو الكتالوج المستضاف: مشغّل داخلي بغلافه ونسختين ' + JSON.stringify(c3));
  // ⑤ فيديو غير مستضاف ⇒ يبقى الزرّ القديم (المشغّل المضمَّن)
  await o.pg.evaluate(() => openProductModal('v2')); await o.pg.waitForTimeout(800);
  const b = await o.pg.evaluate(() => ({ btn: !!document.querySelector('#product-modal-slides .pm-vid'), vid: !!document.querySelector('#product-modal-slides video') }));
  ok(b.btn && !b.vid, '⑤ ريلٌ غير مستضاف بعد ⇒ زرّ التشغيل المضمَّن كما كان');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
