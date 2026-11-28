/* gmt-dist.js — «توزيع المخزون» مكوّنٌ واحدٌ مشترك (TASK-A0593 · المالك seq A1144)
   «هي مو مفهومة ومو واضحة — انقدها وشوف شو بدها تصليح وتطوير وشو ممكن نستفاد منها بغير مكان».
   الإصلاح: ① الموجود بالمخزن (فروع) منفصلٌ عن «في الطريق» (استيراد) — لا يطغى المعبور على الشريط
            ② لونٌ ثابتٌ مميَّز لكلّ موقع (خريطة واحدة) ③ كلفةٌ واصلة (net_cost ثم cost_price — المالك seq A1141) وبيع، للإدارة فقط
            ④ الفروع الفارغة مطويّة ⑤ بطاقة الفرع هي نفسها الفلتر (ضغطة = فلتر، والفعّال ظاهر) ⑥ مقروءٌ على 360px.
   الاستعمال: GMTDist.render(el, { products, branches:[{key,name}], transitKeys:['china','germany'], isAdmin, onFilter(key), selected,
                                    mode:'inventory'|'product'|'compact', onNoCost(), noCostActive, transitMeta:{china:{invoices:2,eta:'..'}} })
   mode 'product': products = [منتجٌ واحد]. mode 'compact': سطرٌ واحد (للوحة الرئيسية/نقطة البيع/الاستيراد). */
