/* ═══════════════════════════════════════════════════════════════════════════
   gmt-layers.js — طبقات التطبيق (TASK-B0518 · المالك seq 837)

   طلبه بنصّه: «اللي نفذته نوافذ مضحك ومقرف. طلبت انو اطلع واعيفه بالخلفية وارجع ادخل عليه يتم بالرئيسية،
   وفيه مثل ليرات الفوتوشوب بنتقل بين الادوات — برجع بدخل على التطبيق مثلا الجرد وانتقل للاوردر او المتجر وارجع اكمل».

   فالتطبيق نفسه (الرئيسيّة) صار يحمل الأدوات **طبقاتٍ** بلا شريط تبويبات ولا نوافذ عائمة:
     • تفتح أداةً من الرئيسيّة ⇒ تصير طبقةً فوقها بملء الشاشة · تنتقل من الجرد إلى الأوردرات ⇒ طبقةٌ ثانية والجرد يبقى حيّاً تحتها.
     • ترجع للجرد ⇒ تجده كما تركته (لا إعادة تحميل) · لكلّ أداةٍ طبقةٌ واحدة.
     • شريطٌ رفيع أعلى الطبقة: «الرئيسية» + أيقونات الطبقات المفتوحة (كلوحة الطبقات في الفوتوشوب) — ضغطة تنقلك، والضغط المطوّل يغلق.
     • تخرج من التطبيق وتتركه في الخلفية ثمّ ترجع ⇒ تظهر الرئيسيّة، وفي أعلاها «تكمل من حيث توقفت» بطبقاتك المفتوحة.
     • زرّ الرجوع في الهاتف ⇒ الرئيسيّة (والطبقات باقية).
   الصفحات نفسها لم تتغيّر: كلّ طبقةٍ صفحةٌ من النظام كما هي (تحرس صلاحيّاتها بنفسها).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTLayers) return;
  var doc = global.document;
  global.GMT_WS_SHELL = 1;                 /* الصفحات داخل الطبقات تعرف أنّها مضمَّنة (gmt-refresh · whatsnew · intro) */
  var LS = 'gmt_layers_v1', AWAY_MS = 20000;
  var MAX_LIVE = function () { return innerWidth <= 760 ? 4 : 7; };
  var L = [], active = null, lastUse = {}, dirty = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(n, z) { try { if (global.GMTIcon && GMTIcon.has(n)) return GMTIcon.svg(n, z || 16); } catch (_) {} return ''; }
  function fileOf(u) { try { return decodeURIComponent(String(u || '').split('#')[0].split('?')[0].split('/').pop() || ''); } catch (_) { return String(u || ''); } }
  function relUrl(href) { try { var u = new URL(href, location.href); if (u.origin !== location.origin) return ''; return decodeURIComponent(u.pathname.split('/').pop()) + u.search; } catch (_) { return ''; } }
  function tool(u) { var T = global.GMTTools; if (!T) return null; var f = relUrl(u) || u; return T.find(f) || T.find(fileOf(f)); }
  function title(u) { var x = tool(u); return x ? (x.n && x.n.length <= 9 ? x.t : x.t) : fileOf(u).replace(/\.html$/, '').replace(/_/g, ' '); }
  function icon(u) { var x = tool(u); return (x && x.ic) || 'doc'; }
  function role() { try { if (global.GMTRole && GMTRole.isAdmin()) return 'admin'; } catch (_) {} try { return localStorage.getItem('gmt_session') ? 'staff' : 'guest'; } catch (_) { return 'guest'; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify({ L: L.map(function (x) { return { f: x.f, url: x.url }; }), who: role() + ':' + who() })); } catch (_) {} }
  function who() { try { var s = JSON.parse(localStorage.getItem('gmt_session') || 'null'); return (s && s.id) || ''; } catch (_) { return ''; } }
  function find(f) { for (var i = 0; i < L.length; i++) if (L[i].f === f) return L[i]; return null; }

  /* ── الطبقة: إطارٌ بملء الشاشة تحت الشريط الرفيع ── */
  var host, strip;
  function css() {
    if (doc.getElementById('gmt-layers-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-layers-css';
    s.textContent =
      '#gmt-lh{position:fixed;inset:0;z-index:8500;display:none;flex-direction:column;background:#fff}' +
      '#gmt-lh.on{display:flex}' +
      '#gmt-ls{flex:none;display:flex;align-items:center;gap:6px;padding:calc(6px + env(safe-area-inset-top,0px)) max(8px,env(safe-area-inset-right,0px)) 6px max(8px,env(safe-area-inset-left,0px));background:#fff;border-bottom:1px solid rgba(15,18,25,.08);font-family:Cairo,"Segoe UI",Tahoma,sans-serif}' +
      '#gmt-ls .lh{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:1px solid rgba(15,18,25,.10);border-radius:11px;background:#fff;color:#0f1219;font:800 13px inherit;cursor:pointer;flex:none}' +
      '#gmt-ls .lh:hover{border-color:#D5001C;color:#D5001C}' +
      '#gmt-ls .ly{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}#gmt-ls .ly::-webkit-scrollbar{display:none}' +
      '#gmt-ls .lc{position:relative;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 10px;border-radius:11px;border:1px solid transparent;background:#f4f5f7;color:#5b6472;font:700 12.5px inherit;cursor:pointer;flex:none;white-space:nowrap;max-width:170px}' +
      '#gmt-ls .lc span.t{overflow:hidden;text-overflow:ellipsis}' +
      '#gmt-ls .lc.on{background:#fff1f2;color:#D5001C;border-color:rgba(213,0,28,.30)}' +
      '#gmt-ls .lc .d{width:7px;height:7px;border-radius:50%;background:#D5001C;flex:none}' +
      '#gmt-ls .lc .x{display:none;width:20px;height:20px;border:0;border-radius:6px;background:none;color:inherit;padding:0;cursor:pointer;place-items:center}' +
      '#gmt-ls .lc.on .x{display:grid}#gmt-ls .lc .x:hover{background:rgba(213,0,28,.12)}' +
      '#gmt-lb{flex:1;position:relative;min-height:0}' +
      '#gmt-lb iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;display:none}#gmt-lb iframe.on{display:block}' +
      '.gl-resume{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 14px;padding:10px 12px;border:1px solid rgba(213,0,28,.25);border-radius:14px;background:#fff}' +
      '.gl-resume b{font-size:13.5px}.gl-resume .sp{flex:1}' +
      '.gl-resume a{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:11px;background:#fff1f2;color:#D5001C;font-weight:800;font-size:13px;text-decoration:none;border:1px solid rgba(213,0,28,.25)}' +
      '.gl-resume a .d{width:7px;height:7px;border-radius:50%;background:#D5001C}' +
      '@media print{#gmt-lh{display:none!important}}';
    (doc.head || doc.documentElement).appendChild(s);
  }
  function mount() {
    if (host) return;
    css();
    host = doc.createElement('div'); host.id = 'gmt-lh'; host.setAttribute('data-keep-fab', '1');
    host.innerHTML = '<div id="gmt-ls" role="navigation" aria-label="الأدوات المفتوحة"><button class="lh" type="button" data-lh aria-label="الرئيسية">' + ic('home', 16) + '<span>الرئيسية</span></button><div class="ly" role="tablist"></div></div><div id="gmt-lb"></div>';
    doc.body.appendChild(host);
    strip = host.querySelector('.ly');
    host.querySelector('[data-lh]').onclick = function () { home(); };
    strip.addEventListener('click', function (e) {
      var x = e.target.closest('[data-x]'); if (x) { e.stopPropagation(); close(x.getAttribute('data-x')); return; }
      var c = e.target.closest('.lc'); if (c) show(c.getAttribute('data-f'));
    });
    /* ضغطٌ مطوّل على طبقةٍ (هاتف) ⇒ إغلاقها */
    var lpT = null;
    strip.addEventListener('pointerdown', function (e) { var c = e.target.closest('.lc'); if (!c) return; lpT = setTimeout(function () { lpT = null; close(c.getAttribute('data-f')); }, 650); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (k) { strip.addEventListener(k, function () { if (lpT) { clearTimeout(lpT); lpT = null; } }); });
  }
  function paint() {
    if (!strip) return;
    strip.innerHTML = L.map(function (x) {
      return '<div class="lc' + (x.f === active ? ' on' : '') + '" role="tab" aria-selected="' + (x.f === active) + '" data-f="' + esc(x.f) + '" title="' + esc(x.t) + ' — اضغط مطوّلاً للإغلاق">' +
        ic(icon(x.url), 15) + '<span class="t">' + esc(x.t) + '</span>' + (dirty[x.f] ? '<span class="d" title="تغييرات غير محفوظة"></span>' : '') +
        '<button class="x" type="button" data-x="' + esc(x.f) + '" aria-label="إغلاق ' + esc(x.t) + '">' + (ic('close', 13) || '×') + '</button></div>';
    }).join('');
    var on = strip.querySelector('.lc.on'); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) {}
    resumeRow();
  }
  /* «تكمل من حيث توقفت» أعلى الرئيسيّة */
  function resumeRow() {
    var main = doc.getElementById('main'); if (!main) return;
    var r = doc.getElementById('gl-resume');
    if (!L.length) { if (r) r.parentNode.removeChild(r); return; }
    if (!r) { r = doc.createElement('div'); r.id = 'gl-resume'; r.className = 'gl-resume'; main.insertBefore(r, main.firstChild); }
    r.innerHTML = '<b>تكمل من حيث توقفت</b><span class="sp"></span>' + L.map(function (x) {
      return '<a href="' + esc(x.url) + '" data-gl-resume="' + esc(x.f) + '">' + ic(icon(x.url), 15) + esc(x.t) + (dirty[x.f] ? '<span class="d"></span>' : '') + '</a>';
    }).join('');
  }

  function frame(x) {
    if (x.el) return x.el;
    var f = doc.createElement('iframe');
    f.setAttribute('title', x.t);
    f.setAttribute('allow', 'camera; microphone; clipboard-read; clipboard-write; fullscreen; geolocation');
    f.src = x.url;
    f.addEventListener('load', function () { onLoad(x, f); });
    host.querySelector('#gmt-lb').appendChild(f);
    x.el = f; return f;
  }
  function evict() {
    var live = L.filter(function (x) { return x.el && x.f !== active && !dirty[x.f]; });
    var over = L.filter(function (x) { return x.el; }).length - MAX_LIVE();
    if (over <= 0) return;
    live.sort(function (a, b) { return (lastUse[a.f] || 0) - (lastUse[b.f] || 0); }).slice(0, over).forEach(function (x) {
      try { x.url = relUrl(x.el.contentWindow.location.href) || x.url; } catch (_) {}
      try { x.el.src = 'about:blank'; } catch (_) {} x.el.parentNode && x.el.parentNode.removeChild(x.el); x.el = null;   /* تُجمَّد — وتُفتح من رابطها حين تعود */
    });
  }
  function open(url, opt) {
    opt = opt || {};
    var u = relUrl(url) || String(url); var f = fileOf(u);
    if (!f || /^(home|index)\.html$/.test(f)) { home(); return; }
    if (global.GMTPerm && !GMTPerm.can(f) && !GMTPerm.can(u)) { location.href = u; return; }   /* صفحةٌ غير ممنوحة: تعرض قفلها كما كانت */
    mount();
    var x = find(f);
    if (!x) { x = { f: f, url: u, t: title(u), el: null }; L.push(x); }
    else if (u !== x.url && !dirty[f]) { x.url = u; if (x.el) try { x.el.contentWindow.location.href = u; } catch (_) { x.el.src = u; } }
    show(f, opt);
    save();
  }
  function show(f, opt) {
    var x = find(f); if (!x) return;
    mount(); frame(x);
    L.forEach(function (y) { if (y.el) y.el.classList.toggle('on', y.f === f); });
    var wasHome = !active;
    active = f; lastUse[f] = Date.now();
    host.classList.add('on'); doc.documentElement.style.overflow = 'hidden';
    if (wasHome && !(opt && opt.noHistory)) { try { history.pushState({ gmtLayer: f }, ''); } catch (_) {} }
    try { doc.title = x.t + ' · ' + baseTitle; } catch (_) {}
    paint(); evict();
    try { x.el.focus(); } catch (_) {}
  }
  var baseTitle = doc.title;
  function home(fromPop) {
    if (!active) return;
    active = null;
    if (host) host.classList.remove('on');
    doc.documentElement.style.overflow = '';
    try { doc.title = baseTitle; } catch (_) {}
    paint();
    if (!fromPop) { try { if (history.state && history.state.gmtLayer) history.back(); } catch (_) {} }
  }
  function isDirty(x) {
    if (dirty[x.f]) return true;
    try { var w = x.el && x.el.contentWindow; if (w && typeof w.onbeforeunload === 'function' && w.onbeforeunload({ preventDefault: function () {}, returnValue: '' })) return true; } catch (_) {}
    return false;
  }
  async function close(f) {
    var x = find(f); if (!x) return;
    if (isDirty(x)) {
      var ok = global.GMTAsk ? await GMTAsk.confirm('في «' + x.t + '» تغييرات غير محفوظة. تُغلقها وتضيع؟', { title: 'تغييرات غير محفوظة', okText: 'أغلق بلا حفظ', danger: true }) : true;
      if (!ok) return;
    }
    if (x.el) { try { x.el.src = 'about:blank'; } catch (_) {} if (x.el.parentNode) x.el.parentNode.removeChild(x.el); }
    L.splice(L.indexOf(x), 1); delete dirty[f];
    if (active === f) { var n = L[L.length - 1]; if (n) show(n.f, { noHistory: true }); else home(); }
    paint(); save();
  }

  /* داخل الطبقة: عنوان الصفحة · غير المحفوظ · روابط الأدوات الأخرى تفتح طبقتها · «الرئيسية» ترجع للرئيسيّة */
  function onLoad(x, f) {
    var w, d; try { w = f.contentWindow; d = f.contentDocument; } catch (_) { return; }
    if (!w || !d || w.location.href === 'about:blank') return;
    var nu = relUrl(w.location.href);
    if (nu && fileOf(nu) !== x.f) {
      if (/^(home|index)\.html$/.test(fileOf(nu))) { try { w.location.replace(x.url); } catch (_) {} home(); return; }   /* صفحةٌ حوّلت إطارها للرئيسيّة ⇒ لا رئيسيّة داخل طبقة */
    }
    if (nu) x.url = nu;
    dirty[x.f] = false; paint(); save();
    try {
      d.addEventListener('input', function (e) {
        var el = e.target; if (!el || !el.matches) return;
        if (el.matches('[type=search],[role=searchbox],[id*=search],[id*=Search],[id=q],[placeholder*="بحث"]')) return;
        if (!el.closest('form,[class*=modal],[id*=Modal],[id*=modal],.gmtask-ov,dialog,[role=dialog]')) return;
        if (!dirty[x.f]) { dirty[x.f] = true; paint(); }
      }, true);
      d.addEventListener('submit', function () { setTimeout(function () { dirty[x.f] = false; paint(); }, 1500); }, true);
      d.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('button,[role=button]');
        if (b && /حفظ|إنشاء|إصدار|تأكيد|إضافة طلب|إلغاء/.test(b.textContent || '')) setTimeout(function () { dirty[x.f] = false; paint(); }, 1800);
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || a.target === '_blank' || a.hasAttribute('download') || e.ctrlKey || e.metaKey || e.shiftKey) return;
        var href = a.getAttribute('href') || '';
        if (/^(https?:|mailto:|tel:|whatsapp:|javascript:|#)/i.test(href) && href.indexOf(location.origin) !== 0) return;
        if (!/\.html(\?|#|$)/.test(href)) return;
        var tf = fileOf(href);
        if (/^(home|index)\.html$/.test(tf)) { e.preventDefault(); e.stopPropagation(); home(); return; }
        if (tf === x.f) return;                                   /* الصفحة نفسها بمعاملٍ آخر ⇒ تتنقّل داخل طبقتها */
        e.preventDefault(); e.stopPropagation(); open(href);
      }, true);
    } catch (_) {}
  }

  /* ── الرئيسيّة: روابط الأدوات تفتح طبقات ── */
  doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || role() === 'guest') return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.closest('#gmt-lh') || a.target === '_blank' || a.hasAttribute('download') || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    if (a.getAttribute('data-locked') === '1') return;
    var href = a.getAttribute('href') || '';
    if (!/\.html(\?|#|$)/.test(href) || /^(https?:|mailto:|tel:)/i.test(href)) return;
    if (/^(home|index)\.html/.test(fileOf(href))) return;
    /* (TASK-B0521) صفحات الزبائن العامّة (التتبّع · المتجر · الموقع · الكفالة · التوظيف) تُفتح كما يراها الزبون — بانتروها (مشهد الشاحنة)
       لا طبقةً داخل التطبيق: كان رابط التتبّع في الرئيسيّة يُفتح طبقةً فلا يبدأ المشهد (t_track_road) */
    try { var tl = global.GMTTools && GMTTools.find && GMTTools.find(fileOf(href)); if (tl && tl.g === 'public') return; } catch (_) {}
    if (/^(track_order|store|site|search|hiring)\.html/.test(fileOf(href))) return;
    e.preventDefault(); open(href);
  }, false);   /* فقاعة لا التقاط: الرئيسيّة تسجّل الاستعمال (GMTHome.use) والقفل قبلنا */

  /* زرّ الرجوع في الهاتف ⇒ الرئيسيّة والطبقات باقية */
  addEventListener('popstate', function () { if (active) home(true); });
  /* الرجوع من الخلفية ⇒ الرئيسيّة (طلبه: «اطلع واعيفه بالخلفية وارجع ادخل عليه يتم بالرئيسية») */
  var hiddenAt = 0;
  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS && active) home();
    hiddenAt = 0;
  });
  /* تغيّر الحساب ⇒ تُغلق كلّ الطبقات (لا بيانات حسابٍ في حسابٍ آخر) */
  var who0 = role() + ':' + who();
  addEventListener('storage', function (e) {
    if (e.key && e.key !== 'gmt_session' && e.key !== 'gmt_active_acct') return;
    var w = role() + ':' + who(); if (w === who0) return; who0 = w; reset();
  });
  function reset() { L.slice().forEach(function (x) { if (x.el && x.el.parentNode) x.el.parentNode.removeChild(x.el); }); L = []; dirty = {}; home(); paint(); save(); }
  addEventListener('beforeunload', function (e) { save(); if (L.some(isDirty)) { e.preventDefault(); e.returnValue = ''; return ''; } });

  /* بعد إعادة فتح التطبيق: الطبقات السابقة تُعرض في «تكمل من حيث توقفت» (تُفتح حين تضغطها) */
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(LS) || 'null');
      if (!s || !Array.isArray(s.L) || s.who !== role() + ':' + who()) return;
      L = s.L.filter(function (x) { return x && x.f && x.url; }).map(function (x) { return { f: x.f, url: x.url, t: title(x.url), el: null }; });
    } catch (_) {}
  }
  /* الرئيسيّة تعيد رسم #main كثيراً ⇒ نعيد صفّ «تكمل» بعد كلّ رسم */
  function watchMain() {
    var mo = new MutationObserver(function () { if (L.length && !doc.getElementById('gl-resume') && doc.getElementById('main')) resumeRow(); });
    mo.observe(doc.body, { childList: true, subtree: true });
  }
  function boot() { if (role() === 'guest') return; restore(); watchMain(); resumeRow(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();

  global.GMTLayers = { open: open, home: home, close: close, list: function () { return L.map(function (x) { return { f: x.f, url: x.url, t: x.t, live: !!x.el, dirty: !!dirty[x.f] }; }); }, active: function () { return active; }, reset: reset };
})(window);
