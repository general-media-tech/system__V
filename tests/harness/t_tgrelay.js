// الوسيط (17 ت1 بعد اختراق البوت): لا مفتاح بوت في الصفحات، وكل تبليغ يمرّ بدالّة الخادم gmt-tg بلا رجوعٍ للطريق المباشر
const H = require('./h.js');
const fs = require('fs'), path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const ROOT = path.resolve(__dirname, '../..');
(async () => {
  // ٠) فحصٌ ثابت: لا مفتاح بوت تيليغرام ولا مفتاح JSONBin في أي ملفّ منشور
  const leaks = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      if (/^(\.git|\.claude|node_modules|lib)$/.test(f)) continue;
      const p = path.join(d, f), st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(html|js|ts|md|json|txt|sql|py)$/.test(f)) continue;
      const s = fs.readFileSync(p, 'utf8');
      if (/[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}/.test(s) || /\$2a\$10\$[A-Za-z0-9./]{40,}/.test(s)) leaks.push(path.relative(ROOT, p));
    }
  })(ROOT);
  ok(leaks.length === 0, 'لا مفتاح بوت ولا مفتاح JSONBin في أي ملفّ' + (leaks.length ? ' — موجود في: ' + leaks.join(', ') : ''));

  await H.seed();
  const PAGES = ['orders.html', 'pos.html', 'store.html', 'admin_pos.html', 'inventory.html', 'guarantee.html'];
  for (const page of PAGES) {
    console.log('— ' + page);
    const init = page === 'pos.html' ? H.STAFF_INIT : H.ADMIN_INIT;
    // ١) الدالّة غير مضبوطة ⇒ 503 يصل للصفحة، ولا طلب مباشر لتيليغرام إطلاقاً
    const { browser, ctx, pg, errs } = await H.open(page, { w: 390, h: 800, wait: 3500, init });
    const relay = [], direct = [];
    await ctx.route('**/functions/v1/gmt-tg/**', r => { relay.push(r.request().url()); r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"relay":"not_configured"}' }); });
    await ctx.route('https://api.telegram.org/**', r => { direct.push(r.request().url().replace(/bot[^/]+/, 'bot***')); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    const st = await pg.evaluate(async () => { const r = await fetch('https://api.telegram.org/botgmt-relay/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: '-1003870992994', text: 'اختبار' }) }); return { s: r.status, j: await r.json() }; });
    ok(st.s === 503 && st.j.ok === false && relay.length === 1 && direct.length === 0, 'غير مضبوطة ⇒ الصفحة تعرف أن التبليغ لم يصل (503) وصفر طلبات مباشرة');
    // بوتٌ أدخله المستخدم بيده (بثّ العروض) ⇒ يمرّ كما هو
    await pg.evaluate(() => fetch('https://api.telegram.org/bot123:ABC/sendMessage', { method: 'POST', body: '{}' }).catch(() => 0));
    ok(direct.length === 1 && relay.length === 1, 'بوتٌ غير علامة الوسيط (مُدخلٌ يدوياً على الجهاز) لا يُحوَّل');
    await browser.close();
    // ٢) الدالّة مضبوطة ⇒ كل شيء عبرها، والمفتاح لا يغادر الخادم
    const b2 = await H.open(page, { w: 390, h: 800, wait: 3500, init });
    const relay2 = [], direct2 = [];
    await b2.ctx.route('**/functions/v1/gmt-tg/**', r => { const q = r.request(); relay2.push({ url: q.url(), auth: q.headers()['authorization'] || '', ct: q.headers()['content-type'] || '', body: (q.postData() || '').slice(0, 400) }); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"result":{"message_id":7}}' }); });
    await b2.ctx.route('https://api.telegram.org/**', r => { direct2.push(r.request().url()); r.fulfill({ status: 200, body: '{"ok":true}' }); });
    await b2.ctx.route('https://api.jsonbin.io/**', r => { direct2.push(r.request().url()); r.fulfill({ status: 200, body: '{}' }); });
    const res = await b2.pg.evaluate(async () => {
      const out = {};
      let r = await fetch('https://api.telegram.org/botgmt-relay/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: '-1003870992994', text: 'اختبار' }) });
      out.json = await r.json();
      const fd = new FormData(); fd.append('chat_id', '-1003859889022'); fd.append('photo', new Blob(['xx'], { type: 'image/jpeg' }), 'a.jpg');
      r = await fetch('https://api.telegram.org/botgmt-relay/sendPhoto', { method: 'POST', body: fd }); out.photo = r.status;
      r = await fetch('https://api.telegram.org/botgmt-relay/sendMessage?chat_id=-1003870992994&text=hi'); out.get = r.status;
      if (window.GMTUtil && GMTUtil.tg) out.util = await GMTUtil.tg('مرحبا', { token: 'gmt-relay', chat: '-1003870992994' });
      if (window.GMTRelay) out.jb = await GMTRelay.jsonbinOrder({ id: 'T1', phone: '0999', name: 'زبون' });
      return out;
    });
    ok(res.json && res.json.ok === true && direct2.length === 0, 'مضبوطة ⇒ كل الطلبات عبر الدالّة، صفر طلبات مباشرة (' + relay2.length + ' طلبات)');
    ok(relay2.length > 0 && relay2.every(x => /^Bearer /.test(x.auth)), 'كل طلب يحمل مفتاح القاعدة العامّ فقط');
    ok(relay2.some(x => /sendPhoto$/.test(x.url) && /multipart\/form-data/.test(x.ct)), 'الصور تمرّ كـ multipart كما هي');
    ok(relay2.some(x => /sendMessage$/.test(x.url) && /"text":"hi"/.test(x.body)), 'نداءٌ بمعاملات في الرابط يتحوّل لجسم JSON');
    if (res.util !== undefined) ok(res.util === true, 'GMTUtil.tg يعمل عبر الدالّة');
    ok(res.jb === true && relay2.some(x => /jsonbin-order$/.test(x.url) && /"id":"T1"/.test(x.body)), 'نسخة JSONBin الاحتياطيّة عبر الوسيط (لا طلب مباشر لـ jsonbin.io)');
    console.log('   errs:', [...errs, ...b2.errs].filter(e => !/400|404|Failed|أصول/.test(e)).slice(0, 3));
    await b2.browser.close();
  }
  // ٣) المتجر: إتمام طلب «عند الاستلام» يُرسل التبليغ ونسخة JSONBin عبر الوسيط
  {
    console.log('— store.html (طلب كامل)');
    const b = await H.open('store.html', { w: 390, h: 800, wait: 3500, init: H.ADMIN_INIT });
    const relay3 = [], direct3 = [];
    await b.ctx.route('**/functions/v1/gmt-tg/**', r => { relay3.push(r.request().url().split('/gmt-tg/')[1]); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"result":{"message_id":7}}' }); });
    await b.ctx.route('https://api.jsonbin.io/**', r => { direct3.push(r.request().url()); r.fulfill({ status: 200, body: '{}' }); });
    const has = await b.pg.evaluate(() => typeof insertOrder === 'function' ? insertOrder({ id: 'S9', phone: '0999', name: 'x' }) : 'nofn');
    ok(has === true && relay3.includes('jsonbin-order') && direct3.length === 0, 'insertOrder في المتجر ⇒ الوسيط (' + has + ')');
    await b.browser.close();
  }
  console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
