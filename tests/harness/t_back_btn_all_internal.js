// (OWN-09#10 · OWN-05#95) كل صفحة داخلية (GMT_INTERNAL) فيها زرّ الرئيسية (رجوع) وزرّ التحديث
const fs = require('fs'), path = require('path');
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const root = path.join(__dirname, '..', '..');
const internal = fs.readdirSync(root).filter(f => f.endsWith('.html')).filter(f => /GMT_INTERNAL\s*=\s*1/.test(fs.readFileSync(path.join(root, f), 'utf8')));
(async () => {
  await H.seed();
  const skip = /^(home|index|preview_ui2)\.html$/;
  const missing = internal.filter(f => !/gmt-refresh\.js/.test(fs.readFileSync(path.join(root, f), 'utf8')) && !skip.test(f));
  ok(!missing.length, 'كل الصفحات الداخلية تحمّل gmt-refresh.js — ينقص: ' + missing.join(' '));
  for (const f of ['morning.html', 'quote.html']) {
    const o = await H.open(f, { w: 390, h: 800, wait: 3000 });
    const r = await o.pg.evaluate(() => ({ h: !!document.getElementById('gmt-home-btn'), r: !!document.getElementById('gmt-refresh-btn') }));
    ok(r.h && r.r, f + ': زرّ الرئيسية وزرّ التحديث ظاهران');
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
