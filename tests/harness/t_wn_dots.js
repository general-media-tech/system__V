// (25 ت1 · TASK-0170) المالك seq 84: «زرّ الجديد يعطيني نقطة حمراء على الأشياء الجديدة لحتى أجرّبها — اختفى وما بعرف شو اختفى —
// صلّح هذا النمط: ليش أشياء عم تختفي». الجذر: النقطة لبندٍ فيه `go` مكتوبٌ يدوياً فقط، وآخره v72 ⇒ خمسون تحديثاً بلا نقاط.
// الآن كل بندٍ بصفحاتٍ (pages) يأخذ نقطته تلقائياً. هذا الاختبار حارس النمط: أحدث البنود دائماً «لم تجرّبها» حتى تُجرَّب.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const INIT = H.ADMIN_INIT.replace("localStorage.setItem('gmt_whatsnew_seen','999');", "localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.removeItem('gmt_wn_tried');");
(async () => {
  await H.seed();
  // ٠) حارسٌ ثابت: كل بندٍ من v73 فصاعداً له صفحات (أو go) ⇒ له نقطة — بندٌ بلا صفحات = لكل الصفحات بلا مكانٍ يُشار إليه
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../gmt-whatsnew.js'), 'utf8');
  const ents = src.split(/\n    \{ v: /).slice(1).map(e => ({ v: +e.split(',')[0], pages: /pages: \[\s*'/.test(e), go: /go: \[/.test(e) }));
  const expectV = ents.filter(e => e.v >= 57).map(e => e.v);   // TRY_FROM
  for (const W of [390, 1366]) {
    // ١) الرئيسية: أحدث البنود «لم تجرّبها» ونقاطٌ على روابط صفحاتها
    let o = await H.open('home.html', { w: W, mobile: W < 700, wait: 6000, init: INIT });
    let r = await o.pg.evaluate(() => {
      const un = GMTWhatsNew.untried(), dots = [...document.querySelectorAll('a > .gwn-dot,[data-tool] > .gwn-dot')].map(d => (d.parentElement.getAttribute('data-tool') || d.parentElement.getAttribute('href') || '').split('?')[0]);
      return { un, dots: [...new Set(dots)], card: (document.getElementById('wn-home') || {}).innerText || '' };
    });
    const lost = expectV.filter(v => !r.un.includes(v));
    ok(!lost.length && r.un.includes(122), W + ': كل بندٍ من 57 فصاعداً له نقطته «لم تجرّبها» (' + r.un.length + ' من ' + expectV.length + ')' + (lost.length ? ' — بلا نقطة: ' + lost.join(',') : ''));
    ok(r.dots.includes('inventory.html') && r.dots.includes('orders.html'), W + ': نقطةٌ حمراء على رابطي الجرد والأوردرات: ' + r.dots.join(','));
    ok(/لم تجرّبها/.test(r.card), W + ': بطاقة الرئيسية تقول كم ميزة لم تجرّبها');
    await o.browser.close();
    // ٢) داخل الأوردرات: نقطة نابضة على زرّ 🆕 (بندٌ بلا زرٍّ محدَّد) · «✓ جرّبتها» من النافذة يطفئ البند
    o = await H.open('orders.html', { w: W, mobile: W < 700, wait: 6000, init: INIT });
    r = await o.pg.evaluate(() => ({ fab: !!document.querySelector('#gmt-wn-fab > .gwn-dot.gwn-pulse'), badge: (document.querySelector('#gmt-wn-fab [data-n]') || {}).textContent }));
    ok(r.fab && +r.badge > 0, W + ': في الأوردرات نقطةٌ نابضة على زرّ 🆕 والعدّاد ' + r.badge);
    await o.pg.evaluate(() => GMTWhatsNew.open());
    await o.pg.waitForTimeout(500);
    const has = await o.pg.$('#gmt-wn-ov [data-wn-done="121"]');
    ok(!!has, W + ': النافذة فيها «✓ جرّبتها» لبند الأوردرات 121');
    if (has) { await has.click(); await o.pg.waitForTimeout(500); }
    r = await o.pg.evaluate(() => ({ un: GMTWhatsNew.untried() }));
    ok(!r.un.includes(121) && r.un.includes(119), W + ': «✓ جرّبتها» أطفأ 121 وحده');
    await o.browser.close();
    // ٣) الجرد: البند ذو الزرّ المحدَّد (v122 · «جهّز تلقائياً») ⇒ نقطة نابضة على الزرّ نفسه، وضغطُه = جرّبتها
    o = await H.open('inventory.html', { w: W, mobile: W < 700, wait: 6000, init: INIT });
    r = await o.pg.evaluate(() => ({ dot: !!document.querySelector('[data-enrich-q] > .gwn-dot.gwn-pulse') }));
    ok(r.dot, W + ': نقطةٌ نابضة على زرّ «🧠 جهّز تلقائياً»');
    await o.pg.evaluate(() => { document.querySelector('[data-enrich-q]').click(); });
    await o.pg.waitForTimeout(600);
    r = await o.pg.evaluate(() => ({ un: GMTWhatsNew.untried(), pick: !!document.getElementById('gmt-enrich-pick') }));
    ok(!r.un.includes(122), W + ': ضغط الزرّ أطفأ بنده (122)');
    const real = o.errs.filter(e => !/favicon|404|400|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' | '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
