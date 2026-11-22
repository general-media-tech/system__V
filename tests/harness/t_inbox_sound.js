// (TASK-A0566 · المالك seq 959 «ركّزلي على الإشعارات والأصوات» · seq 964 «كمل»)
// صندوق الإشعارات: إشعارٌ جديد على جهازٍ بلا اشتراك دفع كان يغيّر رقم الجرس بصمت · والدفع يصدح من كلّ تبويب حتى المخفيّ
//  ① أوّل قراءة ⇒ لا صوت   ② ازداد غير المقروء ⇒ صوت «إشعار» واحد   ③ بلا تغيير ⇒ لا صوت
//  ④ العودة للصفحة ⇒ لا صوت (الهاتف نبّه)   ⑤ بعد صوت دفعٍ للتوّ ⇒ لا صوت ثانٍ   ⑥ تبويبٌ آخر أعلن العدد نفسه ⇒ لا صوت
//  ⑦ منبثقة حرجة ⇒ صوتها وحده (لا صوتين)   ⑧ رسالة دفع والصفحة ظاهرة ⇒ صوت · نفسها مكرّرة ⇒ لا · والصفحة مخفيّة ⇒ لا
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const S = { unread: 1, popup: null };
  const init = H.STAFF_INIT + `;try{localStorage.setItem('gmt_inbox_token','${'c'.repeat(64)}');localStorage.setItem('gmt_sound','on')}catch(_){}`;
  const o = await H.open('home.html', { init, wait: 3000 });
  const { pg } = o;
  await o.ctx.route('**/functions/v1/notify-inbox**', r => {
    const b = JSON.parse(r.request().postData() || '{}');
    const send = x => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(x) });
    if (b.action === 'count') return send({ ok: true, unread: S.unread, popup: S.popup });
    if (b.action === 'list') return send({ ok: true, items: S.popup ? [{ id: S.popup, t: '💸 مصروف بانتظار موافقتك', b: 'فرع', u: 'home.html' }] : [] });
    return send({ ok: true });
  });
  await pg.reload(); await sleep(3500);
  const ready = await pg.evaluate(() => !!(window.GMTInbox && window.GMTSound));
  ok(ready, 'الصفحة فيها صندوق الإشعارات ومنظومة الأصوات');
  await pg.evaluate(() => {
    window.__cues = [];
    let depth = 0;   /* نداءٌ داخليّ (cue ⇐ play) لا يُعدّ صوتاً ثانياً */
    const spy = (name) => { const f = GMTSound[name]; if (!f) return; GMTSound[name] = function (n) { if (!depth) window.__cues.push(name + ':' + n); depth++; try { return f.apply(this, arguments); } finally { depth--; } }; };
    spy('cue'); spy('play'); spy('emit');
    localStorage.removeItem('gmt_inbox_snd');
  });
  const cues = async (fn) => { await pg.evaluate(() => { window.__cues = []; }); await pg.evaluate(fn); await sleep(500); return pg.evaluate(() => window.__cues.filter(x => /notify|order/.test(x))); };
  // ① (أوّل قراءة جرت مع التحميل) — نعيد القراءة بالعدد نفسه
  ok((await cues(() => GMTInbox.paint())).length === 0, '① أوّل قراءة / العدد نفسه ⇒ لا صوت');
  // ②
  S.unread = 2;
  const c2 = await cues(() => GMTInbox.paint());
  ok(c2.length === 1 && /notify/.test(c2[0]), '② إشعارٌ جديد ⇒ صوت «إشعار» واحد ' + JSON.stringify(c2));
  // ③
  ok((await cues(() => GMTInbox.paint())).length === 0, '③ بلا تغيير ⇒ لا صوت');
  // ④
  S.unread = 3;
  ok((await cues(() => document.dispatchEvent(new Event('visibilitychange')))).length === 0, '④ العودة للصفحة ⇒ لا صوت (الهاتف نبّه أصلاً)');
  // ⑤
  S.unread = 4;
  ok((await cues(() => { window.__gmtPushSndAt = Date.now(); return GMTInbox.paint(); })).length === 0, '⑤ بعد صوت دفعٍ للتوّ ⇒ لا صوت ثانٍ');
  await pg.evaluate(() => { window.__gmtPushSndAt = 0; });
  // ⑥
  S.unread = 5;
  ok((await cues(() => { localStorage.setItem('gmt_inbox_snd', JSON.stringify({ n: 5, t: Date.now() })); return GMTInbox.paint(); })).length === 0, '⑥ تبويبٌ آخر أعلن العدد نفسه ⇒ لا صوت');
  // ⑦
  S.unread = 6; S.popup = 77;
  const c7 = await cues(() => GMTInbox.paint());
  const pop = await pg.evaluate(() => !!document.getElementById('gmt-pop-bg'));
  ok(pop && c7.length === 1, '⑦ منبثقة حرجة ⇒ صوتٌ واحد (' + JSON.stringify(c7) + ')');
  await pg.evaluate(() => { const b = document.getElementById('gmt-pop-bg'); if (b) b.remove(); });
  S.popup = null;
  // ⑧
  const hasPush = await pg.evaluate(() => !!(window.GMTPush && navigator.serviceWorker));
  const msg = (d) => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'gmt-push', d } }));
  const c8 = await cues(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'gmt-push', d: { k: 'order_new', t: '📝 أوردر جديد', b: 'ORD-1' } } })));
  ok(hasPush && c8.length === 1, '⑧ رسالة دفع والصفحة ظاهرة ⇒ صوتٌ واحد ' + JSON.stringify(c8));
  const c8b = await cues(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'gmt-push', d: { k: 'order_new', t: '📝 أوردر جديد', b: 'ORD-1' } } })));
  ok(c8b.length === 0, '⑧ الرسالة نفسها من تبويبٍ ثانٍ ⇒ لا صوت مكرّر');
  const c8c = await cues(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'gmt-push', d: { k: 'order_new', t: '📝 أوردر جديد', b: 'ORD-2' } } })); });
  ok(c8c.length === 0, '⑧ الصفحة مخفيّة ⇒ لا صوت (إشعار الهاتف له صوته)');
  const real = o.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
