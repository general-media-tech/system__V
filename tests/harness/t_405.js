const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const NGINX = '<html>\r\n<head><title>405 Not Allowed</title></head>\r\n<body bgcolor="white">\r\n<center><h1>405 Not Allowed</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>';
(async () => {
  await H.seed();
  const init = H.ADMIN_INIT + `try{localStorage.setItem('gmt_brain_endpoint','https://static-host.example/system__V/')}catch(e){}`;
  const { browser, ctx, pg, errs } = await H.open('home.html', { init, w: 430, h: 900, wait: 5000 });
  await pg.route('https://static-host.example/**', r => r.fulfill({ status: 405, contentType: 'text/html', body: NGINX }));
  // ١) الخطأ الخام صار شرحاً
  const r1 = await pg.evaluate(async () => { try { await GMTBrain.ask('ما رأيك بجو اليوم وهل يصلح للتصوير الخارجي؟'); return { ok: true }; } catch (e) { return { msg: e.message, fix: !!e.fixEndpoint }; } });
  console.log(JSON.stringify(r1).slice(0, 400));
  ok(!r1.ok && /405/.test(r1.msg) && /ليس وسيطاً/.test(r1.msg) && !/<html|<center/i.test(r1.msg) && r1.fix, 'خطأ 405 بصفحة nginx ⇒ شرحٌ عربي بلا HTML خام + علم تصحيح الرابط');
  // ٢) التحقّق من الروابط
  const pr = await pg.evaluate(() => ({
    gh: GMTEndpoint.problem('https://general-media-tech.github.io/system__V/'),
    page: GMTEndpoint.problem('https://example.com/index.html'),
    rest: GMTEndpoint.problem('https://abcd.supabase.co/rest/v1/'),
    fn: GMTEndpoint.problem('https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain'),
    custom: GMTEndpoint.problem('https://brain.example.workers.dev/ask'),
    same: GMTEndpoint.problem(location.origin + '/x'),
    empty: GMTEndpoint.problem(''), bad: GMTEndpoint.problem('not a url') }));
  console.log(JSON.stringify(pr));
  ok(pr.gh && pr.page && pr.rest && pr.same && pr.bad && !pr.fn && !pr.custom && !pr.empty, 'problem(): يرفض GitHub Pages/ملف/REST/نفس الموقع/رابطاً مكسوراً، ويقبل دالة Supabase ووسيطاً مخصّصاً');
  // ٣) set() يرفض ولا يحفظ
  const s1 = await pg.evaluate(async () => { try { await GMTEndpoint.set('brain', 'https://general-media-tech.github.io/system__V/'); return 'saved'; } catch (e) { return 'rejected: ' + e.message; } });
  ok(/^rejected/.test(s1) && /GitHub Pages/.test(s1), 'GMTEndpoint.set يرفض رابط GitHub Pages: ' + s1.slice(0, 60));
  ok(await pg.evaluate(() => localStorage.getItem('gmt_brain_endpoint') === 'https://static-host.example/system__V/'), 'ولم يلمس القيمة المحفوظة');
  // ٤) شرح بقية الرموز
  const ex = await pg.evaluate(() => [404, 401, 403, 429, 500, 0].map(c => GMTEndpoint.explain(c, '', 'https://x.supabase.co/functions/v1/gmt-brain')));
  ok(/404/.test(ex[0]) && /no-verify-jwt/.test(ex[1]) && /no-verify-jwt/.test(ex[2]) && /429/.test(ex[3]) && /سجلّات/.test(ex[4]) && /CORS/.test(ex[5]), 'شرح 404/401/403/429/500/0 كلٌّ بسببه وحلّه');
  // ٥) رابط الوسيط المضبوط نفسه رابط موقع ⇒ يُرفض قبل أيّ طلب
  await pg.evaluate(() => localStorage.setItem('gmt_brain_endpoint', 'https://general-media-tech.github.io/system__V/'));
  const r2 = await pg.evaluate(async () => { try { await GMTBrain.ask('سؤال آخر عن شيءٍ لا يعرفه النظام محلياً أبداً؟'); return { ok: true }; } catch (e) { return { msg: e.message, fix: !!e.fixEndpoint }; } });
  ok(!r2.ok && /GitHub Pages/.test(r2.msg) && r2.fix, 'رابط GitHub Pages المحفوظ مسبقاً يُكشف قبل الإرسال: ' + (r2.msg || '').slice(0, 70));
  // ٦) الواجهة: شرحٌ + زرّ التصحيح
  await pg.evaluate(() => localStorage.setItem('gmt_brain_endpoint', 'https://static-host.example/system__V/'));
  await pg.evaluate(() => GMTBrain.open());
  await pg.waitForSelector('#gb-send', { timeout: 5000 });
  await pg.fill('#gb-in, #gb-input, textarea, input[type=text]', 'ما رأيك بجو اليوم وهل يصلح للتصوير الخارجي؟').catch(() => {});
  await pg.click('#gb-send'); await pg.waitForTimeout(2500);
  const ui = await pg.evaluate(() => ({ txt: document.querySelector('#gb-log') ? document.querySelector('#gb-log').innerText : document.body.innerText.slice(-400), btn: !!document.getElementById('gb-cfg2') }));
  console.log(JSON.stringify(ui).slice(0, 500));
  ok(/ليس وسيطاً/.test(ui.txt) && ui.btn, 'الواجهة تعرض الشرح وزرّ «أدخل رابط الوسيط الصحيح»');
  await pg.screenshot({ path: OUT + 't405_ui.png' });
  console.log('errs', errs.filter(e => !/404|400|Failed|favicon|405/.test(e)).slice(0, 3));
  await browser.close();
})();
