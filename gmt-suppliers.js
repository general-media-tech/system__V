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
      rows.push({ at: at, kind: 'inv', ref: p.inv_number || '#' + p.id, text: 'فاتورة شراء' + (p.inv_type === 'instant' ? ' فورية' : '') + (s.ship ? ' (بضاعة ' + r2(s.goods).toFixed(2) + ' + شحن ' + r2(s.ship).toFixed(2) + ')' : ''), debit: s.value, credit: 0, id: p.id });
      var pays = (payOf ? payOf(p.id) : []).filter(function (x) { return x && !x.voided; });
      if (pays.length) pays.forEach(function (x) { rows.push({ at: String(x.paid_at || x.created_at || at).slice(0, 10), kind: 'pay', ref: p.inv_number || '', text: (x.kind === 'opening' ? 'دفعة قديمة' : 'دفعة') + (x.ref_no ? ' · إيصال ' + x.ref_no : '') + (String(x.currency || 'USD').toUpperCase() !== 'USD' ? ' · ' + x.amount + ' ' + x.currency : ''), debit: 0, credit: r2(x.usd), id: p.id }); });
      else if (s.paid > 0.004) rows.push({ at: at, kind: 'pay', ref: p.inv_number || '', text: 'دفعة قديمة (مسجّلة على الفاتورة)', debit: 0, credit: s.paid, id: p.id });
    });
    rows.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : (a.kind === 'inv' ? -1 : 1); });
    var bal = 0; rows.forEach(function (r) { bal = r2(bal + r.debit - r.credit); r.balance = bal; });
    return { rows: rows, newest: rows.slice().reverse(), balance: bal };   /* (B1112) العرض: الأحدث فوق — الرصيد محسوب من الأقدم */
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
    w.setAttribute('data-gmt-modal', ''); document.body.appendChild(w);
    var cur = null;
    /* (B1115) زرّ الرجوع بالهاتف: بملفّ المورّد ⇐ القائمة · بالقائمة ⇐ بيسكّر النافذة (gmt-back.js) */
    w._gmtBack = function () { if (cur) { cur = null; list(); return true; } return false; };
    var q = '';
    var BTN = 'border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer';
    /* (seq B1112 «خلّيها مفهومة أكتر وأسهل») قائمة الموردين: بحث · اللي إلهم باقي فوق · مجموع اللي علينا */
    function list() {
      var G = groups(ships(), SUPS, payOf), sim = similar(G), qq = q.trim().toLowerCase();
      var F = G.filter(function (x) { return !qq || (x.name + ' ' + x.names.join(' ')).toLowerCase().indexOf(qq) >= 0; })
        .sort(function (a, b) { return (b.remaining > 0.005) - (a.remaining > 0.005) || b.remaining - a.remaining || String(b.last || '').localeCompare(String(a.last || '')); });
      var owe = G.reduce(function (t, x) { return t + (x.remaining > 0.005 ? x.remaining : 0); }, 0), nOwe = G.filter(function (x) { return x.remaining > 0.005; }).length;
      w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:760px;padding:14px">' +
        '<div style="display:flex;align-items:center;gap:8px"><button type="button" data-sp-x style="' + BTN + '">→ رجوع</button><b style="flex:1;font-size:17px;text-align:center">🏭 الموردون</b><span style="width:70px"></span></div>' +
        '<div style="display:flex;gap:6px;margin:10px 0"><div style="flex:1;background:' + (owe > 0.005 ? '#fef2f2' : '#f0fdf4') + ';border-radius:12px;padding:8px 12px"><div style="font-size:11.5px;color:#64748b;font-weight:800">الباقي علينا لكلّ الموردين</div><div style="font-size:19px;font-weight:900;color:' + (owe > 0.005 ? '#b91c1c' : '#15803d') + '" dir="ltr">' + owe.toFixed(2) + '$</div><div style="font-size:11px;color:#64748b">' + (nOwe ? nOwe + ' مورّد إلهم باقي' : 'كلّه مسدّد') + '</div></div></div>' +
        '<input data-sp-q value="' + esc(q) + '" placeholder="🔎 ابحث عن مورّد…" style="width:100%;box-sizing:border-box;border:1.5px solid #e5e7eb;border-radius:12px;padding:9px 12px;font:inherit;font-size:14px;margin-bottom:6px">' +
        (sim.length ? '<div data-sp-sim style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:8px 10px;margin-bottom:8px;font-size:12.5px;font-weight:700">🔗 أسماء متشابهة — يمكن نفس المورّد؟ ' + sim.map(function (pr) { return '<div style="margin-top:4px">«' + esc(pr[0].name) + '» و«' + esc(pr[1].name) + '»</div>'; }).join('') + '<div style="font-weight:600;color:#64748b;margin-top:4px">إذا نفسه: افتح واحد منهم ⇐ «🔗 ضمّ اسم»</div></div>' : '') +
        (F.length ? '<div data-gmt-list data-gmt-nosearch data-gmt-title="الموردين — الباقي علينا">' + F.map(function (x) {
          return '<div data-sp-key="' + esc(x.key) + '" style="border:1px solid #e5e7eb;border-radius:14px;padding:10px 12px;margin-top:6px;cursor:pointer;display:flex;gap:10px;align-items:center">' +
            '<div style="flex:1;min-width:0"><div style="font-weight:900;font-size:14.5px;overflow-wrap:anywhere">' + (x.sup ? '⭐ ' : '') + esc(x.name) + '</div>' +
            '<div style="font-size:12px;color:#64748b;margin-top:2px">' + x.invs.length + ' فاتورة' + (x.last ? ' · آخر شراء ' + esc(x.last) : '') + (x.names.length > 1 ? ' · كمان: ' + esc(x.names.filter(function (n) { return n !== x.name; }).join('، ')) : '') + '</div></div>' +
            '<div style="text-align:left;flex:none">' + (x.remaining > 0.005 ? '<div style="font-size:11px;color:#64748b">باقي علينا</div><div style="font-weight:900;color:#b91c1c;font-size:15px" dir="ltr">' + x.remaining.toFixed(2) + '$</div>' : '<div style="font-weight:900;color:#15803d">✅ مسدّد</div>') + '</div><span style="color:#94a3b8;font-size:18px">‹</span></div>';
        }).join('') + '</div>' : '<div style="color:#64748b;text-align:center;padding:14px">ما لقيت مورّد بهالاسم.</div>') +
        '<div style="font-size:11px;color:#94a3b8;margin-top:8px">⭐ = إله ملفّ (بيانات وأسماء بديلة) · الباقي محسوب من الفواتير ودفعاتها (فواتير الصين مع شحنها)</div></div>';
      var qi = w.querySelector('[data-sp-q]'); if (qi && list._focus) { qi.focus(); try { qi.setSelectionRange(q.length, q.length); } catch (_) {} }
    }
    /* ملفّ المورّد: الاسم لحاله · الأزرار تحته · كشف الحساب الأحدث فوق والقديم لتحت */
    function profile(x) {
      cur = x; var st = statement(x, payOf), s = x.sup || {};
      var info = x.sup ? FIELDS.filter(function (f) { return s[f[0]] && f[0] !== 'notes'; }).map(function (f) { return '<b>' + f[1] + ':</b> ' + esc(s[f[0]]); }) : [];
      if (x.sup && (s.aliases || []).length) info.push('<b>بيعرف كمان باسم:</b> ' + esc(s.aliases.join(' · ')));
      if (!x.sup && x.phone) info.push('☎ ' + esc(x.phone)); if (!x.sup && x.address) info.push(esc(x.address));
      w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:760px;padding:14px">' +
        '<div style="display:flex;align-items:center;gap:8px"><button type="button" data-sp-back style="' + BTN + '">→ رجوع</button><span style="flex:1"></span><button type="button" data-sp-x style="' + BTN + '">✕</button></div>' +
        '<div style="font-weight:900;font-size:18px;margin:10px 0 6px;overflow-wrap:anywhere">' + (x.sup ? '⭐ ' : '') + esc(x.name) + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><button type="button" data-sp-print style="' + BTN + '">🖨️ اطبع كشف الحساب</button>' +
        (x.sup ? '<button type="button" data-sp-edit style="' + BTN + '">✏️ بياناته</button><button type="button" data-sp-link style="' + BTN + '">🔗 ضمّ اسم تاني إله</button>'
          : '<button type="button" data-sp-reg style="border:0;background:#0f1219;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">⭐ اعمله ملفّ</button>') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + [['اشترينا', x.value, '#0f1219'], ['دفعنا', x.paid, '#15803d'], ['الباقي علينا', x.remaining, x.remaining > 0.005 ? '#b91c1c' : '#15803d']].map(function (c) { return '<div style="flex:1;min-width:100px;background:#f8fafc;border-radius:12px;padding:8px 10px"><div style="font-size:11.5px;color:#64748b;font-weight:800">' + c[0] + '</div><div style="font-weight:900;font-size:16px;color:' + c[2] + '" dir="ltr">' + c[1].toFixed(2) + '$</div></div>'; }).join('') + '</div>' +
        (info.length ? '<div style="font-size:12.5px;line-height:1.9;margin-bottom:10px;color:#334155">' + info.join(' · ') + '</div>' : '') +
        '<div style="display:flex;align-items:center;margin-bottom:6px"><b style="flex:1;font-size:14px">📒 كشف الحساب</b><span style="font-size:11px;color:#64748b">الأحدث فوق · اضغط على سطر لتفتح الفاتورة</span></div>' +
        (st.rows.length ? '<div data-sp-st data-gmt-list data-gmt-noprint style="border:1px solid #eef1f5;border-radius:12px;overflow:hidden">' + st.newest.map(function (r) {
          var inv = r.kind === 'inv';
          return '<div data-sp-inv="' + esc(r.id) + '" style="display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid #f1f5f9;cursor:pointer;background:' + (inv ? '#fff' : '#f7fdf9') + '">' +
            '<span style="font-size:18px;flex:none">' + (inv ? '🧾' : '💵') + '</span>' +
            '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:13px">' + esc(r.text) + '</div><div style="font-size:11px;color:#64748b"><span dir="ltr" style="white-space:nowrap">' + esc(r.at) + '</span> · <span dir="ltr" style="white-space:nowrap">' + esc(r.ref) + '</span></div></div>' +
            '<div style="text-align:left;flex:none"><div style="font-weight:900;font-size:13.5px;color:' + (inv ? '#b91c1c' : '#15803d') + '" dir="ltr">' + (inv ? '+' + r.debit.toFixed(2) : '−' + r.credit.toFixed(2)) + '$</div><div style="font-size:10.5px;color:#64748b">الباقي بعدها <b dir="ltr">' + r.balance.toFixed(2) + '$</b></div></div></div>';
        }).join('') + '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;background:' + (st.balance > 0.005 ? '#fef2f2' : '#f0fdf4') + ';border-radius:12px;padding:8px 12px"><b>الباقي علينا هلّق</b><b dir="ltr" style="font-size:16px;color:' + (st.balance > 0.005 ? '#b91c1c' : '#15803d') + '">' + st.balance.toFixed(2) + '$</b></div>'
          : '<div style="color:#64748b">ما في فواتير.</div>') + '</div>';
    }
    function printSt(x) {
      var st = statement(x, payOf), ww = window.open('', '_blank'); if (!ww) return;
      ww.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب ' + esc(x.name) + '</title><style>body{font-family:Tahoma,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #ddd;padding:5px}</style></head><body><h2>كشف حساب المورّد: ' + esc(x.name) + '</h2><p>' + new Date().toLocaleDateString('ar-SY') + ' · اشترينا ' + x.value.toFixed(2) + '$ · دفعنا ' + x.paid.toFixed(2) + '$ · الباقي علينا ' + st.balance.toFixed(2) + '$ · (الأحدث فوق)</p><table><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>فاتورة</th><th>دفعنا</th><th>الباقي بعدها</th></tr>' +
        st.newest.map(function (r) { return '<tr><td>' + esc(r.at) + '</td><td>' + esc(r.text) + '</td><td dir="ltr">' + esc(r.ref) + '</td><td>' + (r.debit ? r.debit.toFixed(2) : '') + '</td><td>' + (r.credit ? r.credit.toFixed(2) : '') + '</td><td><b>' + r.balance.toFixed(2) + '</b></td></tr>'; }).join('') + '</table><script>print()<\/script></body></html>');
      ww.document.close();
    }
    async function refresh(keyWant) { await load(); var G = groups(ships(), SUPS, payOf), x = G.find(function (y) { return y.key === keyWant; }); if (x) profile(x); else list(); if (o.onChange) o.onChange(); }
    w.addEventListener('input', function (e) { var t = e.target.closest('[data-sp-q]'); if (t) { q = t.value; list._focus = true; list(); list._focus = false; } });
    w.addEventListener('click', async function (e) {
      try {
        if (e.target === w || e.target.closest('[data-sp-x]')) { w.remove(); return; }
        if (e.target.closest('[data-sp-back]')) { cur = null; list(); return; }
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
  /* (seq B1097) الاسم الموحّد للمورّد: من supplier_id أو من أسمائه البديلة — «Shenzhen Shixin» و«وايمن شنزن» مورّد واحد
     بالمقارنات والتقارير (نصّ الفاتورة نفسه ما بيتغيّر) */
  function canon(inv) {
    inv = inv || {}; var nm = String(inv.supplier || '').replace(/\s+/g, ' ').trim();
    if (inv.supplier_id) { var a = SUPS.find(function (s) { return s.id === inv.supplier_id; }); if (a) return a.name; }
    var l = nm.toLowerCase(); if (!l) return nm;
    var b = SUPS.find(function (s) { return [s.name].concat(s.aliases || []).some(function (n) { return String(n || '').replace(/\s+/g, ' ').trim().toLowerCase() === l; }); });
    return b ? b.name : nm;
  }
  function loaded() { return SUPS.length > 0; }
  function _setSups(l) { SUPS = l || []; }
  g.GMTSuppliers = { groups: groups, statement: statement, similar: similar, key: key, open: open, load: load, register: register, link: link, canon: canon, loaded: loaded, _setSups: _setSups };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTSuppliers;
})(typeof window !== 'undefined' ? window : globalThis);
