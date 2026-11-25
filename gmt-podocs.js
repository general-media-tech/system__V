/* ═════════════════════════════════════════════════════════════════════
   gmt-podocs.js — أرشيف مستندات المشتريات (A1004 P6 م٣ · الخطّة 1.8 · طابور Q1 · seq B1098)
   «فاتورة المورّد · الباكينج ليست · البيان الجمركي · البوليصة · إيصال الدفع» على كلّ فاتورة شراء أو شحنة.
   الملفّات بالدلو الخاصّ po-docs: المتصفّح بيرفع بس — ما في رابط عامّ. الفتح برابط موقَّع ٥ دقائق من gmt-admin
   (a: doc_url) للأدمن الداخل باسمه فقط. البيانات الوصفية بـgmt_po_docs · لا حذف: إلغاء بسبب.

   صافٍ:   guessKind(name, mime) · pathFor(owner, name, now, rnd) · sizeTxt(n)
   واجهة:  loadCounts() · countOf(invId) · list({invoice_id|shipment_id}) · upload(file, meta) · openDoc(doc) · voidDoc(doc, why)
           panel({ invoice_id | shipment_id, title, legacyUrl })
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTPoDocs) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var KIND = { pi: ['🧾', 'فاتورة المورّد (PI)'], invoice: ['📄', 'الفاتورة النهائية'], packing: ['📦', 'باكينج ليست'], customs: ['🛃', 'بيان جمركي'], bl: ['🚢', 'بوليصة الشحن'], receipt: ['💸', 'إيصال دفع / حوالة'], photo: ['📷', 'صورة'], other: ['📎', 'مستند تاني'] };
  var ORDER = ['pi', 'invoice', 'packing', 'customs', 'bl', 'receipt', 'photo', 'other'];
  function guessKind(name, mime) {
    var n = String(name || '').toLowerCase();
    if (/pack(ing)?[\s_-]*list|packing|باكينج|تعبئ/.test(n)) return 'packing';
    if (/(^|[^a-z])b\/?l([^a-z]|$)|bill[\s_-]*of[\s_-]*lading|بوليص/.test(n)) return 'bl';
    if (/custom|declar|جمرك|بيان|مخلّص|مخلص/.test(n)) return 'customs';
    if (/(^|[^a-z])pi([^a-z]|$)|proforma|pro-forma/.test(n)) return 'pi';
    if (/receipt|swift|transfer|حوال|ايصال|إيصال|وصل/.test(n)) return 'receipt';
    if (/invoice|inv[\s_-]|فاتور/.test(n)) return 'invoice';
    if (/^image\//.test(String(mime || '')) || /\.(jpe?g|png|webp|heic|gif)$/.test(n)) return 'photo';
    return 'other';
  }
  /* المسار بلا الاسم الأصلي (حروف عربية/مسافات) — الاسم بيضلّ بالجدول · لازم يطابق شرط gmt-admin: po/<owner>/<file> */
  function pathFor(owner, name, now, rnd) {
    var ext = (String(name || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1] || 'bin';
    return 'po/' + String(owner).replace(/[^A-Za-z0-9_-]/g, '') + '/' + (now || Date.now()).toString(36) + '_' + (rnd || Math.random().toString(36).slice(2, 8)).replace(/[^a-z0-9]/gi, '') + '.' + ext.toLowerCase();
  }
  function sizeTxt(n) { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; }

  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (M && M.url) return M; if (g.SB && g.KEY) return { url: g.SB, key: g.KEY }; throw new Error('إعدادات القاعدة غير محمّلة'); }
  async function req(method, path, body, prefer) {
    var M = db(), h = { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
    var r = await fetch(M.url + '/rest/v1/' + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : '')); }
    var s = await r.text(); return s ? JSON.parse(s) : null;
  }
  function who() { try { return (g.GMTRole && GMTRole.name && GMTRole.name()) || localStorage.getItem('gmt_operator_name') || ''; } catch (_) { return ''; } }
  function toast(m, k) { if (typeof g.toast === 'function') g.toast(m, k); else if (k === 'err') g.alert(m); }
  var COUNTS = {};
  async function loadCounts() {
    var rows = await req('GET', 'gmt_po_docs?voided=is.false&invoice_id=not.is.null&select=invoice_id&limit=5000').catch(function () { return null; });
    if (rows) { COUNTS = {}; rows.forEach(function (x) { var k = String(x.invoice_id); COUNTS[k] = (COUNTS[k] || 0) + 1; }); } return COUNTS;
  }
  function countOf(id) { return COUNTS[String(id)] || 0; }
  async function list(f) {
    var q = f.shipment_id ? 'shipment_id=eq.' + encodeURIComponent(f.shipment_id) : 'invoice_id=eq.' + encodeURIComponent(f.invoice_id);
    return (await req('GET', 'gmt_po_docs?' + q + '&select=*&order=created_at.desc')) || [];
  }
  var MAX = 50 * 1048576;
  async function upload(file, meta) {
    if (!file) throw new Error('ما في ملف'); if (file.size > MAX) throw new Error('الملف أكبر من 50 MB');
    var M = db(), owner = meta.shipment_id ? 'shp-' + String(meta.shipment_id).replace(/-/g, '') : 'inv-' + meta.invoice_id, path = pathFor(owner, file.name);
    var r = await fetch(M.url + '/storage/v1/object/po-docs/' + path, { method: 'POST', headers: { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('تعذّر رفع «' + file.name + '» (HTTP ' + r.status + ')' + (t ? ' ' + t.slice(0, 100) : '')); }
    var row = { invoice_id: meta.invoice_id || null, shipment_id: meta.shipment_id || null, kind: meta.kind || guessKind(file.name, file.type), name: String(file.name || 'ملف').slice(0, 200), path: path, size: file.size || null, mime: file.type || null, note: meta.note || null, uploaded_by: who() || null };
    var c = await req('POST', 'gmt_po_docs', row, 'return=representation');
    if (row.invoice_id) COUNTS[String(row.invoice_id)] = (COUNTS[String(row.invoice_id)] || 0) + 1;
    try { g.GMTAudit && GMTAudit.log({ action: 'po_doc_add', entity: row.invoice_id ? 'import_log' : 'gmt_po_shipments', entityId: String(row.invoice_id || row.shipment_id), entityName: row.name, newValue: KIND[row.kind][1] }); } catch (_) {}
    return c && c[0];
  }
  /* الفتح: نافذة فاضية فوراً (كي ما يمنعها المتصفّح) ⇒ رابط موقَّع من الخادم ⇒ تنفتح عليه */
  async function openDoc(doc) {
    var tok = ''; try { tok = g.GMTAuth && GMTAuth.token ? GMTAuth.token() : ''; } catch (_) {}
    if (!tok) { toast('🔒 المستندات خاصّة — ادخل الإدارة باسمك وكلمة سرّك أوّلاً', 'err'); return null; }
    var win = null; try { win = g.open('', '_blank'); if (win && win.document) win.document.write('<p dir="rtl" style="font-family:sans-serif;padding:20px">⏳ عم يفتح المستند…</p>'); } catch (_) {}
    try {
      var M = db(), r = await fetch(M.url + '/functions/v1/gmt-admin', { method: 'POST', cache: 'no-store', headers: { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'doc_url', path: doc.path, token: tok }) });
      var j = null; try { j = await r.json(); } catch (_) {}
      if (r.status === 401 || (j && j.error === 'auth')) throw new Error('انتهت جلسة الإدارة — ادخل الإدارة من جديد');
      if (!r.ok || !j || !j.url) throw new Error(r.status === 404 ? 'الملف مو موجود بالتخزين' : 'تعذّر فتح المستند (HTTP ' + r.status + ')');
      if (win) win.location.href = j.url; else g.open(j.url, '_blank');
      return j.url;
    } catch (e) { try { if (win) win.close(); } catch (_) {} toast(e.message, 'err'); return null; }
  }
  async function voidDoc(doc, why) {
    await req('PATCH', 'gmt_po_docs?id=eq.' + encodeURIComponent(doc.id), { voided: true, voided_at: new Date().toISOString(), voided_by: who() || null, void_reason: why }, 'return=minimal');
    if (doc.invoice_id && COUNTS[String(doc.invoice_id)]) COUNTS[String(doc.invoice_id)]--;
  }

  /* ── النافذة ── */
  var BTN = 'border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer';
  function panel(o) {
    o = o || {};
    var old = document.querySelector('[data-podocs]'); if (old) old.remove();
    var w = document.createElement('div'); w.setAttribute('data-podocs', '');
    w.style.cssText = 'position:fixed;inset:0;z-index:9750;background:rgba(15,18,25,.55);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto';
    var box = document.createElement('div'); box.dir = 'rtl';
    box.style.cssText = 'background:#fff;border-radius:16px;padding:14px;width:100%;max-width:640px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit';
    w.appendChild(box); w.setAttribute('data-gmt-modal', ''); document.body.appendChild(w);
    var docs = [], pend = [], busy = false, showVoid = false, done = [];   /* done = (B1104) ملفات انرفعت هلّق وإلها إجراء (باكينج/بيان ⇐ الكلفة الواصلة) */
    var meta = o.shipment_id ? { shipment_id: o.shipment_id } : { invoice_id: o.invoice_id };
    function paint() {
      var live = docs.filter(function (d) { return !d.voided; }), dead = docs.filter(function (d) { return d.voided; });
      var have = {}; live.forEach(function (d) { have[d.kind] = 1; });
      box.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><b style="flex:1;font-size:15px">📎 مستندات ' + esc(o.title || '') + '</b><button data-pd-x style="' + BTN + '">✕</button></div>' +
        '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">🔒 خاصّة: بتنفتح بس للأدمن الداخل باسمه — ما في رابط عامّ.</div>' +
        /* شو ناقص: الأساسيات لفاتورة استيراد */
        (o.invoice_id && o.expect !== false ? '<div data-pd-need style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">' + ['pi', 'packing', 'customs', 'bl'].map(function (k) { return '<span data-pd-has="' + k + ':' + (have[k] ? 1 : 0) + '" style="border-radius:99px;padding:2px 9px;font-size:11px;font-weight:900;background:' + (have[k] ? '#dcfce7;color:#166534' : '#f1f5f9;color:#64748b') + '">' + (have[k] ? '✓ ' : '') + KIND[k][1] + '</span>'; }).join('') + '</div>' : '') +
        '<label data-pd-drop style="display:block;border:2px dashed #cbd5e1;border-radius:14px;padding:14px;text-align:center;cursor:pointer;background:#f8fafc">' +
        '<input type="file" multiple data-pd-file accept="image/*,.pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.zip" style="display:none">' +
        '<div style="font-size:22px">⬆️</div><div style="font-weight:900;font-size:13.5px">اختار ملفات أو اسحبها لهون</div><div style="font-size:11.5px;color:#64748b">PDF · صور · إكسل · وورد — لحدّ 50 MB للملف</div></label>' +
        (pend.length ? '<div data-pd-pend style="margin-top:10px;border:1px solid #e5e7eb;border-radius:12px;padding:8px">' + pend.map(function (p, i) {
          return '<div style="display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800" title="' + esc(p.file.name) + '">' + esc(p.file.name) + ' <span style="color:#94a3b8;font-weight:600">' + sizeTxt(p.file.size) + '</span></span>' +
            (p.reading ? '<span style="font-size:11px;color:#64748b">⏳ عم يقرا…</span>' : '') + (p.auto ? '<span title="النظام قرا الملف وعرف نوعه" style="font-size:11px;color:#15803d;font-weight:900">🧠</span>' : '') + '<select data-pd-kind="' + i + '" style="border:1.5px solid #e5e7eb;border-radius:8px;padding:4px;font:inherit;font-size:12px">' + ORDER.map(function (k) { return '<option value="' + k + '"' + (p.kind === k ? ' selected' : '') + '>' + KIND[k][0] + ' ' + KIND[k][1] + '</option>'; }).join('') + '</select>' +
            '<button data-pd-unpend="' + i + '" style="' + BTN + ';padding:3px 8px">✕</button></div>'; }).join('') +
          '<button data-pd-up style="margin-top:8px;width:100%;border:0;background:#0f1219;color:#fff;border-radius:10px;padding:9px;font:inherit;font-size:13px;font-weight:900;cursor:pointer"' + (busy ? ' disabled' : '') + '>' + (busy ? '⏳ عم يرفع…' : '⬆️ ارفع ' + pend.length + ' ملف') + '</button></div>' : '') +
        (done.length ? '<div data-pd-actions style="margin-top:10px;border:1.5px solid #a7f3d0;background:#ecfdf5;border-radius:12px;padding:8px">' + done.map(function (d, i) { return '<div style="display:flex;gap:6px;align-items:center;padding:3px 0;font-size:12.5px"><span style="flex:1;font-weight:800">' + (KIND[d.kind] || KIND.other)[0] + ' ' + esc(d.file.name) + '</span>' + d.acts.map(function (a, k) { return '<button data-pd-act="' + i + ':' + k + '" style="border:0;background:#0f1219;color:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-size:12px;font-weight:900;cursor:pointer">' + esc(a.label) + '</button>'; }).join('') + '</div>'; }).join('') + '</div>' : '') +
        '<div style="margin-top:12px">' + (live.length ? live.map(function (d) { var k = KIND[d.kind] || KIND.other;
          return '<div data-pd-doc="' + esc(d.id) + '" style="display:flex;gap:8px;align-items:center;border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px;margin-bottom:6px"><span style="font-size:20px">' + k[0] + '</span>' +
            '<div style="flex:1;min-width:0"><div style="font-weight:900;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(d.name) + '">' + esc(d.name) + '</div><div style="font-size:11px;color:#64748b">' + esc(k[1]) + ' · ' + sizeTxt(d.size) + ' · ' + esc(String(d.created_at || '').slice(0, 10)) + (d.uploaded_by ? ' · ' + esc(d.uploaded_by) : '') + '</div></div>' +
            '<button data-pd-open="' + esc(d.id) + '" style="' + BTN + '">👁 افتح</button><button data-pd-void="' + esc(d.id) + '" title="إلغاء (ما بينحذف)" style="' + BTN + ';color:#991b1b">✖</button></div>'; }).join('')
          : (o.legacyUrl ? '' : '<div style="text-align:center;color:#64748b;font-size:12.5px;padding:10px">لسّا ما في مستندات.</div>')) +
        (o.legacyUrl ? '<div style="display:flex;gap:8px;align-items:center;border:1px dashed #e5e7eb;border-radius:12px;padding:8px 10px;margin-bottom:6px;font-size:12.5px"><span style="font-size:20px">🔗</span><span style="flex:1">ملف الفاتورة القديم (رابط مسجّل على الفاتورة)</span><a href="' + esc(o.legacyUrl) + '" target="_blank" rel="noopener" style="' + BTN + ';text-decoration:none;color:#0f1219">👁 افتح</a></div>' : '') +
        (dead.length ? '<button data-pd-showvoid style="border:0;background:none;color:#64748b;font:inherit;font-size:11.5px;cursor:pointer;margin-top:4px">' + (showVoid ? '▾' : '▸') + ' الملغاة (' + dead.length + ')</button>' + (showVoid ? dead.map(function (d) { return '<div style="font-size:11.5px;color:#94a3b8;text-decoration:line-through;padding:2px 0">' + esc(d.name) + ' — ' + esc(d.void_reason || '') + '</div>'; }).join('') : '') : '') + '</div>';
    }
    function addFiles(fl) {
      [].slice.call(fl || []).forEach(function (f) {
        var p = { file: f, kind: guessKind(f.name, f.type) }; pend.push(p);
        /* (B1104) النوع من محتوى الملف مش بس اسمه: إكسل ⇐ النظام بيقرا العناوين (فاتورة · باكينج · بيان جمركي) */
        if (o.classify) { p.reading = true; Promise.resolve(o.classify(f)).then(function (k) { if (k && KIND[k]) { p.kind = k; p.auto = true; } }).catch(function () {}).then(function () { p.reading = false; if (!busy) paint(); }); }
      });
      paint();
    }
    async function refresh() { try { docs = await list(meta); } catch (e) { toast('تعذّر تحميل المستندات: ' + e.message, 'err'); } paint(); }
    w.addEventListener('click', async function (e) {
      var t = e.target;
      if (t === w || t.closest('[data-pd-x]')) { w.remove(); if (o.onClose) o.onClose(); return; }
      var u = t.closest('[data-pd-unpend]'); if (u) { e.preventDefault(); pend.splice(+u.getAttribute('data-pd-unpend'), 1); paint(); return; }
      if (t.closest('[data-pd-showvoid]')) { showVoid = !showVoid; paint(); return; }
      var ac = t.closest('[data-pd-act]'); if (ac) { var ix = ac.getAttribute('data-pd-act').split(':'), dd = done[+ix[0]], aa = dd && dd.acts[+ix[1]]; if (aa) { w.remove(); try { aa.run(); } catch (er) { toast(er.message, 'err'); } } return; }
      if (t.closest('[data-pd-up]') && !busy) {
        busy = true; paint(); var ok = 0, errs = [];
        for (var i = 0; i < pend.length; i++) { try { await upload(pend[i].file, Object.assign({ kind: pend[i].kind }, meta)); ok++; var acts = o.actionsFor ? (o.actionsFor(pend[i].file, pend[i].kind) || []) : []; if (acts.length) done.push({ file: pend[i].file, kind: pend[i].kind, acts: acts }); } catch (er) { errs.push(er.message); } }
        pend = []; busy = false; await refresh();
        if (ok) toast('✅ انرفع ' + ok + ' ملف', 'ok'); if (errs.length) toast(errs.join(' · '), 'err');
        if (o.onChange) o.onChange(); return;
      }
      var op = t.closest('[data-pd-open]'); if (op) { var d = docs.find(function (x) { return String(x.id) === op.getAttribute('data-pd-open'); }); if (d) openDoc(d); return; }
      var vd = t.closest('[data-pd-void]'); if (vd) {
        var d2 = docs.find(function (x) { return String(x.id) === vd.getAttribute('data-pd-void'); }); if (!d2) return;
        var why = g.GMTAsk && GMTAsk.prompt ? await GMTAsk.prompt('ليش بدك تلغي «' + d2.name + '»؟ (الملف ما بينحذف — بيضلّ بالسجلّ)', { title: 'إلغاء مستند' }) : g.prompt('سبب الإلغاء؟');
        if (!why || !String(why).trim()) return;
        try { await voidDoc(d2, String(why).trim()); await refresh(); if (o.onChange) o.onChange(); } catch (er) { toast('تعذّر: ' + er.message, 'err'); }
      }
    });
    w.addEventListener('change', function (e) {
      var f = e.target.closest('[data-pd-file]'); if (f) { addFiles(f.files); f.value = ''; return; }
      var k = e.target.closest('[data-pd-kind]'); if (k) { pend[+k.getAttribute('data-pd-kind')].kind = k.value; }
    });
    ['dragover', 'drop'].forEach(function (ev) { w.addEventListener(ev, function (e) { if (!e.target.closest('[data-pd-drop]')) return; e.preventDefault(); if (ev === 'drop') addFiles(e.dataTransfer && e.dataTransfer.files); }); });
    paint(); refresh();
    return w;
  }
  g.GMTPoDocs = { guessKind: guessKind, pathFor: pathFor, sizeTxt: sizeTxt, loadCounts: loadCounts, countOf: countOf, list: list, upload: upload, openDoc: openDoc, voidDoc: voidDoc, panel: panel, KIND: KIND };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPoDocs;
})(typeof window !== 'undefined' ? window : globalThis);
