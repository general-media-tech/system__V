// (TASK-0358 · المالك seq 626) «صور المتجر صارت خارج قاعدة البيانات ⇒ ما في داعي يتحمّل المتجر عند الزبون وعلى جهازه»
// زبون جديد: لا عامل خدمة ولا كاش · زبون قديم: يُحرَّر ما خُزّن · جهاز موظّف: يبقى كما هو، وصور صفحة المتجر لا تُحفظ، وصور صفحات الموظّفين تُحفظ كما كانت
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const VISITOR = `try{ if(!sessionStorage.getItem('__t')){ localStorage.clear(); sessionStorage.setItem('__t','1'); } localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_whatsnew_seen','999'); }catch(e){}`;
const IMG = 'img/p/web/ref/075b90f1_p5.jpg';
const state = pg => pg.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).length, caches: (await caches.keys()).filter(k => /^gmt-/.test(k)) }));
const inImgs = (pg, img) => pg.evaluate(async img => { const c = await caches.open('gmt-imgs'); return (await c.keys()).some(r => r.url.indexOf(img) >= 0); }, IMG);
const swReady = pg => pg.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => new Promise(r => { if (navigator.serviceWorker.controller) return r(true); navigator.serviceWorker.addEventListener('controllerchange', () => r(true)); })), new Promise(r => setTimeout(() => r(false), 15000))]));
(async () => {
  await H.seed();
  /* ① زبون جديد */
  { const o = await H.open('store.html', { init: VISITOR, w: 412, h: 860, wait: 5000, sw: true });
    const s = await state(o.pg);
    ok(s.regs === 0, 'زبون جديد يفتح المتجر ⇒ لا عامل خدمة يُسجَّل (regs=' + s.regs + ')');
    ok(s.caches.length === 0, 'زبون جديد ⇒ لا شيء يُخزَّن على جهازه (caches=' + JSON.stringify(s.caches) + ')');
    ok(await o.pg.evaluate(() => document.querySelectorAll('img').length > 0 && !document.getElementById('gmt-pwa-bar')), 'المتجر يعمل ويعرض صوره بلا شريط تحديث');
    await o.browser.close(); }
  /* ② زبون قديم: عامل خدمة وكاش من قبل ⇒ يُحرَّر عند فتح المتجر */
  for (const page of ['store.html', 'track_order.html', 'guarantee.html']) {
    const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, wait: 300, sw: true });
    await o.pg.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); });
    const ready = await swReady(o.pg);
    await o.pg.evaluate(async () => { const c = await caches.open('gmt-imgs'); await c.put('/img/p/old.jpg', new Response('x')); });
    const before = await state(o.pg);
    await o.pg.goto(H.BASE + page, { waitUntil: 'load' }).catch(() => {}); await o.pg.waitForTimeout(3500);
    const after = await state(o.pg);
    ok(ready && before.regs === 1 && before.caches.length >= 2 && after.regs === 0 && after.caches.length === 0, page + ': زبون قديم ⇒ يُلغى عامل الخدمة ويُحرَّر التخزين (قبل ' + before.regs + '/' + before.caches.length + ' ⇒ بعد ' + after.regs + '/' + after.caches.length + ')');
    await o.browser.close(); }
  /* ③ جهاز موظّف: لا يُمسّ · صور صفحة المتجر لا تُحفظ · صور صفحات الموظّفين تُحفظ */
  { const o = await H.open('home.html', { w: 412, h: 860, wait: 2500, sw: true });
    const ready = await swReady(o.pg);
    await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'load' }).catch(() => {}); await o.pg.waitForTimeout(3500);
    const s = await state(o.pg);
    ok(ready && s.regs === 1 && s.caches.includes('gmt-pages'), 'جهاز موظّف يفتح المتجر ⇒ عامل الخدمة وكاش الصفحات باقيان (regs=' + s.regs + ' · ' + s.caches.join(',') + ')');
    const r1 = await o.pg.evaluate(async img => { const r = await fetch(img); return r.ok; }, IMG); await o.pg.waitForTimeout(700);
    ok(r1 && !(await inImgs(o.pg)), 'صورة منتج تُطلب من صفحة المتجر ⇒ تُعرض ولا تُحفظ على الجهاز');
    const storeInPages = await o.pg.evaluate(async () => { const c = await caches.open('gmt-pages'); return (await c.keys()).some(r => /store\.html/.test(r.url)); });
    ok(!storeInPages, 'صفحة المتجر نفسها لا تُحفظ في كاش الصفحات');
    await o.pg.goto(H.BASE + 'home.html', { waitUntil: 'load' }).catch(() => {}); await o.pg.waitForTimeout(2000);
    const r2 = await o.pg.evaluate(async img => { const r = await fetch(img); return r.ok; }, IMG); await o.pg.waitForTimeout(900);
    ok(r2 && (await inImgs(o.pg)), 'الصورة نفسها من صفحة موظّف ⇒ تُحفظ على الجهاز كما كانت (لا تغيير على عمل الموظّفين)');
    await o.browser.close(); }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
