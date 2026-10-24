// TASK-0105 — صورة/PDF الأوردر تُصنع داخلياً بعربيةٍ سليمة (O-08) + «قفل الأوردرات» في مكانٍ أسهل (O-09).
// O-08 (10 ت1): «لاحظ أغلاط … عندما تنشئ الصورة أو تشارك ملف الـPDF بدون الطباعة … لا تستعين بخدمة خارجية اجعلها خدمة داخلية».
// O-09 (10 ت1): «قفل الأوردرات … اجعله في مكان آخر أسهل وسهل الوصول إليه».
// ١) الصورة من محرّك المتصفّح نفسه (foreignObject) بخطّ Cairo المستضاف، لا html2canvas ولا شبكة خارجية ·
// ٢) العربية متّصلة: كلمةٌ بحروفها متّصلةً أضيق بوضوح من الحروف نفسها منفصلةً (ZWNJ) · ٣) PDF داخليّ صفحةٌ واحدة ·
// ٤) شارة القفل في ترويسة الأوردرات · الأدمن يبدّلها والقاعدة تتغيّر · الموظّف يرى الشرح فقط · رسالة الحجب بأزرار.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = async () => H.call('/__dump', undefined, 'GET');
const setting = async k => (((await dump()).gmt_settings || []).find(x => x.key === k) || {}).value;
const closeDialogs = async pg => { for (let i = 0; i < 4 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); } };
const ADMIN_NAMED = H.ADMIN_INIT + `try{sessionStorage.setItem('gmt_admin_name','محمد خير')}catch(e){}`;

