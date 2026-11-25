/* ═════════════════════════════════════════════════════════════════════
   gmt-poitem.js — بند فاتورة الشراء ⇐ بوّابة لملفّ المنتج (TASK-B0555 · المالك A988 «الربط الكامل بين فواتير الشراء وإدارة المنتجات»
   · طابور Q1 · seq B1092)
   «عند الضغط على أيّ منتج بالفاتورة تفتح نافذة تفاصيل … تصميم عمليّ لا يزدحم: الأساسي أوّلاً وأقسام تنفتح · تنبيهات جنب البند ·
    لا تكرّر بيانات المنتج — الفاتورة تحتفظ ببيانات الشراء الأصلية والمعلومات الحيّة من ملفّ المنتج · الربط العكسي: كلّ فواتيره».
   ما في نسخة من المنتج: «هالشراء» من الفاتورة (تاريخي) · «المنتج اليوم» من products (حيّ) · «كلّ مشترياته» من import_log.

   GMTPoItem.analyze(product, line, purchases, opt) ⇒ { completeness, missing[], alerts[], history[] }   (صافٍ · يُختبر)
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
        history.push({ invId: inv.id, inv: inv.inv_number || '#' + inv.id, supplier: inv.supplier || '', at: String(inv.inv_date || inv.created_at || '').slice(0, 10), qty: Number(it.qty) || 0, unit: r2(u), hs: (it.alloc && it.alloc.codes) || [], kg: it.alloc && it.alloc.kg && Number(it.qty) ? r2(it.alloc.kg / Number(it.qty) * 1000) / 1000 : null,
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
    if (p.id && !(Number(p.price) > 0)) alerts.push({ k: 'nosale', t: '🏷️ المنتج بلا سعر مبيع', fix: 'افتح «✏️ تعديل» واكتب سعر المبيع' });
    if (p.id && completeness < 60) alerts.push({ k: 'incomplete', t: '📋 ملفّ المنتج ناقص (' + completeness + '%)', fix: 'ناقص: ' + missing.join(' · ') });
    return { completeness: completeness, missing: missing, alerts: alerts, history: history };
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
      var line = o.line || null, A = analyze(p || {}, line, pur, { invId: o.invId, at: o.at });
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
        (p ? sec('📦 المنتج اليوم <span style="font-weight:700;color:#64748b;font-size:11.5px">(حيّ من ملفّ المنتج)</span>',
          kv('سعر المبيع', Number(p.price) > 0 ? Number(p.price) + '$' : '<span style="color:#b91c1c">فاضي</span>') + kv('الجملة', Number(p.wholesale_price) > 0 ? Number(p.wholesale_price) + '$' : '') + kv('الحدّ الأدنى', Number(p.net_cost) > 0 ? Number(p.net_cost) + '$' : '') + kv('الكلفة', Number(p.cost_price) > 0 ? Number(p.cost_price) + '$' : '<span style="color:#b91c1c">فاضية</span>') +
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
  g.GMTPoItem = { analyze: analyze, open: open, CHECK: CHECK, openDecl: openDecl, declCheck: declCheck };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPoItem;
})(typeof window !== 'undefined' ? window : globalThis);
