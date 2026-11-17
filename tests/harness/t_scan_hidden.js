// (ARC-MD-05#14) مسحة المختفيات: ① على المستودع الحالي الحرجة = 0 · ② دالّة مستدعاة حُذف تعريفها ومرجع ملف مفقود يُكشفان بالاسم والسطر
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const SCAN = path.join(__dirname, 'scan_hidden.js');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
function run(root) {
  try { return { code: 0, out: JSON.parse(execFileSync('node', [SCAN, '--json'], { env: Object.assign({}, process.env, root ? { SCAN_ROOT: root } : {}) }).toString()) }; }
  catch (e) { return { code: e.status, out: JSON.parse(String(e.stdout)) }; }
}
const real = run();
ok(real.code === 0 && !real.out.C.length && !real.out.D.length, 'المستودع الحالي: الحرجة = 0 (C ' + real.out.C.length + ' · D ' + real.out.D.length + ' · فُحص ' + real.out.checked + ' استدعاء)');
ok(real.out.checked > 500, 'المسحة تفحص معالجات الأحداث فعلاً (' + real.out.checked + ')');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanhid-'));
fs.writeFileSync(path.join(dir, 'lib.js'), 'function fromLib(){}\nwindow.GMTX = { go: function(){} };\n');
fs.writeFileSync(path.join(dir, 'p.html'), [
  '<!doctype html><html><head><script src="lib.js"></script></head><body>',
  '<button onclick="realFn()">a</button>',
  '<button onclick="fromLib();GMTX.go()">b</button>',
  '<button onclick="ghostFn(1)">c</button>',
  '<!-- كان <img src="old.png"> -->',
  '<img src="gone.png">',
  '<img src="soft.png" onerror="this.remove()">',
  '<script>function realFn(){} var t = `<i onclick="alsoGhost(\'${1}\')">`; localStorage.getItem(\'never_written\');</script>',
  '</body></html>'].join('\n'));
const r = run(dir);
const names = r.out.C.map(x => x.name + ':' + x.line);
ok(r.code === 1, 'وجود حرج ⇒ رمز خروج 1');
ok(names.includes('ghostFn:4') && names.includes('alsoGhost:8'), 'الدالّة غير المعرّفة تُكشف بالاسم والسطر ← ' + names.join(' · '));
ok(!names.some(n => /realFn|fromLib|GMTX|alert/.test(n)), 'المعرّف في الصفحة أو سكربتها لا يُبلَّغ');
ok(r.out.D.length === 1 && r.out.D[0].ref === 'gone.png' && r.out.D[0].line === 6, 'المرجع المفقود يُكشف (لا ما في التعليق) ← ' + JSON.stringify(r.out.D));
ok(r.out.Dw.length === 1 && r.out.Dw[0].ref === 'soft.png', 'المرجع المحمي بـonerror تنبيه لا حرج');
ok(r.out.E.some(x => x.key === 'never_written'), 'مفتاح يُقرأ ولا يُكتب ⇒ تنبيه');
fs.rmSync(dir, { recursive: true, force: true });
console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت');
process.exit(bad ? 1 : 0);
