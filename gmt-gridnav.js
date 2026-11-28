/* gmt-gridnav.js — تنقّل لوحة المفاتيح كجداول إكسل في كلّ شبكة قابلة للتعديل
   (TASK-A0592 · المالك seq A1143): «الاسهم تعمل متل اكسل: للتحت لتحت والي لفوق لفوق — في الجرد والفواتير وكل مكان».
   يكفي تضمين الملف — لا ربط لكلّ صفحة. اكتشاف الشبكة:
     ١) جدول <table>: صفوف <tr> الشقيقة التي فيها حقول قابلة للتعديل (input/select/textarea/contenteditable).
     ٢) صفوف div متكرّرة بالبنية نفسها (≥٢ صفّ · كلّ صفّ ≥٢ حقل وبعدد الحقول نفسه) — بنود الفواتير المبنيّة بـ div.
     ٣) اختيارٌ صريح: data-grid على الحاوية و data-grid-row على الصفوف (يُلغي التخمين ويسمح بـ Enter داخل <form>).
     data-nogrid على الحقل أو أيّ سلفٍ له ⇒ يُستثنى.
   القواعد:
     ↓ / Enter ⇒ الحقل نفسه (العمود نفسه) في الصفّ التالي · ↑ / Shift+Enter ⇒ السابق.
     ← / → ⇒ الحقل المجاور بصرياً (يراعي RTL بالهندسة الفعليّة) وفقط عندما يكون المؤشّر عند طرف النصّ (لا نكسر حركة المؤشّر).
     حقول number: ↑/↓ تتنقّل بدل الزيادة (داخل الشبكات فقط) و←/→ تنتقل (لا مؤشّر يُقرأ فيها) · يُحدَّد نصّها عند الوصول.
     لا نتدخّل: select (سلوكه الأصلي) · textarea (Ctrl+سهم فقط) · قوائم الاقتراح/الإكمال التلقائي المفتوحة · Alt/Ctrl/Meta · أيّ مُعالِجٍ سبق فمنع الافتراضي.
   ملاحظة تصميمية: المستمع على document في طور الفقاعة (لا الالتقاط) كي يحترم مُعالِجات الصفحات القائمة
   (e.defaultPrevented) فلا يزاحم تنقّل purchase.html ولا مُعالِج وضع الجرد. */
