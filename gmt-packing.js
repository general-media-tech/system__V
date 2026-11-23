/* ═══════════════════════════════════════════════════════════════════════════
   gmt-packing.js — «الباكينج ليست وملف الجمارك (الأوبريشن)» ⇒ الكلفة الواصلة لكلّ بند (TASK-A0583 · المالك seq A1018)
   «لما أرفع ملف الفاتورة ثم ملفّي الأوبريشن والباكينج ليست … هو لحاله بيتصرّف كأنّك إنت عم تتصرّف»
   ─────────────────────────────────────────────────────────────────────────────
   هذا تدريبُ ما كان يُعمل يدوياً (TASK-B0519 · IMP-2026-0007/0008) على شكل محرّكٍ ثابت في النظام:
     ① parse(rows, merges)  يقرأ ورقة المخلّص/الشاحن بأيّ ترتيب أعمدة (العناوين بالعربي أو الإنجليزي):
        الوصف · عدد الطرود · نوع الطرد · عدد القطع · الحجم · الوزن · البند الجمركي · الرسم · قيمة الرسوم · الإجمالي · الماركة · المنشأ
        والخلايا المدموجة = **كرتونة واحدة** فيها عدّة أسطر (منتجات) ⇒ الكرتونة = وحدة الوزن/الحجم/الرسم
     ② autoMap(lines, items)  يطابق كلّ سطر بالبند الأقرب في الفاتورة (الاسم/الأسماء البديلة + تساوي الكمية) — والموظّف يراجع
     ③ allocate(cartons, map, items, costs)  الجمارك على الكراتين **بنسبة رسمها** (الوزن × الرسم) ثمّ داخل الكرتونة **بقيمة البند** ·
        الشحن **بالحجم** إن وُجد وإلّا **بالوزن** · النقل/المحلّي/التحويل **بالقيمة** · الأصول (asset) خارج التوزيع
   يعمل في المتصفّح (purchase.html) وفي Node (الاختبارات).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  function N(v) { if (v == null || v === '') return null; var s = String(v).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/,/g, '').trim(); var n = parseFloat(s); return isFinite(n) ? n : null; }
  function T(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function AR(s) { return String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }

  /* ── الأعمدة: مطابقة العنوان (الأدقّ أوّلاً) ── */
  var COLS = [
    ['detail', /الطرود\s*التفصيل|detail/i], ['pkgs', /عدد\s*الطرود|packages|no\.?\s*of\s*(ctn|pkg)|ctns?\b/i], ['ptype', /نوع\s*الطرد|package\s*type|unit\s*type/i],
    ['pieces', /عدد\s*القطع|pcs|pieces|quantity|qty/i], ['cbm', /الحجم|cbm|volume|m3|م3/i], ['kg', /الوزن|weight|kgs?\b|g\.?w/i],
    ['hs', /البند|hs\s*code|h\.s|tariff/i], ['dutyTotal', /اجمالي\s*الرسوم|إجمالي\s*الرسوم|total\s*dut/i], ['dutyVal', /قيمة\s*الرسوم|duty\s*val/i], ['rate', /^\s*الرسم\s*$|rate|duty\s*%|نسبة/i],
    ['brand', /الماركة|brand/i], ['origin', /منشا|منشأ|origin/i], ['descAr', /نوع\s*البضاعة|الوصف\s*العربي|البيان/i], ['descEn', /goods\s*description|description|item|product/i]
  ];
  function headerOf(rows) {
    for (var r = 0; r < Math.min(rows.length, 15); r++) {
      var map = {}, hit = 0, row = rows[r] || [];
      for (var c = 0; c < row.length; c++) {
        var h = T(row[c]); if (!h) continue;
        for (var k = 0; k < COLS.length; k++) if (!(COLS[k][0] in map) && COLS[k][1].test(h)) { map[COLS[k][0]] = c; hit++; break; }
      }
      if (hit >= 4 && ('pieces' in map) && (('kg' in map) || ('hs' in map))) return { row: r, map: map };
    }
    return null;
  }
  /* merges: [{r1,c1,r2,c2}] (0-based) — الخليّة المدموجة تأخذ قيمة أعلاها · والدمج الرأسيّ على عمود الوزن/البند = كرتونة */
  function parse(rows, merges) {
    var H = headerOf(rows); if (!H) return { ok: false, error: 'لم أجد صفّ العناوين (عدد القطع · الوزن/البند الجمركي)' };
    var m = H.map, lines = [], cartons = [], first = H.row + 1;
    var block = {};   // صفّ ⇒ رقم كرتونة (من الدمج الرأسيّ على أعمدة الوزن أو البند أو الرسم)
    (merges || []).forEach(function (g2) {
      if (g2.c1 !== g2.c2 || g2.r2 <= g2.r1) return;
      if (g2.c1 === m.kg || g2.c1 === m.hs || g2.c1 === m.rate || g2.c1 === m.detail) for (var r = g2.r1; r <= g2.r2; r++) if (!(r in block)) block[r] = g2.r1;
    });
    var dutyTotal = null;
    for (var r = first; r < rows.length; r++) {
      var row = rows[r] || [], get = function (k) { return k in m ? row[m[k]] : null; };
      var desc = T(get('descEn')), descAr = T(get('descAr')), pcs = N(get('pieces'));
      if (!desc && !descAr && pcs == null) continue;
      if (/total|المجموع|الاجمالي/i.test(desc + ' ' + descAr) && pcs == null) continue;
      var key = (r in block) ? block[r] : r, ctn = cartons.find(function (c) { return c.key === key; });
      if (!ctn) {
        ctn = { key: key, no: cartons.length + 1, kg: N(get('kg')), cbm: N(get('cbm')), hs: T(get('hs')), rate: N(get('rate')), dutyVal: N(get('dutyVal')), detail: N(get('detail')), ptype: T(get('ptype')), lines: [] };
        cartons.push(ctn);
      }
      if (dutyTotal == null && N(get('dutyTotal')) != null) dutyTotal = N(get('dutyTotal'));
      var ln = { row: r + 1, desc: desc, descAr: descAr, pieces: pcs || 0, brand: T(get('brand')), origin: T(get('origin')), ctn: ctn.no };
      ctn.lines.push(lines.length); lines.push(ln);
    }
    cartons.forEach(function (c) { if (c.dutyVal == null && c.kg != null && c.rate != null) c.dutyVal = Math.round(c.kg * c.rate * 100) / 100; });
    var sum = function (k) { return cartons.reduce(function (s, c) { return s + (c[k] || 0); }, 0); };
    return { ok: true, header: H.row + 1, lines: lines, cartons: cartons, totals: { cartons: cartons.length, pieces: lines.reduce(function (s, l) { return s + l.pieces; }, 0), kg: Math.round(sum('kg') * 100) / 100, cbm: Math.round(sum('cbm') * 1000) / 1000, duty: Math.round(sum('dutyVal') * 100) / 100, dutyTotal: dutyTotal } };
  }

  /* ── المطابقة التلقائيّة: كلمات الوصف ⇄ اسم البند/أسمائه البديلة + الكمية ── */
  var STOP = { the: 1, and: 1, for: 1, with: 1, of: 1, a: 1, to: 1, in: 1, set: 1, pcs: 1, pc: 1, new: 1 };
  function toks(s) { return AR(s).replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ').filter(function (w) { return w.length >= 2 && !STOP[w]; }); }
  function sim(line, item) {
    var a = toks(line.desc + ' ' + line.descAr), b = toks([item.name, item.alt_names, item.name_en].filter(Boolean).join(' '));
    if (!a.length || !b.length) return 0;
    var bs = {}; b.forEach(function (w) { bs[w] = 1; });
    var hit = 0; a.forEach(function (w) { if (bs[w]) hit += /\d/.test(w) ? 2 : 1; else if (w.length >= 4 && b.some(function (x) { return x.length >= 4 && (x.indexOf(w) === 0 || w.indexOf(x) === 0); })) hit += 0.5; });
    return hit / Math.sqrt(a.length * Math.max(3, Math.min(b.length, 12)));
  }
  function autoMap(lines, items) {
    var pairs = [];
    lines.forEach(function (l, li) { items.forEach(function (it, ii) { if (it.asset) return; var s = sim(l, it); if (Number(it.qty) === Number(l.pieces)) s += 0.35; if (s > 0.25) pairs.push([s, li, ii]); }); });
    pairs.sort(function (x, y) { return y[0] - x[0]; });
    var map = lines.map(function () { return []; }), usedItem = {}, left = lines.map(function (l) { return l.pieces; });
    pairs.forEach(function (p) {
      var li = p[1], ii = p[2]; if (usedItem[ii] || left[li] <= 0) return;
      var q = Number(items[ii].qty) || 0; if (q > left[li] + 0.001 && map[li].length) return;
      map[li].push(ii); usedItem[ii] = 1; left[li] -= q;
    });
    /* جولة ثانية: سطر الباكينج قد يجمع عدّة بنود فاتورة («Propeller guard ×30» = ثلاثة بنود ×10 لدروناتٍ مختلفة) —
       كلّ بندٍ بقي ⇐ أقرب سطرٍ ما زال فيه قطعٌ تكفيه · ثمّ أقرب سطرٍ مطلقاً (يُعلَّم «الكمية») */
    items.forEach(function (it, ii) {
      if (usedItem[ii] || it.asset) return;
      var q = Number(it.qty) || 0, best = -1, bs = 0.12, any = -1, as = 0.2;
      lines.forEach(function (l, li) { var s = sim(l, it); if (left[li] >= q - 0.001 && s > bs) { bs = s; best = li; } if (s > as) { as = s; any = li; } });
      var li2 = best >= 0 ? best : any; if (li2 < 0) return;
      map[li2].push(ii); usedItem[ii] = 1; left[li2] -= q;
    });
    var conf = lines.map(function (l, li) { var q = map[li].reduce(function (s, ii) { return s + (Number(items[ii].qty) || 0); }, 0); return map[li].length && Math.abs(q - l.pieces) < 0.001 ? 'ok' : map[li].length ? 'qty' : 'none'; });
    var unmapped = items.map(function (it, ii) { return ii; }).filter(function (ii) { return !usedItem[ii] && !items[ii].asset; });
    return { map: map, conf: conf, unmapped: unmapped };
  }

  /* ── التوزيع ── costs: {customs, ship, transport, local, transfer} · shipBy: 'cbm'|'kg' (تلقائي: cbm إن وُجد لكلّ الكراتين) */
  function allocate(P, map, items, costs, opt) {
    opt = opt || {};
    var val = function (ii) { return (Number(items[ii].qty) || 0) * (Number(items[ii].orig_unit_price != null ? items[ii].orig_unit_price : items[ii].unit_price) || 0); };
    var out = items.map(function () { return { customs: 0, ship: 0, other: 0, kg: 0, ctn: [], codes: [] }; });
    var C = P.cartons, useCbm = opt.shipBy ? opt.shipBy === 'cbm' : C.every(function (c) { return c.cbm > 0; });
    var dutySum = C.reduce(function (s, c) { return s + (c.dutyVal || 0); }, 0), kgSum = C.reduce(function (s, c) { return s + (c.kg || 0); }, 0), cbmSum = C.reduce(function (s, c) { return s + (c.cbm || 0); }, 0);
    var custom = Number(costs.customs) || 0, ship = Number(costs.ship) || 0, other = (Number(costs.transport) || 0) + (Number(costs.local) || 0) + (Number(costs.transfer) || 0);
    var warn = [], lostC = 0, lostS = 0;
    C.forEach(function (c) {
      var its = []; c.lines.forEach(function (li) { (map[li] || []).forEach(function (ii) { if (its.indexOf(ii) < 0) its.push(ii); }); });
      var cC = dutySum > 0 ? custom * (c.dutyVal || 0) / dutySum : 0, cS = useCbm ? (cbmSum > 0 ? ship * (c.cbm || 0) / cbmSum : 0) : (kgSum > 0 ? ship * (c.kg || 0) / kgSum : 0);
      if (!its.length) { if (cC || cS) { warn.push('الكرتونة ' + c.no + ' بلا بنود مطابقة — حصّتها وُزّعت بالقيمة على الكلّ (طابِقها للدقّة)'); lostC += cC; lostS += cS; } return; }
      var v = its.reduce(function (s, ii) { return s + val(ii); }, 0) || its.length;
      its.forEach(function (ii) {
        var w = (val(ii) || (v === its.length ? 1 : 0)) / v;
        out[ii].customs += cC * w; out[ii].ship += cS * w; out[ii].kg += (c.kg || 0) * w;
        if (out[ii].ctn.indexOf(c.no) < 0) out[ii].ctn.push(c.no); if (c.hs && out[ii].codes.indexOf(c.hs) < 0) out[ii].codes.push(c.hs);
      });
    });
    var allV = items.reduce(function (s, it, ii) { return s + (it.asset ? 0 : val(ii)); }, 0);
    items.forEach(function (it, ii) {
      if (it.asset) return;
      out[ii].other = allV > 0 ? other * val(ii) / allV : 0;
      if (allV > 0 && (lostC || lostS)) { out[ii].customs += lostC * val(ii) / allV; out[ii].ship += lostS * val(ii) / allV; }   /* لا يضيع شيء: المجموع = المدفوع */
      var q = Number(it.qty) || 0, tot = out[ii].customs + out[ii].ship + out[ii].other;
      out[ii].unit = q > 0 ? Math.round(((Number(it.orig_unit_price != null ? it.orig_unit_price : it.unit_price) || 0) + tot / q) * 100) / 100 : null;
      ['customs', 'ship', 'other'].forEach(function (k) { out[ii][k] = Math.round(out[ii][k] * 100) / 100; }); out[ii].kg = Math.round(out[ii].kg * 1000) / 1000;
    });
    var tot = function (k) { return Math.round(out.reduce(function (s, o) { return s + (o[k] || 0); }, 0) * 100) / 100; };
    return { items: out, basis: (useCbm ? 'ship-by-cbm' : 'ship-by-kg') + '+customs-by-duty+other-by-value', check: { customs: tot('customs'), ship: tot('ship'), other: tot('other') }, warn: warn };
  }
  /* يكتب نتيجة التوزيع في البند بالحقول نفسها التي يقرؤها النظام (`_allocOf` · «كيف تكوّن السعر») */
  function stamp(item, a, src, basis, costsTotal) {   /* costsTotal = مجموع تكاليف الفاتورة الخمس (يقارنه _allocOf ليعرف أنّ التوزيع ما زال صالحاً) */
    var q = Number(item.qty) || 0, o = Number(item.orig_unit_price != null ? item.orig_unit_price : item.unit_price) || 0;
    return Object.assign({}, item, { alloc_unit: a.unit, alloc_qty: q, alloc_orig: o, alloc_tot: Math.round((Number(costsTotal) || 0) * 100) / 100,
      alloc: { customs: a.customs, ship: a.ship, other: a.other, kg: a.kg, ctn: a.ctn, codes: a.codes, basis: basis, src: src } });
  }
  var api = { parse: parse, autoMap: autoMap, allocate: allocate, stamp: stamp, _sim: sim };
  g.GMTPacking = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
