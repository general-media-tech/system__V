/* ═════════════════════════════════════════════════════════════════════
   gmt-xlmap.js — «النظام يتعلّم شكل ملف كلّ مورّد» (A989–A991 م١ · TASK-B0564 · seq B1102)
   بلا ذكاء اصطناعي: كلّ ملف إكسل إله «بصمة» = عناوين أعمدته بعد التطبيع. أوّل مرّة النظام بيخمّن الأعمدة بالكلمات
   (عربي/إنجليزي/فواتير الصين PI)، وإنت بتصحّح من المعاينة ⇐ بينحفظ بـgmt_import_profiles ⇐ المرّة الجاية بيعرفه لحاله.

   صافٍ:  norm(s) · sig(headerRow) · findHeader(rows) · mapCols(headerRow) · docType(rows) · FIELDS
   قاعدة: load() · profileFor(sig) · save(sig, col, header, meta)
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTXlMap) return;
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/[$:：()（）\[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* الحقول وكلماتها — الترتيب مقصود: الأدقّ يحجز عموده قبل الأعمّ (wholesale⊃sale · item no⊃item) */
  var FIELDS = [
    ['model', 'الموديل', ['الموديل', 'موديل', 'model', 'model no', 'item no', 'item no.', 'art no', 'article no', 'sku no', 'ref', 'style no'], []],
    ['name', 'اسم المنتج', ['اسم المنتج', 'المنتج', 'الاسم', 'الوصف', 'name', 'product name', 'product', 'description', 'desc', 'goods', 'commodity', 'item', '品名', '描述'], ['item no', 'model', 'art no', 'picture', 'photo', 'image']],
    ['qty', 'الكمية', ['الكمية', 'كمية', 'العدد', 'qty', 'quantity', 'pcs', 'qty pcs', '数量'], ['carton', 'ctn', 'ctns', 'pcs/ctn', 'per carton']],
    ['whole', 'الجملة', ['الجملة', 'جملة', 'wholesale', 'whole'], []],
    ['min', 'الحدّ الأدنى للمبيع', ['الحد الأدنى للمبيع', 'الحد الأدنى', 'الحد الادنى', 'ادنى', 'min', 'minimum'], []],
    ['purchase', 'سعر الشراء', ['سعر الشراء', 'شراء', 'التكلفة', 'الكلفة', 'purchase', 'cost', 'unit price', 'u/price', 'fob price', 'fob', 'exw price', 'price usd', 'unit price usd', '单价'], ['amount', 'total', 'sale', 'selling', 'المبيع']],
    ['sale', 'سعر المبيع', ['المبيع', 'البيع', 'مبيع', 'sale', 'selling', 'retail', 'price'], ['wholesale', 'whole', 'الجملة', 'جملة', 'unit price', 'fob', 'exw', 'amount', 'total']],
    ['notes', 'ملاحظات', ['ملاحظات', 'ملاحظة', 'notes', 'note', 'remark', 'remarks', 'comment', '备注'], []],
    ['barcode', 'الباركود', ['الباركود', 'باركود', 'barcode', 'ean', 'upc'], []]
  ];
  function sig(row) { return (row || []).map(norm).filter(Boolean).join('|').slice(0, 600); }
  function isName(c) { var f = FIELDS[1]; return f[2].some(function (k) { return c === norm(k) || c.indexOf(norm(k)) >= 0; }) && !f[3].some(function (a) { return c.indexOf(norm(a)) >= 0; }); }
  function findHeader(rows) {
    for (var i = 0; i < Math.min((rows || []).length, 15); i++) { var cells = (rows[i] || []).map(norm); if (cells.some(function (c) { return c && isName(c); })) return i; }
    return -1;
  }
  function mapCols(row) {
    var hdr = (row || []).map(norm), taken = {}, col = {};
    var exact = function (keys) { return hdr.findIndex(function (c, i) { return !taken[i] && c && keys.some(function (k) { return c === norm(k); }); }); };
    var loose = function (keys, avoid) { return hdr.findIndex(function (c, i) { return !taken[i] && c && keys.some(function (k) { return c.indexOf(norm(k)) >= 0; }) && !avoid.some(function (a) { return c.indexOf(norm(a)) >= 0; }); }); };
    FIELDS.forEach(function (f) { var i = exact(f[2]); if (i < 0) i = loose(f[2], f[3]); if (i >= 0) taken[i] = 1; col[f[0]] = i; });
    return col;
  }
  /* نوع الملف من عناوينه: فاتورة · باكينج ليست · بيان جمركي · ملف عرض سعر (الباركود + سعر الشراء) */
  function docType(rows) {
    var txt = (rows || []).slice(0, 15).map(function (r) { return (r || []).map(norm).join(' | '); }).join(' \n ');
    var has = function (re) { return re.test(txt); };
    var pack = (has(/carton|ctns?\b|كرتون/) ? 1 : 0) + (has(/g\.?\s?w|gross|الوزن|n\.?\s?w|net weight/) ? 1 : 0) + (has(/cbm|m3|volume|الحجم|meas/) ? 1 : 0);
    var cust = (has(/hs ?code|h\.s|بند جمرك|البند الجمركي|tariff/) ? 1 : 0) + (has(/duty|رسم|الرسوم|customs value|القيمة الجمركية/) ? 1 : 0);
    if (cust >= 2) return 'customs';
    if (pack >= 2 && !has(/unit price|سعر الشراء|fob/)) return 'packing';
    if (has(/الباركود|barcode/) && has(/سعر الشراء|unit price/) && !has(/description|اسم المنتج/)) return 'rfq';
    return 'invoice';
  }

  /* ── القاعدة ── */
  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (M && M.url) return M; throw new Error('إعدادات القاعدة غير محمّلة'); }
  async function req(method, path, body, prefer) {
    var M = db(), h = { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
    var r = await fetch(M.url + '/rest/v1/' + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : '')); }
    var s = await r.text(); return s ? JSON.parse(s) : null;
  }
  var P = null;
  async function load() { var rows = await req('GET', 'gmt_import_profiles?select=*&limit=2000').catch(function () { return null; }); if (rows) { P = {}; rows.forEach(function (x) { P[x.sig] = x; }); } return P || {}; }
  function profileFor(s) { return P && s ? P[s] || null : null; }
  function who() { try { return (g.GMTRole && GMTRole.name && GMTRole.name()) || ''; } catch (_) { return ''; } }
  async function save(s, col, header, meta) {
    if (!s) return null; meta = meta || {};
    var old = profileFor(s), row = { sig: s, kind: meta.kind || 'invoice', col: col, header: header || null, supplier: meta.supplier || (old && old.supplier) || null, uses: ((old && old.uses) || 0) + 1, updated_by: who() || null, updated_at: new Date().toISOString() };
    var r = await req('POST', 'gmt_import_profiles?on_conflict=sig', row, 'resolution=merge-duplicates,return=representation');
    if (!P) P = {}; P[s] = (r && r[0]) || row; return P[s];
  }
  g.GMTXlMap = { norm: norm, sig: sig, findHeader: findHeader, mapCols: mapCols, docType: docType, FIELDS: FIELDS, load: load, profileFor: profileFor, save: save, _set: function (o) { P = o; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTXlMap;
})(typeof window !== 'undefined' ? window : globalThis);
