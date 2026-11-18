/* ═══════════════════════════════════════════════════════════════════════════
   gmt-custsync.js — سجلّ الزبون الواحد: ما ينقص يُضاف، وما يختلف يُسأل عنه فوراً
   (TASK-B0511 · المالك seq 828)

   طلبك بنصّه: «لما احط بيانات عميل باي مكان وفي شي اختلف يسالني فورا. وعندي تلت خيارات او شي انزاد ينحفظ —
   مثلا كتير زبائن عندنا ما الهن عنوان او مكتب معين، لما عم ارجع حط ما عم ينحفظ».

   السبب الجذري (التحقّق من الكود والقاعدة):
     ① نقطة البيع ترسل الاسم والرقم فقط وتكتب الاسم فوق القديم بلا سؤال (merge-duplicates).
     ② الكفالة والمتجر يرسلان «ignore-duplicates» ⇒ الزبون الموجود لا يُحدَّث أبداً (العنوان الجديد يضيع).
     ③ تعديل الأوردر (إضافة عنوانٍ أو مكتبٍ ناقص) لا يلمس سجلّ الزبون إطلاقاً.
     ④ الأوردر الجديد يسأل عن العنوان وحده، والاسم يُكتب فوق القديم بصمت.

   القاعدة الواحدة الآن (كل الصفحات تمرّ من هنا):
     • زبونٌ جديد ⇒ يُنشأ سجلّه بكل ما كُتب.
     • حقلٌ فارغ في السجلّ وكُتب الآن ⇒ يُحفظ وحده بلا سؤال («شي انزاد ينحفظ»).
     • حقلٌ مختلف ⇒ سؤالٌ فوريّ بثلاثة أجوبة: «الجديد — لهذه المرّة فقط» · «الجديد — واحفظه بدل القديم» · «القديم».
     • ما كُتب فارغاً لا يمسح المحفوظ أبداً · ولا نرسل is_blocked (لا فكّ حظرٍ بالصدفة).

   GMTCust.reconcile({ phone, name, address }, { ask: true, source: 'pos' })
     ⇒ { ok, cancel, created, use: { name, address }, once: { name:bool, address:bool }, saved: [حقول] }
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTCust) return;

  var FIELDS = [
    { k: 'name', t: 'الاسم', ic: '👤' },
    { k: 'address', t: 'العنوان / المكتب', ic: '📍' }
  ];

  function db() {
    try { if (global.GMT_DB && GMT_DB.MAIN) return GMT_DB.MAIN; } catch (_) {}
    try { if (global.GMT_CONFIG) return { url: GMT_CONFIG.SUPABASE_URL, key: GMT_CONFIG.SUPABASE_ANON_KEY }; } catch (_) {}
    try { if (global.CONFIG && CONFIG.SUPABASE_URL) return { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_KEY || CONFIG.SUPABASE_ANON_KEY }; } catch (_) {}
    return null;
  }
  function hdr(d, extra) { var h = { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }; for (var k in (extra || {})) h[k] = extra[k]; return h; }
  function phone09(p) {
    if (global.GMTPhone && GMTPhone.sy09) return GMTPhone.sy09(p);
    var d = String(p || '').replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x660; }).replace(/\D/g, '').replace(/^00963|^963/, '');
    if (/^9\d{8}$/.test(d)) d = '0' + d;
    return /^09\d{8}$/.test(d) ? d : '';
  }
  /* مقارنةٌ متسامحة: المسافات والفواصل وأرقام المكتب الموسّعة (☎) لا تُعدّ اختلافاً */
  function key(s) { return String(s == null ? '' : s).replace(/☎.*$/, '').replace(/[\s،,.\-—·]+/g, ' ').trim().toLowerCase(); }
  function clean(s) { return String(s == null ? '' : s).trim(); }

  function fetchRow(d, ph) {
    return fetch(d.url + '/rest/v1/gmt_customers?phone=eq.' + encodeURIComponent(ph) + '&select=id,name,phone,address&limit=1', { headers: hdr(d) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (rows) { return (rows && rows[0]) || null; });
  }
  function patchRow(d, id, patch) {
    patch.updated_at = new Date().toISOString();
    return fetch(d.url + '/rest/v1/gmt_customers?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: hdr(d, { Prefer: 'return=minimal' }), body: JSON.stringify(patch) })
      .then(function (r) {
        if (r.ok) return true;
        delete patch.updated_at;   /* عمودٌ اختياري غائب لا يُسقط الحفظ */
        return fetch(d.url + '/rest/v1/gmt_customers?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: hdr(d, { Prefer: 'return=minimal' }), body: JSON.stringify(patch) }).then(function (r2) { return r2.ok; });
      });
  }
  function insertRow(d, body) {
    return fetch(d.url + '/rest/v1/gmt_customers?on_conflict=phone', { method: 'POST', headers: hdr(d, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(body) })
      .then(function (r) {
        if (r.ok) return true;
        var min = { phone: body.phone, name: body.name || null }; if (body.address) min.address = body.address;
        return fetch(d.url + '/rest/v1/gmt_customers?on_conflict=phone', { method: 'POST', headers: hdr(d, { Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(min) }).then(function (r2) { return r2.ok; });
      });
  }

  function ask(f, oldV, newV) {
    if (!global.GMTAsk || !GMTAsk.choose) return Promise.resolve('new_once');
    return GMTAsk.choose('هذا الزبون معروف، و' + f.t + ' المحفوظ مختلف عمّا كتبته الآن.\n\nالقديم: ' + oldV + '\nالجديد: ' + newV, {
      title: f.ic + ' ' + f.t + ': القديم أم الجديد؟', cancelText: 'رجوع',
      choices: [{ k: 'new_once', t: 'الجديد — لهذه المرّة فقط', pri: 1 }, { k: 'new_save', t: 'الجديد — واحفظه بدل القديم' }, { k: 'old', t: 'القديم' }]
    });
  }

  /* in: { phone, name, address, branch_key, branch_name, note } · opts: { ask: bool (افتراضياً true), source } */
  function reconcile(input, opts) {
    opts = opts || {};
    var d = db(), ph = phone09(input && input.phone);
    var out = { ok: false, cancel: false, created: false, use: { name: clean(input && input.name), address: clean(input && input.address) }, once: {}, saved: [] };
    if (!d || !ph) return Promise.resolve(out);
    return fetchRow(d, ph).then(function (row) {
      if (!row) {
        var body = { phone: ph, name: out.use.name || null };
        if (out.use.address) body.address = out.use.address;
        if (input.branch_key) body.branch_key = input.branch_key;
        if (input.branch_name) body.branch_name = input.branch_name;
        if (input.note) body.note = input.note;
        return insertRow(d, body).then(function (okIns) { out.ok = !!okIns; out.created = !!okIns; if (okIns) out.saved = FIELDS.map(function (f) { return f.k; }).filter(function (k) { return out.use[k]; }); return out; });
      }
      var patch = {}, conflicts = [];
      FIELDS.forEach(function (f) {
        var nv = out.use[f.k], ov = clean(row[f.k]);
        if (!nv) { if (ov) out.use[f.k] = ov; return; }                 /* فارغٌ الآن ⇒ نستعمل المحفوظ ولا نمسحه */
        if (!ov) { patch[f.k] = nv; out.saved.push(f.k); return; }    /* «شي انزاد» ⇒ يُحفظ بلا سؤال */
        if (key(ov) !== key(nv)) conflicts.push({ f: f, ov: ov, nv: nv });
      });
      var chain = Promise.resolve();
      conflicts.forEach(function (c) {
        chain = chain.then(function () {
          if (out.cancel) return;
          if (opts.ask === false) { out.once[c.f.k] = true; return; }  /* بلا سؤال (حفظٌ خلفيّ) ⇒ لا نكتب فوق المحفوظ */
          return ask(c.f, c.ov, c.nv).then(function (k) {
            if (!k) { out.cancel = true; return; }
            if (k === 'old') out.use[c.f.k] = c.ov;
            else if (k === 'new_save') { patch[c.f.k] = c.nv; out.saved.push(c.f.k); }
            else out.once[c.f.k] = true;
          });
        });
      });
      return chain.then(function () {
        if (out.cancel) return out;
        if (!Object.keys(patch).length) { out.ok = true; return out; }
        return patchRow(d, row.id, patch).then(function (okP) { out.ok = !!okP; if (!okP) out.saved = []; return out; });
      });
    }).catch(function (e) { out.err = (e && e.message) || String(e); return out; });
  }

  /* حفظٌ خلفيّ بلا أسئلة (تأكيد الاستلام · طلب المتجر · بعد قرارٍ سبق): يُنشئ الجديد ويملأ الناقص ولا يكتب فوق المحفوظ */
  function fill(input) { return reconcile(input, { ask: false }); }

  global.GMTCust = { reconcile: reconcile, fill: fill, phone09: phone09, key: key };
})(typeof window !== 'undefined' ? window : this);
