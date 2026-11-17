// (OWN-05#21) سجل الروابط في مركز الفحص: زحف من الرئيسية · مكسور/وهمي بالأحمر · رابط يدوي يبقى بعد التحديث
const H = require('./h.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('central_inspector.html', { w: 1200, h: 900, wait: 3000 });
  // روابط مزروعة في نسخة اختبار (لا تُلمس ملفات المستودع): وهمي · مكسور · مرساة ناقصة · سليم
  const fake = '<a href="#">وهمي</a><a href="no_such_page.html">مكسور</a><a href="#nowhere">مرساة</a><a href="home.html">سليم</a><a href="#" onclick="go()">زر</a>';
  const L = await pg.evaluate(f => GMTLinkRegistry.linksOf('مزروع.html', '<html><body>' + f + '</body></html>').map(x => x.label + ':' + x.kind), fake);
  ok(L.includes('وهمي:fake') && L.includes('مرساة:anchor') && L.includes('زر:act') && L.includes('مكسور:int'), 'التصنيف الساكن ← ' + L.join(' · '));

  await pg.route('**/home.html', async r => { const res = await r.fetch(); const body = (await res.text()).replace('</body>', fake + '</body>'); r.fulfill({ response: res, body }); });
  await pg.fill('#lr-name', 'دليل يدوي'); await pg.fill('#lr-url', 'missing_manual.html'); await pg.click('#lr-add');
  await pg.click('#lr-run');
  await pg.waitForFunction(() => /أعد الحصر/.test(document.getElementById('lr-run').textContent), null, { timeout: 120000 });
  const rows = await pg.evaluate(() => GMTLinkRegistry.rows());
  const srcs = new Set(rows.map(r => r.src));
  ok(srcs.size > 10, 'الزحف وصل صفحات كثيرة من الرئيسية (' + srcs.size + ' مصدر · ' + rows.length + ' رابط)');
  ok(rows.some(r => r.src === 'home.html' && r.to === 'no_such_page.html' && r.kind === 'broken'), 'الرابط المكسور المزروع ⇒ مكسور');
  ok(rows.some(r => r.src === 'home.html' && r.label === 'وهمي' && r.kind === 'fake'), 'الرابط الوهمي المزروع ⇒ وهمي');
  ok(await pg.evaluate(() => [...document.querySelectorAll('.lr-row[data-kind="broken"],.lr-row[data-kind="fake"]')].every(e => /fef2f2/.test(e.getAttribute('style')))), 'المكسور والوهمي بالأحمر');
  ok(rows.some(r => r.manual && r.to === 'missing_manual.html' && r.kind === 'broken'), 'الرابط اليدوي يُفحص ويظهر');
  const realBroken = rows.filter(r => r.kind === 'broken' && !r.manual && r.to !== 'no_such_page.html' && !/\.js$/.test(r.src)).map(r => r.src + '→' + r.to);
  console.log('   روابط مكسورة حقيقية في الموقع: ' + (realBroken.join(' · ') || 'لا شيء'));
  await pg.reload(); await pg.waitForTimeout(2000);
  ok(await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_links_manual') || '[]').some(x => x.url === 'missing_manual.html')), 'الرابط اليدوي يبقى بعد التحديث');
  const real = errs.filter(e => !/vibrate|favicon|ERR_|Failed to load resource|404/.test(e));
  ok(!real.length, 'لا أخطاء JS ← ' + real.slice(0, 3).join(' | '));
  await browser.close();
  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
  process.exit(bad ? 1 : 0);
})();
