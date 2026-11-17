/* ═══════════════════════════════════════════════════════════════════════════
   gmt-inbox.js — صندوق الإشعارات (مركز الإشعارات · المرحلة ١–٢ · TASK-B0424 · المالك seq 803/808)
   • كلّ إشعار يُحفظ لكلّ مستلم في القاعدة (gmt_notifications) — مقروء/غير مقروء · أرشفة · تأجيل · تمّ الإجراء.
   • الجهاز يُوثَّق مرّةً (عند الدخول بكلمة السرّ — gmt-account.js · أو باشتراك الإشعارات القائم) فيأخذ رمزاً
     يقرأ به صندوق صاحبه وحده عبر الدالّة notify-inbox. لا أحد يرى إشعارات غيره.
   • الجرس: أيّ عنصر [data-gmt-bell] يأخذ عدّاد غير المقروء. المنبثقة الحرجة (تحتاج إجراءً) لا تختفي قبل الإجراء أو التأجيل.
   • لا شيء إطلاقاً في صفحات الزبون · لا زرّ عائم.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTInbox) return;
  var doc = global.document;
  var PUBLIC = !!global.GMT_PUBLIC || /(^|\/)(store|site|search|track_order|guarantee|hiring)\.html$/i.test(location.pathname);
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { return null; } }
  function db() { return global.GMT_DB && global.GMT_DB.MAIN; }
  function token() { return ls('gmt_inbox_token') || ''; }
  function call(body) {
    var d = db(); if (!d) return Promise.resolve({ ok: false, msg: 'إعداد القاعدة غير متاح' });
    return fetch(d.url + '/functions/v1/notify-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: d.key, Authorization: 'Bearer ' + d.key }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, msg: 'ردّ غير مفهوم' }; }); })
      .then(function (j) { if (j && j.err === 'token') { ls('gmt_inbox_token', null); } return j; })
      .catch(function () { return { ok: false, offline: true, msg: 'تعذّر الاتصال — تحقّق من الإنترنت' }; });
  }
  function withToken(o) { o.token = token(); return o.token ? call(o) : Promise.resolve({ ok: false, err: 'token', msg: 'الجهاز غير موثَّق' }); }

  /* توثيقٌ بلا كلمة سرّ: اشتراك الإشعارات القائم على هذا الجهاز يثبت هويّته (الخادم يطابق endpoint+auth) */
  async function viaPush() {
    try {
      if (!('serviceWorker' in navigator)) return null;
      /* serviceWorker.ready لا يُحلّ أبداً إن لم يُسجَّل عامل خدمة ⇒ مهلةٌ قصيرة كي لا تتعلّق الصفحة */
      var reg = await Promise.race([navigator.serviceWorker.ready, new Promise(function (r) { setTimeout(function () { r(null); }, 2500); })]);
      var sub = reg && reg.pushManager && await reg.pushManager.getSubscription(); if (!sub) return null;
      var js = sub.toJSON(); if (!js || !js.keys || !js.keys.auth) return null;
      var r = await call({ action: 'register', via: 'push', endpoint: js.endpoint, auth: js.keys.auth });
      if (r && r.ok && r.token) { ls('gmt_inbox_token', r.token); ls('gmt_inbox_rcpt', r.recipient || ''); }
      return r;
    } catch (_) { return null; }
  }
  /* توثيقٌ بكلمة السرّ من صفحة المركز (للأجهزة التي دخلت قبل هذه الميزة) */
  async function viaPassword(pw, adminName) {
    var s = null; try { s = JSON.parse(ls('gmt_session') || 'null'); } catch (_) {}
    var adm = false; try { adm = !!(global.GMTRole && GMTRole.isAdmin && GMTRole.isAdmin()); } catch (_) {}
    var body = adm || adminName ? { action: 'register', via: 'admin', name: adminName || (global.GMTRole && GMTRole.name && GMTRole.name()) || '', pw: pw }
      : (s && s.id ? { action: 'register', via: 'user', user_id: String(s.id), pw: pw } : null);
    if (!body) return { ok: false, msg: 'سجّل الدخول بحسابك أوّلاً' };
    var r = await call(body);
    if (r && r.ok && r.token) { ls('gmt_inbox_token', r.token); ls('gmt_inbox_rcpt', r.recipient || ''); paint(); }
    return r;
  }

  var last = { unread: 0, popup: null }, timer = null, shownPopup = Number(ls('gmt_inbox_popup_seen') || 0);
  function badge(n) {
    var els = doc.querySelectorAll('[data-gmt-bell]');
    for (var i = 0; i < els.length; i++) {
      var b = els[i].querySelector('.gmt-bdg');
      if (!b) { b = doc.createElement('i'); b.className = 'gmt-bdg'; els[i].appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n || ''); b.hidden = !n;
      els[i].setAttribute('aria-label', n ? 'الإشعارات — ' + n + ' غير مقروء' : 'الإشعارات');
    }
  }
  async function paint() {
    if (PUBLIC) return last;
    if (!token()) { await viaPush(); if (!token()) { badge(0); return last; } }
    var r = await withToken({ action: 'count' });
    if (r && r.ok) {
      last = r; badge(r.unread);
      try { doc.dispatchEvent(new CustomEvent('gmt:inbox', { detail: r })); } catch (_) {}
      if (r.popup && r.popup !== shownPopup) popup(r.popup);
    }
    return last;
  }
  function css() {
    if (doc.getElementById('gmt-inbox-css')) return;
    var st = doc.createElement('style'); st.id = 'gmt-inbox-css';
    st.textContent = '[data-gmt-bell]{position:relative;display:inline-flex;align-items:center;justify-content:center}' +
      '.gmt-bdg{position:absolute;top:-4px;inset-inline-end:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#D5001C;color:#fff;font:800 11px/18px Cairo,sans-serif;font-style:normal;text-align:center;box-shadow:0 0 0 2px #fff}' +
      '.gmt-pop-bg{position:fixed;inset:0;background:rgba(17,17,17,.45);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:16px;font-family:Cairo,sans-serif;direction:rtl}' +
      '@media(min-width:700px){.gmt-pop-bg{align-items:center}}' +
      '.gmt-pop{background:#fff;color:#111;border-radius:18px;max-width:420px;width:100%;padding:18px;border-top:4px solid #D5001C;box-shadow:0 20px 50px rgba(0,0,0,.3)}' +
      '.gmt-pop b{display:block;font-size:16px;margin-bottom:4px}.gmt-pop p{margin:0 0 14px;color:#4b5563;font-size:13px;line-height:1.7}' +
      '.gmt-pop .row{display:flex;gap:8px}.gmt-pop button{flex:1;border:0;border-radius:12px;padding:11px;font:800 13px Cairo,sans-serif;cursor:pointer}' +
      '.gmt-pop .go{background:#D5001C;color:#fff}.gmt-pop .later{background:#f3f4f6;color:#111}' +
      '@media (prefers-reduced-motion:no-preference){.gmt-pop{animation:gmtPopIn .18s ease-out}}@keyframes gmtPopIn{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}';
    doc.head.appendChild(st);
  }
  /* المنبثقة: لإشعارٍ يحتاج إجراءً (مثل مصروف بانتظار الموافقة) — تبقى حتى «افتح» (يُسجَّل الإجراء) أو «لاحقاً» (تأجيل 30 دقيقة) */
  async function popup(id) {
    if (doc.getElementById('gmt-pop-bg') || global.GMT_INBOX_PAGE) return;   /* في صفحة المركز نفسها يظهر الإشعار في القائمة — لا منبثقة فوقها */
    var r = await withToken({ action: 'list', box: 'inbox', limit: 30 });
    var it = r && r.ok && (r.items || []).filter(function (x) { return x.id === id; })[0]; if (!it) return;
    shownPopup = id; ls('gmt_inbox_popup_seen', String(id)); css();
    var bg = doc.createElement('div'); bg.className = 'gmt-pop-bg'; bg.id = 'gmt-pop-bg'; bg.setAttribute('role', 'alertdialog');
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    bg.innerHTML = '<div class="gmt-pop"><b>' + esc(it.t) + '</b><p>' + esc(it.b) + '</p><div class="row"><button class="go" type="button">افتح الآن</button><button class="later" type="button">لاحقاً</button></div></div>';
    doc.body.appendChild(bg);
    try { global.GMTSound && GMTSound.cue && GMTSound.cue('notify'); } catch (_) {}
    bg.querySelector('.go').onclick = function () { withToken({ action: 'act', ids: [id] }).then(function () { location.href = it.u || 'مركز_الإشعارات.html'; }); };
    bg.querySelector('.later').onclick = function () { bg.remove(); withToken({ action: 'snooze', ids: [id], minutes: 30 }).then(function () { shownPopup = 0; ls('gmt_inbox_popup_seen', null); }); };
  }
  function start() {
    if (PUBLIC || timer) return;
    css(); paint();
    /* الصفحات التي تعيد رسم رأسها (الرئيسية) تُنشئ جرساً جديداً بلا عدّاد ⇒ نعيد وضعه */
    try {
      var mo = new MutationObserver(function () {
        var b = doc.querySelector('[data-gmt-bell]:not([data-gmt-bdg])'); if (!b) return;
        var all = doc.querySelectorAll('[data-gmt-bell]'); for (var i = 0; i < all.length; i++) all[i].setAttribute('data-gmt-bdg', '1');
        badge(last.unread || 0);
      });
      mo.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    timer = setInterval(function () { if (doc.visibilityState === 'visible') paint(); }, 60000);
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible') paint(); });
    global.addEventListener('gmt-push', function () { setTimeout(paint, 1500); });
    doc.addEventListener('gmt:inbox-ready', paint);
  }

  global.GMTInbox = {
    ready: function () { return !!token(); }, paint: paint, viaPush: viaPush, viaPassword: viaPassword,
    count: function () { return withToken({ action: 'count' }); },
    list: function (o) { return withToken(Object.assign({ action: 'list' }, o || {})); },
    act: function (action, ids, extra) { return withToken(Object.assign({ action: action }, ids === 'all' ? { all: true } : { ids: [].concat(ids) }, extra || {})).then(function (r) { paint(); return r; }); },
    logout: function () { return withToken({ action: 'logout' }).then(function () { ls('gmt_inbox_token', null); badge(0); }); }
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(window);
