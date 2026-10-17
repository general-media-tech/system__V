// مرحّل تيليغرام: كل طلب api.telegram.org يمرّ بدالّة الخادم gmt-tg، والرجوع للطريق القديم إن لم تُضبط الدالّة
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  await H.seed();
  for (const page of ['orders.html', 'pos.html', 'store.html']) {
    console.log('— ' + page);
    const { browser, ctx, pg, errs } = await H.open(page, { w: 390, h: 800, wait: 3500, init: page === 'pos.html' ? H.STAFF_INIT : H.ADMIN_INIT });
    let mode = 503; const relay = [], direct = [];
    await ctx.route('**/functions/v1/gmt-tg/**', r => { const q = r.request(); relay.push({ url: q.url(), auth: q.headers()['authorization'] || '', ct: q.headers()['content-type'] || '', body: (q.postData() || '').slice(0, 200) }); r.fulfill({ status: mode, contentType: 'application/json', body: mode === 503 ? '{"ok":false,"relay":"not_configured"}' : '{"ok":true,"result":{"message_id":7}}' }); });
    await ctx.route('https://api.telegram.org/**', r => { direct.push(r.request().url().replace(/bot[^/]+/, 'bot***')); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    const send = () => pg.evaluate(async () => { const r = await fetch('https://api.telegram.org/bot123:ABC/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: '-1003870992994', text: 'اختبار' }) }); return r.status; });
    // ١) الدالّة غير مضبوطة ⇒ يرجع للطريق القديم ولا يضيع التبليغ
    let st = await send();
    ok(st === 200 && relay.length === 1 && direct.length === 1, 'غير مضبوطة (503) ⇒ جُرّبت الدالّة مرّة ثم الطريق القديم (التبليغ وصل)');
    st = await send();
    ok(relay.length === 1 && direct.length === 2, 'بعدها في نفس الصفحة: الطريق القديم مباشرةً بلا محاولة مكرّرة');
    await browser.close();
    // ٢) الدالّة مضبوطة ⇒ لا طلب مباشر لتيليغرام إطلاقاً
    const b2 = await H.open(page, { w: 390, h: 800, wait: 3500, init: page === 'pos.html' ? H.STAFF_INIT : H.ADMIN_INIT });
    const relay2 = [], direct2 = [];
    await b2.ctx.route('**/functions/v1/gmt-tg/**', r => { const q = r.request(); relay2.push({ url: q.url(), auth: q.headers()['authorization'] || '', ct: q.headers()['content-type'] || '', body: (q.postData() || '').slice(0, 300) }); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"result":{"message_id":7}}' }); });
    await b2.ctx.route('https://api.telegram.org/**', r => { direct2.push(r.request().url()); r.fulfill({ status: 200, body: '{"ok":true}' }); });
    const res = await b2.pg.evaluate(async () => {
      const out = {};
      let r = await fetch('https://api.telegram.org/bot123:ABC/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: '-1003870992994', text: 'اختبار' }) });
      out.json = await r.json();
      const fd = new FormData(); fd.append('chat_id', '-1003859889022'); fd.append('photo', new Blob(['xx'], { type: 'image/jpeg' }), 'a.jpg');
      r = await fetch('https://api.telegram.org/bot123:ABC/sendPhoto', { method: 'POST', body: fd }); out.photo = r.status;
      r = await fetch('https://api.telegram.org/bot123:ABC/sendMessage?chat_id=-1003870992994&text=hi'); out.get = r.status;
      if (window.GMTUtil && GMTUtil.tg) out.util = await GMTUtil.tg('مرحبا', { token: '123:ABC', chat: '-1003870992994' });
      return out;
    });
    ok(res.json && res.json.ok === true && direct2.length === 0, 'مضبوطة ⇒ كل الطلبات عبر الدالّة، صفر طلبات مباشرة لتيليغرام (' + relay2.length + ' طلبات)');
    ok(relay2.every(x => /^Bearer /.test(x.auth)), 'كل طلب يحمل مفتاح القاعدة العامّ (لا مفتاح البوت)');
    ok(relay2.every(x => !/123:ABC/.test(x.url + x.body)), 'مفتاح البوت لا يُرسَل للدالّة إطلاقاً');
    ok(relay2.some(x => /sendPhoto$/.test(x.url) && /multipart\/form-data/.test(x.ct)), 'الصور تمرّ كـ multipart كما هي');
    ok(relay2.some(x => /sendMessage$/.test(x.url) && /"text":"hi"/.test(x.body)), 'نداءٌ بمعاملات في الرابط يتحوّل لجسم JSON');
    if (res.util !== undefined) ok(res.util === true, 'GMTUtil.tg يعمل عبر الدالّة');
    console.log('   errs:', [...errs, ...b2.errs].filter(e => !/400|404|Failed|أصول/.test(e)).slice(0, 3));
    await b2.browser.close();
  }
  console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
