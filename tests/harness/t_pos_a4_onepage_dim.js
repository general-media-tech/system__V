// (طابور سونيت · الطباعة) ARC-MD-01#42 تخفيت كسور المبالغ في الفاتورة (صحيح عريض + كسر خافت) · والفاتورة A4 صفحة واحدة دائماً حتى من نقطة البيع
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const pages = buf => (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
(async () => {
  await H.seed();
  const o = await H.open('pos.html', { w: 1366, h: 900, mobile: false, wait: 3500 });
  for (const n of [4, 40]) {
    const html = await o.pg.evaluate(n => {
      const items = Array.from({ length: n }, (_, i) => ({ prod: { name: 'منتج رقم ' + (i + 1) }, qty: 2, price: 12.5 + i }));
      const data = getInvoiceData(); data.ITEMS_ROWS = buildRowsB(items);
      return _a4Finish(fillTpl(_tplB().replace('{{ITEMS_ROWS}}', data.ITEMS_ROWS), data));
    }, n);
    const pg = await o.ctx.newPage(); await pg.setContent(html, { waitUntil: 'load' }); await pg.waitForTimeout(700);
    const buf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    ok(pages(buf) === 1, `فاتورة نقطة البيع بـ${n} بنداً ⇒ صفحة A4 واحدة (${pages(buf)})`);
    const d = await pg.evaluate(() => ({
      cells: document.querySelectorAll('.items tbody td:nth-child(5) .dc, .items tbody td:nth-child(6) .dc').length,
      box: document.querySelectorAll('.box .v .dc').length,
      total: (document.querySelector('.box .v') || {}).textContent,
      op: (document.querySelector('.dc') ? getComputedStyle(document.querySelector('.dc')).opacity : null),
    }));
    if (n === 4) ok(d.cells >= 8 && d.box >= 1 && Number(d.op) < 1, 'الكسور خافتة في البنود والمجاميع: ' + JSON.stringify(d));
    await pg.close();
  }
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|vibrate|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
