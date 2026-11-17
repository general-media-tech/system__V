// 🕵️ مسحة المختفيات (ARC-MD-05#14 · دستور 2026-08-22) — فحصٌ ساكن إلزامي قبل كل تسليم:
//   C) زرّ/حقل يستدعي دالّةً غير معرَّفة في صفحته ولا في سكربتاتها (onclick="foo()" وfoo غير موجودة) — حرج
//   D) مرجع ملفّ محلّي مفقود (src/href لملف غير موجود بالمستودع) — حرج
//   E) مفتاح localStorage/sessionStorage يُقرأ في مكانٍ ولا يُكتب في أيّ مكان — تنبيه (قد يكون أثراً قديماً)
// التشغيل: node tests/harness/scan_hidden.js [--json]  ⇒ يخرج بـ1 إن وُجد حرج (C أو D)
// لا يكرّر syntax.js (الصياغة) ولا sweep.js (أخطاء التشغيل) — يصطاد ما لا يظهر إلا عند الضغط.
const fs = require('fs'), path = require('path');
const ROOT = process.env.SCAN_ROOT || path.resolve(__dirname, '..', '..');
const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { return null; } };
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
const jsFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));

/* أسماءٌ يعرّفها المتصفّح أو اللغة — ليست دوالّ المشروع */
const BUILTIN = new Set(('alert confirm prompt print open close fetch setTimeout setInterval clearTimeout clearInterval requestAnimationFrame ' +
  'location history document window navigator console event this self parent top Math JSON Date Number String Object Array Promise ' +
  'parseInt parseFloat isNaN encodeURIComponent decodeURIComponent encodeURI decodeURI localStorage sessionStorage scrollTo scrollBy ' +
  'if return void new typeof delete await async function var let const true false null undefined Boolean RegExp Error Set Map URL ' +
  'navigator getComputedStyle requestIdleCallback structuredClone btoa atob Intl CSS Image Audio FileReader Blob').split(/\s+/));

