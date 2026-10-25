// (25 ت1 · TASK-0179/0180) المالك seq 105–107: «بعد ما أرسل الإيصال ويتم مسحه عم يطول كثير بعد ما أكبس اعتماد وإرسال الكليشة وعم بواجه
// مشكلة في التبليغ» · «زرّ … تبليغ الشحن في حال فشل التبليغ التلقائي … اعمل طريقة يدوية» · «بعد تعديل الإيصال … يسألني نرجع نبلّغ الزبون».
// ١) التحديث الدوري بلا صور الإيصالات (ولا المفتوحة مرّتين) · الصورة تُجلب عند العرض.
// ٢) «اعتماد الشحن»: رفع الكليشة يبدأ **قبل** فتح واتساب · الضغطة حيّة ⇒ يُفتح فوراً ويُوسم · انتهت ⇒ سؤالٌ بزرّ «بلّغه الآن» ولا وسم قبله.
// ٣) ⋮ ← «📲 تبليغ الشحن» يدوياً.  ٤) إرفاق/تعديل إيصال ⇒ «نرجع نبلّغ الزبون؟» بالرقم الجديد.  ٥) لا تحديث ونافذة الشحن مفتوحة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const INIT = H.ADMIN_INIT + ` window.__opened=[]; window.open=(u)=>{ window.__opened.push({u:String(u), t:performance.now()}); return {}; };
  window.__alive=true; try{ Object.defineProperty(navigator,'userActivation',{configurable:true,get:()=>({isActive:window.__alive,hasBeenActive:true})}); }catch(e){}
  window.__f=[]; (function(){ var F=window.fetch; window.fetch=function(u,o){ window.__f.push({u:String(u&&u.url||u), m:(o&&o.method)||'GET', t:performance.now()}); return F.apply(this, arguments); }; })();`;
const dlg = (pg, re) => pg.waitForFunction(re => [...document.querySelectorAll('.gmtask-ov')].some(x => new RegExp(re).test(x.innerText)), re, { timeout: 8000 })
  .then(() => pg.evaluate(re => { const o = [...document.querySelectorAll('.gmtask-ov')].reverse().find(x => new RegExp(re).test(x.innerText)); return { text: o.innerText.replace(/\s+/g, ' '), btns: [...o.querySelectorAll('button')].map(b => b.textContent.trim()) }; }, re)).catch(() => null);
const press = (pg, re, t) => pg.evaluate(([re, t]) => { const o = [...document.querySelectorAll('.gmtask-ov')].reverse().find(x => new RegExp(re).test(x.innerText)); const b = o && [...o.querySelectorAll('button')].find(b => b.textContent.trim() === t); if (b) b.click(); return !!b; }, [re, t]);
const row = async id => (await (await fetch(H.M + '/rest/v1/gmt_orders?id=eq.' + id)).json())[0];
const IMG = 'data:image/jpeg;base64,' + Buffer.alloc(30000, 65).toString('base64');
(async () => {
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    await H.seed();
    const now = new Date().toISOString();
    const [o1, o2, o3, o4] = await H.call('/rest/v1/gmt_orders', [
      { name: 'زبون شحن ' + w, phone: '0933000971', product: 'كاميرا', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' },
      { name: 'زبون بلا ضغطة ' + w, phone: '0933000972', product: 'عدسة', qty: 1, price: 40, status: 'pending', branch: 'حلب', address: 'حمص', shipping_company: 'المفتي' },
      { name: 'زبون مشحون ' + w, phone: '0933000973', product: 'حامل', qty: 1, price: 30, status: 'shipped', branch: 'حلب', address: 'حماة', shipping_company: 'المفتي', tracking_number: '214001', shipped_at: now },
      { name: 'زبون بإيصال ' + w, phone: '0933000974', product: 'فلاش', qty: 1, price: 20, status: 'shipped', branch: 'حلب', address: 'طرطوس', shipping_company: 'المفتي', tracking_number: '214002', shipped_at: now, receipt_img: IMG, receipt_at: now }]);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, mobile: w < 500, wait: 4500, init: INIT });

    // ١) التحديث الدوري
    await pg.evaluate(() => { __f.length = 0; return loadOrders(); });
    const polls = await pg.evaluate(() => __f.filter(x => x.m === 'GET' && /\/rest\/v1\/gmt_orders\?/.test(x.u) && !/limit=1(&|$)/.test(x.u) && !/id=eq\./.test(x.u)).map(x => decodeURIComponent(x.u)));
    ok(polls.length === 2 && polls.every(u => !/select=\*/.test(u) && /select=[^&]*receipt_at/.test(u) && !/receipt_img/.test(u)), w + ': التحديث بلا صور الإيصالات (أعمدةٌ بلا receipt_img): ' + polls.map(u => u.slice(u.indexOf('?'), u.indexOf('?') + 50)).join(' | '));
    ok(polls.some(u => /status=neq\.completed/.test(u) && /created_at=lt\./.test(u)), w + ': المفتوحة القديمة وحدها في الاستعلام الثاني (لا تُجلب المفتوحة الحديثة مرّتين)');
    const st4 = await pg.evaluate(id => { const o = orders.find(x => x.id == id); return { img: !!o.receipt_img, has: hasRcpt(o), btn: !!document.querySelector('[onclick="viewReceipt(' + id + ')"]') }; }, o4.id);
    ok(!st4.img && st4.has && st4.btn, w + ': الصورة لم تُحمَّل مع القائمة لكنّ زرّ «عرض الإيصال» ظاهر: ' + JSON.stringify(st4));
    await pg.evaluate(id => viewReceipt(id), o4.id);
    await pg.waitForSelector('#receiptViewer img', { timeout: 6000 }).catch(() => {});
    const src = await pg.evaluate(() => { const i = document.querySelector('#receiptViewer img'); return i ? i.src.slice(0, 23) : ''; });
    ok(src === 'data:image/jpeg;base64,', w + ': «عرض الإيصال» يجلب الصورة عند الطلب ويعرضها: ' + src);
    await pg.evaluate(() => { const v = document.getElementById('receiptViewer'); if (v) v.remove(); return loadOrders(); });
    ok(await pg.evaluate(id => !!orders.find(x => x.id == id).receipt_img, o4.id), w + ': صورةٌ جُلبت تبقى بعد التحديث (الإيصال نفسه)');

    // ٢-أ) اعتماد الشحن والضغطة حيّة ⇒ الرفع يبدأ قبل واتساب · يُفتح فوراً · يُوسم
    const ship = (id, num, alive) => pg.evaluate(async ([id, num, alive]) => {
      await openShipModal(id);
      const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#000'; x.fillText('receipt', 40, 40);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
      window.shipReceiptFile = () => blob; window.shipPickedFiles = () => blob;
      document.getElementById('ship-tracking').value = num;
      const sf = document.getElementById('ship-from'); if (sf && !sf.value && sf.options.length > 1) sf.value = sf.options[1].value;
      __opened.length = 0; __f.length = 0; window.__alive = alive;
      await confirmShipping();
    }, [id, num, alive]);
    await ship(o1.id, '214100', true);
    await pg.waitForTimeout(700);
    let r = await pg.evaluate(() => ({ op: __opened.slice(), tg: __f.filter(x => /gmt-tg\/sendPhoto/.test(x.u)).map(x => x.t) }));
    ok(r.op.length === 1 && /0933000971|933000971/.test(decodeURIComponent(r.op[0].u)) && /214100/.test(decodeURIComponent(r.op[0].u)), w + ': الضغطة حيّة ⇒ واتساب يُفتح فوراً بتبليغ الشحن ورقمه: ' + (r.op[0] ? decodeURIComponent(r.op[0].u).slice(0, 60) : 'لم يُفتح'));
    ok(r.tg.length >= 1 && r.op.length === 1 && r.tg[0] <= r.op[0].t, w + ': رفع الكليشة لتيليغرام بدأ قبل فتح واتساب (لا ينتظره): tg=' + (r.tg[0] | 0) + ' wa=' + (r.op[0] ? r.op[0].t | 0 : '-'));
    await pg.waitForTimeout(600);
    ok(!!(await row(o1.id)).notified_ship_at, w + ': وُسم «بُلِّغ بالشحن» بعد الفتح');

    // ٢-ب) الضغطة انتهت (الحفظ طال) ⇒ سؤالٌ بزرّ · لا فتح ولا وسم قبل الضغط
    await ship(o2.id, '214200', false);
    let d = await dlg(pg, 'تبليغ الشحن');
    ok(d && /بلّغ الزبون بالشحن الآن/.test(d.text) && d.btns.includes('بلّغه الآن') && d.btns.includes('لاحقاً') && d.btns.length === 2, w + ': الضغطة انتهت ⇒ «📲 تبليغ الشحن» بزرّين: ' + (d ? d.text.slice(0, 70) + ' | ' + d.btns.join('·') : 'لا سؤال'));
    if (w === 390) await pg.screenshot({ path: '/tmp/gmt-out/ship_notify_' + w + '.png' });
    r = await pg.evaluate(() => __opened.length);
    ok(r === 0 && !(await row(o2.id)).notified_ship_at, w + ': لا فتح ولا وسم قبل ضغط الزرّ (كانت تُوسم «بُلِّغ» ولم يُبلَّغ)');
    await press(pg, 'تبليغ الشحن', 'بلّغه الآن'); await pg.waitForTimeout(700);
    r = await pg.evaluate(() => __opened.map(x => decodeURIComponent(x.u)));
    ok(r.length === 1 && /214200/.test(r[0]), w + ': «بلّغه الآن» ⇒ واتساب بتبليغ الشحن');
    ok(!!(await row(o2.id)).notified_ship_at, w + ': ⇒ وُسم بعد الفتح');

    // ٣) ⋮ ← «📲 تبليغ الشحن» يدوياً
    await pg.evaluate(() => loadOrders());
    await pg.evaluate(id => { __opened.length = 0; window.__alive = true; openCardMore(id); }, o3.id);
    const it = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.innerText.replace(/\s+/g, ' ')).find(t => /تبليغ الشحن/.test(t)) || '');
    ok(/تبليغ الشحن للزبون/.test(it), w + ': ⋮ فيها «📲 تبليغ الشحن للزبون»: ' + it.slice(0, 70));
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#card-more-ov [data-i]')].find(b => /تبليغ الشحن/.test(b.innerText)); if (b) b.click(); });
    await pg.waitForTimeout(600);
    r = await pg.evaluate(() => __opened.map(x => decodeURIComponent(x.u)));
    ok(r.length === 1 && /214001/.test(r[0]), w + ': الضغط عليه ⇒ واتساب بتبليغ الشحن برقمه: ' + (r[0] || '').slice(0, 50));
    await pg.evaluate(() => loadOrders());
    await pg.evaluate(id => openCardMore(id), o3.id);
    const it2 = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.innerText.replace(/\s+/g, ' ')).find(t => /تبليغ الشحن/.test(t)) || '');
    ok(/أُرسل ✓/.test(it2), w + ': بعد التبليغ ⇒ «أُرسل ✓ (أعد الإرسال)»: ' + it2.slice(0, 60));
    await pg.evaluate(() => { const v = document.getElementById('card-more-ov'); if (v) v.remove(); });

    // ٤) إرفاق/تعديل الإيصال ⇒ «نرجع نبلّغ الزبون؟»
    await pg.evaluate(async id => {
      await openReceiptAttach(id);
      const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 10, 10);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
      window.shipReceiptFile = () => blob; window.shipPickedFiles = () => blob;
      document.getElementById('ship-tracking').value = '214399'; __opened.length = 0;
      await confirmShipping();
    }, o3.id);
    d = await dlg(pg, 'عدّلتَ إيصال الشحن');
    ok(d && /نرجع نبلّغ الزبون/.test(d.text) && /214399/.test(d.text) && d.btns.includes('بلّغه الآن') && d.btns.includes('لا'), w + ': بعد تعديل الإيصال ⇒ «نرجع نبلّغ الزبون؟» بالرقم الجديد: ' + (d ? d.text.slice(0, 90) + ' | ' + d.btns.join('·') : 'لا سؤال'));
    await press(pg, 'عدّلتَ إيصال الشحن', 'بلّغه الآن'); await pg.waitForTimeout(600);
    r = await pg.evaluate(() => __opened.map(x => decodeURIComponent(x.u)));
    ok(r.length === 1 && /214399/.test(r[0]), w + ': «بلّغه الآن» ⇒ تبليغ الشحن بالرقم الجديد');
    await pg.evaluate(async id => { await openReceiptAttach(id); const c = document.createElement('canvas'); c.width = 30; c.height = 20;
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)); window.shipReceiptFile = () => blob; window.shipPickedFiles = () => blob;
      document.getElementById('ship-tracking').value = '214499'; __opened.length = 0; confirmShipping(); }, o3.id);
    d = await dlg(pg, 'إيصالٌ سابق|عدّلتَ إيصال الشحن');
    if (d && /إيصالٌ سابق/.test(d.text)) { await press(pg, 'إيصالٌ سابق', 'استبدال السابق بالجديد'); d = await dlg(pg, 'عدّلتَ إيصال الشحن'); }
    await press(pg, 'عدّلتَ إيصال الشحن', 'لا'); await pg.waitForTimeout(500);
    ok(d && (await pg.evaluate(() => __opened.length)) === 0, w + ': «لا» ⇒ لا تبليغ');

    // ٥) لا تحديث ونافذة الشحن مفتوحة
    const busy = await pg.evaluate(async id => { await openShipModal(id); const a = ordersPollBusy(); closeModal('shipModal'); return [a, ordersPollBusy()]; }, o1.id);
    ok(busy[0] === true && busy[1] === false, w + ': التحديث الدوري يتوقّف ونافذة الشحن مفتوحة ويعود بعد إغلاقها: ' + JSON.stringify(busy));

    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, w + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
