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
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);'
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
    get: get, set: set, load: load, kinds: KINDS,
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
