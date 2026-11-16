// صفحة التوظيف: انترو واحد فقط + العدّادات تدور بعد رفعه (طلب المالك 15 ت٢)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
require(require('path').join(__dirname, '_net_guard.js'));
const BASE = 'http://127.0.0.1:' + (process.env.BASE_PORT || 8765) + '/';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const num = s => parseInt(String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9]/g, ''), 10) || 0;

async function mk(browser, reduced) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.route(/^https:\/\/(?!127)/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.addInitScript(`try{localStorage.setItem('gmt_whatsnew_seen','999');}catch(e){}
    window.__hidden=0; document.addEventListener('gmt:intro-hidden',()=>{window.__hidden=performance.now();
      window.__atHide=[...document.querySelectorAll('[data-count]')].map(e=>e.textContent);});`);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  return { ctx, pg, errs };
}
(async () => {
  const browser = await chromium.launch();
  { // 1) العادي
    const { ctx, pg, errs } = await mk(browser, false);
    await pg.goto(BASE + 'hiring.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1500);
    const early = await pg.evaluate(() => [...document.querySelectorAll('.stat strong')].map(e => e.textContent));
    ok(early.every(t => num(t) === 0), 'تحت الانترو (1.5ث): الأرقام لم تبدأ بعد ' + JSON.stringify(early));
    ok(await pg.evaluate(() => !!document.getElementById('intro-screen')), 'انترو الصفحة نفسها ظاهر');
    ok(await pg.evaluate(() => !document.getElementById('gmt-intro') && !document.querySelector('script[src*="gmt-intro"]')), 'لا انترو نظام ثانٍ (#gmt-intro) ولا سكربته');
    await pg.waitForFunction(() => window.__hidden > 0, null, { timeout: 8000 });
    await pg.waitForTimeout(120);
    const first = await pg.evaluate(() => { const e = document.querySelector('[data-count="3870"]'); return { t: e.textContent, c: e.classList.contains('counting') }; });
    ok(num(first.t) < 3870, 'بعد رفع الانترو بقليل الرقم الأوّل ما زال يدور: ' + first.t);
    ok(first.c, 'الصنف counting أثناء العدّ');
    let done = false; const t0 = Date.now();
    while (Date.now() - t0 < 3000) { const v = await pg.evaluate(() => document.querySelector('[data-count="3870"]').textContent); if (num(v) === 3870) { done = true; break; } await pg.waitForTimeout(100); }
    ok(done, 'بلغ الهدف 3870 خلال 3 ث من رفع الانترو (' + (Date.now() - t0) + 'ms)');
    await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => !document.querySelector('.stat strong.counting')), 'زال الصنف counting عند النهاية');
    ok(await pg.evaluate(() => !document.getElementById('intro-screen')), 'انترو الصفحة أُزيل');
    ok(await pg.evaluate(() => !document.getElementById('gmt-intro') && !document.getElementById('gmt-wn-ov')), 'لا انترو نظام ولا نافذة «شو الجديد» بعد الإقلاع');
    ok(errs.length === 0, 'لا أخطاء JS ' + JSON.stringify(errs));
    await ctx.close();
  }
  { // 2) تقليل الحركة
    const { ctx, pg } = await mk(browser, true);
    await pg.goto(BASE + 'hiring.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(700);
    const v = await pg.evaluate(() => document.querySelector('[data-count="3870"]').textContent);
    ok(num(v) === 3870, 'reduced-motion: الرقم النهائي فوراً ' + v);
    await ctx.close();
  }
  await browser.close();
  console.log(fail ? 'FAILED ' + fail : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
