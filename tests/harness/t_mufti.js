// اختبار: زرّ التحقق من الشحنة (المفتي) + الفرع المُرسِل + كليشة الحوالة + التبليغ المباشر لطلب جديد (بلا مُنتقي مشاركة)
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  await H.seed();
  const rows = await H.call('/rest/v1/gmt_orders', [
    { name: 'خالد المستلِم', phone: '0933111444', product: 'كاميرا', qty: 1, price: 250, collect_amount: 230, status: 'delivered', branch: 'حلب', address: 'دمشق — البرامكة · شارع سانا ☎ 0965112158', shipping_company: 'المفتي', tracking_number: '1966820', shipped_at: '2026-10-10T09:00:00Z' },
    { name: 'سامر مسارات', phone: '0933111333', product: 'كاميرا', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'حمص', shipping_company: 'مسارات', tracking_number: '555123' }]);
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT + ' window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return {};}; Object.defineProperty(navigator,"userAgent",{get:()=>"Mozilla/5.0 (Linux; Android 13) Chrome/120"}); window.__shared=0; navigator.share=async()=>{window.__shared++}; navigator.canShare=()=>true;', w: 390, h: 900, wait: 5000 });
  // ١) الزرّ العلوي موجود
  ok(await pg.evaluate(() => !![...document.querySelectorAll('button')].find(b => /openMuftiSite/.test(b.getAttribute('onclick') || '') && /التحقق من الشحنة/.test(b.textContent))), 'زرّ «التحقق من الشحنة» العلوي موجود');
  // (18 ت1 · لقطة المالك ٣) الزرّ العلوي يفتح موقع المفتي مباشرةً — بلا نافذة ولا قائمة أوردرات
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /openMuftiSite/.test(b.getAttribute('onclick') || '')); b.click(); });
  const top = await pg.evaluate(() => ({ u: window.__opened.slice(-1)[0] || '', modal: !document.getElementById('verifyShipModal').classList.contains('hidden') }));
  ok(/^https?:\/\//.test(top.u) && !top.modal, 'الزرّ العلوي فتح رابط المفتي مباشرةً بلا نافذة: ' + top.u);
  // ٢) نافذة التحقق: بحث بالرقم
  await pg.evaluate(() => openVerifyShipment());
  await pg.fill('#vs-num', '1966820');
  const html = await pg.evaluate(() => document.getElementById('vs-result').innerText);
  ok(/خالد المستلِم/.test(html), 'البحث بالرقم يجد الأوردر المطابق');
  ok(await pg.evaluate(() => !!document.querySelector('#vs-result select')), 'اختيار الفرع المُرسِل ظاهر لأوردر المفتي');
  const sel = await pg.evaluate(() => document.querySelector('#vs-result select').value);
  ok(sel === 'حلب|السريان', 'الافتراضي «حلب|السريان» — القيمة: ' + sel);
  await pg.fill('#vs-num', '555123');
  const h2 = await pg.evaluate(() => document.getElementById('vs-result').innerText);
  console.log('   h2=', JSON.stringify(h2.slice(0,200)));
  ok(/على شركة «مسارات» لا المفتي/.test(h2) && /مسارات/.test(h2), 'أوردر شركةٍ غير المفتي يُحذَّر منه');
  ok(await pg.evaluate(() => !document.querySelector('#vs-result select')), 'لا فرع مُرسِل لغير المفتي');
  // ٣) مراسلة الفرع المُرسِل: رقم السريان + الكليشة
  await pg.evaluate((id) => contactSendingBranch(id), rows[0].id);
  const url = decodeURIComponent(await pg.evaluate(() => window.__opened.slice(-1)[0] || ''));
  ok(/963965112165/.test(url), 'الرقم هو مكتب السريان (0965112165): ' + (url.match(/phone=\d+/) || [''])[0]);
  ok(/w4b/.test(url), 'يستهدف واتساب بزنس');
  ok(/أ\. محمد من القسم المالي/.test(url) && /مبعوث بتاريخ: 10\/10\/2026/.test(url) && /الوجهة: دمشق — البرامكة/.test(url) && /اسم المستلم: خالد/.test(url) && /الحوالة: \$230/.test(url), 'الكليشة تحوي التاريخ والوجهة والمستلم والحوالة (المطلوب تحصيله 230 لا 250)');
  ok(!/☎|شارع سانا/.test(url.split('الوجهة')[1].split('\n')[0]), 'الوجهة بلا هاتف ولا تفاصيل الشارع');
  // ٤) تغيير الفرع المُرسِل يُحفظ ويُستعمل
  await pg.evaluate((id) => setShipFrom(id, 'حماة|السلمية'), rows[0].id);
  await pg.waitForTimeout(500);
  await pg.evaluate((id) => contactSendingBranch(id), rows[0].id);
  const url2 = decodeURIComponent(await pg.evaluate(() => window.__opened.slice(-1)[0] || ''));
  ok(/963965112145/.test(url2), 'بعد التغيير يراسل السلمية (0965112145)');
  const db = await H.call('/rest/v1/gmt_orders?id=eq.' + rows[0].id, undefined, 'GET');
  ok(db && db[0] && db[0].ship_from_office === 'حماة|السلمية', 'حُفظ في القاعدة: ' + (db && db[0] && db[0].ship_from_office));
  // ٥) مكتبٌ بلا رقم ⇒ لا يفتح محادثةً برقم مخترَع
  const n0 = await pg.evaluate(() => window.__opened.length);
  await pg.evaluate((id) => setShipFrom(id, 'حلب|كراج الراموسة'), rows[0].id);
  await pg.evaluate((id) => contactSendingBranch(id), rows[0].id);
  ok(await pg.evaluate((n) => window.__opened.length === n, n0), 'مكتب بلا رقم ⇒ لا تُفتح محادثة (تنبيه صريح)');
  await pg.evaluate(() => { document.querySelectorAll('.fixed').forEach(e => { if (/GMTAsk|ask/i.test(e.className + e.id)) e.remove(); }); });
  // ٦) زرّ الحوالة على بطاقة المفتي بعد الاستلام فقط
  await pg.evaluate(() => closeModal('verifyShipModal'));
  const btns = await pg.evaluate(() => [...document.querySelectorAll('button[onclick^="contactSendingBranch"]')].map(b => b.getAttribute('onclick')));
  ok(btns.length === 1 && btns[0].includes(String(rows[0].id)), 'زرّ «الحوالة» على بطاقة المفتي المستلَمة فقط: ' + btns.join());
  // ٧) نافذة الشحن: الفرع المُرسِل يظهر للمفتي فقط
  await pg.evaluate((id) => openShipModal(id), rows[1].id);
  // (TASK-0159) لمسارات خانة «الفرع المصدر» من بنك أفرعها — وافتراضيّها من الإعدادات «حلب|الفرقان» (seq 73) لا «السريان» — وشركةٌ لا يُقرأ إيصالها ⇒ لا خانة
  const msr = await pg.evaluate(() => ({ shown: !document.getElementById('ship-from-wrap').classList.contains('hidden'), v: document.getElementById('ship-from').value, src: document.getElementById('ship-from').getAttribute('data-src'), co: document.getElementById('ship-from').getAttribute('data-co'), lab: document.querySelector('#ship-from-wrap label').textContent }));
  ok(msr.shown && msr.v === 'حلب|الفرقان' && msr.src === 'default' && msr.co === 'مسارات' && /الفرع المصدر/.test(msr.lab), 'مسارات ⇒ «الفرع المصدر» من فروع مسارات وافتراضيّها حلب|الفرقان: ' + JSON.stringify(msr));
  await pg.evaluate(() => { const s = document.getElementById('ship-company'); s.value = [...s.options].map(o => o.value).find(v => v && ['المفتي', 'القدموس', 'مسارات'].indexOf(v) === -1); s.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(await pg.evaluate(() => document.getElementById('ship-from-wrap').classList.contains('hidden')), 'شركةٌ لا يُقرأ إيصالها ⇒ لا اختيار فرع مُرسِل');
  await pg.selectOption('#ship-company', 'المفتي');
  ok(await pg.evaluate(() => !document.getElementById('ship-from-wrap').classList.contains('hidden') && document.getElementById('ship-from').value === 'حلب|السريان'), 'المفتي ⇒ يظهر والافتراضي حلب|السريان');
  // ٧ب) اعتماد الشحن للمفتي يحفظ الفرع المُرسِل المختار (ويُكمل الشحن)
  await pg.selectOption('#ship-from', 'دمشق|البرامكة');
  await pg.fill('#ship-tracking', '777888');
  await pg.evaluate(() => confirmShipping());
  await pg.waitForTimeout(1500);
  const sh = await H.call('/rest/v1/gmt_orders?id=eq.' + rows[1].id, undefined, 'GET');
  ok(sh && sh[0] && sh[0].status === 'shipped' && sh[0].shipping_company === 'المفتي' && sh[0].tracking_number === '777888', 'الشحن اكتمل بشركة المفتي والرقم');
  ok(sh && sh[0] && sh[0].ship_from_office === 'دمشق|البرامكة', 'الفرع المُرسِل المختار حُفظ: ' + (sh && sh[0] && sh[0].ship_from_office));
  // ٨) التبليغ المباشر لطلب جديد: لا navigator.share ويُفتح واتساب مباشرة
  const r = await pg.evaluate(async () => {
    window.__opened.length = 0; window.__shared = 0;
    const o = { id: 999, name: 'زبون جديد', phone: '0933222111', address: 'دمشق', price: 50 };
    await notifyWithSheet(o, '<div>x</div>', 'order-999', 'نص تجريبي');
    return { shared: window.__shared, opened: window.__opened.length, url: decodeURIComponent(window.__opened[0] || '') };
  });
  ok(r.shared === 0, 'التبليغ الجديد لا يفتح مُنتقي المشاركة (navigator.share مرّات: ' + r.shared + ')');
  ok(r.opened === 1 && /963933222111/.test(r.url) && /w4b/.test(r.url), 'تُفتح محادثة الزبون في واتساب بزنس مباشرةً');
  console.log('errors:', errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 4));
  await browser.close();
  console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
