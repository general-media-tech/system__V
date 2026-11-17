// (ARC-MD-01#20) syntax.js يطبع «ملف:سطر» للخطأ داخل كتلة <script> وداخل ملف .js — مختبَر على جذر مؤقّت (GMT_ROOT)
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const run = (root) => cp.spawnSync('node', [path.join(__dirname, 'syntax.js')], { env: { ...process.env, GMT_ROOT: root }, encoding: 'utf8' }).stdout;
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synt-'));
fs.writeFileSync(path.join(d, 'a.html'), '<html>\n<body>\n<p>x</p>\n<script>\nvar a = 1;\n// تعليق فيه ` شاردة\nvar b = (;\n</script>\n</body></html>\n');
fs.writeFileSync(path.join(d, 'b.js'), 'var x = 1;\nvar y = (;\n');
const out = run(d);
ok(/BLOCK a\.html:7\b/.test(out), 'خطأ الكتلة يحمل اسم الصفحة وسطرها الصحيح (7): ' + out.replace(/\n/g, ' ; '));
ok(/JS b\.js:2\b/.test(out), 'خطأ ملف js يحمل رقم السطر (2)');
const good = fs.mkdtempSync(path.join(os.tmpdir(), 'synt-')); fs.writeFileSync(path.join(good, 'c.js'), 'var q=1;');
ok(/syntax errors: 0/.test(run(good)), 'الجذر السليم ⇒ صفر أخطاء');
console.log(fails ? 'FAIL ' + fails : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
