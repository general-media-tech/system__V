/* ═══════════════════════════════════════════════════════════════════════════
   gmt-mufti-bank.js — بنك بيانات فروع المفتي · 19 ت1 · TASK-0051
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك (خطة العمل §٤): «بنك بيانات فروع المفتي (حلب أوّلاً): سجلّ لكل فرع
   + أسماء بديلة + مطابقة OCR + منتقي فروع بالبحث + إدارة/تعطيل + قائمة مراجعة
   للتصحيحات — بلا اختراع فروع».

   المصدر الأساسي يبقى دليل المالك الرسمي (gmt-shipping-offices.js) بلا تعديل.
   البنك طبقةٌ فوقه في gmt_settings (بلا تعديل بنية القاعدة):
     · mufti_branch_bank   ⇐ {aliases:{key:[..]}, disabled:{key:true}, added:[{city,name,addr,phone}]}
                              يكتبه الأدمن وحده. «added» = فرعٌ أدخله المالك بيده — النظام لا يخترع فرعاً.
     · mufti_corr_<وقت>_<عشوائي> ⇐ تصحيحٌ واحد: قرأ الإيصال «X» واختار الموظّف فرعاً آخر.
                              صفٌّ لكلّ تصحيح (لا قراءة-ثمّ-كتابة على صفٍّ مشترك ⇒ لا يضيع تصحيحٌ بتزامن موظّفَين).
   المفتاح: «المدينة|المكتب» — نفس ship_from_office في gmt_orders.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var CO = 'المفتي', KEY = 'mufti_branch_bank', LS = 'gmt_mufti_bank_v1', CORR = 'mufti_corr_';
  var bank = { aliases: {}, disabled: {}, added: [] };
  try { var c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && typeof c === 'object') bank = norm(c); } catch (_) {}

  function norm(b) {
    b = b || {};
    return { aliases: b.aliases && typeof b.aliases === 'object' ? b.aliases : {},
             disabled: b.disabled && typeof b.disabled === 'object' ? b.disabled : {},
             added: Array.isArray(b.added) ? b.added : [] };
  }
  function db() {
    if (global.GMT_DB && GMT_DB.MAIN && GMT_DB.MAIN.url) return GMT_DB.MAIN;
    if (global.SUPABASE_URL && global.SUPABASE_KEY) return { url: global.SUPABASE_URL, key: global.SUPABASE_KEY };
    return null;
  }
  function hdr(extra) { var d = db(); return Object.assign({ apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }, extra || {}); }
  function isAdmin() {
    try { if (global.GMTRole && GMTRole.isAdmin) return !!GMTRole.isAdmin(); } catch (_) {}
    try { return sessionStorage.getItem('gmt_admin_mode') === '1'; } catch (_) { return false; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* تطبيعٌ للبحث: الهمزات · التاء المربوطة · الألف المقصورة · «ال» · التشكيل */
  function fold(s) {
    return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/(^|\s)ال/g, '$1').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function cleanName(s) { return String(s || '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim(); }

  /* ── القراءة والحفظ ───────────────────────────────────────────────────── */
  var loaded = null;
  function load(force) {
    if (loaded && !force) return loaded;
    var d = db(); if (!d) return Promise.resolve(bank);
    loaded = fetch(d.url + '/rest/v1/gmt_settings?key=eq.' + KEY + '&select=value', { headers: hdr() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows[0]) { var v = rows[0].value; try { v = typeof v === 'string' ? JSON.parse(v) : v; } catch (_) { v = null; } if (v) { bank = norm(v); try { localStorage.setItem(LS, JSON.stringify(bank)); } catch (_) {} } }
        return bank;
      }).catch(function () { return bank; });
    return loaded;
  }
  async function save(next) {
    if (!isAdmin()) throw new Error('إدارة بنك الفروع للأدمن وحده');
    var d = db(); if (!d) throw new Error('إعدادات القاعدة غير متاحة');
    var val = JSON.stringify(norm(next));
    var r = await fetch(d.url + '/rest/v1/gmt_settings?on_conflict=key', { method: 'POST',
      headers: hdr({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify({ key: KEY, value: val, updated_at: new Date().toISOString() }) });
    var rows = r.ok ? await r.json() : null;
    if (!r.ok || !Array.isArray(rows) || !rows[0] || String(rows[0].value) !== val) throw new Error(r.ok ? 'لم يتأكّد الحفظ في القاعدة' : 'HTTP ' + r.status);
    bank = norm(next); try { localStorage.setItem(LS, val); } catch (_) {}
    try { if (global.GMTOpLog && GMTOpLog.log) GMTOpLog.log({ action: 'update', entity: 'gmt_settings', entityName: 'بنك فروع المفتي' }); } catch (_) {}
    return bank;
  }

  /* ── القائمة: دليل المالك + ما أضافه بيده، ومعها الأسماء البديلة والتعطيل ─── */
  function list(opts) {
    opts = opts || {};
    var d = (global.GMTOffices && GMTOffices.data && GMTOffices.data[CO]) || {}, out = [], seen = {};
    Object.keys(d).forEach(function (city) { (d[city] || []).forEach(function (o) {
      var k = city + '|' + o.name; if (seen[k]) return; seen[k] = 1;
      out.push({ key: k, city: city, name: o.name, addr: o.addr || '', phone: String(o.phone || '').trim(), source: 'دليل' });
    }); });
    bank.added.forEach(function (o) {
      var k = o.city + '|' + o.name; if (!o.city || !o.name || seen[k]) return; seen[k] = 1;
      out.push({ key: k, city: o.city, name: o.name, addr: o.addr || '', phone: String(o.phone || '').trim(), source: 'مضاف' });
    });
    out.forEach(function (o) { o.aliases = (bank.aliases[o.key] || []).slice(); o.disabled = !!bank.disabled[o.key]; });
    return opts.all ? out : out.filter(function (o) { return !o.disabled; });
  }
  function byKey(k) { return list({ all: true }).filter(function (o) { return o.key === k; })[0] || null; }
  function matches(o, q) {
    var f = fold(q); if (!f) return true;
    return [o.city, o.name, o.addr, o.phone].concat(o.aliases || []).some(function (x) { return fold(x).indexOf(f) !== -1; });
  }

  /* ── التصحيحات: ما قرأه الإيصال ⇐ ما اختاره الموظّف ────────────────────── */
  async function recordCorrection(c) {
    var d = db(); if (!d || !c || !c.chosen) return false;
    var row = { read: String(c.read || '').slice(0, 80), read_key: c.readKey || null, confident: !!c.confident, chosen: c.chosen,
                order: c.order || null, by: c.by || null, at: new Date().toISOString() };
    try {
      var r = await fetch(d.url + '/rest/v1/gmt_settings', { method: 'POST', headers: hdr({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ key: CORR + Date.now() + '_' + Math.random().toString(36).slice(2, 7), value: JSON.stringify(row), updated_at: row.at }) });
      return r.ok;
    } catch (_) { return false; }
  }
  async function corrections() {
    var d = db(); if (!d) return [];
    var r = await fetch(d.url + '/rest/v1/gmt_settings?key=like.' + CORR + '*&select=key,value&order=key.desc&limit=300', { headers: hdr() });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()).map(function (x) { var v = {}; try { v = JSON.parse(x.value); } catch (_) {} v.id = x.key; return v; });
  }
  async function dropCorrections(ids) {
    var d = db(); if (!d || !ids.length) return;
    await fetch(d.url + '/rest/v1/gmt_settings?key=in.(' + ids.map(encodeURIComponent).join(',') + ')', { method: 'DELETE', headers: hdr({ Prefer: 'return=minimal' }) });
  }

  /* ── منتقي الفروع بالبحث: حقلٌ فوق أيّ <select> للفروع يصفّي خياراته ───── */
  function attachSearch(sel) {
    if (!sel || sel.getAttribute('data-bank-search')) return;
    sel.setAttribute('data-bank-search', '1');
    var inp = document.createElement('input');
    inp.type = 'search'; inp.placeholder = '🔎 ابحث عن فرع (اسم · مدينة · اسم بديل · رقم)';
    inp.setAttribute('data-bank-q', sel.id || '');
    inp.className = 'w-full p-2.5 mb-1.5 bg-white border border-gray-200 rounded-xl text-[13px] font-bold';
    inp.style.cssText = 'width:100%;box-sizing:border-box;font-family:inherit';
    sel.parentNode.insertBefore(inp, sel);
    inp.addEventListener('input', function () {
      var q = inp.value, first = null, all = list({ all: true });
      [].forEach.call(sel.options, function (op) {
        if (!op.value) return;
        var o = all.filter(function (x) { return x.key === op.value; })[0];
        var hit = !o || matches(o, q);
        op.hidden = !hit; op.disabled = !hit && !op.selected;
        if (hit && !first) first = op;
      });
      [].forEach.call(sel.querySelectorAll('optgroup'), function (g) { g.hidden = ![].some.call(g.children, function (op) { return !op.hidden; }); });
      /* نتيجةٌ واحدة ⇒ تُختار مباشرةً (كما يتوقّع من يكتب اسم الفرع) */
      var vis = [].filter.call(sel.options, function (op) { return op.value && !op.hidden; });
      if (q && vis.length === 1 && sel.value !== vis[0].value) { sel.value = vis[0].value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }

  /* ── نافذة الإدارة (للأدمن) ────────────────────────────────────────────── */
  async function openManager() {
    if (!isAdmin()) {
      if (global.GMTRole && GMTRole.requireAdmin) { var ok = await GMTRole.requireAdmin('بنك فروع المفتي'); if (!ok) return; }
      else return;
    }
    await load(true);
    var work = JSON.parse(JSON.stringify(bank)), tab = 'list', q = '', corr = null, msg = '';
    var ov = document.createElement('div'); ov.id = 'mufti-bank-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:260;background:rgba(15,18,25,.45);display:flex;align-items:flex-end;justify-content:center;direction:rtl;font-family:inherit';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    function rows() {
      var all = list({ all: true }).map(function (o) { o.aliases = (work.aliases[o.key] || []).slice(); o.disabled = !!work.disabled[o.key]; return o; });
      work.added.forEach(function (a) { var k = a.city + '|' + a.name; if (!all.some(function (x) { return x.key === k; })) all.push({ key: k, city: a.city, name: a.name, addr: a.addr || '', phone: a.phone || '', source: 'مضاف', aliases: work.aliases[k] || [], disabled: !!work.disabled[k] }); });
      return all.filter(function (o) { return matches(o, q); });
    }
    function paintList() {
      var byCity = {};
      rows().forEach(function (o) { (byCity[o.city] = byCity[o.city] || []).push(o); });
      var cities = Object.keys(byCity).sort(function (a, b) { return a === 'حلب' ? -1 : b === 'حلب' ? 1 : a.localeCompare(b, 'ar'); });
      return cities.map(function (c) {
        return '<div style="margin:10px 0 4px;font-weight:900;font-size:13px;color:#374151">' + esc(c) + ' <span style="color:#9ca3af;font-weight:700">(' + byCity[c].length + ')</span></div>' +
          byCity[c].map(function (o) {
            return '<div data-row="' + esc(o.key) + '" style="border:1.5px solid ' + (o.disabled ? '#fecaca' : '#e5e7eb') + ';background:' + (o.disabled ? '#fef2f2' : '#fff') + ';border-radius:12px;padding:9px 11px;margin-bottom:6px">' +
              '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><div style="min-width:0"><b style="font-size:13.5px">' + esc(o.name) + '</b>' +
              (o.source === 'مضاف' ? ' <span style="font-size:10px;background:#eef2ff;color:#3730a3;border-radius:6px;padding:1px 6px;font-weight:800">أضفتَه</span>' : '') +
              (o.disabled ? ' <span style="font-size:10px;background:#fee2e2;color:#b91c1c;border-radius:6px;padding:1px 6px;font-weight:800">معطَّل</span>' : '') +
              '<div style="font-size:11px;color:#6b7280">' + esc(o.addr || '') + (o.phone ? ' · ' + esc(o.phone) : ' · بلا رقم') + '</div></div>' +
              '<button type="button" data-toggle="' + esc(o.key) + '" style="flex-shrink:0;border:none;border-radius:9px;padding:6px 10px;font-weight:800;font-size:12px;cursor:pointer;background:' + (o.disabled ? '#dcfce7;color:#166534' : '#f3f4f6;color:#374151') + '">' + (o.disabled ? 'تفعيل' : 'تعطيل') + '</button></div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;align-items:center">' +
              o.aliases.map(function (a, i) { return '<span style="background:#f1f5f9;border-radius:8px;padding:2px 8px;font-size:11.5px;font-weight:700">' + esc(a) + ' <button type="button" data-unalias="' + esc(o.key) + '" data-i="' + i + '" aria-label="إزالة الاسم البديل" style="border:none;background:none;color:#b91c1c;cursor:pointer;font-weight:900">×</button></span>'; }).join('') +
              '<button type="button" data-alias="' + esc(o.key) + '" style="border:1px dashed #9ca3af;background:#fff;border-radius:8px;padding:2px 8px;font-size:11.5px;font-weight:800;cursor:pointer">＋ اسم بديل</button></div></div>';
          }).join('');
      }).join('') || '<div style="padding:20px;text-align:center;color:#6b7280">لا نتائج</div>';
    }
    function paintReview() {
      if (!corr) return '<div style="padding:20px;text-align:center;color:#6b7280">جارٍ التحميل…</div>';
      if (!corr.length) return '<div style="padding:20px;text-align:center;color:#166534;font-weight:800">✅ لا تصحيحات بانتظار المراجعة</div>';
      var g = {};
      corr.forEach(function (c) { var k = fold(c.read) + '⇐' + c.chosen; (g[k] = g[k] || { read: c.read, chosen: c.chosen, readKey: c.read_key, n: 0, ids: [] }); g[k].n++; g[k].ids.push(c.id); });
      return Object.keys(g).map(function (k) { var x = g[k], o = byKey(x.chosen);
        return '<div data-corr="' + esc(k) + '" style="border:1.5px solid #e5e7eb;border-radius:12px;padding:9px 11px;margin-bottom:6px;font-size:12.5px">' +
          'قرأ الإيصال «<b>' + esc(x.read || '—') + '</b>»' + (x.readKey ? ' (ظنّه ' + esc(x.readKey.replace('|', ' – ')) + ')' : '') + ' ⇐ اختار الموظّف <b>' + esc(x.chosen.replace('|', ' – ')) + '</b>' +
          (x.n > 1 ? ' <span style="color:#b45309;font-weight:800">×' + x.n + '</span>' : '') + (o ? '' : ' <span style="color:#b91c1c">(غير مُدرَج)</span>') +
          '<div style="display:flex;gap:6px;margin-top:6px">' + (x.read && o ? '<button type="button" data-adopt="' + esc(k) + '" style="border:none;border-radius:9px;padding:5px 10px;background:#dcfce7;color:#166534;font-weight:800;cursor:pointer">اعتمد «' + esc(x.read) + '» اسماً بديلاً</button>' : '') +
          '<button type="button" data-dismiss="' + esc(k) + '" style="border:none;border-radius:9px;padding:5px 10px;background:#f3f4f6;font-weight:800;cursor:pointer">تجاهل</button></div></div>';
      }).join('');
    }
    function paint() {
      ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fff;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:16px;box-sizing:border-box">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0;font-size:17px;font-weight:900">🏦 بنك فروع المفتي</h3><button type="button" data-x style="border:none;background:#f3f4f6;border-radius:10px;width:34px;height:34px;cursor:pointer;font-size:16px">✕</button></div>' +
        '<p style="font-size:11.5px;color:#6b7280;margin:4px 0 10px;line-height:1.7">الأسماء البديلة تُستعمل في قراءة الإيصال وفي البحث. المعطَّل لا يظهر في الاختيار ولا يُقرأ (الأوردرات السابقة تبقى على فرعها). الفروع من دليل المالك — وما تضيفه بيدك يُوسَم «أضفتَه».</p>' +
        '<div style="display:flex;gap:6px;margin-bottom:10px"><button type="button" data-tab="list" style="flex:1;border:none;border-radius:10px;padding:8px;font-weight:900;cursor:pointer;background:' + (tab === 'list' ? '#111827;color:#fff' : '#f3f4f6;color:#374151') + '">الفروع</button>' +
        '<button type="button" data-tab="review" style="flex:1;border:none;border-radius:10px;padding:8px;font-weight:900;cursor:pointer;background:' + (tab === 'review' ? '#111827;color:#fff' : '#f3f4f6;color:#374151') + '">مراجعة التصحيحات' + (corr && corr.length ? ' (' + corr.length + ')' : '') + '</button></div>' +
        (tab === 'list' ? '<input type="search" data-q value="' + esc(q) + '" placeholder="🔎 ابحث: اسم · مدينة · اسم بديل · رقم" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #e5e7eb;border-radius:11px;font-family:inherit;font-size:13px">' +
          '<div data-body>' + paintList() + '</div>' +
          '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:900;font-size:13px">＋ إضافة فرعٍ غير موجود في الدليل</summary><div style="display:grid;gap:6px;margin-top:8px">' +
          '<input data-new="city" placeholder="المدينة (مثال: حلب)" style="padding:8px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:inherit"><input data-new="name" placeholder="اسم المكتب" style="padding:8px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:inherit">' +
          '<input data-new="addr" placeholder="العنوان (اختياري)" style="padding:8px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:inherit"><input data-new="phone" placeholder="الهاتف (اختياري)" inputmode="tel" style="padding:8px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:inherit">' +
          '<button type="button" data-add style="border:none;border-radius:10px;padding:8px;background:#eef2ff;color:#3730a3;font-weight:900;cursor:pointer">أضِف الفرع</button></div></details>'
          : '<div data-body>' + paintReview() + '</div>') +
        '<p data-msg style="font-size:12px;font-weight:800;margin:8px 0 0;color:' + (/^❌/.test(msg) ? '#b91c1c' : '#166534') + '">' + esc(msg) + '</p>' +
        '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" data-save style="flex:1;border:none;border-radius:12px;padding:12px;background:#111827;color:#fff;font-weight:900;cursor:pointer">حفظ</button>' +
        '<button type="button" data-x style="flex:1;border:none;border-radius:12px;padding:12px;background:#f3f4f6;font-weight:900;cursor:pointer">إغلاق</button></div></div>';
      var qi = ov.querySelector('[data-q]');
      if (qi) qi.addEventListener('input', function () { q = qi.value; ov.querySelector('[data-body]').innerHTML = paintList(); });
    }
    ov.addEventListener('click', async function (e) {
      var t = e.target.closest && e.target.closest('button'); if (!t || !ov.contains(t)) return;
      if (t.hasAttribute('data-x')) return close();
      if (t.getAttribute('data-tab')) { tab = t.getAttribute('data-tab'); paint(); if (tab === 'review' && !corr) { try { corr = await corrections(); } catch (err) { corr = []; msg = '❌ تعذّرت قراءة التصحيحات: ' + err.message; } paint(); } return; }
      var k;
      if ((k = t.getAttribute('data-toggle'))) { if (work.disabled[k]) delete work.disabled[k]; else work.disabled[k] = true; msg = 'لم يُحفظ بعد — اضغط «حفظ»'; paint(); return; }
      if ((k = t.getAttribute('data-alias'))) {
        var a = global.GMTAsk && GMTAsk.prompt ? await GMTAsk.prompt('اسمٌ بديل لـ«' + k.replace('|', ' – ') + '» (كما يُكتب في الإيصال أو كما يقوله الناس):', { title: 'اسم بديل' }) : global.prompt('اسم بديل:');
        a = cleanName(a); if (!a) return;
        var lst = work.aliases[k] = work.aliases[k] || [];
        if (!lst.some(function (x) { return fold(x) === fold(a); })) lst.push(a);
        msg = 'لم يُحفظ بعد — اضغط «حفظ»'; paint(); return;
      }
      if ((k = t.getAttribute('data-unalias'))) { (work.aliases[k] || []).splice(+t.getAttribute('data-i'), 1); if (work.aliases[k] && !work.aliases[k].length) delete work.aliases[k]; msg = 'لم يُحفظ بعد — اضغط «حفظ»'; paint(); return; }
      if (t.hasAttribute('data-add')) {
        var v = function (n) { return cleanName((ov.querySelector('[data-new="' + n + '"]') || {}).value); };
        var city = v('city'), name = v('name');
        if (!city || !name) { msg = '❌ المدينة واسم المكتب مطلوبان'; paint(); return; }
        if (list({ all: true }).concat(work.added.map(function (x) { return { key: x.city + '|' + x.name }; })).some(function (x) { return fold(x.key) === fold(city + '|' + name); })) { msg = '❌ الفرع موجود أصلاً'; paint(); return; }
        work.added.push({ city: city, name: name, addr: v('addr'), phone: v('phone') }); msg = 'أُضيف — اضغط «حفظ» ليُعتمد'; paint(); return;
      }
      if ((k = t.getAttribute('data-adopt')) || (k = t.getAttribute('data-dismiss'))) {
        var grp = corr.filter(function (c) { return fold(c.read) + '⇐' + c.chosen === k; });
        if (t.hasAttribute('data-adopt') && grp[0]) {
          var L = work.aliases[grp[0].chosen] = work.aliases[grp[0].chosen] || [];
          if (!L.some(function (x) { return fold(x) === fold(grp[0].read); })) L.push(cleanName(grp[0].read));
        }
        try { if (t.hasAttribute('data-adopt')) await save(work); await dropCorrections(grp.map(function (c) { return c.id; })); corr = corr.filter(function (c) { return grp.indexOf(c) < 0; }); msg = t.hasAttribute('data-adopt') ? '✅ اعتُمد اسماً بديلاً وحُفظ' : 'تُجوهل'; }
        catch (err) { msg = '❌ ' + err.message; }
        paint(); return;
      }
      if (t.hasAttribute('data-save')) {
        t.disabled = true; t.textContent = 'لحظة…';
        try { await save(work); msg = '✅ حُفظ بنك الفروع — يسري في القراءة والاختيار فوراً'; try { document.dispatchEvent(new CustomEvent('gmt:mufti-bank')); } catch (_) {} }
        catch (err) { msg = '❌ لم يُحفظ: ' + err.message + ' — لم يتغيّر شيء'; }
        paint(); return;
      }
    });
    paint();
  }

  global.GMTMuftiBank = { load: load, save: save, list: list, byKey: byKey, matches: matches, fold: fold,
    recordCorrection: recordCorrection, corrections: corrections, attachSearch: attachSearch, openManager: openManager,
    get data() { return bank; } };
  load();
})(window);
