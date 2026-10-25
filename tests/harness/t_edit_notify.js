// (25 ت1 · TASK-0169) المالك seq 83: «لما يجري تعديل على أيّ أوردر يسألني إذا نرجع نبلّغ أو لا».
// بعد حفظ أيّ تعديل ⇒ «نرجع نبلّغ؟» · «بلّغه الآن» ⇒ آخر تبليغٍ وصل الزبون يُعاد (أو «استلام الطلب» إن لم يُبلَّغ) · «لا» ⇒ لا شيء
// · تغيّر الرقم بعد تبليغٍ سابق ⇒ «إعادة التبليغ» للرقم الجديد كما كان.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const ask = pg => pg.waitForFunction(() => [...document.querySelectorAll('.gmtask-ov')].some(x => /نرجع نبلّغ|إعادة التبليغ/.test(x.innerText)), null, { timeout: 8000 })
  .then(() => pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].reverse().find(x => /نرجع نبلّغ|إعادة التبليغ/.test(x.innerText)); return { text: o.innerText.replace(/\s+/g, ' '), btns: [...o.querySelectorAll('button')].map(b => b.textContent.trim()) }; })).catch(() => null);
const press = (pg, t) => pg.evaluate(t => { const o = [...document.querySelectorAll('.gmtask-ov')].reverse().find(x => /نرجع نبلّغ|إعادة التبليغ/.test(x.innerText)); const b = o && [...o.querySelectorAll('button')].find(b => b.textContent.trim() === t); if (b) b.click(); return !!b; }, t);
(async () => {
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    await H.seed();
    const [oNew, oShip, oPh] = await H.call('/rest/v1/gmt_orders', [
      { name: 'زبون جديد ' + w, phone: '0933000951', product: 'كاميرا', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' },
      { name: 'زبون مشحون ' + w, phone: '0933000952', product: 'عدسة', qty: 1, price: 40, status: 'shipped', branch: 'حلب', address: 'حمص', shipping_company: 'المفتي', tracking_number: '123456', notified_ship_at: new Date().toISOString() },
      { name: 'زبون رقم ' + w, phone: '0933000953', product: 'حامل', qty: 1, price: 30, status: 'pending', branch: 'حلب', address: 'حماة', shipping_company: 'المفتي', notified_ship_at: new Date().toISOString() }]);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, mobile: w < 500, wait: 4500 });
    await pg.evaluate(() => { window.__calls = []; window.notifyOrderReceived = async o => { __calls.push(['received', o.id]); }; window.shareOrder = (id, mode) => { __calls.push(['share', id, mode]); }; });
    const edit = (id, f) => pg.evaluate(async ({ id, f }) => { await loadOrders(); await openEditModal(id); document.getElementById('edit-name').value += ' م'; if (f) document.getElementById('edit-phone').value = f; document.getElementById('saveEditBtn').click(); }, { id, f });
    // ١) لم يُبلَّغ بعد ⇒ «تبليغ استلام الطلب» · «بلّغه الآن» ⇒ يُرسَل
    await edit(oNew.id);
    let d = await ask(pg);
    ok(d && /نرجع نبلّغ الزبون بالتعديل/.test(d.text) && /تبليغ استلام الطلب/.test(d.text) && d.btns.includes('بلّغه الآن') && d.btns.includes('لا'), w + ': تعديلٌ ⇒ «نرجع نبلّغ؟» (استلام الطلب) بخيارين: ' + (d ? d.text.slice(0, 90) + ' | ' + d.btns.join('·') : 'لا سؤال'));
    if (w === 390) await pg.screenshot({ path: '/tmp/gmt-out/edit_notify_' + w + '.png' });
    await press(pg, 'بلّغه الآن'); await pg.waitForTimeout(400);
    let c = await pg.evaluate(() => __calls.splice(0));
    ok(c.length === 1 && c[0][0] === 'received' && c[0][1] == oNew.id, w + ': «بلّغه الآن» ⇒ تبليغ استلام الطلب بالتفاصيل الجديدة: ' + JSON.stringify(c));
    // ٢) بُلّغ بالشحن ⇒ يُعاد «تبليغ الشحن» · «لا» ⇒ لا شيء
    await edit(oShip.id);
    d = await ask(pg);
    ok(d && /تبليغ الشحن/.test(d.text), w + ': أوردرٌ بُلّغ بشحنه ⇒ السؤال عن «تبليغ الشحن»: ' + (d ? d.text.slice(0, 80) : 'لا سؤال'));
    await press(pg, 'لا'); await pg.waitForTimeout(400);
    c = await pg.evaluate(() => __calls.splice(0));
    ok(c.length === 0, w + ': «لا» ⇒ لا تبليغ');
    await edit(oShip.id); d = await ask(pg); await press(pg, 'بلّغه الآن'); await pg.waitForTimeout(400);
    c = await pg.evaluate(() => __calls.splice(0));
    ok(c.length === 1 && c[0][0] === 'share' && c[0][2] === 'shipped', w + ': «بلّغه الآن» ⇒ تبليغ الشحن من جديد: ' + JSON.stringify(c));
    // ٣) تغيّر الرقم بعد تبليغ ⇒ «إعادة التبليغ» للرقم الجديد (كما كان)
    await edit(oPh.id, '0933000999');
    d = await ask(pg);
    ok(d && /تغيّر رقم الزبون/.test(d.text) && /0933000999/.test(d.text) && d.btns.includes('أرسله الآن'), w + ': رقمٌ جديد ⇒ «إعادة التبليغ» للرقم الجديد: ' + (d ? d.text.slice(0, 80) : 'لا سؤال'));
    await press(pg, 'لاحقاً');
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, w + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