/* تعريفات عامّة: function X( · X = function · X = ( … ) => · window.X = · var/let/const X = · class X */
function definedIn(text, set) {
  const RE = [/function\s+([A-Za-z_$][\w$]*)\s*\(/g, /(?:window|globalThis|self|global|g)\.([A-Za-z_$][\w$]*)\s*=/g,
    /(?:^|[;{}\s,])(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g, /class\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|[;\s])([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/gm,
    /Object\.defineProperty\(\s*window\s*,\s*['"]([\w$]+)['"]/g, /\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]\s*=/g];
  for (const re of RE) for (const m of text.matchAll(re)) set.add(m[1]);
  /* تعريفٌ متعدّد: let a = [], b = [], c = function … */
  for (const m of text.matchAll(/(?:^|[;{}\s])(?:var|let|const)\s+([^;\n]+)/g))
    for (const n of m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)) set.add(n[1]);
  /* (var a = …, b = function …) و«global.X = { … }» تُغطّى أعلاه؛ دوالّ داخل كائن عامّ تُفحص بالاسم الأوّل فقط */
}
const jsDefs = {};
for (const f of jsFiles) { const s = new Set(); definedIn(read(f) || '', s); jsDefs[f] = s; }
/* سكربتات تُحقن في كل صفحة تحمّل gmt-core/gmt-tools — تعريفاتها عامّة للصفحة */

const out = { C: [], D: [], Dw: [], E: [], checked: 0 };
const exists = p => { try { return fs.existsSync(path.join(ROOT, decodeURIComponent(p))); } catch (_) { return fs.existsSync(path.join(ROOT, p)); } };

for (const page of pages) {
  const html = read(page);
  const defs = new Set();
  definedIn(html, defs);
  const srcs = [...html.matchAll(/<script[^>]+src=["']([^"'?#]+)/g)].map(m => m[1]);
  for (const s of srcs) if (jsDefs[s]) jsDefs[s].forEach(x => defs.add(x));
  /* ids العناصر متاحة كمتغيّرات عامّة في المتصفّح (named access) */
  for (const m of html.matchAll(/\sid=["']([A-Za-z_$][\w$-]*)["']/g)) defs.add(m[1]);

  /* C) معالجات الأحداث: on*="foo(…)" و on*='foo(…)' (في HTML أو داخل قوالب JS) */
  const seen = new Set();
  for (const m of html.matchAll(/\bon(click|change|input|submit|keyup|keydown|keypress|blur|focus|load|error|dblclick|contextmenu|mousedown|touchstart|toggle)\s*=\s*\\?(["'])([\s\S]{0,300}?)\\?\2/g)) {
    const code = m[3];
    if (/\$\{/.test(code.split('(')[0])) continue;                 // اسم الدالّة نفسه مُولَّد ⇒ لا يُحكم ساكناً
    for (const c of code.matchAll(/(?:^|[;\s{(!&|?:,])(?:return\s+|await\s+|void\s+)?([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*\(/g)) {
      const name = c[1];
      out.checked++;
      if (BUILTIN.has(name) || defs.has(name)) continue;
      if (/^\s*\([^)]*\)\s*\{/.test(code.slice(c.index + c[0].length - 1))) continue;   // تعريف دالّة مختصر {click(){}} لا استدعاء
      if (/^(event|this|el|e|b|btn|x|t|i|n|r|p|d|o)$/.test(name)) continue;   // متغيّرات محلّية داخل قالب
      const line = html.slice(0, m.index).split('\n').length;
      const k = page + ':' + name;
      if (seen.has(k)) continue; seen.add(k);
      out.C.push({ page, line, name, code: code.slice(0, 90) });
    }
  }

  /* D) مراجع ملفّات محلّية: src=… و href=… (لا http · لا # · لا mailto/tel/javascript · لا قوالب ${})
     التعليقات تُفرَّغ أوّلاً (مع حفظ الأسطر) — «كان <img src=x.png>» في تعليقٍ ليس مرجعاً. وسمٌ فيه onerror يُخفيه ⇒ تنبيه (D!) لا حرج. */
  const noCom = html.replace(/<!--[\s\S]*?-->/g, c => c.replace(/[^\n]/g, ' '));
  for (const m of noCom.matchAll(/\b(src|href)\s*=\s*["']([^"'#?]+?)(?:[?#][^"']*)?["']/g)) {
    const ref = m[2].trim();
    if (!ref || /^(https?:|\/\/|data:|blob:|mailto:|tel:|javascript:|sms:|whatsapp:|intent:)/i.test(ref) || /[${}+<>]|\s/.test(ref) || ref === '/' || ref.endsWith('/')) continue;
    if (!/\.(html|js|css|png|jpe?g|svg|webp|gif|ico|json|mp3|wav|ogg|woff2?|pdf|txt)$/i.test(ref)) continue;
    if (!exists(ref.replace(/^\.\//, ''))) {
      const line = html.slice(0, m.index).split('\n').length;
      const tag = noCom.slice(noCom.lastIndexOf('<', m.index), noCom.indexOf('>', m.index) + 1);
      (/\bonerror\s*=/.test(tag) ? out.Dw : out.D).push({ page, line, ref });
    }
  }
}

/* E) مفاتيح التخزين المحلي: تُقرأ ولا تُكتب في أيّ ملفّ */
const all = pages.map(read).concat(jsFiles.map(read)).join('\n');
const reads = new Map(), writes = new Set();
for (const m of all.matchAll(/(?:localStorage|sessionStorage)\.getItem\(\s*['"]([^'"]+)['"]/g)) reads.set(m[1], (reads.get(m[1]) || 0) + 1);
for (const m of all.matchAll(/(?:localStorage|sessionStorage)\.setItem\(\s*['"]([^'"]+)['"]/g)) writes.add(m[1]);
for (const m of all.matchAll(/(?:lsSet|ssSet|_lsSet|setLS|lset|LS\.set|store\.set)\(\s*['"]([^'"]+)['"]/g)) writes.add(m[1]);
for (const m of all.matchAll(/(?:localStorage|sessionStorage)\[\s*['"]([^'"]+)['"]\s*\]\s*=/g)) writes.add(m[1]);
for (const [k, n] of reads) {
  if (writes.has(k)) continue;
  /* مفتاحٌ يُكتب بمتغيّر (KEY = 'x' ثمّ setItem(KEY …)) ⇒ يظهر نصّه في مكانٍ آخر غير getItem */
  const lits = (all.match(new RegExp("['\"]" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]", 'g')) || []).length;
  if (lits > n) continue;
  out.E.push({ key: k, reads: n });
}

const crit = out.C.length + out.D.length;
if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(crit ? 1 : 0); }
console.log('🕵️ مسحة المختفيات — ' + pages.length + ' صفحة · ' + jsFiles.length + ' ملف JS');
console.log('C) استدعاء دالّة غير معرَّفة: ' + out.C.length + '  (فُحص ' + out.checked + ' استدعاءً في معالجات الأحداث)');
out.C.slice(0, 60).forEach(x => console.log('   ' + x.page + ':' + x.line + '  ' + x.name + '()  ← ' + x.code));
console.log('D) مرجع ملفّ مفقود: ' + out.D.length);
out.D.slice(0, 60).forEach(x => console.log('   ' + x.page + ':' + x.line + '  ' + x.ref));
console.log('D!) مرجع مفقود يُخفيه onerror (تنبيه — أصلٌ ناقص): ' + out.Dw.length);
out.Dw.slice(0, 30).forEach(x => console.log('   ' + x.page + ':' + x.line + '  ' + x.ref));
console.log('E) مفتاح تخزين يُقرأ ولا يُكتب (تنبيه): ' + out.E.length);
out.E.slice(0, 30).forEach(x => console.log('   ' + x.key + ' (' + x.reads + ' قراءة)'));
console.log(crit ? '❌ حرج: ' + crit : '✅ الحرجة = 0');
process.exit(crit ? 1 : 0);
