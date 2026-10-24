/* ═══════════════════════════════════════════════════════════════════════════
   gmt-account.js — الحسابات والصلاحيات الإضافيّة وحارسُ الصفحات
   أُنشئ: 2026-10-04 (ي)

   ══ ما طلبتَه بنصّك ══
   «ما في شخص بيدخل على التطبيق إلا يكون عامل حساب على التطبيق: بيحدّد فرعه
    وبيدخل بياناته… أي حدا بيعمل حساب لأنّ الرابط ما راح يتشارك مع كثير أشخاص.
    وبعد فترة راح أقفل الأجهزة: كل جهاز يرتبط بفرع، والحساب ما بصير يكون على
    أكثر من جهاز».
   «ممكن أعطي لموظف صلاحيات زائدة — مو كل الأدمن — فحدّدلي هالخيارات في
    إدارة الموظفين».
   «الواجهة خليها نفسها: كل الأدوات ظاهرة، بس اللي بدها صلاحية أدمن ما
    بتفتح عنده — مشان لما أعطيه وصول لأداة ما تتغيّر الواجهة».

   ══ بلا SQL — قاعدتك ══
   • الحساب يُكتب في جدول gmt_users **الموجود** بنفس الأعمدة التي تكتبها
     «الأمان والمستخدمون» ونقطة البيع: display_name · username · password_hash
     (نفس الترميز حرفاً) · branch_key · is_active · last_device_id.
   • الحساب الجديد «عامّ» (OPEN-ANY-DEVICE) إلى أن تقفل الأجهزة — وهو نفس
     الزرّ الموجود اليوم في «الأمان والمستخدمون» (عامّ ⇄ جهاز واحد).
   • الصلاحيات الإضافيّة واسم المركز يُحفظان في gmt_settings **بمفتاحٍ لكل
     مستخدم** (tool_grants_<id> · user_profile_<id>) — لا عمود جديد، ولا
     ملفّ مشترك يكتب فوقه جهازان في اللحظة نفسها.

   ⚠️ بصراحة: هذه حمايةُ واجهة. الحمايةُ الحقيقيّة على البيانات هي سياسات
      RLS في Supabase (مذكورة في gmt-auth.js). لكنّ الحارس هنا يمنع فتح الأداة
      من الرابط المباشر أيضاً، لا من الرئيسيّة وحدها — قاعدةُ وثيقتك.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTAccount) return;

  var OPEN_DEVICE = 'OPEN-ANY-DEVICE';
  var LS_BRANCHES = 'gmt_branches_cache_v1';

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  function db() {
    try { if (global.GMT_DB && GMT_DB.MAIN && GMT_DB.MAIN.url) return GMT_DB.MAIN; } catch (_) {}
    if (global.SUPABASE_URL && global.SUPABASE_KEY) return { url: global.SUPABASE_URL, key: global.SUPABASE_KEY };
    try { if (global.CONFIG && CONFIG.SUPABASE_URL) return { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_KEY || CONFIG.SUPABASE_ANON_KEY }; } catch (_) {}
    /* (ع) صفحاتٌ تعرّف إعدادها بـ const على المستوى الأعلى (نقطة البيع: CONFIG · الجرد: SUPABASE_URL) —
       لا تصير خاصّيةً على window، لكنّ اسمها مرئيٌّ لكل السكربتات. */
    try { /* global CONFIG */ if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SUPABASE_URL) return { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_KEY || CONFIG.SUPABASE_ANON_KEY || CONFIG.KEY }; } catch (_) {}
    try { /* global SUPABASE_URL, SUPABASE_KEY */ if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_KEY !== 'undefined' && SUPABASE_URL) return { url: SUPABASE_URL, key: SUPABASE_KEY }; } catch (_) {}
    try { var u = localStorage.getItem('inv_url'), k = localStorage.getItem('inv_key'); if (u && k) return { url: u, key: k }; } catch (_) {}
    return null;
  }
  async function rest(method, path, body, prefer) {
    var d = db();
    if (!d) throw new Error('إعدادات قاعدة البيانات غير محمّلة في هذه الصفحة');
    var h = { apikey: d.key, Authorization: 'Bearer ' + d.key };
    if (body != null) h['Content-Type'] = 'application/json';
    if (prefer) h.Prefer = prefer;
    var res;
    try { res = await fetch(d.url + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error('لا اتصال بالإنترنت أو بقاعدة البيانات الآن'); }
    /* res.ok قبل res.json — جوابُ الخطأ لا يُقرأ كـ«لا نتائج» */
    if (!res.ok) {
      var why = ''; try { why = (await res.json()).message || ''; } catch (_) {}
      throw new Error(why || ('HTTP ' + res.status));
    }
    if (res.status === 204) return null;
    var t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  /* نفسُ ترميز admin_pos.html و«الأمان والمستخدمون» ونقطة البيع حرفاً */
  function b64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p) { return String.fromCharCode('0x' + p); }));
  }

  function session() { try { return JSON.parse(lsGet('gmt_session', 'null')) || null; } catch (_) { return null; } }
  function isAdmin() {
    try { if (global.GMTRole && GMTRole.isAdmin) return !!GMTRole.isAdmin(); } catch (_) {}
    try { return sessionStorage.getItem('gmt_admin_mode') === '1'; } catch (_) { return false; }
  }
  /* نفسُ شكل الجلسة الذي تكتبه نقطة البيع — فتفتح نقطة البيع بلا دخولٍ ثانٍ */
  function setSession(u, br) {
    var s = { id: u.id, username: u.username, display_name: u.display_name || u.username,
              branch_key: br.key, branch_name: br.name || br.key, device_id: null,
              pending: u.approved === false };
    lsSet('gmt_session', JSON.stringify(s));
    lsSet('gmt_pending_' + u.id, s.pending ? '1' : '0');
    lsSet('gmt_branch', br.key);
    return s;
  }

  /* الفروع من مصدرها (inv_columns) — وألمانيا والصين مواقعُ بضاعةٍ في الطريق لا فروع */
  async function branches() {
    try {
      var rows = await rest('GET', '/rest/v1/inv_columns?select=key_name,display_name,icon&is_branch=eq.true');
      var list = (rows || []).map(function (r) { return { key: r.key_name, name: r.display_name || r.key_name, icon: r.icon || '' }; });
      if (global.GMTTransit && GMTTransit.filterOut) list = GMTTransit.filterOut(list, function (b) { return b.key; });
      if (list.length) lsSet(LS_BRANCHES, JSON.stringify(list));
      return list;
    } catch (e) {
      try { var c = JSON.parse(lsGet(LS_BRANCHES, '[]')); if (c.length) return c; } catch (_) {}
      throw e;
    }
  }

  function cleanUser(u) { return String(u || '').trim().toLowerCase().replace(/\s+/g, ''); }

  async function signup(o) {
    var name = String(o.display_name || '').trim(), user = cleanUser(o.username), pw = String(o.password || '');
    if (!o.branch || !o.branch.key) throw new Error('اختر فرعك أوّلاً');
    if (global.GMTTransit && GMTTransit.is && GMTTransit.is(o.branch.key)) throw new Error('هذا موقعُ بضاعةٍ في الطريق لا نقطةَ بيع');
    if (!name) throw new Error('اكتب اسمك كما سيظهر على الفاتورة');
    if (!/^[a-z0-9._-]{3,24}$/.test(user)) throw new Error('اسم المستخدم: من ٣ إلى ٢٤ حرفاً إنجليزياً أو رقماً، بلا مسافات');
    if (pw.length < 4) throw new Error('كلمة السرّ: ٤ أحرف على الأقلّ');
    if (o.password2 != null && o.password2 !== pw) throw new Error('كلمتا السرّ غير متطابقتين');
    var ex = await rest('GET', '/rest/v1/gmt_users?username=eq.' + encodeURIComponent(user) +
                               '&branch_key=eq.' + encodeURIComponent(o.branch.key) + '&select=id');
    if (ex && ex.length) throw new Error('اسم المستخدم «' + user + '» مستعمل في هذا الفرع — اختر غيره');
    /* (2026-10-05 ع) قرارك: «المستخدم بينشئ حساب وبيدخل عادي، بس ما بيحسن يعمل شي لحتى الإدارة توافق —
       تصفّح فقط متل وضع التدريب». ⇒ approved=false (SQL ٢٥). بلا العمود: مفتاح user_pending_<id>. */
    var newRow = { display_name: name, username: user, password_hash: GMTPw.PLACEHOLDER,
                   branch_key: o.branch.key, is_active: true, last_device_id: OPEN_DEVICE, approved: false };
    var made, viaKey = false;
    try { made = await rest('POST', '/rest/v1/gmt_users', newRow, 'return=representation'); }
    catch (e1) {
      if (!/approved/i.test(String(e1 && e1.message))) throw e1;
      delete newRow.approved; viaKey = true;
      made = await rest('POST', '/rest/v1/gmt_users', newRow, 'return=representation');
    }
    var row = Array.isArray(made) ? made[0] : made;
    if (!row || row.id == null) {
      var back = await rest('GET', '/rest/v1/gmt_users?username=eq.' + encodeURIComponent(user) +
                                   '&branch_key=eq.' + encodeURIComponent(o.branch.key) + '&select=*');
      row = back && back[0];
    }
    if (!row) throw new Error('أُرسل الحساب لكن تعذّرت قراءته — جرّب تسجيل الدخول');
    await GMTPw.set(row.id, pw);                    /* (TASK-0112) الكلمة إلى الجدول المغلق مشفّرةً */
    if (viaKey) { try { await setKey('user_pending_' + row.id, true); } catch (_) {} }
    row.approved = false;
    var s = setSession(row, o.branch);
    try { document.dispatchEvent(new CustomEvent('gmt:approval', { detail: { pending: true } })); } catch (_) {}
    notifyNewAccount(row, o.branch, o.center);
    if (o.center) {
      /* اسمُ المركز يُطبع تحت اسم الفرع في الفاتورة (centerLine في pos.html يقرأ center_name) */
      s.center_name = String(o.center).trim(); lsSet('gmt_session', JSON.stringify(s));
      lsSet('gmt_profile_' + row.id, JSON.stringify({ center: s.center_name }));
      try { await saveProfile(row.id, { center: s.center_name }); } catch (_) {}
    }
    return s;
  }


  /* (2026-10-04 ك) جوابك «اي»: إشعارٌ لك على تيليغرام كلّما أنشأ أحدٌ حساباً — نفسُ بوت
     نقطة البيع. ثانويٌّ لا يعطّل: مهلة ٦ ثوانٍ، والفشل لا يمنع إنشاء الحساب. */
  function notifyNewAccount(row, br, center) {
    try {
      var T = global.GMT_TELEGRAM; if (!T || !T.token || !T.chat) return;
      var h = function (x) { return String(x == null ? '' : x).replace(/[<>&]/g, function (ch) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]; }); };
      var ua = (navigator.userAgent || '').replace(/\s+/g, ' ').slice(0, 140);
      var text = '<b>🆕 حساب جديد — GMT</b>\n' +
        '<b>الاسم:</b> ' + h(row.display_name) + '\n' +
        '<b>المستخدم:</b> <code>' + h(row.username) + '</code>\n' +
        '<b>الفرع:</b> ' + h(br.name || br.key) + '\n' +
        (center ? '<b>المركز:</b> ' + h(center) + '\n' : '') +
        '<b>الجهاز:</b> ' + h(ua) + '\n' +
        '<b>التوقيت:</b> ' + h(new Date().toLocaleString('ar-SY')) + '\n' +
        '━━━━━━━━━━━━━━━\n⏳ <b>بانتظار موافقتك</b> — يتصفّح فقط حتى توافق من «الأمان والمستخدمون».';
      var ctrl = global.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (_) {} }, 6000);
      fetch('https://api.telegram.org/bot' + T.token + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl ? ctrl.signal : undefined,
        body: JSON.stringify({ chat_id: T.chat, text: text, parse_mode: 'HTML' })
      }).then(function () { clearTimeout(t); }, function () { clearTimeout(t); });
    } catch (_) {}
  }

  /* (٧ ي · طلبك «شاشة تسجيل الدخول أوّل ما يدخل الشخص») الدخول صار باسم المستخدم
     وكلمة السرّ فقط: الفرع يُعرَف من الحساب نفسه. وإن تكرّر الاسم نفسُه بكلمة السرّ
     نفسها في فرعين (نادر) نطلب اختيار الفرع — خطأٌ بـ`code:'pick'` يحمل الفروع. */
  function branchByKey(key) {
    var list = [];
    try { list = JSON.parse(lsGet(LS_BRANCHES, '[]')) || []; } catch (_) {}
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].key === key) return list[i];
    return null;
  }
  async function login(o) {
    var user = cleanUser(o.username), pw = String(o.password || '');
    if (!user || !pw) throw new Error('اكتب اسم المستخدم وكلمة السرّ');
    /* (١١ ت١ · Notes ٨ ت١) «الاسم المستخدم … وكلمة السر فبيدخل لصلاحيات إدارية، والباقي بينشئ حساباً»:
       نموذج الدخول واحد. إن كان الاسم حسابَ أدمن وكلمته صحيحة ⇒ وضع الإدارة باسمه (لا فرع ولا جلسة موظّف). */
    var adminKnown = false;
    try {
      if (global.GMTAuth && GMTAuth.admin && GMTAuth.admin.tryLogin) {
        var ad = await GMTAuth.admin.tryLogin(user, pw);
        if (ad && ad.ok) {
          try { if (global.GMTRole && GMTRole.grant) GMTRole.grant(ad.name); } catch (_) {}
          try { if (global.GMTAuth && GMTAuth.admin && GMTAuth.admin._audit) GMTAuth.admin._audit('admin_login', ad.name); } catch (_) {}
          noteAdmin(ad.name);
          var ares = { admin: true, name: ad.name };
          /* (١٨ ت١) «تذكّر هذا الجهاز»: فشلُه لا يُفشل الدخول، لكنّه يُعلَن ولا يُقال «تمّ» قبل أن يثبت في القاعدة */
          if (o.remember) { try { await GMTAuth.admin.rememberDevice(ad.name); ares.remembered = true; } catch (re) { ares.rememberError = (re && re.message) || 'تعذّر تذكّر الجهاز'; } }
          return ares;
        }
        if (ad && ad.known) { try { if (GMTAuth.admin._audit) GMTAuth.admin._audit('admin_login_fail', user, true); } catch (_) {} }
        adminKnown = !!(ad && ad.known);
        if (ad && ad.error && !ad.known && /محاولات كثيرة/.test(ad.error)) throw new Error(ad.error);
      }
    } catch (e) { if (e && /محاولات كثيرة/.test(e.message || '')) throw e; }
    var q = '/rest/v1/gmt_users?username=eq.' + encodeURIComponent(user) +
            (o.branch && o.branch.key ? '&branch_key=eq.' + encodeURIComponent(o.branch.key) : '') + '&select=*';
    var rows = await rest('GET', q);
    if (!rows || !rows.length) {
      if (adminKnown) throw new Error('كلمة السرّ غير صحيحة');      /* حساب أدمن بكلمة خاطئة: لا «غير موجود» المضلِّلة */
      throw new Error(o.branch && o.branch.key ? 'اسم المستخدم غير موجود في هذا الفرع' : 'اسم المستخدم غير موجود — تأكّد منه أو أنشئ حساباً');
    }
    var okPw = [];
    for (var ri = 0; ri < rows.length; ri++) { if (await GMTPw.check(rows[ri], pw)) okPw.push(rows[ri]); }   /* (TASK-0112) الفحص في القاعدة */
    if (!okPw.length) throw new Error('كلمة السرّ غير صحيحة');
    var live = okPw.filter(function (r) { return r.is_active !== false; });
    if (!live.length) throw new Error('هذا الحساب موقوف — تواصل مع الإدارة');
    if (live.length > 1) {
      if (!branchByKey(live[0].branch_key)) { try { await branches(); } catch (_) {} }
      var err = new Error('هذا الاسم موجود في أكثر من فرع — اختر فرعك');
      err.code = 'pick';
      err.branches = live.map(function (r) { return branchByKey(r.branch_key) || { key: r.branch_key, name: r.branch_key }; });
      throw err;
    }
    var u = live[0];
    if (!o.branch || !o.branch.key) {
      o.branch = branchByKey(u.branch_key);
      if (!o.branch) { try { await branches(); } catch (_) {} o.branch = branchByKey(u.branch_key) || { key: u.branch_key, name: u.branch_key }; }
    }
    /* حسابٌ مقفولٌ على جهازٍ بعينه: بصمةُ الجهاز تحسبها نقطة البيع وحدها، فالدخول
       يتمّ من هناك — لا نكرّر خوارزميّتها هنا فتختلفان بصمت. */
    if (u.last_device_id && u.last_device_id !== OPEN_DEVICE) return { needPos: true, user: u };
    var sess = setSession(u, o.branch);
    try { document.dispatchEvent(new CustomEvent('gmt:approval', { detail: { pending: !!sess.pending } })); } catch (_) {}
    try {
      var pr = await getKey('user_profile_' + u.id);
      if (pr && pr.center) { sess.center_name = pr.center; lsSet('gmt_session', JSON.stringify(sess)); lsSet('gmt_profile_' + u.id, JSON.stringify(pr)); }
    } catch (_) {}
    noteStaff(sess, !!o.remember);
    return { session: sess };
  }

  /* ── الملفّ الشخصيّ والصلاحيات: مفتاحٌ لكل مستخدم في gmt_settings ── */
  async function getKey(key) {
    var r = await rest('GET', '/rest/v1/gmt_settings?key=eq.' + encodeURIComponent(key) + '&select=value');
    if (!r || !r.length) return null;
    try { return JSON.parse(r[0].value); } catch (_) { return r[0].value; }
  }
  async function setKey(key, val) {
    await rest('POST', '/rest/v1/gmt_settings?on_conflict=key', [{ key: key, value: JSON.stringify(val) }],
               'resolution=merge-duplicates,return=minimal');
  }
  async function saveProfile(id, p) {
    var cur = {}; try { cur = (await getKey('user_profile_' + id)) || {}; } catch (_) {}
    var next = Object.assign({}, cur, p, { updated_at: new Date().toISOString() });
    await setKey('user_profile_' + id, next);
    lsSet('gmt_profile_' + id, JSON.stringify(next));
    return next;
  }
  function profileCached(id) { try { return JSON.parse(lsGet('gmt_profile_' + id, 'null')); } catch (_) { return null; } }

  function grantsCached(id) {
    if (id == null) return [];
    try { var g = JSON.parse(lsGet('gmt_grants_' + id, '[]')); return Array.isArray(g) ? g : []; } catch (_) { return []; }
  }
  async function grants(id) {
    if (id == null) return [];
    try {
      var g = await getKey('tool_grants_' + id);
      g = Array.isArray(g) ? g : [];
      lsSet('gmt_grants_' + id, JSON.stringify(g));
      return g;
    } catch (_) { return grantsCached(id); }
  }
  async function setGrants(id, list) {
    if (!isAdmin()) throw new Error('منحُ الصلاحيات للإدارة وحدها');
    var clean = (list || []).filter(function (f) { return typeof f === 'string' && /\.html$/.test(f); });
    await setKey('tool_grants_' + id, clean);
    return clean;
  }


  /* (2026-10-05 س) البند ١٣٤: «المستخدم يغيّر اسمه وسرّه بلا إذن، وأنت تغيّر بلا إذنه».
     تغيير كلمة السرّ يتطلّب القديمة (كي لا يغيّرها من وجد الجهاز مفتوحاً). والإدارة تغيّر من
     «الأمان والمستخدمون» كما هو. */
  async function updateSelf(o) {
    var s = session(); if (!s || s.id == null) throw new Error('سجّل الدخول أوّلاً');
    var patch = {};
    var nm = String(o.display_name || '').trim();
    if (nm && nm !== s.display_name) patch.display_name = nm;
    /* (٨ ث — تدقيق المطابقة) «المستخدم يغيّر اسمه» — كان اسم الدخول لا يتغيّر إلا من الإدارة.
       يتطلّب كلمة السرّ الحالية (من وجد الجهاز مفتوحاً لا يسرق الحساب)، ويُرفض المكرّر. */
    var un = String(o.username || '').trim().toLowerCase();
    if (un && un !== String(s.username || '').toLowerCase()) {
      if (!/^[a-z0-9_.]{3,30}$/.test(un)) throw new Error('اسم الدخول: ٣ أحرف على الأقلّ — إنجليزيّة صغيرة وأرقام و _ و . فقط');
      var me = await rest('GET', '/rest/v1/gmt_users?id=eq.' + encodeURIComponent(s.id) + '&select=id,password_hash');
      if (!o.oldPw || !(await GMTPw.check(me && me[0], o.oldPw))) throw new Error('لتغيير اسم الدخول اكتب كلمة السرّ الحالية');
      var dup = await rest('GET', '/rest/v1/gmt_users?username=eq.' + encodeURIComponent(un) + '&select=id');
      if (Array.isArray(dup) && dup.some(function (r) { return String(r.id) !== String(s.id); })) throw new Error('اسم الدخول «' + un + '» مأخوذ — اختر غيره');
      patch.username = un;
    }
    if (o.newPw) {
      if (String(o.newPw).length < 4) throw new Error('كلمة السرّ الجديدة: ٤ أحرف على الأقلّ');
      if (o.newPw2 != null && o.newPw2 !== o.newPw) throw new Error('كلمتا السرّ الجديدتان غير متطابقتين');
      /* (TASK-0112) التحقّق والتغيير معاً في القاعدة — لا تُقرأ الكلمة القديمة ولا تُكتب في gmt_users */
      await GMTPw.change(s.id, o.oldPw, o.newPw);
    }
    if (Object.keys(patch).length) await rest('PATCH', '/rest/v1/gmt_users?id=eq.' + encodeURIComponent(s.id), patch, 'return=minimal');
    if (patch.display_name) { s.display_name = patch.display_name; lsSet('gmt_session', JSON.stringify(s)); }
    if (patch.username) { s.username = patch.username; lsSet('gmt_session', JSON.stringify(s)); }
    var prof = {};
    if (o.center != null) { prof.center = String(o.center).trim(); s.center_name = prof.center; lsSet('gmt_session', JSON.stringify(s)); }
    if (o.photo) prof.photo = o.photo;
    if (Object.keys(prof).length) { try { await saveProfile(s.id, prof); } catch (_) { lsSet('gmt_profile_' + s.id, JSON.stringify(Object.assign({}, profileCached(s.id) || {}, prof))); } }
    try { refreshCurrent(); } catch (_) {}      /* (١٨ ت١) قائمة حسابات الجهاز تتبع اسمك الجديد */
    return s;
  }

  /* ═══ GMTPw — كلمات سرّ الموظّفين تُفحص وتُحفظ **في القاعدة** (20 ت1 · TASK-0112) ═══
     كان password_hash مجرّد base64 لكلمة السرّ — يُعكس فوراً — ويقرؤه أيّ أحدٍ بالمفتاح العام، والمقارنة تجري في المتصفّح.
     الآن: الدوال gmt_pw_check / gmt_pw_change / gmt_pw_set (SECURITY DEFINER) تحفظ bcrypt في جدولٍ مغلق
     gmt_user_secrets لا يصل إليه المفتاح العام، وتُرحّل الصيغة القديمة عند أوّل دخولٍ ناجح.
     احتياط: إن لم تكن الدوال في القاعدة بعد (404) نعود للمقارنة القديمة كي لا يتوقّف الدخول. */
  function noRpc(e) { return /404|PGRST202|Could not find the function|does not exist/i.test(String(e && e.message || e)); }
  var GMTPw = {
    check: async function (row, pw) {
      if (!row) return false;
      try { return (await rest('POST', '/rest/v1/rpc/gmt_pw_check', { p_user: row.id, p_pw: String(pw || '') })) === true; }
      catch (e) {
        if (!noRpc(e)) throw e;
        var h = row.password_hash; return !!h && h !== '*' && (h === b64(String(pw || '')) || h === String(pw || ''));
      }
    },
    change: async function (id, oldPw, newPw) {
      var r = await rest('POST', '/rest/v1/rpc/gmt_pw_change', { p_user: id, p_old: String(oldPw || ''), p_new: String(newPw || '') });
      if (r !== true) throw new Error('كلمة السرّ الحالية غير صحيحة');
      return true;
    },
    set: async function (id, newPw) {
      var r = await rest('POST', '/rest/v1/rpc/gmt_pw_set', { p_user: id, p_new: String(newPw || '') });
      if (r !== true) throw new Error('تعذّر حفظ كلمة السرّ');
      return true;
    },
    /* القيمة التي تُكتب في password_hash عند الإنشاء (العمود إلزامي): لا شيء يُقرأ منها — الكلمة في الجدول المغلق */
    PLACEHOLDER: '*'
  };
  global.GMTPw = GMTPw;

  /* ═══════════════════════════════════════════════════════════════════════════
     📱 حسابات هذا الجهاز — (١٨ ت١ · وثيقة الطلبات ٩)
     نصّك: «احفظ انت المستخدمين الادمن او لا معهم صلاحيه في كل شيء يعني انا ممكن اسجل نفس الجهاز في اكثر من
     مستخدم عادي ما في كل مره توجعني للمستخدم العادي».

     • كل حسابٍ دخل من هذا الجهاز (أدمن أو موظّف) يُكتب في قائمة الجهاز `gmt_accounts_v1` — الاسم والفرع فقط.
     • «تذكّر هذا الجهاز» عند الدخول ⇒ التبديل إليه **ضغطةٌ واحدة** بلا كلمة سرّ:
         - الموظّف: نحفظ لقطة جلسته نفسها (`gmt_session` — ما يحفظه النظام اليوم أصلاً لكل من دخل)، لا كلمة سرّه.
         - الأدمن: رمز الجهاز وبصمته (GMTAuth.admin.rememberDevice) — لا كلمة سرّ ولا رمزاً في القاعدة.
     • بلا «تذكّر» ⇒ يبقى الاسم في القائمة، والضغط عليه يفتح الدخول باسمه ويطلب كلمة سرّه كما اليوم.
     • `gmt_active_acct` = آخر حسابٍ اخترتَه على هذا الجهاز ⇒ عند فتح التطبيق يُفتح هو (الأدمن لا يُردّ إلى الموظّف).
     ═══════════════════════════════════════════════════════════════════════════ */
  var LS_ACCTS = 'gmt_accounts_v1', LS_ACTIVE = 'gmt_active_acct', MAX_ACCTS = 12;
  function acctsRead() {
    try { var a = JSON.parse(lsGet(LS_ACCTS, '[]')); return Array.isArray(a) ? a.filter(function (x) { return x && (x.t === 'staff' || x.t === 'admin'); }) : []; } catch (_) { return []; }
  }
  function acctsWrite(a) { lsSet(LS_ACCTS, JSON.stringify(a.slice(0, MAX_ACCTS))); }
  function admNorm(n) { try { if (global.GMTAuth && GMTAuth.admin && GMTAuth.admin.normalize) return GMTAuth.admin.normalize(n); } catch (_) {} return String(n || '').replace(/\s+/g, '').toLowerCase(); }
  function acctKey(x) { return x.t === 'admin' ? 'admin:' + x.k : 'staff:' + x.id; }
  function activeKey() { return lsGet(LS_ACTIVE, '') || ''; }
  function setActive(k) { if (k) lsSet(LS_ACTIVE, k); else { try { localStorage.removeItem(LS_ACTIVE); } catch (_) {} } }
  function upsert(e) {
    var a = acctsRead(), k = acctKey(e), cur = null;
    a = a.filter(function (x) { if (acctKey(x) === k) { cur = x; return false; } return true; });
    a.unshift(e); acctsWrite(a);
    return cur;
  }
  /* دخل موظّف (من الرئيسيّة أو نقطة البيع). remember: true/false، أو null = أبقِ ما كان */
  function noteStaff(sess, remember) {
    if (!sess || sess.id == null) return;
    var old = null; acctsRead().forEach(function (x) { if (acctKey(x) === 'staff:' + sess.id) old = x; });
    var rem = remember == null ? !!(old && old.rem) : !!remember;
    var e = { t: 'staff', id: sess.id, username: sess.username || '', name: sess.display_name || sess.username || '',
              branch_key: sess.branch_key || '', branch_name: sess.branch_name || (old && old.branch_name) || '', at: Date.now() };
    if (rem) { e.rem = true; e.sess = sess; }
    upsert(e); setActive('staff:' + sess.id);
  }
  /* دخل أدمن باسمه — «تذكّر» نفسه يُحفظ في GMTAuth (هذه القائمة للعرض والتبديل) */
  function noteAdmin(name) {
    var n = String(name || '').trim(); if (!n) return;
    upsert({ t: 'admin', k: admNorm(n), name: n, at: Date.now() }); setActive('admin:' + admNorm(n));
  }
  /* هل هذا الأدمن «مُذكَّر» على الجهاز؟ — {name,k} أو null. صفحاتٌ تحمّل هذا الملفّ قبل gmt-auth.js (نقطة البيع):
     نقرأ علامة التذكّر نفسها من localStorage مباشرةً. */
  function remInfo(k) {
    try { if (global.GMTAuth && GMTAuth.admin && GMTAuth.admin.remembered) return GMTAuth.admin.remembered(k) || null; } catch (_) {}
    if (global.GMTAuth) return null;
    try {
      var all = JSON.parse(lsGet('gmt_admin_devices_v2', '[]')) || [];
      var o1 = JSON.parse(lsGet('gmt_admin_device_v1', 'null')); if (o1) all.push(o1);
      for (var i = 0; i < all.length; i++) if (all[i] && all[i].k === k && all[i].t) return { name: all[i].n, k: all[i].k };
    } catch (_) {}
    return null;
  }
  /* لقطة الجلسة الحاليّة تُحدَّث قبل الانتقال عنها (الاسم والمركز قد تغيّرا من «حسابي») */
  function refreshCurrent() {
    var s = session(); if (!s || s.id == null) return;
    var a = acctsRead(), ch = false;
    a.forEach(function (x) { if (x.t === 'staff' && String(x.id) === String(s.id)) { x.name = s.display_name || x.name; x.username = s.username || x.username; x.branch_name = s.branch_name || x.branch_name; if (x.rem) x.sess = s; ch = true; } });
    if (ch) acctsWrite(a);
  }
  function savedList() {
    var s = session(), adm = isAdmin(), an = ''; try { an = adm && global.GMTRole && GMTRole.name ? GMTRole.name() : ''; } catch (_) {}
    return acctsRead().map(function (x) {
      var o = { key: acctKey(x), t: x.t, name: x.name || x.username || '', username: x.username || '', branch_key: x.branch_key || '', branch_name: x.branch_name || '', at: x.at || 0 };
      if (x.t === 'admin') { o.rem = !!remInfo(x.k); o.current = adm && admNorm(an) === x.k; }
      else { o.rem = !!(x.rem && x.sess); o.current = !adm && !!s && String(s.id) === String(x.id); }
      return o;
    });
  }
  /* خروجٌ صريح: لا جلسة محفوظة بعده (يبقى الاسم في القائمة ويُطلب سرّه). للأدمن يُمحى رمز الجهاز من القاعدة أيضاً. */
  async function loggedOut(kind, idOrName) {
    var k = kind === 'admin' ? 'admin:' + admNorm(idOrName) : 'staff:' + idOrName;
    var a = acctsRead();
    a.forEach(function (x) { if (acctKey(x) === k) { delete x.rem; delete x.sess; } });
    acctsWrite(a);
    if (activeKey() === k) setActive('');
    if (kind === 'admin') { try { await GMTAuth.admin.forgetDevice(admNorm(idOrName)); } catch (_) {} }
  }
  /* إزالة الحساب من الجهاز كلّياً (الحساب نفسه في القاعدة لا يُلمس) */
  async function forgetAcct(key) {
    var a = acctsRead(), hit = null;
    a = a.filter(function (x) { if (acctKey(x) === key) { hit = x; return false; } return true; });
    acctsWrite(a);
    if (hit && hit.t === 'admin') {
      try { if (remInfo(hit.k)) await GMTAuth.admin.forgetDevice(hit.k); } catch (_) {}
    }
    if (activeKey() === key) setActive('');
    return !!hit;
  }
  /* تشغيل/إيقاف «تذكّر هذا الجهاز» للحساب الحالي — {ok} أو {error} (لا نقول «تمّ» قبل أن يثبت) */
  async function setRemember(key, on) {
    var x = null; acctsRead().forEach(function (y) { if (acctKey(y) === key) x = y; });
    if (!x) return { error: 'الحساب غير موجود على هذا الجهاز' };
    if (x.t === 'staff') {
      var s = session();
      if (!s || String(s.id) !== String(x.id)) return { error: 'ادخل بهذا الحساب أوّلاً ثم فعّل «تذكّر هذا الجهاز»' };
      refreshCurrent(); noteStaff(s, !!on);
      return { ok: true, on: !!on };
    }
    try {
      if (on) { if (!isAdmin() || admNorm(global.GMTRole && GMTRole.name ? GMTRole.name() : '') !== x.k) return { error: 'ادخل بهذا الحساب أوّلاً ثم فعّل «تذكّر هذا الجهاز»' }; await GMTAuth.admin.rememberDevice(x.name); }
      else await GMTAuth.admin.forgetDevice(x.k);
    } catch (e) { return { error: (e && e.message) || 'تعذّر الحفظ' }; }
    return { ok: true, on: !!on };
  }
  /* هل الحساب ما زال قائماً وفعّالاً؟ — null إن تعذّر السؤال (لا اتصال: جلسات الموظّفين تعمل بلا شبكة كما كانت) */
  async function staffStatus(id) {
    try {
      var rows = await rest('GET', '/rest/v1/gmt_users?id=eq.' + encodeURIComponent(id) + '&select=id,is_active');
      if (!Array.isArray(rows)) return null;
      if (!rows.length) return { gone: true };
      return { active: rows[0].is_active !== false };
    } catch (_) { return null; }
  }
  /* التبديل: {ok,kind} · {needPw:true, kind, username|name} (حسابٌ غير مُذكَّر — اطلب كلمة سرّه) · {error} */
  async function switchTo(key) {
    var x = null; acctsRead().forEach(function (y) { if (acctKey(y) === key) x = y; });
    if (!x) return { error: 'الحساب غير موجود على هذا الجهاز' };
    refreshCurrent();
    if (x.t === 'staff') {
      if (!x.rem || !x.sess) return { needPw: true, kind: 'staff', username: x.username, name: x.name };
      var st = await staffStatus(x.id);
      if (st && st.gone) { await forgetAcct(key); return { error: 'هذا الحساب لم يعد موجوداً — أُزيل من الجهاز' }; }
      if (st && st.active === false) return { error: 'هذا الحساب موقوف — تواصل مع الإدارة' };
      /* موظّفٌ لا أدمن: وضع الإدارة لهذا التبويب يُغلق (حساب الأدمن المُذكَّر يبقى في القائمة) */
      try { if (isAdmin() && global.GMTRole && GMTRole.revoke) GMTRole.revoke(); } catch (_) {}
      try { sessionStorage.removeItem('gmt_admin_mode'); sessionStorage.removeItem('gmt_admin_name'); sessionStorage.removeItem('gmt_acting'); } catch (_) {}
      lsSet('gmt_session', JSON.stringify(x.sess));
      if (x.sess.branch_key) lsSet('gmt_branch', x.sess.branch_key);
      setActive(key);
      try { document.dispatchEvent(new CustomEvent('gmt:approval', { detail: { pending: isPending() } })); } catch (_) {}
      return { ok: true, kind: 'staff', session: x.sess };
    }
    /* أدمن */
    try {
      if (remInfo(x.k) && global.GMTAuth && GMTAuth.admin && GMTAuth.admin.restoreDevice) {
        var r = await GMTAuth.admin.restoreDevice(x.k);
        if (r && r.ok) { setActive(key); return { ok: true, kind: 'admin', name: r.name }; }
        if (r && r.offline) return { error: 'لا اتصال بالقاعدة — تعذّر التحقّق من حساب الإدارة. أعد المحاولة بعد عودة الإنترنت' };
      }
    } catch (_) {}
    lsSet('gmt_admin_last', x.name || '');
    return { needPw: true, kind: 'admin', name: x.name };
  }
  /* هل آخر ما اختير على هذا الجهاز أدمنٌ مُذكَّر؟ (يُفتح عند فتح التطبيق بدل الموظّف) */
  function activeAdmin() {
    var k = activeKey(); if (k.indexOf('admin:') !== 0) return null;
    var r = remInfo(k.slice(6));
    return r ? { k: k.slice(6), name: r.name } : null;
  }
  /* «حساب آخر»: الجلسة الحاليّة تُغلق والحساب يبقى في القائمة (والمُذكَّر منه يعود بضغطة) — بخلاف «خروج» الذي ينسى التذكّر */
  function leaveCurrent() {
    var s = session(), adm = isAdmin();
    if (adm) { try { refreshCurrent(); GMTRole.revoke(); } catch (_) {} try { sessionStorage.removeItem('gmt_acting'); } catch (_) {} }
    else { refreshCurrent(); try { localStorage.removeItem('gmt_session'); } catch (_) {} }
    setActive('');
    return !!(s || adm);
  }

  global.GMTAccount = {
    /* (١٨ ت١) حسابات الجهاز والتبديل بضغطة */
    saved: { list: savedList, noteStaff: noteStaff, noteAdmin: noteAdmin, loggedOut: loggedOut, forget: forgetAcct,
             switchTo: switchTo, active: activeKey, setActive: setActive, activeAdmin: activeAdmin, refresh: refreshCurrent,
             setRemember: setRemember, leave: leaveCurrent },
    OPEN_DEVICE: OPEN_DEVICE, branches: branches, signup: signup, login: login,
    session: session, setSession: setSession, isAdmin: isAdmin,
    saveProfile: saveProfile, profile: profileCached,
    grants: grants, grantsCached: grantsCached, setGrants: setGrants, b64: b64, updateSelf: updateSelf,
    isPending: function () { return isPending(); }, checkApproval: function () { return checkApproval(); },
    approveUser: function (id) { return approveUser(id); }, pendingUsers: function () { return pendingUsers(); }
  };

  /* ═══ GMTPerm — من يفتح ماذا ═══
     الأدمن: كل شيء. غيرُه: أدواتُ الموظّف والزبون، وما منحتَه له بالاسم. */
  function currentFile() {
    var p = '';
    try { p = decodeURIComponent(location.pathname.split('/').pop() || ''); } catch (_) { p = location.pathname.split('/').pop() || ''; }
    return p || 'index.html';
  }
  function adminOnly(f) {
    var T = global.GMTTools; if (!T) return false;
    var hits = T.all.filter(function (x) { return x.f === f; });
    if (!hits.length) return false;                      // صفحةٌ ليست في السجلّ ⇒ لا نحكم عليها
    return hits.every(function (x) { return x.a === 'admin'; });
  }
  function can(f, ids) {
    if (isAdmin()) return true;
    if (!adminOnly(f)) return true;
    var s = session();
    var g = ids || (s ? grantsCached(s.id) : []);
    return g.indexOf(f) >= 0;
  }

  /* ── الحارس: يُحمَّل في رأس كل صفحةٍ إداريّة ── */
  var LOCK_ID = 'gmt-lock';
  function lockCss() {
    if (document.getElementById('gmt-lock-css')) return;
    var st = document.createElement('style'); st.id = 'gmt-lock-css';
    /* (١١ ت١) استثناء نوافذ السؤال: «دخول الإدارة» من شاشة القفل يفتح نافذةَ GMTAsk في body — وكانت تُخفى بـdisplay:none
       مع بقيّة الصفحة فلا تظهر أيّ نافذةٍ ولا يمكن فتح الصفحة المقفولة أبداً (اكتُشف باختبار القفل فعلياً). */
    st.textContent = 'html.gmt-locked body>*:not(#' + LOCK_ID + '):not(.gmtask-ov){display:none!important}' +
      '#' + LOCK_ID + '{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:20px;' +
      'background:radial-gradient(900px 420px at 100% -10%,#ffe3e6 0,transparent 60%),#f7f8fa;' +
      "font:15px/1.7 'Segoe UI',Tahoma,system-ui,sans-serif;color:#0f1219;direction:rtl}" +
      '#' + LOCK_ID + ' .b{width:100%;max-width:440px;background:#fff;border:1px solid rgba(15,18,25,.08);border-radius:22px;' +
      'padding:26px 22px;box-shadow:0 1px 2px rgba(15,18,25,.05),0 10px 30px rgba(15,18,25,.06);text-align:center}' +
      '#' + LOCK_ID + ' .i{width:56px;height:56px;border-radius:16px;margin:0 auto 12px;display:grid;place-items:center;background:#fff1f2;color:#D5001C}' +
      /* (٧ ي-٤) لون العنوان صريح: صفحاتٌ داكنة (لوحة التجريب) تجعل h1 أبيض ⇒ كان العنوان أبيضَ على بطاقةٍ بيضاء */
      '#' + LOCK_ID + ' h1{margin:0 0 6px;font-size:20px;color:#0f1219;text-shadow:none}#' + LOCK_ID + ' p{margin:0 0 18px;color:#4b5563;font-size:14px}' +
      '#' + LOCK_ID + ' .a{display:flex;flex-direction:column;gap:9px}' +
      '#' + LOCK_ID + ' button,#' + LOCK_ID + ' a{display:block;width:100%;padding:12px;border-radius:12px;font:inherit;font-weight:800;' +
      'text-decoration:none;cursor:pointer;border:1px solid rgba(15,18,25,.1);background:#fff;color:#0f1219}' +
      '#' + LOCK_ID + ' .p{background:#D5001C;border-color:#D5001C;color:#fff}' +
      '#' + LOCK_ID + ' .m{margin-top:10px;font-size:12.5px;color:#b91c1c;min-height:1em}';
    (document.head || document.documentElement).appendChild(st);
  }
  function toolTitle(f) { var T = global.GMTTools, x = T && T.find(f); return x ? x.t : f; }
  function ensureAuth() {
    return new Promise(function (res) {
      if (global.GMTAuth) return res(true);
      var s = document.createElement('script'); s.src = 'gmt-auth.js?v=20261024d';
      s.onload = function () { res(!!global.GMTAuth); }; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }
  async function adminUnlock(msg) {
    /* بلا وحدة كلمات السرّ لا نفتح — وحدةُ الأدوار القديمة كانت تفتح بلا سؤال إن غابت */
    if (!(await ensureAuth()) || !global.GMTAuth || !GMTAuth.ask) { msg.textContent = 'تعذّر تحميل وحدة كلمات السرّ — حدّث الصفحة'; return; }
    /* (١١ ت١) حساب أدمن باسمه — لا الكلمة السيادية المشتركة. النافذة تمنح الجلسة بنفسها. */
    var ok;
    if (GMTAuth.admin && GMTAuth.admin.login) ok = !!(await GMTAuth.admin.login('فتح «' + toolTitle(currentFile()) + '»'));
    else {
      ok = await GMTAuth.ask('sovereign', '🔒 فتح «' + toolTitle(currentFile()) + '» — للإدارة');
      if (ok) { try { if (global.GMTRole && GMTRole.grant) GMTRole.grant(); else sessionStorage.setItem('gmt_admin_mode', '1'); } catch (_) {} }
    }
    if (ok) unlock(); else msg.textContent = 'لم يُفتح — الدخول للأدمن وحده';
  }
  function unlock() {
    document.documentElement.classList.remove('gmt-locked');
    var el = document.getElementById(LOCK_ID); if (el) el.parentNode.removeChild(el);
  }
  function showLock() {
    if (document.getElementById(LOCK_ID) || !document.body) return;
    var f = currentFile(), s = session();
    var box = document.createElement('div'); box.id = LOCK_ID; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="b"><div class="i"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>' +
      '<h1>«' + toolTitle(f).replace(/[<>&]/g, '') + '» تحتاج صلاحية</h1>' +
      '<p>' + (s ? 'هذه الأداة للإدارة. اطلب من المدير أن يمنحك الوصول إليها من «الأمان والمستخدمون ⇠ الصلاحيات»، أو ادخل بوضع الإدارة.'
                 : 'سجّل دخولك أوّلاً من الواجهة الرئيسيّة. هذه الأداة للإدارة أو لمن مُنح صلاحيتها.') + '</p>' +
      '<div class="a"><button class="p" type="button" data-lk="admin">دخول الإدارة</button><a href="home.html">رجوع للرئيسيّة</a></div><div class="m" aria-live="polite"></div></div>';
    document.body.appendChild(box);
    box.querySelector('[data-lk="admin"]').addEventListener('click', function () { adminUnlock(box.querySelector('.m')); });
  }
  function guard() {
    var f = currentFile();
    if (!adminOnly(f) || can(f)) return;
    lockCss();
    document.documentElement.classList.add('gmt-locked');
    if (document.body) showLock(); else document.addEventListener('DOMContentLoaded', showLock);
    /* (١٨ ت١) أدمنٌ مُذكَّر على هذا الجهاز وهو آخر من اختير ⇒ نفتح وضع الإدارة من التذكّر بدل شاشة القفل
       (فتح أداةٍ إداريّة برابطٍ مباشر في جلسةٍ جديدة) — الفحص في القاعدة كالدخول تماماً. */
    var _ra = activeAdmin();
    if (_ra) {
      var tryRem = function () {
        ensureAuth().then(function (okA) {
          if (!okA || !global.GMTAuth || !GMTAuth.admin || !GMTAuth.admin.restoreDevice) return;
          GMTAuth.admin.restoreDevice(_ra.k).then(function (r) { if (r && r.ok && can(f)) unlock(); }, function () {});
        });
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryRem); else tryRem();
    }
    /* الصلاحيةُ قد تكون مُنحت للتوّ ولم تصل نسختُها المحفوظة بعد — نسأل القاعدة */
    var s = session();
    if (s && s.id != null) {
      var later = function () { grants(s.id).then(function (g) { if (can(f, g)) unlock(); }); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later); else later();
    }
  }


  /* ═══ (2026-10-05 ع) الحساب المعلّق: تصفّحٌ فقط حتى موافقة الإدارة ═══
     • كل صفحةٍ داخليّة تسأل القاعدة عن حالة الحساب عند فتحها (فإذا وافقتَ يُفتح عنده تلقائياً).
     • ما دام معلّقاً: **كل كتابةٍ على القاعدة تُمنع** (إضافة · تعديل · حذف · رفع ملفّات) برسالةٍ واضحة،
       والقراءة تعمل — فيتصفّح كلّ شيء كما في وضع التدريب ولا يغيّر شيئاً.
     • المستثنى: تعديلُ ملفّه الشخصيّ فقط (اسمه · مركزه · صورته · كلمة سرّه).
     • صفحاتُ الزبون (المتجر · الموقع · التتبّع · الكفالة · التوظيف) لا تتأثّر أبداً. */
  /* حالةُ الموافقة في مفتاحٍ مستقلّ: نقطة البيع تعيد كتابة gmt_session من ذاكرتها، فلو عاشت الحالة فيه
     لرجعت «معلّقة» بعد أن تُرفع. */
  function isPending() {
    var s = session(); if (!s || isAdmin()) return false;
    var k = lsGet('gmt_pending_' + s.id, null);
    return k != null ? k === '1' : !!s.pending;
  }
  async function checkApproval() {
    var s = session(); if (!s || s.id == null) return null;
    var pending = null;
    try {
      var r = await rest('GET', '/rest/v1/gmt_users?id=eq.' + encodeURIComponent(s.id) + '&select=*');
      var u = r && r[0];
      if (u) {
        if (u.approved === false) pending = true;
        else if (u.approved === true) pending = false;
        else { var k = null; try { k = await getKey('user_pending_' + s.id); } catch (_) {} pending = !!k; }
        if (u.is_active === false) pending = true;
      }
    } catch (_) { return isPending(); }
    if (pending !== null) {
      var was = isPending();
      lsSet('gmt_pending_' + s.id, pending ? '1' : '0');
      if (!!s.pending !== pending) { s.pending = pending; lsSet('gmt_session', JSON.stringify(s)); }
      if (was !== pending) { try { document.dispatchEvent(new CustomEvent('gmt:approval', { detail: { pending: pending } })); } catch (_) {} }
    }
    return pending;
  }
  async function approveUser(id) {
    if (!isAdmin()) throw new Error('الموافقة للإدارة وحدها');
    try { await rest('PATCH', '/rest/v1/gmt_users?id=eq.' + encodeURIComponent(id), { approved: true }, 'return=minimal'); } catch (e) { if (!/approved/i.test(String(e && e.message))) throw e; }
    try { await rest('DELETE', '/rest/v1/gmt_settings?key=eq.user_pending_' + encodeURIComponent(id), null, 'return=minimal'); } catch (_) {}
  }
  async function pendingUsers() {
    var out = [];
    /* (٨ ج) غياب العمود (SQL 25 لم يُشغَّل) لا يُعاد سؤاله في كل فتحٍ — كان يملأ تقرير الحارس بـ42703 */
    var _noCol = false; try { _noCol = sessionStorage.getItem('gmt_no_users_approved') === '1'; } catch (_) {}
    if (!_noCol) {
      try { out = (await rest('GET', '/rest/v1/gmt_users?approved=is.false&select=id,display_name,username,branch_key,created_at')) || []; }
      catch (e) { out = []; if (/42703|approved|does not exist/i.test(String(e && e.message))) { try { sessionStorage.setItem('gmt_no_users_approved', '1'); } catch (_) {} } }
    }
    try {
      var ks = (await rest('GET', '/rest/v1/gmt_settings?key=like.user_pending_*&select=key')) || [];
      var ids = ks.map(function (k) { return String(k.key).replace('user_pending_', ''); }).filter(function (id) { return !out.some(function (u) { return String(u.id) === id; }); });
      if (ids.length) { var more = (await rest('GET', '/rest/v1/gmt_users?id=in.(' + ids.join(',') + ')&select=id,display_name,username,branch_key,created_at')) || []; out = out.concat(more); }
    } catch (_) {}
    return out;
  }

  function publicPage() {
    var T = global.GMTTools, f = currentFile(); if (!T) return false;
    return T.all.some(function (x) { return x.f === f && x.a === 'public'; });
  }
  function selfWrite(url, method, body) {
    var s = session(); if (!s) return false;
    var id = encodeURIComponent(String(s.id));
    if (/\/rest\/v1\/gmt_users\?id=eq\./.test(url) && url.indexOf('id=eq.' + id) >= 0 && method === 'PATCH') {
      try { var b = JSON.parse(body || '{}'); return Object.keys(b).every(function (k) { return k === 'display_name' || k === 'password_hash' || k === 'username'; }); } catch (_) { return false; }
    }
    if (/\/rest\/v1\/gmt_settings/.test(url)) {
      try { var arr = JSON.parse(body || '[]'); arr = Array.isArray(arr) ? arr : [arr]; return arr.length && arr.every(function (r) { return r && r.key === 'user_profile_' + s.id; }); } catch (_) { return false; }
    }
    return false;
  }
  var _blockToastAt = 0;
  function blockedNotice() {
    if (Date.now() - _blockToastAt < 2500) return; _blockToastAt = Date.now();
    var m = 'حسابك بانتظار موافقة الإدارة — التصفّح متاح، والتعديل يُفتح بعد الموافقة';
    try { if (typeof global.showToast === 'function') { global.showToast('⏳ ' + m, 'err'); return; } } catch (_) {}
    try { if (global.GMTAsk && GMTAsk.toast) { GMTAsk.toast(m); return; } } catch (_) {}
  }
  if (global.fetch && !global.__gmtPendingFetch) {
    global.__gmtPendingFetch = true;
    var _f = global.fetch.bind(global);
    global.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD' && isPending() && !publicPage() &&
            /\/(rest|storage)\/v1\//.test(url) && !/\/rest\/v1\/rpc\/(?!add_|deduct_)/.test(url) &&
            !selfWrite(url, method, init && init.body)) {
          blockedNotice();
          return Promise.resolve(new Response(JSON.stringify({ message: 'حسابك بانتظار موافقة الإدارة — تصفّحٌ فقط' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }));
        }
      } catch (_) {}
      return _f(input, init);
    };
  }

  /* ═══ (2026-10-05 ر) البند ١٦: سلّة محذوفات للمشروع كلّه ═══
     نصطاد الحذف عند **طبقة الشبكة** — كما في تراجع الجرد — بدل تعديل عشرات أزرار الحذف:
     قبل أيّ DELETE على جدولٍ داخليّ نقرأ الصفوف المطابقة، وبعد نجاح الحذف ننسخها إلى gmt_trash
     (SQL ٢٧). إن لم يُشغَّل الملف بعد لا يتغيّر شيء — الحذف يمضي كما كان. */
  var TRASH_SKIP = /^(gmt_trash|gmt_settings|gmt_audit\w*|gmt_cache\w*|gmt_sessions?)$/;
  function dbNameOf(url) {
    try { var D = global.GMT_DB || {}; for (var k in D) if (D[k] && D[k].url && url.indexOf(D[k].url) === 0) return k; } catch (_) {}
    return 'MAIN';
  }
  function labelOf(r) { return String(r.name || r.customer_name || r.inv_number || r.title || r.product_name || r.display_name || r.username || r.transfer_number || r.code || r.id || '').slice(0, 120); }
  var _trashOff = false;
  if (global.fetch && !global.__gmtTrashFetch) {
    global.__gmtTrashFetch = true;
    var _tf = global.fetch.bind(global);
    global.fetch = async function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = String((init && init.method) || 'GET').toUpperCase();
      var m = method === 'DELETE' && !_trashOff && url.match(/\/rest\/v1\/([a-z_0-9]+)\?(.+)$/);
      if (!m || TRASH_SKIP.test(m[1]) || publicPage()) return _tf(input, init);
      var rows = null, hdr = (init && init.headers) || {};
      try {
        var getUrl = url.replace(/([?&])select=[^&]*/,'$1').replace(/&&+/g, '&') + (/[?&]select=/.test(url) ? '' : '&select=*');
        var gr = await _tf(getUrl, { method: 'GET', headers: hdr });
        if (gr.ok) rows = await gr.json();
      } catch (_) {}
      var res = await _tf(input, init);
      /* (٧ ط) بيانات الفاحص الذاتي (موسومة __GMT_TEST__) لا تدخل السلّة — هي تُنشأ لتُحذف */
      if (Array.isArray(rows)) rows = rows.filter(function (r) {
        try { return !(JSON.stringify(r).indexOf('__GMT_TEST__') >= 0 || /^TEST-/.test(r.barcode || '') || /^TESTCP-/.test(r.code || '') || /^gmttest\d+$/.test(r.username || '')); } catch (_) { return true; }
      });
      if (res && res.ok && Array.isArray(rows) && rows.length) {
        try {
          var d = db(); var s = session();
          var who = isAdmin() ? 'الإدارة' : ((s && (s.display_name || s.username)) || '');
          var payload = rows.slice(0, 200).map(function (r) { return { tbl: m[1], db: dbNameOf(url), row_id: String(r.id == null ? '' : r.id), label: labelOf(r), data: r, deleted_by: who, page: currentFile() }; });
          if (d) {
            var tr = await _tf(d.url + '/rest/v1/gmt_trash', { method: 'POST', headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
            if (!tr.ok && (tr.status === 404 || tr.status === 400)) _trashOff = true;   // SQL ٢٧ لم يُشغَّل
          }
        } catch (_) {}
      }
      return res;
    };
  }

  function pendingBanner() {
    var id = 'gmt-pending-bar', el = document.getElementById(id);
    if (!isPending() || publicPage()) { if (el) el.remove(); return; }
    if (el || !document.body) return;
    el = document.createElement('div'); el.id = id; el.setAttribute('data-keep-fab', '1'); el.setAttribute('role', 'status');
    el.style.cssText = 'position:sticky;top:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 14px;' +
      'background:#fffbeb;border-bottom:1px solid #fde68a;color:#78350f;font:700 13px/1.6 "Segoe UI",Tahoma,system-ui,sans-serif;direction:rtl;text-align:center';
    el.innerHTML = '<span>⏳</span><span>حسابك <b>بانتظار موافقة الإدارة</b> — تتصفّح كلّ شيء، والتعديل يُفتح تلقائياً بعد الموافقة.</span>';
    document.body.insertBefore(el, document.body.firstChild);
  }
  function bootApproval() {
    pendingBanner();
    checkApproval().then(function () { pendingBanner(); });
    document.addEventListener('gmt:approval', pendingBanner);
    /* بعض الصفحات تعيد بناء جسمها بعد التحميل فتمحو الشريط — نُعيده إن غاب */
    setInterval(pendingBanner, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootApproval); else bootApproval();

  /* (١١ ت١) سجل العمليات: يُحمَّل على كل صفحةٍ داخليّة (ما عدا أدوات الفحص — تُنشئ بياناتٍ تجريبيّةً وتحذفها) */
  function loadOpLog() {
    try {
      if (global.GMTOpLog || publicPage() || global.GMT_NO_OPLOG) return;
      if (/^(check|checks|central_inspector|guard_bots|guard_bots_19|test_board|system_tools)\.html$/.test(currentFile())) return;
      if (document.querySelector('script[src^="gmt-oplog.js"]')) return;
      var s = document.createElement('script'); s.src = 'gmt-oplog.js?v=20261011n'; s.defer = true;
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadOpLog); else loadOpLog();

  /* (١٨ ت١ · وثيقة الطلبات ٩) «المستخدم العادي أوّل ما يفتح التطبيق ⇒ تفتح له نقطته مباشرة»:
     علامةُ «هذا التبويب فُتح» تضعها كلُّ صفحةٍ داخليّةٍ غير الرئيسيّة، فيعرف home.html أنّ الدخول إليه الآن تنقّلٌ داخليّ
     (زرّ «الرئيسية» من نقطة البيع مثلاً) لا فتحُ تطبيقٍ جديد — فلا يرتدّ المستخدم إلى نقطته كلّما أراد الرئيسيّة. */
  try { if (!/^(home|index)\.html$/i.test(currentFile())) sessionStorage.setItem('gmt_tab_seen', '1'); } catch (_) {}

  global.GMTPerm = { can: can, adminOnly: adminOnly, guard: guard, unlock: unlock, file: currentFile };
  if (!global.GMT_NO_GUARD) guard();
})(window);
