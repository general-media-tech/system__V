// (TASK-B0424 · المالك seq 803/808) مركز الإشعارات: توثيق الجهاز بكلمة السرّ · صندوق لكل مستخدم · مقروء/أرشفة/تأجيل/بحث · جرس بعدد غير المقروء · منبثقة حرجة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function server() {
  const S = { calls: [], tok: null, items: [
    { id: 3, k: 'expense', t: '💸 مصروف بانتظار موافقتك', b: 'من فرع حلب', u: 'admin_pos.html', p: 2, pop: true, at: new Date().toISOString(), read: false, arch: false, done: false },
    { id: 2, k: 'order_new', t: '📝 أوردر جديد', b: 'أوردر ORD-9 — أضافه سامر', u: 'orders.html?order=9', p: 1, pop: false, at: new Date().toISOString(), read: false, arch: false, done: false },
    { id: 1, k: 'offer', t: '🎁 عرض جديد', b: '«باقة R6»', u: 'pos.html?go=offers', p: 1, pop: false, at: new Date(Date.now() - 864e5).toISOString(), read: true, arch: false, done: false }] };
  S.handle = async r => {
    const b = JSON.parse(r.request().postData() || '{}'); S.calls.push(b);
    const send = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
    if (b.action === 'register') { if (b.via === 'user' && b.pw === 'سر123') { S.tok = 'c'.repeat(64); return send({ ok: true, token: S.tok, recipient: 'user:' + b.user_id }); } return send({ ok: false, err: 'auth', msg: 'كلمة السرّ غير صحيحة' }); }
    if (!S.tok || b.token !== S.tok) return send({ ok: false, err: 'token', msg: 'الجهاز غير موثَّق' });
    const live = S.items.filter(x => !x.snz || x.snz < Date.now());
    if (b.action === 'count') return send({ ok: true, unread: live.filter(x => !x.read && !x.arch).length, popup: (live.find(x => x.pop && !x.done && !x.arch) || {}).id || null });
    if (b.action === 'list') {
      let L = b.box === 'archive' ? S.items.filter(x => x.arch) : b.box === 'snoozed' ? S.items.filter(x => x.snz && x.snz > Date.now()) : live.filter(x => !x.arch);
      if (b.box === 'unread') L = L.filter(x => !x.read); if (b.kind) L = L.filter(x => x.k === b.kind); if (b.q) L = L.filter(x => (x.t + x.b).includes(b.q));
      return send({ ok: true, items: L, more: null });
    }
    const ids = b.all ? S.items.map(x => x.id) : (b.ids || []);
    S.items.forEach(x => { if (ids.indexOf(x.id) === -1) return;
      if (b.action === 'read') x.read = true; if (b.action === 'unread') x.read = false; if (b.action === 'archive') { x.arch = true; x.read = true; }
      if (b.action === 'unarchive') x.arch = false; if (b.action === 'act') { x.done = true; x.read = true; } if (b.action === 'snooze') x.snz = Date.now() + (b.minutes || 60) * 60000; });
    return send({ ok: true });
  };
  return S;
}
(async () => {
  await H.seed();
  const S = server();
  let o = await H.open('مركز_الإشعارات.html', { init: H.STAFF_INIT, wait: 3500 });
  await o.ctx.route('**/functions/v1/notify-inbox**', S.handle);
  await o.pg.reload(); await sleep(2500);
  let g = await o.pg.evaluate(() => ({ gate: !document.getElementById('gate').hidden, pw: !!document.getElementById('pw'), main: !document.getElementById('main').hidden }));
  ok(g.gate && g.pw && !g.main, 'جهاز غير موثَّق ⇒ بوابة «فعّل صندوق إشعاراتك» بكلمة السرّ (لا قائمة)');
  await o.pg.fill('#pw', 'خطأ'); await o.pg.click('#b-gate'); await sleep(800);
  const e1 = await o.pg.evaluate(() => ({ err: document.getElementById('g-err').textContent, tok: localStorage.getItem('gmt_inbox_token') }));
  ok(/غير صحيحة/.test(e1.err) && !e1.tok, 'كلمة سرّ خاطئة ⇒ رسالة ولا رمز');
  await o.pg.fill('#pw', 'سر123'); await o.pg.click('#b-gate'); await sleep(1500);
  const reg = S.calls.filter(c => c.action === 'register').pop();
  const l1 = await o.pg.evaluate(() => ({ main: !document.getElementById('main').hidden, n: document.querySelectorAll('#list .it').length, unread: document.querySelectorAll('#list .it.unread').length, tok: !!localStorage.getItem('gmt_inbox_token'), pwSaved: JSON.stringify(localStorage).includes('سر123') }));
  ok(reg && reg.via === 'user' && reg.user_id && l1.tok && !l1.pwSaved, 'التوثيق بحساب الموظّف نفسه · الرمز محفوظ · كلمة السرّ غير محفوظة على الجهاز');
  ok(l1.main && l1.n === 3 && l1.unread === 2, 'الصندوق: 3 إشعارات منها 2 غير مقروء: ' + JSON.stringify(l1));
  await o.pg.click('.tab[data-box="unread"]'); await sleep(700);
  ok(await o.pg.evaluate(() => document.querySelectorAll('#list .it').length) === 2, 'تبويب «غير المقروء» = 2');
  await o.pg.click('.tab[data-box="inbox"]'); await sleep(600);
  await o.pg.fill('#q', 'ORD-9'); await sleep(900);
  ok(await o.pg.evaluate(() => document.querySelectorAll('#list .it').length) === 1, 'البحث يصفّي النتائج');
  await o.pg.fill('#q', ''); await sleep(900);
  await o.pg.click('.it[data-id="2"] [data-a="read"]'); await sleep(700);
  ok(S.items.find(x => x.id === 2).read && !(await o.pg.evaluate(() => document.querySelector('.it[data-id="2"]').classList.contains('unread'))), 'علّمه مقروءاً ⇒ يُحفظ في الخادم ويتغيّر شكله');
  await o.pg.click('.it[data-id="1"] [data-a="archive"]'); await sleep(700);
  const a1 = await o.pg.evaluate(() => !!document.querySelector('#list .it[data-id="1"]'));
  await o.pg.click('.tab[data-box="archive"]'); await sleep(700);
  const a2 = await o.pg.evaluate(() => !!document.querySelector('#list .it[data-id="1"]'));
  ok(!a1 && a2, 'الأرشفة تنقله من الصندوق إلى «الأرشيف»');
  await o.browser.close();

  // ② الرئيسية: جرس بعدد غير المقروء + منبثقة الإجراء الحرج (لاحقاً = تأجيل)
  o = await H.open('home.html', { init: H.STAFF_INIT + ";localStorage.setItem('gmt_inbox_token','" + 'c'.repeat(64) + "')", wait: 3000 });
  await o.ctx.route('**/functions/v1/notify-inbox**', S.handle);
  await o.pg.reload(); await sleep(4500);
  const h = await o.pg.evaluate(() => { const b = document.querySelector('[data-gmt-bell] .gmt-bdg'); const p = document.getElementById('gmt-pop-bg'); return { badge: b && !b.hidden ? b.textContent : '', pop: p ? p.innerText : '' }; });
  ok(h.badge === '1', 'جرس الرئيسية يعرض عدد غير المقروء: ' + h.badge);
  ok(/مصروف بانتظار موافقتك/.test(h.pop) && /افتح الآن/.test(h.pop), 'المنبثقة الحرجة تظهر لما يحتاج إجراءً');
  await o.pg.click('#gmt-pop-bg .later'); await sleep(800);
  ok(S.items.find(x => x.id === 3).snz > Date.now() && !(await o.pg.evaluate(() => !!document.getElementById('gmt-pop-bg'))), '«لاحقاً» ⇒ تأجيل في الخادم وتختفي المنبثقة');
  const lg = await o.pg.evaluate(async () => { localStorage.removeItem('gmt_inbox_token'); const r = await GMTAccount.inboxReg({ via: 'user', user_id: 'u-1', pw: 'سر123' }); return { ok: r && r.ok, tok: localStorage.getItem('gmt_inbox_token') }; });
  ok(lg.ok && lg.tok === 'c'.repeat(64), 'الدخول الناجح يوثّق الجهاز تلقائياً (GMTAccount.inboxReg) بلا خطوة إضافية');
  const realErr = o.errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|vibrate|Estimating/.test(e));
  ok(!realErr.length, 'لا أخطاء JS: ' + realErr.slice(0, 2).join(' | '));
  await o.browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
