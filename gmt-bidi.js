/* ═══════════════════════════════════════════════════════════════════════════
   gmt-bidi.js — اتّجاه الحقول من محتواها · «RTL حقيقي لا مجرّد قلب صفحة» (البند ٢٢١)
   ٧ تشرين الأول ٢٠٢٦ (٧ ي)

   ما كشفه `فحص_RTL.py`: الواجهة عربيّة فكلُّ حقلٍ يُكتب من اليمين — حتى حقولُ
   الرابط والبريد والباركود والرقم التسلسليّ ورقم التتبّع واسم المستخدم. والنتيجة:
     · «+963 999 123 456» تُرتَّب مجموعاتها من اليمين فتُقرأ «456 123 999 963+»
     · الرابط «https://…/a.jpg» تقفز نقطته وشرطته لأوّل السطر
     · والعكس: حقولٌ ثُبّتت LTR فإذا كُتب فيها عربيّ انقلبت علاماته
   والحلّ ليس تثبيت اتّجاهٍ لكل حقل (٣٠٠ حقل في ٦٠ صفحة، وكلّ حقلٍ جديد يُعيد المشكلة)،
   بل قاعدةٌ واحدة لكل الحقول: **الاتّجاه يتبع أوّل حرفٍ قويّ فيما يُكتب**، والحقل
   الفارغ يبقى على اتّجاه الصفحة (فيُقرأ تلميحه العربيّ صحيحاً).
     · حرفٌ لاتينيّ أوّلاً ⇒ LTR      · حرفٌ عربيّ أوّلاً ⇒ RTL
     · أرقامٌ فقط: هاتفٌ دوليّ أو مجموعاتٌ مفصولة (+963 999 …) ⇒ LTR
                   وأرقامٌ في حقل هاتف/باركود/رقم تسلسلي ⇒ LTR
                   وغير ذلك (سعر · كمية) ⇒ اتّجاه الصفحة كما هو
   ⛔ الحقل الذي حدّد كاتبُه اتّجاهه صراحةً (`dir=` أو `data-bidi="off"`) لا يُمسّ.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTBidi || !global.document) return;
  var doc = global.document;
  var TYPES = /^(text|search|url|email|tel|)$/;
  var LTR_SIG = /phone|mobile|whats|tel\b|email|mail|url|link|href|image|img|video|photo|barcode|serial|imei|sku|iban|username|f-user|login|coupon|track|token|apikey|api-key|key\b|code\b/i;
  var STRONG = /[A-Za-zÀ-ɏ֐-ࣿיִ-﷿ﹰ-﻿]/;
  var LATIN = /[A-Za-zÀ-ɏ]/;

  /* اتّجاهٌ كتبه المؤلّف في style (لا نحن) = قرارٌ صريح كـdir= */
  function authored(el) { return !!(el.style && el.style.direction && !(el.dataset && el.dataset.bidiAuto)); }
  function eligible(el) {
    if (!el || !el.tagName) return false;
    if (authored(el)) return false;
    if (el.tagName === 'TEXTAREA') return !el.hasAttribute('dir') && !(el.dataset && el.dataset.bidi === 'off');
    if (el.tagName !== 'INPUT') return false;
    if (!TYPES.test((el.getAttribute('type') || '').toLowerCase())) return false;
    return !el.hasAttribute('dir') && !(el.dataset && el.dataset.bidi === 'off');
  }
  function sig(el) { return [el.id, el.name, el.getAttribute('autocomplete') || '', el.getAttribute('inputmode') || '', el.getAttribute('type') || ''].join(' '); }
  function want(el, v) {
    if (!v || !v.trim()) return '';
    var m = STRONG.exec(v);
    if (m) return LATIN.test(m[0]) ? 'ltr' : 'rtl';
    if (!/\d/.test(v)) return '';
    var t = v.trim();
    if (/^\+/.test(t) || /\d[\s\-\/.]+\d/.test(t)) return 'ltr';
    if (LTR_SIG.test(sig(el))) return 'ltr';
    return '';
  }
  function apply(el, v) {
    try {
      if (!eligible(el)) return;
      var d = want(el, v == null ? el.value : v);
      if (el.style.direction !== d) { el.style.direction = d; if (el.dataset) { if (d) el.dataset.bidiAuto = '1'; else delete el.dataset.bidiAuto; } }
    } catch (_) {}
  }

  /* ① ما يُكتب بيد المستخدم */
  ['input', 'focusin', 'change', 'paste'].forEach(function (ev) {
    doc.addEventListener(ev, function (e) {
      var el = e.target;
      if (ev === 'paste') { setTimeout(function () { apply(el); }, 0); return; }
      apply(el);
    }, true);
  });

  /* ② ما تكتبه الصفحة بنفسها (نافذة تعديلٍ تُعبَّأ من القاعدة) — لا حدث له، فنلتقط الضبط نفسه */
  [global.HTMLInputElement, global.HTMLTextAreaElement].forEach(function (C) {
    try {
      var p = C && C.prototype, d = p && Object.getOwnPropertyDescriptor(p, 'value');
      if (!d || !d.set || !d.get) return;
      Object.defineProperty(p, 'value', {
        configurable: true, enumerable: d.enumerable,
        get: function () { return d.get.call(this); },
        set: function (v) { d.set.call(this, v); if (this.style && (this.tagName === 'TEXTAREA' || this.type !== 'number')) apply(this, v); }
      });
    } catch (_) {}
  });

  /* ③ ما جاء في الـHTML نفسه (value="…") */
  function sweep() {
    try {
      var list = doc.querySelectorAll('input[value]:not([dir]),textarea:not([dir])');
      for (var i = 0; i < list.length; i++) if (list[i].value) apply(list[i]);
    } catch (_) {}
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', sweep); else sweep();

  global.GMTBidi = { apply: apply, want: want, sweep: sweep };
})(window);
