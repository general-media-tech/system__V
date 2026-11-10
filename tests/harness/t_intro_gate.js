// (10 ت2 · TASK-0228 · المالك seq 558) «اجعل الزبون مجبراً على لمس الشاشة قبل الانترو كرمال يشتغل الصوت — إمّا الصوت يشتغل بدون لمسة،
//  أو الزبون مجبر يلمس الشاشة لحتى يفتح الانترو ويشتغل الصوت»
//  (seq 559 «شاشة اللمس سيئة — مبيّنة إعلان») ⇐ لا شاشة منفصلة: اللمسة داخل الانترو نفسه
//  ① المتصفّح يمنع الصوت ⇒ الانترو يبدأ والشاحنة واقفة مطفأة (لا عادم) + سطرٌ هادئ «المس الشاشة لتشغيل الشاحنة» · لا انطلاق قبل اللمسة
//     · اللمسة ⇒ صوت الشاحنة يعمل + تنطلق ثمّ صفحة التتبّع
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
    const vx = () => pg.evaluate(() => { const v = document.querySelector('#gmt-launch .gr-van'); return v ? +(v.getBoundingClientRect().left / innerWidth).toFixed(3) : null; });
    const g = await pg.evaluate(() => { const ov = document.getElementById('gmt-launch'), t = ov && ov.querySelector('.gl-tap');
      return { old: !!document.getElementById('gmt-launch-gate'), scene: !!ov, street: !!(ov && ov.querySelector('.gr-street .gr-van')), hint: t ? t.innerText : '', hintOn: !!(t && t.classList.contains('on')), txt: ov ? ov.innerText : '', btn: ov ? ov.querySelectorAll('button, .gg-btn').length : -1 }; });
    ok(g.scene && g.street && !g.old && !g.btn && /أهلاً بكم/.test(g.txt), 'المتصفّح يمنع الصوت ⇒ الانترو نفسه (الشارع والشاحنة و«أهلاً بكم») — لا شاشة منفصلة ولا زرّ');
    ok(g.hintOn && /المس الشاشة لتشغيل الشاحنة/.test(g.hint), 'سطرٌ هادئ تحت الشارع: «' + g.hint.trim() + '»');
    const xa = await vx(); await sleep(1500); const xb = await vx();
    const puffs = await pg.evaluate(() => { const c = document.querySelector('#gmt-launch canvas.gr-puffs'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) n++; return n; });
    ok(xa === xb && xa > 0 && !puffs && await pg.evaluate(() => !!document.getElementById('gmt-launch')), 'قبل اللمسة: الشاحنة واقفة مطفأة في مكانها (لا عادم · لا انطلاق) والانترو ينتظر: ' + xa);
    await pg.mouse.click(w / 2, h * .8); await sleep(250);
    const t = await pg.evaluate(() => ({ hint: (document.querySelector('#gmt-launch .gl-tap') || {}).className || '', scene: !!document.getElementById('gmt-launch') }));
    await sleep(1200); const xc = await vx();
    ok(t.scene && /go/.test(t.hint) && (xc == null || xc > xb + .1), 'بعد اللمسة: السطر اختفى والمحرّك دار ثمّ انطلقت الشاحنة (' + xb + ' ⇐ ' + (xc == null ? 'خرجت' : xc) + ')');
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
    const b = await pg.evaluate(() => ({ hint: !!document.querySelector('#gmt-launch .gl-tap'), scene: !!document.getElementById('gmt-launch'), x: (document.querySelector('#gmt-launch .gr-van') || { getBoundingClientRect: () => ({ left: 0 }) }).getBoundingClientRect().left }));
    ok(!b.hint && b.scene, 'المتصفّح يسمح بالصوت ⇒ لا سطر لمس · الانترو يجري وحده بصوته');
    await browser.close();
    // ③ الأصوات مكتومة من مفتاح الأصوات
    ({ browser, pg, errs } = await H.open('track_order.html', { w, h, mobile: w < 700, wait: 50, autoplay: false, init: H.ADMIN_INIT + ';try{localStorage.setItem("gmt_sound","off")}catch(_){}' }));
    await sleep(1200);
    const c = await pg.evaluate(() => ({ hint: !!document.querySelector('#gmt-launch .gl-tap'), scene: !!document.getElementById('gmt-launch') }));
    ok(!c.hint && c.scene, 'الأصوات مكتومة ⇒ لا سطر لمس · الانترو مباشرة');
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
