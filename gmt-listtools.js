/* ═════════════════════════════════════════════════════════════════════
   gmt-listtools.js — 🔎 بحث · 🖨️ طباعة · ⬇️ إكسل لأيّ جدول أو قائمة جوّا أيّ نافذة — تلقائياً (دستور الأداة الجديدة ٤ و١١ · seq B1127)
   «لمّا بعطيك أداة ما بتساويها فيها كلّشي ولازم اطلب منك كلّشي فيها» ⇒ البنود اللي بتتكرّر بكلّ أداة صارت قطعة وحدة:
   - كلّ <table> جوّا نافذة [data-gmt-modal] فيها ٣ صفوف أو أكتر ⇐ شريط أدوات فوقها (البحث من ٦ صفوف وطالع).
   - قائمة بطاقات: حطّ data-gmt-list على الحاوية (كلّ ابن = صفّ) ⇐ نفس الشريط.
   - data-gmt-notools ⇐ بلا شريط · data-gmt-nosearch ⇐ بلا بحث (الأداة إلها بحثها — ممنوع بحثين B1083) · data-gmt-noprint ⇐ بلا طباعة (إلها طباعتها) · data-gmt-nocsv ⇐ بلا إكسل · data-gmt-title="…" ⇐ عنوان الطباعة/الملف (وإلّا أوّل عنوان بالنافذة).
   محمّل تلقائياً من gmt-core.js (متل gmt-back.js).
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTListTools || !g.document) return;
  var doc = g.document;
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  }
  function isTable(t) { return t && t.tagName === 'TABLE'; }
  function rowsOf(t) {
    if (isTable(t)) { var b = t.tBodies && t.tBodies[0]; return [].slice.call((b || t).rows || []).filter(function (r) { return !r.closest('thead') && !r.querySelector('th'); }); }
    return [].slice.call(t.children || []).filter(function (c) { return !c.hasAttribute('data-gmt-tools') && !c.hasAttribute('data-gmt-norow'); });
  }
  function headOf(t) {
    if (!isTable(t)) return null;
    var h = t.tHead && t.tHead.rows[0]; if (!h) { var f = t.rows[0]; if (f && f.querySelector('th')) h = f; }
    return h ? [].map.call(h.cells, function (c) { return c.innerText.trim(); }) : null;
  }
  function cellsOf(r) {
    if (r.tagName === 'TR') return [].map.call(r.cells, function (c) { return c.innerText.replace(/\s+/g, ' ').trim(); });
    return String(r.innerText || '').split(/\n+/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  function titleOf(t) {
    var host = t.closest('[data-gmt-title]'); if (host) return host.getAttribute('data-gmt-title');
    var m = t.closest('[data-gmt-modal]') || doc.body;
    var h = m.querySelector('h1,h2,h3,h4,[data-gmt-head]'); return h ? h.innerText.replace(/\s+/g, ' ').trim().slice(0, 80) : (doc.title || 'GMT');
  }
  function visible(r) { return r.style.display !== 'none'; }
  function csv(t) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var out = [], h = headOf(t); if (h) out.push(h.map(q).join(','));
    rowsOf(t).filter(visible).forEach(function (r) { out.push(cellsOf(r).map(q).join(',')); });
    return '﻿' + out.join('\r\n');
  }
  function download(t) {
    var name = titleOf(t).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'GMT';
    var a = doc.createElement('a'), u = URL.createObjectURL(new Blob([csv(t)], { type: 'text/csv;charset=utf-8' }));
    a.href = u; a.download = name + ' ' + new Date().toISOString().slice(0, 10) + '.csv'; doc.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }
  function printHtml(t) {
    var c = t.cloneNode(true);
    [].forEach.call(c.querySelectorAll('button,input,select,textarea,[data-gmt-tools],script'), function (x) { x.remove(); });
    [].forEach.call(c.querySelectorAll('*'), function (x) { if (x.style && x.style.display === 'none') x.remove(); });
    if (!isTable(t)) [].forEach.call(c.children, function (x) { x.style.breakInside = 'avoid'; x.style.borderBottom = '1px solid #ddd'; x.style.padding = '6px 0'; });
    return '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>' + titleOf(t).replace(/</g, '&lt;') + '</title>' +
      '<style>body{font-family:Cairo,Tahoma,sans-serif;direction:rtl;color:#111;margin:18px}h1{font-size:18px;margin:0 0 4px}.d{color:#666;font-size:12px;margin-bottom:12px}' +
      'table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:5px 7px;text-align:right}th{background:#f3f4f6}</style></head><body>' +
      '<h1>' + titleOf(t).replace(/</g, '&lt;') + '</h1><div class="d">' + new Date().toLocaleString('ar') + '</div>' + c.outerHTML + '</body></html>';
  }
  function print(t) {
    var f = doc.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px'; doc.body.appendChild(f);
    var d = f.contentDocument; d.open(); d.write(printHtml(t)); d.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) {} setTimeout(function () { f.remove(); }, 4000); }, 250);
  }
  function filter(t, q) {
    var n = norm(q), shown = 0, rs = rowsOf(t);
    rs.forEach(function (r) { var ok = !n || norm(r.innerText).indexOf(n) >= 0; r.style.display = ok ? '' : 'none'; if (ok) shown++; });
    var bar = t.__gmtBar; if (bar) { var c = bar.querySelector('[data-glt-count]'); if (c) c.textContent = n ? shown + ' من ' + rs.length : ''; }
    return shown;
  }
  var BTN = 'border:1px solid #d9dee7;background:#fff;color:#0f1219;border-radius:9px;padding:5px 9px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap';
  function enhance(t) {
    if (!t || t.__gmtBar || t.hasAttribute('data-gmt-notools') || t.closest('[data-gmt-notools]')) return;
    var rs = rowsOf(t); if (rs.length < 3) return;
    var bar = doc.createElement('div'); bar.setAttribute('data-gmt-tools', ''); bar.setAttribute('data-gmt-norow', '');
    bar.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0;direction:rtl';
    var ns = t.hasAttribute('data-gmt-nosearch'), np = t.hasAttribute('data-gmt-noprint'), nc = t.hasAttribute('data-gmt-nocsv');
    if (np && nc && (ns || rs.length < 6)) return;
    bar.innerHTML = (rs.length >= 6 && !ns ? '<input type="search" data-glt-q placeholder="🔎 بحث بالقائمة…" style="flex:1;min-width:140px;border:1.5px solid #d9dee7;border-radius:9px;padding:6px 10px;font:inherit;font-size:13px">' : '<span style="flex:1"></span>') +
      '<span data-glt-count style="font-size:11px;color:#6b7280;font-weight:700"></span>' +
      (np ? '' : '<button type="button" data-glt-print title="طباعة القائمة" style="' + BTN + '">🖨️ طباعة</button>') +
      (nc ? '' : '<button type="button" data-glt-csv title="تنزيل ملف إكسل (CSV)" style="' + BTN + '">⬇️ إكسل</button>');
    t.parentNode.insertBefore(bar, t); t.__gmtBar = bar;
    var inp = bar.querySelector('[data-glt-q]'), key = titleOf(t);
    if (inp) { inp.addEventListener('input', function () { last[key] = inp.value; filter(t, inp.value); }); if (last[key]) { inp.value = last[key]; filter(t, inp.value); } }
    var pb = bar.querySelector('[data-glt-print]'); if (pb) pb.addEventListener('click', function () { print(t); });
    var cb = bar.querySelector('[data-glt-csv]'); if (cb) cb.addEventListener('click', function () { download(t); });
  }
  var last = {};
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    [].forEach.call(root.querySelectorAll('table,[data-gmt-list]'), function (t) { if (t.closest('[data-gmt-modal]') || t.hasAttribute('data-gmt-list')) enhance(t); });
  }
  var pend = false;
  function boot() {
    if (!doc.body) return setTimeout(boot, 50);
    new MutationObserver(function () {
      if (pend) return; pend = true;
      setTimeout(function () { pend = false; [].forEach.call(doc.querySelectorAll('[data-gmt-modal]'), scan); [].forEach.call(doc.querySelectorAll('[data-gmt-list]'), enhance); }, 120);
    }).observe(doc.body, { childList: true, subtree: true });
    [].forEach.call(doc.querySelectorAll('[data-gmt-modal]'), scan);
  }
  boot();
  g.GMTListTools = { enhance: enhance, csv: csv, printHtml: printHtml, filter: filter, norm: norm, rowsOf: rowsOf };
})(typeof window !== 'undefined' ? window : globalThis);
