/* ═════════════════════════════════════════════════════════════════
   gmt-custcache.js — اقتراح أسماء الزبائن **يعمل بلا إنترنت**
   أُنشئ: 2026-10-16  ·  ملاحظات ١٢ ت١ ١٠:٢١م

   طلبُك: «اقتراح أسامي العملاء يجب أن يكون مخزّناً محلياً، مو بس عند الاتصال بالإنترنت».
   قبل اليوم كان الاقتراح (الأوردرات + نقطة البيع) يُسأل من قاعدة البيانات في كل حرف؛ فإن انقطع الإنترنت يختفي الاقتراح بصمت.

   الآن:
     · كل نتيجةٍ تعود من القاعدة تُحفَظ هنا تلقائياً (remember) — فما رآه الموظف مرّةً يبقى عنده.
     · بالخلفية عند الاتصال (warm) نُنزِّل آخر الزبائن والأوردرات مرّةً كل ٦ ساعات، فتمتلئ الذاكرة قبل أن ينقطع الإنترنت.
     · عند فشل الشبكة (أو بطئها) تقرأ الصفحةُ من هنا (search): بحث بالاسم (يتجاهل الهمزات والتشكيل والتاء المربوطة)
       أو برقم الهاتف (أي صيغة: 09… / 963… / 00963…).
   التخزين: IndexedDB (سعةٌ كبيرة ولا يزاحم localStorage الذي فيه لقطة الأوردرات)؛ فإن تعذّر ⇒ ذاكرة الصفحة فقط.
   لا شيء يُكتب في القاعدة من هنا إطلاقاً، ولا نخزّن إلا (الاسم · الهاتف · العنوان · محظور؟ · الفرع).
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTCustCache) return;

  var DB_NAME = 'gmt_custcache', STORE = 'c', MAX = 8000, WARM_KEY = 'gmt_custcache_warm_at', WARM_EVERY = 6 * 3600 * 1000;
  var mem = null, dbP = null;

  /* تطبيع الاسم العربي للمقارنة */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/\s+/g, ' ').trim();
  }
  function digits(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/\D/g, '');
  }
  function phoneKey(p) { var d = digits(p).replace(/^(00963|963|0)/, ''); return d.length >= 7 ? d : ''; }
  function keyOf(r) { return phoneKey(r.phone) || ('n:' + norm(r.name)); }

  function openDB() {
    if (dbP) return dbP;
    dbP = new Promise(function (ok) {
      try {
        if (!global.indexedDB) return ok(null);
        var rq = global.indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE, { keyPath: 'k' }); };
        rq.onsuccess = function () { ok(rq.result); };
        rq.onerror = rq.onblocked = function () { ok(null); };
      } catch (_) { ok(null); }
    });
    return dbP;
  }

  /* يحمّل كل السجلات إلى الذاكرة مرّةً واحدة (آلافٌ قليلة — لحظات) */
  function load() {
    if (mem) return Promise.resolve(mem);
    return openDB().then(function (db) {
      mem = {};
      if (!db) return mem;
      return new Promise(function (ok) {
        try {
          var rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
          rq.onsuccess = function () { (rq.result || []).forEach(function (r) { mem[r.k] = r; }); ok(mem); };
          rq.onerror = function () { ok(mem); };
        } catch (_) { ok(mem); }
      });
    });
  }

  function persist(rows, removeKeys) {
    return openDB().then(function (db) {
      if (!db) return;
      return new Promise(function (ok) {
        try {
          var tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
          rows.forEach(function (r) { st.put(r); });
          (removeKeys || []).forEach(function (k) { st.delete(k); });
          tx.oncomplete = tx.onerror = tx.onabort = function () { ok(); };
        } catch (_) { ok(); }
      });
    });
  }

  /* يحفظ/يدمج سجلّات الزبائن. rows: [{id?, name, phone, address?, is_blocked?, branch_key?}] — يتجاهل ما بلا اسمٍ ولا هاتف. */
  function remember(rows) {
    if (!Array.isArray(rows) || !rows.length) return Promise.resolve(0);
    return load().then(function (m) {
      var touched = [], now = Date.now();
      rows.forEach(function (r) {
        if (!r || (!r.name && !r.phone)) return;
        var k = keyOf(r); if (!k || k === 'n:') return;
        var old = m[k] || {};
        var nw = {
          k: k,
          id: r.id != null && r.id !== '' ? r.id : (old.id != null ? old.id : null),
          name: String(r.name || old.name || '').trim(),
          phone: String(r.phone || old.phone || '').trim(),
          address: String(r.address || r.last_address || old.address || '').trim(),
          is_blocked: r.is_blocked !== undefined && r.is_blocked !== null ? !!r.is_blocked : !!old.is_blocked,
          branch_key: r.branch_key || old.branch_key || '',
          nn: '', t: now
        };
        nw.nn = norm(nw.name);
        m[k] = nw; touched.push(nw);
      });
      var keys = Object.keys(m), removed = [];
      if (keys.length > MAX) {                                   // سقفٌ: يسقط الأقدم
        keys.sort(function (a, b) { return (m[a].t || 0) - (m[b].t || 0); });
        keys.slice(0, keys.length - MAX).forEach(function (k) { delete m[k]; removed.push(k); });
      }
      return persist(touched, removed).then(function () { return touched.length; });
    }).catch(function () { return 0; });
  }

  /* بحث محلّيّ: كل كلمات الاستعلام يجب أن تظهر في الاسم، أو أرقام الاستعلام داخل الهاتف. الأحدث والمطابق من البداية أوّلاً. */
  function search(q, limit) {
    limit = limit || 8;
    var nq = norm(q), dq = digits(q), words = nq.split(' ').filter(Boolean);
    if (!nq && !dq) return Promise.resolve([]);
    return load().then(function (m) {
      var out = [];
      Object.keys(m).forEach(function (k) {
        var r = m[k], hit = false, rank = 9;
        if (words.length && words.every(function (w) { return r.nn.indexOf(w) >= 0; })) { hit = true; rank = r.nn.indexOf(words[0]) === 0 ? 0 : 1; }
        if (!hit && dq.length >= 3 && digits(r.phone).indexOf(dq) >= 0) { hit = true; rank = 2; }
        if (hit) out.push({ r: r, rank: rank });
      });
      out.sort(function (a, b) { return a.rank - b.rank || (b.r.t || 0) - (a.r.t || 0); });
      return out.slice(0, limit).map(function (x) {
        var r = x.r;
        return { id: r.id != null ? r.id : 'L:' + r.k, name: r.name, phone: r.phone, address: r.address, is_blocked: r.is_blocked, branch_key: r.branch_key, _local: true };
      });
    }).catch(function () { return []; });
  }

  function count() { return load().then(function (m) { return Object.keys(m).length; }).catch(function () { return 0; }); }

  function fetchJSON(url, headers, ms) {
    var ctl = global.AbortController ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, ms || 9000) : null;
    return fetch(url, { headers: headers, signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (tm) clearTimeout(tm);
      return r.ok ? r.json() : null;
    }).catch(function () { if (tm) clearTimeout(tm); return null; });
  }

  /* تعبئةٌ بالخلفية عند الاتصال. opts: { base, headers, orders:true|false, force } — مرّةً كل ٦ ساعات.
     تفشل بصمت (الذاكرة مساعدٌ لا شرط). */
  function warm(opts) {
    opts = opts || {};
    try {
      if (!opts.base || !opts.headers) return Promise.resolve(0);
      if (global.navigator && global.navigator.onLine === false) return Promise.resolve(0);
      var last = 0; try { last = Number(global.localStorage.getItem(WARM_KEY)) || 0; } catch (_) {}
      if (!opts.force && Date.now() - last < WARM_EVERY) return Promise.resolve(0);
      var jobs = [
        fetchJSON(opts.base + '/rest/v1/gmt_customers?select=*&order=created_at.desc&limit=3000', opts.headers)
          .then(function (r) { return r || fetchJSON(opts.base + '/rest/v1/gmt_customers?select=*&limit=3000', opts.headers); })
      ];
      if (opts.orders) jobs.push(fetchJSON(opts.base + '/rest/v1/gmt_orders?select=name,phone,address,created_at&order=created_at.desc&limit=3000', opts.headers));
      return Promise.all(jobs).then(function (res) {
        var cust = Array.isArray(res[0]) ? res[0] : [], ords = Array.isArray(res[1]) ? res[1] : [];
        if (!cust.length && !ords.length) return 0;                // لا شيء وصل ⇒ لا نعلّم «تمّ» كي نعيد المحاولة
        try { global.localStorage.setItem(WARM_KEY, String(Date.now())); } catch (_) {}
        /* الأوردرات أوّلاً (الأقدم تحت) ثم سجلّ الزبائن فوقها كي تغلب بياناتُه (محظور/فرع/معرّف) */
        return remember(ords.reverse()).then(function () { return remember(cust.reverse()); });
      }).catch(function () { return 0; });
    } catch (_) { return Promise.resolve(0); }
  }

  global.GMTCustCache = { remember: remember, search: search, warm: warm, count: count, _norm: norm, _phoneKey: phoneKey };
})(window);
