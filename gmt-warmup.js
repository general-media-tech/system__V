/* ══════════════════════════════════════════════════════════════════════════
   🔴 حرس السطح — لا واجهة داخلية على صفحة زبون (2026-09-26 · بلاغ المالك)
   ─────────────────────────────────────────────────────────────────────────
   «الأزرار العائمة تبعات التصليح وتبعات الأخطاء ما تطلع لصفحات الزبون أبداً».
   يُعرَّف على window لا داخل IIFE: هذا الملفّ فيه أكثر من نطاق مغلق، ووضع
   الحرس داخل أوّلها جعله غير معروف في البقيّة (ReferenceError حقيقي ظهر في
   الاختبار). المنع افتراضياً: الصفحة الداخلية تُعلن نفسها، والعامّة لا تتذكّر شيئاً.
   ══════════════════════════════════════════════════════════════════════════ */
window.gmtInternalUI = window.gmtInternalUI || function (who) {
  try { if (window.GMT_SURFACE) return window.GMT_SURFACE.guard(who); } catch (e) {}
  if (window.GMT_PUBLIC === true || window.GMT_PUBLIC === 1) return false;
  return window.GMT_INTERNAL === true || window.GMT_INTERNAL === 1;
};

/* ═══════════════════════════════════════════════════════════════════════════
   🚀 GMTWarmup — تجهيز النظام على الجهاز  ·  (2026-08-23 · أُعيد بناؤه ٧ ي)

   ما تغيّر، بطلبك بنصّه (٧ تشرين الأول):
     «الانترو تحميل منتجات بيكون خلف الانترو … وتحميل الصور بيكون عند أوّل
      تنزيل التطبيق، مو عند أوّل زيارة للنظام الجرد أو زيارة لنقطة البيع».

   فصار التجهيز قسمين منفصلين، ولكلٍّ لحظتُه:
     ① data()   — البيانات بلا صور (المنتجات · الفروع · الإعدادات · فواتير الاستيراد).
                  تُشغّلها الرئيسيّة **خلف الانترو** بعد الدخول. وتُجهّز منتجات نقطة
                  البيع أيضاً، فلا ترى شاشة «تحميل لأوّل مرّة» حين تفتحها.
     ② images() — كل صور المنتجات. تُشغَّل **عند تثبيت التطبيق** فقط:
                  · لحظة التثبيت من المتصفّح (حدث appinstalled)
                  · وأوّل فتحٍ للتطبيق المثبَّت (للأجهزة التي لا تُطلق ذاك الحدث كالآيفون)
                  تعمل في الخلفية بلا شاشةٍ تحجب، وتُستأنف إن انقطعت، وتتخطّى المحفوظ.
     ③ run()    — التجهيز الكامل يدوياً (من «أدوات النظام») — بشاشة تقدّم كما كان.

   ⛔ أُزيل: التشغيل التلقائي عند أوّل زيارة للجرد/نقطة البيع/الأدمن… — كان يفتح
      شاشة «تجهيز النظام للعمل بلا إنترنت» فوق الصفحة ويسحب كل الصور على باقتك.
      الصورةُ التي تظهر أمامك ما زالت تُحفَظ لحظةَ ظهورها (حارس الصور) — بلا شاشة.

   🛡️ قراءة فقط · لا تكتب شيئاً في القاعدة · قابلة للإلغاء · تتخطّى المحفوظ.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const KEY_DONE = 'gmt_warmup_done_v1';     // التجهيز الكامل اليدوي
  const KEY_IMG  = 'gmt_images_done_v2';     // صور التثبيت (المخزن المشترك)
  const KEY_DATA = 'gmt_data_warm_v1';       // آخر تجهيز بيانات
  const KEY_INST = 'gmt_app_installed';      // لحظة التثبيت
  const IMG_CONCURRENCY = 4;                 // هاتفٌ على باقة — لا نخنق الشبكة
  let _running = false, _cancel = false, _imgRun = null, _dataRun = null;
  const IMG = { running: false, done: 0, total: 0, have: 0, failed: 0, error: '', why: '' };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  function creds() {
    /* 🔧 (2026-10-03 · صهر) ترتيبُ البحث صار في `GMTCreds` — كان مكرّراً
       في ملفّين، وتغييرُه في أحدهما يترك الآخر يقرأ قاعدةً أخرى. */
    if (global.GMTCreds) return global.GMTCreds();
    const url = global.SB || global.SUPABASE_URL || (global.GMT_DB && GMT_DB.MAIN.url);
    const key = global.KEY || global.SUPABASE_ANON_KEY || (global.GMT_DB && GMT_DB.MAIN.key);
    return { url, key };
  }

  async function fetchAll(table, select) {
    const { url, key } = creds();
    if (!url || !key) throw new Error('لا توجد مفاتيح قاعدة');
    const out = [];
    const PAGE = 1000;                      // PostgREST يفرض سقفاً — نُصفّح لتفادي النقص الصامت
    for (let from = 0; ; from += PAGE) {
      const r = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select || '*')}`, {
        headers: { apikey: key, Authorization: 'Bearer ' + key, Range: `${from}-${from + PAGE - 1}` }
      });
      if (!r.ok) throw new Error(table + ': HTTP ' + r.status);
      const rows = await r.json();
      if (!Array.isArray(rows)) throw new Error(table + ': ردّ غير متوقّع');
      out.push(...rows);
      if (rows.length < PAGE) break;
      if (out.length > 50000) break;        // حارس أمان
    }
    return out;
  }

  /* هل التطبيق مثبَّت ويعمل كتطبيق؟ */
  function standalone() {
    try {
      if (global.matchMedia && matchMedia('(display-mode: standalone)').matches) return true;
      if (global.navigator && navigator.standalone) return true;
    } catch (_) {}
    return false;
  }
  /* داخلٌ بحساب؟ (موظّف أو إدارة) — الصور لا تُسحب لزائرٍ لم يدخل */
  function signedIn() {
    try { if (global.GMTRole && GMTRole.isAdmin && GMTRole.isAdmin()) return true; } catch (_) {}
    try { const s = JSON.parse(lsGet('gmt_session') || 'null'); return !!(s && (s.id != null || s.username)); } catch (_) { return false; }
  }

  /* ═══ ① البيانات — بلا صور ═══ */
  function data(opts) {
    opts = opts || {};
    if (_dataRun) return _dataRun;
    const step = typeof opts.onStep === 'function' ? opts.onStep : function () {};
    _dataRun = (async function () {
      const report = { products: 0, tables: {}, errors: [], posPrefilled: false, rows: null };
      if (!global.GMTCache) { report.errors.push('GMTCache غير محمّل'); return report; }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { report.errors.push('بلا اتصال'); return report; }
      const syncAt = new Date().toISOString();   // قبل الجلب: ما يتغيّر أثناءه تلتقطه نقطة البيع
      const TABLES = [
        ['products',    '*',                        'المنتجات'],
        ['inv_columns', '*',                        'الفروع'],
        ['gmt_settings','*',                        'الإعدادات'],
        ['import_log',  'id,inv_number,status,transferred,created_at', 'فواتير الاستيراد'],
      ];
      for (let i = 0; i < TABLES.length; i++) {
        const [tbl, sel, label] = TABLES[i];
        step('تحميل ' + label + '…', i, TABLES.length);
        try {
          const rows = await fetchAll(tbl, sel);
          report.tables[tbl] = rows.length;
          try {
            if (GMTCache.replaceCollection) await GMTCache.replaceCollection('inv_' + tbl, rows);
            else await GMTCache.bulkPut('inv_' + tbl, rows);
          } catch (_) {}
          if (tbl === 'products') {
            report.products = rows.length; report.rows = rows;
            step('تحميل المنتجات: ' + rows.length + ' منتج', i + 0.5, TABLES.length);
            try { if (GMTCache.posPrefill) report.posPrefilled = await GMTCache.posPrefill(rows, syncAt); } catch (_) {}
          }
        } catch (e) { report.errors.push(label + ': ' + e.message); }
      }
      if (!report.errors.length) lsSet(KEY_DATA, JSON.stringify({ at: syncAt, products: report.products }));
      global.__gmtDataReport = Object.assign({}, report, { rows: undefined });   // لا نُبقي آلاف المنتجات في الذاكرة
      return report;
    })().finally(function () { _dataRun = null; });
    return _dataRun;
  }

  /* ═══ ② الصور — عند التثبيت ═══ */
  function emit() {
    try { document.dispatchEvent(new CustomEvent('gmt:images', { detail: Object.assign({}, IMG) })); } catch (_) {}
  }
  function imagesDone() { return !!lsGet(KEY_IMG); }
  function images(opts) {
    opts = opts || {};
    if (_imgRun) return _imgRun;
    if (!global.GMTCache || !GMTCache.storeImage) return Promise.resolve(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null);
    _cancel = false;
    _imgRun = (async function () {
      Object.assign(IMG, { running: true, done: 0, total: 0, have: 0, failed: 0, error: '', why: opts.why || '' });
      emit();
      let urls = [];
      try {
        const rows = Array.isArray(opts.products) ? opts.products : await fetchAll('products', 'id,image_url');
        urls = Array.from(new Set(rows.map(function (p) { return p && p.image_url; })
                .filter(function (u) { return u && /^https?:/i.test(u); })));
      } catch (e) { IMG.running = false; IMG.error = e.message || 'تعذّر جلب قائمة الصور'; emit(); return Object.assign({}, IMG); }
      let have = new Set();
      try { have = await GMTCache.imageKeys(); } catch (_) {}
      const todo = urls.filter(function (u) { return !have.has(u); });
      IMG.total = urls.length; IMG.have = urls.length - todo.length; IMG.done = IMG.have; emit();
      let i = 0, last = 0, full = false;
      await Promise.all(Array.from({ length: IMG_CONCURRENCY }, async function () {
        while (!_cancel) {
          const u = todo[i++];
          if (u === undefined) break;
          try { await GMTCache.storeImage(u); }
          catch (e) {
            IMG.failed++;
            if (e && e.code === 'quota') { full = true; _cancel = true; }   // المساحة امتلأت ⇒ نتوقّف
          }
          IMG.done++;
          const now = Date.now();
          if (now - last > 250 || IMG.done >= IMG.total) { last = now; emit(); }
        }
      }));
      IMG.running = false;
      /* «اكتمل» يُسجَّل إلا إن قطعه انقطاع: كثرةُ الإخفاق تعني شبكةً سقطت ⇒ يُستأنف لاحقاً.
         وامتلاءُ مساحة الجهاز ليس انقطاعاً: يُسجَّل (بما حُفظ) كي لا يُعاد التنزيل في كل فتحة. */
      const broken = !full && todo.length > 5 && IMG.failed > todo.length * 0.2;
      if (full) {
        lsSet(KEY_IMG, JSON.stringify({ at: new Date().toISOString(), n: IMG.total, failed: IMG.failed, full: true }));
        IMG.error = 'مساحة الجهاز لا تتّسع لكل الصور — حُفظ ما اتّسع، والباقي يظهر حين تفتحه';
        _cancel = false;
      } else if (!_cancel && !broken) lsSet(KEY_IMG, JSON.stringify({ at: new Date().toISOString(), n: IMG.total, failed: IMG.failed }));
      if (broken) IMG.error = 'انقطع التنزيل — يُكمل تلقائياً في الفتحة القادمة';
      emit();
      return Object.assign({}, IMG);
    })().finally(function () { _imgRun = null; });
    return _imgRun;
  }

  /* ── واجهة التقدّم — للتجهيز اليدوي الكامل فقط ── */
  function ui() {
    if (!gmtInternalUI('warmup')) return null;          // شاشة تجهيز داخلية لا تُعرض للزبون
    let el = document.getElementById('gmt-warmup-ov');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'gmt-warmup-ov';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.93);' +
      'display:flex;align-items:center;justify-content:center;font-family:inherit;direction:rtl';
    el.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:26px 30px;max-width:440px;width:90%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35)">' +
        '<div style="font-size:34px;margin-bottom:8px">🚀</div>' +
        '<div style="font-weight:900;font-size:17px;color:#0f172a">تجهيز النظام للعمل بلا إنترنت</div>' +
        '<div id="gmt-wu-step" style="font-size:13px;color:#526077;margin:10px 0 14px">جارٍ البدء…</div>' +
        '<div style="height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden">' +
          '<div id="gmt-wu-bar" style="height:100%;width:0%;background:#D5001C;transition:width .25s"></div></div>' +
        '<div id="gmt-wu-pct" style="font-size:12px;color:#526077;margin-top:8px">0%</div>' +
        '<div style="font-size:11.5px;color:#5b6472;margin-top:12px;line-height:1.7">' +
          'بعده يعمل النظام من جهازك ويخفّ الضغط على القاعدة.</div>' +
        '<button id="gmt-wu-cancel" style="margin-top:14px;background:#f1f5f9;border:1px solid #e2e8f0;' +
          'border-radius:9px;padding:8px 18px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit">إيقاف</button>' +
      '</div>';
    (document.body || document.documentElement).appendChild(el);
    el.querySelector('#gmt-wu-cancel').onclick = () => { _cancel = true; };
    return el;
  }
  function setStep(txt, pct) {
    try {
      const s = document.getElementById('gmt-wu-step');
      const b = document.getElementById('gmt-wu-bar');
      const p = document.getElementById('gmt-wu-pct');
      if (s) s.textContent = txt;
      if (b) b.style.width = Math.max(0, Math.min(100, pct)) + '%';
      if (p) p.textContent = Math.round(pct) + '%';
    } catch (_) {}
  }
  function close() { try { document.getElementById('gmt-warmup-ov')?.remove(); } catch (_) {} }

  function say(msg, bad) {
    try {
      if (typeof showToast === 'function') showToast(msg, bad ? 'err' : 'ok');
      else if (typeof toast === 'function') toast(msg, bad ? 'err' : 'ok');
    } catch (_) {}
  }

  /* ═══ ③ التجهيز الكامل يدوياً (بيانات + صور) ═══ */
  async function run(opts) {
    opts = opts || {};
    if (_running) return;
    if (!global.GMTCache) { console.warn('[Warmup] GMTCache غير محمّل'); return; }
    _running = true; _cancel = false;
    if (opts.silent !== true) ui();
    const report = { products: 0, images: 0, imagesFailed: 0, tables: {}, errors: [] };
    const onImg = function (e) {
      const d = e.detail || {};
      if (d.total) setStep('الصور: ' + d.done + ' / ' + d.total, 30 + (d.done / d.total) * 68);
    };
    document.addEventListener('gmt:images', onImg);
    try {
      const D = await data({ onStep: function (t, i, n) { setStep(t, (i / n) * 30); } });
      report.products = D.products; report.tables = D.tables; report.errors = D.errors.slice();
      if (!_cancel) {
        setStep('الصور…', 30);
        const I = await images({ products: D.rows || undefined, why: 'يدوي' });
        if (I) { report.images = Math.max(0, (I.done || 0) - (I.failed || 0)); report.imagesFailed = I.failed || 0; if (I.error) report.errors.push(I.error); }
      }
      setStep('اكتمل التجهيز', 100);
      if (!_cancel) lsSet(KEY_DONE, new Date().toISOString());
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      report.errors.push(e.message);
      console.error('[Warmup]', e);
    } finally {
      document.removeEventListener('gmt:images', onImg);
      _running = false;
      close();
    }
    /* لا نجاح صامت ولا فشل صامت — التقرير يُعرض دائماً */
    say(_cancel
      ? '⏭️ أُوقف التجهيز — يُكمل من حيث توقّف حين تعيد تشغيله'
      : '✅ جاهز للعمل بلا إنترنت: ' + report.products + ' منتج · ' + report.images + ' صورة'
        + (report.imagesFailed ? ' (تعذّر ' + report.imagesFailed + ')' : ''), report.errors.length);
    if (report.errors.length) console.warn('[Warmup] أخطاء:', report.errors);
    global.__gmtWarmupReport = report;
    return report;
  }

  function done() { return lsGet(KEY_DONE); }
  function reset() { try { localStorage.removeItem(KEY_DONE); localStorage.removeItem(KEY_IMG); localStorage.removeItem(KEY_DATA); } catch (_) {} }

  global.GMTWarmup = {
    run,                                   // تجهيز كامل يدوي (بشاشة)
    data,                                  // البيانات بلا صور — خلف الانترو
    images,                                // الصور — عند التثبيت، في الخلفية
    cancel: function () { _cancel = true; },
    imagesState: function () { return Object.assign({}, IMG); },
    imagesDone,
    installed: standalone,
    status: () => ({ done: done(), images: lsGet(KEY_IMG), data: lsGet(KEY_DATA), running: _running || !!_imgRun,
                     imagesNow: Object.assign({}, IMG), report: global.__gmtWarmupReport }),
    reset,                                 // لإعادة التجهيز من الصفر
    isDone: () => !!done() || imagesDone()
  };

  /* ═══ الإقلاع التلقائي — عند التثبيت فقط ═══
     · لحظة التثبيت (appinstalled): نبدأ تنزيل الصور فوراً في الخلفية، فحين يفتح
       التطبيق تكون جاهزة أو قاربت.
     · أوّل فتحٍ للتطبيق المثبَّت بلا صورٍ مكتملة: نُكمل في الخلفية.
     الرئيسيّة تقود هذا بنفسها (خلف الانترو وببطاقة تقدّم)، فلا نتسابق معها. */
  function startInstallImages(why) {
    if (!gmtInternalUI('warmup-auto')) return;
    if (!signedIn()) return;               // يدخل أوّلاً — والرئيسيّة تبدأ بعد الدخول
    if (imagesDone() || _imgRun) return;
    images({ why: why }).then(function (r) {
      if (!r || global.GMT_HOME_SHELL) return;
      if (r.total && !r.error) say('✅ نزلت صور المنتجات على جهازك (' + r.total + ') — تعمل بلا إنترنت');
    });
  }
  try {
    global.addEventListener('appinstalled', function () {
      lsSet(KEY_INST, new Date().toISOString());
      if (!global.GMT_HOME_SHELL) startInstallImages('تثبيت التطبيق');
      try { document.dispatchEvent(new CustomEvent('gmt:installed')); } catch (_) {}
    });
  } catch (_) {}
  function auto() {
    try {
      if (global.GMT_HOME_SHELL) return;     // الرئيسيّة تقود
      if (!standalone()) return;             // لا تنزيل جماعي بزيارة صفحة — عند التثبيت فقط
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      setTimeout(function () { startInstallImages('أوّل فتحٍ بعد التثبيت'); }, 3500);
    } catch (_) {}
  }
  if (document.readyState !== 'loading') auto();
  else document.addEventListener('DOMContentLoaded', auto);
})(window);
