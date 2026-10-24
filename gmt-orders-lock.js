/* ═══════════════════════════════════════════════════════════════════════════
   gmt-orders-lock.js — «قفل الأوردرات» في مكانٍ سهل
   أُنشئ: 2026-10-17 · طلب المالك: «مفتاح قفل الأوردرات يكون في مكان أسهل».

   كان المفتاح مدفوناً في «الأمان والمستخدمون ← سياسات التشغيل»، ولا شيء في صفحة الأوردرات يقول للموظّف
   إنّه مُفعَّل — فيفاجئه الرفض عند «شحن». الآن:
     ① شارة في ترويسة الأوردرات بجانب حالة الاتصال: «القفل: مُفعَّل / مُعطَّل» يراها الجميع.
     ② نقرة **أدمن مسمّى** ⇒ تأكيد يشرح الأثر ⇒ GMTEndpoint.setSetting (يتحقّق بإعادة القراءة) ⇒ سطر في السجلّ.
        نقرة الموظّف ⇒ شرحٌ فقط (ومن يملك حساب أدمن يدخل من نفس النافذة).
     ③ رسالة الحجب صارت بأزرار: [افتح فاتورة] [(أدمن) ألغِ القفل الآن].
   المصدر واحد: نفس المفتاح gmt_settings.orders_lock الذي تكتبه بطاقة «سياسات التشغيل» — فأيّ تغيير من هناك
   أو من جهازٍ آخر يظهر هنا عند الفتح/العودة للصفحة/كل ٦٠ث. ولا نصدّق الحالة من الكاش: القراءة طازجة دائماً.
   الاستعمال: GMTOrdersLock.mount(afterEl) · get() · set(on) · toggle() · blocked(msg, order) · state
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTOrdersLock) return;

  var KEY = 'orders_lock', BY_KEY = 'orders_lock_by';
  var S = { on: null, by: '', at: '', readAt: 0, err: '' };     /* on=null ⇒ لم نعرف بعد (لا نخمّن) */
  var badge = null, timer = null, busy = false;

  function db() { try { return (g.GMT_DB && g.GMT_DB.MAIN) || null; } catch (_) { return null; } }
  function say(msg, kind) {
    try { if (typeof g.showToast === 'function') return g.showToast(msg, kind || 'ok'); } catch (_) {}
    try { if (g.GMTAsk) g.GMTAsk.alert(msg); } catch (_) {}
  }
  function adminName() { try { return (g.GMTRole && g.GMTRole.isAdmin() && g.GMTRole.name()) || ''; } catch (_) { return ''; } }
  function fmtAt(iso) { try { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ar-SY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } }

  /* قراءة طازجة للمفتاحين — تفشل بصدق (on يبقى آخر قيمة معروفة لكن err يُعلَّم) */
  async function get() {
    var d = db();
    if (!d) { S.err = 'إعدادات القاعدة غير متاحة'; paint(); return S.on; }
    try {
      var r = await fetch(d.url + '/rest/v1/gmt_settings?select=key,value&key=like.orders_lock*', {
        headers: { apikey: d.key, Authorization: 'Bearer ' + d.key }, cache: 'no-store'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = await r.json(), on = false, by = '';
      (rows || []).forEach(function (x) { if (x.key === KEY) on = String(x.value) === '1'; if (x.key === BY_KEY) by = String(x.value || ''); });
      S.on = on; S.err = ''; S.readAt = Date.now();
      var p = by.split('|'); S.by = p[0] || ''; S.at = p[1] || '';
    } catch (e) { S.err = (e && e.message) || 'تعذّر الاتصال'; }
    paint();
    return S.on;
  }

  /* يكتب القيمة ويتحقّق بإعادة القراءة (GMTEndpoint.setSetting). يرجع {ok, why} — لا «تمّ» على كتابة لم تثبت */
  async function set(on) {
    if (!g.GMTEndpoint || !g.GMTEndpoint.setSetting) return { ok: false, why: 'وحدة الإعدادات غير محمَّلة — حدّث الصفحة' };
    var r = await g.GMTEndpoint.setSetting(KEY, on ? '1' : '0');
    if (!r || !r.system) return { ok: false, why: (r && r.why) || 'لم يُحفَظ' };
    S.on = !!on; S.err = ''; S.readAt = Date.now();
    var who = adminName() || '';
    S.by = who; S.at = new Date().toISOString();
    /* «آخر تغيير» — أفضل جهد: فشله لا يُلغي القفل نفسه الذي ثبت فعلاً */
    try { await g.GMTEndpoint.setSetting(BY_KEY, who + '|' + S.at); } catch (_) {}
    paint();
    return { ok: true };
  }

  var EFFECT_ON = 'عند التفعيل: لا يتقدّم أيّ أوردر غير مُفوتَر إلى «محضّرة / في الطريق / بانتظار التحصيل / تم التحصيل» — على كل الأجهزة. يبقى الإنشاء والتعديل في «قيد التجهيز» مسموحاً.';
  var EFFECT_OFF = 'عند الإلغاء: تتقدّم الأوردرات في مراحلها حتى لو لم تُفتح لها فاتورة بعد.';

  /* نقرة الشارة */
  async function toggle() {
    if (busy) return;
    if (S.on === null || S.err) await get();
    var name = adminName();
    var nowTxt = S.on === null ? 'غير معروفة الآن (' + (S.err || 'لا اتصال') + ')' : (S.on ? 'مُفعَّل 🔒' : 'مُعطَّل 🔓');
    var last = S.by || S.at ? '\nآخر تغيير: ' + (S.by || '—') + (S.at ? ' · ' + fmtAt(S.at) : '') : '';
    if (!name) {
      /* الموظّف: شرحٌ فقط. ومن يملك حساب أدمن يدخل من هنا ثم يكمل */
      var k = await g.GMTAsk.choose('حالة «قفل الأوردرات»: ' + nowTxt + last + '\n\n' + (S.on ? EFFECT_ON : EFFECT_OFF) +
        '\n\nتغيير القفل للأدمن المسمّى فقط.', {
        title: 'قفل الأوردرات', icon: 'info',
        choices: [{ k: 'admin', t: '🔑 أنا أدمن — دخول' }], cancelText: 'حسناً'
      });
      if (k !== 'admin') return;
      if (!g.GMTRole || !(await g.GMTRole.requireAdmin('تغيير قفل الأوردرات'))) return;
      name = adminName();
      if (!name) { await g.GMTAsk.alert('دخلت بجلسة أدمن بلا اسم — تغيير القفل يحتاج حساب أدمن باسمه. اخرج وادخل باسمك.', { title: 'قفل الأوردرات', icon: 'danger' }); return; }
    }
    if (S.on === null) { await g.GMTAsk.alert('تعذّر قراءة حالة القفل الآن (' + (S.err || 'لا اتصال') + '). لن نغيّر شيئاً قبل أن نعرف الحالة الفعلية — أعد المحاولة بعد عودة الاتصال.', { title: 'قفل الأوردرات', icon: 'danger' }); return; }
    var next = !S.on;
    var ok = await g.GMTAsk.confirm((next ? EFFECT_ON : EFFECT_OFF) + last + '\n\nسيُسجَّل التغيير باسمك: ' + name + '.', {
      title: next ? 'تفعيل قفل الأوردرات' : 'إلغاء قفل الأوردرات', okText: next ? '🔒 فعّل القفل' : '🔓 ألغِ القفل', danger: next
    });
    if (!ok) return;
    busy = true; paint();
    try {
      var r = await set(next);
      if (r.ok) say(next ? '🔒 فُعِّل قفل الأوردرات — يسري الآن على كل الأجهزة' : '🔓 أُلغي قفل الأوردرات', 'ok');
      else await g.GMTAsk.alert('لم يتغيّر القفل: ' + r.why + '\nالحالة كما هي: ' + (S.on ? 'مُفعَّل' : 'مُعطَّل') + '.', { title: 'لم يُحفَظ', icon: 'danger' });
    } finally { busy = false; paint(); }
  }

  /* رسالة الحجب (من ordersLockBlock) بأزرار: افتح فاتورة · (أدمن) ألغِ القفل الآن. يرجع true إن أُلغي القفل (فيُعاد الإجراء) */
  async function blocked(msg, order) {
    if (!g.GMTAsk || !g.GMTAsk.choose) { try { g.GMTAsk.alert(msg); } catch (_) {} return false; }
    var name = adminName();
    var choices = [{ k: 'inv', t: '🧾 افتح فاتورة', pri: 1 }];
    choices.push({ k: 'unlock', t: name ? '🔓 ألغِ القفل الآن' : '🔓 (أدمن) ألغِ القفل الآن' });
    var k = await g.GMTAsk.choose(msg, { title: 'الأوردر غير مُفوتَر', icon: 'danger', choices: choices, cancelText: 'حسناً' });
    if (k === 'inv') {
      var ref = order ? String(order.serial_code || order.name || '') : '';
      var copied = false;
      try { if (ref && navigator.clipboard) { await navigator.clipboard.writeText(ref); copied = true; } } catch (_) {}
      say(copied ? '📋 نُسخ «' + ref + '» — الصقه في «بحث الأوردرات» بنقطة البيع ثم «حوّل لفاتورة»' : 'في نقطة البيع: ابحث عن الأوردر ' + ref + ' ثم «حوّل لفاتورة»', 'ok');
      setTimeout(function () { location.href = 'pos.html'; }, 900);
      return false;
    }
    if (k === 'unlock') {
      if (!adminName()) {
        if (!g.GMTRole || !(await g.GMTRole.requireAdmin('إلغاء قفل الأوردرات'))) return false;
        if (!adminName()) { await g.GMTAsk.alert('إلغاء القفل يحتاج حساب أدمن باسمه — جلسة الأدمن الحالية بلا اسم.', { title: 'قفل الأوردرات', icon: 'danger' }); return false; }
      }
      var ok = await g.GMTAsk.confirm(EFFECT_OFF + '\n\nسيُسجَّل الإلغاء باسمك: ' + adminName() + '.', { title: 'إلغاء قفل الأوردرات', okText: '🔓 ألغِ القفل' });
      if (!ok) return false;
      var r = await set(false);
      if (r.ok) { say('🔓 أُلغي قفل الأوردرات — أعد الإجراء الآن', 'ok'); return true; }
      await g.GMTAsk.alert('لم يُلغَ القفل: ' + r.why, { title: 'لم يُحفَظ', icon: 'danger' });
    }
    return false;
  }

  /* ── الشارة ── */
  function css() {
    if (document.getElementById('olk-css')) return;
    var st = document.createElement('style'); st.id = 'olk-css';
    st.textContent =
      '#olk-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 12px;font-weight:800;font-size:11px;line-height:1.2;font-family:inherit;' +
      'border:1.5px solid #e5e7eb;background:#f3f4f6;color:#374151;cursor:pointer;white-space:nowrap;transition:background .15s}' +
      '#olk-badge.on{background:#fef2f2;border-color:#fca5a5;color:#991b1b}' +
      '#olk-badge.off{background:#f0fdf4;border-color:#bbf7d0;color:#166534}' +
      '#olk-badge.unk{background:#f9fafb;color:#6b7280;border-style:dashed}' +
      '#olk-badge:disabled{opacity:.6;cursor:wait}' +
      '#olk-badge .olk-s{display:none}' +
      /* الهاتف: شارة مختصرة كي لا تزاحم الترويسة */
      '@media (max-width:640px){#olk-badge{padding:5px 9px;font-size:10.5px}#olk-badge .olk-f{display:none}#olk-badge .olk-s{display:inline}}';
    document.head.appendChild(st);
  }
  function paint() {
    if (!badge) return;
    var cls = S.on === null ? 'unk' : (S.on ? 'on' : 'off');
    badge.className = cls;
    badge.disabled = busy;
    var full = S.on === null ? 'القفل: …' : (S.on ? 'القفل: مُفعَّل' : 'القفل: مُعطَّل');
    var short = S.on === null ? '…' : (S.on ? 'مقفلة' : 'مفتوحة');
    var ic = S.on ? '🔒' : '🔓';
    badge.innerHTML = '<span aria-hidden="true">' + ic + '</span><span class="olk-f">' + full + '</span><span class="olk-s">' + short + '</span>';
    badge.title = (S.on === null ? 'تعذّرت قراءة حالة قفل الأوردرات' : (S.on ? 'قفل الأوردرات مُفعَّل: لا يتقدّم أوردر غير مُفوتَر' : 'قفل الأوردرات مُعطَّل')) +
      (S.err && S.on !== null ? ' — آخر قراءة قديمة (' + S.err + ')' : '') + ' · اضغط للتفاصيل';
    badge.setAttribute('aria-label', full);
  }
  function mount(after) {
    if (badge || !document.body) return badge;
    css();
    badge = document.createElement('button');
    badge.type = 'button'; badge.id = 'olk-badge';
    badge.onclick = toggle;
    var ref = typeof after === 'string' ? document.getElementById(after) : after;
    if (ref && ref.parentNode) ref.parentNode.insertBefore(badge, ref.nextSibling); else document.body.insertBefore(badge, document.body.firstChild);
    paint();
    get();
    clearInterval(timer);
    timer = setInterval(function () { if (document.visibilityState !== 'hidden') get(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') get(); });
    return badge;
  }
  /* يُنادى من ordersLockBlock بعد قراءته الطازجة — كي لا تتأخّر الشارة عن الحقيقة */
  function note(on) { if (typeof on === 'boolean') { S.on = on; S.err = ''; S.readAt = Date.now(); paint(); } }

  g.GMTOrdersLock = { mount: mount, get: get, set: set, toggle: toggle, blocked: blocked, note: note, state: S };
})(window);
