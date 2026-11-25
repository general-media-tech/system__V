/* ═════════════════════════════════════════════════════════════════════
   gmt-poitem.js — بند فاتورة الشراء ⇐ بوّابة لملفّ المنتج (TASK-B0555 · المالك A988 «الربط الكامل بين فواتير الشراء وإدارة المنتجات»
   · طابور Q1 · seq B1092)
   «عند الضغط على أيّ منتج بالفاتورة تفتح نافذة تفاصيل … تصميم عمليّ لا يزدحم: الأساسي أوّلاً وأقسام تنفتح · تنبيهات جنب البند ·
    لا تكرّر بيانات المنتج — الفاتورة تحتفظ ببيانات الشراء الأصلية والمعلومات الحيّة من ملفّ المنتج · الربط العكسي: كلّ فواتيره».
   ما في نسخة من المنتج: «هالشراء» من الفاتورة (تاريخي) · «المنتج اليوم» من products (حيّ) · «كلّ مشترياته» من import_log.

   GMTPoItem.analyze(product, line, purchases, opt) ⇒ { completeness, missing[], alerts[], history[], known, suppliers[] }   (صافٍ · يُختبر)
   GMTPoItem.known(history, exceptInvId) ⇒ البند الجمركي/وزن/حجم القطعة من الفواتير السابقة (B1094)
   GMTPoItem.suppliers(history) ⇒ مقارنة الموردين بأرخص سعر أصلي (B1094)
   GMTPoItem.open(pid, { line, invId, invNumber })
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTPoItem) return;
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function arr(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return []; } } return Array.isArray(v) ? v : []; }
  function obj(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return {}; } } return v && typeof v === 'object' ? v : {}; }
  /* اكتمال ملفّ المنتج — شو موجود وشو ناقص (بلا اختراع: ناقص = فاضي) */
  var CHECK = [
    ['صورة', function (p) { return !!(p.image_url || arr(p.images).length); }],
    ['باركود', function (p) { return !!String(p.barcode || '').trim(); }],
    ['الماركة', function (p) { return !!String(p.brand || '').trim(); }],
    ['القسم', function (p) { return !!String(p.group_name || p.cat_main || '').trim(); }],
    ['سعر المبيع', function (p) { return Number(p.price) > 0; }],
    ['الكلفة', function (p) { return Number(p.cost_price) > 0; }],
    ['الحدّ الأدنى', function (p) { return Number(p.net_cost) > 0; }],
    ['الوصف والمواصفات', function (p) { var s = obj(p.specs); return !!(s.__desc || Object.keys(s).some(function (k) { return k.indexOf('__') !== 0; })); }],
    ['التوافقيات', function (p) { return !!(arr(p.compat).length || String(p.compat || '').trim().length > 2); }]
  ];
  /* (seq B1094) «منتج مكرّر بأكتر من فاتورة ⇐ استورد بنده الجمركي وحجمه من الفواتير السابقة»:
     known(history, exceptInvId) ⇒ { n, hs:[{code, n, invs}], kg, cbm } — البند الأكثر تكراراً أوّلاً · الوزن/الحجم للقطعة = الوسيط (ما بيتأثّر بفاتورة شاذّة) */
  function median(a) { a = a.filter(function (x) { return x > 0; }).sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function known(history, exceptInvId) {
    var hs = {}, kgs = [], cbms = [], n = 0;
    (history || []).forEach(function (h) {
      if (exceptInvId != null && String(h.invId) === String(exceptInvId)) return;
      var used = false;
      (h.hs || []).forEach(function (c) { c = String(c || '').trim(); if (!c) return; used = true; var x = hs[c] || (hs[c] = { code: c, n: 0, invs: [] }); x.n++; if (x.invs.indexOf(h.inv) < 0) x.invs.push(h.inv); });
      if (h.kg > 0) { kgs.push(h.kg); used = true; } if (h.cbm > 0) { cbms.push(h.cbm); used = true; }
      if (used) n++;
    });
    var list = Object.keys(hs).map(function (k) { return hs[k]; }).sort(function (a, b) { return b.n - a.n; });
    var kg = median(kgs), cbm = median(cbms);
    return { n: n, hs: list, kg: kg == null ? null : Math.round(kg * 1000) / 1000, cbm: cbm == null ? null : Math.round(cbm * 1e5) / 1e5 };
  }
  /* (seq B1094) «مقارنة بين كلّ الموردين مين أعطاني سعر أفضل — سعر الشراء الأصلي مو الكلفة الواصلة»:
     suppliers(history) ⇒ [{ name, best, last, avg, n, qty, lastAt, bestInv, isBest }] مرتّبة بأرخص سعر أصلي (orig_unit_price) */
  function supKey(s) { return String(s || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function suppliers(history) {
    var m = {};
    (history || []).forEach(function (h) {
      if (!(h.unit > 0)) return;
      var k = supKey(h.supplier) || '—', x = m[k] || (m[k] = { name: String(h.supplier || '').trim() || 'بلا مورّد', best: Infinity, last: null, lastAt: '', sum: 0, qty: 0, n: 0, bestInv: '' });
      if (h.unit < x.best) { x.best = h.unit; x.bestInv = h.inv; }
      if (!x.lastAt || h.at > x.lastAt) { x.lastAt = h.at; x.last = h.unit; }
      x.sum += h.unit * (h.qty || 1); x.qty += (h.qty || 1); x.n++;
    });
    var out = Object.keys(m).map(function (k) { var x = m[k]; return { name: x.name, best: r2(x.best), last: x.last, lastAt: x.lastAt, avg: x.qty ? r2(x.sum / x.qty) : null, n: x.n, qty: x.qty, bestInv: x.bestInv }; })
      .sort(function (a, b) { return a.best - b.best || (b.lastAt > a.lastAt ? 1 : -1); });
    if (out.length) out[0].isBest = true;
    return out;
  }
  function analyze(p, line, purchases, opt) {
    opt = opt || {}; p = p || {};
    var missing = CHECK.filter(function (c) { return !c[1](p); }).map(function (c) { return c[0]; });
    var completeness = Math.round((CHECK.length - missing.length) * 100 / CHECK.length);
    var history = [];
    (purchases || []).forEach(function (inv) {
      if (!inv || /cancel/i.test(inv.status || '')) return;
      arr(inv.items_snapshot).forEach(function (it) {
        if (!it || String(it.id || '') !== String(p.id)) return;
        var u = Number(it.orig_unit_price) > 0 ? Number(it.orig_unit_price) : Number(it.unit_price) || 0;
        history.push({ invId: inv.id, inv: inv.inv_number || '#' + inv.id, supplier: inv.supplier || '', at: String(inv.inv_date || inv.created_at || '').slice(0, 10), qty: Number(it.qty) || 0, unit: r2(u), hs: (it.alloc && it.alloc.codes) || [], kg: it.alloc && it.alloc.kg && Number(it.qty) ? r2(it.alloc.kg / Number(it.qty) * 1000) / 1000 : null, cbm: it.alloc && it.alloc.cbm && Number(it.qty) ? Math.round(it.alloc.cbm / Number(it.qty) * 1e5) / 1e5 : null,
          arrived: inv.inv_type === 'instant' || inv.status === 'arrived', type: inv.inv_type || '' });
      });
    });
    history.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var alerts = [];
    if (line) {
      var lu = Number(line.orig_unit_price) > 0 ? Number(line.orig_unit_price) : Number(line.unit_price != null ? line.unit_price : line.unitPrice) || 0;
      if (!p.id) alerts.push({ k: 'unlinked', t: '🔗 البند مو مربوط بمنتج بالجرد', fix: 'اربطه من «تدقيق الفواتير والجرد» أو عدّل الفاتورة واختر المنتج' });
      if (!(lu > 0) && !/هدية|كومبو|مجان/i.test(String(line.notes || ''))) alerts.push({ k: 'zero', t: '0️⃣ سعر الشراء 0', fix: 'اكتب سعر الشراء الحقيقي — أو اكتب «هدية» بملاحظة البند' });
      var prev = history.filter(function (h) { return String(h.invId) !== String(opt.invId) && h.unit > 0 && (!opt.at || h.at <= opt.at); })[0];
      if (prev && lu > 0 && lu > prev.unit * 1.05) alerts.push({ k: 'pricier', t: '📈 السعر أعلى من آخر شراء (' + prev.unit + ' بـ' + prev.inv + ' ⇐ ' + r2(lu) + ')', fix: 'تأكّد من السعر مع المورّد — أو هيك صار السعر فعلاً' });
    }
    /* (TASK-B0556 · A988 §6) «بند جمركي يحتاج مراجعة»: مختلف عن آخر شراء · ووزن القطعة بعيد عن آخر مرّة (>25%) */
    if (line && line.alloc) {
      var hsNow = (line.alloc.codes || []).join(','), q0 = Number(line.qty) || 0, kgNow = q0 && line.alloc.kg ? line.alloc.kg / q0 : null;
      var prevH = history.filter(function (h) { return String(h.invId) !== String(opt.invId) && (h.hs || []).length; })[0];
      if (prevH && hsNow && prevH.hs.join(',') !== hsNow) alerts.push({ k: 'hs', t: '🛃 البند الجمركي مختلف عن آخر مرّة (' + prevH.hs.join(',') + ' بـ' + prevH.inv + ' ⇐ ' + hsNow + ')', fix: 'راجع مع المخلّص — نفس المنتج لازم يكون بنفس البند' });
      var prevK = history.filter(function (h) { return String(h.invId) !== String(opt.invId) && h.kg; })[0];
      if (prevK && kgNow && Math.abs(kgNow - prevK.kg) / prevK.kg > 0.25) alerts.push({ k: 'kg', t: '⚖️ وزن القطعة مختلف عن آخر مرّة (' + prevK.kg + ' ⇐ ' + r2(kgNow * 1000) / 1000 + ' كغ)', fix: 'تأكّد من الباكينج ليست — ممكن خطأ بعدد القطع أو الوزن' });
      if (!hsNow) alerts.push({ k: 'nohs', t: '🛃 بلا بند جمركي بالبيان', fix: 'كرتونته بملف المخلّص بلا بند — راجعه' });
    }
    /* (seq B1094) مورّد تاني أعطى سعراً أصليّاً أرخص من هالشراء */
    if (line) {
      var lu2 = Number(line.orig_unit_price) > 0 ? Number(line.orig_unit_price) : Number(line.unit_price != null ? line.unit_price : line.unitPrice) || 0;
      var mine = history.filter(function (h) { return String(h.invId) === String(opt.invId); })[0], myS = supKey(mine ? mine.supplier : opt.supplier || '');
      var other = suppliers(history).filter(function (x) { return supKey(x.name) !== myS; })[0];
      if (other && lu2 > 0 && other.best < lu2 * 0.97) alerts.push({ k: 'cheaper', t: '🏆 «' + other.name + '» أعطاك أرخص: ' + other.best + ' (' + other.bestInv + ') ⇐ هلّق ' + r2(lu2), fix: 'قارن بقسم «مقارنة الموردين» — السعر الأصلي قبل التكاليف' });
    }
    if (p.id && !(Number(p.price) > 0)) alerts.push({ k: 'nosale', t: '🏷️ المنتج بلا سعر مبيع', fix: 'افتح «✏️ تعديل» واكتب سعر المبيع' });
    if (p.id && completeness < 60) alerts.push({ k: 'incomplete', t: '📋 ملفّ المنتج ناقص (' + completeness + '%)', fix: 'ناقص: ' + missing.join(' · ') });
    return { completeness: completeness, missing: missing, alerts: alerts, history: history, known: known(history, opt.invId), suppliers: suppliers(history) };
  }

  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (M && M.url) return M; throw new Error('إعدادات القاعدة غير محمّلة'); }
  async function get(path) { var M = db(), r = await fetch(M.url + '/rest/v1/' + path, { headers: { apikey: M.key, Authorization: 'Bearer ' + M.key }, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  var SPEC_SKIP = /^__/;
  async function open(pid, o) {
    o = o || {};
    var old = document.getElementById('gmt-poitem'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'gmt-poitem'; w.setAttribute('data-keep-fab', '1');
    w.style.cssText = 'position:fixed;inset:0;z-index:99995;background:rgba(15,18,25,.5);display:flex;align-items:flex-start;justify-content:center;padding:3vh 10px;overflow:auto;direction:rtl;font-family:inherit';
    w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:720px;padding:16px;text-align:center;color:#64748b">جارٍ التحميل…</div>';
    document.body.appendChild(w);
    w.addEventListener('click', function (e) { if (e.target === w || e.target.closest('[data-pi-x]')) w.remove(); var s = e.target.closest('[data-pi-sec]'); if (s) { var b = s.nextElementSibling; b.style.display = b.style.display === 'none' ? '' : 'none'; s.querySelector('i').textContent = b.style.display === 'none' ? '▸' : '▾'; } });
    try {
      var p = pid ? ((await get('products?id=eq.' + encodeURIComponent(pid) + '&select=*')) || [])[0] : null;
      var cols = (await get('inv_columns?select=key_name,display_name,include_in_total&order=sort_order.asc').catch(function () { return []; })) || [];
      var pur = pid ? ((await get('import_log?select=id,inv_number,inv_type,supplier,inv_date,status,items_snapshot,created_at&order=created_at.desc&limit=1000').catch(function () { return []; })) || []) : [];
      var line = o.line || null, A = analyze(p || {}, line, pur, { invId: o.invId, at: o.at, supplier: o.supplier });
      var stock = cols.filter(function (c) { return c.include_in_total; }).map(function (c) { return { n: c.display_name || c.key_name, q: Number(p && p[c.key_name]) || 0 }; }).filter(function (x) { return x.q; });
      var total = stock.reduce(function (s, x) { return s + x.q; }, 0), specs = obj(p && p.specs);
      var sec = function (title, html, openIt) { return '<div data-pi-sec style="cursor:pointer;font-weight:900;font-size:13.5px;margin-top:10px;padding:7px 0;border-top:1px solid #eef1f5"><i style="font-style:normal">' + (openIt ? '▾' : '▸') + '</i> ' + title + '</div><div style="font-size:12.5px;line-height:1.9;' + (openIt ? '' : 'display:none') + '">' + html + '</div>'; };
      var kv = function (k, v) { return v === '' || v == null ? '' : '<div><b>' + esc(k) + ':</b> ' + v + '</div>'; };
      var lu = line ? (Number(line.orig_unit_price) > 0 ? Number(line.orig_unit_price) : Number(line.unit_price != null ? line.unit_price : line.unitPrice) || 0) : 0;
      var col = A.completeness >= 80 ? '#15803d' : A.completeness >= 60 ? '#b45309' : '#b91c1c';
      w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:720px;padding:14px" data-poitem>' +
        '<div style="display:flex;gap:10px;align-items:flex-start">' + (p && p.image_url ? '<img src="' + esc(p.image_url) + '" alt="" style="width:72px;height:72px;object-fit:contain;border-radius:12px;background:#f8fafc;flex:none" onerror="this.style.visibility=\'hidden\'">' : '<div style="width:72px;height:72px;border-radius:12px;background:#f1f5f9;display:grid;place-items:center;font-size:26px;flex:none">📦</div>') +
        '<div style="flex:1;min-width:0"><b style="font-size:15.5px;display:block">' + esc((p && p.name) || (line && line.name) || 'بند غير مربوط') + '</b>' +
        '<div style="font-size:12px;color:#64748b">' + [p && p.brand, p && (p.group_name || p.cat_main), p && p.barcode ? '<span dir="ltr">' + esc(p.barcode) + '</span>' : ''].filter(Boolean).map(function (x) { return String(x).indexOf('<span') === 0 ? x : esc(x); }).join(' · ') + '</div>' +
        (p ? '<div style="margin-top:4px;font-size:12px;font-weight:900;color:' + col + '">📋 اكتمال الملفّ ' + A.completeness + '%' + (A.missing.length ? ' <span style="font-weight:700;color:#64748b">— ناقص: ' + esc(A.missing.join(' · ')) + '</span>' : '') + '</div>' : '') + '</div>' +
        '<button type="button" data-pi-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
        (A.alerts.length ? '<div data-pi-alerts style="margin-top:10px">' + A.alerts.map(function (a) { return '<div data-pi-alert="' + a.k + '" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:6px 10px;margin-top:5px;font-size:12.5px"><b>' + esc(a.t) + '</b><div style="color:#475569">↳ ' + esc(a.fix) + '</div></div>'; }).join('') + '</div>' : '') +
        (line ? sec('🧾 هالشراء' + (o.invNumber ? ' — ' + esc(o.invNumber) : '') + ' <span style="font-weight:700;color:#64748b;font-size:11.5px">(كما انسجّل وقت الشراء — ما بيتغيّر)</span>',
          kv('الكمّية', esc(line.qty)) + kv('سعر الشراء', lu ? lu.toFixed(2) + '$' : '—') + kv('المجموع', lu && line.qty ? (lu * Number(line.qty)).toFixed(2) + '$' : '') + kv('الاسم بالفاتورة', esc(line.name || '')) + kv('ملاحظة', esc(line.notes || '')), true) : '') +
        (line && line.alloc ? sec('🛃 الجمارك والشحن <span style="font-weight:700;color:#64748b;font-size:11.5px">(من البيان الجمركي وقت الشراء)</span>',
          kv('البند الجمركي', esc((line.alloc.codes || []).join(' · ') || '—')) + kv('الكرتونة', esc((line.alloc.ctn || []).join(' · '))) + kv('الوزن', line.alloc.kg ? esc(line.alloc.kg) + ' كغ' + (Number(line.qty) ? ' (' + r2(line.alloc.kg / Number(line.qty) * 1000) / 1000 + ' للقطعة)' : '') : '') +
          kv('حصّته من الجمارك', line.alloc.customs != null ? Number(line.alloc.customs).toFixed(2) + '$' : '') + kv('حصّته من الشحن', line.alloc.ship != null ? Number(line.alloc.ship).toFixed(2) + '$' : ''), false) : '') +
        (A.known && A.known.n ? sec('📥 الجمارك والحجم من فواتيره السابقة <span style="font-weight:700;color:#64748b;font-size:11.5px">(' + A.known.n + ' فاتورة)</span>',
          (A.known.hs.length ? kv('البند الجمركي', A.known.hs.map(function (x, i) { return '<b dir="ltr" style="' + (i ? 'color:#64748b' : 'color:#065f46') + '">' + esc(x.code) + '</b> <span style="color:#64748b;font-size:11px">(' + x.n + '× · ' + esc(x.invs.slice(0, 3).join('، ')) + ')</span>'; }).join(' · ') +
            (line && line.alloc && (line.alloc.codes || []).length && (line.alloc.codes || []).join(',') !== A.known.hs[0].code ? ' <span style="color:#b45309;font-weight:900">≠ هالفاتورة ' + esc(line.alloc.codes.join(',')) + '</span>' : '')) : '') +
          kv('وزن القطعة', A.known.kg ? A.known.kg + ' كغ' + (line && Number(line.qty) ? ' <span style="color:#64748b">(لـ' + esc(line.qty) + ' قطعة ≈ ' + r2(A.known.kg * Number(line.qty)) + ' كغ)</span>' : '') : '') +
          kv('حجم القطعة', A.known.cbm ? A.known.cbm + ' م³' + (line && Number(line.qty) ? ' <span style="color:#64748b">(لـ' + esc(line.qty) + ' قطعة ≈ ' + Math.round(A.known.cbm * Number(line.qty) * 1000) / 1000 + ' م³)</span>' : '') : '') +
          ((!line || !line.alloc || !(line.alloc.codes || []).length) ? '<div data-pi-known-use style="margin-top:6px;font-size:11.5px;color:#065f46;font-weight:800">💡 هالبند بلا بيان جمركي بهالفاتورة — هاي القيم المعروفة من قبل؛ بتطلع كمان بمعاينة «📦 الباكينج ليست» جنب كلّ بند.</div>' : ''),
          !(line && line.alloc && (line.alloc.codes || []).length)) : '') +
        (A.suppliers && A.suppliers.length ? sec('🏆 مقارنة الموردين <span style="font-weight:700;color:#64748b;font-size:11.5px">(سعر الشراء الأصلي — بلا تكاليف)</span>',
          '<table data-pi-sup style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:4px;text-align:right">المورّد</th><th>أرخص</th><th>آخر سعر</th><th>المتوسّط</th><th>مرّات</th><th>آخر شراء</th></tr>' +
          A.suppliers.map(function (x) { return '<tr style="border-bottom:1px solid #f1f5f9' + (x.isBest ? ';background:#ecfdf5' : '') + '"><td style="padding:4px;font-weight:900">' + (x.isBest ? '🏆 ' : '') + esc(x.name) + '</td><td style="text-align:center;font-weight:900;color:' + (x.isBest ? '#065f46' : '#0f1219') + '">' + x.best.toFixed(2) + '<div style="font-size:10px;color:#64748b;font-weight:600">' + esc(x.bestInv) + '</div></td><td style="text-align:center">' + (x.last != null ? x.last.toFixed(2) : '—') + '</td><td style="text-align:center">' + (x.avg != null ? x.avg.toFixed(2) : '—') + '</td><td style="text-align:center">' + x.n + '</td><td style="text-align:center">' + esc(x.lastAt) + '</td></tr>'; }).join('') + '</table>' +
          (A.suppliers.length > 1 ? '<div style="font-size:11.5px;color:#475569;margin-top:4px">الفرق بين الأرخص والأغلى: ' + r2(A.suppliers[A.suppliers.length - 1].best - A.suppliers[0].best) + '$ للقطعة</div>' : '<div style="font-size:11.5px;color:#64748b;margin-top:4px">مورّد واحد لهالمنتج لهلّق.</div>'),
          A.suppliers.length > 1) : '') +
        (p ? sec('📦 المنتج اليوم <span style="font-weight:700;color:#64748b;font-size:11.5px">(حيّ من ملفّ المنتج)</span>',
          kv('سعر المبيع', Number(p.price) > 0 ? Number(p.price) + '$' : '<span style="color:#b91c1c">فاضي</span>') + kv('الجملة', Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) + '$' : '') + kv('الحدّ الأدنى للمبيع', Number(p.net_cost) > 0 ? Number(p.net_cost) + '$' : '') + kv('سعر التكلفة الحقيقي', Number(p.cost_price) > 0 ? Number(p.cost_price) + '$' : '<span style="color:#b91c1c">فاضية</span>') +
          kv('المخزون', total + (stock.length ? ' <span style="color:#64748b">(' + esc(stock.map(function (x) { return x.n + ' ' + x.q; }).join(' · ')) + ')</span>' : '')), true) : '') +
        (p ? sec('🛒 كلّ مشترياته (' + A.history.length + ')', A.history.length ? '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:4px;text-align:right">الفاتورة</th><th style="text-align:right">المورّد</th><th>التاريخ</th><th>الكمّية</th><th>السعر</th><th>الحالة</th></tr>' +
          A.history.map(function (h) { return '<tr style="border-bottom:1px solid #f1f5f9' + (String(h.invId) === String(o.invId) ? ';background:#fef2f2' : '') + '"><td style="padding:4px"><a href="purchase.html?open=' + encodeURIComponent(h.invId) + '" style="font-weight:900;color:#1f348f">' + esc(h.inv) + '</a></td><td>' + esc(h.supplier) + '</td><td style="text-align:center">' + esc(h.at) + '</td><td style="text-align:center">' + h.qty + '</td><td style="text-align:center">' + (h.unit ? h.unit.toFixed(2) : '—') + '</td><td style="text-align:center">' + (h.arrived ? '✅ وصل' : '🚢 بالطريق') + '</td></tr>'; }).join('') + '</table>' : 'ما في فواتير شراء مربوطة.', false) : '') +
        (p ? sec('🔧 المواصفات', (specs.__desc ? '<div style="margin-bottom:4px">' + esc(specs.__desc) + '</div>' : '') + Object.keys(specs).filter(function (k) { return !SPEC_SKIP.test(k); }).map(function (k) { return kv(k, esc(typeof specs[k] === 'object' ? JSON.stringify(specs[k]) : specs[k])); }).join('') || 'ما في مواصفات مسجّلة.', false) : '') +
        (p ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><a href="inventory.html?pid=' + encodeURIComponent(p.id) + '&view=det" target="_blank" rel="noopener" style="background:#0f1219;color:#fff;border-radius:10px;padding:8px 12px;font-weight:900;font-size:13px;text-decoration:none">📂 ملفّ المنتج الكامل</a>' +
          '<a href="inventory.html?pid=' + encodeURIComponent(p.id) + '&view=mov" target="_blank" rel="noopener" style="border:1.5px solid #e5e7eb;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;text-decoration:none;color:#0f1219">📜 الحركة</a>' +
          '<a href="inventory.html?pid=' + encodeURIComponent(p.id) + '&view=edit" target="_blank" rel="noopener" style="border:1.5px solid #e5e7eb;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px;text-decoration:none;color:#0f1219">✏️ تعديل المنتج</a></div>' : '') +
        '</div>';
    } catch (e) { w.innerHTML = '<div style="background:#fff;border-radius:14px;padding:16px">تعذّر التحميل: ' + esc(e.message) + '</div>'; }
    return w;
  }
  /* 🛃 البيان الجمركي للفاتورة (TASK-B0556 · A1004 P5): الكراتين بالبند والوزن والحجم والرسم · المصرّح به مقابل الجمارك المدفوعة على الفاتورة */
  function declCheck(inv) {
    var d = obj(inv.customs_decl), t = d.totals || {}, paid = r2(inv.cost_customs), out = [];
    if (t.duty && paid && Math.abs(t.duty - paid) / Math.max(t.duty, paid) > 0.02) out.push('الرسوم المصرّح بها بالبيان ' + r2(t.duty) + ' ≠ الجمارك المسجّلة على الفاتورة ' + paid + ' (فرق ' + r2(paid - t.duty) + ')');
    if (t.noHs) out.push(t.noHs + ' كرتونة بلا بند جمركي');
    var unmatched = (d.cartons || []).filter(function (c) { return !(c.items || []).length; }).length; if (unmatched) out.push(unmatched + ' كرتونة ما انربطت بأيّ بند بالفاتورة');
    return out;
  }
  function openDecl(inv) {
    var d = obj(inv.customs_decl), t = d.totals || {}, chk = declCheck(inv), old = document.getElementById('gmt-decl'); if (old) old.remove();
    var names = {}; arr(inv.items_snapshot).forEach(function (it) { if (it && it.id) names[String(it.id)] = it.name; });
    var w = document.createElement('div'); w.id = 'gmt-decl'; w.setAttribute('data-keep-fab', '1');
    w.style.cssText = 'position:fixed;inset:0;z-index:99994;background:rgba(15,18,25,.5);display:flex;align-items:flex-start;justify-content:center;padding:3vh 10px;overflow:auto;direction:rtl;font-family:inherit';
    w.innerHTML = '<div data-decl style="background:#fff;border-radius:18px;width:100%;max-width:860px;padding:14px">' +
      '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:16px">🛃 البيان الجمركي — ' + esc(inv.inv_number || '') + '</b><button type="button" data-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
      '<div style="font-size:12px;color:#64748b">من ملف المخلّص «' + esc(d.file || '') + '» · ' + esc(String(d.at || '').slice(0, 10)) + ' — القيمة المصرّح بها للجمارك مو هي الكلفة</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">' + [['الكراتين', t.cartons || 0], ['الوزن', (t.kg || 0) + ' كغ'], ['الحجم', (t.cbm || 0) + ' م³'], ['الرسوم المصرّح بها', r2(t.duty || 0) + '$'], ['الجمارك على الفاتورة', r2(inv.cost_customs || 0) + '$']].map(function (c) { return '<div style="flex:1;min-width:110px;background:#f8fafc;border-radius:12px;padding:7px 10px"><div style="font-size:11px;color:#64748b;font-weight:800">' + c[0] + '</div><b dir="ltr">' + esc(c[1]) + '</b></div>'; }).join('') + '</div>' +
      (chk.length ? '<div data-decl-warn style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:7px 10px;font-size:12.5px;font-weight:700;margin-bottom:8px">⚠️ ' + chk.map(esc).join('<br>⚠️ ') + '</div>' : '<div style="color:#15803d;font-weight:800;font-size:12.5px;margin-bottom:8px">✅ البيان مطابق للفاتورة</div>') +
      '<div style="max-height:55vh;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:4px">كرتونة</th><th style="text-align:right">الوصف</th><th>البند الجمركي</th><th>الوزن</th><th>الحجم</th><th>الرسم</th><th style="text-align:right">البنود</th></tr>' +
      (d.cartons || []).map(function (c) { return '<tr style="border-bottom:1px solid #f1f5f9' + (!c.hs ? ';background:#fef2f2' : '') + '"><td style="text-align:center;padding:4px">' + c.no + '</td><td>' + esc(c.desc) + '</td><td style="text-align:center" dir="ltr">' + esc(c.hs || '—') + '</td><td style="text-align:center">' + (c.kg || '') + '</td><td style="text-align:center">' + (c.cbm || '') + '</td><td style="text-align:center">' + (c.duty ? r2(c.duty) : '') + '</td><td>' + esc((c.items || []).map(function (id) { return names[id] || id; }).join(' · ') || '— ما انربطت') + '</td></tr>'; }).join('') + '</table></div></div>';
    document.body.appendChild(w);
    w.addEventListener('click', function (e) { if (e.target === w || e.target.closest('[data-x]')) w.remove(); });
    return w;
  }
  g.GMTPoItem = { analyze: analyze, open: open, CHECK: CHECK, openDecl: openDecl, declCheck: declCheck, known: known, suppliers: suppliers };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPoItem;
})(typeof window !== 'undefined' ? window : globalThis);
