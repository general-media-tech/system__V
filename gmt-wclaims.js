/* ═══════════════════════════════════════════════════════════════════════════
   gmt-wclaims.js — سجلّ استخدام الضمان لكل كفالة (TASK-0209 · المالك seq 139)
   أُنشئ: 2026-10-28

   طلبُك: «تفاصيل مثلا استخدام الضمان مثلا صارت الكاميرا مرتجع واستبدلنا له اياها ايمت استرجعناها وشو تقرير الفحص
   مثلا شو قدمنا له حلول ان كان اصلاح او ان كان استبدال وانه تمت الاستفاده من الضمان … الكفاله والضمان هو مره واحده استخدامه».

   كل استخدامٍ صفٌّ في warranty_claims (قاعدة الكفالات) مربوطٌ برقم الكفالة (short_id):
     تاريخ الاستلام (الإرجاع) · شكوى الزبون · تقرير الفحص · الحلّ (قيد الفحص · إصلاح · استبدال · استرجاع المبلغ · رُفض)
     · تفاصيل الحلّ · الرقم التسلسلي البديل · تاريخ التسليم للزبون · «تمت الاستفادة من الضمان».
   الضمان مرّةً واحدة: بعد استخدامٍ مُستفاد منه تظهر الكفالة «🛠 استُخدم الضمان» وأيّ استخدامٍ جديد يُنبَّه قبله.
   جدول الكفالات نفسه لا يُمسّ (صفحة الزبون والتفعيل كما هي). لا حذف: الخطأ يُبطَل بسبب.

   GMTWClaims.load({ url, key })     يقرأ كل الاستخدامات (مرّة) ⇒ Promise
   GMTWClaims.badge(shortId)         شارة الحالة لعمود الجدول ('' إن لا استخدام)
   GMTWClaims.open(row, onDone)      النافذة: السجلّ السابق + نموذج استخدامٍ جديد/تحديث
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTWClaims) return;
  var doc = global.document, DB = null, BY = {}, READY = false, ERR = '';
  var RES = { pending: 'قيد الفحص', repair: 'إصلاح', replace: 'استبدال', refund: 'استرجاع المبلغ', rejected: 'رُفض (خارج الضمان)' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ymd = function (d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var dmy = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? (+m[3]) + '/' + (+m[2]) + '/' + m[1] : '—'; };

  function req(method, path, body, db) {
    db = db || DB;
    return fetch(db.url + '/rest/v1/' + path, {
      method: method, body: body ? JSON.stringify(body) : undefined,
      headers: { apikey: db.key, Authorization: 'Bearer ' + db.key, 'Content-Type': 'application/json', Prefer: 'return=representation' }
    }).then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (_) {} if (!r.ok) { var e = new Error((j && (j.message || j.hint)) || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; }); });
  }
  function index(rows) { BY = {}; (rows || []).forEach(function (c) { if (!c || c.voided) return; (BY[c.warranty_short_id] = BY[c.warranty_short_id] || []).push(c); }); Object.keys(BY).forEach(function (k) { BY[k].sort(function (a, b) { return String(a.received_at).localeCompare(String(b.received_at)) || (a.id - b.id); }); }); }
  function load(o) {
    DB = o || DB; if (!DB) return Promise.resolve();
    return req('GET', 'warranty_claims?select=*&voided=not.is.true&order=id.asc&limit=10000').then(function (r) { index(r); READY = true; ERR = ''; }, function (e) { READY = false; ERR = e.message || String(e); });
  }
  function used(sid) { return (BY[sid] || []).filter(function (c) { return c.consumed; })[0] || null; }
  function badge(sid) {
    var l = BY[sid] || []; if (!l.length) return '';
    var u = used(sid), last = l[l.length - 1];
    if (u) return '<span class="px-2 py-1 rounded text-xs font-bold" style="background:#ede9fe;color:#5b21b6" data-wc-badge title="' + esc(RES[u.resolution] || '') + ' · ' + esc(dmy(u.received_at)) + '">🛠 استُخدم الضمان · ' + esc(RES[u.resolution] || '') + '</span>';
    return '<span class="px-2 py-1 rounded text-xs font-bold" style="background:#fef3c7;color:#92400e" data-wc-badge>🛠 ' + esc(RES[last.resolution] || 'قيد الفحص') + '</span>';
  }

  function css() {
    if (doc.getElementById('gmt-wc-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-wc-css';
    s.textContent = '#gmt-wc{position:fixed;inset:0;z-index:9600;background:rgba(2,6,23,.5);display:grid;place-items:center;padding:14px;direction:rtl;font-family:Cairo,system-ui,sans-serif}' +
      '#gmt-wc .wc-box{width:100%;max-width:620px;max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(15,18,25,.25)}' +
      '#gmt-wc .wc-h{padding:16px 18px 8px}#gmt-wc .wc-h b{display:block;font-size:17px;font-weight:900}#gmt-wc .wc-h small{display:block;color:#5b6472;font-size:12.5px;font-weight:700;margin-top:2px}' +
      '#gmt-wc .wc-b{overflow:auto;padding:0 18px 8px}#gmt-wc label{display:block;font-size:12.5px;font-weight:900;color:#334155;margin:9px 0 4px}' +
      '#gmt-wc input,#gmt-wc select,#gmt-wc textarea{width:100%;box-sizing:border-box;border:1px solid rgba(15,18,25,.18);border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;font-weight:700;background:#fff}' +
      '#gmt-wc .wc-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:520px){#gmt-wc .wc-row{grid-template-columns:1fr}}' +
      '#gmt-wc .wc-f{display:flex;gap:8px;align-items:center;padding:12px 18px;border-top:1px solid rgba(15,18,25,.08);flex-wrap:wrap}#gmt-wc .wc-f [data-wc-msg]{flex:1;min-width:150px;font-size:12.5px;font-weight:800;color:#5b6472}' +
      '#gmt-wc button{font:inherit;font-weight:900;border-radius:10px;padding:9px 14px;cursor:pointer;border:1px solid rgba(15,18,25,.15);background:#fff}#gmt-wc .wc-save{background:#D5001C;color:#fff;border-color:#D5001C}' +
      '#gmt-wc .wc-item{border:1px solid rgba(15,18,25,.1);border-radius:12px;padding:10px 12px;margin:8px 0;font-size:12.5px;line-height:1.75}#gmt-wc .wc-item.used{border-color:#c4b5fd;background:#faf5ff}' +
      '#gmt-wc .wc-item b{font-weight:900}#gmt-wc .wc-item .wc-ed{float:left;font-size:11.5px;padding:4px 9px}' +
      '#gmt-wc .wc-warn{background:#faf5ff;border:1.5px solid #c4b5fd;color:#5b21b6;border-radius:12px;padding:9px 12px;font-size:12.5px;font-weight:800;margin:6px 0}' +
      '#gmt-wc .wc-chk{display:flex;gap:8px;align-items:center;font-size:13px;font-weight:900;margin-top:10px}#gmt-wc .wc-chk input{width:18px;height:18px;flex:none}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  function itemHTML(c) {
    var parts = ['<b>' + esc(RES[c.resolution] || c.resolution) + '</b>' + (c.consumed ? ' · <b style="color:#5b21b6">تمت الاستفادة من الضمان</b>' : ''),
      'استُلم (أُرجع): ' + esc(dmy(c.received_at)) + (c.delivered_at ? ' · سُلّم للزبون: ' + esc(dmy(c.delivered_at)) : ' · لم يُسلَّم بعد')];
    if (c.complaint) parts.push('الشكوى: ' + esc(c.complaint));
    if (c.inspection_report) parts.push('تقرير الفحص: ' + esc(c.inspection_report));
    if (c.resolution_details) parts.push('الحلّ: ' + esc(c.resolution_details));
    if (c.replacement_serial) parts.push('الرقم التسلسلي البديل: <span dir="ltr">' + esc(c.replacement_serial) + '</span>');
    if (c.created_by) parts.push('<span style="color:#64748b">سجّله: ' + esc(c.created_by) + '</span>');
    return '<div class="wc-item' + (c.consumed ? ' used' : '') + '" data-wc-item="' + esc(c.id) + '"><button type="button" class="wc-ed" data-wc-edit="' + esc(c.id) + '">✏️ تحديث</button>' + parts.join('<br>') + '</div>';
  }

  function open(row, onDone) {
    if (!row || !row.short_id || !DB) return null;
    css(); var old = doc.getElementById('gmt-wc'); if (old) old.remove();
    var sid = row.short_id, list = BY[sid] || [], u = used(sid), editing = null;
    var who = '';
    try { who = (global.GMTRole && GMTRole.name && GMTRole.name()) || localStorage.getItem('gmt_operator_name') || ''; } catch (_) {}
    var root = doc.createElement('div'); root.id = 'gmt-wc'; root.setAttribute('data-keep-fab', '1');
    root.innerHTML = '<div class="wc-box" role="dialog" aria-modal="true" aria-label="استخدام الضمان">' +
      '<div class="wc-h"><b>🛠 استخدام الضمان</b><small>' + esc(row.customer_name || '') + ' · ' + esc(row.product_name || '') + (row.serial_no ? ' · <span dir="ltr">' + esc(row.serial_no) + '</span>' : '') + ' · كفالة ' + esc(sid) + '</small></div>' +
      '<div class="wc-b">' +
        (ERR ? '<div class="wc-warn" style="background:#fef2f2;border-color:#fecaca;color:#991b1b">تعذّرت قراءة سجلّ الاستخدام: ' + esc(ERR) + '</div>' : '') +
        (u ? '<div class="wc-warn" data-wc-used>⚠️ الضمان استُخدم سابقاً (' + esc(RES[u.resolution] || '') + ' · ' + esc(dmy(u.received_at)) + ') — الكفالة والضمان مرّةٌ واحدة.</div>' : '') +
        (list.length ? '<div style="font-weight:900;font-size:13px;margin-top:6px">السجلّ (' + list.length + ')</div>' + list.map(itemHTML).join('') : '<div style="color:#64748b;font-size:12.5px;font-weight:700;margin:6px 0">لا استخدام مسجَّل لهذه الكفالة.</div>') +
        '<div style="font-weight:900;font-size:14px;margin-top:12px" data-wc-ftitle>استخدامٌ جديد</div>' +
        '<div class="wc-row"><div><label for="wc-rec">تاريخ الاستلام (الإرجاع) *</label><input type="date" id="wc-rec" max="' + ymd() + '" value="' + ymd() + '"></div>' +
        '<div><label for="wc-res">الحلّ</label><select id="wc-res">' + Object.keys(RES).map(function (k) { return '<option value="' + k + '">' + esc(RES[k]) + '</option>'; }).join('') + '</select></div></div>' +
        '<label for="wc-cmp">شكوى الزبون</label><textarea id="wc-cmp" rows="2" placeholder="مثال: الكاميرا لا تشتغل بعد أسبوع"></textarea>' +
        '<label for="wc-rep">تقرير الفحص</label><textarea id="wc-rep" rows="3" placeholder="ما وُجد عند الفحص"></textarea>' +
        '<label for="wc-det">تفاصيل الحلّ</label><input id="wc-det" placeholder="مثال: استُبدلت بكاميرا جديدة من المستودع">' +
        '<div class="wc-row"><div data-wc-serial-wrap><label for="wc-ser">الرقم التسلسلي البديل</label><input id="wc-ser" dir="ltr" placeholder="عند الاستبدال"></div>' +
        '<div><label for="wc-del">تاريخ التسليم للزبون</label><input type="date" id="wc-del" max="' + ymd() + '"></div></div>' +
        '<label class="wc-chk"><input type="checkbox" id="wc-used"> تمت الاستفادة من الضمان (مرّةً واحدة)</label>' +
      '</div>' +
      '<div class="wc-f"><span data-wc-msg></span><button type="button" data-wc-x>إغلاق</button><button type="button" class="wc-save" data-wc-save>حفظ</button></div></div>';
    doc.body.appendChild(root);
    var $ = function (id) { return root.querySelector('#' + id); }, msg = root.querySelector('[data-wc-msg]');
    var bad = function (t) { msg.style.color = '#b91c1c'; msg.textContent = t; };
    /* الحلّ يحدّد «استُفيد» تلقائياً (إصلاح · استبدال · استرجاع) ويُظهر الرقم البديل للاستبدال — وتبقى قابلةً للتعديل */
    var sync = function (auto) { var r = $('wc-res').value; root.querySelector('[data-wc-serial-wrap]').style.opacity = r === 'replace' ? '1' : '.55'; if (auto) $('wc-used').checked = /^(repair|replace|refund)$/.test(r); };
    $('wc-res').addEventListener('change', function () { sync(true); }); sync(false);
    var fill = function (c) {
      editing = c; root.querySelector('[data-wc-ftitle]').textContent = c ? 'تحديث استخدام ' + dmy(c.received_at) : 'استخدامٌ جديد';
      $('wc-rec').value = c ? String(c.received_at || '').slice(0, 10) : ymd(); $('wc-res').value = c ? c.resolution : 'pending';
      $('wc-cmp').value = c ? c.complaint || '' : ''; $('wc-rep').value = c ? c.inspection_report || '' : ''; $('wc-det').value = c ? c.resolution_details || '' : '';
      $('wc-ser').value = c ? c.replacement_serial || '' : ''; $('wc-del').value = c && c.delivered_at ? String(c.delivered_at).slice(0, 10) : ''; $('wc-used').checked = !!(c && c.consumed); sync(false);
      msg.textContent = ''; try { $('wc-rec').scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
    };
    var close = function () { root.remove(); doc.removeEventListener('keydown', onKey, true); };
    var onKey = function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    doc.addEventListener('keydown', onKey, true);
    var busy = false;
    root.addEventListener('click', async function (e) {
      if (e.target === root || e.target.closest('[data-wc-x]')) { if (!busy) close(); return; }
      var ed = e.target.closest('[data-wc-edit]'); if (ed) { fill(list.filter(function (c) { return String(c.id) === ed.getAttribute('data-wc-edit'); })[0] || null); return; }
      if (!e.target.closest('[data-wc-save]') || busy) return;
      var rec = $('wc-rec').value, del = $('wc-del').value, today = ymd();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rec)) return bad('أدخل تاريخ الاستلام');
      if (rec > today || (del && del > today)) return bad('التاريخ في المستقبل');
      if (del && del < rec) return bad('تاريخ التسليم قبل تاريخ الاستلام');
      var body = { warranty_short_id: sid, received_at: rec, resolution: $('wc-res').value, complaint: $('wc-cmp').value.trim() || null, inspection_report: $('wc-rep').value.trim() || null,
        resolution_details: $('wc-det').value.trim() || null, replacement_serial: $('wc-ser').value.trim() || null, delivered_at: del || null, consumed: $('wc-used').checked, updated_at: new Date().toISOString() };
      if (body.resolution === 'replace' && !body.replacement_serial && !body.resolution_details) return bad('الاستبدال: اكتب الرقم التسلسلي البديل أو تفاصيل الحلّ');
      /* الضمان مرّةً واحدة: استفادةٌ ثانية تحتاج تأكيدك صراحةً */
      var other = list.filter(function (c) { return c.consumed && (!editing || c.id !== editing.id); })[0];
      if (body.consumed && other) {
        var ok = global.GMTAsk && GMTAsk.confirm ? await GMTAsk.confirm('الضمان استُخدم سابقاً (' + (RES[other.resolution] || '') + ' · ' + dmy(other.received_at) + ').\nالكفالة والضمان مرّةٌ واحدة — تسجيل استفادةٍ ثانية؟', { title: 'الضمان مستخدم', okText: 'سجّلها رغم ذلك', danger: true }) : false;
        if (!ok) return;
      }
      busy = true; msg.style.color = '#5b6472'; msg.textContent = '…';
      try {
        if (editing) await req('PATCH', 'warranty_claims?id=eq.' + encodeURIComponent(editing.id), body);
        else await req('POST', 'warranty_claims', Object.assign(body, { created_by: who || null }));
        await load(); close(); if (onDone) try { onDone(); } catch (_) {}
      } catch (err) { busy = false; bad('تعذّر الحفظ: ' + (err.message || err)); }
    });
    return root;
  }

  /* ══ (TASK-0214 · المالك seq 144) صفحة الكفالة للزبون: «يجب ان تتزامن ان الحاله ساريه مفعول ولكن تم استخدامها بسبب حط الاسباب
     مثلا تمت صيانه تم الاستبدال وتاريخ الاستبدال» ══
     قراءةٌ لكفالةٍ واحدة بحقول الزبون فقط (لا «سجّله») · نصوصٌ بصيغة الزبون. */
  var CUST = { pending: 'قيد الفحص لدينا', repair: 'تمت الصيانة (إصلاح)', replace: 'تم الاستبدال', refund: 'تم استرجاع المبلغ', rejected: 'رُفض — خارج الضمان' };
  var CUST_COLS = 'id,warranty_short_id,received_at,complaint,inspection_report,resolution,resolution_details,replacement_serial,delivered_at,consumed';
  function fetchFor(db, sid) {
    if (!db || !sid) return Promise.resolve([]);
    return req('GET', 'warranty_claims?select=' + CUST_COLS + '&warranty_short_id=eq.' + encodeURIComponent(sid) + '&voided=not.is.true&order=received_at.asc,id.asc', null, db).then(function (r) { return Array.isArray(r) ? r : []; });
  }
  /* «… — تم استخدام الضمان (تم الاستبدال · 12/10/2026)» أو «… — قيد الفحص لدينا» أو '' */
  function summary(list) {
    list = list || [];
    var u = list.filter(function (c) { return c.consumed; })[0];
    if (u) return 'تم استخدام الضمان (' + (CUST[u.resolution] || u.resolution) + ' · ' + dmy(u.delivered_at || u.received_at) + ')';
    var open1 = list.filter(function (c) { return c.resolution === 'pending'; })[0];
    return open1 ? 'الجهاز ' + CUST.pending + ' منذ ' + dmy(open1.received_at) : '';
  }
  function customerHTML(list) {
    list = list || []; if (!list.length) return '';
    var u = list.filter(function (c) { return c.consumed; })[0];
    var item = function (c) {
      var rows = [];
      rows.push(['استلمنا الجهاز منك', dmy(c.received_at)]);
      if (c.complaint) rows.push(['الشكوى', esc(c.complaint)]);
      if (c.inspection_report) rows.push(['تقرير الفحص', esc(c.inspection_report)]);
      if (c.resolution_details) rows.push(['تفاصيل الحلّ', esc(c.resolution_details)]);
      if (c.resolution === 'replace' && c.replacement_serial) rows.push(['الرقم التسلسلي للجهاز البديل', '<span dir="ltr">' + esc(c.replacement_serial) + '</span>']);
      rows.push([c.resolution === 'replace' ? 'تاريخ الاستبدال (التسليم لك)' : 'سُلِّم لك', c.delivered_at ? dmy(c.delivered_at) : 'لم يُسلَّم بعد']);
      return '<div class="wcc-item' + (c.consumed ? ' used' : '') + '" data-wcc-item><div class="wcc-res">' + esc(CUST[c.resolution] || c.resolution) + '</div>' +
        rows.map(function (r) { return '<div class="wcc-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
    };
    return '<div class="wcc" data-wcc>' +
      '<div class="wcc-h">🛠 سجلّ استخدام الضمان</div>' +
      (u ? '<div class="wcc-note">الكفالة سارية المفعول حتى تاريخ انتهائها، لكنّ <b>الضمان استُخدم</b> — الكفالة والضمان يُستخدمان مرّةً واحدة.</div>' : '') +
      list.map(item).join('') + '</div>';
  }
  function customerCss() {
    if (doc.getElementById('gmt-wcc-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-wcc-css';
    s.textContent = '.wcc{border:1.5px solid #c4b5fd;background:#faf5ff;border-radius:12px;padding:14px 16px;direction:rtl;text-align:right}' +
      '.wcc-h{font-weight:900;font-size:15px;color:#4c1d95;margin-bottom:6px}' +
      '.wcc-note{font-size:12.5px;font-weight:700;color:#5b21b6;margin-bottom:8px;line-height:1.7}' +
      '.wcc-item{background:#fff;border:1px solid #e9d5ff;border-radius:10px;padding:10px 12px;margin-top:8px}' +
      '.wcc-item.used{border-color:#a78bfa}' +
      '.wcc-res{font-weight:900;font-size:14px;color:#111;margin-bottom:4px}' +
      '.wcc-row{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:3px 0;border-top:1px dashed #f3e8ff}' +
      '.wcc-row span{color:#6b7280;font-weight:700;flex-shrink:0}.wcc-row b{color:#111;font-weight:800;text-align:left}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  global.GMTWClaims = { load: load, badge: badge, open: open, used: used, ready: function () { return READY; }, _labels: RES,
    fetchFor: fetchFor, summary: summary, customerHTML: function (l) { customerCss(); return customerHTML(l); }, _cust: CUST };
})(typeof window !== 'undefined' ? window : this);
