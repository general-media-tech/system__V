// (المالك seq 566 · الفحوصات) الفحص الذاتي اليوميّ لا يعمل على جهاز زائر صفحة الزبون (كان يفحص قواعد الإدارة وملفّات الصفحة
// بعد ٦ ثوانٍ: ~٤٠ طلب HEAD + جداول gmt_orders/invoices … فيزاحم تحميل المتجر) · يبقى للموظّف · ملفّاته ٤ في المرّة لا دفعةً واحدة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const PAR = `(function(){var F=window.fetch;window.__hp=0;window.__hmax=0;window.fetch=function(u,o){var h=o&&String(o.method||'').toUpperCase()==='HEAD';if(h){__hp++;__hmax=Math.max(__hmax,__hp);}var p=F.apply(this,arguments);if(h){p.then(function(){__hp--},function(){__hp--});}return p;};})();`;
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  for (const [page, init, expectRun] of [['store.html', VISITOR, false], ['guarantee.html', VISITOR, false], ['home.html', H.ADMIN_INIT + "try{localStorage.removeItem('gmt_selfcheck_last')}catch(e){}" + PAR, true]]) {
    const o = await H.open('logo.jpg', { init, w: 412, h: 860, mobile: true, wait: 0 });
    let heads = 0, maxPar = 0, cur = 0, probes = 0;
    o.pg.on('request', r => { if (r.method() === 'HEAD') { heads++; cur++; maxPar = Math.max(maxPar, cur); } if (/gmt_orders\?select=\*&limit=1|invoices\?select=\*&limit=1/.test(r.url())) probes++; });
    o.pg.on('requestfinished', r => { if (r.method() === 'HEAD') cur--; });
    o.pg.on('requestfailed', r => { if (r.method() === 'HEAD') cur--; });
    await o.pg.goto(H.BASE + page, { waitUntil: 'load' }).catch(() => {});
    await o.pg.waitForTimeout(11000);
    const ran = heads > 0 || probes > 0;
    ok(ran === expectRun, page + (expectRun ? ': موظّف — الفحص الذاتي يعمل' : ': زائر — لا فحص ذاتيّ على جهازه') + ' (HEAD ' + heads + ' · جداول ' + probes + ')');
    if (expectRun) { const inPage = await o.pg.evaluate(() => window.__hmax || 0); ok(inPage > 0 && inPage <= 4, page + ': فحص الملفّات ٤ في المرّة على الأكثر (أقصى توازٍ داخل الصفحة ' + inPage + ')'); }
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})();
