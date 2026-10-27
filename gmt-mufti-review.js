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
  var state = { list: [], res: {}, busy: false, run: 0, filter: 'all', withDelivered: false };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function digits(s) { return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); }).replace(/\D/g, ''); }
  function allOrders() { try { return (typeof orders !== 'undefined' && Array.isArray(orders)) ? orders : []; } catch (_) { return []; } }
  function isMufti(o) {
    var c = String(o.shipping_company || '').trim();
    try { if (g.GMTOffices && GMTOffices.canonCompany) return GMTOffices.canonCompany(c) === 'المفتي'; } catch (_) {}
    return /مفت/.test(c);
  }
  function pickList() {
    var sts = state.withDelivered ? ['shipped', 'delivered'] : ['shipped'];
    return allOrders().filter(function (o) { return isMufti(o) && sts.indexOf(o.status) !== -1 && digits(o.tracking_number); })
      .sort(function (a, b) { return new Date(a.shipped_at || a.created_at || 0) - new Date(b.shipped_at || b.created_at || 0); });
  }

  /* نداء الخادم: دفعةٌ من الأرقام ⇒ {n: نتيجة} */
  function fetchBatch(nums) {
    var db = g.GMT_DB && g.GMT_DB.MAIN;
    if (!db || !db.url || !db.key) return Promise.reject(new Error('لا اتصال بالقاعدة في هذه الصفحة'));
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var tm = ac ? setTimeout(function () { try { ac.abort(); } catch (_) {} }, 60000) : null;
    return fetch(db.url + '/functions/v1/' + FN, {
      method: 'POST', signal: ac ? ac.signal : undefined,
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
  var CLS = {
    got: { t: '✅ استلمها الزبون', c: '#15803d', bg: '#dcfce7' },
    branch: { t: '🏢 في فرع الوجهة', c: '#a16207', bg: '#fef9c3' },
    road: { t: '🚚 في الطريق', c: '#1d4ed8', bg: '#dbeafe' },
    nf: { t: '❓ الرقم غير موجود عندهم', c: '#b91c1c', bg: '#fee2e2' },
    err: { t: '⚠️ تعذّرت القراءة', c: '#b91c1c', bg: '#fee2e2' },
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

  function stepsHTML(r) {
    var st = (r.steps && r.steps.length) ? r.steps : STEP_LABELS.map(function (l) { return { label: l, active: false }; });
    return '<div class="mr-steps">' + st.map(function (s, i) {
      return '<div class="mr-st' + (s.active ? ' on' : '') + '"><b>' + (i + 1) + '</b><span>' + esc(s.label) + '</span></div>';
    }).join('') + '</div>';
  }
  function resultHTML(o, r) {
    var k = cls(r);
    if (k === 'wait') return '<div class="mr-wait">⏳ جارٍ إدخال الرقم في موقع المفتي…</div>';
    if (k === 'err') return '<div class="mr-bad">⚠️ تعذّرت القراءة: ' + esc(r.error || '') + '</div>';
    if (k === 'nf') return '<div class="mr-bad">❓ موقع المفتي لا يعرف الرقم <b dir="ltr">' + esc(r.n) + '</b> — تأكّد من رقم التتبّع على الأوردر.</div>';
    return stepsHTML(r) +
      /* بطاقة «حالة الشحنة» — المكان المحاط بالدائرة في صفحة المفتي */
      '<div class="mr-card"><div class="mr-card-h">حالة الشحنة</div><div class="mr-card-b"><div class="mr-desc">' + esc(r.status || '—') + '</div>' +
      '<div class="mr-at" dir="ltr">' + esc(r.status_at || r.date || '') + '</div></div></div>' +
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
    var rb = box.querySelector('[data-mr-run]'); if (rb) { rb.disabled = state.busy; rb.textContent = state.busy ? '⏳ يفحص…' : '↻ أعد الفحص'; }
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

  /* يبدأ تحت الأشرطة العلوية (زرّ التحديث …) لا تحتها — المتغيّر من مُرتِّب الأشرطة في gmt-staff.js */
  var CSS = '#' + ID + '{position:fixed;top:var(--gmt-topbars,0px);left:0;right:0;bottom:0;z-index:115;background:#f1f5f9;display:flex;flex-direction:column;font-family:inherit;direction:rtl}' +
    '#' + ID + ' .mr-h{background:#14532d;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '#' + ID + ' .mr-h h3{font-weight:900;font-size:16px;margin:0;flex:1;min-width:0}' +
    '#' + ID + ' .mr-h button{background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:900;font-size:12px;cursor:pointer}' +
    '#' + ID + ' .mr-h button:disabled{opacity:.6}' +
    '#' + ID + ' .mr-tools{padding:10px 14px 4px;background:#fff;border-bottom:1px solid #e2e8f0}' +
    '#' + ID + ' .mr-prog{font-size:12px;font-weight:800;color:#334155}' +
    '#' + ID + ' .mr-bar{height:5px;background:#e2e8f0;border-radius:9px;margin:6px 0 8px;overflow:hidden}#' + ID + ' .mr-bar i{display:block;height:100%;background:#16a34a;transition:width .3s}' +
    '#' + ID + ' [data-mr-filters]{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px}' +
    '#' + ID + ' .mr-f{flex-shrink:0;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 11px;font-size:12px;font-weight:800;color:#475569;cursor:pointer}#' + ID + ' .mr-f.on{background:#14532d;color:#fff;border-color:#14532d}' +
    '#' + ID + ' .mr-opt{font-size:11.5px;font-weight:700;color:#475569;display:flex;align-items:center;gap:6px;padding-bottom:8px}' +
    '#' + ID + ' [data-mr-list]{flex:1;overflow-y:auto;padding:12px 14px 40px;display:flex;flex-direction:column;gap:12px;max-width:760px;width:100%;margin:0 auto;box-sizing:border-box}' +
    '#' + ID + ' .mr-o{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.05)}' +
    '#' + ID + ' .mr-top{display:flex;justify-content:space-between;align-items:center;gap:8px}' +
    '#' + ID + ' .mr-ttl{font-weight:900;font-size:14px;color:#0f172a;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#' + ID + ' .mr-chip{flex-shrink:0;font-size:11px;font-weight:900;border-radius:999px;padding:4px 9px}' +
    '#' + ID + ' .mr-sub{font-size:11.5px;color:#64748b;font-weight:700;margin:4px 0 8px}' +
    '#' + ID + ' .mr-steps{display:flex;gap:4px;margin-bottom:8px}' +
    '#' + ID + ' .mr-st{flex:1;text-align:center;font-size:10px;font-weight:800;color:#94a3b8;line-height:1.35}' +
    '#' + ID + ' .mr-st b{display:flex;align-items:center;justify-content:center;width:24px;height:24px;margin:0 auto 3px;border-radius:50%;border:2px solid #cbd5e1;font-size:11px;background:#fff}' +
    '#' + ID + ' .mr-st.on{color:#15803d}#' + ID + ' .mr-st.on b{background:#4caf50;border-color:#2e7d32;color:#fff}' +
    '#' + ID + ' .mr-card{border:2px solid #2e7d32;border-radius:10px;overflow:hidden}' +
    '#' + ID + ' .mr-card-h{background:#2e7d32;color:#fff;font-weight:900;font-size:13px;padding:7px 12px}' +
    '#' + ID + ' .mr-card-b{padding:9px 12px}#' + ID + ' .mr-desc{font-weight:900;font-size:14px;color:#111827;line-height:1.5}' +
    '#' + ID + ' .mr-at{font-size:11.5px;color:#6b7280;font-weight:700;text-align:left;margin-top:3px}' +
    '#' + ID + ' .mr-rcv{font-size:11.5px;color:#475569;margin-top:6px}' +
    '#' + ID + ' .mr-warn{font-size:11.5px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:6px 9px;margin-top:6px}' +
    '#' + ID + ' .mr-wait{font-size:12px;font-weight:800;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center}' +
    '#' + ID + ' .mr-bad{font-size:12px;font-weight:800;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px}' +
    '#' + ID + ' .mr-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}' +
    '#' + ID + ' .mr-btn{border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:10px;padding:9px 12px;font-size:12px;font-weight:900;cursor:pointer}' +
    '#' + ID + ' .mr-btn.mr-go{background:#15803d;border-color:#15803d;color:#fff;flex:1}#' + ID + ' .mr-ghost{font-weight:800;font-size:11.5px}' +
    '#' + ID + ' .mr-done{font-size:12px;font-weight:900;color:#15803d;align-self:center}' +
    '#' + ID + ' .mr-empty{text-align:center;color:#94a3b8;font-weight:800;font-size:13px;padding:30px 0}';

  function open() {
    close();
    if (!document.getElementById(ID + '-css')) { var st = document.createElement('style'); st.id = ID + '-css'; st.textContent = CSS; document.head.appendChild(st); }
    var box = document.createElement('div'); box.id = ID; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'مراجعة شحنات المفتي');
    box.innerHTML = '<div class="mr-h"><h3>🔎 مراجعة شحنات المفتي</h3><button type="button" data-mr-run>↻ أعد الفحص</button><button type="button" data-mr-close aria-label="إغلاق">✕ إغلاق</button></div>' +
      '<div class="mr-tools"><div class="mr-prog" data-mr-prog role="status" aria-live="polite"></div><div data-mr-filters></div>' +
      '<label class="mr-opt"><input type="checkbox" data-mr-withdel' + (state.withDelivered ? ' checked' : '') + '> وأيضاً «بانتظار التحصيل» (للمطابقة)</label></div>' +
      '<div data-mr-list></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var t = e.target.closest('button,[data-mr-withdel]'); if (!t) return;
      if (t.hasAttribute('data-mr-close')) return close();
      if (t.hasAttribute('data-mr-run')) return scan();
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
    box.addEventListener('change', function (e) {
      if (e.target && e.target.hasAttribute('data-mr-withdel')) {
        state.withDelivered = !!e.target.checked;
        var before = state.list.map(function (o) { return digits(o.tracking_number); });
        state.list = pickList();
        var fresh = state.list.map(function (o) { return digits(o.tracking_number); }).filter(function (n) { return before.indexOf(n) === -1 && !state.res[n]; });
        if (fresh.length && !state.busy) scan(fresh); else render();
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
    state.list = pickList(); state.res = {}; state.filter = 'all';
    render();
    if (state.list.length) scan();
  }

  g.GMTMuftiReview = { open: open, close: close, _state: state, _cls: cls };
})(window);
