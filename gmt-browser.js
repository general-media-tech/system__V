/* gmt-browser.js — متصفّح مراجعة المنتجات (TASK-0322 · المالك seq 514)
   «متصفح يعرض كل المنتج على حدا ويشوف صفحته ومراجعته»
   منتجٌ واحد في كلّ مرّة: صفحته الحقيقية في المتجر (كما يراها الزبون) + بطاقته في الجرد (الصور · الأسماء · الأسعار · المخزون ·
   المواصفات · الوصف · التوافق) + ما ينقصه + حالة المراجعة. «✅ رُوجع» يختمه (products.reviewed_at/by · review_note) وينتقل للتالي.
   يُفتح من الجرد: GMTBrowser.open(ctx) — ctx: { products, reasons(p)→[k], why:[[k,label]], branches:[{key,name}], edit(id,{onSaved}),
   patch(id, obj)→{error}, operator, storeLink(url) } */
(function (g) {
  'use strict';
  var doc = g.document;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = 'gmt_browser_state';
  function specsOf(p) { var s = p && p.specs; if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = {}; } } return (s && typeof s === 'object') ? s : {}; }
  function imgsOf(p) {
    var a = []; if (p.image_url) a.push(p.image_url);
    var m = p.images; if (typeof m === 'string') { try { m = JSON.parse(m); } catch (_) { m = []; } }
    (Array.isArray(m) ? m : []).forEach(function (u) { u = typeof u === 'string' ? u : (u && u.url); if (u && a.indexOf(u) === -1) a.push(u); });
    return a.filter(function (u) { return /^(https?:|data:image\/)/.test(u); });
  }
  var CSS = '#gmt-br{position:fixed;inset:0;z-index:9100;background:#f1f5f9;display:flex;flex-direction:column;direction:rtl;font-family:Cairo,Tajawal,Tahoma,sans-serif}' +
    '#gmt-br .tb{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 12px;background:#fff;border-bottom:1px solid #e2e8f0}' +
    '#gmt-br .tb b.t{font-size:15px}#gmt-br select,#gmt-br input[type=search]{border:1px solid #e2e8f0;border-radius:10px;padding:7px 9px;font:inherit;font-size:13px;background:#fff;max-width:100%}' +
    '#gmt-br .bt{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px 11px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}' +
    '#gmt-br .bt.red{background:#D5001C;border-color:#D5001C;color:#fff}#gmt-br .bt.grn{background:#047857;border-color:#047857;color:#fff}#gmt-br .bt:disabled{opacity:.45;cursor:default}' +
    '#gmt-br .pos{font-size:13px;font-weight:800;color:#334155;min-width:70px;text-align:center}' +
    '#gmt-br .bd{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:10px}' +
    '@media(max-width:900px){#gmt-br .bd{grid-template-columns:1fr;overflow:auto}#gmt-br .pane{min-height:auto}#gmt-br .sf{height:70vh}}' +
    '#gmt-br .pane{background:#fff;border-radius:16px;border:1px solid #e2e8f0;min-height:0;display:flex;flex-direction:column;overflow:hidden}' +
    '#gmt-br .ph{padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px}' +
    '#gmt-br .sf{flex:1;width:100%;border:0;background:#fff}#gmt-br .card{overflow:auto;padding:12px 14px}' +
    '#gmt-br .imgs{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}#gmt-br .imgs img{width:86px;height:86px;object-fit:contain;border-radius:10px;background:#f8fafc;border:1px solid #eef2f7;flex-shrink:0}' +
    '#gmt-br h2{font-size:18px;margin:10px 0 4px}#gmt-br .kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;font-size:13px;margin:8px 0}#gmt-br .kv span{color:#64748b;font-weight:700}' +
    '#gmt-br .chips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}#gmt-br .chip{font-size:11.5px;font-weight:800;border-radius:999px;padding:3px 9px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}' +
    '#gmt-br .ok{background:#ecfdf5;color:#047857;border-color:#a7f3d0}#gmt-br table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:4px}#gmt-br td{border-bottom:1px solid #f1f5f9;padding:5px 4px;vertical-align:top}#gmt-br td:first-child{color:#64748b;font-weight:700;width:38%}' +
    '#gmt-br .sec{font-size:12px;font-weight:900;color:#0f172a;margin:12px 0 4px}#gmt-br .desc{font-size:13px;line-height:1.8;white-space:pre-line;color:#334155}' +
    '#gmt-br .rv{margin-top:12px;padding:10px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}#gmt-br textarea{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font:inherit;font-size:13px;margin-top:6px}' +
    '#gmt-br .act{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}#gmt-br .empty{padding:40px 16px;text-align:center;color:#64748b;font-weight:800}';

  function open(ctx) {
    ctx = ctx || {};
    var st = {}; try { st = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (_) { st = {}; }
    var F = { mode: st.mode || 'unreviewed', group: st.group || '', q: '' }, list = [], idx = 0, lastStore = '';
    if (!doc.getElementById('gmt-br-css')) { var cs = doc.createElement('style'); cs.id = 'gmt-br-css'; cs.textContent = CSS; doc.head.appendChild(cs); }
    var old = doc.getElementById('gmt-br'); if (old) old.remove();
    var w = doc.createElement('div'); w.id = 'gmt-br'; w.setAttribute('data-keep-fab', '1');
    var prods = function () { return (typeof ctx.products === 'function' ? ctx.products() : ctx.products) || []; };
    var groups = Array.from(new Set(prods().map(function (p) { return p.group_name || ''; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'ar'); });
    w.innerHTML = '<div class="tb"><b class="t">🔎 متصفّح المنتجات</b>' +
      '<select data-mode><option value="unreviewed">لم تُراجَع</option><option value="issues">ناقصة البيانات</option><option value="reviewed">رُوجعت</option><option value="all">الكلّ</option></select>' +
      '<select data-group><option value="">كلّ المجموعات</option>' + groups.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<input type="search" data-q placeholder="🔍 اسم أو باركود" style="width:150px">' +
      '<span style="flex:1"></span><button type="button" class="bt" data-prev title="السابق">→ السابق</button><span class="pos" data-pos></span><button type="button" class="bt" data-next title="التالي">التالي ←</button>' +
      '<button type="button" class="bt" data-close>✕ إغلاق</button></div>' +
      '<div class="bd"><div class="pane"><div class="ph">🛒 صفحته في المتجر <span style="flex:1"></span><a class="bt" data-openstore target="_blank" rel="noopener" style="text-decoration:none;color:inherit">↗ افتح</a></div><div data-storebox style="flex:1;display:flex;min-height:0"></div></div>' +
      '<div class="pane"><div class="ph">📦 بطاقته في الجرد</div><div class="card" data-card></div></div></div>';
    doc.body.appendChild(w);
    var $ = function (s) { return w.querySelector(s); };
    $('[data-mode]').value = F.mode; $('[data-group]').value = F.group;
    function persist() { try { localStorage.setItem(LS, JSON.stringify({ mode: F.mode, group: F.group, at: list[idx] && list[idx].id })); } catch (_) {} }
    function rebuild(keepId) {
      var q = F.q.trim().toLowerCase();
      list = prods().filter(function (p) {
        if (!p || p._is_offer || !p.name) return false;
        if (F.group && (p.group_name || '') !== F.group) return false;
        if (q && String(p.name).toLowerCase().indexOf(q) === -1 && String(p.barcode || '').toLowerCase() !== q && String(p.alt_names || '').toLowerCase().indexOf(q) === -1) return false;
        if (F.mode === 'unreviewed') return !p.reviewed_at;
        if (F.mode === 'reviewed') return !!p.reviewed_at;
        if (F.mode === 'issues') return (ctx.reasons ? ctx.reasons(p) : []).length > 0;
        return true;
      }).sort(function (a, b) { return String(a.group_name || '').localeCompare(String(b.group_name || ''), 'ar') || String(a.name).localeCompare(String(b.name), 'ar'); });
      var at = keepId != null ? list.findIndex(function (p) { return String(p.id) === String(keepId); }) : -1;
      idx = at >= 0 ? at : Math.min(idx, Math.max(0, list.length - 1));
      paint();
    }
    function storeUrl(p) { var u = p && p.store_url ? (ctx.storeLink ? ctx.storeLink(p.store_url) : p.store_url) : ''; return /#product=/.test(u) ? u : ''; }
    function paintStore(p) {
      var box = $('[data-storebox]'), u = storeUrl(p), a = $('[data-openstore]');
      a.style.visibility = u ? '' : 'hidden'; if (u) a.href = u;
      if (!u) { lastStore = ''; box.innerHTML = '<div class="empty" style="flex:1">🛒 غير مربوط بالمتجر — لا صفحة له عند الزبون.<br><small>اربطه أو أنشئه من «✏️ تعديل كامل».</small></div>'; return; }
      var fr = box.querySelector('iframe');
      var base = u.split('#')[0], hash = '#' + u.split('#')[1];
      if (fr && lastStore && lastStore.split('#')[0] === base) { try { fr.contentWindow.location.hash = hash; } catch (_) { fr.src = u; } }
      else { box.innerHTML = '<iframe class="sf" data-sf title="صفحة المنتج في المتجر" src="' + esc(u) + '"></iframe>'; }
      lastStore = u;
    }
    function paint() {
      $('[data-pos]').textContent = list.length ? (idx + 1) + ' / ' + list.length : '0 / 0';
      $('[data-prev]').disabled = idx <= 0; $('[data-next]').disabled = idx >= list.length - 1;
      var p = list[idx], card = $('[data-card]');
      if (!p) { card.innerHTML = '<div class="empty">' + (F.mode === 'unreviewed' ? '✅ لا منتجات بلا مراجعة بهذا الفلتر' : 'لا منتجات بهذا الفلتر') + '</div>'; paintStore(null); persist(); return; }
      var imgs = imgsOf(p), sp = specsOf(p), keys = Object.keys(sp).filter(function (k) { return k.indexOf('__') !== 0 && String(sp[k] == null ? '' : sp[k]).trim(); });
      var why = ctx.reasons ? ctx.reasons(p) : [], lbl = function (k) { var x = (ctx.why || []).find(function (y) { return y[0] === k; }); return x ? x[1] : k; };
      var brs = (ctx.branches || []).map(function (b) { return { n: b.name || b.key, q: Number(p[b.key]) || 0 }; });
      var total = brs.reduce(function (s, b) { return s + b.q; }, 0);
      var money = function (v) { return v == null || v === '' ? '—' : '$' + Number(v).toFixed(2); };
      card.innerHTML =
        '<div class="imgs">' + (imgs.length ? imgs.map(function (u) { return '<img alt="" loading="lazy" src="' + esc(u) + '">'; }).join('') : '<div class="chip">🖼️ بلا صورة</div>') + '</div>' +
        '<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:4px">' + imgs.length + ' صورة</div>' +
        '<h2>' + esc(p.name) + '</h2>' +
        (p.alt_names ? '<div style="font-size:12px;color:#64748b">أسماء أخرى: ' + esc(p.alt_names) + '</div>' : '') +
        '<div class="chips">' + (why.length ? why.map(function (k) { return '<span class="chip">' + esc(lbl(k)) + '</span>'; }).join('') : '<span class="chip ok">✓ بياناته مكتملة</span>') + '</div>' +
        '<div class="kv"><span>الماركة</span><b>' + esc(p.brand || '—') + '</b><span>التصنيف</span><b>' + esc(p.category || '—') + '</b><span>المجموعة</span><b>' + esc(p.group_name || '—') + '</b>' +
        '<span>الباركود</span><b dir="ltr" style="text-align:right">' + esc(p.barcode || '—') + '</b><span>سعر المبيع</span><b style="color:#D5001C">' + money(p.price) + '</b>' +
        '<span>الجملة</span><b>' + money(p.wholesale_price) + '</b><span>الكلفة</span><b>' + money(p.net_cost) + '</b>' +
        '<span>المخزون</span><b>' + total + (brs.length ? ' <small style="color:#64748b;font-weight:700">(' + brs.filter(function (b) { return b.q; }).map(function (b) { return esc(b.n) + ' ' + b.q; }).join(' · ') + ')</small>' : '') + '</b></div>' +
        '<div class="sec">📋 المواصفات (' + keys.length + ')</div>' + (keys.length ? '<table>' + keys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + esc(sp[k]) + '</td></tr>'; }).join('') + '</table>' : '<div class="chip">لا مواصفات</div>') +
        '<div class="sec">📝 الوصف</div>' + (String(sp.__desc || '').trim() ? '<div class="desc">' + esc(sp.__desc) + '</div>' : '<div class="chip">لا وصف</div>') +
        (p.compat ? '<div class="sec">🔗 التوافق</div><div class="desc">' + esc(p.compat) + '</div>' : '') +
        '<div class="rv">' + (p.reviewed_at ? '<b style="color:#047857">✅ رُوجع</b> <small style="color:#64748b">— ' + esc(p.reviewed_by || '') + ' · ' + new Date(p.reviewed_at).toLocaleString('ar-EG') + '</small>' : '<b style="color:#c2410c">⏳ لم يُراجَع بعد</b>') +
        '<textarea data-note rows="2" placeholder="ملاحظة المراجعة (اختياري) — مثلاً: الصورة الثانية خاطئة · ينقصه البوستر">' + esc(p.review_note || '') + '</textarea>' +
        '<div class="act"><button type="button" class="bt grn" data-ok>✅ رُوجع — التالي</button><button type="button" class="bt" data-note-save>📝 احفظ الملاحظة</button>' +
        '<button type="button" class="bt red" data-edit>✏️ تعديل كامل</button>' + (p.reviewed_at ? '<button type="button" class="bt" data-unrev>↩️ إلغاء المراجعة</button>' : '') + '</div>' +
        '<div data-msg style="min-height:1.2em;font-size:12.5px;font-weight:800;margin-top:6px"></div></div>';
      paintStore(p); persist();
    }
    async function mark(p, patch, after) {
      var msg = $('[data-msg]'); if (msg) { msg.style.color = '#334155'; msg.textContent = '⏳ حفظ…'; }
      var r = ctx.patch ? await ctx.patch(p.id, patch) : { error: 'لا حفظ' };
      if (r && r.error) { if (msg) { msg.style.color = '#b91c1c'; msg.textContent = '❌ تعذّر الحفظ: ' + String(r.error).slice(0, 120); } return false; }
      Object.assign(p, patch); if (after) after(); return true;
    }
    function go(d) { var n = idx + d; if (n < 0 || n >= list.length) return; idx = n; paint(); }
    w.addEventListener('click', async function (e) {
      var p = list[idx];
      if (e.target.closest('[data-close]')) { w.remove(); doc.removeEventListener('keydown', onKey); if (ctx.onClose) ctx.onClose(); return; }
      if (e.target.closest('[data-prev]')) return go(-1);
      if (e.target.closest('[data-next]')) return go(1);
      if (!p) return;
      var note = ($('[data-note]') || {}).value; note = note == null ? null : String(note).trim() || null;
      if (e.target.closest('[data-ok]')) {
        var nextId = list[idx + 1] && list[idx + 1].id;
        await mark(p, { reviewed_at: new Date().toISOString(), reviewed_by: ctx.operator || null, review_note: note }, function () { rebuild(F.mode === 'unreviewed' ? nextId : (list[idx + 1] || p).id); });
        return;
      }
      if (e.target.closest('[data-note-save]')) { await mark(p, { review_note: note }, function () { var m = $('[data-msg]'); if (m) { m.style.color = '#047857'; m.textContent = '✓ حُفظت الملاحظة'; } }); return; }
      if (e.target.closest('[data-unrev]')) { await mark(p, { reviewed_at: null, reviewed_by: null }, function () { rebuild(p.id); }); return; }
      if (e.target.closest('[data-edit]')) { if (ctx.edit) ctx.edit(p.id, { onSaved: function () { lastStore = ''; rebuild(p.id); } }); }
    });
    $('[data-mode]').onchange = function (e) { F.mode = e.target.value; idx = 0; rebuild(); };
    $('[data-group]').onchange = function (e) { F.group = e.target.value; idx = 0; rebuild(); };
    $('[data-q]').oninput = function (e) { F.q = e.target.value; idx = 0; rebuild(); };
    function onKey(e) {
      if (!doc.getElementById('gmt-br') || doc.getElementById('gmt-pe')) return;
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
    }
    doc.addEventListener('keydown', onKey);
    rebuild(st.at);
    return w;
  }
  g.GMTBrowser = { open: open, _imgsOf: imgsOf };
})(window);
