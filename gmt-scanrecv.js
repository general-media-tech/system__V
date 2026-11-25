/* ═════════════════════════════════════════════════════════════════════
   gmt-scanrecv.js — الاستلام بالمسح (P4 · A1004 · الخطّة 1.6 · TASK-A0587 «جهاز إدارة المستودعات» · طابور Q1)
   «الموظّف يمسح كلّ قطعة ⇐ يظهر المنتج ⇐ عدد ⇐ مطابقة الفاتورة ⇐ صحّ/نقص/زيادة».
   لا مسار مخزون جديد: المسح يعبّي خانات «ينقل الآن» بنافذة «وصلت» نفسها ⇒ ✅ نفّذ الترحيل ⇒ executeArrival
   (الإدخال مرّة واحدة · دفتر stock_receipts · الختم فقط عند الوصول الكامل) — كما هو.

   GMTScanRecv.index(items) ⇒ فهرس الباركودات (يتسامح بصفر EAN/UPC البادئ وبالمسافات والحروف الكبيرة)
   GMTScanRecv.match(code, idx) ⇒ pid | null           (صافٍ · يُختبر بلا متصفّح)
   GMTScanRecv.summary(counts, need) ⇒ { scanned, need, ok, short:[pid], over:[pid] }
   GMTScanRecv.attach(ov, items, { remainOf(pid), extraBarcodes(pid) }) — شريط المسح فوق جدول «وصلت»
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTScanRecv) return;
  function normCode(c) { return String(c == null ? '' : c).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; }).replace(/\s+/g, '').toUpperCase(); }
  function variants(c) { c = normCode(c); if (!c) return []; var v = [c]; if (/^\d+$/.test(c)) { var t = c.replace(/^0+/, ''); if (t && t !== c) v.push(t); if (c.length === 12) v.push('0' + c); } return v; }
  function index(items, extra) {
    var idx = {};
    (items || []).forEach(function (it) {
      if (!it || it.id == null) return;
      var codes = [it.barcode].concat(extra ? (extra(String(it.id)) || []) : []).filter(Boolean);
      codes.forEach(function (c) { variants(c).forEach(function (v) { if (!idx[v]) idx[v] = String(it.id); }); });
    });
    return idx;
  }
  function match(code, idx) { var v = variants(code); for (var i = 0; i < v.length; i++) if (idx[v[i]]) return idx[v[i]]; return null; }
  function summary(counts, need) {
    var s = { scanned: 0, need: 0, ok: 0, short: [], over: [] };
    Object.keys(need).forEach(function (pid) {
      var n = Number(need[pid]) || 0, c = Number(counts[pid]) || 0; s.need += n; s.scanned += c;
      if (c === n) s.ok++; else if (c < n) s.short.push(pid); else s.over.push(pid);
    });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cue(n) { try { if (g.GMTSound && GMTSound.cue) GMTSound.cue(n); } catch (_) {} try { if (navigator.vibrate) navigator.vibrate(n === 'error' ? [60, 40, 60] : 25); } catch (_) {} }

  function attach(ov, items, o) {
    o = o || {};
    var body = ov.querySelector('#arr-body'); if (!body) return null;
    var host = document.createElement('div'); host.setAttribute('data-sr', '');
    host.style.cssText = 'border:1.5px dashed #0f1219;border-radius:14px;padding:10px 12px;margin-bottom:10px;background:#f8fafc';
    host.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" data-sr-start style="background:#0f1219;color:#fff;border:0;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:900;cursor:pointer">📷 استلام بالمسح — صفّر وامسح كلّ قطعة</button>' +
      '<span style="font-size:11.5px;color:#475569">أو اترك الكمّيات متل ما هي إذا وصل كلّ شي</span></div><div data-sr-box style="display:none;margin-top:8px">' +
      '<div style="display:flex;gap:6px"><input data-sr-in placeholder="امسح الباركود هون (السكانر بيكتب لحاله) أو اكتبه وEnter" autocomplete="off" style="flex:1;border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;direction:ltr;text-align:right">' +
      '<button type="button" data-sr-cam style="border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:0 12px;font:inherit;font-size:16px;cursor:pointer" title="كاميرا">📷</button><button type="button" data-sr-undo style="border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:0 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer" title="تراجع عن آخر مسحة">↶</button></div>' +
      '<div data-sr-last style="min-height:1.6em;margin-top:6px;font-size:13px;font-weight:900"></div><div data-sr-sum style="font-size:12.5px;font-weight:800;color:#334155"></div><div data-sr-unk style="font-size:12px;color:#b91c1c;font-weight:700;margin-top:4px"></div></div>';
    body.closest('.overflow-auto').parentNode.insertBefore(host, body.closest('.overflow-auto'));
    var idx = index(items, o.extraBarcodes), counts = {}, need = {}, names = {}, unknown = [], hist = [], on = false;
    items.forEach(function (it) { var pid = String(it.id), r = o.remainOf ? o.remainOf(pid) : (Number(it.qty) || 0); if (r > 0) { need[pid] = r; counts[pid] = 0; names[pid] = it.name || pid; } });
    function row(pid) { return body.querySelector('tr[data-pid="' + (g.CSS && CSS.escape ? CSS.escape(pid) : pid) + '"]'); }
    function paint() {
      Object.keys(need).forEach(function (pid) {
        var tr = row(pid); if (!tr) return; var inp = tr.querySelector('[data-mv]'), c = counts[pid], n = need[pid];
        if (inp) inp.value = Math.min(c, n);   /* الترحيل ما بيتجاوز المطلوب — الزيادة بتنذكر لتسوّيها */
        var b = tr.querySelector('[data-sr-badge]'); if (!b) { b = document.createElement('div'); b.setAttribute('data-sr-badge', ''); b.style.cssText = 'font-size:11px;font-weight:900;margin-top:2px'; tr.cells[0].appendChild(b); }
        b.textContent = (c === n ? '✅ ' : c > n ? '⚠️ زيادة · ' : '⏳ ') + c + '/' + n; b.style.color = c === n ? '#15803d' : c > n ? '#b45309' : '#64748b';
        tr.style.background = c === n ? '#f0fdf4' : c > n ? '#fffbeb' : '';
      });
      var s = summary(counts, need);
      host.querySelector('[data-sr-sum]').textContent = 'مسحت ' + s.scanned + ' من ' + s.need + ' قطعة · ✅ كامل ' + s.ok + ' صنف' + (s.short.length ? ' · ⏳ ناقص ' + s.short.length : '') + (s.over.length ? ' · ⚠️ زيادة ' + s.over.length : '') + (unknown.length ? ' · ❓ غير معروف ' + unknown.length : '');
      host.querySelector('[data-sr-unk]').textContent = unknown.length ? '❓ باركودات مو بالفاتورة: ' + unknown.slice(-8).join(' · ') : '';
    }
    function scan(code) {
      code = normCode(code); if (!code) return;
      var pid = match(code, idx), last = host.querySelector('[data-sr-last]');
      if (!pid) { unknown.push(code); hist.push({ u: code }); last.innerHTML = '<span style="color:#b91c1c">❓ ' + esc(code) + ' — مو بهالفاتورة</span>'; cue('error'); paint(); return; }
      if (need[pid] == null) { last.innerHTML = '<span style="color:#64748b">ℹ️ ' + esc(names[pid] || code) + ' — رُحّل كامل سابقاً</span>'; cue('error'); return; }
      counts[pid]++; hist.push({ p: pid });
      var over = counts[pid] > need[pid];
      last.innerHTML = (over ? '<span style="color:#b45309">⚠️ ' : '<span style="color:#15803d">✓ ') + esc(names[pid]) + ' — ' + counts[pid] + '/' + need[pid] + (over ? ' (زيادة)' : '') + '</span>';
      cue(over ? 'error' : 'scan'); paint();
    }
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-sr-start]')) {
        on = true; Object.keys(counts).forEach(function (k) { counts[k] = 0; }); unknown = []; hist = [];
        host.querySelector('[data-sr-box]').style.display = ''; paint(); host.querySelector('[data-sr-in]').focus(); return;
      }
      if (e.target.closest('[data-sr-undo]')) { var h = hist.pop(); if (h) { if (h.p) counts[h.p] = Math.max(0, counts[h.p] - 1); else unknown.pop(); paint(); } host.querySelector('[data-sr-in]').focus(); return; }
      if (e.target.closest('[data-sr-cam]')) { if (g.GMTScan && GMTScan.camera) GMTScan.camera(function (c) { scan(c); }, { title: 'امسح باركود القطعة', continuous: true }); else alert('الكاميرا غير متاحة بهالصفحة — استعمل السكانر'); }
    });
    host.querySelector('[data-sr-in]').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); scan(this.value); this.value = ''; }
    });
    /* «✅ نفّذ الترحيل» بالمسح وفيه نقص ⇒ تأكيد (الباقي بيضلّ مفتوح للترحيل لاحقاً — بلا تكرار) */
    var go = ov.querySelector('#arr-go');
    if (go) go.addEventListener('click', function (e) {
      if (!on) return; var s = summary(counts, need);
      if ((s.short.length || unknown.length) && !host.dataset.ack) {
        e.stopImmediatePropagation(); e.preventDefault();
        var msg = 'نتيجة المسح: ناقص ' + s.short.length + ' صنف' + (unknown.length ? ' · ' + unknown.length + ' باركود مو بالفاتورة' : '') + (s.over.length ? ' · زيادة ' + s.over.length : '') + '\nبيترحّل يلي انمسح بس، والباقي بيضلّ بالفاتورة مفتوح. متابعة؟';
        var ask = g.GMTAsk && GMTAsk.confirm ? GMTAsk.confirm(msg, { title: 'الاستلام بالمسح' }) : Promise.resolve(g.confirm(msg));
        ask.then(function (yes) { if (yes) { host.dataset.ack = '1'; go.click(); } });
      }
    }, true);
    return { scan: scan, counts: counts, need: need, unknown: unknown, summary: function () { return summary(counts, need); } };
  }
  g.GMTScanRecv = { index: index, match: match, summary: summary, attach: attach, normCode: normCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTScanRecv;
})(typeof window !== 'undefined' ? window : globalThis);
