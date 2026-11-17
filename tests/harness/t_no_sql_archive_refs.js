// (ARC-HTML-2#55) رسائل الواجهة لا تُحيل إلى «SQL/أرشيف_SQL.html» أو «_SQL/…» — ملفاتٌ غير موجودة عند المستخدم.
// الإحالة الصحيحة: «أبلغ المسؤول التقني — ينقص عمود/دالة X في القاعدة». (التعليقات والوثائق التاريخية مستثناة)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const MSG = /showToast\(|toast\(|alert\(|bad\(|warn\(|warn:|detail:|innerHTML|textContent|GMTUI\.|modal\(/;
const REF = /أرشيف_SQL|_SQL\//;
const hits = [];
for (const f of fs.readdirSync(ROOT)) {
  if (!/\.(html|js)$/.test(f)) continue;
  fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
    if (REF.test(l) && MSG.test(l)) hits.push(f + ':' + (i + 1));
  });
}
ok(!hits.length, 'لا رسالة واجهة تُحيل إلى ملف SQL غير موجود ' + hits.slice(0, 6).join(' · '));
const ap = fs.readFileSync(path.join(ROOT, 'admin_pos.html'), 'utf8');
ok((ap.match(/أبلغ المسؤول التقني: تنقص أعمدة الإبطال/g) || []).length === 2, 'إبطال الدين/المصروف يُرشد للمسؤول التقني باسم الأعمدة الناقصة');
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
