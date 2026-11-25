/* ═════════════════════════════════════════════════════════════════════
   gmt-suppliers.js — الموردون (P3 · A1004 §6 · الخطّة 1.5 · طابور Q1 · seq B1078)
   قبل: المورّد نصٌّ حرّ على كلّ فاتورة (import_log.supplier) — بلا ملفّ ولا كشف حساب، والاسم الواحد بأكثر من كتابة.
   الآن: جدول gmt_suppliers (اسم + أسماء بديلة + بيانات) · import_log.supplier_id (اختياري) · ملفّ مورّد بفواتيره ودفعاته · كشف حساب.
   القواعد: لا اختراع بيانات — البيانات من فواتيره أو مما تكتبه أنت · الربط بالأسماء القديمة **بضغطتك** (لا تلقائي) · لا حذف.

   GMTSuppliers.groups(ships, sups) ⇒ [{ key, name, sup, names[], invs[], value, paid, remaining, last, phone, address }]   (صافٍ)
   GMTSuppliers.statement(group, payOf) ⇒ { rows:[{at, kind, ref, debit, credit, balance}], balance }   (صافٍ)
   GMTSuppliers.open(ships, { onOpenInv(id, kind), onPay(id), onChange() })   — نافذة «🏭 الموردون»
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTSuppliers) return;
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function arr(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return []; } } return Array.isArray(v) ? v : []; }
  /* مفتاح الاسم: بلا «شركة/Co., Ltd/Trading…» وبلا رموز — لاقتراح الأسماء المتشابهة فقط (الربط بيدك) */
  function key(s) {
    return String(s || '').toLowerCase().replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/\(.*?\)/g, ' ').replace(/\b(co|ltd|limited|inc|llc|trading|company|corp|store|shop)\b\.?/g, ' ').replace(/(^|\s)(شركه|شركة|صاله|صالة|مؤسسه|مؤسسة|محل)(\s|$)/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function sumOf(p, pays) {
    if (g.GMTPoPay && GMTPoPay.summary) return GMTPoPay.summary(p, pays || []);
    var v = Number(p.total_amount) || 0, c = p.cash_payment == null || p.cash_payment === '' ? v : Number(p.cash_payment) || 0;
    return { value: v, paid: c, remaining: Math.max(0, v - c) };
  }
  function groups(ships, sups, payOf) {
    sups = sups || []; var byId = {}, byName = {};
    sups.forEach(function (s) { byId[s.id] = s; [s.name].concat(s.aliases || []).forEach(function (n) { if (n) byName[String(n).trim().toLowerCase()] = s; }); });
    var G = {};
    (ships || []).forEach(function (p) {
      if (!p || /cancel/i.test(p.status || '')) return;
      var nm = String(p.supplier || '').trim(), sup = (p.supplier_id && byId[p.supplier_id]) || byName[nm.toLowerCase()] || null;
      var k = sup ? 'S:' + sup.id : 'N:' + (nm || '—');
      var x = G[k] || (G[k] = { key: k, name: sup ? sup.name : (nm || 'بلا مورّد'), sup: sup, names: [], invs: [], value: 0, paid: 0, remaining: 0, last: '', phone: '', address: '' });
      if (nm && x.names.indexOf(nm) < 0) x.names.push(nm);
      var s = sumOf(p, payOf ? payOf(p.id) : []);
      x.invs.push(p); x.value = r2(x.value + s.value); x.paid = r2(x.paid + s.paid); x.remaining = r2(x.remaining + s.remaining);
      var d = String(p.inv_date || p.created_at || '').slice(0, 10); if (d > x.last) x.last = d;
      if (!x.phone && p.supplier_phone) x.phone = p.supplier_phone; if (!x.address && p.supplier_address) x.address = p.supplier_address;
    });
    sups.forEach(function (s) { if (!G['S:' + s.id]) G['S:' + s.id] = { key: 'S:' + s.id, name: s.name, sup: s, names: [], invs: [], value: 0, paid: 0, remaining: 0, last: '', phone: '', address: '' }; });
    return Object.keys(G).map(function (k) { return G[k]; }).sort(function (a, b) { return b.value - a.value; });
  }
  /* أسماء غير مسجّلة تشبه مورّداً مسجّلاً (أو بعضها) — اقتراح للربط بضغطتك */
  function similar(list) {
    var out = [];
    list.forEach(function (a, i) { list.slice(i + 1).forEach(function (b) {
      var ka = key(a.name), kb = key(b.name); if (!ka || !kb) return;
      if (ka === kb || (ka.length >= 4 && kb.indexOf(ka) >= 0) || (kb.length >= 4 && ka.indexOf(kb) >= 0)) out.push([a, b]);
    }); });
    return out;
  }
  function statement(grp, payOf) {
    var rows = [];
    (grp.invs || []).forEach(function (p) {
      var s = sumOf(p, payOf ? payOf(p.id) : []), at = String(p.inv_date || p.created_at || '').slice(0, 10);
      rows.push({ at: at, kind: 'inv', ref: p.inv_number || '#' + p.id, text: 'فاتورة شراء' + (p.inv_type === 'instant' ? ' فورية' : ''), debit: s.value, credit: 0, id: p.id });
      var pays = (payOf ? payOf(p.id) : []).filter(function (x) { return x && !x.voided; });
      if (pays.length) pays.forEach(function (x) { rows.push({ at: String(x.paid_at || x.created_at || at).slice(0, 10), kind: 'pay', ref: p.inv_number || '', text: 'دفعة' + (x.ref_no ? ' · إيصال ' + x.ref_no : '') + (String(x.currency || 'USD').toUpperCase() !== 'USD' ? ' · ' + x.amount + ' ' + x.currency : ''), debit: 0, credit: r2(x.usd), id: p.id }); });
      else if (s.paid > 0.004) rows.push({ at: at, kind: 'pay', ref: p.inv_number || '', text: 'مدفوع (مسجّل على الفاتورة)', debit: 0, credit: s.paid, id: p.id });
    });
    rows.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : (a.kind === 'inv' ? -1 : 1); });
    var bal = 0; rows.forEach(function (r) { bal = r2(bal + r.debit - r.credit); r.balance = bal; });
    return { rows: rows, balance: bal };
  }

  /* ── القاعدة ── */
  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (M && M.url) return M; throw new Error('إعدادات القاعدة غير محمّلة'); }
  async function req(method, path, body, prefer) {
    var M = db(), h = { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
    var r = await fetch(M.url + '/rest/v1/' + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : '')); }
    var s = await r.text(); return s ? JSON.parse(s) : null;
  }
  function who() { try { return (g.GMTRole && GMTRole.name && GMTRole.name()) || ''; } catch (_) { return ''; } }
  var SUPS = [];
  async function load() { SUPS = (await req('GET', 'gmt_suppliers?select=*&order=name.asc&limit=1000').catch(function () { return null; })) || SUPS; return SUPS; }
  async function register(grp) {
    var row = { name: grp.name, aliases: [], phone: grp.phone || null, address: grp.address || null, created_by: who() || null };
    var out = await req('POST', 'gmt_suppliers', row, 'return=representation');
    var sup = out && out[0]; if (!sup) throw new Error('ما انحفظ');
    for (var i = 0; i < grp.invs.length; i++) await req('PATCH', 'import_log?id=eq.' + encodeURIComponent(grp.invs[i].id), { supplier_id: sup.id }, 'return=minimal');
    try { g.GMTAudit && GMTAudit.log({ action: 'supplier_add', entity: 'gmt_suppliers', entityId: sup.id, entityName: sup.name }); } catch (_) {}
    return sup;
  }
  /* ضمّ اسم قديم لمورّد مسجّل: الاسم يصير «اسماً بديلاً» وفواتيره تُربط بالمعرّف — النصّ القديم على الفاتورة يبقى كما هو */
  async function link(sup, grp) {
    var al = (sup.aliases || []).slice(); grp.names.forEach(function (n) { if (n !== sup.name && al.indexOf(n) < 0) al.push(n); });
    await req('PATCH', 'gmt_suppliers?id=eq.' + encodeURIComponent(sup.id), { aliases: al, updated_at: new Date().toISOString() }, 'return=minimal');
    for (var i = 0; i < grp.invs.length; i++) await req('PATCH', 'import_log?id=eq.' + encodeURIComponent(grp.invs[i].id), { supplier_id: sup.id }, 'return=minimal');
    try { g.GMTAudit && GMTAudit.log({ action: 'supplier_link', entity: 'gmt_suppliers', entityId: sup.id, entityName: sup.name, newValue: grp.names.join(' · ') }); } catch (_) {}
  }
  async function saveInfo(sup, v) {
    var patch = {}; ['legal_name', 'country', 'city', 'address', 'phone', 'email', 'web', 'contact', 'currencies', 'pay_terms', 'incoterms', 'notes'].forEach(function (k) { if (v[k] !== undefined) patch[k] = String(v[k] || '').trim() || null; });
    if (v.lead_days !== undefined) patch.lead_days = v.lead_days === '' || v.lead_days == null ? null : Number(v.lead_days);
    patch.updated_at = new Date().toISOString();
    await req('PATCH', 'gmt_suppliers?id=eq.' + encodeURIComponent(sup.id), patch, 'return=minimal');
  }

  /* ── الواجهة ── */
  var FIELDS = [['legal_name', 'الاسم القانوني'], ['country', 'البلد'], ['city', 'المدينة'], ['address', 'العنوان'], ['phone', 'الهاتف'], ['email', 'الإيميل'], ['web', 'الموقع'], ['contact', 'الشخص المسؤول'], ['currencies', 'عملات التعامل'], ['pay_terms', 'شروط الدفع'], ['incoterms', 'شروط التسليم (Incoterms)'], ['lead_days', 'مدّة التوريد (أيام)'], ['notes', 'ملاحظات']];
  async function open(ships, o) {
    o = o || {};
    var payOf = g.GMTPoPay ? GMTPoPay.of : null;
    try { if (g.GMTPoPay && GMTPoPay.loadAll) await GMTPoPay.loadAll(); } catch (_) {}
    await load();
    var old = document.getElementById('gmt-suppliers'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'gmt-suppliers';
    w.style.cssText = 'position:fixed;inset:0;z-index:9640;background:rgba(15,18,25,.5);display:flex;align-items:flex-start;justify-content:center;padding:3vh 10px;overflow:auto;direction:rtl;font-family:inherit';
    document.body.appendChild(w);
    var cur = null;
    function list() {
      var G = groups(ships(), SUPS, payOf), sim = similar(G);
      w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:860px;padding:14px">' +
        '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:16px">🏭 الموردون (' + G.length + ')</b><button type="button" data-sp-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
        '<div style="font-size:12px;color:#64748b;margin:4px 0 8px">المسجّل ⭐ له ملفّ · غير المسجّل اسمٌ مكتوب على فواتيره — سجّله بضغطة (البيانات من فواتيره بس، ولا شي مخترع).</div>' +
        (sim.length ? '<div data-sp-sim style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:8px 10px;margin-bottom:8px;font-size:12.5px;font-weight:700">🔗 أسماء متشابهة — يمكن نفس المورّد؟ ' + sim.map(function (pr) { return '<div style="margin-top:4px">«' + esc(pr[0].name) + '» و«' + esc(pr[1].name) + '» — بتضمّهم من ملفّ المورّد (زرّ «ضمّ اسم»)</div>'; }).join('') + '</div>' : '') +
        G.map(function (x) {
          return '<div data-sp-key="' + esc(x.key) + '" style="border:1px solid #e5e7eb;border-radius:12px;padding:9px 11px;margin-top:6px;cursor:pointer;font-size:12.5px;font-weight:700">' +
            '<b style="font-size:13.5px">' + (x.sup ? '⭐ ' : '') + esc(x.name) + '</b>' + (x.names.length > 1 || (x.sup && x.names.some(function (n) { return n !== x.sup.name; })) ? ' <span style="color:#64748b">(' + esc(x.names.join(' · ')) + ')</span>' : '') +
            '<div style="color:#475569">' + x.invs.length + ' فاتورة · مشتريات ' + x.value.toFixed(2) + '$ · مدفوع ' + x.paid.toFixed(2) + '$ · ' + (x.remaining > 0.005 ? '<b style="color:#b91c1c">باقي ' + x.remaining.toFixed(2) + '$</b>' : '✅ ما في باقي') + (x.last ? ' · آخر شراء ' + esc(x.last) : '') + '</div></div>';
        }).join('') + '</div>';
    }
    function profile(x) {
      cur = x; var st = statement(x, payOf), s = x.sup || {};
      w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:860px;padding:14px">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button type="button" data-sp-back style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">→ الموردون</button><b style="flex:1;font-size:16px">' + (x.sup ? '⭐ ' : '') + esc(x.name) + '</b>' +
        (x.sup ? '<button type="button" data-sp-edit style="border:0;background:#0f1219;color:#fff;border-radius:9px;padding:6px 11px;font:inherit;font-weight:800;cursor:pointer">✏️ البيانات</button><button type="button" data-sp-link style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:6px 11px;font:inherit;font-weight:800;cursor:pointer">🔗 ضمّ اسم</button>'
          : '<button type="button" data-sp-reg style="border:0;background:#0f1219;color:#fff;border-radius:9px;padding:6px 11px;font:inherit;font-weight:800;cursor:pointer">⭐ سجّله كمورّد</button>') +
        '<button type="button" data-sp-print style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:6px 11px;font:inherit;font-weight:800;cursor:pointer">🖨️ كشف الحساب</button><button type="button" data-sp-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">' + [['مشتريات', x.value], ['مدفوع', x.paid], ['باقي له', x.remaining]].map(function (c) { return '<div style="flex:1;min-width:110px;background:#f8fafc;border-radius:12px;padding:7px 10px"><div style="font-size:11px;color:#64748b;font-weight:800">' + c[0] + '</div><b dir="ltr" style="font-size:15px">' + c[1].toFixed(2) + '$</b></div>'; }).join('') + '</div>' +
        (x.sup ? '<div style="font-size:12.5px;line-height:1.9;margin-bottom:8px">' + FIELDS.filter(function (f) { return s[f[0]]; }).map(function (f) { return '<b>' + f[1] + ':</b> ' + esc(s[f[0]]); }).join(' · ') + ((s.aliases || []).length ? ' · <b>أسماء بديلة:</b> ' + esc(s.aliases.join(' · ')) : '') + '</div>'
          : '<div style="font-size:12.5px;color:#475569;margin-bottom:8px">' + (x.phone ? '☎ ' + esc(x.phone) + ' · ' : '') + (x.address ? esc(x.address) : '') + '</div>') +
        '<b style="font-size:13.5px">📒 كشف الحساب</b><div data-sp-st style="margin-top:6px">' + (st.rows.length ? '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:5px;text-align:right">التاريخ</th><th style="text-align:right">البيان</th><th style="text-align:right">المرجع</th><th>عليه</th><th>دفعنا</th><th>الرصيد</th></tr>' +
          st.rows.map(function (r) { return '<tr data-sp-inv="' + esc(r.id) + '" style="border-bottom:1px solid #f1f5f9;cursor:pointer"><td style="padding:5px">' + esc(r.at) + '</td><td>' + esc(r.text) + '</td><td dir="ltr">' + esc(r.ref) + '</td><td style="text-align:center">' + (r.debit ? r.debit.toFixed(2) : '') + '</td><td style="text-align:center;color:#047857">' + (r.credit ? r.credit.toFixed(2) : '') + '</td><td style="text-align:center;font-weight:900">' + r.balance.toFixed(2) + '</td></tr>'; }).join('') +
          '</table><div style="text-align:left;font-weight:900;margin-top:6px">الرصيد له: ' + st.balance.toFixed(2) + '$</div>' : '<div style="color:#64748b">ما في فواتير.</div>') + '</div></div>';
    }
    function printSt(x) {
      var st = statement(x, payOf), ww = window.open('', '_blank'); if (!ww) return;
      ww.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب ' + esc(x.name) + '</title><style>body{font-family:Tahoma,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #ddd;padding:5px}</style></head><body><h2>كشف حساب المورّد: ' + esc(x.name) + '</h2><p>' + new Date().toLocaleDateString('ar-SY') + ' · مشتريات ' + x.value.toFixed(2) + '$ · مدفوع ' + x.paid.toFixed(2) + '$ · الباقي ' + st.balance.toFixed(2) + '$</p><table><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>عليه</th><th>دفعنا</th><th>الرصيد</th></tr>' +
        st.rows.map(function (r) { return '<tr><td>' + esc(r.at) + '</td><td>' + esc(r.text) + '</td><td dir="ltr">' + esc(r.ref) + '</td><td>' + (r.debit ? r.debit.toFixed(2) : '') + '</td><td>' + (r.credit ? r.credit.toFixed(2) : '') + '</td><td><b>' + r.balance.toFixed(2) + '</b></td></tr>'; }).join('') + '</table><script>print()<\/script></body></html>');
      ww.document.close();
    }
    async function refresh(keyWant) { await load(); var G = groups(ships(), SUPS, payOf), x = G.find(function (y) { return y.key === keyWant; }); if (x) profile(x); else list(); if (o.onChange) o.onChange(); }
    w.addEventListener('click', async function (e) {
      try {
        if (e.target === w || e.target.closest('[data-sp-x]')) { w.remove(); return; }
        if (e.target.closest('[data-sp-back]')) { list(); return; }
        var k = e.target.closest('[data-sp-key]'); if (k) { var G = groups(ships(), SUPS, payOf), x = G.find(function (y) { return y.key === k.getAttribute('data-sp-key'); }); if (x) profile(x); return; }
        if (!cur) return;
        if (e.target.closest('[data-sp-print]')) { printSt(cur); return; }
        var inv = e.target.closest('[data-sp-inv]'); if (inv && o.onOpenInv) { var p = cur.invs.find(function (y) { return String(y.id) === inv.getAttribute('data-sp-inv'); }); if (p) { w.remove(); o.onOpenInv(p.id, p.inv_type); } return; }
        if (e.target.closest('[data-sp-reg]')) { if (!(await GMTAsk.confirm('تسجيل «' + cur.name + '» كمورّد بملفّ؟ (' + cur.invs.length + ' فاتورة بتنربط فيه — النصّ على الفواتير بيضلّ متل ما هو)'))) return; var sp = await register(cur); await refresh('S:' + sp.id); return; }
        if (e.target.closest('[data-sp-edit]')) {
          var s = cur.sup, v = await GMTAsk.form('بيانات «' + s.name + '» — اكتب بس يلي بتعرفه (لا شي مخترع)', { title: '✏️ بيانات المورّد', okText: 'احفظ', fields: FIELDS.map(function (f) { return { k: f[0], label: f[1], value: s[f[0]] == null ? '' : s[f[0]], type: f[0] === 'lead_days' ? 'number' : undefined }; }) });
          if (!v) return; await saveInfo(s, v); await refresh(cur.key); return;
        }
        if (e.target.closest('[data-sp-link]')) {
          var others = groups(ships(), SUPS, payOf).filter(function (y) { return !y.sup && y.invs.length; });
          if (!others.length) { GMTAsk.alert('ما في أسماء غير مسجّلة للضمّ.'); return; }
          var v2 = await GMTAsk.form('اختر الاسم المكتوب على فواتير قديمة لنفس المورّد «' + cur.name + '» — بيصير اسماً بديلاً وفواتيره بتنربط فيه.', { title: '🔗 ضمّ اسم', okText: 'ضمّ', fields: [{ k: 'n', label: 'الاسم', options: others.map(function (y) { return { v: y.key, t: y.name + ' (' + y.invs.length + ' فاتورة)' }; }) }] });
          if (!v2) return; var grp = others.find(function (y) { return y.key === v2.n; }); if (!grp) return;
          await link(cur.sup, grp); await refresh(cur.key); return;
        }
      } catch (er) { if (g.GMTAsk) GMTAsk.alert('تعذّر: ' + (er && er.message || er), { title: 'الموردون' }); }
    });
    list();
    return w;
  }
  g.GMTSuppliers = { groups: groups, statement: statement, similar: similar, key: key, open: open, load: load, register: register, link: link };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTSuppliers;
})(typeof window !== 'undefined' ? window : globalThis);
