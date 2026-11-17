// (REQ-0327) أصول محمّلة جزئياً:
//  ① كلّ ملفّ gmt-*.js يُحمَّل برقم ?v= واحد في كل الصفحات (الأرقام المتعدّدة = نسخٌ قديمة في الكاش)
//  ② الصفحات الداخلية التشغيلية تحمّل gmt-core.js (الحارس GMTBug) وتعمل بلا أخطاء JS
const fs = require('fs'), path = require('path');
const H = require('./h.js');
const ROOT = path.join(__dirname, '..', '..');
/* صفحات مركز الإشعارات لا تُلمس من هذه المهمّة (منشورة حديثاً) — تُستثنى من الفحص الثابت */
const SKIP = new Set(['إدارة_الإشعارات.html', 'مركز_الإشعارات.html', 'ابق_على_اطلاع.html']);
const PAGES = ['sales_log.html', 'passwords.html', 'morning.html', 'quote.html', 'المراجعة_المالية_الشاملة.html', 'تفعيل_عقل_النظام.html', 'أماكن_الوصول.html', 'دليل_التوافقيات_والمواصفات.html', 'user_guide.html'];
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };

const vers = {};
for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.has(f))) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of s.matchAll(/src="(gmt-[a-z0-9-]+\.js)\?v=([0-9a-z]+)"/g)) (vers[m[1]] = vers[m[1]] || new Set()).add(m[2]);
}
const multi = Object.entries(vers).filter(([, v]) => v.size > 1).map(([k, v]) => k + ': ' + [...v].join('/'));
ok(!multi.length, 'رقم ?v= واحد لكل ملفّ ← ' + (multi.join(' · ') || 'موحّد'));
for (const p of PAGES) ok(/src="gmt-core\.js\?v=/.test(fs.readFileSync(path.join(ROOT, p), 'utf8')), 'gmt-core.js محمّل في ' + p);

(async () => {
  await H.seed();
  for (const p of PAGES) {
    const { browser, pg, errs } = await H.open(p, { w: 1200, h: 900, wait: 3000 });
    const has = await pg.evaluate(() => !!(window.GMTBug && window.GMTUI));
    const real = errs.filter(e => !/vibrate|favicon|ERR_|Failed to load resource|404/.test(e));
    ok(has && !real.length, p + ' — GMTBug/GMTUI ' + (has ? 'موجودان' : 'غائبان') + (real.length ? ' · أخطاء: ' + real.slice(0, 2).join(' | ') : ''));
    await browser.close();
  }
  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
  process.exit(bad ? 1 : 0);
})();
