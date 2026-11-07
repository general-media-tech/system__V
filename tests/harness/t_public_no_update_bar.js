// (TASK-0336 · المالك seq 564) «الأشخاص اللي عم تفتح صفحة الزبون ما في داعي يكون عنده تحديث النظام … المتجر · الكفالة · التراكينج»
// نسخة جديدة تُنشر والصفحة مفتوحة ⇒ صفحات الزبون: لا شريط «تتوفّر نسخة جديدة» · صفحات الموظّفين: الشريط يظهر كما كان
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); localStorage.setItem('gmt_whatsnew_seen','999'); }catch(e){}`;
(async () => {
  await H.seed();
  for (const [page, isPublic, init] of [['store.html', true, VISITOR], ['guarantee.html', true, VISITOR], ['track_order.html', true, VISITOR], ['site.html', true, VISITOR], ['home.html', false, H.ADMIN_INIT], ['inventory.html', false, H.ADMIN_INIT]]) {
    const o = await H.open('logo.jpg', { init, w: 412, h: 860, mobile: true, wait: 0 });
    let ver = 'gmt-vTEST-1';
    await o.ctx.route(/\/sw\.js\?vc=/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: "const VERSION = '" + ver + "';" }));
    await o.pg.goto(H.BASE + page, { waitUntil: 'load' }).catch(() => {});
    await o.pg.waitForTimeout(3000);
    const hasCheck = await o.pg.evaluate(() => typeof window.__gmtCheckVer === 'function');
    await o.pg.evaluate(() => window.__gmtCheckVer && window.__gmtCheckVer()); await o.pg.waitForTimeout(600);
    ver = 'gmt-vTEST-2';                                    // نُشرت نسخة جديدة والصفحة مفتوحة
    await o.pg.evaluate(() => window.__gmtCheckVer && window.__gmtCheckVer()); await o.pg.waitForTimeout(1200);
    const bar = await o.pg.evaluate(() => !!document.getElementById('gmt-pwa-bar'));
    ok(hasCheck && (isPublic ? !bar : bar), page + (isPublic ? ': صفحة زبون — لا شريط تحديث' : ': صفحة موظّف — شريط التحديث يظهر كما كان') + ' (bar=' + bar + ')');
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
