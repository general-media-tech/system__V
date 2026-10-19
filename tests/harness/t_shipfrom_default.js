// اختبار (١٨ ت1 · التعديل الإلزامي): أولويّة الفرع المُرسِل (يدويّ > مكتشَف موثوق > الافتراضي من الإعدادات > طلب الاختيار)
// + إعداد «الفرع الافتراضي لشركة الشحن» في القاعدة · يسري على الجديدة فقط · افتراضيٌّ غير صالح ⇒ تنبيه لا فرعٌ عشوائي
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const KEY = 'orders_default_ship_from';

async function setting(v) {
  await H.call('/rest/v1/gmt_settings?key=eq.' + KEY, undefined, 'DELETE').catch(() => {});
  if (v) await H.call('/rest/v1/gmt_settings', { key: KEY, value: v });
}
async function dbOrder(id) { return (await H.call('/rest/v1/gmt_orders?id=eq.' + id, undefined, 'GET'))[0]; }

(async () => {
  await H.seed();
  await setting('حلب|السريان');
  const base = { phone: '0933', product: 'كاميرا', qty: 1, price: 100, branch: 'حلب', address: 'حمص', shipping_company: 'المفتي' };
  const rows = await H.call('/rest/v1/gmt_orders', [
    { ...base, name: 'جديد بلا فرع', phone: '0933000001', status: 'pending' },
    { ...base, name: 'مشحون قديم بلا فرع', phone: '0933000002', status: 'shipped', tracking_number: '9100001', shipped_at: '2026-10-10T09:00:00Z' },
    { ...base, name: 'مشحون من الفرقان', phone: '0933000003', status: 'shipped', tracking_number: '9100002', shipped_at: '2026-10-11T09:00:00Z', ship_from_office: 'حلب|الفرقان' },
    { ...base, name: 'جديد ثانٍ', phone: '0933000004', status: 'pending' },
    { ...base, name: 'جديد ثالث', phone: '0933000005', status: 'pending' },
    { ...base, name: 'جديد للكمبيوتر', phone: '0933000006', status: 'pending' }]);
  const [o1x, o2, o3, o4, o5, o6] = rows.map(r => r.id);
  /* القاعدة الوهمية: 400 = فحص gmt-selfcheck لدالّة add_branch_stock (لا تنفّذها) · 503 = مرحّل تيليغرام «غير مضبوط» عمداً في h.js */
  const own = errs => errs.filter(e => !/status of (400 \(Bad Request\)|503 \(Service Unavailable\))/.test(e));

  for (const [w, h] of [[390, 844], [1366, 768]]) {
    console.log(`— ${w}×${h}`);
    const o1 = w === 390 ? o1x : o6;
    await setting('حلب|السريان');
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4500 });
    const box = () => pg.evaluate(() => { const s = document.getElementById('ship-from'); return { v: s.value, src: s.getAttribute('data-src'), msg: document.getElementById('ship-from-src').innerText, cands: [...document.querySelectorAll('[data-shipfrom-pick]')].map(b => b.getAttribute('data-shipfrom-pick')) }; });
    const openShip = async id => { await pg.evaluate(id => { closeModal && document.getElementById('shipModal').classList.add('hidden'); openShipModal(id); document.getElementById('ship-company').value = 'المفتي'; document.getElementById('ship-company').dispatchEvent(new Event('change', { bubbles: true })); window.syncShipFromBox(shipFromExplicit(orders.find(o => o.id == id)), true); }, id); await pg.waitForTimeout(500); };

    // ٣) لا اختيار ولا إيصال ⇒ الافتراضي من الإعدادات
    await openShip(o1);
    let b = await box();
    ok(b.v === 'حلب|السريان' && b.src === 'default', 'أوردر جديد ⇒ الافتراضي من الإعدادات «السريان»: ' + b.v + ' · ' + b.src);
    ok(/الافتراضي من إعدادات الأوردرات/.test(b.msg), 'السطر يقول مصدر الفرع: ' + b.msg.slice(0, 50));

    // ٢) إيصالٌ موثوق مصدره فرعٌ غير السريان ⇒ يُعتمد المكتشف
    let r = await pg.evaluate(() => applyDetectedShipFrom({ key: 'حلب|الفرقان', confident: true, text: 'المصدر: حلب-الفرقان' }));
    b = await box();
    ok(r === 'applied' && b.v === 'حلب|الفرقان' && b.src === 'receipt', 'إيصال موثوق من الفرقان ⇒ اعتُمد الفرقان لا السريان');
    r = await pg.evaluate(() => applyDetectedShipFrom({ key: 'حمص|جورة الشياح', confident: true, text: 'حمص' }));
    ok(r === 'applied' && (await box()).v === 'حمص|جورة الشياح', 'إيصال موثوق من خارج حلب ⇒ يُعتمد (لا تُفرض حلب)');

    // ٤) اكتشافٌ غير مؤكّد ⇒ لا يُعتمد، يُعرض مع المرشّحين، ويبقى الافتراضي إن لم تختر
    await openShip(o1);
    r = await pg.evaluate(() => applyDetectedShipFrom({ key: 'حلب|شارع بارون', confident: false, candidates: ['حلب|شارع بارون', 'حلب|الفرقان'], text: 'حلب-ال؟؟' }));
    b = await box();
    ok(r === 'unsure' && b.v === 'حلب|السريان', 'غير مؤكّد ⇒ لم يُعتمد التخمين وبقي الافتراضي: ' + b.v);
    ok(/تعذر التأكد من فرع الشحن المصدر/.test(b.msg) && b.cands.length === 2, 'رسالة عدم التأكّد + مرشّحان للاختيار');
    await pg.click('[data-shipfrom-pick="حلب|الفرقان"]');
    b = await box();
    ok(b.v === 'حلب|الفرقان' && b.src === 'manual', 'تصحيح المستخدم من المرشّحين ⇒ اختياره');

    // ١) اختيارٌ يدويّ لا يُستبدل بالمكتشف ولا بالافتراضي
    await openShip(o1);
    await pg.selectOption('#ship-from', 'حماة|ساحة العاصي');
    r = await pg.evaluate(() => applyDetectedShipFrom({ key: 'حلب|الفرقان', confident: true, text: 'حلب-الفرقان' }));
    b = await box();
    ok(r === 'manual-kept' && b.v === 'حماة|ساحة العاصي' && b.src === 'manual', 'يدويّ ثمّ إيصال موثوق ⇒ بقي اختيار المستخدم');

    if (w === 390) {
      // اعتماد الشحن يحفظ اختيار المستخدم
      await pg.fill('#ship-tracking', '5500771');
      await pg.evaluate(() => confirmShipping()); await pg.waitForTimeout(2500);
      const d1 = await dbOrder(o1);
      ok(d1.status === 'shipped' && d1.ship_from_office === 'حماة|ساحة العاصي', 'اعتماد الشحن حفظ الفرع اليدويّ في القاعدة: ' + d1.ship_from_office);

      // ما يفتحه اعتماد الشحن بعده (سؤال الإرسال للزبون…) يُغلق كما يفعل المستخدم
      const asked = await pg.evaluate(() => [...document.querySelectorAll('.gmtask-ov')].map(o => o.innerText.replace(/\s+/g, ' ').slice(0, 90)));
      console.log('    (نوافذ بعد الشحن: ' + JSON.stringify(asked) + ')');
      for (let i = 0; i < 4 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
      // تغيير الافتراضي من الإعدادات ⇒ للجديدة فقط
      await pg.evaluate(() => openOrdersSettings()); await pg.waitForTimeout(800);
      const dlg = await pg.evaluate(() => { const d = document.querySelector('#orders-settings [role=dialog]'); const r = d.getBoundingClientRect(); return { v: document.getElementById('os-ship-from').value, fit: r.left >= 0 && r.right <= innerWidth + 1 }; });
      ok(dlg.v === 'حلب|السريان' && dlg.fit, 'نافذة ⚙️ إعدادات الأوردرات تعرض الحالي «السريان» وتتّسع للشاشة');
      await pg.selectOption('#os-ship-from', 'حلب|الفرقان'); await pg.click('#os-save'); await pg.waitForTimeout(1200);
      const st = await H.call('/rest/v1/gmt_settings?key=eq.' + KEY, undefined, 'GET');
      ok(st[0] && st[0].value === 'حلب|الفرقان', 'الإعداد حُفظ في القاعدة: ' + (st[0] && st[0].value));
      await openShip(o4);
      b = await box();
      ok(b.v === 'حلب|الفرقان' && b.src === 'default', 'أوردر جديد بعد التغيير ⇒ الافتراضي الجديد «الفرقان»');
      const old = await pg.evaluate(ids => ids.map(id => shipFromOf(orders.find(o => o.id == id))), [o2, o3, o1]);
      ok(old[0] === 'حلب|السريان', 'مشحون قديم بلا فرعٍ محفوظ بقي «السريان» (لم يتغيّر بأثر رجعي)');
      ok(old[1] === 'حلب|الفرقان' && old[2] === 'حماة|ساحة العاصي', 'الفروع المحفوظة على الأوردرات السابقة لم تتغيّر');
      const d2 = await dbOrder(o2);
      ok(!d2.ship_from_office, 'القاعدة: لم يُكتب شيء على الأوردر القديم');
    }
    ok(!own(errs).length, 'لا أخطاء JS ' + own(errs).join(' | '));
    await browser.close();
  }

  console.log('— افتراضيٌّ لم يعد في دليل الفروع');
  await setting('حلب|فرعٌ غير موجود');
  {
    const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 4500 });
    await pg.evaluate(id => { openShipModal(id); document.getElementById('ship-company').value = 'المفتي'; window.syncShipFromBox(null, true); }, o5);
    await pg.waitForTimeout(600);
    const b = await pg.evaluate(() => ({ v: document.getElementById('ship-from').value, msg: document.getElementById('ship-from-src').innerText }));
    ok(b.v === '' && /لم يعد في دليل فروع المفتي/.test(b.msg), 'افتراضيٌّ غير صالح ⇒ لا فرعٌ عشوائي + تنبيهٌ واضح: ' + b.msg.slice(0, 60));
    await pg.fill('#ship-tracking', '5500772');
    await pg.evaluate(() => confirmShipping()); await pg.waitForTimeout(1500);
    const d5 = await dbOrder(o5);
    ok(d5.status === 'pending' && !d5.ship_from_office, 'اعتماد الشحن رُفض حتى يُختار الفرع (لا كتابة في القاعدة)');
    await setting(null);
    await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4000);
    await pg.evaluate(id => { openShipModal(id); document.getElementById('ship-company').value = 'المفتي'; window.syncShipFromBox(null, true); }, o5);
    await pg.waitForTimeout(800);
    const c = await pg.evaluate(() => ({ v: document.getElementById('ship-from').value, msg: document.getElementById('ship-from-src').innerText }));
    ok(c.v === '' && /لم يُحدَّد «الفرع الافتراضي لشركة الشحن»/.test(c.msg), 'لا إعداد ⇒ نطلب الاختيار: ' + c.msg.slice(0, 60));
    ok(!own(errs).length, 'لا أخطاء JS ' + own(errs).join(' | '));
    await browser.close();
  }
  await setting('حلب|السريان');
  console.log(fails ? `FAIL=${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
