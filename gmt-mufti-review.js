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
  /* القراءة والشريط والمستطيل من gmt-mufti-live.js — مشتركةٌ مع موقع التتبّع (TASK-0223) */
  var ML = g.GMTMuftiLive, BATCH = 3, ID = 'gmt-mr';
  /* (TASK-0219 · المالك seq 148) «ما لازم يخزنها كل مره اضغط يعمل بحث جديد … فقط شحنات التي لم نؤكد الاستلام»:
     لا تخزين — النتائج في الذاكرة لهذه النافذة فقط، وكل فتحٍ وكل «تحقّق من الكل» يمسحها ويقرأ الكل من موقع المفتي من جديد. */
  var state = { list: [], res: {}, busy: false, run: 0, filter: 'all' };

  var esc = ML.esc, digits = ML.digits, isMufti = ML.isMufti, cls = ML.cls, stepsHTML = ML.stepsHTML;
  function allOrders() { try { return (typeof orders !== 'undefined' && Array.isArray(orders)) ? orders : []; } catch (_) { return []; } }
  function pickList() {
    /* فقط ما لم نؤكّد استلامه («في الطريق») */
    return allOrders().filter(function (o) { return isMufti(o) && o.status === 'shipped' && digits(o.tracking_number); })
      .sort(function (a, b) { return new Date(a.shipped_at || a.created_at || 0) - new Date(b.shipped_at || b.created_at || 0); });
  }

  function fetchBatch(nums) { return ML.fetch(nums); }

  /* (TASK-0219 · seq 149) «بهويتنا البصرية»: الأحمر #D5001C والأسود #111 كما في صفحة تتبّعنا */
  var CLS = {
    got: { t: '✅ استلمها الزبون', c: '#ffffff', bg: '#111111' },
    branch: { t: '📍 في فرع الوجهة', c: '#D5001C', bg: '#fff1f2' },
    road: { t: '🚚 في الطريق', c: '#334155', bg: '#f1f5f9' },
    ret: { t: '↩️ مرتجع — أُعيد توجيهها', c: '#b45309', bg: '#fffbeb' },
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

  function resultHTML(o, r) {
    var k = cls(r);
    if (k === 'wait') return '<div class="mr-wait">⏳ جارٍ إدخال الرقم في موقع المفتي…</div>';
    if (k === 'err') return '<div class="mr-bad">⚠️ تعذّرت القراءة: ' + esc(r.error || '') + '</div>';
    if (k === 'nf') return '<div class="mr-bad">❓ موقع المفتي لا يعرف الرقم <b dir="ltr">' + esc(r.n) + '</b> — تأكّد من رقم التتبّع على الأوردر.</div>';
    return stepsHTML(r) +
      /* (TASK-0225 · seq 153) «تمت إعادة التوجيه» ليست استلاماً بل مرتجع */
      (k === 'ret' ? '<div class="mr-warn" data-mr-ret>↩️ «إعادة التوجيه» عند المفتي تعني أنّ الشحنة انتقلت إلى <b>مرتجع</b> — ليست استلاماً. لا تؤكّد الاستلام.</div>' : '') +
      ML.cardHTML(r) +      /* «حالة الشحنة» — المكان المحاط بالدائرة في صفحة المفتي، بمستطيل بطاقاتنا */
      (r.receiver ? '<div class="mr-rcv">المستلم عندهم: <b>' + esc(r.receiver.desc) + '</b>' + (r.receiver.info ? ' · ' + esc(r.receiver.info) : '') + '</div>' : '') +
      (nameDiffers(o, r) ? '<div class="mr-warn">⚠️ اسم المستلم عند المفتي لا يشبه اسم الزبون على الأوردر — تأكّد أنّ رقم التتبّع صحيح.</div>' : '');
  }
  function stLabel(s) { return { pending: 'جديد', prepared: 'محضّرة', shipped: 'في الطريق', delivered: 'بانتظار التحصيل', completed: 'تم التحصيل' }[s] || s; }
  /* (TASK-0220 · seq 150 ⇐ TASK-0221 · seq 151) «ما طلبت منك جميع الازرار … اذا الطباعه شو بده يلزمني هون او زر البحث …
     فقط زر تاكيد الاستلام زر مثلا تبليغ الوصول وزر مراسله فرع الشركه الوجهه»:
     ثلاثة أزرار فقط، تُؤخذ من بطاقة الأوردر (cardHTML في الأوردرات) كما هي — نفس الشكل والسلوك:
     ✅ تأكيد الاستلام · 🔔 تبليغ الوصول (وبعد التبليغ يصير في البطاقة نفسها زرَّ مراسلة الزبون — هو هو) · 🏢 مراسلة فرع الشركة الوجهة. */
  var KEEP = [/^requestConfirm\(\s*'?[^,]+'?\s*,\s*'delivered'\s*\)$/, /^(shareOrder\([^,]+,\s*'arrived'\)|contactCustomerArrival\([^)]*\))$/, /^contactShipOffice\([^)]*\)$/];
  function pageButtons(o) {
    try {
      if (typeof g.cardHTML !== 'function') return '';
      var t = document.createElement('div'); t.innerHTML = g.cardHTML(o);
      var all = [].slice.call(t.querySelectorAll('button[onclick]'));
      var out = KEEP.map(function (re) { return all.filter(function (b) { return re.test((b.getAttribute('onclick') || '').trim()); })[0]; }).filter(Boolean);
      if (!out.length) return '';
      out.forEach(function (b, i) { if (i === 0 && /requestConfirm/.test(b.getAttribute('onclick'))) b.classList.add('flex-1'); });
      return '<div class="flex gap-2">' + out.map(function (b) { return b.outerHTML; }).join('') + '</div>';
    } catch (_) { return ''; }
  }
  /* (TASK-0222 · المالك seq 152) «ايضا في صحين للي تبلغ كانت موجوده زامنها ايضا»: شارة «✓✓ بُلِّغ بالوصول» نفسها من بطاقة الأوردر
     (notifyDots في الأوردرات) — تظهر فور التبليغ لأنّ التبليغ يَسِم الأوردر (markNotified) والنافذة تتبع ذلك. */
  function notify(o) { try { return typeof g.notifyDots === 'function' ? '<span class="mr-nd" data-mr-notified>' + g.notifyDots(o) + '</span>' : ''; } catch (_) { return ''; } }
  function cardHTML(o) {
    var n = digits(o.tracking_number), r = state.res[n], k = cls(r), C = CLS[k];
    var when = o.shipped_at ? new Date(o.shipped_at).toLocaleDateString('en-GB') : '';
    var pb = pageButtons(o), act = '';
    if (o.status === 'delivered' || o.status === 'completed') act = '<span class="mr-done">✔ ' + esc(stLabel(o.status)) + '</span>';
    else if (o.status === 'shipped' && !pb) act = '<button type="button" data-mr-confirm="' + esc(o.id) + '" class="mr-btn' + (k === 'got' ? ' mr-go' : '') + '">✅ تأكيد الاستلام</button>';   // احتياط: صفحةٌ بلا cardHTML
    return '<div class="mr-o" data-mr-o="' + esc(o.id) + '" data-mr-k="' + k + '">' +
      '<div class="mr-top"><div class="mr-ttl">#' + esc(o.id) + ' · ' + esc(o.name || '—') + '</div>' + notify(o) +
      '<span class="mr-chip" style="color:' + C.c + ';background:' + C.bg + '">' + C.t + '</span></div>' +
      '<div class="mr-sub">رقم التتبّع <b dir="ltr">' + esc(n) + '</b>' + (o.region || o.city ? ' · ' + esc(o.region || o.city) : '') + (when ? ' · شُحن ' + esc(when) : '') + ' · عندنا: ' + esc(stLabel(o.status)) + '</div>' +
      '<div class="mr-res">' + resultHTML(o, r || { n: n }) + '</div>' +
      (pb ? '<div class="mr-pbtns" data-mr-pbtns>' + pb + '</div>' : '') +
      (act ? '<div class="mr-act">' + act + '</div>' : '') + '</div>';
  }

  function counts() {
    var c = { all: state.list.length, got: 0, branch: 0, road: 0, ret: 0, bad: 0 };
    state.list.forEach(function (o) { var k = cls(state.res[digits(o.tracking_number)]); if (k === 'got') c.got++; else if (k === 'branch') c.branch++; else if (k === 'road') c.road++; else if (k === 'ret') c.ret++; else if (k === 'nf' || k === 'err') c.bad++; });
    return c;
  }
  function render() {
    var box = document.getElementById(ID); if (!box) return;
    var c = counts(), done = state.list.filter(function (o) { return state.res[digits(o.tracking_number)]; }).length;
    var F = [['all', 'الكل', c.all], ['got', '✅ استلمها', c.got], ['branch', '🏢 في الفرع', c.branch], ['road', '🚚 في الطريق', c.road], ['ret', '↩️ مرتجع', c.ret], ['bad', '⚠️ مشكلة', c.bad]];
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
    var rank = { got: 0, ret: 1, branch: 2, road: 3, nf: 4, err: 4, wait: 5 };
    rows.sort(function (a, b) { return rank[cls(state.res[digits(a.tracking_number)])] - rank[cls(state.res[digits(b.tracking_number)])]; });
    box.querySelector('[data-mr-list]').innerHTML = state.list.length
      ? (rows.length ? rows.map(cardHTML).join('') : '<p class="mr-empty">لا شحنات في هذا الفلتر.</p>')
      : '<p class="mr-empty">لا شحنات للمفتي «في الطريق» برقم تتبّع.</p>';
    var rb = box.querySelector('[data-mr-run]'); if (rb) { rb.disabled = state.busy; rb.textContent = state.busy ? '⏳ يفحص…' : '↻ تحقّق من الكل'; }
    try { if (g.lucide && lucide.createIcons) lucide.createIcons(); } catch (_) {}     // أيقونات أزرار البطاقة
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

  function toast(m, t) { try { if (typeof showToast === 'function') return showToast(m, t); } catch (_) {} }

  function close() {
    state.run++; state.busy = false;
    var b = document.getElementById(ID); if (b) b.remove();
    document.removeEventListener('keydown', onKey, true);
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }
  function onKey(e) {
    if (e.key !== 'Escape') return;
    /* Esc لنافذة الصفحة المفتوحة فوقنا أوّلاً (التأكيد · تعديل · الإيصال …) */
    var open1 = [].slice.call(document.querySelectorAll('[id$="Modal"]')).some(function (m) { return !m.classList.contains('hidden') && m.getClientRects().length; });
    if (open1) return;
    close();
  }

  /* z-index 90: فوق محتوى الصفحة (الترويسة z-50) وتحت كل نوافذها (100–130) — فما تفتحه أزرار البطاقة يظهر فوقنا.
     يبدأ تحت الأشرطة العلوية (زرّ التحديث …) لا تحتها — المتغيّر من مُرتِّب الأشرطة في gmt-staff.js.
     الألوان من هويّتنا (track_order.html): --gmt-red #D5001C · تدرّج #D5001C→#8B0012 · --gmt-dark #111 · خلفية #f8fafc */
  var P = '#' + ID;
  var CSS = P + '{position:fixed;top:var(--gmt-topbars,0px);left:0;right:0;bottom:0;z-index:90;background:#f8fafc;display:flex;flex-direction:column;font-family:inherit;direction:rtl;color:#111}' +
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
    P + ' .mr-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}' +
    P + ' .mr-nd:empty{display:none}' + P + ' .mr-top .mr-chip{margin-right:auto}' +
    P + ' .mr-ttl{font-weight:900;font-size:14.5px;color:#111;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    P + ' .mr-chip{flex-shrink:0;font-size:11px;font-weight:900;border-radius:999px;padding:4px 10px}' +
    P + ' .mr-sub{font-size:11.5px;color:#6b7280;font-weight:700;margin:4px 0 12px}' + P + ' .mr-sub b{color:#111}' +
    P + ' .mr-rcv{font-size:11.5px;color:#6b7280;margin-top:8px}' + P + ' .mr-rcv b{color:#111}' +
    P + ' .mr-warn{font-size:11.5px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:7px 10px;margin-top:8px}' +
    P + ' .mr-wait{font-size:12px;font-weight:800;color:#6b7280;background:#f8fafc;border:1px dashed #e5e7eb;border-radius:14px;padding:16px;text-align:center}' +
    P + ' .mr-bad{font-size:12px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:11px}' +
    P + ' .mr-pbtns{margin-top:12px;padding-top:12px;border-top:1px dashed #eef0f3}' +
    P + ' .mr-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}' +
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
      var s = state.list.map(function (o) { return [o.id, o.status, o.notified_arrival_at || '', o.notified_ship_at || '', o.receipt_at || ''].join(':'); }).join('|');   // + التبليغات: زرّ «تبليغ وصول» يصير «مراسلة الزبون» بعده
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
