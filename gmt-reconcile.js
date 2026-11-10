/* (TASK-0355 · المالك seq 534–538) «اعمل فاتورة تسوية ولكن لا تحذف القديم قبل ما نراجع الفرق والنقص» — «اشتغل على فاتورة المطابقة»
   مطابقة الجرد: مسودة جردٍ محفوظة في stock_counts (details.status = draft) ⇐ مراجعة سطراً سطراً (صورة الجرد · المنتج · المحلّ · المستودع ·
   الفعلي · النظام الحيّ · الفرق) ⇐ تعديل العدد/الربط/الاستثناء وحفظ المسودة ⇐ «اعتماد» وحده يكتب المخزون: فاتورة تسوية من الجرد عبر
   GMTStock.rebuild (الكمّية المطلقة · الفرق من قراءةٍ حيّة لحظة الاعتماد) بالكلمة السيادية، ثمّ تُختم المسودة «طُبّقت» بأرقام الفواتير.
   لا شيء يُكتب على المخزون قبل الاعتماد. */
(function (global) {
  'use strict';
  var doc = global.document;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { if (v === '' || v == null) return null; var n = parseInt(String(v).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }), 10); return isFinite(n) && n >= 0 ? n : null; }
  function css() {
    if (doc.getElementById('gmt-rc-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-rc-css';
    s.textContent =
      '#gmt-rc{position:fixed;inset:0;z-index:2147483000;background:#f3f4f6;display:flex;flex-direction:column;direction:rtl;font-family:Cairo,Tajawal,system-ui,sans-serif;color:#0f1219}' +
      '#gmt-rc .top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #e5e7eb}' +
      '#gmt-rc .top b{font-size:15px}#gmt-rc button{font-family:inherit;font-weight:800;border-radius:9px;border:1.5px solid #d1d5db;background:#fff;padding:6px 10px;cursor:pointer;font-size:12.5px}' +
      '#gmt-rc button.p{background:#1d4ed8;border-color:#1d4ed8;color:#fff}#gmt-rc button.g{background:#047857;border-color:#047857;color:#fff}' +
      '#gmt-rc select,#gmt-rc input{font-family:inherit;font-size:12.5px;border:1.5px solid #d1d5db;border-radius:8px;padding:5px 7px;background:#fff;min-width:0}' +
      '#gmt-rc .sum{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#fff;border-bottom:1px solid #e5e7eb;font-size:12px}' +
      '#gmt-rc .chip{padding:3px 9px;border-radius:999px;background:#f3f4f6;font-weight:800}#gmt-rc .chip.r{background:#fee2e2;color:#b91c1c}#gmt-rc .chip.b{background:#dbeafe;color:#1d4ed8}#gmt-rc .chip.k{background:#dcfce7;color:#047857}' +
      '#gmt-rc .body{flex:1;overflow:auto;padding:8px 10px 90px}' +
      '#gmt-rc .row{display:grid;grid-template-columns:26px 96px minmax(0,1.4fr) minmax(0,1.6fr) 54px 54px 66px 54px 58px;gap:8px;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px;margin-bottom:6px}' +
      '#gmt-rc .row.off{opacity:.55}#gmt-rc .row.hd{background:transparent;border:0;font-size:11px;font-weight:800;color:#6b7280;padding:2px 8px;margin:0}' +
      '#gmt-rc .ph{display:flex;gap:3px;flex-wrap:wrap}#gmt-rc .ph img{width:44px;height:44px;object-fit:cover;border-radius:7px;border:1px solid #e5e7eb;cursor:zoom-in;background:#f9fafb}' +
      '#gmt-rc .ph .pg{font-size:10px;font-weight:800;color:#1d4ed8;background:#eff6ff;border-radius:6px;padding:2px 5px;cursor:zoom-in}' +
      '#gmt-rc .lbl{font-size:12.5px;font-weight:800;line-height:1.35}#gmt-rc .note{font-size:11px;color:#92400e;margin-top:2px;line-height:1.35}' +
      '#gmt-rc .pr{font-size:12px}#gmt-rc .pr .nm{font-weight:800}#gmt-rc .pr .nm.none{color:#b91c1c}#gmt-rc .pr input{width:100%;margin-top:3px}' +
      '#gmt-rc .n{text-align:center;font-weight:800;font-size:13px}#gmt-rc .n small{display:block;font-size:10px;color:#6b7280;font-weight:700}' +
      '#gmt-rc .act input{width:100%;text-align:center;font-weight:900}#gmt-rc .d{text-align:center;font-weight:900;font-size:14px;border-radius:8px;padding:4px 0}' +
      '#gmt-rc .d.m{background:#fee2e2;color:#b91c1c}#gmt-rc .d.p{background:#dbeafe;color:#1d4ed8}#gmt-rc .d.z{background:#dcfce7;color:#047857}' +
      '#gmt-rc .foot{position:fixed;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;background:#fff;border-top:1px solid #e5e7eb;z-index:2}' +
      '#gmt-rc .msg{font-size:12px;font-weight:800;color:#374151}' +
      '#gmt-rc-lb{position:fixed;inset:0;z-index:2147483100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:zoom-out}#gmt-rc-lb img{max-width:96vw;max-height:94vh;border-radius:8px;background:#fff}' +
      '@media (max-width:820px){#gmt-rc .row{grid-template-columns:repeat(5,minmax(0,1fr));grid-auto-rows:auto;row-gap:6px}#gmt-rc .row.hd{display:none}' +
      '#gmt-rc .row>input[data-inc]{grid-column:1/2;justify-self:start}#gmt-rc .ph{grid-column:2/6}#gmt-rc .cnt{grid-column:1/6}#gmt-rc .pr{grid-column:1/6}#gmt-rc .top input[data-q]{flex:1 1 100%;width:auto!important}}';
    doc.head.appendChild(s);
  }
  function close() { var o = doc.getElementById('gmt-rc'); if (o) o.remove(); }

  async function open(ctx) {
    ctx = ctx || {};
    css(); close();
    var sb = ctx.sb, bk = ctx.branchKey || 'haleb', bn = ctx.branchName || 'حلب';
    var root = doc.createElement('div'); root.id = 'gmt-rc'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('data-keep-fab', '1');
    root.innerHTML = '<div class="top"><button type="button" data-x aria-label="إغلاق">✕</button><b>🧾 مطابقة الجرد — فاتورة تسوية</b>' +
      '<select data-draft aria-label="المسودة"></select><span style="flex:1"></span>' +
      '<select data-f aria-label="الفلتر"><option value="all">الكلّ</option><option value="minus">نقص</option><option value="plus">زيادة</option><option value="eq">مطابق</option><option value="nocount">بلا عدد</option><option value="unlinked">غير مربوط بالجرد</option><option value="off">مستثنى</option><option value="rest">في النظام ولم يُعدّ</option></select>' +
      '<input data-q type="search" placeholder="بحث…" style="width:150px"></div>' +
      '<div class="sum" data-sum></div><div class="body" data-body><div class="msg" style="padding:20px">⏳ جارٍ التحميل…</div></div>' +
      '<div class="foot"><span class="msg" data-msg></span><span style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" data-print>🖨️ فاتورة التسوية</button><button type="button" data-labels>🏷️ باركودات (العدد الكلّي)</button><button type="button" data-save>💾 حفظ المسودة</button>' +
      '<label style="font-size:12px;font-weight:800;display:flex;gap:4px;align-items:center" title="ما في النظام ولم يُعدّ يصير 0 — مع نسخة احتياط للرجوع"><input type="checkbox" data-zero checked> تصفير الفرع</label><button type="button" class="g" data-apply>✅ اعتماد التسوية…</button><button type="button" data-revert hidden>↩️ استرجاع النسخة الاحتياطية…</button></span></div>' +
      '<datalist id="gmt-rc-dl"></datalist>';
    doc.body.appendChild(root);
    var $ = function (s) { return root.querySelector(s); };
    var S = { rec: null, items: [], live: {}, rest: [], f: 'all', q: '', dirty: false };
    var prods = (typeof ctx.products === 'function' ? ctx.products() : ctx.products) || [];
    var byName = {}; prods.forEach(function (p) { if (p && p.name) byName[String(p.name).trim()] = p; });
    $('#gmt-rc-dl').innerHTML = prods.slice(0, 4000).map(function (p) { return '<option value="' + esc(p.name) + '">'; }).join('');
    function say(t) { $('[data-msg]').textContent = t || ''; }
    $('[data-x]').onclick = function () { if (S.dirty && !global.confirm('تعديلاتٌ لم تُحفظ على المسودة — إغلاق دون حفظ؟')) return; close(); if (ctx.onClose) ctx.onClose(); };

    var lr = await sb('GET', '/rest/v1/stock_counts?select=id,branch_key,branch_name,counted_by,created_at,details&order=id.desc&limit=30');
    var recs = (lr && Array.isArray(lr.data) ? lr.data : []).filter(function (r) { return r && r.details && Array.isArray(r.details.items); });
    if (!recs.length) { $('[data-body]').innerHTML = '<div class="msg" style="padding:20px">لا مسودات جرد بعد.</div>'; return; }
    $('[data-draft]').innerHTML = recs.map(function (r) { var st = r.details.status === 'applied' ? '✅ طُبّقت' : '📝 مسودة'; return '<option value="' + r.id + '">' + st + ' · #' + r.id + ' · ' + esc(r.branch_name || r.branch_key) + ' · ' + esc(String(r.created_at || '').slice(0, 10)) + '</option>'; }).join('');
    $('[data-draft]').onchange = function () { load(recs.find(function (r) { return String(r.id) === this.value; }, this)); };

    async function liveQty(ids) {
      for (var k = 0; k < ids.length; k += 60) {
        var part = ids.slice(k, k + 60);
        var r = await sb('GET', '/rest/v1/products?id=in.(' + part.map(encodeURIComponent).join(',') + ')&select=id,name,barcode,image_url,price,wholesale_price,' + bk);
        (r && Array.isArray(r.data) ? r.data : []).forEach(function (p) { S.live[String(p.id)] = p; });
      }
    }
    async function load(rec) {
      S.rec = rec; S.items = JSON.parse(JSON.stringify(rec.details.items)); S.dirty = false;
      bk = rec.branch_key || bk; bn = rec.branch_name || bn;
      say('⏳ قراءة مخزون «' + bn + '» الحيّ…');
      await liveQty(S.items.filter(function (i) { return i.id; }).map(function (i) { return String(i.id); }));
      S.items.forEach(function (i) { if (i.id && S.live[i.id]) i.system = Number(S.live[i.id][bk]) || 0; });
      await loadRest();
      say(rec.details.status === 'applied' ? '✅ طُبّقت هذه التسوية ' + (rec.details.applied_at || '').slice(0, 16).replace('T', ' ') + ' — ' + (rec.details.numbers || []).join(' + ') : '📝 مسودة — لا شيء يُكتب على المخزون قبل «اعتماد التسوية»');
      paint();
    }
    /* ما في الفرع الآن (كمّية ≠ 0) ولا سطر له في الجرد ⇐ «لم يُعدّ» — يصير 0 عند «تصفير الفرع» */
    async function loadRest() {
      var r = await sb('GET', '/rest/v1/products?' + bk + '=neq.0&select=id,name,barcode,image_url,price,wholesale_price,' + bk + '&limit=5000');
      var inDraft = {}; S.items.forEach(function (i) { if (i.id) inDraft[String(i.id)] = 1; });
      S.rest = (r && Array.isArray(r.data) ? r.data : []).filter(function (p) { S.live[String(p.id)] = p; return !inDraft[String(p.id)]; });
    }
    function diffOf(i) { return (i.actual != null && i.system != null && i.id) ? i.actual - i.system : null; }
    function cls(i) { var d = diffOf(i); return d == null ? '' : d < 0 ? 'm' : d > 0 ? 'p' : 'z'; }
    function pass(i) {
      var d = diffOf(i), f = S.f;
      if (f === 'minus' && !(d < 0)) return false; if (f === 'plus' && !(d > 0)) return false; if (f === 'eq' && d !== 0) return false;
      if (f === 'nocount' && i.actual != null) return false; if (f === 'unlinked' && i.id) return false; if (f === 'off' && i.include) return false;
      if (S.q) { var t = (i.counted_as + ' ' + (i.name || '') + ' ' + (i.note || '')).toLowerCase(); if (t.indexOf(S.q.toLowerCase()) < 0) return false; }
      return true;
    }
    function summary() {
      var on = S.items.filter(function (i) { return i.include && i.id && i.actual != null; });
      var mi = on.filter(function (i) { return diffOf(i) < 0; }), pl = on.filter(function (i) { return diffOf(i) > 0; });
      var sm = function (a) { return a.reduce(function (s, i) { return s + Math.abs(diffOf(i)); }, 0); };
      $('[data-sum]').innerHTML = '<span class="chip">' + S.items.length + ' سطراً</span><span class="chip k">داخل التسوية ' + on.length + '</span>' +
        '<span class="chip r">نقص ' + mi.length + ' بنداً (−' + sm(mi) + ' قطعة)</span><span class="chip b">زيادة ' + pl.length + ' بنداً (+' + sm(pl) + ' قطعة)</span>' +
        '<span class="chip r" title="في النظام ولم يُعدّ — يصير 0 عند «تصفير الفرع»">لم يُعدّ ' + S.rest.length + ' (−' + S.rest.reduce(function (s, p) { return s + Math.max(0, Number(p[bk]) || 0); }, 0) + ' قطعة)</span>' +
        '<span class="chip">غير مربوط ' + S.items.filter(function (i) { return !i.id; }).length + '</span><span class="chip">مستثنى ' + S.items.filter(function (i) { return !i.include; }).length + '</span>' +
        (S.rec.details.sources ? '<span class="chip">' + S.rec.details.sources.map(function (s) { return esc(s.label); }).join(' · ') + '</span>' : '');
    }
    function rowHtml(i, ix) {
      var d = diffOf(i), photos = (i.photos || []).slice(0, 3).map(function (u) { return '<img src="' + esc(u) + '" loading="lazy" data-lb="' + esc(u) + '" alt="">'; }).join('') +
        (i.pages || []).map(function (u) { var m = /page-(\d+)/.exec(u); return '<span class="pg" data-lb="' + esc(u) + '">مستودع ص' + (m ? +m[1] : '') + '</span>'; }).join('');
      return '<div class="row' + (i.include ? '' : ' off') + '" data-ix="' + ix + '">' +
        '<input type="checkbox" data-inc ' + (i.include ? 'checked' : '') + ' ' + (i.id ? '' : 'disabled') + ' title="داخل التسوية">' +
        '<div class="ph">' + (photos || '<span style="font-size:11px;color:#9ca3af">—</span>') + '</div>' +
        '<div class="cnt"><div class="lbl">' + esc(i.counted_as) + '</div>' + (i.note ? '<div class="note">' + esc(i.note) + '</div>' : '') + '</div>' +
        '<div class="pr"><div class="nm' + (i.id ? '' : ' none') + '">' + (i.id ? esc(i.name) : '— غير مربوط بالجرد —') + '</div><input list="gmt-rc-dl" data-link placeholder="' + (i.id ? 'تغيير المنتج…' : 'اربطه بمنتج…') + '"></div>' +
        '<div class="n">' + (i.shop == null ? '—' : i.shop) + '<small>المحلّ</small></div>' +
        '<div class="n">' + (i.store == null ? '—' : i.store) + '<small>المستودع</small></div>' +
        '<div class="act"><input data-act inputmode="numeric" value="' + (i.actual == null ? '' : i.actual) + '" aria-label="الفعلي"><small style="display:block;text-align:center;font-size:10px;color:#6b7280;font-weight:700">الفعلي</small></div>' +
        '<div class="n">' + (i.system == null ? '—' : i.system) + '<small>النظام</small></div>' +
        '<div class="d ' + cls(i) + '">' + (d == null ? '—' : (d > 0 ? '+' : '') + d) + '</div></div>';
    }
    function restHtml() {
      var q = S.q.toLowerCase();
      return S.rest.filter(function (p) { return !q || String(p.name).toLowerCase().indexOf(q) >= 0; }).map(function (p) {
        var v = Number(p[bk]) || 0;
        return '<div class="row off"><span></span><div class="ph">' + (p.image_url ? '<img src="' + esc(p.image_url) + '" loading="lazy" data-lb="' + esc(p.image_url) + '" alt="">' : '') + '</div>' +
          '<div class="cnt"><div class="lbl">لم يُعدّ في الجرد</div><div class="note">يصير 0 عند «تصفير الفرع»</div></div><div class="pr"><div class="nm">' + esc(p.name) + '</div></div>' +
          '<div class="n">—<small>المحلّ</small></div><div class="n">—<small>المستودع</small></div><div class="n">0<small>الفعلي</small></div><div class="n">' + v + '<small>النظام</small></div><div class="d m">' + (v ? -v : 0) + '</div></div>';
      }).join('');
    }
    function paint() {
      summary();
      var det = S.rec.details || {};
      $('[data-revert]').hidden = !(det.status === 'applied' && det.backup && !det.reverted_at);
      var isAdd = det.mode === 'add'; $('[data-zero]').parentNode.hidden = isAdd; $('[data-apply]').textContent = isAdd ? '➕ إصدار فاتورة إضافية…' : '✅ اعتماد التسوية…';
      if (S.f === 'rest') { $('[data-body]').innerHTML = restHtml() || '<div class="msg" style="padding:20px">كلّ ما في الفرع معدود.</div>'; $('[data-apply]').disabled = det.status === 'applied'; $('[data-save]').disabled = det.status === 'applied'; return; }
      var idx = S.items.map(function (i, ix) { return ix; }).filter(function (ix) { return pass(S.items[ix]); });
      idx.sort(function (a, b) { var A = S.items[a], B = S.items[b]; if (!!A.id !== !!B.id) return A.id ? -1 : 1; var da = diffOf(A), db = diffOf(B); return (db == null ? -1 : Math.abs(db)) - (da == null ? -1 : Math.abs(da)); });
      $('[data-body]').innerHTML = '<div class="row hd"><span></span><span>صورة الجرد</span><span>المعدود</span><span>المنتج في الجرد</span><span>المحلّ</span><span>المستودع</span><span>الفعلي</span><span>النظام</span><span>الفرق</span></div>' +
        (idx.map(function (ix) { return rowHtml(S.items[ix], ix); }).join('') || '<div class="msg" style="padding:20px">لا أسطر بهذا الفلتر.</div>');
      var locked = S.rec.details.status === 'applied';
      $('[data-apply]').disabled = locked; $('[data-save]').disabled = locked;
    }
    function lightbox(u) { var lb = doc.createElement('div'); lb.id = 'gmt-rc-lb'; lb.innerHTML = '<img src="' + esc(u) + '" alt="">'; lb.onclick = function () { lb.remove(); }; doc.body.appendChild(lb); }
    $('[data-body]').addEventListener('click', function (e) { var t = e.target.closest('[data-lb]'); if (t) lightbox(t.getAttribute('data-lb')); });
    $('[data-body]').addEventListener('change', async function (e) {
      var row = e.target.closest('[data-ix]'); if (!row) return; var i = S.items[+row.getAttribute('data-ix')]; S.dirty = true;
      if (e.target.matches('[data-inc]')) { i.include = e.target.checked; paint(); return; }
      if (e.target.matches('[data-act]')) { var v = num(e.target.value); i.actual = v; if (v == null) i.include = false; paint(); return; }
      if (e.target.matches('[data-link]')) {
        var p = byName[String(e.target.value || '').trim()]; if (!p) { say('⚠️ اختر اسم منتجٍ من القائمة كما هو'); return; }
        i.id = String(p.id); i.name = p.name; await liveQty([i.id]); i.system = Number((S.live[i.id] || {})[bk]) || 0; if (i.actual != null) i.include = true;
        i.note = (i.note ? i.note + ' · ' : '') + 'رُبط يدوياً'; paint(); say('🔗 رُبط «' + i.counted_as + '» بـ«' + p.name + '» — احفظ المسودة');
      }
    });
    $('[data-f]').onchange = function () { S.f = this.value; paint(); };
    $('[data-q]').oninput = function () { S.q = this.value.trim(); paint(); };
    async function save(extra) {
      var det = Object.assign({}, S.rec.details, { items: S.items, edited_at: new Date().toISOString(), edited_by: ctx.operator || null }, extra || {});
      var r = await sb('PATCH', '/rest/v1/stock_counts?id=eq.' + encodeURIComponent(S.rec.id), { details: det }, { Prefer: 'return=representation' });
      if (r && !r.error && Array.isArray(r.data) && r.data[0]) { S.rec.details = r.data[0].details; S.dirty = false; return true; }
      say('❌ لم تُحفظ المسودة: ' + ((r && r.error && (r.error.message || r.error)) || 'تعذّر')); return false;
    }
    $('[data-save]').onclick = async function () { say('⏳ حفظ…'); if (await save()) say('💾 حُفظت المسودة — المخزون لم يتغيّر'); };
    /* (seq 540) «ممكن يطلع عندي أشياء لسه ما مجرودة … فاتورة تسوية أخرى ولكن إضافة فوقها وباركوداتها» — مسودة mode=add:
       الاعتماد ⇐ فاتورةٌ واردة إلى الفرع (بانتظار «استلام» نقطة البيع) بكمّية كلّ سطرٍ مربوط — تُضاف فوق الموجود · لا تصفير */
    async function applyAdd() {
      var on = S.items.filter(function (i) { return i.include && i.id && i.actual > 0; });
      if (!on.length) { say('لا أسطر مربوطة بعدد — اربط المعدود بمنتجاته أوّلاً'); return; }
      var t = 'فاتورة تسوية إضافية إلى «' + bn + '»: ' + on.length + ' منتجاً (+' + on.reduce(function (s, i) { return s + i.actual; }, 0) + ' قطعة) — تُضاف فوق الموجود عند «استلامها» في نقطة البيع.';
      var ok = global.GMTAsk && GMTAsk.confirm ? await GMTAsk.confirm(t, { title: '➕ فاتورة تسوية إضافية', okText: 'إصدار' }) : global.confirm(t); if (!ok) return;
      var pw = global.GMTAuth && GMTAuth.ask ? await GMTAuth.ask('sovereign', '🔒 فاتورة تسوية إضافية «' + bn + '»') : true; if (!pw) return;
      if (!(await save())) return;
      await liveQty(on.map(function (i) { return String(i.id); }));
      var nr = await sb('POST', '/rest/v1/rpc/next_stock_transfer_number', {});
      var num = (nr && typeof nr.data === 'string') ? nr.data : 'TRF-' + Date.now();
      var by = ctx.operator || 'الأدمن';
      var h = await sb('POST', '/rest/v1/branch_stock_transfers?select=*', { transfer_number: num, from_branch: 'rebuild', from_branch_name: 'تسوية من الجرد', to_branch: bk, to_branch_name: bn, status: 'pending', is_locked: true,
        title: 'فاتورة تسوية من الجرد — ' + bn + ' · إضافة', created_by: by, note: 'إضافة فوق الموجود — مطابقة الجرد #' + S.rec.id + ' · تُضاف عند «استلام» الفاتورة في نقطة البيع' }, { Prefer: 'return=representation' });
      var hd = h && Array.isArray(h.data) && h.data[0]; if (!hd) { say('❌ تعذّر إنشاء الفاتورة'); return; }
      var r = await sb('POST', '/rest/v1/stock_transfer_items?select=id', on.map(function (i) { var L = S.live[i.id] || {}; return { transfer_id: hd.id, product_id: i.id, product_name: i.name || L.name || '', barcode: L.barcode || null, image_url: (L.image_url && !/^data:/.test(L.image_url)) ? L.image_url : null, qty: i.actual, requested_qty: i.actual, unit_cost: Number(L.wholesale_price) || 0, sale_price: Number(L.price) || 0, notes: 'إضافة من الجرد +' + i.actual }; }), { Prefer: 'return=representation' });
      if (!(r && Array.isArray(r.data) && r.data.length === on.length)) { await sb('DELETE', '/rest/v1/branch_stock_transfers?id=eq.' + encodeURIComponent(hd.id)); say('❌ تعذّر كتابة البنود — أُلغيت'); return; }
      await save({ status: 'applied', applied_at: new Date().toISOString(), applied_by: by, numbers: [num], settle_status: 'pending_receive' });
      paint(); say('✅ صدرت ' + num + ' — بانتظار «استلامها» في نقطة بيع «' + bn + '» (ومنها «🏷️ باركودات الفاتورة»)');
    }
    $('[data-apply]').onclick = async function () {
      if ((S.rec.details || {}).mode === 'add') return applyAdd();
      var zero = $('[data-zero]').checked;
      await loadRest();
      var on = S.items.filter(function (i) { return i.include && i.id && i.actual != null && diffOf(i) !== 0; });
      var zr = zero ? S.rest.filter(function (p) { return (Number(p[bk]) || 0) !== 0; }) : [];
      if (!on.length && !zr.length) { say('لا فروقات داخل التسوية'); return; }
      var mi = on.filter(function (i) { return diffOf(i) < 0; }), pl = on.filter(function (i) { return diffOf(i) > 0; });
      var txt = 'فاتورة تسوية «' + bn + '» من الجرد:\n• نقص ' + mi.length + ' بنداً (−' + mi.reduce(function (s, i) { return s - diffOf(i); }, 0) + ')\n• زيادة ' + pl.length + ' بنداً (+' + pl.reduce(function (s, i) { return s + diffOf(i); }, 0) + ')\n\n' +
        'تصير كمّية كلّ بندٍ في «' + bn + '» = «الفعلي» (الفرق يُحسب من قراءةٍ حيّة لحظة الاعتماد).\n' +
        (zero ? '• تصفير الفرع: ' + zr.length + ' منتجاً في النظام لم يُعدّ ⇐ 0 (−' + zr.reduce(function (s, p) { return s + (Number(p[bk]) || 0); }, 0) + ' قطعة)\n' : '') +
        'الأسطر المستثناة وغير المربوطة لا تُلمس.\n\n💾 تُحفظ قبل التطبيق نسخةٌ احتياطية بكمّيات «' + bn + '» الحاليّة كلّها — للرجوع إليها بزرّ «↩️ استرجاع».';
      var ok = global.GMTAsk && GMTAsk.confirm ? await GMTAsk.confirm(txt, { title: '✅ اعتماد التسوية', okText: 'اعتماد' }) : global.confirm(txt);
      if (!ok) return;
      var pw = global.GMTAuth && GMTAuth.ask ? await GMTAuth.ask('sovereign', '🔒 اعتماد فاتورة تسوية «' + bn + '» من الجرد') : true;
      if (!pw) return;
      /* النسخة الاحتياطية: كمّيات الفرع الحاليّة لكلّ منتجٍ ستلمسه التسوية (قراءة حيّة) */
      await liveQty(S.items.filter(function (i) { return i.id; }).map(function (i) { return String(i.id); }));
      var backup = {}; on.forEach(function (i) { backup[i.id] = Number((S.live[i.id] || {})[bk]) || 0; }); zr.forEach(function (p) { backup[String(p.id)] = Number(p[bk]) || 0; });
      if (!(await save({ backup: backup, backup_at: new Date().toISOString(), zero_mode: zero }))) return;
      if (!global.GMTStock || !GMTStock.rebuild) { say('❌ وحدة المخزون لم تُحمَّل'); return; }
      var by = ctx.operator || 'الأدمن';
      var R = await GMTStock.rebuild({ branch: { key: bk, name: bn }, mode: 'local', by: by, receivedBy: by, titleTag: 'تسوية من الجرد',
        kind: 'فاتورة تسوية من الجرد — مطابقة #' + S.rec.id,
        lines: on.map(function (i) { return lineOf(i.id, i.name, i.actual); }).concat(zr.map(function (p) { return lineOf(String(p.id), p.name, 0); })),
        onProgress: function (k, n, name) { say('🧾 ' + k + ' / ' + n + ' — ' + name); } });
      var nums = (R && R.numbers) || [];
      await save({ status: nums.length ? 'applied' : S.rec.details.status, applied_at: nums.length ? new Date().toISOString() : null, applied_by: by, numbers: nums, failed: (R && R.failed) || [] });
      await liveQty(S.items.filter(function (i) { return i.id; }).map(function (i) { return String(i.id); }));
      S.items.forEach(function (i) { if (i.id && S.live[i.id]) i.system = Number(S.live[i.id][bk]) || 0; });
      await loadRest(); paint();
      say(nums.length ? '✅ صدرت فاتورة التسوية: ' + nums.join(' + ') + ' · طُبّق ' + R.applied + (R.failed.length ? ' · تعذّر ' + R.failed.length : '') : '❌ ' + ((R && R.error) || 'لم تُطبَّق'));
      if (ctx.onApplied) try { ctx.onApplied(R); } catch (_) {}
    };
    function lineOf(pid, name, after) { var L = S.live[pid] || {}; return { product_id: pid, name: name || L.name || '', barcode: L.barcode || '', image_url: (L.image_url && !/^data:/.test(L.image_url)) ? L.image_url : '', after: after, unit_cost: Number(L.wholesale_price) || 0, sale_price: Number(L.price) || 0 }; }
    /* ↩️ الرجوع إلى النسخة الاحتياطية: كلّ منتجٍ لمسته التسوية يعود لكمّيته قبلها — بفاتورة تسويةٍ عكسية */
    $('[data-revert]').onclick = async function () {
      var det = S.rec.details || {}, bkp = det.backup || {}, ids = Object.keys(bkp); if (!ids.length) return;
      var t = 'استرجاع كمّيات «' + bn + '» كما كانت قبل التسوية (' + String(det.backup_at || '').slice(0, 16).replace('T', ' ') + '):\n' + ids.length + ' منتجاً — بفاتورة تسويةٍ عكسية.';
      var ok = global.GMTAsk && GMTAsk.confirm ? await GMTAsk.confirm(t, { title: '↩️ استرجاع النسخة الاحتياطية', okText: 'استرجاع' }) : global.confirm(t);
      if (!ok) return;
      var pw = global.GMTAuth && GMTAuth.ask ? await GMTAuth.ask('sovereign', '🔒 استرجاع نسخة «' + bn + '» قبل التسوية') : true; if (!pw) return;
      await liveQty(ids);
      var by = ctx.operator || 'الأدمن';
      var R = await GMTStock.rebuild({ branch: { key: bk, name: bn }, mode: 'local', by: by, receivedBy: by, titleTag: 'استرجاع ما قبل التسوية', kind: 'استرجاع النسخة الاحتياطية — مطابقة #' + S.rec.id,
        lines: ids.map(function (pid) { return lineOf(pid, '', Number(bkp[pid]) || 0); }), onProgress: function (k, n, name) { say('↩️ ' + k + ' / ' + n + ' — ' + name); } });
      var nums = (R && R.numbers) || [];
      if (nums.length || (R && R.ok)) await save({ reverted_at: new Date().toISOString(), reverted_by: by, revert_numbers: nums, status: 'draft' });
      await liveQty(S.items.filter(function (i) { return i.id; }).map(function (i) { return String(i.id); }));
      S.items.forEach(function (i) { if (i.id && S.live[i.id]) i.system = Number(S.live[i.id][bk]) || 0; });
      await loadRest(); paint();
      say(R && R.ok ? '↩️ عادت الكمّيات كما كانت — ' + (nums.join(' + ') || 'لا فرق') : '❌ ' + ((R && (R.error || (R.failed[0] && R.failed[0].why))) || 'تعذّر'));
    };
    /* 🏷️ باركودات الفاتورة: كلّ منتجٍ مربوط بعدده الكلّي (المحلّ + المستودع) */
    $('[data-labels]').onclick = function () {
      var it = S.items.filter(function (i) { return i.id && i.actual > 0; }).map(function (i) { var L = S.live[i.id] || {}; return { name: i.name || L.name || '', barcode: L.barcode || '', qty: i.actual }; }).filter(function (x) { return x.barcode; });
      var miss = S.items.filter(function (i) { return i.actual > 0 && (!i.id || !(S.live[i.id] || {}).barcode); }).length;
      if (!it.length) { say('لا منتجات مربوطة بباركود'); return; }
      if (global.GMTLabels && GMTLabels.openSheet && GMTLabels.openSheet(it, { title: 'ملصقات باركود — فاتورة تسوية «' + bn + '» #' + S.rec.id })) say('🏷️ ' + it.length + ' منتجاً · ' + it.reduce(function (s, x) { return s + x.qty; }, 0) + ' ملصقاً' + (miss ? ' · ' + miss + ' سطراً بلا باركود (غير مربوط) لم يُطبع' : ''));
      else say('⚠️ وحدة الملصقات لم تُحمَّل');
    };
    /* 🖨️ فاتورة التسوية للطباعة: العدد الكلّي مقابل الموجود حاليّاً · غير المعرّف بصورته وعدده · ما لم يُعدّ */
    $('[data-print]').onclick = function () {
      var w = global.open('', '_blank'); if (!w) { say('⚠️ اسمح بالنوافذ المنبثقة للطباعة'); return; }
      var row = function (i, n) { var d = diffOf(i), img = (i.photos && i.photos[0]) || (i.pages && i.pages[0]) || ((S.live[i.id] || {}).image_url) || '';
        return '<tr><td>' + n + '</td><td>' + (img ? '<img src="' + esc(img) + '">' : '') + '</td><td><b>' + esc(i.name || '— غير معرّف —') + '</b><div class="s">' + esc(i.counted_as) + '</div></td><td>' + (i.shop == null ? '—' : i.shop) + '</td><td>' + (i.store == null ? '—' : i.store) + '</td><td class="b">' + (i.actual == null ? '—' : i.actual) + '</td><td>' + (i.system == null ? '—' : i.system) + '</td><td class="' + (d < 0 ? 'm' : d > 0 ? 'p' : '') + '">' + (d == null ? '—' : (d > 0 ? '+' : '') + d) + '</td><td class="s">' + (i.include ? '' : 'مستثنى · ') + esc(i.note || '') + '</td></tr>'; };
      var linked = S.items.filter(function (i) { return i.id; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
      var unk = S.items.filter(function (i) { return !i.id; });
      var head = '<tr><th>#</th><th>صورة</th><th>المنتج</th><th>المحلّ</th><th>المستودع</th><th>العدد الكلّي</th><th>الموجود حاليّاً</th><th>الفرق</th><th>ملاحظة</th></tr>';
      w.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>فاتورة تسوية ' + esc(bn) + ' #' + S.rec.id + '</title><style>body{font-family:Cairo,Tahoma,sans-serif;margin:14px;color:#111}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}.meta{font-size:12px;color:#444}table{width:100%;border-collapse:collapse;font-size:11.5px}th,td{border:1px solid #bbb;padding:3px 5px;text-align:center;vertical-align:middle}th{background:#f1f5f9}td:nth-child(3){text-align:right}img{width:46px;height:46px;object-fit:cover;border-radius:4px}.b{font-weight:800}.m{color:#b91c1c;font-weight:800}.p{color:#1d4ed8;font-weight:800}.s{font-size:10px;color:#555;text-align:right}@media print{button{display:none}tr{page-break-inside:avoid}}</style></head><body>' +
        '<button onclick="print()">🖨️ طباعة</button><h1>🧾 فاتورة تسوية من الجرد — ' + esc(bn) + ' · مسودة #' + S.rec.id + '</h1><div class="meta">' + esc((S.rec.details.sources || []).map(function (s) { return s.label; }).join(' + ')) + ' · العدد الكلّي = مجموع الملفات · الموجود حاليّاً = مخزون النظام لحظة الطباعة · ' + new Date().toLocaleString('ar-SY') + '</div>' +
        '<h2>① المنتجات المعرّفة (' + linked.length + ')</h2><table>' + head + linked.map(function (i, k) { return row(i, k + 1); }).join('') + '</table>' +
        '<h2>② معدودٌ غير معرّف — الاسم أو الربط من المالك (' + unk.length + ')</h2><table>' + head + unk.map(function (i, k) { return row(i, k + 1); }).join('') + '</table>' +
        '<h2>③ في النظام ولم يُعدّ — يصير 0 عند تصفير الفرع (' + S.rest.length + ')</h2><table><tr><th>#</th><th>صورة</th><th>المنتج</th><th>الموجود حاليّاً</th></tr>' + S.rest.map(function (p, k) { return '<tr><td>' + (k + 1) + '</td><td>' + (p.image_url ? '<img src="' + esc(p.image_url) + '">' : '') + '</td><td>' + esc(p.name) + '</td><td class="m">' + (Number(p[bk]) || 0) + '</td></tr>'; }).join('') + '</table></body></html>');
      w.document.close();
    };
    await load(recs.find(function (r) { return r.details.status === 'draft'; }) || recs[0]);
    $('[data-draft]').value = String(S.rec.id);
  }
  global.GMTReconcile = { open: open, close: close };
})(window);
