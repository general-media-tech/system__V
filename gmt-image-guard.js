/* ═══════════════════════════════════════════════════════════════════════════
   💾 GMTImageGuard — حارس الصور: يوقف استهلاك egress من صور المنتجات
   2026-08-24

   المشكلة (بلاغ المالك — الأهمّ في المشروع):
     «عم يتم استهلاك cached egress حوالي 280% يعني 13 غيغا… المطلوب تقليل
      هذا السحب بنسبة 30% عبر تحميل الصور مرّة واحدة في بيانات المتصفّح
      عشان ما كل مرّة يجيبهم من قاعدة البيانات.»

   السبب الجذري المكتشَف:
     الصفحات ترسم الصورة هكذا:  <img src="${p.image_url}">
     و`image_url` رابط **Supabase Storage مباشر** ⇒ المتصفّح ينزّلها **فوراً من
     القاعدة**، ثم يأتي مُحلّل الكاش لاحقاً ويستبدلها بالنسخة المحلية.
     ⇒ **الكاش لا يمنع التنزيل إطلاقاً** — كل فتحة صفحة تُعيد تنزيل كل الصور.
     رُصد: 24 موضع رسم مباشر عبر الصفحات (الجرد 12 · المشتريات 10 · الأدمن 2).

   لماذا وحدة عامّة بدل تعديل 24 موضعاً:
     الترقيع الموضعي هشّ — أي `<img>` جديد يعيد المشكلة. هذا الحارس يعترض **كل**
     صورة تدخل الصفحة (حالية أو مستقبلية) قبل أن تلمس الشبكة.

   كيف يعمل:
     ① يعترض ضبط `src` على مستوى `HTMLImageElement.prototype` — قبل أي طلب شبكي.
     ② الروابط الخارجية (Storage) تُحوَّل فوراً إلى عنصر نائب، ويُحفظ الأصل في
        `data-orig-src`، ثم تُخدَم من IndexedDB إن كانت مخزَّنة.
     ③ غير المخزَّنة تُنزَّل **مرّة واحدة** وتُخزَّن، فلا تتكرّر أبداً.
     ④ يراقب DOM فيغطّي أي صورة تُضاف لاحقاً.

   🛡️ لا يمسّ: الصور المدمجة (data:) · blob: · الأصول المحلية (logo.jpg…).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23eef1f5'/%3E%3C/svg%3E";

  const stats = { served: 0, downloaded: 0, skipped: 0, failed: 0 };
  const inflight = new Map();          // رابط ⇐ وعد (يمنع تنزيل نفس الصورة مرّتين)

  /* هل هذا رابط بعيد يستهلك egress؟ */
  function isRemote(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) return false;
    if (!/^https?:\/\//i.test(url)) return false;          // أصل محلي (logo.jpg…)
    try {
      const h = new URL(url, location.href).hostname;
      return h !== location.hostname;                       // خارج نطاق الموقع
    } catch (_) { return false; }
  }

  async function fromCache(url) {
    if (!global.GMTCache || !GMTCache.cacheImage) return null;
    if (inflight.has(url)) return inflight.get(url);
    const p = (async () => {
      try { return await GMTCache.cacheImage(url); }
      catch (_) { return null; }
      finally { setTimeout(() => inflight.delete(url), 0); }
    })();
    inflight.set(url, p);
    return p;
  }

  /* ══════════════════════════════════════════════════════════════════════
     (٧ ي · طلبك «تحميل الصور عند أوّل تنزيل للتطبيق، مو عند أوّل زيارة لنقطة البيع»)
     المحفوظ على الجهاز يُعرض فوراً. وغير المحفوظ **لا يُنزَّل إلا حين يقترب من الشاشة**:
     كانت نقطة البيع ترسم كل المنتجات فيطلب الحارس كل صورها في أوّل زيارة — أي تنزيلاً
     جماعياً متخفّياً على باقتك. التنزيل الجماعي مكانه لحظة التثبيت (gmt-warmup).
     ══════════════════════════════════════════════════════════════════════ */
  let io = null;
  try {
    if ('IntersectionObserver' in global) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const im = e.target; io.unobserve(im);
          im.dataset.gimgNear = '1'; delete im.dataset.gimgDone;
          resolve(im);
        });
      }, { rootMargin: '400px 0px' });
    }
  } catch (_) { io = null; }

  async function resolve(img) {
    const url = img.getAttribute('data-orig-src');
    if (!url || img.dataset.gimgDone) return;
    img.dataset.gimgDone = '1';
    if (io && !img.dataset.gimgNear && global.GMTCache && GMTCache.cachedImage) {
      let have = null;
      try { have = await GMTCache.cachedImage(url); } catch (_) {}
      if (have) { stats.served++; try { nativeSet.call(img, have); } catch (_) {} return; }
      stats.waiting = (stats.waiting || 0) + 1;
      io.observe(img);                       // يُنزَّل حين يقترب من الشاشة
      return;
    }
    const local = await fromCache(url);
    if (local) {
      stats.served++;
      try { nativeSet.call(img, local); } catch (_) {}
      return;
    }
    /* ══════════════════════════════════════════════════════════════════════
       🔴 (2026-10-03 · بلاغ المالك) «في الأوردرات عندما أختار منتجاً معيّناً
       لا يظهر لي صورته فوراً — **لا أعرف لماذا** — أو لا تظهر لي الصور عندما
       أختار من القائمة المنسدلة».

       «لا أعرف لماذا» هي وصفٌ دقيق: كان السطر هنا:
           img.dataset.gimgFailed = '1';   // أبقِ النائب ولا تُعد المحاولة
       أي أنّ أي إخفاقٍ واحد — انقطاعٌ لحظي، أو حدّ egress، أو صورةٌ لم تُخزَّن
       بعد — يترك الصورة **مربّعاً شفافاً ١×١ إلى آخر الجلسة**، بلا رسالة ولا
       سجلّ ولا إعادة محاولة (لأنّ `gimgDone` يُوضَع قبل المحاولة أصلاً).
       فالمستخدم يرى فراغاً ولا يملك سبيلاً لمعرفة السبب.

       والمقايضة التي بُني عليها هذا الحارس (توفير egress) لا تبرّر إخفاء
       المنتج: الكاش **تحسينٌ** لا سببٌ لعرض لا شيء. فإن تعذّر الكاش نعرض
       الصورة من مصدرها مباشرةً — تُكلّفنا تنزيلاً واحداً وتُري المالك منتجه.
       ونسمح بمحاولةٍ ثانية لاحقاً (قد تكون صفحةٌ أخرى خزّنتها بيننا).
       ══════════════════════════════════════════════════════════════════════ */
    stats.failed++;
    const tries = Number(img.dataset.gimgTries || 0) + 1;
    img.dataset.gimgTries = String(tries);
    try {
      img.dataset.gimgAllow = '1';          // لا يُعترَض هذا الضبط
      nativeSet.call(img, url);             // المصدر الأصلي — أن يراها خيرٌ من فراغ
    } catch (_) {}
    if (tries < 2) {
      /* أتِح محاولة كاشٍ واحدة لاحقاً — قد تكون خُزِّنت بين الحين والحين */
      delete img.dataset.gimgDone;
    } else {
      img.dataset.gimgFailed = '1';
    }
  }

  /* ── ① اعتراض ضبط src قبل أي طلب شبكي ── */
  const proto = global.HTMLImageElement && global.HTMLImageElement.prototype;
  if (!proto) return;
  const desc = Object.getOwnPropertyDescriptor(proto, 'src');
  if (!desc || !desc.set) return;
  const nativeSet = desc.set, nativeGet = desc.get;

  Object.defineProperty(proto, 'src', {
    configurable: true,
    enumerable: desc.enumerable,
    get: function () { return nativeGet.call(this); },
    set: function (v) {
      try {
        if (isRemote(v) && !this.dataset.gimgAllow) {
          this.setAttribute('data-orig-src', v);
          nativeSet.call(this, PLACEHOLDER);                // لا طلب شبكي الآن
          resolve(this);
          return;
        }
      } catch (_) {}
      stats.skipped++;
      nativeSet.call(this, v);
    }
  });

  /* ── ② اعتراض السمة المكتوبة في HTML (innerHTML) ── */
  const nativeSetAttr = proto.setAttribute;
  proto.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === 'src') { this.src = value; return; }
    return nativeSetAttr.call(this, name, value);
  };

  /* ── ③ التقاط ما يُضاف عبر innerHTML (لا يمرّ بالـsetter) ── */
  function sweep(root) {
    try {
      (root || document).querySelectorAll('img[src^="http"]').forEach((img) => {
        const cur = img.getAttribute('src');
        if (!isRemote(cur) || img.dataset.gimgDone) return;
        img.setAttribute('data-orig-src', cur);
        nativeSet.call(img, PLACEHOLDER);
        resolve(img);
      });
      (root || document).querySelectorAll('img[data-orig-src]:not([data-gimg-done])').forEach(resolve);
    } catch (_) {}
  }

  function init() {
    sweep(document);
    try {
      new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.addedNodes || []) {
            if (n.nodeType !== 1) continue;
            if (n.tagName === 'IMG') sweep(n.parentNode || document);
            else if (n.querySelector && n.querySelector('img')) sweep(n);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    [400, 1200, 3000].forEach((ms) => setTimeout(() => sweep(document), ms));
  }

  global.GMTImageGuard = {
    stats: () => ({ ...stats, inflight: inflight.size }),
    sweep,
    /* للحالات النادرة التي تريد فيها تحميلاً مباشراً (رفع صورة جديدة مثلاً) */
    allow: (img) => { if (img) img.dataset.gimgAllow = '1'; }
  };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})(window);
