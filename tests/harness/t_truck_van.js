// (18 ت1 · طلب المالك) صفحة التتبّع: الشاحنة مفرّغة على أبيض (جسم + دولابان يدوران + دخان) — جزءٌ من الصفحة لا فيديو،
// صوتها الحقيقي بلا زرّ، الترحيب أطول وينتهي بدخانٍ يملأ الشاشة ثمّ تنكشف الصفحة من خلفه، والشاحنة نفسها في شاشة التحقق.
const H = require('./h.js');
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fail++; };
/* (١٨ ت1 · برومبت «انطلاق السيارة») الترحيب صار فيديو الانطلاق (gmt-launch.js · يختبره t_launch_intro.js)، وهذه الشاحنة المفرّغة
   صارت **احتياطه** حين لا يقدر المتصفّح على الفيديو — فنُعطّل الفيديو هنا (canPlayType = '') لنختبر الاحتياط كما كان. */
const PLAYS = 'HTMLMediaElement.prototype.canPlayType=function(){return ""}; window.__plays=[]; HTMLMediaElement.prototype.play=function(){window.__plays.push(this.src||""); return Promise.resolve();}; HTMLMediaElement.prototype.pause=function(){window.__paused=(window.__paused||0)+1;};';
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_orders', [{ name: 'شاهين در ه', phone: '0933250051', product: 'كاميرا', qty: 1, price: 1004, status: 'shipped', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي', tracking_number: '202470', shipped_at: '2026-10-16T08:40:58Z' }]);
  for (const [w, h] of [[390, 800], [320, 568], [1366, 768], [844, 390]]) {
    console.log('— ' + w + '×' + h);
    const { browser, pg, errs } = await H.open('track_order.html', { w, h, mobile: w < 900 && h > w, wait: 900, init: PLAYS });
    const a = await pg.evaluate(() => {
      const sc = document.getElementById('van-welcome'), body = sc && sc.querySelector('.van-body'), wh = sc ? [...sc.querySelectorAll('.van-wheel')] : [];
      return { body: !!(body && body.complete && body.naturalWidth > 0), wheels: wh.length, spin: wh.every(x => getComputedStyle(x).animationName === 'vanSpin'),
        loaded: wh.every(x => x.complete && x.naturalWidth > 0), video: document.querySelectorAll('video').length, btn: document.querySelectorAll('.van-sound,[aria-label*="صوت"]').length,
        road: document.querySelectorAll('#van-welcome .road-wrapper,#van-verify .road-wrapper').length, bg: getComputedStyle(document.getElementById('layer1')).backgroundColor,
        plays: window.__plays.slice(), moving: sc.classList.contains('is-moving') };
    });
    ok(a.body && a.wheels === 2 && a.loaded, 'الشاحنة المفرّغة ظاهرة: الجسم + الدولابان محمّلة');
    ok(a.spin, 'الدولابان يدوران (vanSpin)');
    ok(a.video === 0 && a.btn === 0, 'لا فيديو ولا زرّ صوت');
    ok(a.road === 0, 'لا طريق ولا قصاصات خلفها');
    ok(/255, 255, 255/.test(a.bg), 'الخلفيّة بيضاء: ' + a.bg);
    ok(a.plays.some(s => /van-sound\.mp3/.test(s)), 'صوت الشاحنة الحقيقي يُشغَّل تلقائياً');
    await pg.waitForTimeout(4250);   // ≈ ٥٫١٥ث: الدخان الكبير يملأ الشاشة
    const b = await pg.evaluate(() => ({ grow: document.getElementById('layer1').classList.contains('smoke-grow'), leaving: document.getElementById('van-welcome').classList.contains('leaving'),
      cover: [...document.querySelectorAll('.van-cloud i')].filter(i => +getComputedStyle(i).opacity > .5).length }));
    ok(b.grow && b.leaving && b.cover >= 5, 'الشاحنة تنطلق ودخانها يكبر ليملأ الشاشة (' + b.cover + ' سحب)');
    await pg.waitForTimeout(2250);   // ≈ ٧٫٤ث
    const c = await pg.evaluate(() => ({ l1: getComputedStyle(document.getElementById('layer1')).display, of: document.body.style.overflow, hs: document.documentElement.scrollWidth > innerWidth + 2 }));
    ok(c.l1 === 'none' && c.of === 'auto', 'انكشفت صفحة التتبّع من خلف الدخان');
    ok(!c.hs, 'لا طفح أفقي');
    // شاشة التحقق: نفس الشاحنة + صوتها
    await pg.evaluate(() => { window.__plays = []; });
    await pg.fill('#searchInput', '202470'); await pg.click('#searchBtn');
    await pg.waitForTimeout(1200);
    const d = await pg.evaluate(() => { const v = document.getElementById('van-verify'); const r = v.getBoundingClientRect();
      return { vis: r.width > 100 && r.height > 30, moving: v.classList.contains('is-moving'), wheels: [...v.querySelectorAll('.van-wheel')].filter(x => getComputedStyle(x).animationName === 'vanSpin').length, plays: window.__plays.slice(), hs: document.documentElement.scrollWidth > innerWidth + 2 }; });
    ok(d.vis && d.moving && d.wheels === 2, 'شاشة «جارٍ تتبّع شحنتكم»: نفس الشاحنة والدولابان يدوران');
    ok(d.plays.some(s => /van-sound\.mp3/.test(s)), 'صوتها يعمل في شاشة التحقق');
    ok(!d.hs, 'لا طفح في شاشة التحقق');
    if (w === 390) await pg.screenshot({ path: '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/harness/van_verify_390.png' });
    await pg.waitForTimeout(4200);
    const e = await pg.evaluate(() => ({ moving: document.getElementById('van-verify').classList.contains('is-moving'), l2: document.getElementById('layer2').classList.contains('hidden') }));
    ok(!e.moving && e.l2, 'انتهت شاشة التحقق: توقّفت الشاحنة وصوتها');
    const real = errs.filter(x => !/404|400|favicon|Failed to load/.test(x));
    ok(real.length === 0, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
    await browser.close();
  }
  // تقليل الحركة: ثابتة بلا دوران ولا دخان، والترحيب ينتهي
  {
    const { browser, pg, errs } = await H.open('track_order.html', { w: 390, wait: 600, init: PLAYS + "const _mm=window.matchMedia; window.matchMedia=q=>/reduced-motion/.test(q)?{matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:_mm.call(window,q);" });
    await pg.emulateMedia({ reducedMotion: 'reduce' });
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => ({ spin: [...document.querySelectorAll('#van-welcome .van-wheel')].map(x => getComputedStyle(x).animationName) }));
    ok(r.spin.every(n => n === 'none'), 'تقليل الحركة: الدولابان ثابتان');
    await pg.waitForTimeout(5200);
    ok(await pg.evaluate(() => getComputedStyle(document.getElementById('layer1')).display === 'none'), 'تقليل الحركة: الترحيب ينتهي');
    await browser.close();
  }
  console.log(`النتيجة: ${pass} نجح · ${fail} فشل`);
})();
