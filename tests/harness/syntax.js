const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.env.GMT_ROOT || path.resolve(__dirname, '..', '..');   /* جذر المستودع الذي يقع فيه هذا الملف (يعمل في أي نسخة/worktree) */
/* (ARC-MD-01#20) رقم السطر: أوّل سطر من e.stack = «ملف:سطر» ثمّ الرسالة ⇒ تظهر علامة الخلفية الشاردة بمكانها بدل رسالة بلا موضع */
const where = (e) => { const l = String(e.stack || '').split('\n')[0]; return /:\d+$/.test(l) ? l : ''; };
let bad = 0, blocks = 0;
for (const f of fs.readdirSync(ROOT)) {
  if (f.endsWith('.js')) { try { new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }); } catch (e) { bad++; console.log('JS', where(e) || f, e.message); } continue; }
  if (!f.endsWith('.html')) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(t))) {
    const attrs = m[1] || ''; if (/type=["'](?!text\/javascript|module)/i.test(attrs)) continue;
    blocks++;
    const startLine = t.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length;   /* سطر بداية الكتلة داخل الصفحة */
    try { new vm.Script(m[2], { filename: f, lineOffset: startLine - 1 }); } catch (e) { bad++; console.log('BLOCK', where(e) || f, e.message.slice(0, 120)); }
  }
}
/* (TASK-0332 · المالك seq 539 «المتجر من إنستغرام لا يحمّل») النظر للخلف في التعابير المنتظمة `(?<=` `(?<!` لا يدعمه سفاري/iOS
   قبل 16.4 (متصفّح إنستغرام على الآيفون = سفاري الجهاز) ⇒ الملفّ كلّه يسقط. ممنوع خارج التعليقات. */
let lb = 0;
for (const f of fs.readdirSync(ROOT)) {
  if (!/\.(js|html)$/.test(f)) continue;
  fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((l, i) => {
    const code = l.replace(/\/\*.*?\*\//g, '').replace(/^\s*(\/\/|\*|<!--).*$/, '');
    if (/\(\?<[=!]/.test(code)) { lb++; console.log('LOOKBEHIND (iOS<16.4)', f + ':' + (i + 1), l.trim().slice(0, 90)); }
  });
}
bad += lb;
console.log('blocks checked:', blocks, '| syntax errors:', bad, lb ? '| lookbehind: ' + lb : '');