(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    await H.call('/rest/v1/gmt_settings?on_conflict=key', [{ key: 'orders_lock', value: '0' }]);
    const [o] = await H.call('/rest/v1/gmt_orders', [{ name: 'سارة غسان الأسعد', phone: '0982265250', product: 'كاميرا كانون', qty: 1, price: 250, status: 'pending', branch: 'حلب',
      address: 'حمص — الحضارة · مقابل بنك بيمو — قرب الإطفائية', shipping_company: 'المفتي', notes: 'تم إنشاء هذا الأوردر بواسطة الموظّف' }]);
    const { browser, pg, errs } = await H.open('orders.html', { init: ADMIN_NAMED, w, mobile: mob, wait: 6000 });
    const ext = []; pg.on('request', r => { const u = r.url(); if (/^https?:\/\//.test(u) && !/127\.0\.0\.1|supabase\.co/.test(u)) ext.push(u.slice(0, 90)); });

    // ١) الصورة
    const img = await pg.evaluate(async (id) => {
      const ord = (window.orders || []).find(x => String(x.id) === String(id)) || (await (async () => { await loadOrders(); return orders.find(x => String(x.id) === String(id)); })());
      const t = performance.now();
      const b = await sheetToBlob(buildOrderSheetHTML(ord, false));
      const bm = await createImageBitmap(b);
      return { type: b.type, size: b.size, w: bm.width, h: bm.height, engine: GMTRender.engine, ms: Math.round(performance.now() - t) };
    }, o.id);
    ok(img.engine === 'foreignObject', 'صورة الأوردر من محرّك المتصفّح نفسه (لا html2canvas): ' + img.engine);
    ok(img.type === 'image/jpeg' && img.w >= 1150 && img.w <= 1250 && img.h > 600 && img.size > 20000, 'JPEG بعرض ~1200: ' + JSON.stringify(img));
    const html2canvasLoaded = await pg.evaluate(() => typeof window.html2canvas !== 'undefined');
    ok(!html2canvasLoaded, 'html2canvas لم تُحمَّل أصلاً');

    // ٢) العربية متّصلة — نقيس عرض الحبر لكلمةٍ بحروفٍ متّصلة مقابل الحروف نفسها منفصلة
    const shape = await pg.evaluate(async () => {
      const Z = '‌';
      const words = 'الأسعد المنتجات';
      const iso = [...words].map(c => c === ' ' ? ' ' : c + Z).join('');
      const page = t => '<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><style>body{margin:0;background:#fff}div{font:700 64px Cairo,sans-serif;padding:20px;white-space:nowrap;display:inline-block}</style></head><body><div>' + t + '</div></body></html>';
      const ink = cv => { const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, x1 = -1;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (d[i] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; } }
        return x1 - x0; };
      const a = await GMTRender.toCanvas(page(words), { width: 900, scale: 1 });
      const b = await GMTRender.toCanvas(page(iso), { width: 900, scale: 1 });
      return { joined: ink(a), isolated: ink(b), font: !!(a._gmt && a._gmt.font), engine: a._gmt && a._gmt.engine };
    });
    ok(shape.font, 'خطّ Cairo المستضاف (lib/fonts) ضُمّن في الصورة');
    ok(shape.joined > 100 && shape.joined < shape.isolated * 0.85, 'الحروف العربية متّصلة (عرض الحبر ' + shape.joined + 'px مقابل ' + shape.isolated + 'px للحروف منفصلةً)');

    // ٣) PDF
    const pdf = await pg.evaluate(async (id) => {
      const ord = orders.find(x => String(x.id) === String(id));
      const b = await GMTShare._buildPdf(buildOrderSheetHTML(ord, false), 'أوردر-' + (ord.serial_code || ord.id), { width: SHEET_BASE_W, fit: 'one-page' });
      const head = new TextDecoder().decode(new Uint8Array(await b.slice(0, 5).arrayBuffer()));
      return { type: b.type, head, size: b.size, pages: GMTRender.lastPdf && GMTRender.lastPdf.pages, engine: GMTRender.lastPdf && GMTRender.lastPdf.engine };
    }, o.id);
    ok(pdf.type === 'application/pdf' && pdf.head === '%PDF-' && pdf.size > 20000, 'PDF داخليّ صالح: ' + JSON.stringify(pdf));
    ok(pdf.pages === 1 && pdf.engine === 'foreignObject', 'ورقة الأوردر صفحةٌ واحدة في الـPDF، بمحرّك المتصفّح');
    // زرّ «مشاركة PDF» لا يفتح حوار الطباعة: بلا مشاركة ملفّات ⇒ تنزيل
    const printed = await pg.evaluate(async (id) => {
      let p = 0; const fr0 = HTMLIFrameElement.prototype; window.__printCalls = 0;
      const op = window.print; window.print = () => { window.__printCalls++; };
      let dl = null; const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) dl = this.download; else oc.call(this); };
      try { if (navigator.canShare) navigator.canShare = () => false; } catch (_) {}
      await shareOrderPdf(id);
      HTMLAnchorElement.prototype.click = oc; window.print = op;
      return { dl, prints: window.__printCalls };
    }, o.id);
    ok(printed.dl && /\.pdf$/.test(printed.dl) && printed.prints === 0, '«مشاركة PDF» على جهازٍ بلا مشاركة ملفّات ⇒ تنزيلٌ مباشر لا حوار طباعة: ' + JSON.stringify(printed));
    await closeDialogs(pg);
    ok(ext.length === 0, 'لا طلب لأيّ خدمةٍ خارجية أثناء صنع الصورة/PDF: ' + JSON.stringify(ext.slice(0, 3)));

    // ٤) شارة القفل
    await pg.waitForSelector('#olk-badge', { timeout: 8000 }).catch(() => {});
    const bd = await pg.evaluate(() => { const b = document.getElementById('olk-badge'), c = document.getElementById('conn-badge'); if (!b) return null; const r = b.getBoundingClientRect();
      return { txt: b.innerText.replace(/\s+/g, ' ').trim(), cls: b.className, vis: r.width > 0 && r.height > 0, nextToConn: !!c && c.nextElementSibling === b, top: r.top }; });
    ok(bd && bd.vis && bd.nextToConn && bd.top < 200, 'شارة «قفل الأوردرات» ظاهرة في الترويسة بجانب حالة الاتصال: ' + JSON.stringify(bd));
    ok(bd && bd.cls === 'off', 'وتقول «مفتوحة/مُعطَّل» كما في القاعدة');
    await pg.screenshot({ path: __dirname + '/order_lock_badge_' + w + '.png' });
    // الأدمن المسمّى: نقرة ⇒ تأكيد ⇒ القاعدة تتغيّر
    await pg.click('#olk-badge'); await pg.waitForSelector('.gmtask-ov .gmtask-b.pri', { timeout: 5000 });
    await pg.click('.gmtask-ov .gmtask-b.pri'); await pg.waitForTimeout(1800);
    ok(await setting('orders_lock') === '1' && /^محمد خير\|/.test(await setting('orders_lock_by') || ''), 'الأدمن فعّل القفل من الشارة ⇒ القاعدة: orders_lock=1 باسمه');
    ok(await pg.evaluate(() => document.getElementById('olk-badge').className) === 'on', 'والشارة صارت «مُفعَّل»');
    await closeDialogs(pg);
    // رسالة الحجب: شحن أوردر غير مُفوتَر
    const msg = await pg.evaluate(async (id) => { const ord = orders.find(x => String(x.id) === String(id)); return ordersLockBlock(ord, 'shipped'); }, o.id);
    ok(/تقفيل الأوردرات مُفعَّل/.test(msg || ''), 'القفل يحجب شحن أوردرٍ غير مُفوتَر');
    pg.evaluate((m) => ordersLockShow(m, orders[0]), msg);
    await pg.waitForSelector('.gmtask-ov', { timeout: 5000 });
    const btns = await pg.evaluate(() => [...document.querySelectorAll('.gmtask-ov button')].map(b => b.innerText.trim()));
    ok(btns.some(t => /افتح فاتورة/.test(t)) && btns.some(t => /ألغِ القفل/.test(t)), 'رسالة الحجب بأزرار [افتح فاتورة] [ألغِ القفل الآن]: ' + JSON.stringify(btns));
    await closeDialogs(pg);
    const bad = errs.filter(e => !/favicon|أصول ناقصة|Failed to load resource/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();

    // الموظّف: الشارة تشرح ولا تغيّر
    const S = await H.open('orders.html', { init: H.STAFF_INIT + `try{localStorage.setItem('gmt_operator_name','سامر')}catch(e){}`, w, mobile: mob, wait: 6000 });
    await S.pg.waitForSelector('#olk-badge', { timeout: 8000 }).catch(() => {});
    ok(await S.pg.evaluate(() => (document.getElementById('olk-badge') || {}).className) === 'on', 'الموظّف يرى الشارة «مُفعَّل» (من القاعدة)');
    await S.pg.click('#olk-badge'); await S.pg.waitForSelector('.gmtask-ov', { timeout: 5000 });
    const st = await S.pg.evaluate(() => document.querySelector('.gmtask-ov').innerText);
    ok(/للأدمن المسمّى فقط/.test(st), 'نقرة الموظّف ⇒ شرحٌ فقط');
    await closeDialogs(S.pg); await S.pg.waitForTimeout(500);
    ok(await setting('orders_lock') === '1', 'ولم يتغيّر القفل');
    await S.browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
