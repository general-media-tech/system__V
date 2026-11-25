/* ═════════════════════════════════════════════════════════════════════
   gmt-poship.js — شحنات المشتريات N↔N (A1004 P6 م٢ · الخطّة 1.8 · طابور Q1 · seq B1095)
   «شحنة وحدة فيها عدّة فواتير · فاتورة ممكن تنقسم على شحنتين» — جدول gmt_po_shipments (invoice_ids[]).
   وصول الشحنة ≠ استلام البضاعة: الوصول بيفتح لكلّ فاتورة زرّ «📦 استلم» (الاستلام بالمسح كما هو) — ما في مسار مخزون جديد.
   لا حذف: الإلغاء بالحالة مع سبب.

   صافٍ (يُختبر):  nextRef(list, year) · stateOf(s, today) · forInvoice(list, id) · unshipped(invoices, list) · progress(s)
   واجهة:          loadAll() · of(id) · chipFor(id) · open(getInvoices, { onRecv(id), onOpenInv(id), focus })
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTPoShip) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var STATUS = { booked: ['📝 محجوزة', '#f1f5f9', '#334155'], transit: ['🚢 بالطريق', '#e0e7ff', '#1f348f'], customs: ['🛃 بالجمارك', '#fef3c7', '#92400e'], arrived: ['✅ وصلت', '#dcfce7', '#166534'], cancelled: ['✖ ملغاة', '#fee2e2', '#991b1b'], overdue: ['⏰ متأخّرة', '#fee2e2', '#b91c1c'] };
  var MODE = { sea: '🚢 بحري', air: '✈️ جوّي', land: '🚚 برّي', express: '📦 سريع (DHL…)' };
  var FLOW = ['booked', 'transit', 'customs', 'arrived'];
  function today() { return new Date().toISOString().slice(0, 10); }
  function ids(s) { return (s && s.invoice_ids || []).map(String); }

  function nextRef(list, year) {
    year = year || new Date().getFullYear(); var pre = 'SHP-' + year + '-', max = 0;
    (list || []).forEach(function (s) { var m = String(s.ref || '').indexOf(pre) === 0 ? parseInt(String(s.ref).slice(pre.length), 10) : 0; if (m > max) max = m; });
    return pre + String(max + 1).padStart(3, '0');
  }
  /* الحالة الظاهرة: متأخّرة إذا فات موعد الوصول وهي لسّا ما وصلت · days = كم يوم للوصول (سالب = تأخير) */
  function stateOf(s, t) {
    t = t || today(); var st = s.status || 'booked', days = null;
    if (s.eta) days = Math.round((new Date(s.eta + 'T00:00:00Z') - new Date(t + 'T00:00:00Z')) / 864e5);
    var k = (st !== 'arrived' && st !== 'cancelled' && days != null && days < 0) ? 'overdue' : st;
    return { k: k, status: st, days: days, label: STATUS[k][0] };
  }
  function progress(s) { var i = FLOW.indexOf(s.status); return i < 0 ? 0 : i / (FLOW.length - 1); }
  function forInvoice(list, id) { id = String(id); return (list || []).filter(function (s) { return s.status !== 'cancelled' && ids(s).indexOf(id) >= 0; }); }
  /* فواتير استيراد لسّا ما وصلت وما إلها شحنة فعّالة ⇒ «بلا شحنة» */
  function unshipped(invoices, list) {
    var used = {}; (list || []).forEach(function (s) { if (s.status !== 'cancelled') ids(s).forEach(function (i) { used[i] = 1; }); });
    return (invoices || []).filter(function (x) { return x && x.inv_type !== 'instant' && x.status !== 'arrived' && !/cancel/i.test(x.status || '') && !used[String(x.id)]; });
  }

  /* ── القاعدة ── */
  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (M && M.url) return M; if (g.SB && g.KEY) return { url: g.SB, key: g.KEY }; throw new Error('إعدادات القاعدة غير محمّلة'); }
  async function req(method, path, body, prefer) {
    var M = db(), h = { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
    var r = await fetch(M.url + '/rest/v1/' + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : '')); }
    var s = await r.text(); return s ? JSON.parse(s) : null;
  }
  function who() { try { return (g.GMTRole && GMTRole.name && GMTRole.name()) || localStorage.getItem('gmt_operator_name') || ''; } catch (_) { return ''; } }
  var LIST = [];
  async function loadAll() { var rows = await req('GET', 'gmt_po_shipments?select=*&order=created_at.desc&limit=1000').catch(function () { return null; }); if (rows) LIST = rows; return LIST; }
  function of(id) { return forInvoice(LIST, id); }
  async function save(v, id) {
    v.updated_at = new Date().toISOString();
    if (id) { var r = await req('PATCH', 'gmt_po_shipments?id=eq.' + encodeURIComponent(id), v, 'return=representation'); var k = LIST.findIndex(function (x) { return String(x.id) === String(id); }); if (r && r[0]) { if (k >= 0) LIST[k] = r[0]; else LIST.unshift(r[0]); } return r && r[0]; }
    /* الرقم فريد: إذا تصادم (جهازين بنفس اللحظة) ⇒ نعيد بالرقم التالي */
    if (!v.status) v.status = 'booked'; if (!v.mode) v.mode = 'sea'; if (!v.invoice_ids) v.invoice_ids = [];
    for (var tries = 0; tries < 3; tries++) {
      try { if (tries) await loadAll(); v.ref = nextRef(LIST); v.created_by = who() || null; var c = await req('POST', 'gmt_po_shipments', v, 'return=representation'); if (c && c[0]) LIST.unshift(c[0]); return c && c[0]; }
      catch (e) { if (!/23505|duplicate/i.test(e.message) || tries === 2) throw e; }
    }
  }
  function chipFor(id) {
    return of(id).map(function (s) { var x = stateOf(s), c = STATUS[x.k];
      return '<span data-poship-chip="' + esc(s.id) + '" title="' + esc((s.carrier || '') + (s.tracking ? ' · ' + s.tracking : '')) + '" style="display:inline-block;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:900;margin-inline-end:4px;background:' + c[1] + ';color:' + c[2] + '">' +
        esc(s.ref) + ' · ' + c[0] + (x.days != null && x.k !== 'arrived' && x.k !== 'cancelled' ? (x.days >= 0 ? ' · ' + x.days + ' يوم' : ' · ' + (-x.days) + ' يوم تأخير') : '') + '</span>'; }).join('');
  }
  function ask(msg, def) { return g.GMTAsk && GMTAsk.prompt ? GMTAsk.prompt(msg, def || '') : Promise.resolve(g.prompt(msg, def || '')); }
  function toast(m, k) { if (typeof g.toast === 'function') g.toast(m, k); }

  /* ── الواجهة ── */
  var BTN = 'border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer';
  var INP = 'border:1.5px solid #e5e7eb;border-radius:10px;padding:7px 9px;font:inherit;font-size:13px;width:100%;box-sizing:border-box';
  function invName(inv) { return (inv.inv_number || '#' + inv.id) + (inv.supplier ? ' · ' + inv.supplier : ''); }
  function card(s, invById, o) {
    var x = stateOf(s), c = STATUS[x.k], invs = ids(s);
    return '<div data-ship="' + esc(s.id) + '" style="border:1.5px solid ' + (x.k === 'overdue' ? '#fca5a5' : '#e5e7eb') + ';border-radius:14px;padding:10px 12px;margin-bottom:8px;background:#fff">' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:14px">' + esc(s.ref) + '</b><span style="border-radius:99px;padding:2px 9px;font-size:11px;font-weight:900;background:' + c[1] + ';color:' + c[2] + '">' + c[0] + '</span>' +
      '<span style="font-size:11.5px;color:#475569">' + esc(MODE[s.mode] || '') + (s.carrier ? ' · ' + esc(s.carrier) : '') + (s.tracking ? ' · <span dir="ltr" style="font-weight:800">' + esc(s.tracking) + '</span>' : '') + '</span>' +
      '<span style="flex:1"></span>' + (g.GMTPoDocs ? '<button data-ship-docs="' + esc(s.id) + '" data-ref="' + esc(s.ref) + '" title="📎 مستندات الشحنة (البوليصة · الباكينج …)" style="' + BTN + '">📎</button>' : '') + (s.status !== 'cancelled' && s.status !== 'arrived' ? '<button data-ship-edit="' + esc(s.id) + '" style="' + BTN + '">✏️</button>' : '') + '</div>' +
      '<div style="height:5px;background:#f1f5f9;border-radius:99px;margin:8px 0;overflow:hidden"><div style="height:100%;width:' + Math.round(progress(s) * 100) + '%;background:' + (s.status === 'cancelled' ? '#fca5a5' : '#1f348f') + '"></div></div>' +
      '<div style="font-size:12px;color:#334155">' + (s.etd ? 'انطلقت: ' + esc(s.etd) + ' · ' : '') + (s.eta ? 'الوصول المتوقّع: <b>' + esc(s.eta) + '</b>' + (x.days != null && s.status !== 'arrived' && s.status !== 'cancelled' ? (x.days >= 0 ? ' (بعد ' + x.days + ' يوم)' : ' <b style="color:#b91c1c">(متأخّرة ' + (-x.days) + ' يوم)</b>') : '') : 'بلا موعد وصول') +
      (s.arrived_at ? ' · وصلت ' + esc(String(s.arrived_at).slice(0, 10)) : '') + (s.cartons || s.kg || s.cbm ? ' · ' + [s.cartons ? s.cartons + ' كرتونة' : '', s.kg ? s.kg + ' كغ' : '', s.cbm ? s.cbm + ' م³' : ''].filter(Boolean).join(' · ') : '') + '</div>' +
      (s.note ? '<div style="font-size:11.5px;color:#64748b;margin-top:2px">📝 ' + esc(s.note) + '</div>' : '') + (s.cancel_reason ? '<div style="font-size:11.5px;color:#991b1b;margin-top:2px">سبب الإلغاء: ' + esc(s.cancel_reason) + '</div>' : '') +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">' + (invs.length ? invs.map(function (i) { var inv = invById[i];
        return '<span style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:99px;padding:2px 4px 2px 9px;font-size:11.5px;font-weight:800">' +
          '<a href="#" data-ship-inv="' + esc(i) + '" style="color:#1f348f">' + esc(inv ? invName(inv) : '#' + i) + '</a>' +
          (inv && inv.status === 'arrived' ? '<span style="color:#15803d">✅ مستلمة</span>' : (s.status === 'arrived' || s.status === 'customs') && o.onRecv ? '<button data-ship-recv="' + esc(i) + '" style="border:0;background:#0f1219;color:#fff;border-radius:99px;padding:2px 8px;font:inherit;font-size:11px;font-weight:900;cursor:pointer">📦 استلم</button>' : '') + '</span>'; }).join('') : '<span style="font-size:11.5px;color:#b45309">ما في فواتير مربوطة</span>') + '</div>' +
      (s.status !== 'cancelled' && s.status !== 'arrived' ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">' +
        FLOW.slice(FLOW.indexOf(s.status) + 1).map(function (k) { return '<button data-ship-st="' + k + '" data-id="' + esc(s.id) + '" style="' + BTN + '">' + STATUS[k][0] + '</button>'; }).join('') +
        '<button data-ship-st="cancelled" data-id="' + esc(s.id) + '" style="' + BTN + ';color:#991b1b">✖ إلغاء</button></div>' : '') + '</div>';
  }
  function form(s, invoices, list) {
    s = s || {}; var sel = ids(s), carriers = {};
    (list || []).forEach(function (x) { if (x.carrier) carriers[x.carrier] = 1; }); (invoices || []).forEach(function (x) { if (x.shipping_company) carriers[String(x.shipping_company).trim()] = 1; });
    var pick = (invoices || []).filter(function (x) { return x.inv_type !== 'instant' && (x.status !== 'arrived' || sel.indexOf(String(x.id)) >= 0) && !/cancel/i.test(x.status || ''); });
    var other = {}; (list || []).forEach(function (x) { if (String(x.id) !== String(s.id) && x.status !== 'cancelled') ids(x).forEach(function (i) { (other[i] = other[i] || []).push(x.ref); }); });
    return '<div data-ship-form style="border:1.5px solid #1f348f;border-radius:14px;padding:12px;margin-bottom:10px;background:#f8fafc">' +
      '<div style="font-weight:900;margin-bottom:8px">' + (s.id ? '✏️ تعديل ' + esc(s.ref) : '➕ شحنة جديدة') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">' +
      '<label style="font-size:11.5px;font-weight:800">شركة الشحن<input data-sf="carrier" list="poship-carriers" value="' + esc(s.carrier || '') + '" style="' + INP + '"></label>' +
      '<label style="font-size:11.5px;font-weight:800">رقم التتبّع / البوليصة<input data-sf="tracking" dir="ltr" value="' + esc(s.tracking || '') + '" style="' + INP + '"></label>' +
      '<label style="font-size:11.5px;font-weight:800">الطريقة<select data-sf="mode" style="' + INP + '">' + Object.keys(MODE).map(function (k) { return '<option value="' + k + '"' + ((s.mode || 'sea') === k ? ' selected' : '') + '>' + MODE[k] + '</option>'; }).join('') + '</select></label>' +
      '<label style="font-size:11.5px;font-weight:800">تاريخ الانطلاق<input data-sf="etd" type="date" value="' + esc(s.etd || '') + '" style="' + INP + '"></label>' +
      '<label style="font-size:11.5px;font-weight:800">الوصول المتوقّع<input data-sf="eta" type="date" value="' + esc(s.eta || '') + '" style="' + INP + '"></label>' +
      '<label style="font-size:11.5px;font-weight:800">كراتين<input data-sf="cartons" type="number" min="0" value="' + esc(s.cartons || '') + '" style="' + INP + '"></label>' +
      '<label style="font-size:11.5px;font-weight:800">الوزن كغ<input data-sf="kg" type="number" min="0" step="any" value="' + esc(s.kg || '') + '" style="' + INP + '"></label>' +
      '<label style="font-size:11.5px;font-weight:800">الحجم م³<input data-sf="cbm" type="number" min="0" step="any" value="' + esc(s.cbm || '') + '" style="' + INP + '"></label></div>' +
      '<datalist id="poship-carriers">' + Object.keys(carriers).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' +
      '<label style="display:block;font-size:11.5px;font-weight:800;margin-top:8px">ملاحظة<input data-sf="note" value="' + esc(s.note || '') + '" style="' + INP + '"></label>' +
      '<div style="font-size:12px;font-weight:900;margin:10px 0 4px">الفواتير بهالشحنة <span style="font-weight:700;color:#64748b">(فاتورة ممكن تكون بأكتر من شحنة إذا انقسمت)</span></div>' +
      '<div style="max-height:200px;overflow:auto;border:1px solid #e5e7eb;border-radius:10px;background:#fff">' + (pick.length ? pick.map(function (x) { var on = sel.indexOf(String(x.id)) >= 0;
        return '<label style="display:flex;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12.5px;cursor:pointer"><input type="checkbox" data-sf-inv="' + esc(x.id) + '"' + (on ? ' checked' : '') + '>' +
          '<span style="flex:1"><b>' + esc(x.inv_number || '#' + x.id) + '</b> · ' + esc(x.supplier || '') + ' <span style="color:#64748b">' + esc(x.inv_date || '') + '</span>' + (x.tracking_number ? ' <span dir="ltr" style="color:#64748b">· ' + esc(x.tracking_number) + '</span>' : '') + '</span>' +
          (other[x.id] ? '<span style="font-size:10.5px;color:#b45309;font-weight:800">كمان بـ' + esc(other[x.id].join('، ')) + '</span>' : '') + '</label>'; }).join('') : '<div style="padding:8px;font-size:12px;color:#64748b">ما في فواتير استيراد بالطريق.</div>') + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:10px"><button data-ship-save style="border:0;background:#0f1219;color:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer">💾 حفظ</button><button data-ship-cancel-form style="' + BTN + '">رجوع</button></div></div>';
  }
  function open(getInvoices, o) {
    o = o || {};
    var old = document.querySelector('[data-poship]'); if (old) old.remove();
    var w = document.createElement('div'); w.setAttribute('data-poship', '');
    w.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(15,18,25,.55);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var box = document.createElement('div'); box.dir = 'rtl';
    box.style.cssText = 'background:#f1f5f9;border-radius:16px;padding:14px;width:100%;max-width:820px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit';
    w.appendChild(box); w.setAttribute('data-gmt-modal', ''); document.body.appendChild(w);
    var st = { f: 'active', edit: null };
    var inv = function () { return (typeof getInvoices === 'function' ? getInvoices() : getInvoices) || []; };
    function paint() {
      var I = inv(), byId = {}; I.forEach(function (x) { byId[String(x.id)] = x; });
      var L = LIST.filter(function (s) { return st.f === 'all' || (st.f === 'active' ? s.status !== 'arrived' && s.status !== 'cancelled' : st.f === 'overdue' ? stateOf(s).k === 'overdue' : s.status === st.f); });
      L.sort(function (a, b) { var ka = stateOf(a), kb = stateOf(b); if ((ka.k === 'overdue') !== (kb.k === 'overdue')) return ka.k === 'overdue' ? -1 : 1; return String(a.eta || '9999') < String(b.eta || '9999') ? -1 : 1; });
      var un = unshipped(I, LIST), cnt = function (f) { return LIST.filter(function (s) { return f === 'overdue' ? stateOf(s).k === 'overdue' : f === 'active' ? s.status !== 'arrived' && s.status !== 'cancelled' : s.status === f; }).length; };
      box.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><div style="flex:1;font-weight:900;font-size:16px">🚢 شحنات المشتريات</div>' +
        '<button data-ship-new style="border:0;background:#1f348f;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:900;cursor:pointer">➕ شحنة جديدة</button><button data-ship-x style="' + BTN + '">✕</button></div>' +
        (st.edit !== null ? form(st.edit === 'new' ? null : LIST.find(function (s) { return String(s.id) === String(st.edit); }), I, LIST) : '') +
        (un.length ? '<div data-ship-unshipped style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:8px 10px;margin-bottom:10px;font-size:12px"><b>📭 ' + un.length + ' فاتورة استيراد بالطريق بلا شحنة:</b> ' + un.slice(0, 8).map(function (x) { return esc(x.inv_number || '#' + x.id); }).join('، ') + (un.length > 8 ? '…' : '') + ' — <a href="#" data-ship-new style="font-weight:900;color:#1f348f">اربطها بشحنة</a></div>' : '') +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">' + [['active', 'الفعّالة'], ['overdue', '⏰ المتأخّرة'], ['arrived', '✅ وصلت'], ['cancelled', 'الملغاة'], ['all', 'الكلّ']].map(function (t) {
          return '<button data-ship-f="' + t[0] + '" style="border:0;border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;font-weight:900;cursor:pointer;background:' + (st.f === t[0] ? '#0f1219;color:#fff' : '#fff;color:#334155') + '">' + t[1] + ' (' + (t[0] === 'all' ? LIST.length : cnt(t[0])) + ')</button>'; }).join('') + '</div>' +
        (L.length ? L.map(function (s) { return card(s, byId, o); }).join('') : '<div style="text-align:center;color:#64748b;font-size:13px;padding:20px">ما في شحنات هون.</div>');
    }
    function readForm() {
      var f = box.querySelector('[data-ship-form]'), v = {};
      f.querySelectorAll('[data-sf]').forEach(function (el) { var k = el.getAttribute('data-sf'), x = String(el.value || '').trim(); v[k] = x === '' ? null : (/cartons/.test(k) ? parseInt(x, 10) : /kg|cbm/.test(k) ? Number(x) : x); });
      v.invoice_ids = [].slice.call(f.querySelectorAll('[data-sf-inv]:checked')).map(function (el) { return Number(el.getAttribute('data-sf-inv')); });
      return v;
    }
    w.addEventListener('click', async function (e) {
      var t = e.target;
      if (t === w || t.closest('[data-ship-x]')) { w.remove(); return; }
      if (t.closest('[data-ship-new]')) { e.preventDefault(); st.edit = 'new'; paint(); box.scrollIntoView({ block: 'start' }); return; }
      var dc = t.closest('[data-ship-docs]'); if (dc) { GMTPoDocs.panel({ shipment_id: dc.getAttribute('data-ship-docs'), title: dc.getAttribute('data-ref'), expect: false }); return; }
      var ed = t.closest('[data-ship-edit]'); if (ed) { st.edit = ed.getAttribute('data-ship-edit'); paint(); return; }
      if (t.closest('[data-ship-cancel-form]')) { st.edit = null; paint(); return; }
      var f = t.closest('[data-ship-f]'); if (f) { st.f = f.getAttribute('data-ship-f'); paint(); return; }
      var ii = t.closest('[data-ship-inv]'); if (ii) { e.preventDefault(); if (o.onOpenInv) { w.remove(); o.onOpenInv(ii.getAttribute('data-ship-inv')); } return; }
      var rc = t.closest('[data-ship-recv]'); if (rc) { if (o.onRecv) { w.remove(); o.onRecv(rc.getAttribute('data-ship-recv')); } return; }
      if (t.closest('[data-ship-save]')) {
        var v = readForm();
        if (!v.invoice_ids.length && !(g.GMTAsk && GMTAsk.confirm ? await GMTAsk.confirm('الشحنة بلا فواتير — تحفظها هيك؟') : g.confirm('الشحنة بلا فواتير — تحفظها هيك؟'))) return;
        if (v.etd && v.eta && v.eta < v.etd) { toast('موعد الوصول قبل الانطلاق — صحّحه', 'err'); return; }
        try { var r = await save(v, st.edit === 'new' ? null : st.edit); st.edit = null; paint(); toast('✅ انحفظت الشحنة ' + (r ? r.ref : ''), 'ok'); if (o.onChange) o.onChange(); }
        catch (err) { toast('تعذّر الحفظ: ' + err.message, 'err'); }
        return;
      }
      var sb = t.closest('[data-ship-st]'); if (sb) {
        var k = sb.getAttribute('data-ship-st'), id = sb.getAttribute('data-id'), patch = { status: k };
        if (k === 'cancelled') { var why = await ask('سبب إلغاء الشحنة؟ (الشحنة ما بتنحذف — بتضلّ بالسجلّ)'); if (!why || !String(why).trim()) return; patch.cancel_reason = String(why).trim(); }
        if (k === 'arrived') patch.arrived_at = new Date().toISOString();
        try { await save(patch, id); paint(); if (k === 'arrived') toast('✅ وصلت الشحنة — استلم كلّ فاتورة من زرّ «📦 استلم» (بالمسح)', 'ok'); if (o.onChange) o.onChange(); }
        catch (err) { toast('تعذّر التحديث: ' + err.message, 'err'); }
      }
    });
    loadAll().then(function () { if (o.focus === 'new') st.edit = 'new'; paint(); });
    paint();
    return w;
  }
  g.GMTPoShip = { nextRef: nextRef, stateOf: stateOf, forInvoice: forInvoice, unshipped: unshipped, progress: progress, loadAll: loadAll, of: of, chipFor: chipFor, save: save, open: open, STATUS: STATUS };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPoShip;
})(typeof window !== 'undefined' ? window : globalThis);
