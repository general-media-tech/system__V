// (TASK-B0521 · المالك ١٩ ت٢: «بدي يصير إجبار اللمسة لحتى إنه الصوت يشتغل») هاتفٌ عليه «تقليل الحركة» (توفير البطارية) كان يتخطّى الانترو
// واللمسة والصوت كلّها. الآن: الانترو + «اضغط على الشاشة لننطلق» + صوت الشاحنة عند اللمسة — إلّا لمن أطفأ الصوت صراحةً.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('track_order.html', { w: 390, h: 844, mobile: true, wait: 50, autoplay: false });
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_intro_notap'); localStorage.removeItem('gmt_sound'); } catch (_) {} });
  await pg.reload(); await pg.emulateMedia({ reducedMotion: 'reduce' });
  await pg.evaluate(() => { window.__aud = []; const P = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__aud.push(this.src.split('/').pop()); return P.call(this); }; }).catch(() => {});
  await sleep(1800);
  const g = await pg.evaluate(() => { const ov = document.getElementById('gmt-launch'), b = ov && ov.querySelector('.gl-bub'); return { rm: matchMedia('(prefers-reduced-motion: reduce)').matches, scene: !!ov, hint: b ? b.innerText : '' }; });
  ok(g.rm && g.scene && /اضغط على الشاشة/.test(g.hint), '«تقليل الحركة» مفعّل ⇒ الانترو ينتظر اللمسة: ' + JSON.stringify(g));
  await pg.mouse.click(195, 680); await sleep(600);
  const a = await pg.evaluate(() => window.__aud.slice());
  ok(a.some(x => /van-sound/.test(x)), 'اللمسة ⇒ صوت الشاحنة يُشغَّل: ' + a.join(','));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
