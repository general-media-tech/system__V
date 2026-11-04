// TASK-0317 — الحجز: رسالة الإنشاء + صورة محفوظة + هوية إيصال الأوردر + الشروط
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    await H.seed(); await H.call('/__opts', { reject_cols: [], rls_block: [] });
    const [R] = await H.call('/rest/v1/gmt_reservations', [{ name: 'سامر', phone: '0933000031', address: 'حلب', item: 'عدسة Canon RF 50mm', qty: 1, items_json: JSON.stringify([{ name: 'عدسة Canon RF 50mm', qty: 1 }]), full_price: 300, deposit: 100, remaining: 200, status: 'reserved', notes: 'لون أسود' }]);
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, h: 900, wait: 4000, init: H.ADMIN_INIT + ' window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return {};};' });
    await pg.evaluate(async () => { await openReservationsPanel(); });
    await pg.waitForTimeout(600);
    await pg.evaluate(() => { window.__blobCalls = 0; window.sheetToBlob = async () => { window.__blobCalls++; return new Blob(['x'], { type: 'image/jpeg' }); }; });
    const html = await pg.evaluate((id) => buildResSheetHTML(reservations.find(x => x.id == id), false), R.id);
    ok(/فاتورة حجز مبدئية/.test(html) && /class="hd"/.test(html) && /class="serial"[^>]*>حجز #/.test(html), 'الورقة بترويسة إيصال الأوردر (.hd) ورقم «حجز #»');
    ok(/المتبقي عند الاستلام<\/span><br><span class="v">\$200\.00/.test(html), 'البطاقة الحمراء: المتبقي عند الاستلام $200.00');
    ok(/class="rb rd"><span class="l">العربون المدفوع<\/span><b>\$100/.test(html) && /الإجمالي<\/span><b>\$300/.test(html), 'صناديق الإجمالي $300 · العربون $100');
    ok(/شروط وأحكام الحجز/.test(html) && (html.match(/<li>/g) || []).length >= 10 && /توقيع العميل/.test(html), 'الشروط والأحكام (10 بنود) + خانة التوقيع');
    ok(!/عند الاستلام:<\/h4>/.test(html) && !/class="frag"/.test(html), 'حُذف تنبيه شحن الأوردر (الاستلام/الكسر) من ورقة الحجز');
    ok(/>تاريخ الحجز</.test(html) && /📌 محجوز/.test(html), 'تسميات البطاقة: تاريخ الحجز · الحالة محجوز');
    const txt = await pg.evaluate((id) => resNewText(reservations.find(x => x.id == id)), R.id);
    ok(/تم تسجيل حجزك رقم/.test(txt) && /الإجمالي: \$300/.test(txt) && /دفعتَ عربوناً: \$100/.test(txt) && /المتبقي عند الاستلام: \$200/.test(txt), 'رسالة الإنشاء: حجزت ودفعت $100 والمتبقي $200');
    // الإنشاء: يُبلِّغ ثم يحفظ الصورة
    await pg.evaluate(async (id) => {
      window.notifyWithSheet = async () => { window.__notified = (window.__notified || 0) + 1; return true; };
      await notifyResCreated(reservations.find(x => x.id == id));
    }, R.id);
    await pg.waitForTimeout(400);
    const r1 = (await H.call('/rest/v1/gmt_reservations?id=eq.' + R.id, undefined, 'GET'))[0];
    ok(await pg.evaluate(() => window.__notified === 1) && !!r1.notified_new_at, 'notifyResCreated يُبلِّغ ويوسم notified_new_at');
    const url = await pg.evaluate((id) => saveResReceipt(reservations.find(x => x.id == id)), R.id);
    const r2 = (await H.call('/rest/v1/gmt_reservations?id=eq.' + R.id, undefined, 'GET'))[0];
    ok((await pg.evaluate(() => window.__blobCalls)) >= 1, 'saveResReceipt يرسم الصورة');
    ok(!url || /reservations\/res-/.test(url), 'مسار الحفظ reservations/res-<id>.jpg (الرفع مع القاعدة الوهمية: ' + (url ? 'نجح' : 'لا تخزين في الوهمية') + ')');
    ok(await pg.evaluate((id) => /viewResReceipt\(/.test(resCardHTML(reservations.find(x => x.id == id))), R.id), 'بطاقة الحجز فيها زرّ 🖼️ صورة الحجز');
    // تبليغ الوصول
    await pg.evaluate((id) => { reservations.find(x => x.id == id).status = 'arrived'; }, R.id);
    ok(await pg.evaluate((id) => /notifyResArrived\(/.test(resCardHTML(reservations.find(x => x.id == id))), R.id), 'بعد «وصلت»: زرّ «📲 بلّغ الزبون» على بطاقة الحجز');
    ok(!errs.filter(e => !/favicon|net::ERR|Failed to load resource/.test(e)).length, 'لا أخطاء JS: ' + errs.slice(0, 3).join(' | '));
    await browser.close();
  }
  console.log('\n' + pass + ' ✔ · ' + fails + ' ✘'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
