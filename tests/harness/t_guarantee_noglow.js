// guarantee.html: لا توهّج ظلّ تجميلي (VER-4#REQ-0387)
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  await H.seed();
  const o = await H.open('guarantee.html', { w: 390, h: 900, wait: 3000 });
  const n = await o.pg.evaluate(() => [...document.querySelectorAll('*')].filter(e => /rgba?\([^)]*\)\s+0px\s+0px\s+[1-9]\d*px/.test(getComputedStyle(e).boxShadow)).length);
  ok(n === 0, 'لا عنصر بتوهّج ظلّ (0 0 blur): ' + n);
  const src = require('fs').readFileSync(__dirname + '/../../guarantee.html', 'utf8');
  ok(!/classList\.add\('shadow-\[0_0/.test(src), 'لا إضافة توهّج برمجياً');
  await o.browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
