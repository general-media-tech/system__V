// (TASK-B0537 · seq B1038 §٧) الكفالة من فاتورة فيها أرقام: الرقم يُعبَّأ تلقائياً · قطعةٌ بعدّة أرقام ⇒ أزرار للاختيار «دون خلط»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const items = encodeURIComponent(JSON.stringify([{ name: 'هاتف تجربة', serial: '490154203237518', serials: ['490154203237518', '353456789012348'], price: 300 }]));
  const q = 'prefill=1&name=' + encodeURIComponent('زبون') + '&product=' + encodeURIComponent('هاتف تجربة') + '&serial=490154203237518&items=' + encodeURIComponent(items);
  const { browser, pg } = await H.open('guarantee.html?' + q, { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 5000 });
  const r = await pg.evaluate(() => ({ sn: (document.getElementById('serialNo') || {}).value, btns: [...document.querySelectorAll('#gw-serial-pick [data-sn]')].map(b => b.dataset.sn) }));
  ok(r.sn === '490154203237518', 'الرقم يُعبَّأ تلقائياً من الفاتورة: ' + r.sn);
  ok(r.btns.length === 2, 'قطعة بكمية ٢ ⇒ زرّا رقمَيها: ' + r.btns.join(' · '));
  const r2 = await pg.evaluate(() => { document.querySelector('#gw-serial-pick [data-sn="353456789012348"]').click(); return document.getElementById('serialNo').value; });
  ok(r2 === '353456789012348', 'اختيار الرقم الثاني ⇒ يصير هو رقم الكفالة');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
