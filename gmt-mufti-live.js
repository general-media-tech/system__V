/* ═══════════════════════════════════════════════════════════════════════════
   📡 حالة شحنة المفتي الحيّة — مشترك بين «مراجعة شحنات المفتي» (الأوردرات) وموقع التتبّع
   (TASK-0217 · seq 147 ⇐ TASK-0223 · المالك seq 152: «في موقع تتبع الشحنات التي لدينا تعمل مزامنه بنفس هذا البوت …
    ابحث له في المفتي ويزامن فورا على موقع التتبع تبعنا شو مكتوب هنيك ويزامن الانتقالات والكتابه وكل شيء»)

   القراءة: دالّة الخادم `gmt-mufti` تُدخل الرقم في صفحة تتبّع المفتي وترجع الخطوات الأربع و«حالة الشحنة» وتاريخها
   والمستلم — **قراءة فقط، بلا تخزين** (كل نداءٍ يقرأ من موقعهم الآن · seq 148).
   الشكل (seq 149): «نفس الشريط ونفس المستطيل ولكن بهويتنا البصرية» — خطوات المفتي بنصّها بشكل شريط تتبّعنا
   (مربّعات بأيقونة: ما مضى أسود · الحاليّة بتدرّج الأحمر ونبض · القادمة رمادية) و«حالة الشحنة» بمستطيل بطاقاتنا.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var FN = 'gmt-mufti';
  var STEP_LABELS = ['تم استلام الشحنة', 'على الطريق وقيد النقل', 'وصلت فرع الوجهة', 'تم التسليم للمرسل إليه'];

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function digits(s) { return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); }).replace(/\D/g, ''); }
  function isMufti(o) {
    var c = String((o && o.shipping_company) || '').trim();
    try { if (g.GMTOffices && GMTOffices.canonCompany) return GMTOffices.canonCompany(c) === 'المفتي'; } catch (_) {}
    return /مفت/.test(c);
  }

  /* نداء الخادم: أرقام ⇒ {n: نتيجة}. db = {url,key} (افتراضياً قاعدة النظام الرئيسية في الصفحة) */
  function fetchNums(nums, opt) {
    opt = opt || {};
    var db = opt.db || (g.GMT_DB && g.GMT_DB.MAIN);
    if (!db || !db.url || !db.key) return Promise.reject(new Error('لا اتصال بالقاعدة في هذه الصفحة'));
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var tm = ac ? setTimeout(function () { try { ac.abort(); } catch (_) {} }, opt.timeoutMs || 60000) : null;
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

  /* الفئة: got = سُلِّمت للزبون (٤) · branch = في فرع الوجهة (٣) · road = في الطريق (١–٢) · ret = مرتجع · nf = غير موجود · err · wait
     (TASK-0225 · المالك seq 153) «كلمه تمت اعاده التوجيه لا يعني انه استلم بل انها انتقلت الى مرتجع» ⇒ فئةٌ مستقلّة قبل كل شيء.
     (لا «راجع» في النمط: «يرجى مراجعة الفرع» في خطوة الوصول تحويها) */
  var RETURN_RE = /[إا]عاد[ةه] (ال)?توجيه|مرتجع|[إا]رجاع|[إا]عاد[ةه] (ال)?شحن[ةه] (ل|الى |إلى )/;
  function isReturn(r) { return !!(r && RETURN_RE.test(r.status || '')); }
  function cls(r) {
    if (!r) return 'wait';
    if (r.error && !r.ok) return 'err';
    if (!r.found) return 'nf';
    if (isReturn(r)) return 'ret';
    if (r.level >= 4 || /من قبل المرسل إليه|تم التسليم/.test(r.status || '')) return 'got';
    if (r.level === 3) return 'branch';
    return 'road';
  }

  var ICONS = [
    '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
  ];
  function icon(i) { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[i] || ICONS[0]) + '</svg>'; }
  /* الخطوات الأربع بنصّ المفتي — ما قبل مستواه «مضى» · مستواه «الحاليّة» · ما بعده «قادمة» (data-on = علامة المفتي نفسها) */
  function stepsHTML(r) {
    ensureCss();
    var st = (r && r.steps && r.steps.length) ? r.steps : STEP_LABELS.map(function (l) { return { label: l, active: false }; });
    var lv = (r && r.level) || 0;
    return '<div class="ml-steps">' + st.map(function (s, i) {
      var k = (i + 1 < lv) ? 'passed' : (i + 1 === lv ? 'cur' : 'todo');
      return '<div class="ml-st ' + k + '" data-on="' + (s.active ? 1 : 0) + '"><i>' + icon(i) + '</i><span>' + esc(s.label) + '</span></div>';
    }).join('') + '</div>';
  }
  /* «حالة الشحنة» — المكان المحاط بالدائرة في صفحة المفتي، بمستطيل بطاقاتنا (حدٌّ أحمر يمين) */
  function cardHTML(r, title) {
    ensureCss();
    return '<div class="ml-card"><div class="ml-card-h"><span>' + esc(title || 'حالة الشحنة') + '</span><span class="ml-at" dir="ltr">' + esc((r && (r.status_at || r.date)) || '') + '</span></div>' +
      '<div class="ml-desc">' + esc((r && r.status) || '—') + '</div></div>';
  }

  var CSS = '.ml-steps{display:flex;margin-bottom:12px;direction:rtl}' +
    '.ml-st{flex:1;position:relative;text-align:center;font-size:10px;font-weight:800;color:#9ca3af;line-height:1.4;padding:0 2px}' +
    '.ml-st:not(:last-child)::after{content:"";position:absolute;top:20px;right:50%;width:100%;height:3px;border-radius:50px;background:#f1f5f9;z-index:0}' +
    '.ml-st.passed:not(:last-child)::after{background:#111}' +
    '.ml-st i{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:42px;height:42px;margin:0 auto 6px;border-radius:14px;border:2px solid #f3f4f6;background:#fff;color:#d1d5db;font-style:normal;transition:all .5s}' +
    '.ml-st.passed{color:#111}.ml-st.passed i{background:#111;border-color:#111;color:#fff}' +
    '.ml-st.cur{color:#D5001C;font-weight:900}' +
    '.ml-st.cur i{background:linear-gradient(135deg,#D5001C 0%,#8B0012 100%);border-color:transparent;color:#fff;box-shadow:0 8px 16px rgba(213,0,28,.3);transform:scale(1.08);animation:ml-pulse 2s infinite}' +
    '@keyframes ml-pulse{0%{box-shadow:0 0 0 0 rgba(213,0,28,.4)}70%{box-shadow:0 0 0 10px rgba(213,0,28,0)}100%{box-shadow:0 0 0 0 rgba(213,0,28,0)}}' +
    '.ml-card{background:#fff;border:1px solid #f1f5f9;border-right:4px solid #D5001C;border-radius:16px;padding:10px 12px;box-shadow:0 4px 14px rgba(17,17,17,.06);direction:rtl;text-align:right}' +
    '.ml-card-h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:10.5px;font-weight:800;color:#9ca3af;margin-bottom:4px}' +
    '.ml-desc{font-weight:900;font-size:14.5px;color:#111;line-height:1.55}' +
    '.ml-at{font-size:11px;color:#6b7280;font-weight:800}';
  function ensureCss() {
    if (typeof document === 'undefined' || document.getElementById('gmt-ml-css')) return;
    var st = document.createElement('style'); st.id = 'gmt-ml-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
  }

  g.GMTMuftiLive = { fetch: fetchNums, cls: cls, isReturn: isReturn, stepsHTML: stepsHTML, cardHTML: cardHTML, isMufti: isMufti, digits: digits, esc: esc, ensureCss: ensureCss };
})(window);
