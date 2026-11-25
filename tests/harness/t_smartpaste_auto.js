// (seq B1069 «يتعرّف تلقائياً على الكتابة ملاحظة أو منتج أو عنوان … والأشياء اللي ما يعرفها يتركها بمربّع لحاله بخيارات لكلّ سطر … أنسخه وأقصّه»)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'Canon EOS 250D', barcode: 'SP1', price: 500, daraa: 2 }]);
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const st = () => pg.evaluate(() => ({ addr: document.getElementById('in-addr').value, notes: document.getElementById('in-notes').value,
    rows: [...document.querySelectorAll('#sp-unk-rows [data-unk]')].map(x => ({ t: x.querySelector('div').innerText, auto: x.dataset.auto || '', placed: x.dataset.placed || '' })) }));
  await pg.evaluate(async () => { try { openAddModal && openAddModal(); } catch (_) {} await new Promise(z => setTimeout(z, 500));
    document.getElementById('sp-text').value = 'محمد الأحمد\n0944123456\nحلب الفرقان قرب الجامع\nكانون 250D\nبدي ياه بكرا الصبح\nشي غريب xyz';
    await smartFillFromPaste(); await new Promise(z => setTimeout(z, 1500)); });
  let s = await st();
  const r = t => s.rows.find(x => x.t === t) || {};
  ok(r('بدي ياه بكرا الصبح').auto === 'note' && /بدي ياه بكرا الصبح/.test(s.notes), 'ملاحظة واضحة ⇒ تلقائياً للملاحظات (خضراء)');
  ok(r('قرب الجامع').auto === 'addr' && /· قرب الجامع$/.test(s.addr), 'تفصيل عنوان («قرب الجامع») ⇒ تلقائياً للعنوان');
  ok(r('شي غريب xyz').t && !r('شي غريب xyz').auto, 'ما لا يُعرف يبقى بالمربّع ينتظرك بخياراته');
  await pg.evaluate(() => { const c = [...document.querySelectorAll('#sp-unk-rows [data-unk]')].find(x => x.querySelector('div').innerText === 'بدي ياه بكرا الصبح'); c.querySelector('button[data-k="addr"]').click(); });
  await pg.waitForTimeout(200); s = await st();
  ok(!/بدي ياه/.test(s.notes) && /· بدي ياه بكرا الصبح$/.test(s.addr), 'تغيير التصنيف بضغطة ⇒ يُرفع من الملاحظات ويذهب للعنوان (لا تكرار)');
  await pg.evaluate(() => { const c = [...document.querySelectorAll('#sp-unk-rows [data-unk]')].find(x => x.querySelector('div').innerText === 'شي غريب xyz'); c.querySelector('button[data-k="cut"]').click(); });
  await pg.waitForTimeout(200); s = await st();
  ok(!s.rows.some(x => x.t === 'شي غريب xyz') && !/شي غريب/.test(await pg.evaluate(() => document.getElementById('sp-unk-text').value)), '✂️ قصّ ⇒ يُنسخ ويُزال من المربّع');
  ok(!errs.filter(e => !/favicon|404|400|406|Failed to load/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
