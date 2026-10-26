// (26 ت1 · TASK-0190) المالك seq 125: «لوحة الجديد في الأعلى عم تاكل نصّ الصفحة وهذا الشيء غلط — خلاص يبقى زرّ صغير، أو حتى موجود زرّ فيه شو الجديد».
// كانت بطاقة الرئيسية أربعة بنودٍ بأزرارها (~٦٠٠ بكسل من شاشة ٨٤٤) ⇒ سطرٌ واحد: العدد وما لم تجرّبه و«افتح» — والقائمة بـ«جرّبها» في النافذة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const INIT = H.ADMIN_INIT.replace("localStorage.setItem('gmt_whatsnew_seen','999');", "localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.removeItem('gmt_wn_tried');");
(async () => {
  await H.seed();
  for (const W of [390, 1366]) {
    const o = await H.open('home.html', { w: W, h: W < 700 ? 844 : 900, mobile: W < 700, wait: 6000, init: INIT });
    const r = await o.pg.evaluate(() => {
      const c = document.getElementById('wn-home'), b = c && c.getBoundingClientRect();
      return { h: b ? Math.round(b.height) : -1, y: b ? Math.round(b.top) : -1, txt: c ? c.innerText.replace(/\s+/g, ' ') : '', tries: c ? c.querySelectorAll('[data-wn-try]').length : -1,
        open: !!(c && c.querySelector('[data-wn-open]')), un: GMTWhatsNew.untried().length };
    });
    ok(r.h > 0 && r.h <= 72 && r.y < 300, W + ': سطرٌ واحد أعلى الرئيسية (ارتفاعه ' + r.h + ' بكسل · كان ~٦٠٠)');
    ok(/شو الجديد/.test(r.txt) && new RegExp(r.un + ' لم تجرّبها').test(r.txt) && r.tries === 0 && r.open, W + ': فيه العدد و«' + r.un + ' لم تجرّبها» وزرّ «افتح» — بلا قائمة: ' + r.txt.slice(0, 60));
    if (W === 390) await o.pg.screenshot({ path: '/tmp/gmt-out/wn_home_compact_390.png' });
    await o.pg.click('#wn-home [data-wn-open]');
    await o.pg.waitForTimeout(600);
    const w = await o.pg.evaluate(() => ({ ov: !!document.getElementById('gmt-wn-ov'), tries: document.querySelectorAll('#gmt-wn-ov [data-wn-try]').length }));
    ok(w.ov && w.tries > 0, W + ': «افتح» يفتح نافذة «شو الجديد» وفيها «جرّبها» (' + w.tries + ')');
    const real = o.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|أصول ناقصة/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
