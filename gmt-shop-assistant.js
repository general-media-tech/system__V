/* ═══════════════════════════════════════════════════════════════════════════
   gmt-shop-assistant.js — مساعد المتجر للزبائن  ·  2026-09-26
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك: «شخص يقدّم شكاوى أو يسأل عن خدمات أو يكتب بدّي منتج… أجوبة تلقائية
   ما تبيّن أنّها ذكاء اصطناعي، ما تبيّن كثير طويلة أو فيها فلسفة. أسئلة مختصرة
   أجابات مختصرة. يرشّح له منتجات، يدلّه شو عنّا وشو ما عنّا… ممكن يطلب التواصل
   مع شخص إنسان فهو يستجيب ويعطينا إشعار».

   ⚠️ هذا الملفّ **الوحيد** المسموح له بالعمل على صفحة زبون من عائلة أدوات الذكاء
   الاصطناعي. ولذلك بُني بقواعد مختلفة تماماً عن gmt-brain.js:

     ① لا يقرأ أي شيء داخلي. لا GMT_OWNER_RULES ولا الأخطاء ولا المخزون الحقيقي
        ولا أسماء الموظّفين. يقرأ كتالوج المتجر المعروض على الصفحة أصلاً — لا أكثر.
     ② الترشيح **يحدث في المتصفّح** بمحرّك gmt-suggest، والمساعد ممنوع من ذكر أي
        منتج خارج القائمة التي نُرسلها. بلا هذا القيد يخترع منتجات لا نبيعها،
        فيأتي الزبون للمحلّ ليطلبها.
     ③ تعليمات الأسلوب في **الخادم** لا هنا. لو أرسلناها من المتصفّح لقدر أي زبون
        بفتح F12 أن يستبدلها ويجعل «مساعد ميديا تيك» يقول ما يشاء — ويُنسب لنا.
     ④ لا يُعرَض إطلاقاً إن لم يُضبَط الوسيط: زرّ محادثة لا يردّ أسوأ من لا زرّ.

   الضبط في صفحة المتجر:
       window.GMT_SHOP_ENDPOINT = 'https://<project>.functions.supabase.co/gmt-shop';
       window.GMT_SHOP_INFO     = 'الفروع وساعات العمل وطرق التواصل…';   (اختياري)
       window.GMT_SHOP_PRODUCTS = () => [{name, price, qty, url}];        (اختياري)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const LS_HIST = 'gmt_shop_chat_v1';
  const MAX_HIST = 12;

  /* 🔧 (2026-10-03 · بلاغ «البوت لا أثر له») كان الرابط يُقرأ من متغيّرٍ عامّ
     يُضبَط يدوياً في كل جهاز. الآن من `GMTEndpoint` — مصدرٌ واحدٌ للنظام كلّه
     (طلبُ المالك: «رابط الوسيط مرّةً واحدة للنظام كلّه لا لكل جهاز»). */
  function endpoint() {
    try { if (global.GMTEndpoint && GMTEndpoint.get) { var u = GMTEndpoint.get('shop'); if (u) return u; } } catch (_) {}
    return (global.GMT_SHOP_ENDPOINT || '').trim();
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── التاريخ في هذا المتصفّح فقط ── */
  function loadHist() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      return Array.isArray(d) ? d.slice(-MAX_HIST) : [];
    } catch (_) { return []; }
  }
  function saveHist(h) {
    try { localStorage.setItem(LS_HIST, JSON.stringify(h.slice(-MAX_HIST))); } catch (_) {}
  }

  /* ══ كتالوج المتجر — من الصفحة نفسها لا من القاعدة ══════════════════════
     صفحة المتجر محمّلة منتجاتها أصلاً؛ جلبها ثانيةً استهلاكٌ بلا فائدة.
     نقبل ثلاثة أشكال شائعة كي يعمل الملفّ مع الصفحة كما هي اليوم وبعد أي تعديل. */
  function shopProducts() {
    try {
      if (typeof global.GMT_SHOP_PRODUCTS === 'function') {
        const r = global.GMT_SHOP_PRODUCTS();
        if (Array.isArray(r)) return r;
      }
      for (const key of ['allProducts', 'products', 'storeProducts', 'PRODUCTS']) {
        const v = global[key];
        if (Array.isArray(v) && v.length && v[0] && v[0].name) return v;
      }
    } catch (_) {}
    return [];
  }

  /* يبحث بمحرّك النظام نفسه — فيفهم «كانون R6 مارك 2» و«ym 600 ss» */
  function matchProducts(text) {
    const rows = shopProducts();
    if (!rows.length) return [];
    if (!global.GMTSuggest) return [];
    let cat;
    try { cat = global.GMTSuggest.prepare(rows); } catch (_) { return []; }
    let hits = [];
    try { hits = global.GMTSuggest.suggest(text, cat, 6, 0.32); } catch (_) { return []; }
    return hits.map(h => {
      const p = h.product || {};
      const q = Number(p.qty);
      return {
        name: p.name,
        /* السعر كما هو معروض على المتجر. لا نُشتقّ سعراً ولا نحوّل عملة هنا:
           أي حساب في المتصفّح قد يخالف ما يراه الزبون على البطاقة. */
        price: (p.price === undefined || p.price === null || p.price === '') ? '' : ('$' + p.price),
        available: !isFinite(q) ? true : q > 0,
        url: p.store_url || p.url || ''
      };
    });
  }

  /* ══ الإرسال ═════════════════════════════════════════════════════════════ */
  /* ══ أمثلة أسلوبنا — قرار المالك ق١٣ (2026-10-03): «نوصله بمساعد المتجر» ══
     ─────────────────────────────────────────────────────────────────────────
     العطل: جدول `shop_style` يُنشئه SQL 38 ومعه بذرةٌ من ردودنا الحقيقيّة،
     **ولا يقرؤه شيء**. وطلبُ المالك كان «غذِّ أسلوبنا» — فكان موثَّقاً وغير موصول.

     والمدهش أنّ الطرف الآخر **جاهزٌ منذ البداية**: دالّة `gmt-shop` الطرفيّة
     تقرأ `body.style` وتُركّبها في الحقائق تحت عنوان «أمثلة على أسلوب ردودنا
     الحقيقية — احتذِ بها». فالوصلةُ كانت مقطوعةً **من طرفٍ واحد فقط**:
     المتصفّح لا يُرسل ما يَنتظره الخادم.

     ⚠️ وهذا **ليس تدريباً** للنموذج — لا نُدرّب شيئاً. هي أمثلةٌ تُرسَل مع كل
     سؤال ليحتذي بها (few-shot). والوضوح هنا مقصود كي لا نظنّ أنّ النظام
     «يتعلّم وحده» فننتظر تحسّناً لا يحدث.

     تُقرَأ **مرّةً واحدة** وتُحفظ في الذاكرة: سؤالُ الجدول مع كل رسالةٍ إهدارٌ
     لطلبٍ شبكيٍّ على الزبون، وهذه أمثلةٌ لا تتغيّر أثناء المحادثة. */
  let _styleCache = null;

  async function loadStyle() {
    if (_styleCache) return _styleCache;
    _styleCache = [];                       // لا نُعيد المحاولة في كل رسالة
    try {
      const db = (global.GMT_DB && GMT_DB.STORE) || null;
      if (!db || !db.url || !db.key) return _styleCache;
      const r = await fetch(
        db.url + '/rest/v1/shop_style?select=q,a&active=is.true&order=sort_order.asc&limit=6',
        { headers: { apikey: db.key, Authorization: 'Bearer ' + db.key } });
      if (!r.ok) {
        /* لا نكسر المحادثة — لكن لا نصمت: السطر هو ما يُخبرنا أنّ SQL لم يُشغَّل */
        console.info('[GMT] أمثلة الأسلوب غير متاحة — شغّل SQL 38 (' + r.status + ')');
        return _styleCache;
      }
      const rows = await r.json();
      if (Array.isArray(rows)) {
        _styleCache = rows
          .filter(x => x && x.q && x.a)
          .map(x => ({ q: String(x.q).slice(0, 200), a: String(x.a).slice(0, 300) }));
      }
    } catch (_) { /* الزبون لا يرى عطلاً من أجل أمثلة */ }
    return _styleCache;
  }

  async function ask(message, hist) {
    const url = endpoint();
    if (!url) throw new Error('المساعد غير مضبوط');
    const body = {
      message: message,
      products: matchProducts(message),
      shop: String(global.GMT_SHOP_INFO || '').slice(0, 1200),
      style: await loadStyle(),             // ⬅ ق١٣ — الطرف الناقص من الوصلة
      history: hist.slice(-6).map(h => ({ q: h.q, a: h.a }))
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }

  /* ══ تسجيل طلب التحويل لإنسان ════════════════════════════════════════════
     «ممكن يطلب التواصل مع شخص إنسان فهو يستجيب ويعطينا إشعار».
     يُكتب في shop_chats (SQL 38). متسامح: إن غاب الجدول لا ينكسر شيء للزبون —
     لكن يبقى سطر في الـconsole كي نعرف أنّ SQL لم يُشغَّل. */
  async function logHandoff(payload) {
    try {
      const db = (global.GMT_DB && GMT_DB.STORE) || null;
      if (!db || !db.url || !db.key) return;
      const r = await fetch(db.url + '/rest/v1/shop_chats', {
        method: 'POST',
        headers: {
          apikey: db.key, Authorization: 'Bearer ' + db.key,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload)
      });
      if (!r.ok) console.info('[GMT] لم يُسجَّل طلب التحويل — شغّل SQL 38 (' + r.status + ')');
    } catch (_) {}
  }

  /* ══ الواجهة ═════════════════════════════════════════════════════════════ */
  let panel = null, listEl = null, inputEl = null, busy = false;
  let hist = [];

  function mount() {
    if (!endpoint()) {
      /* 🔧 (2026-10-03 · بلاغ «البوت لا أثر له») الخروج الصامت صحيحٌ للزبون —
         زرٌّ لا يردّ أسوأ من لا زرّ. لكنّه كان صامتاً **للمالك أيضاً**، فظنّ
         المساعد معطوباً وهو غيرُ مضبوط. والفرق بينهما كلُّ شيء.
         الآن: الزبون لا يرى شيئاً، والأدمن يرى سطراً فيه زرُّ ضبطٍ فوريّ. */
      try { if (global.GMTEndpoint && GMTEndpoint.notice) GMTEndpoint.notice('shop'); } catch (_) {}
      return;
    }
    if (document.getElementById('gmt-sa-fab')) return;
    /* (٨ ث — تدقيق المطابقة) قاعدتك: «لا أزرار عائمة في أيّ مكان» — كان زرّاً دائرياً عائماً أسفل الشاشة.
       الآن أيقونةٌ في شريط الرأس نفسه بجانب واتساب (أو في مكانٍ تحدّده الصفحة بـ data-sa-slot).
       وإن لم يوجد مكان: لا زرّ أبداً — لا نعود للعائم. */
    const slot = document.querySelector('[data-sa-slot]') ||
                 (document.querySelector('header [data-action="whatsapp"]') || {}).parentElement;
    if (!slot) return;
    const fab = document.createElement('i');
    fab.id = 'gmt-sa-fab';
    fab.setAttribute('role', 'button'); fab.setAttribute('tabindex', '0');
    fab.setAttribute('aria-label', 'المساعد — اسألنا عن منتج');
    fab.title = 'المساعد — اسألنا عن منتج';
    fab.className = 'ph ph-chat-circle-dots cursor-pointer hover:text-primary transition-colors';
    fab.onclick = toggle;
    fab.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
    slot.appendChild(fab);
  }

  function toggle() {
    if (panel) { close(); return; }
    open();
  }

  function close() {
    if (panel) { panel.remove(); panel = null; }
  }

  function open() {
    hist = loadHist();
    panel = document.createElement('div');
    panel.id = 'gmt-sa-panel';
    panel.setAttribute('dir', 'rtl');
    panel.style.cssText = 'position:fixed;inset-inline-end:14px;bottom:80px;z-index:2147480001;' +
      'width:min(360px,calc(100vw - 28px));max-height:min(74vh,560px);display:flex;flex-direction:column;' +
      'background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden;' +
      'font-family:Cairo,Tahoma,system-ui,sans-serif';
    panel.innerHTML =
      '<div style="background:#D5001C;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px">' +
        '<div style="font-weight:900;font-size:14px">مجموعة ميديا تيك</div>' +
        '<button id="gmt-sa-x" aria-label="إغلاق" style="margin-inline-start:auto;background:rgba(255,255,255,.2);' +
          'border:0;color:#fff;border-radius:8px;padding:3px 10px;font-weight:800;cursor:pointer;' +
          'font-family:inherit;font-size:13px">✕</button>' +
      '</div>' +
      '<div id="gmt-sa-list" style="flex:1;overflow-y:auto;padding:12px;background:#F7F8FA"></div>' +
      '<div style="padding:10px;border-top:1px solid #E9ECF1;display:flex;gap:6px;background:#fff">' +
        '<input id="gmt-sa-in" type="text" autocomplete="off" placeholder="اكتب سؤالك…" ' +
          'style="flex:1;min-width:0;border:1px solid #E4E6EE;border-radius:10px;padding:9px 11px;' +
          'font-family:inherit;font-size:13px;font-weight:600;outline:none">' +
        '<button id="gmt-sa-send" style="background:#D5001C;color:#fff;border:0;border-radius:10px;' +
          'padding:9px 15px;font-weight:900;cursor:pointer;font-family:inherit;font-size:13px">إرسال</button>' +
      '</div>' +
      '<div style="padding:0 12px 9px;background:#fff">' +
        '<button id="gmt-sa-human" style="background:none;border:0;color:#5b6472;font-size:11px;' +
          'font-weight:700;cursor:pointer;font-family:inherit;text-decoration:underline">' +
          'بدّي أحكي مع موظّف</button>' +
      '</div>';
    document.body.appendChild(panel);
    listEl = panel.querySelector('#gmt-sa-list');
    inputEl = panel.querySelector('#gmt-sa-in');
    panel.querySelector('#gmt-sa-x').onclick = close;
    panel.querySelector('#gmt-sa-send').onclick = send;
    panel.querySelector('#gmt-sa-human').onclick = () => requestHuman();
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

    if (!hist.length) bubble('them', 'أهلاً 🌟 كيف فينا نساعدك؟');
    else hist.forEach(h => { bubble('me', h.q); bubble('them', h.a); });
    setTimeout(() => { try { inputEl.focus(); } catch (_) {} }, 80);
  }

  function bubble(who, text, muted) {
    if (!listEl) return null;
    const wrap = document.createElement('div');
    const me = who === 'me';
    wrap.style.cssText = 'display:flex;margin-bottom:8px;' + (me ? 'justify-content:flex-start' : 'justify-content:flex-end');
    const b = document.createElement('div');
    b.style.cssText = 'max-width:84%;padding:9px 12px;border-radius:13px;font-size:13px;font-weight:600;' +
      'line-height:1.85;white-space:pre-wrap;word-break:break-word;' +
      (me ? 'background:#111827;color:#fff;border-end-start-radius:4px'
          : 'background:#fff;color:#111827;border:1px solid #E9ECF1;border-end-end-radius:4px') +
      (muted ? ';opacity:.6' : '');
    b.textContent = text;
    wrap.appendChild(b);
    listEl.appendChild(wrap);
    listEl.scrollTop = listEl.scrollHeight;
    return wrap;
  }

  async function send() {
    if (busy || !inputEl) return;
    const q = inputEl.value.trim();
    if (!q) return;
    inputEl.value = '';
    bubble('me', q);
    busy = true;
    const wait = bubble('them', '…', true);
    try {
      const d = await ask(q, hist);
      if (wait) wait.remove();
      const a = String(d.answer || 'ما فهمت تماماً. فيك توضّح أكثر؟');
      bubble('them', a);
      hist.push({ q: q, a: a });
      saveHist(hist);
      if (d.handoff) {
        /* المساعد قرّر التحويل ⇒ نُسجّله ونُخبر الزبون بسطر واحد صريح.
           لا نتركه يظنّ أنّ أحداً سيردّ وقد لا يعرف أحدٌ بالطلب. */
        await requestHuman(q, true);
      }
    } catch (e) {
      if (wait) wait.remove();
      bubble('them', 'ما قدرت أجاوب هلق. جرّب بعد شوي أو اضغط «بدّي أحكي مع موظّف».');
    }
    busy = false;
  }

  /* يطلب موظّفاً حقيقياً — بالنموذج إن لم يكن معنا رقمه */
  async function requestHuman(reason, auto) {
    if (!panel) return;
    if (!auto) bubble('me', 'بدّي أحكي مع موظّف');
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border:1px solid #E9ECF1;border-radius:13px;padding:11px;margin-bottom:8px';
    box.innerHTML =
      '<div style="font-size:12.5px;font-weight:800;color:#111827;margin-bottom:7px">' +
        'اكتب رقمك وبنتواصل معك:</div>' +
      '<input id="gmt-sa-phone" type="tel" inputmode="tel" placeholder="09XXXXXXXX" ' +
        'style="width:100%;border:1px solid #E4E6EE;border-radius:9px;padding:8px 10px;' +
        'font-family:inherit;font-size:13px;font-weight:700;outline:none;margin-bottom:7px">' +
      '<button id="gmt-sa-ok" style="background:#111827;color:#fff;border:0;border-radius:9px;' +
        'padding:7px 15px;font-weight:900;font-size:12.5px;cursor:pointer;font-family:inherit">أرسل</button>' +
      '<span id="gmt-sa-msg" style="font-size:11.5px;font-weight:700;margin-inline-start:8px"></span>';
    listEl.appendChild(box);
    listEl.scrollTop = listEl.scrollHeight;

    const phone = box.querySelector('#gmt-sa-phone');
    const msg = box.querySelector('#gmt-sa-msg');
    box.querySelector('#gmt-sa-ok').onclick = async () => {
      const p = phone.value.replace(/[^\d+]/g, '');
      /* نتحقّق شكلاً فقط: رقم ناقص يعني طلباً لا يمكن الردّ عليه — وخيبةً للزبون */
      if (!/^(?:\+?963|00963|0)?9\d{8}$/.test(p)) {
        msg.style.color = '#B91C1C';
        msg.textContent = 'الرقم غير مكتمل';
        return;
      }
      msg.style.color = '#5b6472';
      msg.textContent = 'جارٍ الإرسال…';
      await logHandoff({
        phone: p,
        question: String(reason || (hist.length ? hist[hist.length - 1].q : '')).slice(0, 500),
        transcript: JSON.stringify(hist.slice(-6)).slice(0, 4000),
        page: (location && location.pathname) || '',
        status: 'new'
      });
      msg.style.color = '#047857';
      msg.textContent = '✅ وصلنا — بنتواصل معك';
      phone.disabled = true;
    };
  }

  global.GMTShopAssistant = {
    mount: mount,
    open: open,
    close: close,
    configured: function () { return !!endpoint(); },
    loadStyle: loadStyle,            /* للفحص والتشخيص */
    /* مكشوفة للفحص: يجب أن نرى ما يُرسَل فعلاً قبل نشره على صفحة زبون */
    match: matchProducts
  };

  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
  /* الإعدادات تصل من القاعدة بعد لحظة — نُعيد المحاولة حينها بدل انتظار تحديث */
  try { global.addEventListener('gmt-endpoints-ready', function () { try { mount(); } catch (_) {} }); } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
