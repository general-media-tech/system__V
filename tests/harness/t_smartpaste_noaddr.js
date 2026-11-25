// TASK-B0542 · المالك seq B1075 (صورة: «180STH 展开» انكتب بحقل العنوان): «اللي ما تعرّف عليهم لازم يكون بمربّع لحاله … ما يخبّص أمكنتها»
// المجهول ما بيروح على العنوان (لا مع التعرّف على المنتجات ولا بدونه) — بيضلّ بمربّع «ما تعرّفنا عليهم» · والعنوان الموسوم «العنوان: …» بيضلّ يتكتب
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 6000 });
  const run = (txt, prodOn) => pg.evaluate(async ([txt, prodOn]) => {
    try { openAddModal && openAddModal(); } catch (_) {} await new Promise(z => setTimeout(z, 400));
    localStorage.setItem('gmt_sp_products', prodOn ? 'on' : 'off');
    document.getElementById('in-addr').value = '';
    document.getElementById('sp-text').value = txt; await smartFillFromPaste(); await new Promise(z => setTimeout(z, 1200));
    const unk = (document.getElementById('sp-unk-text') || {}).value || '';
    const rows = [...document.querySelectorAll('#sp-unk-rows [data-unk]')].map(x => x.querySelector('div').innerText);
    return { addr: document.getElementById('in-addr').value, unk: unk + '\n' + rows.join('\n'), name: document.getElementById('in-name').value };
  }, [txt, prodOn]);
  let r = await run('180STH 展开', false);
  ok(r.addr === '', 'التعرّف على المنتجات مطفأ: «180STH 展开» ما انكتب بالعنوان (' + JSON.stringify(r.addr) + ')');
  ok(/180STH/.test(r.unk), 'وبيضلّ بمربّع «ما تعرّفنا عليهم»');
  r = await run('180STH 展开', true);
  ok(r.addr === '', 'التعرّف شغّال: ما انكتب بالعنوان كمان');
  ok(/180STH/.test(r.unk), 'وبمربّع «ما تعرّفنا عليهم»');
  r = await run('سامر\n0944123456\nكود غريب QQ-77', true);
  ok(r.addr === '' && /QQ-77/.test(r.unk), 'رسالة فيها رقم وسطر مجهول بعده ⇒ ما بيصير عنوان');
  r = await run('سامر\n0944123456\nالعنوان: ضيعة بعيدة غير معروفة', true);
  ok(/ضيعة بعيدة/.test(r.addr), 'العنوان الموسوم «العنوان: …» بيضلّ يتكتب حتى لو المنطقة مو معروفة');
  r = await run('سامر\n0944123456\nحلب الفرقان', true);
  ok(/حلب/.test(r.addr), 'العنوان المعروف (حلب) بيتعبّى متل قبل');
  ok(!errs.filter(e => !/favicon|404|400|406|Failed to load/.test(e)).length, 'لا أخطاء JS');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
