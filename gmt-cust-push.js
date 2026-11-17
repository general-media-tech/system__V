/* ═══════════════════════════════════════════════════════════════════════════
   gmt-cust-push.js — إشعارات الزبون لطلبه (مركز الإشعارات · المرحلة ٦ · TASK-B0424 · المالك seq 803/814)
   صفحة التتبّع فقط: بعد ظهور الطلب ⇐ «🔔 أعلمني بكل تحديث لطلبك» · يؤكّد الزبون رقم جواله المسجَّل في الطلب
   ⇐ يصله على جهازه: تأكيد الطلب · الشحن (الشركة ورقم التتبّع) · الوصول · رسائل الموظّف بخصوص طلبه.
   + «سجلّ إشعارات طلبك». لا حساب ولا تسجيل · طلبه هو فقط (الخادم يطابق الجوال) · إلغاء بضغطة.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTCustPush) return;
  var doc = global.document;
  function db() { return global.GMT_DB && global.GMT_DB.MAIN; }
  function call(body) {
    var d = db(); if (!d) return Promise.resolve({ ok: false, msg: 'إعداد غير متاح' });
    return fetch(d.url + '/functions/v1/customer-push', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: d.key, Authorization: 'Bearer ' + d.key }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, msg: 'ردّ غير مفهوم' }; }); })
      .catch(function () { return { ok: false, msg: 'تعذّر الاتصال — تحقّق من الإنترنت' }; });
  }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { return null; } }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function isIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function standalone() { return !!navigator.standalone || (global.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in global && 'Notification' in global; }
  function u8(s) { var pad = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')), o = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) o[i] = raw.charCodeAt(i); return o; }
  function ago(iso) { try { var d = new Date(iso); return d.toLocaleDateString('ar-SY-u-nu-latn', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('ar-SY-u-nu-latn', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }
  function phoneOf(id) { return ls('gmt_cust_ph_' + id) || ''; }

  async function subscribe(o, phone) {
    if (!supported()) return { ok: false, msg: isIOS() && !standalone() ? 'على الآيفون: أضف هذه الصفحة إلى الشاشة الرئيسية (مشاركة ⇐ «إضافة إلى الشاشة الرئيسية») ثمّ افتحها منها وفعّل' : 'متصفّحك لا يدعم الإشعارات' };
    var perm = await Notification.requestPermission(); if (perm !== 'granted') return { ok: false, msg: 'لم يُسمح بالإشعارات — اسمح بها من إعدادات المتصفّح ثمّ أعد المحاولة' };
    var reg = await navigator.serviceWorker.getRegistration(); if (!reg) reg = await navigator.serviceWorker.register('sw.js');
    reg = await navigator.serviceWorker.ready;
    var k = await call({ action: 'key' }); if (!k.ok) return k;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(k.key) });
    var r = await call({ action: 'subscribe', order_id: o.id, phone: phone, sub: sub.toJSON() });
    if (r.ok) { ls('gmt_cust_ph_' + o.id, phone); ls('gmt_cust_on_' + o.id, '1'); }
    return r;
  }
  async function unsubscribe(o) {
    try { var reg = await navigator.serviceWorker.getRegistration(), sub = reg && await reg.pushManager.getSubscription(); if (sub) { var js = sub.toJSON(); await call({ action: 'unsubscribe', endpoint: js.endpoint, auth: js.keys && js.keys.auth }); } } catch (_) {}
    ls('gmt_cust_on_' + o.id, null);
  }
  async function feed(o, box) {
    var ph = phoneOf(o.id); if (!ph) return;
    var r = await call({ action: 'feed', order_id: o.id, phone: ph }); var el = box.querySelector('[data-feed]'); if (!el) return;
    if (!r.ok) { el.innerHTML = ''; return; }
    el.innerHTML = (r.items || []).length ? '<div style="font-weight:900;font-size:12px;margin:10px 0 4px">🕘 سجلّ إشعارات طلبك</div>' + r.items.map(function (x) {
      return '<div style="border-top:1px solid #f1f1f1;padding:6px 0"><b style="font-size:12.5px">' + esc(x.t) + '</b><div style="font-size:12px;color:#4b5563">' + esc(x.b) + '</div><div style="font-size:10.5px;color:#9ca3af">' + ago(x.at) + '</div></div>';
    }).join('') : '<div style="font-size:11.5px;color:#6b7280;margin-top:8px">لا إشعارات بعد — سيصلك كلّ تحديث على طلبك هنا وعلى جهازك.</div>';
  }
  function mount(o) {
    if (!o || o.id == null) return;
    var card = doc.getElementById('resultCard'); if (!card) return;
    var box = doc.getElementById('cust-push'); if (box) box.remove();
    if (o.status === 'completed' || o.status === 'returned') return;
    box = doc.createElement('div'); box.id = 'cust-push';
    box.style.cssText = 'margin-top:14px;border:1px solid #f1d5d9;background:#fff;border-radius:18px;padding:12px 14px;font-family:Cairo,sans-serif;direction:rtl;text-align:right';
    var on = ls('gmt_cust_on_' + o.id) === '1';
    box.innerHTML = on
      ? '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:13px">🔔 إشعارات طلبك مفعّلة على هذا الجهاز</b><button type="button" data-off style="border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:5px 10px;font:700 11px Cairo,sans-serif;cursor:pointer">إيقاف</button></div><div data-feed></div>'
      : '<b style="display:block;font-size:13.5px">🔔 أعلمني بكل تحديث لطلبك</b><div style="font-size:11.5px;color:#6b7280;margin:2px 0 8px">تأكيد الطلب · الشحن ورقم التتبّع · الوصول · رسائلنا لك — على جهازك مباشرةً. أكّد رقم جوالك المسجَّل في الطلب:</div>' +
        '<div style="display:flex;gap:6px"><input data-ph type="tel" inputmode="tel" dir="ltr" placeholder="09xxxxxxxx" style="flex:1;min-width:0;border:1px solid #e5e7eb;border-radius:12px;padding:9px 10px;font:700 14px Cairo,sans-serif;text-align:left">' +
        '<button type="button" data-on style="border:0;background:#D5001C;color:#fff;border-radius:12px;padding:9px 14px;font:800 13px Cairo,sans-serif;cursor:pointer;white-space:nowrap">تفعيل</button></div><div data-msg style="font-size:11.5px;margin-top:6px"></div><div data-feed></div>';
    card.appendChild(box);
    var b = box.querySelector('[data-on]');
    if (b) b.onclick = async function () {
      var ph = box.querySelector('[data-ph]').value, msg = box.querySelector('[data-msg]');
      if (String(ph).replace(/\D/g, '').length < 9) { msg.style.color = '#D5001C'; msg.textContent = 'اكتب رقم جوالك كاملاً'; return; }
      b.disabled = true; msg.style.color = '#6b7280'; msg.textContent = 'جارٍ التفعيل…';
      var r = await subscribe(o, ph).catch(function (e) { return { ok: false, msg: (e && e.message) || 'تعذّر التفعيل' }; });
      b.disabled = false;
      if (r && r.ok) { mount(o); } else { msg.style.color = '#D5001C'; msg.textContent = (r && r.msg) || 'تعذّر التفعيل'; }
    };
    var off = box.querySelector('[data-off]'); if (off) off.onclick = async function () { await unsubscribe(o); mount(o); };
    feed(o, box);
  }
  global.GMTCustPush = { mount: mount, subscribe: subscribe, unsubscribe: unsubscribe };
  /* صفحة التتبّع ترسم الطلب عبر showTimeline(o …) ⇒ نلحق بها دون تعديل منطقها */
  function hook() {
    if (typeof global.showTimeline !== 'function' || global.showTimeline.__cust) return;
    var orig = global.showTimeline;
    global.showTimeline = function (o) { var r = orig.apply(this, arguments); try { mount(o); } catch (_) {} return r; };
    global.showTimeline.__cust = true;
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', hook); else hook();
})(window);
