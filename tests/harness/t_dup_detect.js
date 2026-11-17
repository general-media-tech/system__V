// (ARC-CODE-2#33) كاشف التكرار: نسخة مطابقة وأسماء متباعدة تُكشف بأماكنها
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let bad = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) bad++; };
const T = path.join(__dirname, '..', '..', 'tools', 'audit', 'dup_detect.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup-'));
const body = '{ var total = 0; for (var i = 0; i < items.length; i++) { total += Number(items[i].price || 0) * Number(items[i].qty || 1); } return Math.round(total * 100) / 100; }';
fs.writeFileSync(path.join(dir, 'a.js'), 'function sumCart(items) ' + body + '\nfunction showToast(m){ var d=document.createElement("div"); d.textContent=m; d.className="toast-a"; document.body.appendChild(d); setTimeout(function(){ d.remove(); }, 2500); }');
fs.writeFileSync(path.join(dir, 'b.html'), '<script>\nfunction sumCart(items) ' + body.replace(/ /g, '  ').replace('{', '{ /* نسخة */') + '\nfunction showToast(m,t){ var d=document.createElement("div"); d.textContent=m; d.className="toast-b "+(t||""); document.body.appendChild(d); setTimeout(function(){ d.remove(); }, 3000); }\n</script>');
const r = JSON.parse(execFileSync('node', [T, '--json', '--min', '100'], { env: Object.assign({}, process.env, { SCAN_ROOT: dir }) }).toString());
ok(r.exact.some(g => g.name === 'sumCart' && g.copies === 2 && g.where.includes('b.html:2')), 'نسخة مطابقة (رغم التعليق والمسافات) ← ' + JSON.stringify(r.exact.map(g => g.name + ':' + g.where.join(','))));
ok(r.drift.some(g => g.name === 'showToast' && g.files === 2), 'نفس الاسم بجسمين مختلفين ⇒ متباعدة');
const real = execFileSync('node', [T]).toString();
ok(/كاشف التكرار — \d+ ملفاً/.test(real), 'يعمل على المستودع: ' + real.split('\n')[1]);
fs.rmSync(dir, { recursive: true, force: true });
console.log(bad ? `❌ ${bad} فشل` : '✅ كلّ الفحوص نجحت'); process.exit(bad ? 1 : 0);
