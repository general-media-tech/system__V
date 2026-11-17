// (VER-5#REQ-0503) عدّاد الـcatch الفارغة وتصنيفها — node tests/harness/empty_catch.js [--crit] [--json]
//   safe  : تخزين محلي · JSON.parse · حافظة · اهتزاز/صوت · DOM تجميلي — الصمت فيها مقصود
//   net   : طلب شبكة لا يكتب (قراءة/تيليغرام/تتبّع) — يكفي أن تُعرض حالة «تعذّر» في الواجهة
//   crit  : كتابة مال/مخزون في القاعدة (POST/PATCH/DELETE · rpc · invoices · commissions · stock · expenses …) — الصمت ممنوع:
//           يجب أن يُسجَّل للحارس (GMTBug) أو يُعرض للمستخدم. --crit يُخرج 1 إن وُجد منها شيء.
const fs = require('fs'), path = require('path');
const ROOT = process.env.SCAN_ROOT || path.resolve(__dirname, '..', '..');
const SKIP = /^(sw\.js|gmt-push\.js|gmt-inbox\.js|gmt-cust-push\.js|gmt-whatsnew\.js)$/;
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && !SKIP.test(f));
const SAFE = /localStorage|sessionStorage|JSON\.parse|clipboard|vibrate|\.play\(|AudioContext|focus\(|scrollIntoView|removeChild|\.remove\(\)|classList|\.style\.|setItem|getItem|removeItem|decodeURI|new URL|navigator\.|Notification|serviceWorker|caches\.|getComputedStyle|console\./;
const WRITE = /(['"`])(POST|PATCH|DELETE)\1|method\s*:\s*['"`](POST|PATCH|DELETE)|\/rpc\/|sb\(\s*['"`](POST|PATCH|DELETE)/;
const MONEY = /invoice|commission|stock|deduct|add_branch|expense|settle|cash|payment|paid|refund|transfer|debt|ledger|price|qty|products\b|gmt_orders|import_log|receipt/i;
const out = []; const per = {};
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /catch\s*(\([^)]*\))?\s*\{\s*(\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\/\s*|\/\/[^\n]*\n\s*)*\}/g;
  let m;
  while ((m = re.exec(s))) {
    /* السياق: كتلة try المقابلة (حتى 600 حرف قبل catch) */
    const before = s.slice(Math.max(0, m.index - 600), m.index);
    const tryAt = before.lastIndexOf('try');
    const ctx = tryAt >= 0 ? before.slice(tryAt) : before.slice(-200);
    let cls = 'other';
    if (f === 'gmt-deep-inspector.js' && WRITE.test(ctx)) cls = 'test';      // تنظيف بيانات اختبار موسومة — يكنسها منظّف البقايا في الفاحص نفسه
    else if (WRITE.test(ctx) && MONEY.test(ctx)) cls = 'crit';
    else if (SAFE.test(ctx) && !/fetch|sb\(|await/.test(ctx)) cls = 'safe';
    else if (/fetch|sb\(|await|\.then\(/.test(ctx)) cls = 'net';
    else if (SAFE.test(ctx)) cls = 'safe';
    const line = s.slice(0, m.index).split('\n').length;
    out.push({ f, line, cls });
    per[f] = per[f] || { safe: 0, net: 0, crit: 0, other: 0, test: 0 }; per[f][cls]++;
  }
}
const tot = { safe: 0, net: 0, crit: 0, other: 0, test: 0 }; out.forEach(x => tot[x.cls]++);
if (process.argv.includes('--json')) { console.log(JSON.stringify({ tot, per, crit: out.filter(x => x.cls === 'crit') }, null, 1)); }
else {
  console.log('catch فارغة: ' + out.length + ' في ' + Object.keys(per).length + ' ملفاً — آمنة ' + tot.safe + ' · شبكة ' + tot.net + ' · أخرى ' + tot.other + ' · تنظيف اختبار ' + tot.test + ' · حرجة (كتابة مال/مخزون) ' + tot.crit);
  out.filter(x => x.cls === 'crit').forEach(x => console.log('   🔴 ' + x.f + ':' + x.line));
}
process.exit(process.argv.includes('--crit') && tot.crit ? 1 : 0);
