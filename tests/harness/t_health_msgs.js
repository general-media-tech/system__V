// (VER-3#REQ-0321) لوحة الصحة/الفحص لا تذكر ملفاتٍ غير موجودة (gmt-bugcatcher.js · gmt-inspector.js · gmt-ui.js …) ولا مجلداً غير موجود
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..', '..');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const staff = fs.readFileSync(path.join(R, 'gmt-staff.js'), 'utf8'), core = fs.readFileSync(path.join(R, 'gmt-core.js'), 'utf8');
const a = staff.slice(staff.indexOf('function testBots()'), staff.indexOf('function testBots()') + 2500);
const b = core.slice(core.indexOf('/* ① البوتات المحمّلة */'), core.indexOf('/* ① البوتات المحمّلة */') + 1200);
for (const [n, t] of [['gmt-staff testBots', a], ['gmt-core runCheck', b]]) {
  const files = [...t.matchAll(/'(gmt-[a-z-]+\.js)'/g)].map(m => m[1]);
  ok(files.length > 0 && files.every(f => fs.existsSync(path.join(R, f))), n + ': كل الملفات المذكورة موجودة فعلاً: ' + [...new Set(files)].join(' '));
  ok(!/02_ملفات_مشتركة|gmt-bugcatcher\.js|gmt-inspector\.js|gmt-ui\.js|gmt-sandbox\.js|gmt-guide\.js/.test(t), n + ': لا إشارة لملف/مجلد غير موجود');
}
console.log(fails ? 'FAIL ' + fails : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
