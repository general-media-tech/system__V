/* ═══════════════════════════════════════════════════════════════════════════
   gmt-push.js — الإشعارات الفوريّة (Web Push) لنقطة البيع والأوردرات
   (TASK-B0420 · المالك seq 794 «نظام إشعارات متل كل التطبيقات: أوردر · تحديث · عرض · تغيير سعر · فاتورة نقل — للنقطة»)
   الخطّة: docs/دراسة_الإشعارات_الفورية.md · الخلفيّة: Edge Functions push-subscribe/push-dispatch + Triggers (tools/push/).
   قواعد: لا شيء إطلاقاً في صفحات الزبون · الإذن يُطلب من **لمسة** فقط · لا زرّ عائم · الصوت من gmt-sound.js ·
   التطبيق مفتوح ⇒ حدثٌ 'gmt-push' تتفاعل معه الصفحة (تحديث الوارد/العروض/الأسعار/الأوردرات) + صوت + شريط 6 ث.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTPush) return;
  var doc = global.document, LS = global.localStorage;
  var PUBLIC = !!global.GMT_PUBLIC || /(^|\/)(store|site|search|track_order|guarantee)\.html$/i.test(location.pathname);
  var KINDS = [['order', '🛒 الأوردرات الجديدة'], ['offer', '🎁 العروض والباقات'], ['price', '💲 تغيير الأسعار'], ['transfer', '📦 فواتير النقل'], ['version', '🔄 تحديثات النظام'], ['expense', '💸 مصاريف بانتظار الموافقة (للأدمن)']];
  var CUE = { order: 'order', transfer: 'truck', offer: 'notify', price: 'notify', version: 'update', expense: 'notify', transfer_aging: 'notify', test: 'success' };
  function lsGet(k, d) { try { var v = LS.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function lsSet(k, v) { try { LS.setItem(k, v); } catch (_) {} }
  function session() { try { return JSON.parse(lsGet('gmt_session', 'null')) || null; } catch (_) { return null; } }
  function db() { return global.GMT_DB && global.GMT_DB.MAIN; }
  function fnUrl() { var d = db(); return d ? d.url + '/functions/v1/push-subscribe' : ''; }
  function anon() { var d = db(); return d ? d.key : ''; }
  function call(body) {
    var u = fnUrl(); if (!u) return Promise.resolve({ ok: false, msg: 'إعداد القاعدة غير متاح' });
    return fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon(), Authorization: 'Bearer ' + anon() }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, msg: 'ردّ غير مفهوم' }; }); })
      .catch(function () { return { ok: false, msg: 'تعذّر الاتصال — تحقّق من الإنترنت' }; });
  }
  function b64urlToU8(s) { var pad = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')), o = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
  function isIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function standalone() { return !!navigator.standalone || (global.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function platform() { return /Android/i.test(navigator.userAgent) ? 'android' : isIOS() ? 'ios' : 'desktop'; }
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in global && 'Notification' in global; }
  function getReg() { return navigator.serviceWorker.ready; }
  function prefsOf() { try { return JSON.parse(lsGet('gmt_push_prefs', '{}')) || {}; } catch (_) { return {}; } }
  function topicsStored() { try { return JSON.parse(lsGet('gmt_push_topics', '[]')) || []; } catch (_) { return []; } }

  /* الحالة: unsupported · ios-install · denied · off · on */
  async function status() {
    if (PUBLIC) return 'unsupported';
    if (!supported()) return (isIOS() && !standalone()) ? 'ios-install' : 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try { var reg = await getReg(), sub = await reg.pushManager.getSubscription(); if (sub && lsGet('gmt_push_on', '') === '1') return 'on'; } catch (_) {}
    return 'off';
  }

  function whoAmI() { var s = session(); return s && s.id ? { user_id: String(s.id), username: s.username || '', branch_key: s.branch_key || null } : null; }

  async function enable(topics) {
    var me = whoAmI(); if (!me) return { ok: false, msg: 'سجّل الدخول بحسابك أوّلاً ثمّ فعّل الإشعارات' };
    if (!supported()) return { ok: false, msg: 'جهازك أو متصفّحك لا يدعم الإشعارات' };
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, msg: 'لم يُمنح الإذن — يمكنك السماح من إعدادات الموقع في المتصفّح' };
    var keyRes = lsGet('gmt_push_vapid', '') ? { ok: true, key: lsGet('gmt_push_vapid', '') } : await call({ action: 'key' });
    if (!keyRes.ok || !keyRes.key) return { ok: false, msg: keyRes.msg || 'تعذّر جلب مفتاح الإشعارات' };
    lsSet('gmt_push_vapid', keyRes.key);
    var reg = await getReg(), sub = await reg.pushManager.getSubscription();
    if (!sub) { try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToU8(keyRes.key) }); } catch (e) { return { ok: false, msg: 'تعذّر الاشتراك: ' + ((e && e.message) || 'خطأ') }; } }
    var all = topicsStored(); (topics || ['pos']).forEach(function (t) { if (all.indexOf(t) === -1) all.push(t); });
    var j = sub.toJSON(), body = Object.assign({ action: 'subscribe', sub: { endpoint: j.endpoint, keys: j.keys }, topics: all, prefs: prefsOf(), platform: platform() }, me);
    var r = await call(body);
    if (!r.ok) return { ok: false, msg: r.msg || 'تعذّر تسجيل الجهاز' };
    lsSet('gmt_push_on', '1'); lsSet('gmt_push_sync', String(Date.now())); lsSet('gmt_push_topics', JSON.stringify(all));
    try { var ctl = (reg.active || navigator.serviceWorker.controller); if (ctl) ctl.postMessage({ type: 'gmt-push-cfg', cfg: { fn: fnUrl(), anon: anon(), vapid: keyRes.key, sub: { user_id: me.user_id, username: me.username, branch_key: me.branch_key, topics: all, prefs: prefsOf(), platform: platform() }, old: { endpoint: j.endpoint, auth: j.keys.auth } } }); } catch (_) {}
    return { ok: true };
  }
  async function disable() {
    try { var reg = await getReg(), sub = await reg.pushManager.getSubscription();
      if (sub) { var j = sub.toJSON(); await call({ action: 'unsubscribe', endpoint: j.endpoint, auth: j.keys.auth }); await sub.unsubscribe(); } } catch (_) {}
    lsSet('gmt_push_on', ''); return { ok: true };
  }
  async function currentSub() { var reg = await getReg(), sub = await reg.pushManager.getSubscription(); if (!sub) return null; var j = sub.toJSON(); return { endpoint: j.endpoint, auth: j.keys.auth }; }
  async function setPref(kind, on) {
    var p = prefsOf(); p[kind] = !!on; lsSet('gmt_push_prefs', JSON.stringify(p));
    try { var s = await currentSub(); if (s) await call({ action: 'prefs', endpoint: s.endpoint, auth: s.auth, prefs: p }); } catch (_) {}
  }
  async function test() { var s = await currentSub(); if (!s) return { ok: false, msg: 'الجهاز غير مشترك' }; return call({ action: 'test', endpoint: s.endpoint, auth: s.auth }); }
  /* مزامنة أسبوعيّة (أو عند تغيّر الحساب/الفرع) — تُبقي last_seen_at وتنقل الاشتراك للمستخدم الجديد */
  async function resync() {
    if (PUBLIC || !supported() || lsGet('gmt_push_on', '') !== '1') return;
    var me = whoAmI(); if (!me) return;
    var last = Number(lsGet('gmt_push_sync', '0')), who = me.user_id + '|' + me.branch_key;
    if (Date.now() - last < 7 * 86400000 && lsGet('gmt_push_who', who) === who) { lsSet('gmt_push_who', who); return; }
    lsSet('gmt_push_who', who); var r = await enable(topicsStored().length ? topicsStored() : ['pos']); if (!r.ok) lsSet('gmt_push_sync', String(Date.now() - 6 * 86400000));
  }

  /* ── الواجهة ── */
  var CSS = '#gmt-push-ov{position:fixed;inset:0;z-index:2147482600;background:rgba(15,18,25,.5);display:grid;place-items:center;padding:12px;direction:rtl;font-family:Cairo,Tajawal,Tahoma,sans-serif}' +
    '#gmt-push-ov .bx{width:100%;max-width:420px;max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:16px;box-sizing:border-box}' +
    '#gmt-push-ov h3{margin:0 0 8px;font-size:17px}#gmt-push-ov p{margin:6px 0;font-size:13px;color:#4b5563;line-height:1.7}' +
    '#gmt-push-ov .go{width:100%;margin-top:8px;background:#D5001C;color:#fff;border:0;border-radius:12px;padding:12px;font:inherit;font-weight:800;font-size:14px;cursor:pointer}#gmt-push-ov .go.sec{background:#f1f5f9;color:#0f172a}' +
    '#gmt-push-ov label.tg{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #f1f5f9;font-size:13.5px;font-weight:700}#gmt-push-ov label.tg input{width:18px;height:18px;accent-color:#D5001C}' +
    '#gmt-push-ov .msg{min-height:1.2em;font-size:12.5px;font-weight:800;color:#b91c1c;margin-top:6px}#gmt-push-ov .msg.ok{color:#067647}';
  function ensureCss() { if (!doc.getElementById('gmt-push-css')) { var s = doc.createElement('style'); s.id = 'gmt-push-css'; s.textContent = CSS; doc.head.appendChild(s); } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  async function openPanel(topics) {
    if (PUBLIC) return; ensureCss();
    var old = doc.getElementById('gmt-push-ov'); if (old) old.remove();
    var ov = doc.createElement('div'); ov.id = 'gmt-push-ov'; ov.setAttribute('data-nosound', '');
    async function paint() {
      var st = await status(), h = '<div class="bx"><h3>🔔 الإشعارات</h3>';
      if (st === 'unsupported') h += '<p>جهازك أو متصفّحك لا يدعم الإشعارات — استعمل Chrome على أندرويد أو الكمبيوتر.</p>';
      else if (st === 'ios-install') h += '<p>على آيفون تعمل الإشعارات فقط للتطبيق المثبَّت:</p><p>١) زرّ المشاركة ⇐ ٢) «أضف إلى الشاشة الرئيسية» ⇐ ٣) افتح GMT من الأيقونة ثمّ اضغط «فعّل الإشعارات». (يتطلّب iOS 16.4 أو أحدث)</p>';
      else if (st === 'denied') h += '<p>الإذن مرفوض من المتصفّح. افتح إعدادات الموقع ⇐ الإشعارات ⇐ «سماح» ثمّ أعد فتح هذه النافذة.</p>';
      else if (st === 'off') h += '<p>فعّل الإشعارات لتصلك الأوردرات والعروض وتغيّر الأسعار وفواتير النقل <b>حتى والتطبيق مغلق</b>.</p><button class="go" data-en>🔔 فعّل الإشعارات</button>';
      else { var p = prefsOf(); h += '<p>✅ مفعَّلة على هذا الجهاز. اختر ما يصلك:</p>' + KINDS.map(function (k) { return '<label class="tg"><input type="checkbox" data-k="' + k[0] + '"' + (p[k[0]] === false ? '' : ' checked') + '>' + esc(k[1]) + '</label>'; }).join('') + '<button class="go sec" data-test>أرسل إشعار تجربة</button><button class="go sec" data-off>أوقف الإشعارات على هذا الجهاز</button>'; }
      h += '<div class="msg" data-msg></div><button class="go sec" data-close>إغلاق</button></div>'; ov.innerHTML = h;
      var $ = function (q) { return ov.querySelector(q); }, say = function (t, ok) { var m = $('[data-msg]'); if (m) { m.textContent = t; m.className = 'msg' + (ok ? ' ok' : ''); } };
      $('[data-close]').onclick = function () { ov.remove(); };
      if ($('[data-en]')) $('[data-en]').onclick = async function () { say('جارٍ التفعيل…', true); var r = await enable(topics || ['pos']); if (r.ok) { try { global.GMTSound && GMTSound.play('success'); } catch (_) {} paint(); } else say(r.msg); };
      if ($('[data-test]')) $('[data-test]').onclick = async function () { say('جارٍ الإرسال…', true); var r = await test(); say(r.ok ? 'أُرسل إشعار التجربة — انتظر ثوانٍ' : (r.msg || 'تعذّر الإرسال'), r.ok); };
      if ($('[data-off]')) $('[data-off]').onclick = async function () { await disable(); paint(); };
      ov.querySelectorAll('input[data-k]').forEach(function (i) { i.onchange = function () { setPref(i.getAttribute('data-k'), i.checked); }; });
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    doc.body.appendChild(ov); await paint();
  }
  /* السطر التعريفي: مرّةً كلّ 7 أيّام إن كانت الحالة off/ios-install — شريطٌ علويّ لا عائم */
  async function mountCTA(topics) {
    if (PUBLIC) return;
    try {
      var st = await status(); if (st !== 'off' && st !== 'ios-install') return;
      if (Date.now() - Number(lsGet('gmt_push_cta', '0')) < 7 * 86400000) return;
      ensureCss(); var b = doc.createElement('div'); b.id = 'gmt-push-cta'; b.setAttribute('data-nosound', '');
      b.style.cssText = 'background:#111;color:#fff;font:700 12.5px Cairo,sans-serif;padding:8px 12px;display:flex;gap:8px;align-items:center;direction:rtl';
      b.innerHTML = '<span style="flex:1">🔔 فعّل الإشعارات لتصلك الأوردرات وفواتير النقل حتى والتطبيق مغلق</span><button data-y style="background:#D5001C;color:#fff;border:0;border-radius:8px;padding:5px 10px;font:inherit;cursor:pointer">فعّل</button><button data-n style="background:transparent;color:#cbd5e1;border:0;font:inherit;cursor:pointer">لاحقاً</button>';
      b.querySelector('[data-y]').onclick = function () { b.remove(); openPanel(topics); };
      b.querySelector('[data-n]').onclick = function () { lsSet('gmt_push_cta', String(Date.now())); b.remove(); };
      doc.body.insertBefore(b, doc.body.firstChild);
    } catch (_) {}
  }

  /* ── استقبال ما يصل من عامل الخدمة ── */
  function strip(d) {
    try {
      var s = doc.getElementById('gmt-push-strip'); if (s) s.remove();
      s = doc.createElement('div'); s.id = 'gmt-push-strip'; s.setAttribute('data-nosound', '');
      s.style.cssText = 'position:sticky;top:0;z-index:2147482400;background:#D5001C;color:#fff;font:800 13px Cairo,sans-serif;padding:8px 12px;direction:rtl;cursor:pointer';
      s.textContent = (d.t || '') + ' — ' + (d.b || ''); s.onclick = function () { s.remove(); global.dispatchEvent(new CustomEvent('gmt-push-open', { detail: { u: d.u } })); };
      doc.body.insertBefore(s, doc.body.firstChild); setTimeout(function () { try { s.remove(); } catch (_) {} }, 6000);
    } catch (_) {}
  }
  if (!PUBLIC && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      var m = e.data || {};
      if (m.type === 'gmt-push' && m.d) {
        global.dispatchEvent(new CustomEvent('gmt-push', { detail: m.d }));
        try { var key = CUE[m.d.k] || 'notify'; if (global.GMTAudio) { if (!(GMTAudio.emit && GMTAudio.emit(key, { force: true }))) GMTAudio.play(key, { force: true }); } } catch (_) {}
        strip(m.d);
      } else if (m.type === 'gmt-push-open') global.dispatchEvent(new CustomEvent('gmt-push-open', { detail: { u: m.u } }));
    });
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible') { try { navigator.serviceWorker.ready.then(function (r) { r.active && r.active.postMessage({ type: 'gmt-badge-clear' }); }); } catch (_) {} } });
    if (doc.readyState === 'complete') setTimeout(resync, 3000); else global.addEventListener('load', function () { setTimeout(resync, 3000); });
  }
  global.GMTPush = { status: status, enable: enable, disable: disable, setPref: setPref, test: test, resync: resync, openPanel: openPanel, mountCTA: mountCTA, KINDS: KINDS };
})(window);
