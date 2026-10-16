/* ═══════════════════════════════════════════════════════════════════════════
   gmt-endpoint.js — رابط الوسيط: مرّةً واحدة للنظام كلّه  ·  2026-10-03
   ─────────────────────────────────────────────────────────────────────────
   ثلاثة بلاغاتٍ للمالك جذرُها واحد:
     · «البوت في المتجر والموقع لا أثر له»
     · «مكان إدخال رابط الوسيط غير واضح أصلاً»
     · وطلبُه في الوثيقة: «رابط الوسيط **مرّةً واحدة للنظام كلّه لا لكل جهاز**»

   الجذر: الرابط كان يُقرأ من `localStorage` في كل ملفٍّ على حِدة
   (`gmt_brain_endpoint` في العقل · `GMT_SHOP_ENDPOINT` في المتجر). فهو:
     ① **لكل جهاز**: يضبطه المالك على حاسبه فلا يعمل على هاتف الموظّف ولا على
        جهاز الزبون في المتجر — وهذا بالضبط «لا أثر له».
     ② **بلا مكانٍ واحد**: صفحةُ شرحٍ هنا وحقلٌ هناك، فلا يعرف أين يضعه.
     ③ **وغيابُه صامت**: البوت لا يظهر ولا يقول لماذا، فيبدو معطوباً لا غير
        مضبوط — والفرق بينهما كلُّ شيء.

   العلاج:
     · مصدرٌ واحد: `gmt_settings` في القاعدة الرئيسية (المفتاح `brain_endpoint`
       و`shop_endpoint`) ⇒ يُضبَط مرّةً ويعمل على كل جهاز. وهو **نفس الجدول**
       الذي تقرأ منه كلمات السر (`gmt-auth.js`) — فلا جدول جديد ولا هجرة.
     · كاشٌ محلّيّ كي لا يُسأل الجدول في كل صفحة، ويعمل بلا إنترنت.
     · وتوافقٌ خلفيّ: ما ضُبط محلّياً قبل اليوم يبقى يعمل، ويُرفَع للقاعدة
       **تلقائياً** عند أوّل فرصة — فلا يُطلب من المالك إعادة إدخاله.
     · وغيابُه **يُعلَن للأدمن فقط** بسطرٍ فيه زرُّ ضبطٍ فوريّ — لا للزبون.

   🛡️ ولا يُخزَّن مفتاحُ ذكاءٍ هنا إطلاقاً: الوسيط موجودٌ أصلاً كي يبقى المفتاح
      على الخادم. هذا رابطٌ عامٌّ لا سرّ.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTEndpoint) return;

  var CACHE = 'gmt_endpoints_cache_v1';
  var TTL   = 10 * 60 * 1000;
  var KINDS = {
    brain: { db: 'brain_endpoint', local: 'gmt_brain_endpoint', label: 'وسيط عقل النظام' },
    shop:  { db: 'shop_endpoint',  local: 'gmt_shop_endpoint',  label: 'وسيط مساعد المتجر' }
  };

  var mem = null, at = 0;

  function db() {
    try { if (global.GMT_DB && GMT_DB.MAIN) return GMT_DB.MAIN; } catch (_) {}
    return null;
  }
  function ls(k) { try { return (localStorage.getItem(k) || '').trim(); } catch (_) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  function readCache() {
    if (mem && (Date.now() - at) < TTL) return mem;
    try {
      var raw = localStorage.getItem(CACHE);
      if (raw) {
        var c = JSON.parse(raw);
        if (c && (Date.now() - c.at) < TTL) { mem = c.v; at = c.at; return mem; }
      }
    } catch (_) {}
    return null;
  }

  async function load(force) {
    if (!force) { var c = readCache(); if (c) return c; }
    var d = db();
    if (!d) return mem || {};
    try {
      var r = await fetch(d.url + '/rest/v1/gmt_settings?select=key,value', {
        headers: { apikey: d.key, Authorization: 'Bearer ' + d.key }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = await r.json();
      var map = {};
      (rows || []).forEach(function (x) { map[x.key] = x.value; });
      mem = map; at = Date.now();
      try { localStorage.setItem(CACHE, JSON.stringify({ at: at, v: map })); } catch (_) {}
    } catch (_) { /* بلا شبكة ⇒ نكتفي بالمحلّي */ }
    return mem || {};
  }

  /* ══ (١١ ت١) «تعذّر الاتصال: HTTP 405 — Not Allowed» ══════════════════════════════════════════════
     الجذر: الرابط المضبوط للوسيط كان رابط **موقعٍ ثابت** (GitHub Pages ينقّل POST بصفحة «405 Not Allowed» بتذييل nginx)
     لا رابط دالة Supabase — والنظام يقبل أيَّ رابط https بلا فحص، ثمّ يعرض للمستخدم نصَّ صفحة HTML الخام فلا يفهم شيئاً.
     العلاج: ① لا نحفظ رابطاً لا يصلح لـPOST (problem) ② نترجم ردّ الخطأ إلى سبب وحلّ بالعربية (explain). */
  function problem(url) {
    var u = String(url == null ? '' : url).trim(); if (!u) return '';
    var a; try { a = new URL(u); } catch (_) { return 'الرابط غير صالح — يجب أن يبدأ بـhttps:// ويكون رابطاً كاملاً'; }
    var host = a.hostname.toLowerCase(), path = a.pathname || '/';
    try { if (a.host.toLowerCase() === String(location.host || '').toLowerCase()) return 'هذا رابط الموقع نفسه — صفحات الموقع لا تقبل POST (تردّ 405)'; } catch (_) {}
    if (/\.github\.io$/.test(host)) return 'هذا رابط موقعٍ على GitHub Pages — صفحات ثابتة لا تقبل POST (تردّ 405). المطلوب رابط دالة Supabase';
    if (/\.(html?|js|css|json|png|jpe?g|svg|ico)$/i.test(path)) return 'الرابط يشير إلى ملف (' + path.split('/').pop() + ') لا إلى دالة';
    /* شكلان موثَّقان لدوال Supabase: <ref>.supabase.co/functions/v1/<fn> و <ref>.functions.supabase.co/<fn> */
    if (/\.supabase\.co$/.test(host) && !/\.functions\.supabase\.co$/.test(host) && !/^\/functions\/v1\/[^/]+/.test(path)) return 'رابط Supabase هذا ليس لدالة — الشكل الصحيح: https://<المشروع>.supabase.co/functions/v1/<اسم الدالة>';
    return '';
  }
  function explain(status, body, url) {
    var st = Number(status) || 0, b = String(body == null ? '' : body), html = /<\s*(html|head|body|title)\b/i.test(b);
    var pr = url ? problem(url) : '';
    if (st === 405 || (html && st >= 400 && st < 500 && st !== 404 && st !== 401 && st !== 403)) {
      return 'الرابط المضبوط يردّ بصفحة موقع (HTTP ' + st + ' «Not Allowed») — أي أنّه ليس وسيطاً، بل موقعٌ ثابت لا يقبل الطلبات المرسَلة له. ' +
        (pr ? 'السبب: ' + pr + '. ' : 'غالباً لُصق رابط الموقع (GitHub Pages) بدل رابط دالة Supabase. ') +
        'الشكل الصحيح: https://<المشروع>.supabase.co/functions/v1/gmt-brain — صحّحه من «تفعيل عقل النظام» أو زرّ «أدخل رابط الوسيط».';
    }
    if (st === 404) return 'لا توجد دالة على هذا الرابط (HTTP 404) — إمّا لم تُنشر بعد، أو اسمها في الرابط لا يطابق اسم الدالة المنشورة.';
    if (st === 401 || st === 403) return 'الوسيط رفض الطلب (HTTP ' + st + ') — غالباً نُشرت الدالة بدون الخيار --no-verify-jwt: أعد نشرها بـ«supabase functions deploy gmt-brain --no-verify-jwt».';
    if (st === 429) return 'تجاوز الاستهلاك المسموح (HTTP 429) — انتظر دقيقة أو أضف مفتاحاً آخر للوسيط.';
    if (st >= 500) return 'الدالة وصلتها الرسالة لكنّها فشلت داخلياً (HTTP ' + st + ') — افتح سجلّات الدالة في Supabase (غالباً مفتاح Gemini/Claude ناقص أو رصيده انتهى).';
    if (st === 0) return 'تعذّر الوصول للوسيط أصلاً — لا إنترنت، أو الدالة لا تسمح بهذا الموقع (CORS).';
    return 'ردّ الوسيط برمز HTTP ' + st + '.';
  }

  /* القيمة الفعّالة: القاعدة أوّلاً (للنظام كلّه)، ثمّ المحلّي (توافقٌ خلفيّ) */
  function get(kind) {
    var k = KINDS[kind];
    if (!k) return '';
    var c = readCache() || mem || {};
    var fromDb = String(c[k.db] || '').trim();
    return fromDb || ls(k.local);
  }

  async function set(kind, url) {
    var k = KINDS[kind];
    if (!k) throw new Error('نوعٌ غير معروف');
    var v = String(url || '').trim();
    if (v && !/^https?:\/\//i.test(v)) throw new Error('الرابط يجب أن يبدأ بـhttps://');
    var bad = problem(v); if (bad) throw new Error(bad);          /* لا نحفظ رابطاً لن يعمل أبداً */
    lsSet(k.local, v);                       // يعمل فوراً على هذا الجهاز
    var d = db();
    if (!d) return { local: true, system: false };
    /* كتابةٌ متدرّجة: upsert ثمّ patch — فجدولٌ بلا قيد تفرُّدٍ لا يُسقط العملية */
    try {
      var r = await fetch(d.url + '/rest/v1/gmt_settings?on_conflict=key', {
        method: 'POST',
        headers: { apikey: d.key, Authorization: 'Bearer ' + d.key,
                   'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: k.db, value: v })
      });
      if (!r.ok) {
        var r2 = await fetch(d.url + '/rest/v1/gmt_settings?key=eq.' + encodeURIComponent(k.db), {
          method: 'PATCH',
          headers: { apikey: d.key, Authorization: 'Bearer ' + d.key,
                     'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ value: v })
        });
        if (!r2.ok) return { local: true, system: false, why: 'HTTP ' + r2.status };
      }
      mem = null; at = 0;                    // أبطِل الكاش ليُقرأ الجديد
      await load(true);
      return { local: true, system: true };
    } catch (e) {
      return { local: true, system: false, why: e && e.message };
    }
  }

  /* ══ (١١ ت١ ٢٠٢٦ — ملاحظات) مفاتيح تشغيلٍ عامّة في gmt_settings — غير الروابط ══
     الجدول نفسه الذي تُحفَظ فيه الروابط وكلمات السرّ، فلا جدول جديد ولا SQL. أوّل مستعمِلٍ: «قفل الأوردرات» (orders_lock).
     القراءة الطازجة تتجاوز كاش الدقائق العشر — لأنّ مفتاحاً يَحكم عملية مالية لا يجوز أن يتأخّر سريانُه عشر دقائق. */
  function setting(key) { var c = readCache() || mem || {}; return c[key]; }
  async function settingFresh(key) { var c = await load(true); return (c || {})[key]; }
  async function setSetting(key, value) {
    var d = db();
    if (!d) return { system: false, why: 'إعدادات القاعدة غير متاحة' };
    var v = String(value == null ? '' : value);
    var H = { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' };
    try {
      var r = await fetch(d.url + '/rest/v1/gmt_settings?on_conflict=key', { method: 'POST',
        headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, H), body: JSON.stringify({ key: key, value: v }) });
      if (!r.ok) {
        var r2 = await fetch(d.url + '/rest/v1/gmt_settings?key=eq.' + encodeURIComponent(key), { method: 'PATCH',
          headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify({ value: v }) });
        if (!r2.ok) return { system: false, why: 'HTTP ' + r2.status };
        var rows = await r2.json().catch(function () { return []; });
        if (!Array.isArray(rows) || !rows.length) return { system: false, why: 'لا سطر لهذا المفتاح — شغّل SQL الإعدادات' };
      }
      mem = null; at = 0;
      var back = await settingFresh(key);                 /* لا نصدّق الكتابة قبل أن نقرأها */
      return String(back == null ? '' : back) === v ? { system: true } : { system: false, why: 'لم يثبت في القاعدة (قرأتُ «' + back + '»)' };
    } catch (e) { return { system: false, why: e && e.message }; }
  }

  /* رفعُ ما ضُبط محلّياً قبل اليوم إلى القاعدة — مرّةً، بلا إزعاج المالك */
  async function migrateLocal() {
    var c = await load();
    for (var kind in KINDS) {
      var k = KINDS[kind];
      var local = ls(k.local);
      var sys = String((c || {})[k.db] || '').trim();
      if (local && !sys) {
        try { await set(kind, local); console.info('[GMT] رُفع ' + k.label + ' إلى إعدادات النظام.'); }
        catch (_) {}
      }
    }
  }

  /* هل المستخدم أدمن؟ — التنبيه له وحده */
  function isAdmin() {
    try {
      if (/[?&]sovereign=1/.test(location.search) && (function(){try{return sessionStorage.getItem('gmt_sov_ok')==='1'||sessionStorage.getItem('gmt_admin_mode')==='1';}catch(_){return false;}})()) return true;
      try { if (global.GMTRole && GMTRole.isAdmin()) return true; } catch (_) {}   /* (٨ ت) وضع الأدمن */
      if (global.GMTBug && GMTBug.role) return /admin|sovereign|owner/i.test(GMTBug.role());
      var u = JSON.parse((localStorage.getItem('gmt_session') || localStorage.getItem('gmt_user')) || '{}');
      return /admin|sovereign|owner/i.test(u.role || '');
    } catch (_) { return false; }
  }

  /* سطرٌ واحد يقول «غير مضبوط» ويفتح الضبط فوراً — بدل غيابٍ صامت */
  function notice(kind) {
    if (!isAdmin()) return;                  // لا يراه الزبون ولا الكاشير
    if (document.getElementById('gmt-ep-note-' + kind)) return;
    var k = KINDS[kind]; if (!k) return;
    var d = document.createElement('div');
    d.id = 'gmt-ep-note-' + kind;
    d.setAttribute('data-keep-fab', '1');
    d.style.cssText = 'margin:8px;padding:10px 12px;border-radius:10px;background:#eff6ff;'
      + 'border:1.5px solid #bfdbfe;color:#1e40af;font-size:12.5px;font-weight:700;'
      + 'line-height:1.8;font-family:inherit;direction:rtl';
    d.innerHTML = '🔌 <b>' + k.label + ' غير مضبوط</b> — لذلك لا يظهر المساعد. '
      + 'يُضبَط <b>مرّةً واحدة للنظام كلّه</b> ويعمل على كل جهاز.'
      + '<button type="button" style="margin-inline-start:8px;background:#1e40af;color:#fff;'
      + 'border:none;border-radius:8px;padding:6px 11px;font-weight:900;font-size:12px;'
      + 'cursor:pointer;font-family:inherit">اضبطه الآن</button>';
    d.querySelector('button').onclick = function () { prompt_(kind); };
    (document.body || document.documentElement).appendChild(d);
  }

  function prompt_(kind) {
    var k = KINDS[kind]; if (!k) return;
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.6);'
      + 'display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:inherit';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:20px;max-width:520px;width:100%">'
      + '<div style="font-weight:900;font-size:16px;margin-bottom:6px">' + k.label + '</div>'
      + '<div style="font-size:12.5px;color:#5b6472;line-height:1.8;margin-bottom:12px">'
      + 'الصق رابط الدالّة الطرفيّة (Edge Function) كما تظهر في Supabase.<br>'
      + 'يُحفَظ في <b>إعدادات النظام</b> فيعمل على كل جهاز — لا على هذا الجهاز وحده.</div>'
      + '<input id="_ep_in" dir="ltr" placeholder="https://xxxx.supabase.co/functions/v1/..." '
      + 'style="width:100%;padding:11px;border:1.5px solid #d1d5db;border-radius:10px;'
      + 'font-family:ui-monospace,monospace;font-size:12.5px;box-sizing:border-box">'
      + '<div id="_ep_msg" style="font-size:12px;margin-top:8px;font-weight:700"></div>'
      + '<div style="display:flex;gap:8px;margin-top:12px">'
      + '<button id="_ep_no" style="flex:1;padding:11px;border:none;border-radius:10px;'
      + 'background:#f3f4f6;font-weight:900;font-family:inherit;cursor:pointer">إغلاق</button>'
      + '<button id="_ep_ok" style="flex:2;padding:11px;border:none;border-radius:10px;'
      + 'background:#1e40af;color:#fff;font-weight:900;font-family:inherit;cursor:pointer">احفظ للنظام كلّه</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    var inp = ov.querySelector('#_ep_in'), msg = ov.querySelector('#_ep_msg');
    inp.value = get(kind);
    ov.querySelector('#_ep_no').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector('#_ep_ok').onclick = async function () {
      msg.textContent = 'جارٍ الحفظ…'; msg.style.color = '#5b6472';
      try {
        var r = await set(kind, inp.value);
        if (r.system) {
          msg.style.color = '#166534';
          msg.textContent = '✅ حُفظ في إعدادات النظام — يعمل على كل جهاز. أعِد تحميل الصفحة.';
          var n = document.getElementById('gmt-ep-note-' + kind); if (n) n.remove();
        } else {
          msg.style.color = '#b45309';
          msg.textContent = '⚠️ حُفظ على هذا الجهاز فقط — تعذّر حفظُه للنظام'
            + (r.why ? ' (' + r.why + ')' : '') + '. شغّل SQL الإعدادات ثمّ أعِد الحفظ.';
        }
      } catch (e) { msg.style.color = '#b91c1c'; msg.textContent = '⛔ ' + (e && e.message); }
    };
  }

  global.GMTEndpoint = {
    get: get, set: set, load: load, kinds: KINDS, problem: problem, explain: explain,
    setting: setting, settingFresh: settingFresh, setSetting: setSetting,
    notice: notice, open: prompt_, migrate: migrateLocal
  };

  /* إقلاع: حمّل الإعدادات، ارفع القديم، ثمّ أعلم الصفحة */
  (async function boot() {
    await load();
    try { await migrateLocal(); } catch (_) {}
    var shop = get('shop');
    if (shop && !global.GMT_SHOP_ENDPOINT) global.GMT_SHOP_ENDPOINT = shop;
    var brain = get('brain');
    if (brain) { try { lsSet('gmt_brain_endpoint', brain); } catch (_) {} }
    try { global.dispatchEvent(new CustomEvent('gmt-endpoints-ready')); } catch (_) {}
  })();
})(window);
