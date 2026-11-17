// 🔁 كاشف التكرار (ARC-CODE-2#33 · OWN-07#12) — يحصر الدوالّ المكرّرة بين ملفّات المشروع (قراءة فقط، لا يعدّل شيئاً)
// التشغيل: node tools/audit/dup_detect.js [--min 200] [--json] [--top 40]
//   • يستخرج كل «function name(…) { … }» من ملفّات .js وكتل <script> في .html
//   • يطبّع الجسم (بلا تعليقات ولا مسافات) ⇒ نفس البصمة = نسخة مطابقة
//   • يجمّع أيضاً بالاسم: نفس الاسم بأجسامٍ مختلفة في ملفّات عدّة = نُسخ متباعدة (أخطر: إصلاحٌ في واحدة لا يصل للبقيّة)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = process.env.SCAN_ROOT || path.resolve(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MIN = arg('--min', 200), TOP = arg('--top', 40);
const files = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && f !== 'sw.js');

function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }
/* يجد نهاية الكتلة بموازنة الأقواس متجاهلاً النصوص */
function blockEnd(s, i) {
  let d = 0, q = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}
const fns = [];
for (const f of files) {
  let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  /* HTML: كل ما خارج كتل <script> يُفرَّغ مع حفظ الأسطر ⇒ أرقام الأسطر تطابق الملف نفسه */
  if (f.endsWith('.html')) { let o = '', last = 0; const re2 = /(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g; let b;
    const blank = t => t.replace(/[^\n]/g, ' ');
    while ((b = re2.exec(src))) { o += blank(src.slice(last, b.index + b[1].length)) + b[2] + ';'; last = b.index + b[0].length - 1; }
    src = o + blank(src.slice(last)); }
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g; let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1, end = blockEnd(src, open);
    if (end < 0) continue;
    const body = src.slice(open, end + 1);
    const norm = stripComments(body).replace(/\s+/g, '');
    if (norm.length < MIN) continue;
    fns.push({ f, name: m[1], line: src.slice(0, m.index).split('\n').length, len: norm.length, h: crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12) });
  }
}
/* ① نسخ مطابقة (نفس البصمة في ملفّين أو أكثر) */
const byH = {}; fns.forEach(x => (byH[x.h] = byH[x.h] || []).push(x));
const exact = Object.values(byH).filter(g => new Set(g.map(x => x.f)).size > 1)
  .map(g => ({ name: g[0].name, len: g[0].len, copies: g.length, where: g.map(x => x.f + ':' + x.line) }))
  .sort((a, b) => b.len * b.copies - a.len * a.copies);
/* ② نفس الاسم بأجسام مختلفة في ملفّات مختلفة (نُسخ تباعدت) */
/* أسماء محلّية عامّة (render/paint/open…) داخل وحدات مستقلّة — ليست تكراراً حقيقياً؛ تبقى في --json فقط */
const GENERIC = new Set('render paint load open close css boot run show hide draw mount go start styles init save fill badge build update refresh step tick next prev reset clear apply setup main handler cb done finish'.split(' '));
const byN = {}; fns.forEach(x => (byN[x.name] = byN[x.name] || []).push(x));
const drift = Object.entries(byN).filter(([, g]) => new Set(g.map(x => x.f)).size > 1 && new Set(g.map(x => x.h)).size > 1)
  .map(([name, g]) => ({ name, variants: new Set(g.map(x => x.h)).size, files: new Set(g.map(x => x.f)).size, where: g.map(x => x.f + ':' + x.line) }))
  .sort((a, b) => b.files - a.files || b.variants - a.variants);
const waste = exact.reduce((a, g) => a + g.len * (g.copies - 1), 0);
if (process.argv.includes('--json')) { console.log(JSON.stringify({ min: MIN, functions: fns.length, exact, drift }, null, 1)); process.exit(0); }
console.log('🔁 كاشف التكرار — ' + files.length + ' ملفاً · ' + fns.length + ' دالّة (≥ ' + MIN + ' حرفاً بعد التطبيع)');
console.log('① نسخ مطابقة عبر الملفّات: ' + exact.length + ' مجموعة · ~' + Math.round(waste / 1024) + ' ك.ب مكرّرة');
exact.slice(0, TOP).forEach(g => console.log('   ' + g.name + ' ×' + g.copies + ' (' + g.len + ')  ' + g.where.join(' · ')));
console.log('② نفس الاسم بأجسام متباعدة: ' + drift.length + ' اسماً (يُعرض ما ليس اسماً محلّياً عامّاً: ' + drift.filter(g => !GENERIC.has(g.name)).length + ')');
drift.filter(g => !GENERIC.has(g.name)).slice(0, TOP).forEach(g => console.log('   ' + g.name + ' — ' + g.variants + ' نسخ في ' + g.files + ' ملفات: ' + g.where.slice(0, 6).join(' · ') + (g.where.length > 6 ? ' …' : '')));
