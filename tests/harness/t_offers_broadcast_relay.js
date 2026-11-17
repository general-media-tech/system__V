// ARC-MD-09#63 — «نقل توكن تيليغرام للخادم وسجلّ بثّ»: بثّ العروض (GMTOffersTool) لا يمرّ بتوكنٍ محلّي إلى api.telegram.org بعد اليوم —
// يصير حملةً في الخادم (marketing ⇐ camp_save · قناة telegram · جمهور offers) فتُسجَّل في «سجلّ الحملات».
// ١) التوكن/القناة القديمان على الجهاز يُمسحان · ٢) 📣 ⇒ camp_save بالعنوان والصورة · بلا أيّ طلب لـ api.telegram.org ·
// ٣) بلا جهاز أدمن موثَّق ⇒ رسالة واضحة بلا إرسال · ٤) لا أخطاء JS.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const TOKEN = 'a'.repeat(64);
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_offers', [{ name: 'عرض الفلاش', description: 'فلاش + بطارية', offer_type: 'single', offer_price: 99, original_price: 120, image_url: 'https://img.example.com/o.jpg', is_active: true, targets: { store: true, site: false } }]);
  const init = H.ADMIN_INIT + `try{ localStorage.setItem('gmt_offers_tg_bot','111:OLD'); localStorage.setItem('gmt_offers_tg_chat','@old'); }catch(e){}`;
  const { browser, ctx, pg, errs } = await H.open('admin_pos.html', { init, w: 1280, h: 900, mobile: false, wait: 4000 });
  const mk = [], tgDirect = [];
  await ctx.route('**/functions/v1/marketing**', r => { const b = JSON.parse(r.request().postData() || '{}'); mk.push(b);
    r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(b.action === 'camp_list' ? { ok: true, items: [], auto: false } : { ok: true, item: { id: 7 } }) }); });
  await ctx.route('https://api.telegram.org/**', r => { tgDirect.push(r.request().url()); r.fulfill({ status: 200, body: '{"ok":true}' }); });
  const ls = await pg.evaluate(() => ({ bot: localStorage.getItem('gmt_offers_tg_bot'), chat: localStorage.getItem('gmt_offers_tg_chat') }));
  ok(!ls.bot && !ls.chat, 'توكن البوت والقناة القديمان على الجهاز مُسحا: ' + JSON.stringify(ls));
  await pg.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="t-of"></div>'); return GMTOffersTool.mount('t-of'); });
  await pg.waitForFunction(() => /عرض الفلاش/.test(document.getElementById('t-of').innerText), null, { timeout: 8000 });
  const id = await pg.evaluate(() => { const b = document.querySelector('#t-of [onclick*="_tg("]'); return b && /_tg\('([^']+)'\)/.exec(b.getAttribute('onclick'))[1]; });
  // ٣) بلا جهاز أدمن موثَّق
  await pg.evaluate((id) => GMTOffersTool._tg(id), id); await pg.waitForTimeout(400);
  let t = await pg.evaluate(() => (document.getElementById('gmtof-toast') || {}).textContent || '');
  ok(mk.length === 0 && /صندوق الإشعارات/.test(t), 'بلا جهاز أدمن موثَّق ⇒ لا إرسال ورسالة واضحة: ' + t.slice(0, 70));
  // ٢) مع الجهاز الموثَّق ⇒ حملة
  await pg.evaluate((tk) => localStorage.setItem('gmt_inbox_token', tk), TOKEN);
  await pg.evaluate((id) => GMTOffersTool._tg(id), id); await pg.waitForTimeout(600);
  const c = mk.find(b => b.action === 'camp_save') || {};
  ok(c.token === TOKEN && c.title === 'عرض الفلاش' && JSON.stringify(c.channels) === '["telegram"]' && JSON.stringify(c.topics) === '["offers"]' && c.image_url === 'https://img.example.com/o.jpg' && /99/.test(c.body || ''),
    'البثّ ⇒ حملة خادم (camp_save · telegram · offers · الصورة والسعر): ' + JSON.stringify(c).slice(0, 160));
  ok(tgDirect.length === 0, 'لا طلب مباشر إلى api.telegram.org من المتصفّح: ' + tgDirect.length);
  t = await pg.evaluate(() => (document.getElementById('gmtof-toast') || {}).textContent || '');
  ok(/حملات تيليغرام/.test(t), 'رسالة: أُرسل لحملات تيليغرام (سجلّ الحملات): ' + t.slice(0, 70));
  const bad = errs.filter(e => !/Failed to load|favicon|404|406|ERR_|qrserver|vibrate/.test(e));
  ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
  await browser.close();
  // ٥) التقرير الأسبوعي: «أرسل ملخّصاً» كان يقرأ توكن صفحة العروض المحلّي ⇒ الآن عبر وسيط gmt-tg (لا توكن في المتصفّح)
  const w = await H.open('weekly_report.html', { init, w: 1280, h: 900, mobile: false, wait: 3000 });
  const relay = [], direct = [];
  await w.ctx.route('**/functions/v1/gmt-tg/**', r => { relay.push({ u: r.request().url(), b: JSON.parse(r.request().postData() || '{}') }); r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: '{"ok":true,"result":{"message_id":1}}' }); });
  await w.ctx.route('https://api.telegram.org/**', r => { direct.push(r.request().url()); r.fulfill({ status: 200, body: '{"ok":true}' }); });
  const alerts = []; w.pg.on('dialog', d => { alerts.push(d.message()); d.dismiss().catch(() => {}); });
  await w.pg.evaluate(() => { window.__REPORT_TXT = 'تقرير تجربة'; return sendTG(); }); await w.pg.waitForTimeout(500);
  ok(relay.length === 1 && /\/gmt-tg\/sendMessage$/.test(relay[0].u) && relay[0].b.chat_id === '-1003870992994' && relay[0].b.text === 'تقرير تجربة' && direct.length === 0,
    'التقرير الأسبوعي ⇒ وسيط gmt-tg لقناة الأدمن · لا طلب مباشر: ' + JSON.stringify(relay.map(x => x.u.split('/').slice(-2).join('/'))));
  const okMsg = await w.pg.evaluate(() => /أُرسل الملخّص/.test(document.body.innerText)).catch(() => false);
  ok(alerts.some(a => /أُرسل/.test(a)) || okMsg, 'رسالة النجاح تظهر');
  await w.browser.close();
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
