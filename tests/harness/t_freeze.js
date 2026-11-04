// TASK-0316 — تجميد الأوردرات + تبليغ وصول المنتجات/القطعة المحجوزة (المالك seq 493)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/__opts', { reject_cols: [], rls_block: [] });
    const rows = await H.call('/rest/v1/gmt_orders', [
      { name: 'عادي', phone: '0933000021', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', transfer_invoice_no: 'TRF-1' },
      { name: 'مجمّد جاهز', phone: '0933000022', product: 'عدسة', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'حمص', frozen_at: '2026-11-01T10:00:00Z', freeze_info: { reason: 'بانتظار الحوالة', by: 'تجربة' } }]);
    const [N, F] = rows.map(r => r.id);
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, h: 900, wait: 4500, init: H.ADMIN_INIT + ' window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return {};};' });
    const txt = (sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : null; }, sel);
    // المجمَّد في تبويبه وحده
    ok(await pg.evaluate((id) => !!document.querySelector('#list-frozen #card-' + id), F), 'المجمَّد يظهر في قائمة «مجمّدة»');
    ok(await pg.evaluate((id) => !document.querySelector('#list-pending #card-' + id), F), 'المجمَّد لا يظهر في «قيد التجهيز»');
    ok(await pg.evaluate((id) => !!document.querySelector('#list-pending #card-' + id), N), 'العادي يبقى في «قيد التجهيز»');
    ok((await txt('#badge-frozen')) === '1' && (await txt('#badge-pending')) === '1', 'العدّادات: مجمّدة 1 · قيد التجهيز 1');
    const card = await txt('#card-' + F);
    ok(/مجمَّد/.test(card) && /بانتظار الحوالة/.test(card) && /فكّ التجميد/.test(card) && !/إرسال للشحن/.test(card), 'بطاقة المجمَّد: شارة + السبب + «فكّ التجميد» بلا «إرسال للشحن»');
    // الشحن ممنوع
    await pg.evaluate((id) => openShipModal(id), F);
    ok(await pg.evaluate(() => document.getElementById('shipModal').classList.contains('hidden')), 'openShipModal على المجمَّد لا يفتح نافذة الشحن');
    // تبليغ التجميد: واتساب + رسالة المحتوى + الوسم
    await pg.evaluate((id) => notifyOrderFrozen(id), F); await pg.waitForTimeout(500);
    let op = await pg.evaluate(() => window.__opened.slice());
    const dec = op.map(u => decodeURIComponent(u));
    ok(op.length === 1 && /تم تجميد أوردرك/.test(dec[0]) && /راجع|مراجعة بياناتك أو مراجعة دفعاتك/.test(dec[0]) && /بانتظار الحوالة/.test(dec[0]), 'رسالة التجميد: «تم تجميد أوردرك… بياناتك أو دفعاتك…» + السبب');
    const f1 = (await H.call('/rest/v1/gmt_orders?id=eq.' + F, undefined, 'GET'))[0];
    ok(f1.freeze_info && f1.freeze_info.notified_at, 'وُسم «بُلِّغ» في freeze_info بعد الفتح');
    // فكّ التجميد
    await pg.evaluate((id) => { window.GMTAsk.confirm = async () => true; thawOrder(id); }, F); await pg.waitForTimeout(700);
    ok(await pg.evaluate((id) => !!document.querySelector('#list-pending #card-' + id), F), 'بعد الفكّ يعود إلى «قيد التجهيز»');
    const f2 = (await H.call('/rest/v1/gmt_orders?id=eq.' + F, undefined, 'GET'))[0];
    ok(!f2.frozen_at && f2.freeze_info && f2.freeze_info.thawed_at, 'القاعدة: frozen_at فارغ + thawed_at مسجَّل');
    // تجميد من القائمة ⋮ على العادي
    await pg.evaluate(() => { window.GMTAsk.prompt = async () => 'بانتظار دفعة الأردن'; window.GMTAsk.choose = async () => 'later'; });
    await pg.evaluate((id) => openCardMore(id), N); await pg.waitForTimeout(250);
    const m = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    ok(m.some(t => /تجميد الأوردر/.test(t)) && m.some(t => /تبليغ وصول المنتجات/.test(t)), '⋮ للعادي: «تجميد الأوردر» + «تبليغ وصول المنتجات» (مرتبط بفاتورة نقل): ' + m.join(' | '));
    await pg.evaluate(() => document.querySelector('#card-more-ov [data-x]').click());
    await pg.evaluate((id) => freezeOrder(id), N); await pg.waitForTimeout(800);
    ok(await pg.evaluate((id) => !!document.querySelector('#list-frozen #card-' + id), N), 'تجميد العادي من القائمة ⇒ ينتقل إلى «مجمّدة»');
    const n1 = (await H.call('/rest/v1/gmt_orders?id=eq.' + N, undefined, 'GET'))[0];
    ok(n1.frozen_at && n1.freeze_info.reason === 'بانتظار دفعة الأردن', 'القاعدة: السبب المدخَل محفوظ');
    // تبليغ وصول المنتجات يرفض المجمَّد
    await pg.evaluate(() => { window.__opened.length = 0; });
    await pg.evaluate((id) => notifyGoodsArrived(id), N);
    ok((await pg.evaluate(() => window.__opened.length)) === 0, 'تبليغ وصول المنتجات لا يُرسَل لأوردرٍ مجمَّد');
    // فكّ ثم تبليغ الوصول: «قيد الشحن خلال 24 ساعة»
    await pg.evaluate((id) => thawOrder(id), N); await pg.waitForTimeout(600);
    await pg.evaluate((id) => notifyGoodsArrived(id), N); await pg.waitForTimeout(500);
    const dg = (await pg.evaluate(() => window.__opened.slice())).map(u => decodeURIComponent(u));
    ok(dg.length === 1 && /قيد الشحن خلال 24 ساعة/.test(dg[0]) && /وصلت/.test(dg[0]), 'رسالة الوصول: «وصلت… قيد الشحن خلال 24 ساعة»');
    ok(!!(await H.call('/rest/v1/gmt_orders?id=eq.' + N, undefined, 'GET'))[0].notified_goods_at, 'وُسم notified_goods_at');
    // الطباعة الجماعية تستثني المجمَّد
    await pg.evaluate((id) => freezeOrder(id), N); await pg.waitForTimeout(700);
    ok(await pg.evaluate((id) => !unshippedOrders().some(o => o.id == id), N), 'الطباعة الجماعية «غير المشحون» تستثني المجمَّد');
    // نموذج الإضافة: خانة التجميد موجودة ومنطق السبب
    ok(await pg.evaluate(() => !!document.getElementById('in-freeze') && document.getElementById('in-freeze-reason').classList.contains('hidden')), 'نموذج الإضافة: خانة «أنشئه مجمَّداً» + السبب مخفيّ افتراضياً');
    ok(!errs.filter(e => !/favicon|net::ERR|Failed to load resource/.test(e)).length, 'لا أخطاء JS: ' + errs.slice(0, 3).join(' | '));
    await browser.close();
  }
  console.log('\n' + pass + ' ✔ · ' + fails + ' ✘'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
