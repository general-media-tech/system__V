// (ARC-MD-04#2) SEO: صفحتا الزبون (الموقع والمتجر) فيهما meta description + وسوم og: لمعاينة المشاركة
const fs = require('fs'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
for (const f of ['site.html', 'store.html']) {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
  ok(/<meta name="description" content="[^"]{30,}"/.test(s), f + ': meta description');
  for (const k of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image'])
    ok(new RegExp('<meta property="' + k + '" content="[^"]+"').test(s), f + ': ' + k);
  const img = (s.match(/property="og:image" content="[^"]*\/([^"\/]+)"/) || [])[1];
  ok(img && fs.existsSync(path.join(__dirname, '..', '..', img)), f + ': ملف og:image موجود فعلاً (' + img + ')');
}
console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