(function (global) {
  'use strict';
  /* ── خريطة الألوان الوحيدة: مفتاح الموقع ⇒ لون. العبور له ألوانه الخاصة فلا يتشابه مع أيّ فرع ── */
  var COLORS = {
    haleb: '#d5001c', homs: '#15803d', hims: '#15803d', daraa: '#1d4ed8', korani: '#b45309', kurani: '#b45309',
    fakhoury: '#7c3aed', fakhouri: '#7c3aed', hani_a: '#0891b2', hani_b: '#be185d', germany: '#0f172a', china: '#6d28d9'
  };
  var FALLBACK = ['#0369a1', '#a16207', '#0d9488', '#9333ea', '#4d7c0f', '#c2410c', '#475569', '#db2777'];
  var assigned = {};
  function colorOf(key) {
    key = String(key);
    if (COLORS[key]) return COLORS[key];
    if (assigned[key]) return assigned[key];
    var h = 0, i; for (i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    var used = {}; Object.keys(assigned).forEach(function (k) { used[assigned[k]] = 1; });
    var c = FALLBACK[h % FALLBACK.length], n = 0;
    while (used[c] && n++ < FALLBACK.length) c = FALLBACK[(h + n) % FALLBACK.length];
    return (assigned[key] = c);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return (Number(n) || 0).toLocaleString('en-US'); }
  function usd(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function cost(p) { return Number(p.net_cost) > 0 ? Number(p.net_cost) : (Number(p.cost_price) > 0 ? Number(p.cost_price) : 0); }   /* الكلفة الواصلة أوّلاً */
  function q(p, k) { return Number(p[k]) || 0; }

  function css() {
    if (document.getElementById('gmt-dist-css')) return;
    var s = document.createElement('style'); s.id = 'gmt-dist-css';
    s.textContent = [
      '.gd{display:flex;flex-direction:column;gap:10px;min-width:0;max-width:100%;direction:rtl;font-family:inherit;color:#0f172a}',
      '.gd *{box-sizing:border-box}',
      '.gd-sec{display:flex;flex-direction:column;gap:7px;min-width:0}',
      '.gd-sec+.gd-sec{border-top:1px dashed #e2e8f0;padding-top:10px}',
      '.gd-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:2px 10px;font-size:13px;font-weight:900}',
      '.gd-head small{font-size:11px;font-weight:700;color:#64748b}',
      '.gd-bar{display:flex;height:10px;border-radius:99px;overflow:hidden;background:#eef1f5}',
      '.gd-bar i{display:block;height:100%}.gd-bar i+i{box-shadow:inset -2px 0 0 #fff}',
      '.gd-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px;min-width:0}',
      '.gd-card{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:3px;min-width:0;min-height:64px;padding:9px 11px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;cursor:default;text-align:right}',
      '.gd-card.gd-click{cursor:pointer}.gd-card.gd-click:active{transform:scale(.98)}',
      '.gd-card.on{border-color:#d5001c;background:#fff1f2;box-shadow:0 0 0 2px rgba(213,0,28,.12)}',
      '.gd-card:focus-visible{outline:2px solid #0f172a;outline-offset:2px}',
      '.gd-name{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#334155;min-width:0}',
      '.gd-name i{flex:0 0 auto;width:10px;height:10px;border-radius:50%}',
      '.gd-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.gd-qty{font-size:20px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums}',
      '.gd-qty small{font-size:11px;font-weight:700;color:#64748b;margin-inline-start:4px}',
      '.gd-sub{font-size:11px;font-weight:700;color:#64748b}',
      '.gd-mini{height:5px;border-radius:99px;background:#eef1f5;overflow:hidden}.gd-mini i{display:block;height:100%}',
      '.gd-val{font-size:11px;font-weight:800;color:#334155;font-variant-numeric:tabular-nums}',
      '.gd-valrow{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:12px;font-weight:800;color:#334155}',
      '.gd-valrow small{font-size:10.5px;color:#64748b;font-weight:700}',
      '.gd-nocost{all:unset;cursor:pointer;font-size:11px;font-weight:800;color:#b45309;border:1px solid #fcd34d;background:#fffbeb;border-radius:99px;padding:1px 9px}',
      '.gd-nocost.on{background:#b45309;color:#fff;border-color:#b45309}',
      '.gd-empty{font-size:11.5px;color:#64748b}.gd-empty summary{cursor:pointer;font-weight:800}',
      '.gd-empty div{display:flex;flex-wrap:wrap;gap:4px 6px;margin-top:6px}',
      '.gd-empty span{display:inline-flex;align-items:center;gap:5px;background:#f1f5f9;color:#94a3b8;border-radius:99px;padding:2px 9px;font-weight:700}',
      '.gd-empty span i{width:8px;height:8px;border-radius:50%;background:#cbd5e1}',
      '.gd-clear{all:unset;cursor:pointer;font-size:11px;font-weight:800;color:#d5001c;text-decoration:underline}',
      '.gd-row{display:grid;grid-template-columns:minmax(70px,1.1fr) 3fr auto;align-items:center;gap:8px;font-size:13px;font-weight:700;min-width:0}',
      '.gd-row b{font-size:16px;font-variant-numeric:tabular-nums;min-width:26px;text-align:left}',
      '.gd-row.z{opacity:.45}',
      '.gd-hint{font-size:11.5px;font-weight:800;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:9px;padding:5px 9px}',
      '.gd-line{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:12px;font-weight:800;color:#334155}',
      '.gd-line .gd-dot{display:inline-flex;align-items:center;gap:4px}.gd-line i{width:9px;height:9px;border-radius:50%;display:inline-block}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* يحسب كلّ الأرقام مرّةً واحدة */
  function compute(o) {
    var products = o.products || [], tset = {}; (o.transitKeys || []).forEach(function (k) { tset[k] = 1; });
    var names = {}, onKeys = [], trKeys = [];
    (o.branches || []).forEach(function (b) { names[b.key] = b.name; if (tset[b.key]) trKeys.indexOf(b.key) < 0 && trKeys.push(b.key); else onKeys.indexOf(b.key) < 0 && onKeys.push(b.key); });
    (o.transitKeys || []).forEach(function (k) { if (trKeys.indexOf(k) < 0 && names[k] !== undefined) trKeys.push(k); });
    function agg(keys) {
      var per = keys.map(function (k) {
        var n = 0, prods = 0, atCost = 0, atSale = 0;
        products.forEach(function (p) { var v = q(p, k); if (v > 0) { n += v; prods++; atCost += v * cost(p); atSale += v * (Number(p.price) || 0); } });
        return { key: k, name: names[k] || k, n: n, prods: prods, atCost: atCost, atSale: atSale, color: colorOf(k) };
      });
      var tot = { n: 0, prods: 0, atCost: 0, atSale: 0, noCost: 0 };
      per.forEach(function (x) { tot.n += x.n; tot.atCost += x.atCost; tot.atSale += x.atSale; });
      products.forEach(function (p) { var s = 0; keys.forEach(function (k) { s += q(p, k); }); if (s > 0) { tot.prods++; if (!cost(p)) tot.noCost++; } });
      return { per: per, tot: tot };
    }
    return { on: agg(onKeys), tr: agg(trKeys) };
  }

  function card(x, share, o, withVal) {
    var click = typeof o.onFilter === 'function', on = String(o.selected || '') === x.key;
    var tag = click ? 'button type="button" aria-pressed="' + (on ? 'true' : 'false') + '"' : 'div';
    return '<' + tag + ' class="gd-card' + (click ? ' gd-click' : '') + (on ? ' on' : '') + '" data-key="' + esc(x.key) + '" title="' + esc(x.name) + (click ? ' — اضغط لتصفية القائمة' : '') + '">' +
      '<span class="gd-name"><i style="background:' + x.color + '"></i><span>' + esc(x.name) + '</span></span>' +
      '<span class="gd-qty">' + num(x.n) + '<small>قطعة</small></span>' +
      '<span class="gd-sub">' + num(x.prods) + ' منتج · ' + share + '%</span>' +
      '<span class="gd-mini"><i style="width:' + share + '%;background:' + x.color + '"></i></span>' +
      (withVal ? '<span class="gd-val" dir="ltr" title="بالكلفة الواصلة / بسعر البيع">' + usd(x.atCost) + ' / ' + usd(x.atSale) + '</span>' : '') +
      '</' + (click ? 'button' : 'div') + '>';
  }
  function pct(n, t) { return t ? Math.round(n / t * 100) : 0; }

  function valueRow(t, o, label) {
    if (!o.isAdmin) return '';
    var nc = t.noCost ? '<button type="button" class="gd-nocost' + (o.noCostActive ? ' on' : '') + '" data-nocost="1" title="اعرض المنتجات التي لا كلفة لها">' + num(t.noCost) + ' بلا كلفة</button>' : '';
    return '<div class="gd-valrow" title="للإدارة فقط"><span dir="ltr">' + usd(t.atCost) + ' <small>بالكلفة الواصلة</small></span><span dir="ltr">' + usd(t.atSale) + ' <small>بسعر البيع</small></span>' + nc + '</div>';
  }

  function section(title, grp, o, kind) {
    var live = grp.per.filter(function (x) { return x.n > 0; }), dead = grp.per.filter(function (x) { return x.n <= 0; }), t = grp.tot;
    if (!grp.per.length) return '';
    var h = '<div class="gd-sec" data-sec="' + kind + '"><div class="gd-head"><span>' + title + ': ' + num(t.n) + ' قطعة · ' + num(t.prods) + ' منتج</span>';
    var meta = (o.transitMeta && kind === 'transit') ? Object.keys(o.transitMeta).reduce(function (s, k) { return s + (+(o.transitMeta[k] || {}).invoices || 0); }, 0) : 0;
    if (meta) h += '<small>' + num(meta) + ' فاتورة مفتوحة</small>';
    if (kind === 'onhand' && o.selected) h += '<button type="button" class="gd-clear" data-clear="1">إلغاء الفلتر ✕</button>';
    h += '</div>';
    if (live.length) {
      h += '<div class="gd-bar" role="img" aria-label="' + esc(title) + '">' + live.map(function (x) { return '<i style="width:' + (x.n / t.n * 100).toFixed(2) + '%;background:' + x.color + '" title="' + esc(x.name) + ': ' + x.n + '"></i>'; }).join('') + '</div>';
      h += '<div class="gd-cards">' + live.map(function (x) { return card(x, pct(x.n, t.n), o, o.isAdmin); }).join('') + '</div>';
    } else h += '<div class="gd-sub">لا قطع هنا حالياً</div>';
    if (dead.length) h += '<details class="gd-empty"><summary>' + dead.length + (kind === 'onhand' ? ' فروع فارغة' : ' مواقع فارغة') + '</summary><div>' + dead.map(function (x) { return '<span><i></i>' + esc(x.name) + '</span>'; }).join('') + '</div></details>';
    h += valueRow(t, o);
    if (meta === 0 && o.transitMeta) { /* لا شيء */ }
    return h + '</div>';
  }

  function renderInventory(el, o, c) {
    var h = '<div class="gd" data-mode="inventory">' + section('بالمخزن', c.on, o, 'onhand');
    if (c.tr.per.length) h += section('بالطريق', c.tr, o, 'transit');
    el.innerHTML = h + '</div>';
  }

  function renderProduct(el, o, c) {
    var p = (o.products || [])[0] || {}, all = c.on.per.concat(c.tr.per), onN = c.on.tot.n, trN = c.tr.tot.n;
    var max = c.on.per.reduce(function (m, x) { return x.n > m.n ? x : m; }, { n: 0 });
    function row(x, base) { return '<div class="gd-row' + (x.n ? '' : ' z') + '" data-key="' + esc(x.key) + '"><span class="gd-name"><i style="background:' + x.color + '"></i><span>' + esc(x.name) + '</span></span><span class="gd-mini"><i style="width:' + pct(x.n, base) + '%;background:' + x.color + '"></i></span><b>' + num(x.n) + '</b></div>'; }
    var h = '<div class="gd" data-mode="product"><div class="gd-sec" data-sec="onhand"><div class="gd-head"><span>بالمخزن: ' + num(onN) + ' قطعة</span></div>' +
      (c.on.per.length ? c.on.per.map(function (x) { return row(x, onN); }).join('') : '<div class="gd-sub">لا فروع</div>') +
      (max.n > 0 && c.on.per.filter(function (x) { return x.n > 0; }).length > 1 ? '<div class="gd-hint">الأوفر في «' + esc(max.name) + '» (' + num(max.n) + ') — منه التحويل</div>' : '') + '</div>';
    if (c.tr.per.length) h += '<div class="gd-sec" data-sec="transit"><div class="gd-head"><span>بالطريق: ' + num(trN) + ' قطعة</span></div>' + c.tr.per.map(function (x) { return row(x, trN); }).join('') + '</div>';
    if (o.isAdmin && cost(p)) h += '<div class="gd-valrow" dir="ltr"><span>' + usd(cost(p) * onN) + ' <small>بالكلفة الواصلة (بالمخزن)</small></span><span>' + usd((Number(p.price) || 0) * onN) + ' <small>بسعر البيع</small></span></div>';
    el.innerHTML = h + '</div>';
  }

  function renderCompact(el, o, c) {
    function part(lbl, grp) { return '<span class="gd-dot"><b>' + lbl + ' ' + num(grp.tot.n) + '</b></span>' + grp.per.filter(function (x) { return x.n > 0; }).map(function (x) { return '<span class="gd-dot"><i style="background:' + x.color + '"></i>' + esc(x.name) + ' ' + num(x.n) + '</span>'; }).join(''); }
    el.innerHTML = '<div class="gd gd-line" data-mode="compact">' + part('بالمخزن', c.on) + (c.tr.per.length ? part('بالطريق', c.tr) : '') + '</div>';
  }

  function render(el, o) {
    if (!el) return null;
    o = o || {}; css();
    var c = compute(o), mode = o.mode || 'inventory';
    (mode === 'product' ? renderProduct : mode === 'compact' ? renderCompact : renderInventory)(el, o, c);
    if (typeof o.onFilter === 'function') {
      el.querySelectorAll('.gd-card[data-key]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-key'); o.onFilter(String(o.selected || '') === k ? '' : k); }); });
      var cl = el.querySelector('[data-clear]'); if (cl) cl.addEventListener('click', function () { o.onFilter(''); });
    }
    var nc = el.querySelector('[data-nocost]'); if (nc && typeof o.onNoCost === 'function') nc.addEventListener('click', function () { o.onNoCost(); });
    return c;
  }

  global.GMTDist = { render: render, color: colorOf, cost: cost, compute: compute };
})(typeof window !== 'undefined' ? window : this);
