/* ═════════════════════════════════════════════════════════════════
   gmt-custpick.js — اقتراح أسماء العملاء من السجلّ في **كلّ** حقل اسم زبون (TASK-A0531)
   طلب المالك seq 874: «هون لازم يقترح أسامي العملاء، وأيضاً بكلّ مكان لازم نكتب فيه اسم العميل لازم يطلع لي من السجلّ».
   كان لكلّ صفحةٍ اقتراحها الخاصّ (حقل «أوردر جديد» فقط) ⇒ الكوبون وتعديل الأوردر والحجوزات وفاتورة الإدارة ونقطة البيع وعرض السعر بلا اقتراح.
   الاستعمال: <input data-cust-pick data-cust-phone="id حقل الهاتف" data-cust-addr="id حقل العنوان"> — يُربط وحده عند التحميل،
   أو GMTCustPick.attach(input, { phone, addr, onPick }).
   المصدر: سجلّ الزبائن (gmt_customers) بالاسم أو الهاتف ⇐ وإن انقطع الإنترنت ذاكرة GMTCustCache المحلية. المحظور لا يُقترح.
   لا يُستعمل في صفحات الزبائن العامّة (المتجر · التتبّع): الزبون لا يرى أسماء غيره.
   ═════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTCustPick) return;
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function headers() {
    var M = g.GMT_DB && g.GMT_DB.MAIN; if (!M) return null;
    return g.GMT_DB.headers ? g.GMT_DB.headers(M) : { apikey: M.key, Authorization: 'Bearer ' + M.key };
  }
  async function query(q) {
    q = String(q || '').trim(); if (q.length < 2) return { rows: [], offline: false };
    var M = g.GMT_DB && g.GMT_DB.MAIN, rows = [], offline = false;
    try {
      if (!M) throw new Error('no db');
      var enc = encodeURIComponent('*' + q.replace(/[(),*]/g, ' ').trim() + '*');
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, 6000) : null;
      var r = await fetch(M.url + '/rest/v1/gmt_customers?or=(name.ilike.' + enc + ',phone.ilike.' + enc + ')&select=name,phone,address,is_blocked&order=updated_at.desc.nullslast&limit=10',
        { headers: headers(), signal: ctl ? ctl.signal : undefined });
      if (tm) clearTimeout(tm);
      if (!r.ok) throw new Error('http ' + r.status);
      rows = await r.json();
      try { if (g.GMTCustCache && Array.isArray(rows)) g.GMTCustCache.remember(rows); } catch (_) {}
    } catch (_) {
      offline = true;
      try { if (g.GMTCustCache) rows = await g.GMTCustCache.search(q, 10); } catch (_) { rows = []; }
    }
    var seen = {}, out = [];
    (rows || []).forEach(function (c) {
      if (!c || !c.name || c.is_blocked) return;
      var k = String(c.phone || '').replace(/\D/g, '').slice(-9) || String(c.name).trim();
      if (seen[k]) return; seen[k] = 1; out.push(c);
    });
    return { rows: out.slice(0, 8), offline: offline };
  }

  var box = null, cur = null;
  function ensureBox() {
    if (box) return box;
    box = document.createElement('div');
    box.setAttribute('data-custpick-box', '');
    box.style.cssText = 'position:fixed;z-index:2147480000;background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.16);max-height:260px;overflow:auto;display:none;direction:rtl;font-family:Cairo,Tahoma,sans-serif';
    box.addEventListener('mousedown', function (e) { e.preventDefault(); });   // لا يفقد الحقل تركيزه قبل الاختيار
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b && cur) pick(cur, +b.getAttribute('data-i')); });
    document.body.appendChild(box);
    var place = function () { if (cur && box.style.display !== 'none') position(cur.inp); };
    g.addEventListener('scroll', place, true); g.addEventListener('resize', place);
    return box;
  }
  function position(inp) {
    var r = inp.getBoundingClientRect();
    box.style.top = Math.round(r.bottom + 4) + 'px'; box.style.left = Math.round(r.left) + 'px'; box.style.width = Math.max(220, Math.round(r.width)) + 'px';
  }
  function hide() { if (box) { box.style.display = 'none'; box.innerHTML = ''; } if (cur) cur.sel = -1; }
  function show(st, res) {
    ensureBox(); st.rows = res.rows; st.sel = -1;
    if (!res.rows.length) { hide(); return; }
    box.innerHTML = (res.offline ? '<div style="padding:5px 10px;font-size:10px;font-weight:900;color:#b45309;background:#fffbeb;border-bottom:1px solid #fde68a">📴 لا اتصال — من الذاكرة المحلية</div>' : '') +
      res.rows.map(function (c, i) {
        return '<button type="button" data-i="' + i + '" style="display:flex;flex-direction:column;gap:1px;width:100%;text-align:right;padding:8px 11px;border:0;border-bottom:1px solid #f3f4f6;background:#fff;cursor:pointer;font-family:inherit">' +
          '<span style="font-size:13.5px;font-weight:900;color:#111">' + esc(c.name) + '</span>' +
          '<span style="font-size:11px;font-weight:700;color:#6b7280" dir="auto">' + esc(c.phone || '') + (c.address ? ' · ' + esc(c.address) : '') + '</span></button>';
      }).join('');
    position(st.inp); box.style.display = 'block'; cur = st;
  }
  function fire(el) { try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {} }
  function pick(st, i) {
    var c = st.rows && st.rows[i]; if (!c) return;
    st.inp.value = c.name; fire(st.inp);
    if (st.phone && c.phone && !st.phone.value.trim()) { st.phone.value = c.phone; fire(st.phone); }
    if (st.addr && c.address && !st.addr.value.trim()) { st.addr.value = c.address; fire(st.addr); }
    hide();
    try { if (st.onPick) st.onPick(c); } catch (_) {}
  }
  function attach(inp, opt) {
    if (!inp || inp.__custPick) return; opt = opt || {};
    var st = { inp: inp, phone: opt.phone || null, addr: opt.addr || null, onPick: opt.onPick || null, rows: [], sel: -1, t: null, seq: 0 };
    inp.__custPick = st; inp.setAttribute('autocomplete', 'off');
    inp.addEventListener('input', function (e) {
      if (e.isTrusted === false && !inp.__typing) { /* تعبئةٌ برمجية (اختيار) ⇒ لا بحث */ }
      clearTimeout(st.t); var q = inp.value, my = ++st.seq;
      if (String(q).trim().length < 2) { hide(); return; }
      st.t = setTimeout(function () { query(q).then(function (res) { if (my === st.seq && document.activeElement === inp) show(st, res); }); }, 250);
    });
    inp.addEventListener('keydown', function (e) {
      if (!box || box.style.display === 'none' || cur !== st || !st.rows.length) return;
      var btns = box.querySelectorAll('[data-i]');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); st.sel = (st.sel + (e.key === 'ArrowDown' ? 1 : -1) + st.rows.length) % st.rows.length;
        btns.forEach(function (b, i) { b.style.background = i === st.sel ? '#fef2f2' : '#fff'; });
      } else if (e.key === 'Enter' && st.sel >= 0) { e.preventDefault(); pick(st, st.sel); }
      else if (e.key === 'Escape') hide();
    });
    inp.addEventListener('blur', function () { setTimeout(function () { if (cur === st) hide(); }, 160); });
  }
  function auto(root) {
    (root || document).querySelectorAll('input[data-cust-pick]').forEach(function (i) {
      var p = i.getAttribute('data-cust-phone'), a = i.getAttribute('data-cust-addr');
      attach(i, { phone: p ? document.getElementById(p) : null, addr: a ? document.getElementById(a) : null });
    });
  }
  /* الحقول الثابتة عند التحميل · والنوافذ التي تُبنى لاحقاً (مثل كوبون الإدارة) عبر مراقبة الصفحة */
  function boot() {
    auto();
    var pend = false;   /* مرّةً لكلّ إطار مهما كثرت التغييرات (صفحة الأوردرات تعيد الرسم كثيراً) */
    try { new MutationObserver(function () { if (pend) return; pend = true; (g.requestAnimationFrame || setTimeout)(function () { pend = false; auto(); }); }).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  g.GMTCustPick = { attach: attach, auto: auto, query: query };
})(window);
