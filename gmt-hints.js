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
   gmt-hints.js — شرح الأزرار بالتأشير على الزر نفسه  ·  2026-08-26
   ─────────────────────────────────────────────────────────────────────────
   طلب المالك (بلاغ B8 · 2026-08-23):
     «أريد شرح كل زر يؤشّر على الزر نفسه لا بطاقات متنقّلة».

   ما يفعله:
     ① تلميح فوري: أي عنصر يحمل data-hint يُظهر شرحه عند المرور (أو اللمس
        المطوّل على الجوال) في فقاعة **ملتصقة بالعنصر** وسهمها يشير إليه.
     ② جولة «شو هالزر؟»: تمشي على أزرار الصفحة واحداً واحداً، تُضيء الزر
        الحقيقي بثقب ضوئي (spotlight) وتثبّت الفقاعة عليه — لا بطاقة تطير
        في منتصف الشاشة.

   بلا اعتماديات · لا يلمس منطق الصفحة · يُلغى بالضغط على Esc أو خارج الفقاعة.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  if (global.GMTHints) return;

  var Z = 2147483000;
  var bubble = null, spot = null, tourIdx = -1, tourList = [], inTour = false;

  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = el('div', 'position:fixed;z-index:' + (Z + 2) + ';max-width:300px;background:#0f172a;' +
      'color:#fff;border-radius:12px;padding:11px 14px;font-size:13px;line-height:1.75;' +
      'font-family:inherit;direction:rtl;text-align:right;box-shadow:0 10px 30px rgba(0,0,0,.35);' +
      'opacity:0;transition:opacity .15s;pointer-events:none;font-weight:600;');
    var arrow = el('div', 'position:absolute;width:12px;height:12px;background:#0f172a;transform:rotate(45deg);');
    arrow.setAttribute('data-arrow', '1');
    bubble.setAttribute('data-gmt-hints', '1');          /* كي لا يعدّه فحصُ «هل الزرّ ظاهرٌ فعلاً» غطاءً فوق الزرّ */
    bubble.appendChild(arrow);
    document.body.appendChild(bubble);
    return bubble;
  }

  /* يضع الفقاعة ملتصقة بالعنصر، وسهمها يشير إليه فعلياً */
  function place(target, text, withTourUI) {
    var b = ensureBubble();
    var arrow = b.querySelector('[data-arrow]');
    b.querySelectorAll('[data-body]').forEach(function (n) { n.remove(); });
    var body = el('div', '', text);
    body.setAttribute('data-body', '1');
    b.appendChild(body);

    if (withTourUI) {
      var bar = el('div', 'display:flex;gap:8px;align-items:center;justify-content:space-between;' +
        'margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.15);pointer-events:auto;');
      bar.setAttribute('data-body', '1');
      bar.innerHTML =
        '<span style="font-size:11px;opacity:.7;font-weight:700">' + (tourIdx + 1) + ' / ' + tourList.length + '</span>' +
        '<span style="display:flex;gap:6px">' +
        '<button data-h="prev" style="background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:8px;padding:5px 11px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">السابق</button>' +
        '<button data-h="next" style="background:#D5001C;border:0;color:#fff;border-radius:8px;padding:5px 13px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">' +
        (tourIdx >= tourList.length - 1 ? 'إنهاء' : 'التالي') + '</button>' +
        '<button data-h="end" style="background:transparent;border:0;color:#fff;opacity:.6;border-radius:8px;padding:5px 8px;font-size:14px;cursor:pointer;font-family:inherit">✕</button>' +
        '</span>';
      b.appendChild(bar);
      bar.querySelector('[data-h="next"]').onclick = function () { step(1); };
      bar.querySelector('[data-h="prev"]').onclick = function () { step(-1); };
      bar.querySelector('[data-h="end"]').onclick = endTour;
      b.style.pointerEvents = 'auto';
    } else {
      b.style.pointerEvents = 'none';
    }

    b.style.opacity = '0';
    b.style.left = '-9999px';
    // قياس بعد الرسم
    requestAnimationFrame(function () {
      var r = target.getBoundingClientRect();
      var bw = b.offsetWidth, bh = b.offsetHeight;
      var gap = 12;
      var below = r.bottom + gap + bh < innerHeight || r.top - gap - bh < 0;
      var top = below ? r.bottom + gap : r.top - gap - bh;
      var left = r.left + r.width / 2 - bw / 2;
      left = Math.max(8, Math.min(left, innerWidth - bw - 8));
      b.style.top = Math.max(8, top) + 'px';
      b.style.left = left + 'px';
      // السهم يشير لمركز العنصر
      var ax = Math.max(10, Math.min(r.left + r.width / 2 - left - 6, bw - 22));
      arrow.style.left = ax + 'px';
      arrow.style.top = below ? '-6px' : (bh - 6) + 'px';
      b.style.opacity = '1';
    });
  }

  function hide() {
    if (bubble) { bubble.style.opacity = '0'; bubble.style.pointerEvents = 'none'; }
  }

  /* ثقب ضوئي حول العنصر الحقيقي */
  function spotlight(target) {
    if (!spot) {
      spot = el('div', 'position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;transition:box-shadow .2s');
      spot.setAttribute('data-gmt-hints', '1');
      document.body.appendChild(spot);
    }
    var r = target.getBoundingClientRect();
    var pad = 6;
    spot.style.cssText = 'position:fixed;z-index:' + Z + ';pointer-events:none;transition:all .22s;' +
      'border-radius:12px;border:2px solid #D5001C;' +
      'box-shadow:0 0 0 9999px rgba(15,23,42,.62);' +
      'top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;' +
      'width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px;';
  }
  function clearSpot() { if (spot) { spot.remove(); spot = null; } }

  /* ── نصّ الشرح: من data-hint، وإلا من title، وإلا من نصّ الزر ── */
  function hintOf(node) {
    var cur = (node.getAttribute('data-hint') || node.getAttribute('title') || '').trim();
    if (cur) return cur;
    return autoDescribe(node) || '';
  }

  /* ═══ (١١ ت١ — Notes ١٠ ت١ · «شو هالزر نقّحها بشكل كبير: تفلت أزرار / تأخذك لأزرار مو موجودة / لمناطق خارج الشاشة …
         كل زرّ على حدة، وتؤثّر عليه بشكلٍ كامل») ═══
     ١) التغطية: كان يشرح فقط ما عليه data-hint (نقطة البيع ٣٦ من ١٣٦ زرّاً · الأوردرات ١٩ من ١٢٥ · الجرد ١٣ من ٢٥٥ · أدمن النقاط صفر).
        الآن كل زرٍّ ظاهر: الشرح المكتوب باليد أوّلاً، ثمّ title/aria-label، ثمّ شرحٌ **تلقائيّ صادق** من اسم دالّة الزرّ
        («يفتح …» · «يحفظ …») — ويُوسَم «شرح تلقائي» ولا يُدّعى أكثر ممّا يُعرف.
     ٢) الصدق في «هل هو ظاهرٌ فعلاً»: فحصٌ **بعد التمرير**: العنصر داخل الشاشة ≥٤٠٪ من مساحته، وأعلى عنصرٍ عند مركزه هو هو (لا نافذةٌ فوقه
        ولا حاويةٌ بـoverflow تقصّه) — وإلّا يُتخطّى ولا يُؤشَّر على فراغ.
     ٣) نافذةٌ مفتوحة ⇒ الجولة على ما داخلها فقط (ما خلفها مغطّى).
     ٤) التكرار (أزرار «تعديل» في ٦٠ صفّاً) ⇒ تُشرح مرّةً واحدة مع العدد. ═══ */
  var VERB = [
    [/^(open|show|view|display|goto|go|nav|launch|start|begin)/i, 'يفتح'], [/^(save|submit|apply|commit|store|update|set(?!view|mode|tab))/i, 'يحفظ'],
    [/^(delete|remove|del|clear|erase|drop|purge|drain)/i, 'يحذف (يطلب تأكيداً)'], [/^(print|pdf)/i, 'يطبع'],
    [/^(export|download|dl|backup)/i, 'يصدّر/ينزّل ملفاً'], [/^(import|upload|pick|choose|attach)/i, 'يستورد/يرفع'],
    [/^(toggle|switch|setview|setmode|settab|select|tab|filter|sort|group)/i, 'يبدّل العرض/الفلتر'], [/^(close|hide|dismiss|cancel|back|exit|end)/i, 'يغلق/يلغي'],
    [/^(refresh|reload|sync|load|fetch|retry)/i, 'يحدّث/يعيد التحميل'], [/^(search|find|scan|lookup)/i, 'يبحث/يمسح'],
    [/^(add|new|create|insert|plus|append)/i, 'يضيف/ينشئ'], [/^(edit|modify|change|rename)/i, 'يعدّل'],
    [/^(confirm|approve|accept|ok|done|finish|complete|receive|collect|settle)/i, 'يؤكّد/يعتمد'], [/^(share|send|notify|whatsapp|wa|telegram|tg|call|contact)/i, 'يشارك/يرسل/يتواصل'],
    [/^(copy|clone|duplicate)/i, 'ينسخ'], [/^(undo|redo|restore|revert|rollback)/i, 'يتراجع/يستعيد'], [/^(next|prev|previous|more|page)/i, 'ينتقل']
  ];
  function labelOf(n) {
    var t = (n.getAttribute('aria-label') || n.innerText || n.value || n.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    return t.length > 40 ? t.slice(0, 38) + '…' : t;
  }
  function handlerName(n) {
    var oc = n.getAttribute && n.getAttribute('onclick'); if (!oc) return '';
    var m = String(oc).replace(/^\s*(?:closeMoreSheet\(\);?\s*|event\.stopPropagation\(\);?\s*)+/, '').match(/([A-Za-z_$][\w$]*)\s*\(/);
    return m ? m[1] : '';
  }
  function escH(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function autoDescribe(n) {
    var tag = (n.tagName || '').toLowerCase(), lab = escH(labelOf(n));      /* نصّ الزرّ قد يحمل بياناتٍ (اسم منتج…) — لا يُحقَن كـHTML */
    if (tag === 'a') {
      var href = n.getAttribute('href') || '';
      if (!href || href === '#' || /^javascript:/i.test(href)) return lab ? 'رابط «' + lab + '»' : '';
      return (lab ? '«' + lab + '» — ' : '') + 'ينقلك إلى صفحة أخرى' + (/^https?:|^tel:|^mailto:/i.test(href) ? ' (خارج النظام)' : '');
    }
    if (tag === 'select') return (lab ? lab + ' — ' : '') + 'قائمة اختيار: يغيّر ما يُعرض أو يُحفَظ';
    if (tag === 'input' && /checkbox|radio/i.test(n.type)) return 'خانة اختيار' + (lab ? ' «' + lab + '»' : '');
    if (tag === 'input' || tag === 'textarea') return (lab ? 'حقل «' + lab + '»' : 'حقل إدخال');
    var hn = handlerName(n), verb = '';
    if (hn) for (var i = 0; i < VERB.length; i++) if (VERB[i][0].test(hn)) { verb = VERB[i][1]; break; }
    if (!lab && !verb) return '';
    return '<span style="opacity:.6;font-size:11px">شرح تلقائي</span><br>' + (lab ? '«' + lab + '»' : 'زرّ') + (verb ? ' — ' + verb : ' — زرّ في هذه الصفحة') + (hn ? ' <span dir="ltr" style="opacity:.45;font-size:10.5px">(' + escH(hn) + ')</span>' : '');
  }

  /* ① التلميح الفوري */
  function onEnter(e) {
    if (inTour) return;
    var n = e.target.closest('[data-hint],[title]');
    if (!n) return;
    var t = hintOf(n);
    if (!t) return;
    // امنع تلميح المتصفّح المزدوج
    if (n.hasAttribute('title')) { n.setAttribute('data-hint', t); n.removeAttribute('title'); }
    place(n, t, false);
  }
  function onLeave(e) { if (!inTour && e.target.closest && e.target.closest('[data-hint]')) hide(); }

  /* ② الجولة على الأزرار الحقيقية */
  var ACTIONABLE = 'button,[role="button"],a[href],input[type="button"],input[type="submit"],select,[data-hint],[onclick]';
  function insideInert(n) {
    for (var p = n; p && p.nodeType === 1; p = p.parentElement) {
      if (p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true' || p.hidden) return true;
      if (p.tagName === 'DETAILS' && !p.open && p !== n && !(n.closest('summary'))) return true;
    }
    return false;
  }
  /* نافذةٌ مفتوحة فوق الصفحة؟ ⇒ نحصر الجولة بها */
  function topLayer() {
    var cands = document.querySelectorAll('[role="dialog"],[aria-modal="true"],.modal,.gmtask-ov,[id$="Modal"],[id$="-modal"],.modal-overlay,.overlay');
    var best = null, bz = -1;
    cands.forEach(function (m) {
      if (m.closest('[data-gmt-hints]')) return;
      var cs = getComputedStyle(m), r = m.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 40 || r.height < 40) return;
      var covers = r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.6 && (cs.position === 'fixed' || cs.position === 'absolute');
      var z = parseInt(cs.zIndex, 10) || 0;
      if ((covers || /dialog/.test(m.getAttribute('role') || '') || m.getAttribute('aria-modal') === 'true') && z >= bz) { best = m; bz = z; }
    });
    /* نوافذ تُبنى بلا role/class معروف (طبقةٌ ثابتة تغطّي الشاشة مباشرةً تحت body) */
    Array.prototype.forEach.call(document.body.children, function (m) {
      if (m.hasAttribute('data-gmt-hints') || m.tagName === 'SCRIPT' || m.tagName === 'STYLE') return;
      var cs = getComputedStyle(m), r = m.getBoundingClientRect();
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return;
      if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.6) return;
      var z = parseInt(cs.zIndex, 10) || 0;
      if (z >= 100 && z >= bz && m.querySelector('button,a[href],input,select,[onclick]') && !/gmt-refresh|gmt-update|gmt-cache|gmt-training|gmt-sovereign/.test(m.id || '')) { best = m; bz = z; }
    });
    return best;
  }
  function collect() {
    var out = [], seen = {}, layer = topLayer();
    var root = layer || document;
    root.querySelectorAll(ACTIONABLE).forEach(function (n) {
      if (n.closest('[data-gmt-hints]')) return;
      if (n.disabled || n.getAttribute('aria-disabled') === 'true') return;
      if (n.tagName === 'DIV' && n.hasAttribute('onclick') && !labelOf(n) && !hintOf(n)) return;
      if (!aliveAndVisible(n) || insideInert(n)) return;
      var d = hintOf(n); if (!d) return;
      var key = (labelOf(n) + '|' + handlerName(n) + '|' + (n.getAttribute('href') || '')).slice(0, 120);
      if (seen[key]) { seen[key].__gmtDup = (seen[key].__gmtDup || 1) + 1; return; }
      n.__gmtDup = 1; seen[key] = n; out.push(n);
    });
    // ترتيب بصري: الأعلى ثم الأيمن (واجهة RTL)
    out.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (Math.round(ra.top / 40) - Math.round(rb.top / 40)) || (rb.left - ra.left);
    });
    return out.slice(0, 80);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     🔴 (2026-10-03 · بلاغ المالك) «**شو هالزر** تفلت وتؤشّر على ما ليس موجوداً».

     السبب: الجولة تجمع الأزرار **مرّةً واحدة عند البدء**، ثمّ تمشي عليها.
     وبين خطوةٍ وأخرى تتغيّر الصفحة: تُغلَق نافذة · تُعاد رسمُ قائمة · يُبدَّل
     تبويب ⇒ يصير العنصر **منزوعاً من المستند**. و`getBoundingClientRect()`
     لعنصرٍ منزوع يُرجِع أصفاراً، فيقفز الثقبُ الضوئيّ إلى الزاوية ويُؤشّر على
     فراغ — وهو ما رآه المالك حرفياً.

     وعطلٌ ثانٍ معه: الثقب `position:fixed` بإحداثيّاتٍ محسوبة لحظةَ العرض، فإن
     مرّر المالك الصفحة بقي الثقب مكانه و«تفلّت» عن الزرّ.

     العلاج: ① نتحقّق أنّ العنصر **ما زال موصولاً ومرئياً** قبل الإضاءة وبعد
     انتظار التمرير · ② وإن اختفى **نتخطّاه في اتّجاه السير** لا نقف عليه ·
     ③ ونتابع موضعه مع التمرير وتغيّر المقاس ما دامت الجولة مفتوحة.
     ═══════════════════════════════════════════════════════════════════════ */
  function aliveAndVisible(n) {
    try {
      if (!n || !n.isConnected) return false;
      var cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      var r = n.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    } catch (_) { return false; }
  }

  /* ظاهرٌ فعلاً على الشاشة الآن: داخل الإطار ≥٤٠٪ وأعلى عنصرٍ عند مركزه هو هو (لا غطاء ولا قصّ) */
  function trulyVisible(n) {
    try {
      if (!aliveAndVisible(n)) return false;
      var r = n.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
      var iw = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)), ih = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (iw * ih < 0.4 * r.width * r.height) return false;
      var xs = [0.5, 0.25, 0.75], hit = false;
      for (var i = 0; i < xs.length && !hit; i++) {
        var x = Math.min(Math.max(r.left + r.width * xs[i], 0), vw - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
        var stack = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
        for (var k = 0; k < stack.length; k++) {
          var t = stack[k]; if (!t || (t.closest && t.closest('[data-gmt-hints]'))) continue;
          hit = (t === n || n.contains(t) || t.contains(n)); break;                 // أوّل عنصرٍ حقيقيّ فوق النقطة
        }
      }
      return hit;
    } catch (_) { return false; }
  }

  var tourSkipped = 0;                // كم زرّاً تخطّته الجولة لأنّه غير ظاهرٍ فعلاً (للاختبار والتقرير)
  var _dir = 1;                       // اتّجاه السير — لتخطّي المفقود بذكاء
  var _follow = null;                 // متابعُ الموضع أثناء الجولة

  function show(i) {
    /* تخطَّ ما لم يعد موجوداً — في اتّجاه السير */
    var guard = 0;
    while (tourList[i] && !aliveAndVisible(tourList[i]) && guard++ < tourList.length) {
      i += (_dir >= 0 ? 1 : -1);
    }
    var n = tourList[i];
    if (!n || !aliveAndVisible(n)) return endTour();
    tourIdx = i;
    clearSpot(); hide();                  /* لا يبقى ثقبُ/فقاعةُ الخطوة السابقة معلَّقَين فوق عنصرٍ آخر أثناء التخطّي */
    try { n.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' }); } catch (_) {}
    setTimeout(function () {
      /* قد يختفي أثناء التمرير، أو يبقى مقصوصاً/مغطّى — نُعيد الفحص الحقيقيّ لا نَفترض، ونتخطّى بصمت */
      if (!trulyVisible(n)) { tourSkipped++; try { (global.__gmtHintSkips = global.__gmtHintSkips || []).push(String(labelOf(n) || n.id || n.className).slice(0, 40)); } catch (_) {} step(_dir >= 0 ? 1 : -1); return; }
      spotlight(n);
      var dup = n.__gmtDup > 1 ? '<div style="opacity:.65;font-size:11px;margin-top:4px">يتكرّر ' + n.__gmtDup + ' مرّة في هذه الشاشة (مثلاً في كل صفّ) — يُشرح هنا مرّة واحدة</div>' : '';
      place(n, hintOf(n) + dup, true);
      startFollow(n);
    }, 90);
  }

  /* يُبقي الثقب ملتصقاً بالزرّ أثناء التمرير — وينهي الجولة إن اختفى الزرّ */
  function startFollow(n) {
    stopFollow();
    _follow = setInterval(function () {
      if (!inTour) return stopFollow();
      if (!trulyVisible(n)) { stopFollow(); step(_dir >= 0 ? 1 : -1); return; }
      spotlight(n);
    }, 260);
  }
  function stopFollow() { if (_follow) { clearInterval(_follow); _follow = null; } }

  function step(d) {
    _dir = d >= 0 ? 1 : -1;
    var next = tourIdx + d;
    if (next < 0) return;
    if (next >= tourList.length) return endTour();
    show(next);
  }
  function startTour() {
    tourSkipped = 0;
    tourList = collect();
    if (!tourList.length) {
      try { (window.GMTAsk ? GMTAsk.alert : alert)('لا أزرار ظاهرة لأشرحها الآن في هذه الشاشة.', { title: 'شو هالزر؟' }); } catch (_) {}
      return;
    }
    inTour = true;
    show(0);
  }
  function endTour() {
    inTour = false; tourIdx = -1;
    stopFollow();
    clearSpot(); hide();
  }

  /* زر عائم لبدء الجولة */
  function mountButton() {
    if (!gmtInternalUI('hints')) return;               // زر «شو هالزر؟» للموظّف لا للزبون
    /* (2026-08-26 · طلب المالك) الصفحة التي توفّر مدخلاً خاصاً للمساعدة (زر «❔ المساعدة»)
       لا تحتاج زراً عائماً إضافياً — دُمج الثلاثة في قائمة واحدة أعلى الصفحة. */
    if (typeof window.openHelpMenu === 'function') return;
    if (document.getElementById('gmt-hints-fab')) return;
    if (!document.querySelector('[data-hint],[title]')) return;   // لا شرح ⇒ لا زر
    var host = _topBarHost();
    var b;
    /* (2026-10-06) وثيقة التصميم ٢٠–٢١: «لا أزرار عائمة ولا فقاعات أبداً في كل السيستم» ⇒ بلا شريطٍ علويّ
       لا زرّ — والجولة تبقى في قائمة المساعدة/الخيارات (GMTHints.tour). */
    if (!host) return;
    if (host) {
      /* ٦٢: داخل الشريط العلويّ — لا يطفو فوق المحتوى */
      b = el('button', 'background:#fff;color:#0f172a;border:1px solid rgba(0,0,0,.08);' +
        'border-radius:9px;width:30px;height:30px;font-size:14px;line-height:1;cursor:pointer;' +
        'font-family:inherit;display:inline-flex;align-items:center;justify-content:center;padding:0;', '❔');
      b.title = 'شو هالزر؟ — جولةٌ تشرح أزرار هذه الصفحة';
    } else {
      /* صفحةٌ بلا شريط: زرٌّ صغيرٌ في الزاوية — لا فقاعةٌ عريضة فوق المحتوى */
      b = el('button', 'position:fixed;top:8px;inset-inline-start:8px;z-index:' + (Z - 5) + ';' +
        'background:#fff;color:#0f172a;border:1px solid rgba(0,0,0,.12);border-radius:9px;' +
        'width:30px;height:30px;font-size:14px;cursor:pointer;font-family:inherit;padding:0;', '❔');
      b.title = 'شو هالزر؟';
    }
    b.id = 'gmt-hints-fab';
    b.setAttribute('data-keep-fab', '1');
    b.onclick = startTour;
    (host || document.body).appendChild(b);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     🚫 طلبك ٦٢ (مكرَّرٌ ثلاث مرّات): «إزالة أزرار العقل والنيو **وكل الأزرار
     العائمة**».

     ولم أحذف الوظيفة — قاعدتُك الأخرى تمنع ذلك: «لا تحذف وظيفة موجودة».
     فالزرُّ **انتقل** إلى الشريط العلويّ (شريط التحديث · ت٥) بدل أن يطفو فوق
     المحتوى. وهكذا: لا شيء يطفو، ولا ميزةَ تضيع.

     ولماذا الشريطُ العلوي بالذات: لأنّه **يدفع المحتوى للأسفل** ولا يغطّيه —
     وهذا هو الفرق بين «شريط» و«فقاعة». وقد بُني أصلاً لهذا الغرض.
     ══════════════════════════════════════════════════════════════════════════ */
  function _topBarHost() {
    /* (2026-10-06 · فحص الأزرار العائمة) كان يجد شريط الرئيسيّة وحده، فيطفو «❔» في زاوية ٥ صفحات
       (نقطة البيع · الجرد · أدمن النقاط · الكفالة · المشتريات). نبحث عن شريط كل صفحة. */
    return document.querySelector('.gmt-refresh-bar') || document.getElementById('gmt-refresh-bar') ||
           document.querySelector('.hdr-actions, .topbar-actions, .header-actions, .tb-actions, header .actions') || null;
  }

  document.addEventListener('mouseover', onEnter, true);
  document.addEventListener('mouseout', onLeave, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') endTour(); });
  addEventListener('resize', function () { if (inTour) show(tourIdx); else hide(); });
  addEventListener('scroll', function () { if (!inTour) hide(); }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton);
  else mountButton();

  global.GMTHints = {
    tour: startTour,
    end: endTour,
    show: function (sel, text) {
      var n = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (n) place(n, text || hintOf(n), false);
    },
    count: function () { return collect().length; },
    skipped: function () { return tourSkipped; },
    _state: function () { return { idx: tourIdx, el: tourList[tourIdx] || null, n: tourList.length, on: inTour }; },
    _collect: collect, _trulyVisible: trulyVisible, _describe: hintOf, _auto: autoDescribe,
    mount: mountButton
  };
})(window);
