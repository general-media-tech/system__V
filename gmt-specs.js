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
  function rows(sp) {
    sp = asObj(sp);
    return Object.keys(sp).filter(function (k) { return k.indexOf('__') !== 0; })
      .map(function (k) { return { label: LABEL[k] || k, value: val(sp[k]) }; })
      .filter(function (r) { return r.value !== ''; });
  }
  function meta(sp) { sp = asObj(sp); return { desc: val(sp.__desc), brand: val(sp.__brand), model: val(sp.__model) }; }
  function forStore(sp) {
    var r = rows(sp), m = meta(sp), out = [];
    if (m.brand) out.push({ label: 'الماركة', value: m.brand });
    if (m.model) out.push({ label: 'الموديل', value: m.model });
    return out.concat(r);
  }
  /* جدولٌ بسيط بخطوطٍ فاتحة — يرث خطّ الصفحة ولونها ويصلح للهاتف (يلتفّ النصّ ولا يتجاوز العرض) */
  function tableHTML(sp, opts) {
    opts = opts || {};
    var list = Array.isArray(sp) ? sp : forStore(sp);
    var compat = String(opts.compat || '').trim();
    if (!list.length && !compat) return '';
    var html = '<table class="gmt-specs" style="width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed">' +
      list.map(function (r, i) {
        return '<tr style="background:' + (i % 2 ? 'transparent' : 'rgba(15,18,25,.035)') + '">' +
          '<th scope="row" style="width:38%;text-align:right;font-weight:800;padding:6px 8px;border-bottom:1px solid rgba(15,18,25,.08);vertical-align:top;overflow-wrap:anywhere">' + esc(r.label) + '</th>' +
          '<td style="padding:6px 8px;border-bottom:1px solid rgba(15,18,25,.08);overflow-wrap:anywhere">' + esc(r.value) + '</td></tr>';
      }).join('') + '</table>';
    if (compat) html += '<div style="margin-top:8px;font-size:12px;line-height:1.7;overflow-wrap:anywhere"><b>متوافق مع:</b> ' + esc(compat) + '</div>';
    return html;
  }
  global.GMTSpecs = { rows: rows, meta: meta, forStore: forStore, tableHTML: tableHTML };
})(typeof window !== 'undefined' ? window : this);
