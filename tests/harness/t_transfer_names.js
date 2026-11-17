// النقل: from_branch_name لا يُرسَل فارغاً (REQ-0468) + الفاحص يحمّل gmt-stock.js عند غيابه (REQ-0471)
const H = require('./h.js');
const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  const root = __dirname + '/../../';
  const st = fs.readFileSync(root + 'gmt-stock.js', 'utf8');
  ok(!/from_branch_name: t\.from_branch_name \|\| null/.test(st) && !/to_branch_name: t\.to_branch_name \|\| null/.test(st), 'splitFailed: الاسم يرجع إلى مفتاح الفرع لا null');
  const di = fs.readFileSync(root + 'gmt-deep-inspector.js', 'utf8');
  ok((di.match(/from_branch_name: FROM/g) || []).length === 2, 'الفاحص العميق: فاتورتا النقل تحملان from_branch_name');
  await H.seed();
  const o = await H.open('checks.html', { w: 390, h: 900, wait: 3000 });
  const r = await o.pg.evaluate(async () => {
    const before = !!window.GMTStock;
    await new Promise(ok => { const s = document.createElement('script'); s.src = 'gmt-deep-inspector.js?v=t'; s.onload = ok; s.onerror = ok; document.head.appendChild(s); });
    return { before, hasDI: !!window.GMTDeepInspector };
  });
  ok(r.hasDI, 'الفاحص العميق يُحمَّل في checks.html (GMTStock قبل: ' + r.before + ')');
  await o.browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
