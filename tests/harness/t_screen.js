const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const audit = async () => ((await H.call('/__dump', undefined, 'GET')).gmt_audit || []);
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [
    { name: 'بطارية كانون LP-E6NH', barcode: '7777000001', price: 60, haleb: 5, daraa: 2, group_name: 'بطاريات', category: 'إكسسوار', store_url: 'https://shop.example/lp-e6nh' },
    { name: 'بطارية كانون LP-E17', barcode: '7777000002', price: 45, haleb: 0, daraa: 0, group_name: 'بطاريات', category: 'إكسسوار' },
    { name: 'شاحن بطاريات كانون', barcode: '7777000003', price: 30, haleb: 8, daraa: 0, group_name: 'شواحن' },
    { name: 'راس إضاءة 100 وات', barcode: '7777000004', price: 120, haleb: 3, group_name: 'إضاءة' }]);
  const init = H.ADMIN_INIT;
  let { browser, ctx, pg, errs } = await H.open('home.html', { init, w: 430, h: 900, wait: 5000 });
  const fillAnd = async (text) => { await pg.fill('.sc-ov [data-t]', text); await pg.click('.sc-ov [data-go]'); await pg.waitForFunction(() => document.querySelector('.sc-ov [data-out]').innerHTML.length > 20, null, { timeout: 15000 }); await pg.waitForTimeout(400); };
  await pg.evaluate(() => GMTBrain.analyzeScreen()); await pg.waitForSelector('.sc-ov [data-t]');
  // ١) رسالة تطابق منتجاً
  await fillAnd('مرحبا بدي بطارية كانون LP-E6NH كم سعرها؟');
  let out = await pg.evaluate(() => document.querySelector('.sc-ov [data-out]').innerText);
  ok(/بطارية كانون LP-E6NH/.test(out) && /متوفر 7/.test(out) && /60/.test(out), 'مطابقة بالاسم/الموديل: المخزون ٧ (حلب ٥ + درعا ٢) والسعر ٦٠');
  const reply = await pg.evaluate(() => document.querySelector('.sc-ov [data-reply]').value);
  ok(/LP-E6NH/.test(reply) && /60\$/.test(reply) && /shop\.example/.test(reply), 'الردّ الجاهز يذكر الاسم والسعر والرابط');
  ok((await audit()).filter(a => a.action === 'unmet_demand').length === 0, 'ما نملكه لا يُسجَّل');
  await pg.screenshot({ path: OUT + 'screen_1.png' });
  // ٢) نافد: LP-E17 (نفد) ⇒ يُسجَّل «out»
  await fillAnd('بدي بطارية LP-E17');
  await pg.waitForTimeout(500);
  let a = (await audit()).filter(x => x.action === 'unmet_demand');
  ok(a.length === 1 && a[0].field === 'out' && /E17/i.test(a[0].entity_name), 'منتج نافد ⇒ يُسجَّل نفد عندنا: ' + (a[0] && a[0].entity_name));
  // ٣) لا نملكه ولا شبيهه
  await fillAnd('السلام عليكم بدي حامل ثلاثي كاربون خفيف');
  await pg.waitForTimeout(500);
  a = (await audit()).filter(x => x.action === 'unmet_demand');
  const none = a.find(x => x.field === 'none');
  ok(!!none && /حامل/.test(none.entity_name) && !/السلام|بدي/.test(none.entity_name), 'لا نملكه ولا شبيهه ⇒ يُسجَّل بلا كلمات الحشو: «' + (none && none.entity_name) + '»');
  out = await pg.evaluate(() => document.querySelector('.sc-ov [data-out]').innerText);
  ok(/سُجِّل في «طلبات غير متوفرة»/.test(out), 'الواجهة تعلن التسجيل');
  // مرّة ثانية نفس الطلب ⇒ حدث ثانٍ (للعدّ)
  await fillAnd('بدي حامل ثلاثي كاربون'); await pg.waitForTimeout(500);
  ok((await audit()).filter(x => x.action === 'unmet_demand' && /حامل/.test(x.entity_name)).length === 2, 'تكرار الطلب يضيف حدثاً (للعدّ)');
  // ٤) شبيه (نفس المجموعة): «شاحن» ← بدي بطارية LP-XYZ غير موجودة لكن المجموعة بطاريات
  await fillAnd('بدي بطاريات للكاميرا');
  out = await pg.evaluate(() => document.querySelector('.sc-ov [data-out]').innerText);
  ok(/بطارية كانون/.test(out), 'مجموعة «بطاريات» تقترح الموجود: ' + out.split('\n').filter(l => /بطارية/.test(l)).slice(0, 2).join(' | '));
  // ٥) صورة بلا وسيط ⇒ تنبيه صريح
  const png = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#ccc'; x.fillRect(0, 0, 200, 120); return c.toDataURL('image/png').split(',')[1]; });
  await pg.setInputFiles('.sc-ov [data-fi]', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await pg.waitForSelector('.sc-ov [data-rm]');
  await pg.fill('.sc-ov [data-t]', ''); await pg.click('.sc-ov [data-go]'); await pg.waitForTimeout(2500);
  out = await pg.evaluate(() => document.querySelector('.sc-ov [data-out]').innerText);
  ok(/قراءة الصور تحتاج وسيط/.test(out), 'صورة بلا وسيط ⇒ تقول ذلك صراحةً (لا تتظاهر)');
  // ٦) باركود في الصورة ⇒ مطابقة بيقين بلا ذكاء
  await pg.evaluate(() => document.querySelector('.sc-ov [data-rm]').click());
  const bc = await pg.evaluate(async () => { await new Promise(r => { const s = document.createElement('script'); s.src = 'lib/JsBarcode.all.min.js'; s.onload = r; document.head.appendChild(s); }); const c = document.createElement('canvas'); JsBarcode(c, '7777000004', { format: 'CODE128', width: 3, height: 90, displayValue: true, margin: 20 }); return c.toDataURL('image/png').split(',')[1]; });
  await pg.setInputFiles('.sc-ov [data-fi]', { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(bc, 'base64') }); await pg.waitForSelector('.sc-ov [data-rm]');
  await pg.click('.sc-ov [data-go]'); await pg.waitForFunction(() => /راس إضاءة/.test(document.querySelector('.sc-ov [data-out]').innerText), null, { timeout: 30000 });
  out = await pg.evaluate(() => document.querySelector('.sc-ov [data-out]').innerText);
  ok(/قرأتُ من الصورة رمزاً/.test(out) && /مطابق بالباركود/.test(out), 'باركود في الصورة ⇒ «مطابق بالباركود» بلا ذكاء');
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();

  // ═ بوسيط ذكاء وهميّ ═
  ({ browser, ctx, pg, errs } = await H.open('home.html', { init: init + " localStorage.setItem('gmt_brain_endpoint','https://mock-brain.test/fn');", w: 430, h: 900, wait: 5000 }));
  let sent = null;
  await ctx.route('https://mock-brain.test/**', async r => {
    sent = JSON.parse(r.request().postData() || '{}');
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ image_used: true, provider: 'gemini', analysis: {
      summary: 'يريد بطارية LP-E6NH وحامل ثلاثي', wanted: [
        { what: 'بطارية LP-E6NH', kind: 'accessory', matched_barcode: '7777000001', availability: 'in_stock' },
        { what: 'حامل ثلاثي كاربون', kind: 'accessory', matched_barcode: null, availability: 'none', specs: 'خفيف' }], reply: 'أهلاً فيك، البطارية متوفرة بـ 60$. والحامل حالياً غير متوفر.', notes: '' } }) });
  });
  await pg.route('https://mock-brain.test/**', async r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } }); return r.fallback(); });
  await pg.evaluate(() => GMTBrain.analyzeScreen()); await pg.waitForSelector('.sc-ov [data-t]');
  await pg.setInputFiles('.sc-ov [data-fi]', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await pg.waitForSelector('.sc-ov [data-rm]');
  await pg.fill('.sc-ov [data-t]', 'بدي بطارية ولا حامل'); await pg.click('.sc-ov [data-go]');
  await pg.waitForFunction(() => /الأصناف المطلوبة/.test(document.querySelector('.sc-ov [data-out]').innerText), null, { timeout: 20000 });
  out = await pg.evaluate(() => document.querySelector('.sc-ov [data-out]').innerText);
  ok(sent && sent.mode === 'screen' && sent.image && sent.image.length > 100 && sent.candidates.length >= 1, 'أُرسل للوسيط: mode=screen + الصورة + المرشّحون (' + (sent && sent.candidates.length) + ')');
  ok(/فهمتُ من الطلب/.test(out) && /بطارية كانون LP-E6NH/.test(out) && /حامل ثلاثي كاربون/.test(out) && /غير موجود/.test(out), 'عرض الأصناف: المطابق + غير الموجود');
  ok((await pg.evaluate(() => document.querySelector('.sc-ov [data-reply]').value)).startsWith('أهلاً فيك، البطارية'), 'الردّ من الذكاء');
  await pg.waitForTimeout(600);
  const ev = (await audit()).filter(x => x.action === 'unmet_demand' && /حامل/.test(x.entity_name));
  ok(ev.length === 3, 'الحامل غير الموجود سُجّل (ثالث مرّة: ' + ev.length + ')');
  await pg.screenshot({ path: OUT + 'screen_ai.png' });
  await browser.close();

  // ═ أداة «ما يطلبه الزبائن ولا نملكه» ═
  ({ browser, ctx, pg, errs } = await H.open('طلبات_غير_متوفرة.html', { init, w: 430, h: 900, wait: 5000 }));
  await pg.waitForSelector('.it', { timeout: 8000 });
  const rows = await pg.evaluate(() => [...document.querySelectorAll('.it')].map(r => r.querySelector('.cnt').textContent + '|' + r.querySelector('.tm').textContent));
  console.log('   ', rows.join(' ; '));
  ok(rows[0].startsWith('3|') && /حامل/.test(rows[0]), 'الأكثر طلباً أولاً: حامل ×٣');
  await pg.screenshot({ path: OUT + 'unmet_page.png' });
  await pg.click('.it [data-done]'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri'); await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(800);
  ok(!(await pg.evaluate(() => document.body.innerText)).includes('حامل ثلاثي'), 'بعد «تمّ توفيره» يختفي من المفتوح');
  await pg.click('[data-c="rs"]'); ok((await pg.evaluate(() => document.querySelector('.it .tm') && document.querySelector('.it .tm').textContent)) && true, 'يظهر في «المعالَجة»');
  await pg.click('[data-c="rs"]');
  await pg.fill('#add-t', 'ميكروفون لاسلكي'); await pg.click('#add-b'); await pg.waitForTimeout(1500);
  ok((await pg.evaluate(() => document.body.innerText)).includes('ميكروفون لاسلكي'), 'إضافة يدوية');
  console.log('errors:', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 4));
  await browser.close();
})();
