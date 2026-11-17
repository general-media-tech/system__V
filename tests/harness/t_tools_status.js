// (ARC-HTML-3#45) لوحة حالة الأدوات في أدوات المالك: تعمل / ينقصها ملف SQL / قاعدتها متوقّفة
const H = require('./h.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('system_tools.html', { w: 1200, h: 900, wait: 3000 });
  // جدول مفقود (كالقاعدة الحقيقية: 404 · 42P01) · قاعدة الكفالات لا تردّ إطلاقاً
  await pg.route(/\/rest\/v1\/gmt_job_applications\?/, r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"42P01","message":"relation \\"gmt_job_applications\\" does not exist"}' }));
  const W = await pg.evaluate(() => new URL(GMT_DB.WARRANTY.url).host);
  await pg.route(u => u.host === W, r => r.abort('connectionrefused'));
  await pg.click('#ts-run');
  await pg.waitForFunction(() => /أعد الفحص/.test(document.getElementById('ts-run').textContent), null, { timeout: 30000 });
  const res = await pg.evaluate(() => Object.fromEntries(GMTToolsStatus.results().map(x => [x.n, x.s + '|' + x.m.join(' · ')])));
  ok(/^ok/.test(res['نقطة البيع']) && /^ok/.test(res['الجرد']), 'الأدوات السليمة ⇒ «تعمل»');
  ok(/^sql\|.*gmt_job_applications/.test(res['التوظيف']), 'جدول مفقود ⇒ «ينقصها ملف SQL» باسم الجدول ← ' + res['التوظيف']);
  ok(/^down/.test(res['الكفالات']), 'قاعدة لا تردّ ⇒ «قاعدتها متوقّفة» ← ' + res['الكفالات']);
  const txt = await pg.evaluate(() => document.getElementById('ts-out').innerText);
  ok(/ينقصها SQL/.test(txt) && /متوقّفة/.test(txt) && /تعمل/.test(txt), 'اللوحة تعرض الحالات الثلاث');
  const real = errs.filter(e => !/vibrate|favicon|ERR_|Failed to load resource|42P01/.test(e));
  ok(!real.length, 'لا أخطاء JS ← ' + real.slice(0, 3).join(' | '));
  await browser.close();
  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
  process.exit(bad ? 1 : 0);
})();
