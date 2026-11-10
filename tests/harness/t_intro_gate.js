// (10 ت2 · TASK-0228 · المالك seq 558) «اجعل الزبون مجبراً على لمس الشاشة قبل الانترو كرمال يشتغل الصوت — إمّا الصوت يشتغل بدون لمسة،
//  أو الزبون مجبر يلمس الشاشة لحتى يفتح الانترو ويشتغل الصوت»
//  ① المتصفّح يمنع الصوت ⇒ شاشة «المس الشاشة» · لا انترو قبل اللمسة · اللمسة ⇒ صوت الشاحنة يعمل + الانترو يبدأ ثمّ صفحة التتبّع
//  ② المتصفّح يسمح بالصوت ⇒ لا شاشة · الانترو يبدأ وحده بصوته · ③ الأصوات مكتومة ⇒ لا شاشة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SPY = () => { window.__aud = []; const P = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { const r = P.call(this); window.__aud.push(this.src.split('/').pop()); if (r && r.then) r.then(() => { this.__ok = 1; window.__playing = (window.__playing || 0) + 1; }, () => {}); return r; }; };
(async () => {
  for (const [w, h] of [[390, 844], [1366, 820]]) {
    console.log('— ' + w);
    await H.seed();
    let { browser, pg, errs } = await H.open('track_order.html', { w, h, mobile: w < 700, wait: 50, autoplay: false });
    await pg.evaluate(SPY).catch(() => {});
    await sleep(1600);
    const g = await pg.evaluate(() => ({ gate: !!document.getElementById('gmt-launch-gate'), txt: (document.getElementById('gmt-launch-gate') || {}).innerText || '', scene: !!document.getElementById('gmt-launch'), l1: getComputedStyle(document.getElementById('layer1')).display }));
    ok(g.gate && /المس الشاشة/.test(g.txt) && /مع الصوت/.test(g.txt), 'المتصفّح يمنع الصوت ⇒ شاشة «المس الشاشة للمتابعة · مع الصوت»');
    ok(!g.scene && g.l1 !== 'none', 'لا انترو قبل اللمسة — الزبون مجبر يلمس');
    await sleep(1500);
    ok(await pg.evaluate(() => !!document.getElementById('gmt-launch-gate') && !document.getElementById('gmt-launch')), 'تبقى الشاشة تنتظر اللمسة (لا تنتهي وحدها)');
    await pg.mouse.click(w / 2, h / 2); await sleep(500);
    const t = await pg.evaluate(() => ({ gate: !!document.getElementById('gmt-launch-gate'), scene: !!document.getElementById('gmt-launch'), van: !!document.querySelector('#gmt-launch .gr-street .gr-van') }));
    ok(!t.gate && t.scene && t.van, 'بعد اللمسة: الشاشة اختفت وبدأ انترو الشارع');
    const a = await pg.evaluate(() => [...document.querySelectorAll('audio')].length + '|' + JSON.stringify(window.__aud || []));
    const playing = await pg.evaluate(() => new Promise(r => setTimeout(() => r(window.__playing || 0), 600)));
    ok(playing >= 1, 'اللمسة شغّلت صوت الشاحنة (van-sound.mp3): ' + a);
    let t0 = Date.now(); while (Date.now() - t0 < 9000) { if (!(await pg.evaluate(() => !!document.getElementById('gmt-launch')))) break; await sleep(150); }
    const end = await pg.evaluate(() => ({ ov: !!document.getElementById('gmt-launch'), l1: getComputedStyle(document.getElementById('layer1')).display, inp: !!document.getElementById('searchInput').offsetParent }));
    ok(!end.ov && end.l1 === 'none' && end.inp, 'انتهى الانترو وظهرت صفحة التتبّع (' + ((Date.now() - t0) / 1000).toFixed(1) + 'ث بعد اللمسة)');
    const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
    // ② المتصفّح يسمح بالصوت
    ({ browser, pg, errs } = await H.open('track_order.html', { w, h, mobile: w < 700, wait: 50, autoplay: true }));
    await sleep(1200);
    const b = await pg.evaluate(() => ({ gate: !!document.getElementById('gmt-launch-gate'), scene: !!document.getElementById('gmt-launch') }));
    ok(!b.gate && b.scene, 'المتصفّح يسمح بالصوت ⇒ لا شاشة لمس · الانترو يبدأ وحده بصوته');
    await browser.close();
    // ③ الأصوات مكتومة من مفتاح الأصوات
    ({ browser, pg, errs } = await H.open('track_order.html', { w, h, mobile: w < 700, wait: 50, autoplay: false, init: H.ADMIN_INIT + ';try{localStorage.setItem("gmt_sound","off")}catch(_){}' }));
    await sleep(1200);
    const c = await pg.evaluate(() => ({ gate: !!document.getElementById('gmt-launch-gate'), scene: !!document.getElementById('gmt-launch') }));
    ok(!c.gate && c.scene, 'الأصوات مكتومة ⇒ لا شاشة لمس · الانترو مباشرة');
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
