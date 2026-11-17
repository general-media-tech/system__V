// (VER-5#REQ-0503) لا catch فارغة في مسارات كتابة المال/المخزون: ① العدّاد يخرج حرجة = 0 · ② gmtSwallow يسجّل للحارس
const path = require('path'), { execFileSync } = require('child_process');
const H = require('./h.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
let txt = '', code = 0;
try { txt = execFileSync('node', [path.join(__dirname, 'empty_catch.js'), '--crit']).toString(); } catch (e) { code = e.status; txt = String(e.stdout); }
ok(code === 0 && /حرجة \(كتابة مال\/مخزون\) 0/.test(txt), 'catch فارغة في كتابة المال/المخزون = 0 ← ' + txt.split('\n')[0]);
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1200, h: 900, wait: 3500 });
  const r = await pg.evaluate(() => {
    gmtSwallow('تراجع: إعادة حالة فاتورة النقل', new Error('HTTP 500'), true);
    gmtSwallow('وسم الفاتورة «للمراجعة»', new Error('timeout'));
    return GMTBug.list().filter(e => /تراجع تعذّر|فشل صامت/.test(e.type)).map(e => e.sev + '|' + e.type + '|' + e.msg);
  });
  ok(r.some(x => /^crit\|تراجع تعذّر\|تراجع: إعادة حالة فاتورة النقل — HTTP 500/.test(x)), 'تراجعٌ فاشل ⇒ حرج للحارس');
  ok(r.some(x => /^warn\|فشل صامت\|وسم الفاتورة/.test(x)), 'وسمٌ فاشل ⇒ تحذير للحارس');
  await browser.close();
  console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
  process.exit(bad ? 1 : 0);
})();
