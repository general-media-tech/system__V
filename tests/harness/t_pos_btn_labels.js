// (ARC-MD-03#89) نقطة البيع: كل زرّ أيقونيّ (رجوع/إغلاق/إظهار) له شرحٌ (title + aria-label) يظهر بالتأشير
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('pos.html', { w: 390, h: 800, wait: 5000 });
  const out = await o.pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('button').forEach(b => {
      const t = (b.textContent || '').replace(/[^\p{L}\p{N}]/gu, '');
      if (t.length < 2 && !(b.getAttribute('data-hint') || b.title || b.getAttribute('aria-label'))) out.push((b.getAttribute('onclick') || b.className).slice(0, 40));
    });
    return out;
  });
  ok(out.length === 0, 'لا زرّ أيقونيّ بلا شرح — الباقي: ' + out.join(' | '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
