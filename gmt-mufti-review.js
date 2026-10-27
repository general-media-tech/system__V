/* ═══════════════════════════════════════════════════════════════════════════
   🔎 مراجعة شحنات المفتي — (TASK-0217 · المالك seq 147)
   «بوت صغير يعمل فقط مع شركه المفتي يتحقق من جميع شحنات المفتي مره واحده … كلهم في صفحه واحده
    يعني يكتب لي الاوردر وتحته يعرض لي … مكان اللي اشرت لك عليه في الدائره … اذا استلم بعطيه تاكيد استلام»

   كيف: صفحة تتبّع المفتي (Oracle APEX، http) لا تُفتح ولا تُقرأ من متصفّحٍ داخل النظام (أصلٌ آخر + http)،
   فتقرؤها دالّة الخادم `gmt-mufti` كما يقرؤها المتصفّح تماماً: تُدخل الرقم ⇒ ترجع «مسار الشحنة» (الخطوات الأربع)
   و«حالة الشحنة» وتاريخها والمرسل والمستلم. **قراءة فقط** — لا تكتب شيئاً في موقعهم ولا في قاعدتنا.
   تأكيد الاستلام يبقى قرارك: الزرّ يفتح «تأكيد الاستلام» القائم نفسه (requestConfirm) بكل ما بعده
   (تاريخ الاستلام · رسالة الشكر · سجلّ الزبون …).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var FN = 'gmt-mufti', BATCH = 3, ID = 'gmt-mr';
  var STEP_LABELS = ['تم استلام الشحنة', 'على الطريق وقيد النقل', 'وصلت فرع الوجهة', 'تم التسليم للمرسل إليه'];
  /* (TASK-0219 · المالك seq 148) «ما لازم يخزنها كل مره اضغط يعمل بحث جديد … فقط شحنات التي لم نؤكد الاستلام»:
     لا تخزين — النتائج في الذاكرة لهذه النافذة فقط، وكل فتحٍ وكل «تحقّق من الكل» يمسحها ويقرأ الكل من موقع المفتي من جديد. */
  var state = { list: [], res: {}, busy: false, run: 0, filter: 'all' };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function digits(s) { return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); }).replace(/\D/g, ''); }
  function allOrders() { try { return (typeof orders !== 'undefined' && Array.isArray(orders)) ? orders : []; } catch (_) { return []; } }
  function isMufti(o) {
    var c = String(o.shipping_company || '').trim();
    try { if (g.GMTOffices && GMTOffices.canonCompany) return GMTOffices.canonCompany(c) === 'المفتي'; } catch (_) {}
    return /مفت/.test(c);
  }
  function pickList() {
    /* فقط ما لم نؤكّد استلامه («في الطريق») */
    return allOrders().filter(function (o) { return isMufti(o) && o.status === 'shipped' && digits(o.tracking_number); })
      .sort(function (a, b) { return new Date(a.shipped_at || a.created_at || 0) - new Date(b.shipped_at || b.created_at || 0); });
  }

  /* نداء الخادم: دفعةٌ من الأرقام ⇒ {n: نتيجة} */
  function fetchBatch(nums) {
    var db = g.GMT_DB && g.GMT_DB.MAIN;
    if (!db || !db.url || !db.key) return Promise.reject(new Error('لا اتصال بالقاعدة في هذه الصفحة'));
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var tm = ac ? setTimeout(function () { try { ac.abort(); } catch (_) {} }, 60000) : null;
    return fetch(db.url + '/functions/v1/' + FN, {
      method: 'POST', cache: 'no-store', signal: ac ? ac.signal : undefined,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + db.key, apikey: db.key },
      body: JSON.stringify({ nums: nums })
    }).then(function (r) {
      if (tm) clearTimeout(tm);
      if (!r.ok) throw new Error('الخادم ردّ ' + r.status);
      return r.json();
    }).then(function (d) {
      if (!d || !d.ok) throw new Error(d && d.error === 'page_changed' ? 'تغيّر شكل صفحة المفتي — بلّغ المطوّر' : 'تعذّرت القراءة' + (d && d.error ? ' (' + d.error + ')' : ''));
      var m = {}; (d.out || []).forEach(function (x) { m[x.n] = x; }); return m;
    }, function (e) { if (tm) clearTimeout(tm); throw e; });
  }

  /* الفئة: ٤ = استلمها الزبون · ٣ = في فرع الوجهة · ١–٢ = في الطريق · nf = غير موجود · err */
  function cls(r) {
    if (!r) return 'wait';
    if (r.error && !r.ok) return 'err';
    if (!r.found) return 'nf';
    if (r.level >= 4 || /من قبل المرسل إليه|تم التسليم/.test(r.status || '')) return 'got';
    if (r.level === 3) return 'branch';
    return 'road';
  }
  /* (TASK-0219 · seq 149) «بهويتنا البصرية»: الأحمر #D5001C والأسود #111 كما في صفحة تتبّعنا */
  var CLS = {
    got: { t: '✅ استلمها الزبون', c: '#ffffff', bg: '#111111' },
    branch: { t: '📍 في فرع الوجهة', c: '#D5001C', bg: '#fff1f2' },
    road: { t: '🚚 في الطريق', c: '#334155', bg: '#f1f5f9' },
    nf: { t: '❓ الرقم غير موجود عندهم', c: '#b45309', bg: '#fffbeb' },
    err: { t: '⚠️ تعذّرت القراءة', c: '#b45309', bg: '#fffbeb' },
    wait: { t: '⏳ جارٍ البحث…', c: '#64748b', bg: '#f1f5f9' }
  };

  /* اسم المستلم عندهم لا يشبه اسم زبوننا ⇒ ربّما رقمٌ خاطئ على الأوردر */
  function normAr(s) { return String(s || '').replace(/[أإآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْـ]/g, '').toLowerCase(); }
  function nameDiffers(o, r) {
    if (!r || !r.receiver || !r.receiver.desc || !o.name) return false;
    var a = normAr(o.name).split(/\s+/).filter(function (w) { return w.length >= 3; }), b = normAr(r.receiver.desc);
    if (!a.length) return false;
    return !a.some(function (w) { return b.indexOf(w) !== -1; });
  }

  /* (TASK-0219 · المالك seq 149) «نفس شريطنا في تتبعنا … نفس الشريط ونفس المستطيل ولكن بهويتنا البصرية»:
     خطوات المفتي الأربع بنصّها، بشكل شريط track_order.html — مربّعات مدوّرة بأيقونة: ما مضى أسود · الحاليّة بتدرّج الأحمر
     ونبض · القادمة رمادية · وخطّ وصلٍ بينها. (الأيقونات SVG من مكتبة lucide نفسها — بلا تحميل) */
  var ICONS = [
    '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
  ];
  function icon(i) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[i] || ICONS[0]) + '</svg>'; }
  function stepsHTML(r) {
    var st = (r.steps && r.steps.length) ? r.steps : STEP_LABELS.map(function (l) { return { label: l, active: false }; });
    var lv = r.level || 0;
    return '<div class="mr-steps">' + st.map(function (s, i) {
      var k = (i + 1 < lv) ? 'passed' : (i + 1 === lv ? 'cur' : 'todo');
      return '<div class="mr-st ' + k + '" data-on="' + (s.active ? 1 : 0) + '"><i>' + icon(i) + '</i><span>' + esc(s.label) + '</span></div>';
    }).join('') + '</div>';
  }
  function resultHTML(o, r) {
    var k = cls(r);
    if (k === 'wait') return '<div class="mr-wait">⏳ جارٍ إدخال الرقم في موقع المفتي…</div>';
    if (k === 'err') return '<div class="mr-bad">⚠️ تعذّرت القراءة: ' + esc(r.error || '') + '</div>';
    if (k === 'nf') return '<div class="mr-bad">❓ موقع المفتي لا يعرف الرقم <b dir="ltr">' + esc(r.n) + '</b> — تأكّد من رقم التتبّع على الأوردر.</div>';
    return stepsHTML(r) +
      /* بطاقة «حالة الشحنة» — المكان المحاط بالدائرة في صفحة المفتي، بمستطيل بطاقاتنا (حدٌّ أحمر يمين · ظلّ خفيف) */
      '<div class="mr-card"><div class="mr-card-h"><span>حالة الشحنة</span><span class="mr-at" dir="ltr">' + esc(r.status_at || r.date || '') + '</span></div>' +
      '<div class="mr-desc">' + esc(r.status || '—') + '</div></div>' +
      (r.receiver ? '<div class="mr-rcv">المستلم عندهم: <b>' + esc(r.receiver.desc) + '</b>' + (r.receiver.info ? ' · ' + esc(r.receiver.info) : '') + '</div>' : '') +
      (nameDiffers(o, r) ? '<div class="mr-warn">⚠️ اسم المستلم عند المفتي لا يشبه اسم الزبون على الأوردر — تأكّد أنّ رقم التتبّع صحيح.</div>' : '');
  }
  function stLabel(s) { return { pending: 'جديد', prepared: 'محضّرة', shipped: 'في الطريق', delivered: 'بانتظار التحصيل', completed: 'تم التحصيل' }[s] || s; }
  function cardHTML(o) {
    var n = digits(o.tracking_number), r = state.res[n], k = cls(r), C = CLS[k];
    var when = o.shipped_at ? new Date(o.shipped_at).toLocaleDateString('en-GB') : '';
    var act = '';
    if (o.status === 'shipped') act = '<button type="button" data-mr-confirm="' + esc(o.id) + '" class="mr-btn' + (k === 'got' ? ' mr-go' : '') + '">✅ تأكيد الاستلام</button>';
    else if (o.status === 'delivered' || o.status === 'completed') act = '<span class="mr-done">✔ ' + esc(stLabel(o.status)) + '</span>';
    return '<div class="mr-o" data-mr-o="' + esc(o.id) + '" data-mr-k="' + k + '">' +
      '<div class="mr-top"><div class="mr-ttl">#' + esc(o.id) + ' · ' + esc(o.name || '—') + '</div>' +
      '<span class="mr-chip" style="color:' + C.c + ';background:' + C.bg + '">' + C.t + '</span></div>' +
      '<div class="mr-sub">رقم التتبّع <b dir="ltr">' + esc(n) + '</b>' + (o.region || o.city ? ' · ' + esc(o.region || o.city) : '') + (when ? ' · شُحن ' + esc(when) : '') + ' · عندنا: ' + esc(stLabel(o.status)) + '</div>' +
      '<div class="mr-res">' + resultHTML(o, r || { n: n }) + '</div>' +
      '<div class="mr-act">' + act + '<button type="button" data-mr-site="' + esc(n) + '" class="mr-btn mr-ghost">📋 نسخ الرقم وفتح موقع المفتي</button>' +
      (r && (k === 'err' || k === 'nf') ? '<button type="button" data-mr-retry="' + esc(n) + '" class="mr-btn mr-ghost">↻ أعد</button>' : '') + '</div></div>';
  }

  function counts() {
    var c = { all: state.list.length, got: 0, branch: 0, road: 0, bad: 0 };
    state.list.forEach(function (o) { var k = cls(state.res[digits(o.tracking_number)]); if (k === 'got') c.got++; else if (k === 'branch') c.branch++; else if (k === 'road') c.road++; else if (k === 'nf' || k === 'err') c.bad++; });
    return c;
  }
  function render() {
    var box = document.getElementById(ID); if (!box) return;
    var c = counts(), done = state.list.filter(function (o) { return state.res[digits(o.tracking_number)]; }).length;
    var F = [['all', 'الكل', c.all], ['got', '✅ استلمها', c.got], ['branch', '🏢 في الفرع', c.branch], ['road', '🚚 في الطريق', c.road], ['bad', '⚠️ مشكلة', c.bad]];
    box.querySelector('[data-mr-filters]').innerHTML = F.map(function (f) {
      return '<button type="button" data-mr-f="' + f[0] + '" class="mr-f' + (state.filter === f[0] ? ' on' : '') + '">' + f[1] + ' <b>' + f[2] + '</b></button>';
    }).join('');
    var pr = box.querySelector('[data-mr-prog]');
    pr.innerHTML = state.list.length ? (state.busy ? '⏳ يبحث في موقع المفتي واحدةً تلو الأخرى… ' + done + ' / ' + state.list.length : '✔ انتهى الفحص: ' + done + ' / ' + state.list.length + (state.at ? ' · ' + state.at : '')) +
      '<div class="mr-bar"><i style="width:' + (state.list.length ? Math.round(done * 100 / state.list.length) : 0) + '%"></i></div>' : '';
    var rows = state.list.filter(function (o) {
      if (state.filter === 'all') return true;
      var k = cls(state.res[digits(o.tracking_number)]);
      return state.filter === 'bad' ? (k === 'nf' || k === 'err') : k === state.filter;
    });
    /* «استلمها الزبون» أوّلاً — هي ما يحتاج تأكيداً منك */
    var rank = { got: 0, branch: 1, road: 2, nf: 3, err: 3, wait: 4 };
    rows.sort(function (a, b) { return rank[cls(state.res[digits(a.tracking_number)])] - rank[cls(state.res[digits(b.tracking_number)])]; });
    box.querySelector('[data-mr-list]').innerHTML = state.list.length
      ? (rows.length ? rows.map(cardHTML).join('') : '<p class="mr-empty">لا شحنات في هذا الفلتر.</p>')
      : '<p class="mr-empty">لا شحنات للمفتي «في الطريق» برقم تتبّع.</p>';
    var rb = box.querySelector('[data-mr-run]'); if (rb) { rb.disabled = state.busy; rb.textContent = state.busy ? '⏳ يفحص…' : '↻ تحقّق من الكل'; }
  }

  function scan(onlyNums) {
    var run = ++state.run;
    var nums = onlyNums || state.list.map(function (o) { return digits(o.tracking_number); });
    nums = nums.filter(function (n, i) { return n && nums.indexOf(n) === i; });
    nums.forEach(function (n) { delete state.res[n]; });
    state.busy = true; render();
    var i = 0;
    function next() {
      if (run !== state.run || !document.getElementById(ID)) return;
      if (i >= nums.length) { state.busy = false; state.at = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); render(); return; }
      var part = nums.slice(i, i + BATCH); i += BATCH;
      fetchBatch(part).then(function (m) {
        part.forEach(function (n) { state.res[n] = m[n] || { n: n, ok: false, error: 'لا ردّ لهذا الرقم' }; });
      }, function (e) {
        var msg = (e && e.name === 'AbortError') ? 'انتهت المهلة' : String((e && e.message) || e);
        part.forEach(function (n) { state.res[n] = { n: n, ok: false, error: msg }; });
      }).then(function () { if (run === state.run) { render(); next(); } });
    }
    next();
  }

  function copy(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function () {}); } catch (_) {}
    return Promise.resolve();
  }
  function toast(m, t) { try { if (typeof showToast === 'function') return showToast(m, t); } catch (_) {} }

  function close() {
    state.run++; state.busy = false;
    var b = document.getElementById(ID); if (b) b.remove();
    document.removeEventListener('keydown', onKey, true);
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    var cm = document.getElementById('confirmModal');
    if (cm && !cm.classList.contains('hidden')) return;     // Esc لنافذة التأكيد أوّلاً
    close();
  }

  /* يبدأ تحت الأشرطة العلوية (زرّ التحديث …) لا تحتها — المتغيّر من مُرتِّب الأشرطة في gmt-staff.js.
     الألوان من هويّتنا (track_order.html): --gmt-red #D5001C · تدرّج #D5001C→#8B0012 · --gmt-dark #111 · خلفية #f8fafc */
  var P = '#' + ID;
  var CSS = P + '{position:fixed;top:var(--gmt-topbars,0px);left:0;right:0;bottom:0;z-index:115;background:#f8fafc;display:flex;flex-direction:column;font-family:inherit;direction:rtl;color:#111}' +
    P + ' .mr-h{background:linear-gradient(135deg,#D5001C 0%,#8B0012 100%);color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;box-shadow:0 6px 18px rgba(213,0,28,.25)}' +
    P + ' .mr-h h3{font-weight:900;font-size:16px;margin:0;flex:1;min-width:0}' +
    P + ' .mr-h h3 small{display:block;font-size:10.5px;font-weight:700;opacity:.85}' +
    P + ' .mr-h button{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:8px 12px;font-weight:900;font-size:12px;cursor:pointer;font-family:inherit}' +
    P + ' .mr-h button[data-mr-run]{background:#fff;color:#D5001C;border-color:#fff}' +
    P + ' .mr-h button:disabled{opacity:.7}' +
    P + ' .mr-tools{padding:10px 14px 2px;background:#fff;border-bottom:1px solid #eef0f3}' +
    P + ' .mr-prog{font-size:12px;font-weight:800;color:#334155}' +
    P + ' .mr-bar{height:5px;background:#f1f5f9;border-radius:9px;margin:6px 0 8px;overflow:hidden}' + P + ' .mr-bar i{display:block;height:100%;background:linear-gradient(90deg,#8B0012,#D5001C);transition:width .3s}' +
    P + ' [data-mr-filters]{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px}' +
    P + ' .mr-f{flex-shrink:0;border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:7px 12px;font-size:12px;font-weight:800;color:#6b7280;cursor:pointer;font-family:inherit}' +
    P + ' .mr-f b{display:inline-block;margin-right:4px;background:#fff1f2;color:#D5001C;border-radius:999px;padding:0 7px;font-size:11px}' +
    P + ' .mr-f.on{background:#111;color:#fff;border-color:#111}' + P + ' .mr-f.on b{background:#D5001C;color:#fff}' +
    P + ' [data-mr-list]{flex:1;overflow-y:auto;padding:14px 14px 40px;display:flex;flex-direction:column;gap:14px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}' +
    P + ' .mr-o{background:#fff;border:1px solid #f1f5f9;border-radius:20px;padding:14px;box-shadow:0 4px 14px rgba(17,17,17,.06)}' +
    P + ' .mr-top{display:flex;justify-content:space-between;align-items:center;gap:8px}' +
    P + ' .mr-ttl{font-weight:900;font-size:14.5px;color:#111;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    P + ' .mr-chip{flex-shrink:0;font-size:11px;font-weight:900;border-radius:999px;padding:4px 10px}' +
    P + ' .mr-sub{font-size:11.5px;color:#6b7280;font-weight:700;margin:4px 0 12px}' + P + ' .mr-sub b{color:#111}' +
    /* الشريط — مربّعات مدوّرة متّصلة بخطّ (كشريط تتبّعنا، أفقيّاً ليتّسع لكل أوردر) */
    P + ' .mr-steps{display:flex;margin-bottom:12px}' +
    P + ' .mr-st{flex:1;position:relative;text-align:center;font-size:10px;font-weight:800;color:#9ca3af;line-height:1.4;padding:0 2px}' +
    P + ' .mr-st:not(:last-child)::after{content:"";position:absolute;top:20px;right:50%;width:100%;height:3px;border-radius:50px;background:#f1f5f9;z-index:0}' +
    P + ' .mr-st.passed:not(:last-child)::after{background:#111}' +
    P + ' .mr-st i{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:42px;height:42px;margin:0 auto 6px;border-radius:14px;border:2px solid #f3f4f6;background:#fff;color:#d1d5db;font-style:normal;transition:all .5s}' +
    P + ' .mr-st.passed{color:#111}' + P + ' .mr-st.passed i{background:#111;border-color:#111;color:#fff}' +
    P + ' .mr-st.cur{color:#D5001C;font-weight:900}' +
    P + ' .mr-st.cur i{background:linear-gradient(135deg,#D5001C 0%,#8B0012 100%);border-color:transparent;color:#fff;box-shadow:0 8px 16px rgba(213,0,28,.3);transform:scale(1.08);animation:mr-pulse 2s infinite}' +
    '@keyframes mr-pulse{0%{box-shadow:0 0 0 0 rgba(213,0,28,.4)}70%{box-shadow:0 0 0 10px rgba(213,0,28,0)}100%{box-shadow:0 0 0 0 rgba(213,0,28,0)}}' +
    /* المستطيل — «حالة الشحنة» بمستطيل بطاقاتنا */
    P + ' .mr-card{background:#fff;border:1px solid #f1f5f9;border-right:4px solid #D5001C;border-radius:16px;padding:10px 12px;box-shadow:0 4px 14px rgba(17,17,17,.06)}' +
    P + ' .mr-card-h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:10.5px;font-weight:800;color:#9ca3af;margin-bottom:4px}' +
    P + ' .mr-desc{font-weight:900;font-size:14.5px;color:#111;line-height:1.55}' +
    P + ' .mr-at{font-size:11px;color:#6b7280;font-weight:800}' +
    P + ' .mr-rcv{font-size:11.5px;color:#6b7280;margin-top:8px}' + P + ' .mr-rcv b{color:#111}' +
    P + ' .mr-warn{font-size:11.5px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:7px 10px;margin-top:8px}' +
    P + ' .mr-wait{font-size:12px;font-weight:800;color:#6b7280;background:#f8fafc;border:1px dashed #e5e7eb;border-radius:14px;padding:16px;text-align:center}' +
    P + ' .mr-bad{font-size:12px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:11px}' +
    P + ' .mr-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}' +
    P + ' .mr-btn{border:1px solid #e5e7eb;background:#fff;color:#374151;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit}' +
    P + ' .mr-btn.mr-go{background:#D5001C;border-color:#D5001C;color:#fff;flex:1;box-shadow:0 6px 14px rgba(213,0,28,.25)}' + P + ' .mr-ghost{font-weight:800;font-size:11.5px}' +
    P + ' .mr-done{font-size:12px;font-weight:900;color:#111;align-self:center}' +
    P + ' .mr-empty{text-align:center;color:#9ca3af;font-weight:800;font-size:13px;padding:30px 0}';

  function open() {
    close();
    if (!document.getElementById(ID + '-css')) { var st = document.createElement('style'); st.id = ID + '-css'; st.textContent = CSS; document.head.appendChild(st); }
    var box = document.createElement('div'); box.id = ID; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'مراجعة شحنات المفتي');
    box.innerHTML = '<div class="mr-h"><h3>مراجعة شحنات المفتي<small>بحثٌ جديد من موقع المفتي في كل مرّة · فقط ما لم نؤكّد استلامه</small></h3><button type="button" data-mr-run>↻ تحقّق من الكل</button><button type="button" data-mr-close aria-label="إغلاق">✕ إغلاق</button></div>' +
      '<div class="mr-tools"><div class="mr-prog" data-mr-prog role="status" aria-live="polite"></div><div data-mr-filters></div>' +
      '</div>' +
      '<div data-mr-list></div>';
    document.body.appendChild(box);
    /* تلميح زرّ الفتح (gmt-hints يظهر بالتمرير/اللمس ويختفي بالخروج أو التمرير) كان يبقى فوق النافذة ⇒ نُغلقه */
    /* (يُظهَر بعد إطار رسمٍ — فنُغلقه بعده لا قبله) */
    var unhint = function () {
      try {
        var lb = document.querySelector('[data-mr-launch]');
        if (lb) lb.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: box }));
        g.dispatchEvent(new Event('scroll'));
      } catch (_) {}
    };
    setTimeout(unhint, 80); setTimeout(unhint, 400);
    box.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-mr-close')) return close();
      if (t.hasAttribute('data-mr-run')) return fresh();
      if (t.hasAttribute('data-mr-f')) { state.filter = t.getAttribute('data-mr-f'); return render(); }
      if (t.hasAttribute('data-mr-retry')) return scan([t.getAttribute('data-mr-retry')]);
      if (t.hasAttribute('data-mr-site')) {
        var n = t.getAttribute('data-mr-site');
        copy(n).then(function () { toast('📋 نُسخ الرقم ' + n + ' — الصقه في موقع المفتي', 'ok'); });
        var url = null; try { url = typeof trackUrlFor === 'function' ? trackUrlFor('المفتي') : (g.GMTOffices && GMTOffices.trackUrlOf('المفتي')); } catch (_) {}
        if (url) g.open(url, '_blank', 'noopener');
        return;
      }
      if (t.hasAttribute('data-mr-confirm')) {
        var id = t.getAttribute('data-mr-confirm');
        if (typeof g.requestConfirm === 'function') g.requestConfirm(isNaN(+id) ? id : +id, 'delivered');
        return;
      }
    });
    document.addEventListener('keydown', onKey, true);
    /* بعد «تأكيد الاستلام» من نافذة الأوردرات: الحالة تتغيّر في `orders` ⇒ يتحدّث الزرّ هنا إلى «✔ بانتظار التحصيل» */
    var sig = '';
    state.timer = setInterval(function () {
      var cur = allOrders();     // إعادة تحميل الأوردرات تستبدل الكائنات ⇒ نتبع الأحدث بالرقم
      state.list = state.list.map(function (o) { return cur.find(function (x) { return x.id === o.id; }) || o; });
      var s = state.list.map(function (o) { return o.id + ':' + o.status; }).join('|');
      if (s !== sig) { sig = s; render(); }
    }, 700);
    state.filter = 'all';
    fresh();
  }
  /* بحثٌ جديد عن الكل: القائمة تُعاد من الأوردرات الآن (ما أكّدتَ استلامه يخرج) والنتائج القديمة تُمسح قبل القراءة */
  function fresh() {
    state.list = pickList(); state.res = {}; state.at = '';
    render();
    if (state.list.length) scan(); else { state.run++; state.busy = false; render(); }
  }

  g.GMTMuftiReview = { open: open, close: close, refresh: fresh, _state: state, _cls: cls };
})(window);