(function () {
  'use strict';
  if (window.GMTGridNav) return;

  var SKIP_TYPES = /^(hidden|checkbox|radio|button|submit|reset|file|range|color|image)$/i;
  var EDIT_SEL = 'input,select,textarea,[contenteditable=""],[contenteditable="true"]';
  var POPUP_SEL = '.ac-item,.ac-new,.ac-active,[role="listbox"],[class*="suggest"],[class*="autocomplete"],[class*="Suggest"]';

  function visible(el) {
    if (!el || !el.getClientRects) return false;
    if (!el.getClientRects().length) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (!el.matches(EDIT_SEL)) return false;
    if (el.tagName === 'INPUT' && SKIP_TYPES.test(el.type)) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.closest('[data-nogrid]')) return false;
    return visible(el);
  }
  function editablesIn(root) {
    var out = [], all = root.querySelectorAll(EDIT_SEL);
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      /* contenteditable متداخل داخل contenteditable آخر لا يُحسب مرّتين */
      if (isEditable(e)) out.push(e);
    }
    return out;
  }
  function editableOf(target) {
    if (!target || target.nodeType !== 1) return null;
    if (target.matches && target.matches(EDIT_SEL)) return target;
    return target.closest ? target.closest('[contenteditable=""],[contenteditable="true"]') : null;
  }

  /* ── اكتشاف الشبكة: يرجع { rows:[عناصر الصفوف], row, cols:[حقول الصفّ الحالي], ci, tableCell } أو null ── */
  function sigOf(el) { return el.tagName + '|' + (el.getAttribute('class') || ''); }

  function detect(el) {
    var gridRoot = el.closest('[data-grid]');
    var rows, row;
    if (gridRoot) {
      var marked = gridRoot.querySelectorAll('[data-grid-row]');
      rows = marked.length ? Array.prototype.slice.call(marked) : Array.prototype.slice.call(gridRoot.querySelectorAll('tr')).filter(function (t) { return t.querySelector(EDIT_SEL); });
      if (!rows.length) rows = Array.prototype.slice.call(gridRoot.children);
      row = null;
      for (var i = 0; i < rows.length; i++) if (rows[i].contains(el)) { row = rows[i]; break; }
      if (!row || rows.length < 2) return null;
      return { rows: rows, row: row, explicit: true, form: false };
    }
    var tr = el.closest('tr');
    if (tr && tr.parentElement) {
      rows = Array.prototype.filter.call(tr.parentElement.children, function (r) { return r.tagName === 'TR'; });
      var withEd = rows.filter(function (r) { return r.querySelector(EDIT_SEL); });
      if (withEd.length >= 2) return { rows: rows, row: tr, explicit: false, form: !!el.closest('form') };
    }
    /* صفوف div: اصعد حتى تجد سلفاً له ≥٢ أشقّاء بالبنية نفسها وكلّ منها ≥٢ حقل وبالعدد نفسه */
    var a = el, hops = 0;
    while (a && a.parentElement && a !== document.body && hops++ < 7) {
      var par = a.parentElement;
      if (par.tagName !== 'TABLE' && par.tagName !== 'TBODY' && a.tagName !== 'TR') {
        var sig = sigOf(a), mine = editablesIn(a).length;
        if (mine >= 2) {
          var sibs = Array.prototype.filter.call(par.children, function (s) { return sigOf(s) === sig && editablesIn(s).length === mine; });
          if (sibs.length >= 2) return { rows: sibs, row: a, explicit: false, form: !!el.closest('form') };
        }
      }
      a = par;
    }
    return null;
  }

  /* العمود: tr ⇒ فهرس الخليّة + ترتيب الحقل داخلها · div ⇒ ترتيب الحقل في الصفّ */
  function colInfo(g, el) {
    if (g.row.tagName === 'TR') {
      var td = el.closest('td,th'); if (!td || td.parentElement !== g.row) return null;
      var inCell = editablesIn(td);
      return { cell: td.cellIndex, k: Math.max(0, inCell.indexOf(el)) };
    }
    return { idx: editablesIn(g.row).indexOf(el) };
  }
  function fieldInRow(g, row, info) {
    if (row.tagName === 'TR' && info.cell != null) {
      var td = row.children[info.cell]; if (!td) return null;
      var l = editablesIn(td); return l.length ? (l[Math.min(info.k, l.length - 1)]) : null;
    }
    var all = editablesIn(row); return info.idx >= 0 && all[info.idx] ? all[info.idx] : null;
  }

  function popupOpen(el) {
    if (el.getAttribute('aria-expanded') === 'true') return true;
    if (el.hasAttribute('list')) return true;                         /* datalist: لا يُعرف إن كانت مفتوحة ⇒ لا نتدخّل بالسهمين */
    var role = el.getAttribute('role');
    if (role === 'combobox' && el.getAttribute('aria-expanded') !== 'false') return true;
    var ps = document.querySelectorAll(POPUP_SEL);
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p === el || p.contains(el) || el.contains(p)) continue;
      if (p.tagName === 'INPUT') continue;
      if (visible(p) && (p.offsetHeight > 0) && (p.textContent || '').trim()) return true;
    }
    return false;
  }

  function caretEdge(el, dirIsRtl, key) {
    /* هل المؤشّر عند الطرف الذي يخرج منه هذا السهم؟ ← في RTL يخرج من آخر النصّ · → في RTL من أوّله */
    var leaving = (key === 'ArrowLeft') ? (dirIsRtl ? 'end' : 'start') : (dirIsRtl ? 'start' : 'end');
    if (el.isContentEditable && el.tagName !== 'INPUT') {
      var sel = getSelection(); if (!sel || !sel.rangeCount) return true;
      var r = sel.getRangeAt(0); if (!r.collapsed) return true;
      var pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
      var pos = pre.toString().length, len = el.textContent.length;
      return leaving === 'start' ? pos === 0 : pos === len;
    }
    if (el.tagName === 'INPUT' && el.type === 'number') return true;   /* لا selectionStart لحقل رقم */
    var s, e;
    try { s = el.selectionStart; e = el.selectionEnd; } catch (_) { return true; }   /* email … لا مؤشّر مقروء */
    if (s == null) return true;
    if (s !== e) return false;
    return leaving === 'start' ? s === 0 : s === el.value.length;
  }

  var navFlag = false;
  function go(to) {
    if (!to) return false;
    navFlag = true;
    try { to.focus({ preventScroll: false }); } catch (_) { to.focus(); }
    try { if (to.scrollIntoView) to.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    if (to.tagName === 'INPUT' && to.type === 'number') { try { to.select(); } catch (_) {} }
    else if (to.tagName === 'INPUT' && /^(text|search|tel|url|password|email)?$/i.test(to.type) && !to.isContentEditable) { /* النصّ: المؤشّر كما هو (لا نحدّد) */ }
    navFlag = false;
    return true;
  }

  function vertical(g, el, dir) {
    var info = colInfo(g, el); if (!info) return false;
    var i = g.rows.indexOf(g.row) + dir;
    while (g.rows[i]) {
      var t = fieldInRow(g, g.rows[i], info);
      if (t) return go(t);
      i += dir;
    }
    return false;
  }
  function horizontal(g, el, key) {
    var list = g.row.tagName === 'TR' ? editablesIn(g.row) : editablesIn(g.row);
    var me = el.getBoundingClientRect(), cx = me.left + me.width / 2, best = null, bd = Infinity;
    var toLeft = key === 'ArrowLeft';
    for (var i = 0; i < list.length; i++) {
      if (list[i] === el || el.contains(list[i]) || list[i].contains(el)) continue;
      var r = list[i].getBoundingClientRect(), c = r.left + r.width / 2;
      var d = toLeft ? cx - c : c - cx;
      if (d > 1 && d < bd) { bd = d; best = list[i]; }
    }
    return best ? go(best) : false;
  }

  function onKey(e) {
    if (e.defaultPrevented || e.isComposing) return;
    var k = e.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Enter') return;
    var el = editableOf(e.target); if (!el || !isEditable(el)) return;
    if (el.tagName === 'SELECT') return;
    var isTA = el.tagName === 'TEXTAREA';
    if (e.altKey || e.metaKey) return;
    if (e.ctrlKey && !isTA) return;
    if (isTA && !e.ctrlKey) return;
    if (isTA && k === 'Enter') return;
    if (e.shiftKey && !(k === 'Enter')) return;
    if (el.isContentEditable && el.tagName !== 'INPUT' && k === 'Enter' && !e.shiftKey) { /* لا سطر جديد في خانة الجدول */ }
    var g = detect(el); if (!g) return;
    if (k === 'Enter' && g.form && !g.explicit) return;               /* Enter داخل <form> قد يُرسل شيئاً مهمّاً */
    if (popupOpen(el)) return;                                        /* قائمة اقتراحات مفتوحة ⇒ السهمان لها */
    var moved = false;
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter') {
      var dir = (k === 'ArrowUp' || (k === 'Enter' && e.shiftKey)) ? -1 : 1;
      moved = vertical(g, el, dir);
      if (!moved && el.tagName === 'INPUT' && el.type === 'number' && k !== 'Enter') { e.preventDefault(); return; }   /* لا زيادة/إنقاص داخل الشبكة */
    } else {
      var rtl = getComputedStyle(el).direction === 'rtl';
      if (!caretEdge(el, rtl, k)) return;
      moved = horizontal(g, el, k);
    }
    if (moved) e.preventDefault();
  }

  document.addEventListener('keydown', onKey, false);
  window.GMTGridNav = { version: 1, detect: detect };
})();
