// t_pwa_update — (١ ت2 · المالك seq 329) «لما بتبعث تحديثات ما عم تنزل … ما عم يجيني انه لازم احدث السيستم»
// خادمٌ محلّي يقلّد GitHub Pages (Cache-Control: max-age=600) ويغيّر VERSION في sw.js وعلامةً في home.html عند «النشر».
// ① شريط «تتوفّر نسخة جديدة» يُرى فعلاً (الصفحة منزلقة · شريط بحث المتجر فوقه) — كان يُنشأ مختفياً.
// ② بعد النشر تُفتح الرئيسية بنسختها الجديدة لا من كاش المتصفّح (كانت القديمة ١٠ دقائق).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
const W = +(process.env.W || 390), HH = W < 700 ? 800 : 768;
const ROOT = path.resolve(__dirname, '../..'); let VER = 'A';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  let b = fs.readFileSync(f);
  if (p === '/sw.js') b = Buffer.from(b.toString('utf8').replace(/const VERSION = '[^']+'/, "const VERSION = 'gmt-vT" + VER + "'"));
  if (p === '/home.html') b = Buffer.from(b.toString('utf8').replace('</body>', '<!--MARK' + VER + '--></body>'));
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' }); r.end(b);
});
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); c ? pass++ : fail++; };
(async () => {
  await new Promise(res => srv.listen(0, '127.0.0.1', res)); const B = 'http://127.0.0.1:' + srv.address().port + '/';
  await H.seed();
  const br = await chromium.launch();
  for (const [page, init] of [['home.html', H.ADMIN_INIT], ['store.html', H.ADMIN_INIT], ['pos.html', H.STAFF_INIT], ['inventory.html', H.ADMIN_INIT]]) {
    VER = 'A';
    const ctx = await br.newContext({ viewport: { width: W, height: HH }, isMobile: W < 700, hasTouch: W < 700 });
    await ctx.route('**/*.supabase.co/**', async route => { const u = route.request().url(); const i = u.indexOf('/rest/v1/');
      if (i < 0) return route.fulfill({ status: 200, body: '{}' });
      try { const rr = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: rr }); } catch (e) { try { await route.abort(); } catch (_) {} } });
    await ctx.route(/^https:\/\/(?!127)/, rr => { if (/supabase/.test(rr.request().url())) return rr.fallback(); rr.fulfill({ status: 404, body: '' }); });
    await ctx.addInitScript(init);
    const pg = await ctx.newPage();
    await pg.goto(B + page); await pg.waitForTimeout(4500); await pg.reload(); await pg.waitForTimeout(4500);
    await pg.evaluate(() => window.scrollTo(0, 400)); await pg.waitForTimeout(300);
    VER = 'B';                                                                     // «نشر»
    await pg.evaluate(() => window.dispatchEvent(new Event('focus'))); await pg.waitForTimeout(5000);
    const st = await pg.evaluate(() => { const b = document.getElementById('gmt-pwa-bar'); if (!b) return { bar: false };
      const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { bar: true, top: Math.round(r.top), seen: r.top >= 0 && r.bottom <= innerHeight && !!(t && b.contains(t)) }; });
    ok(st.bar && st.seen, page + ': بعد النشر شريط «تتوفّر نسخة جديدة» ظاهرٌ فوق كلّ شيء والصفحة منزلقة — ' + JSON.stringify(st));
    if (page === 'home.html') {
      await pg.click('#gmt-pwa-no'); ok(await pg.evaluate(() => !document.getElementById('gmt-pwa-bar')), '«لاحقاً» يُخفيه');
    }
    await ctx.close();
  }
  // ② كاش المتصفّح: بلا اعتراضٍ للشبكة (الاعتراض يُطفئ الكاش في Playwright) — كالهاتف تماماً
  VER = 'A';
  const ctx = await br.newContext({ viewport: { width: 390, height: 800 } }); await ctx.addInitScript(H.ADMIN_INIT);
  const pg = await ctx.newPage();
  await pg.goto(B + 'home.html'); await pg.waitForTimeout(3500); await pg.goto(B + 'home.html'); await pg.waitForTimeout(2500);
  const mk = () => pg.evaluate(() => (document.documentElement.outerHTML.match(/MARK(\w)/) || [])[1]);
  ok(await pg.evaluate(() => !!navigator.serviceWorker.controller) && (await mk()) === 'A', 'التطبيق مثبَّت وعامل الخدمة يتحكّم · النسخة A');
  VER = 'B';
  await pg.goto(B + 'inventory.html'); await pg.waitForTimeout(1200); await pg.goto(B + 'home.html'); await pg.waitForTimeout(1800);
  ok((await mk()) === 'B', 'بعد النشر بثوانٍ: الرئيسية تُفتح بالنسخة الجديدة B لا القديمة من كاش المتصفّح (max-age=600)');
  VER = 'C'; await pg.goto(B + 'home.html'); await pg.waitForTimeout(1500);
  ok((await mk()) === 'C', 'نشرٌ ثانٍ: النسخة C فوراً');
  await ctx.close(); await br.close(); srv.close();
  console.log(fail ? 'FAIL=' + fail + ' PASS=' + pass : 'ALL PASS (' + pass + ')');
  process.exit(fail ? 1 : 0);
})();
