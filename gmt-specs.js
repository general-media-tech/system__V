/* ═════════════════════════════════════════════════════════════════════
   gmt-specs.js — جدول مواصفات المنتج في مكانٍ واحد  ·  (25 ت1 · TASK-0162)
   ─────────────────────────────────────────────────────────────────────
   طلب المالك (seq 54): «هذا الجدول عم يجيبه ولكن ما في له مكان في تفاصيل المنتج عندنا — فلازم يكون هذا المكان موجود
   في المتجر وفي الجرد وفي تفاصيل المنتج».
   عمود products.specs (jsonb) يُملأ من مصدرين: «المواصفات التلقائية» (علي بابا · مفاتيح حرّة كما جاءت: «الأبعاد» · «النوع»…)
   و«إثراء المنتجات» (gmt-enrich.js · مفاتيح ثابتة: mount · voltage_v · fits…). والمفاتيح التي تبدأ بـ«__» ليست صفوفاً:
   __desc الوصف · __brand الماركة · __model الموديل. هذا الملفّ يعرضها كلّها بشكلٍ واحد في الجرد والمتجر والجسر.
     GMTSpecs.rows(specs)      ⇒ [{ label, value }]   (صفوف الجدول فقط)
     GMTSpecs.meta(specs)      ⇒ { desc, brand, model }
     GMTSpecs.forStore(specs)  ⇒ نسخةٌ للمتجر: الصفوف + الماركة والموديل (بلا مصدرٍ ولا تاريخٍ داخليّ)
     GMTSpecs.tableHTML(specs, { compat }) ⇒ جدولٌ HTML جاهز (أو '' إن لم يوجد شيء)
     GMTSpecs.pushToStore(p, { specs, compat, storeDesc }) ⇒ Promise<{ id, specs } | null>   (TASK-0200)
        «جدول المواصفات اللي عم نحطّه للمنتج لحاله تلقائياً ينتقل إلى المتجر» — كلّ حفظٍ للمواصفات في الجرد يكتبها لمنتج المتجر
        المربوط (store_url «#product=» · inv_id · الباركود). null ⇒ غير مربوط. كتابةٌ مشروطة على الكتالوج الطازج (updated_at) كالجسر.
   ═════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  /* نفس مسمّيات لوحة الإثراء (gmt-enrich.js) لمفاتيحها الثابتة */
  var LABEL = {
    accessory_type: 'النوع', mount: 'الحربة', filter_thread_mm: 'قطر الفلتر (مم)', attachment: 'التثبيت', shape: 'الشكل',
    manufacturer: 'المصنّع', origin: 'المنشأ', voltage_v: 'الجهد (فولت)', capacity_mah: 'السعة (mAh)', energy_wh: 'الطاقة (Wh)',
    trigger_voltage_v: 'جهد الإطلاق', guide_number_m: 'الرقم الدليلي', radio_system: 'نظام الراديو', hotshoe_protocol: 'بروتوكول القاعدة',
    oem_code: 'الكود الأصلي', replaces_oem: 'يُكافئ', warranty_months: 'الكفالة (شهر)', fits_bodies: 'يعمل مع', fits: 'يركّب على'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function asObj(sp) {
    if (!sp) return {};
    if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch (_) { return {}; } }
    return (sp && typeof sp === 'object' && !Array.isArray(sp)) ? sp : {};
  }
  function val(v) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(function (x) {
      return (x && typeof x === 'object') ? [x.brand, x.mount, x.model, x.version].filter(Boolean).join(' ') : String(x);
    }).filter(Boolean).join(' · ');
    if (typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; }).filter(function (x) { return x != null && x !== ''; }).join(' · ');
    return String(v).trim();
  }
  /* (TASK-0206 · seq 135) «لا يكتبلي تقريبي — هي الكلمة محظورة» ⇐ (TASK-0241 · المالك seq 164) «انا ما طلبت تحذف كل شيء تقريبا …
     اذا ما لقى يعطيني اشاره عليها انه تقريبي لكن ما تنكتب كلمه تقريب يعني ما اضطر احذفها خلاص انا بتاكد»:
     كان البند التقديريّ يُسقَط (٢٩١ من ٣١٤ منتجاً فيها تقديرات ⇒ جداولٌ فارغة في المتجر ونقطة البيع، والحفظ من «تعديل المنتج» يحذفها).
     الآن: الكلمة تُنزَع من القيمة دائماً، والبند يبقى ويحمل علامة approx ⇒ «≈» في الجرد ونقطة البيع للتحقّق، ولا شيء في المتجر.
     العلامة تُحفظ منفصلةً عن القيمة: specs.__approx = [مفاتيح البنود التقديريّة]. وما لا معلومة فيه («غير متوفر» · N/A) وحده يُسقَط. */
  var APPROX_RE = /\s*[\(（\[]?\s*(?:تقريبي[ةه]?|تقريباً|تقريبا|approx(?:\.|imately)?|typical(?:ly)?|نموذجي[ةه]?)\s*[\)）\]]?/gi;
  var NOINFO = /غير\s*(متوفر|متوفّر|متاح|محدد|محدّد|معروف|مطبق|مطبّق)|\bN\/?A\b|unknown/i;
  function clean(v) {
    var s = String(v == null ? '' : v), ap = new RegExp(APPROX_RE.source, 'i').test(s);
    s = s.replace(APPROX_RE, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([،,.\)])/g, '$1').replace(/\(\s*\)/g, '').trim();
    return { value: s, approx: ap };
  }
  function sure(r) { return !!r && String(r.value || '').trim() !== '' && !NOINFO.test(String(r.value || '')) && !NOINFO.test(String(r.label || '')); }
  function approxKeys(sp) { var a = sp && sp.__approx; return Array.isArray(a) ? a.map(String) : []; }
  function rows(sp) {
    sp = asObj(sp); var ax = approxKeys(sp);
    return Object.keys(sp).filter(function (k) { return k.indexOf('__') !== 0; })
      .map(function (k) { var c = clean(val(sp[k])); return { key: k, label: LABEL[k] || k, value: c.value, approx: c.approx || ax.indexOf(k) !== -1 }; })
      .filter(sure);
  }
  function meta(sp) { sp = asObj(sp); return { desc: val(sp.__desc), brand: val(sp.__brand), model: val(sp.__model) }; }
  /* نسخة المتجر: {label, value} نظيفة — بلا علامة التقدير (الزبون يرى القيمة فقط) */
  function forStore(sp) {
    var r = rows(sp), m = meta(sp), out = [];
    if (m.brand) out.push({ label: 'الماركة', value: m.brand });
    if (m.model) out.push({ label: 'الموديل', value: m.model });
    return out.concat(r.map(function (x) { return { label: x.label, value: x.value }; }));
  }
  /* للعرض الداخليّ: كنسخة المتجر + علامة approx */
  function forView(sp) {
    if (Array.isArray(sp)) return sp.map(function (r) { var c = clean(r && r.value); return { label: r && r.label, value: c.value, approx: !!(r && r.approx) || c.approx }; }).filter(sure);
    var m = meta(sp), out = [];
    if (m.brand) out.push({ label: 'الماركة', value: m.brand });
    if (m.model) out.push({ label: 'الموديل', value: m.model });
    return out.concat(rows(sp));
  }
  /* جدولٌ بسيط بخطوطٍ فاتحة — يرث خطّ الصفحة ولونها ويصلح للهاتف (يلتفّ النصّ ولا يتجاوز العرض) */
  /* opts.marks === false ⇒ بلا «≈» (المتجر) */
  function tableHTML(sp, opts) {
    opts = opts || {};
    var list = forView(sp), marks = opts.marks !== false;
    var compat = String(opts.compat || '').trim();
    if (!list.length && !compat) return '';
    var html = '<table class="gmt-specs" style="width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed">' +
      list.map(function (r, i) {
        return '<tr style="background:' + (i % 2 ? 'transparent' : 'rgba(15,18,25,.035)') + '">' +
          '<th scope="row" style="width:38%;text-align:right;font-weight:800;padding:6px 8px;border-bottom:1px solid rgba(15,18,25,.08);vertical-align:top;overflow-wrap:anywhere">' + esc(r.label) + '</th>' +
          '<td style="padding:6px 8px;border-bottom:1px solid rgba(15,18,25,.08);overflow-wrap:anywhere">' + esc(r.value) +
          (marks && r.approx ? ' <span data-spec-approx title="قيمة تقديرية — تحقّق منها" style="color:#b45309;font-weight:900;cursor:help">≈</span>' : '') + '</td></tr>';
      }).join('') + '</table>';
    if (compat) html += '<div style="margin-top:8px;font-size:12px;line-height:1.7;overflow-wrap:anywhere"><b>متوافق مع:</b> ' + esc(compat) + '</div>';
    return html;
  }
  /* ── (TASK-0200) الكتابة للمتجر — مصدرٌ واحد لكلّ طرق الحفظ (الجرد · «جهّز تلقائياً» · 🧠 المنتج · الإثراء · الشراء) ── */
  function dbs() {
    var D = global.GMT_DB || {};
    return { main: D.MAIN || { url: global.SUPABASE_URL || '', key: global.SUPABASE_ANON_KEY || '' }, store: D.STORE || null };
  }
  function hdr(db, extra) { var h = { apikey: db.key, Authorization: 'Bearer ' + db.key }; for (var k in (extra || {})) h[k] = extra[k]; return h; }
  function findStore(prods, p) {
    var m = /#product=([^&]+)/.exec(String(p.store_url || '')), sid = m ? decodeURIComponent(m[1]) : '', bc = String(p.barcode || '').trim();
    return (sid && prods.filter(function (x) { return x && String(x.id) === sid; })[0]) ||
      prods.filter(function (x) { return x && x.inv_id != null && String(x.inv_id) === String(p.id); })[0] ||
      (bc && prods.filter(function (x) { return x && String(x.barcode || '').trim() === bc; }).length === 1 ? prods.filter(function (x) { return x && String(x.barcode || '').trim() === bc; })[0] : null) || null;
  }
  /* (TASK-0197) صورة الجرد تنضمّ لصور منتج المتجر المربوط (إن لم تكن فيها) — «تصير بين مجموعة الصور» */
  async function addImageToStore(p, url) {
    url = String(url || (p && p.image_url) || '').trim(); if (!url) return null;
    return pushToStore(p, { only: function (sp) { var imgs = Array.isArray(sp.images) ? sp.images.slice() : []; if (imgs.indexOf(url) !== -1 || sp.image === url) return 'same'; imgs.push(url); return { images: imgs }; } });
  }
  /* (TASK-0254 · المالك seq 174) «في المزامنه … انت اخذ فقط الجدول … التوافقيات والوصف ما عم تاخذه للمتجر»: وصف المتجر = وصف الجرد أوّلاً
     ثمّ أسطر المتجر التي ليست فيه (لا يُمحى ما كُتب في المتجر وحده). مشتركٌ بين الحفظ والجسر والمزامنة. */
  function mergeDesc(invDesc, storeDesc) {
    var mine = String(invDesc || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var keep = String(storeDesc || '').split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x && mine.indexOf(x) === -1; });
    return mine.concat(keep).join('\n');
  }
  /* ما ينتقل من منتج الجرد إلى منتج المتجر المربوط: الجدول · التوافقيات · الوصف (لا يمحو شيئاً في المتجر بفراغ) */
  function storeFields(inv, sp) {
    inv = inv || {}; sp = sp || {};
    var out = {}, t = forStore(inv.specs), d = meta(inv.specs).desc, c = String(inv.compat || '').trim();
    if (t.length) out.specs = t;
    if (c) out.compat = c;
    if (d) { var m = mergeDesc(d, sp.description); if (m !== String(sp.description || '')) out.description = m; }
    return out;
  }
  async function pushToStore(p, o) {
    o = o || {}; var D = dbs(); if (!p || !D.store || !D.store.url) return null;
    /* المنتج كما في الجرد إن نقص (رابط المتجر · الباركود · المواصفات) */
    if ((!p.store_url && !p.barcode) || (!o.only && o.specs == null && p.specs == null)) {
      try {
        var rq = await fetch(D.main.url + '/rest/v1/products?id=eq.' + encodeURIComponent(p.id) + '&select=id,store_url,barcode,specs,compat', { headers: hdr(D.main) });
        var row = rq.ok ? (await rq.json())[0] : null; if (row) p = Object.assign({}, row, p, { store_url: p.store_url || row.store_url, barcode: p.barcode || row.barcode, specs: p.specs != null ? p.specs : row.specs, compat: p.compat != null ? p.compat : row.compat });
      } catch (_) {}
    }
    var sp0 = o.specs != null ? o.specs : p.specs, out = forStore(sp0), myDesc = meta(sp0).desc;
    for (var i = 0; i < 3; i++) {
      var r = await fetch(D.store.url + '/rest/v1/gmt_store?id=eq.1&select=id,products,updated_at', { headers: hdr(D.store) });
      if (!r.ok) throw new Error('المتجر HTTP ' + r.status);
      var rec = (await r.json())[0]; if (!rec) throw new Error('سجلّ المتجر غير موجود');
      var prods = Array.isArray(rec.products) ? rec.products : [], sp = findStore(prods, p);
      if (!sp) return null;
      if (o.only) {                                   /* تعديلٌ محدَّد (صورة) بدل المواصفات */
        var part = o.only(sp); if (part === 'same') return { id: sp.id, same: true }; if (!part) return null;
        var nx = prods.map(function (x) { return x === sp ? Object.assign({}, x, part) : x; }), u2 = D.store.url + '/rest/v1/gmt_store?id=eq.1&select=id', b2 = { products: nx };
        if ('updated_at' in rec) { u2 += rec.updated_at ? '&updated_at=eq.' + encodeURIComponent(rec.updated_at) : '&updated_at=is.null'; b2.updated_at = new Date().toISOString(); }
        var w2 = await fetch(u2, { method: 'PATCH', headers: hdr(D.store, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(b2) });
        if (!w2.ok) throw new Error('حفظ المتجر HTTP ' + w2.status);
        var rr = await w2.json().catch(function () { return null; });
        if (Array.isArray(rr) && rr.length) { try { localStorage.removeItem('sbc_store'); } catch (_) {} return { id: sp.id, added: true }; }
        continue;
      }
      var upd = { specs: out, compat: o.compat || p.compat || sp.compat || '' }, desc = mergeDesc(myDesc, o.storeDesc == null ? sp.description : o.storeDesc);
      if (desc || o.storeDesc != null) upd.description = desc;
      var next = prods.map(function (x) { return x === sp ? Object.assign({}, x, upd) : x; });
      var url = D.store.url + '/rest/v1/gmt_store?id=eq.1&select=id', body = { products: next };
      if ('updated_at' in rec) { url += rec.updated_at ? '&updated_at=eq.' + encodeURIComponent(rec.updated_at) : '&updated_at=is.null'; body.updated_at = new Date().toISOString(); }
      var w = await fetch(url, { method: 'PATCH', headers: hdr(D.store, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(body) });
      if (!w.ok) throw new Error('حفظ المتجر HTTP ' + w.status);
      var rows2 = await w.json().catch(function () { return null; });
      if (Array.isArray(rows2) && rows2.length) { try { localStorage.removeItem('sbc_store'); } catch (_) {} return { id: sp.id, specs: out.length }; }
    }
    throw new Error('الكتالوج يتغيّر من جهةٍ أخرى أو الكتابة مرفوضة');
  }
  global.GMTSpecs = { rows: rows, meta: meta, forStore: forStore, forView: forView, clean: clean, tableHTML: tableHTML, pushToStore: pushToStore, addImageToStore: addImageToStore, _findStore: findStore, sure: sure, mergeDesc: mergeDesc, storeFields: storeFields };
})(typeof window !== 'undefined' ? window : this);
