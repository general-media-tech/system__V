/* ═══════════════════════════════════════════════════════════════════════════
   gmt-camfinder.js — «🎯 إكسسوارات كاميرتك» (Camera Finder) · TASK-A0518
   ───────────────────────────────────────────────────────────────────────────
   المالك seq 744 «يختار العميل الكاميرا، مثلاً Canon EOS R8، والمتجر يعرض له البطاريات والقبضات والشواحن … المتوافقة»
   · «GMT Camera Finder: الشركة ⇐ الكاميرا ⇐ ما الذي يبحث عنه ⇐ المنتجات المتوافقة فقط مع أسعارها وتوفّرها»
   · seq 745 «محرّك التوافق: R8 ⇐ البطاريات ⇐ الشواحن ⇐ العدسات ⇐ القبضات ⇐ المحوّلات».
   القواعد:
     • قائمة الكاميرات من دليل التوافقيات (GMTCompatKB: البطاريات والقبضات) + كاميرات المتجر نفسه — **لا تظهر كاميرا ليس لها منتج متوافق واحد**.
     • البطارية والشاحن والقبضة من الدليل (resolve + intentHit) — نفس محرّك البحث بالتوافق.
     • العدسات بالتركيب (mount): R ⇐ RF · M ⇐ EF-M · DSLR ⇐ EF/EF-S · ومحوّل EF⇐RF لكاميرات R.
     • ما يذكر توافقُه موديلَ الكاميرا بالمساواة (GMTKit.fitsCode) — كفرات · أغطية · غيرها.
     • «يناسب كلّ الكاميرات»: ذاكرة SD وحقائب الكاميرا (عنوان منفصل).
   المدخلات: زرّ في شريط البحث · رابط في القائمة الجانبية · رابط مشاركة store.html#cam=r8&k=battery · الكاميرا تُحفظ على جهاز الزبون.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var LS = 'gmt_my_cam';
  var KINDS = [['all', 'الكلّ'], ['battery', 'بطاريات'], ['charger', 'شواحن'], ['grip', 'قبضات'], ['lens', 'عدسات'], ['adapter', 'محوّلات'], ['cover', 'كفرات وأغطية'], ['general', 'ذواكر وحقائب']];
  function AR(s) { return String(s == null ? '' : s).toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function keyOf(model) { return AR(model).replace(/^eos\s*/, '').replace(/mark\s*/g, 'mark').replace(/[^a-z0-9]+/g, ''); }
  function mountOf(model) {
    var m = String(model);
    if (/^EOS R(\b|\d|P|a\b)/.test(m)) return 'RF';
    if (/^EOS M/.test(m)) return 'EF-M';
    if (/^PowerShot/.test(m)) return '';
    return 'EF';
  }
  function store() { try { return (g.__gmtStore && g.__gmtStore()) || g.store || {}; } catch (_) { return {}; } }   /* store.html يعرّف store بـlet ⇒ يُمرَّر بـ__gmtStore */
  function catPath(id) { try { return g._catPath ? g._catPath(id) : ['', '']; } catch (_) { return ['', '']; } }
  function cats(p) { return (p.category_ids && p.category_ids.length ? p.category_ids : [p.category_id]).map(catPath); }
  function inTop(p, re) { return cats(p).some(function (c) { return re.test(c[0] || ''); }); }
  function inSub(p, re) { return cats(p).some(function (c) { return re.test(c[1] || ''); }); }
  function shape(p) { return { name: p.name || '', short_name: p.short_name || '', alt_names: p.alt_names || '', compat: p.compat || '', group_name: cats(p).map(function (c) { return c[1] || c[0]; }).join(' ') }; }
  function codes(key) { return [/\d/.test(key) ? key : 'eos' + key]; }   /* «R» وحده حرفٌ يطابق كلّ شيء ⇒ «EOS R» */
  function fits(p, key) { var K = g.GMTKit; return !!(K && K.fitsCode && K.fitsCode((p.name || '') + ' ' + (p.compat || '') + ' ' + (p.alt_names || ''), codes(key))); }

  /* الكاميرات المعروفة: من الدليل + من كاميرات المتجر */
  function knownCameras() {
    var KB = g.GMTCompatKB, out = {}, add = function (model) { model = String(model || '').trim(); if (!model) return; var k = keyOf(model); if (k && !out[k]) out[k] = { key: k, name: /^(EOS|PowerShot)/.test(model) ? model : 'EOS ' + model, brand: 'Canon', mount: mountOf(/^(EOS|PowerShot)/.test(model) ? model : 'EOS ' + model) }; };
    try {
      var src = KB && KB._cams ? KB._cams() : null;
      (src || []).forEach(add);
    } catch (_) {}
    (store().products || []).forEach(function (p) {
      if (!inSub(p, /^كاميرات$/) || !/canon|كانون/i.test(p.name || '')) return;
      var m = /(?:eos\s*)?((?:r|m)\s?\d{1,3}|rp|ra|r(?=\s|$)|\d{2,4}d)\s*(mark\s*ii+|m(?:ar)?k?\s*ii+|ii+)?/i.exec(String(p.name).replace(/canon/i, '').trim());
      /* من أسماء المتجر نأخذ كاميرات R فقط (الدليل يعرف البقيّة) — قراءة «M 50 …» كانت تُنتج «EOS M1» غير الموجودة */
      if (m && /^r/i.test(m[1])) add('EOS ' + (m[1].toUpperCase().replace(/\s+/g, '') + (m[2] ? ' Mark II' + (/iii/i.test(m[2]) ? 'I' : '') : '')).replace(/^(\d+)D$/, '$1D'));
    });
    return out;
  }

  /* المنتجات المتوافقة لكاميرا ونوع */
  function match(cam, kind) {
    var KB = g.GMTCompatKB, P = (store().products || []).filter(function (p) { return !Array.isArray(p.package_items); }), out = [];
    var seen = {}, push = function (p) { if (p && !seen[p.id]) { seen[p.id] = 1; out.push(p); } };
    var kbKind = function (word) {
      if (!KB || !KB.resolve || !KB.intentHit) return [];
      var it = KB.resolve(word + ' ' + cam.name.replace(/^EOS\s*/, ''));
      return it ? P.filter(function (p) { return KB.intentHit(shape(p), it); }) : [];
    };
    var isLens = function (p) { return inTop(p, /العدسات/) || inSub(p, /^عدسات|سيغما|يونغنو/); };
    if (kind === 'battery') kbKind('بطاريه').forEach(push);
    else if (kind === 'charger') kbKind('شاحن').forEach(push);
    else if (kind === 'grip') kbKind('قبضه').forEach(push);
    else if (kind === 'lens') {
      if (!cam.mount) return out;
      P.filter(isLens).forEach(function (p) {
        var t = (p.name || '') + ' ' + (p.compat || '');
        var rf = /\bRF\b|RF-S|\bRF\d/i.test(t), efm = /EF-?M\b/i.test(t), ef = /\bEF\b|EF-S|ef_s|efs/i.test(t);
        var plainCanon = !rf && !efm && !ef && /canon|كانون/i.test(t);   /* «Canon 50 II» بلا ذكر للتركيب ⇒ عدسة EF */
        if (cam.mount === 'RF' ? rf : cam.mount === 'EF-M' ? efm : (ef || plainCanon) && !rf) push(p);
      });
    } else if (kind === 'adapter') {
      P.filter(function (p) { return /ادابتر|أدابتر|adapter|محو[ّ]?ل|mount/i.test(p.name || '') && !/شاحن|charger|usb|type-?c|كبل|cable|lightning|لايتن/i.test(p.name || ''); }).forEach(function (p) {
        var t = AR((p.name || '') + ' ' + (p.compat || ''));
        if (cam.mount === 'RF' && /ef.{0,6}(r|rf)\b|ef[-_ ]?(eos)?[-_ ]?r\b|rf/.test(t)) push(p);
        else if (cam.mount === 'EF-M' && /ef.{0,4}m\b|ef-?m/.test(t)) push(p);
        else if (fits(p, cam.key)) push(p);
      });
    } else if (kind === 'cover') {
      P.filter(function (p) { return !isLens(p) && !inSub(p, /^كاميرات$/) && /كفر|سيليكون|silicone|cage|كيج|غطاء|غطا|cap|لزق|حماية شاشة|screen/i.test(p.name || '') && fits(p, cam.key); }).forEach(push);
    } else if (kind === 'general') {
      P.filter(function (p) { return (inSub(p, /ذواكر/) && /ذاكر|memory|(^|\s)sd/i.test(p.name || '') && !/micro|قارئ|علب/i.test(p.name || '')) || (inTop(p, /إكسسوارات الكاميرا|كلّ الحقائب/) && inSub(p, /حقائب/)); }).forEach(push);
    } else {   /* all: ما يخصّ الكاميرا أوّلاً ثمّ العامّ */
      ['battery', 'charger', 'grip', 'lens', 'adapter', 'cover'].forEach(function (k) { match(cam, k).forEach(push); });
      P.filter(function (p) { return !isLens(p) && !inSub(p, /^كاميرات$/) && fits(p, cam.key); }).forEach(push);
    }
    return out;
  }
  function specific(cam) { return match(cam, 'all'); }

  var _list = null;
  function cameras() {
    if (_list) return _list;
    var all = knownCameras(), arr = [];
    Object.keys(all).forEach(function (k) { var c = all[k]; if (specific(c).length) arr.push(c); });   /* لا كاميرا بنتيجة فارغة */
    var ord = function (c) { return c.mount === 'RF' ? 0 : c.mount === 'EF' ? 1 : c.mount === 'EF-M' ? 2 : 3; };   /* كاميرات R أوّلاً (الأحدث والأكثر طلباً) */
    arr.sort(function (a, b) { return (ord(a) - ord(b)) || a.name.localeCompare(b.name, 'en', { numeric: true }); });
    return (_list = arr);
  }
  function reset() { _list = null; }

  /* ── الواجهة ── */
  var S = { cam: null, kind: 'all', q: '', pick: false };
  function save() { try { if (S.cam) localStorage.setItem(LS, S.cam.key); } catch (_) {} }
  function saved() { try { return localStorage.getItem(LS) || ''; } catch (_) { return ''; } }
  function css() {
    if (document.getElementById('gcf-css')) return;
    var st = document.createElement('style'); st.id = 'gcf-css';
    st.textContent = '#gcf{position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}#gcf.on{display:flex}' +
      '#gcf .sh{background:#fff;width:100%;max-width:640px;max-height:92vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;font-family:Cairo,Tajawal,sans-serif;direction:rtl}' +
      '#gcf .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 18px 10px;border-bottom:1px solid #f0f0f0}#gcf .hd h3{font:800 17px Cairo,sans-serif;margin:0}' +
      '#gcf .x{width:34px;height:34px;border-radius:50%;border:0;background:#f3f4f6;font-size:16px;cursor:pointer}#gcf .bd{overflow-y:auto;padding:12px 16px 24px}' +
      '#gcf .lbl{font:800 13px Cairo,sans-serif;color:#6b7280;margin:10px 2px 6px}#gcf .chips{display:flex;flex-wrap:wrap;gap:6px}' +
      '#gcf .chip{border:1.5px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 12px;font:700 13px Cairo,sans-serif;cursor:pointer;color:#111}#gcf .chip.on{background:#D5001C;border-color:#D5001C;color:#fff}' +
      '#gcf input{width:100%;box-sizing:border-box;height:40px;border:1.5px solid #e5e7eb;border-radius:12px;padding:0 12px;font:600 14px Cairo,sans-serif;margin-bottom:8px}' +
      '#gcf .grid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:8px}#gcf .sec{font:800 14px Cairo,sans-serif;margin:16px 2px 4px}' +
      '#gcf .empty{text-align:center;color:#6b7280;font:600 13.5px Cairo,sans-serif;padding:18px 8px;line-height:1.8}#gcf .share{border:0;background:#f3f4f6;border-radius:10px;padding:6px 10px;font:700 12px Cairo,sans-serif;cursor:pointer}' +
      '@media(min-width:768px){#gcf{align-items:center}#gcf .sh{border-radius:22px}}';
    document.head.appendChild(st);
  }
  function el() {
    var m = document.getElementById('gcf'); if (m) return m;
    css(); m = document.createElement('div'); m.id = 'gcf';
    m.innerHTML = '<div class="sh"><div class="hd"><h3>🎯 إكسسوارات كاميرتك</h3><div style="display:flex;gap:6px;align-items:center"><button type="button" class="share" data-gcf-share>مشاركة</button><button type="button" class="x" data-gcf-x aria-label="إغلاق">✕</button></div></div><div class="bd" data-gcf-body></div></div>';
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-gcf-x]')) close(); else if (e.target.closest('[data-gcf-share]')) share(); });
    document.body.appendChild(m); return m;
  }
  function link() { return location.origin + location.pathname + '#cam=' + encodeURIComponent(S.cam ? S.cam.key : '') + (S.kind && S.kind !== 'all' ? '&k=' + S.kind : ''); }
  function share() {
    if (!S.cam) return; var u = link();
    if (navigator.share) navigator.share({ title: 'إكسسوارات ' + S.cam.name, url: u }).catch(function () {});
    else try { navigator.clipboard.writeText(u); if (g.showToast) g.showToast('تم نسخ الرابط ✓', 'success'); } catch (_) {}
  }
  function render() {
    var body = el().querySelector('[data-gcf-body]'), list = cameras(), h = '';
    h += '<div class="lbl">١ · الشركة</div><div class="chips"><button type="button" class="chip on">Canon</button></div>';
    h += '<div class="lbl">٢ · الكاميرا</div><input type="search" data-gcf-q placeholder="اكتب موديل كاميرتك: R8 · 250D · M50 …" value="' + esc(S.q) + '">';
    var q = keyOf(S.q), shown = list.filter(function (c) { return !q || c.key.indexOf(q) >= 0; });
    /* كاميرا مختارة ⇒ القائمة الطويلة تُطوى إلى الكاميرا نفسها + «غيّر» — النتائج تظهر فوراً بلا تمرير */
    if (S.cam && !q && !S.pick) shown = [S.cam];
    h += '<div class="chips" data-gcf-cams>' + (shown.length ? shown.map(function (c) { return '<button type="button" class="chip' + (S.cam && S.cam.key === c.key ? ' on' : '') + '" data-cam="' + esc(c.key) + '">' + esc(c.name) + '</button>'; }).join('') : '<div class="empty">ما في كاميرا بهالاسم عنا ملحقاتها — <b>اسألنا ومنأمّنلك ياها</b></div>') + (S.cam && !q && !S.pick ? '<button type="button" class="chip" data-gcf-change style="border-style:dashed">غيّر الكاميرا</button><button type="button" class="chip" data-gcf-forget style="border-style:dashed;color:#6b7280">✕ انسَ كاميرتي</button>' : '') + '</div>';
    if (S.cam) {
      h += '<div class="lbl">٣ · شو بدّك؟</div><div class="chips">' + KINDS.map(function (k) { return '<button type="button" class="chip' + (S.kind === k[0] ? ' on' : '') + '" data-kind="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>';
      var res = match(S.cam, S.kind);
      h += '<div class="sec">' + (S.kind === 'general' ? 'يناسب كلّ الكاميرات' : 'متوافق مع ' + esc(S.cam.name)) + ' (' + res.length + ')</div>';
      h += res.length ? '<div class="grid" data-gcf-grid></div>' : '<div class="empty">ما عنا حالياً ' + esc((KINDS.filter(function (k) { return k[0] === S.kind; })[0] || ['', ''])[1]) + ' لـ' + esc(S.cam.name) + ' — <b>اطلبه ومنأمّنه إلك</b></div>';
      if (S.kind === 'all') h += '<div class="sec">يناسب كلّ الكاميرات</div><div class="grid" data-gcf-grid2></div>';
      body.innerHTML = h;
      var fill = function (sel, arr) { var gr = body.querySelector(sel); if (!gr || !g._buildProductCard) return; arr.slice(0, 60).forEach(function (p) { try { var c = g._buildProductCard(p); c.addEventListener('click', function () { close(true); }, true); gr.appendChild(c); } catch (_) {} }); };
      fill('[data-gcf-grid]', res);
      if (S.kind === 'all') fill('[data-gcf-grid2]', match(S.cam, 'general').slice(0, 8));
    } else body.innerHTML = h;
    var inp = body.querySelector('[data-gcf-q]');
    inp.oninput = function () { S.q = inp.value; var pos = inp.selectionStart; render(); var n = el().querySelector('[data-gcf-q]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} };
    body.querySelectorAll('[data-cam]').forEach(function (b) { b.onclick = function () { S.cam = list.filter(function (c) { return c.key === b.dataset.cam; })[0] || null; S.kind = 'all'; S.pick = false; S.q = ''; save(); render(); try { if (g.GMTCamFinder.onCam) g.GMTCamFinder.onCam(); } catch (_) {} }; });
    { var ch = body.querySelector('[data-gcf-change]'); if (ch) ch.onclick = function () { S.pick = true; render(); }; }
    { var fg = body.querySelector('[data-gcf-forget]'); if (fg) fg.onclick = function () { forget(); S.cam = null; S.pick = true; render(); try { if (g.GMTCamFinder.onCam) g.GMTCamFinder.onCam(); } catch (_) {} }; }
    body.querySelectorAll('[data-kind]').forEach(function (b) { b.onclick = function () { S.kind = b.dataset.kind; render(); }; });
  }
  function open(opt) {
    opt = opt || {};
    var list = cameras(), want = keyOf(opt.cam || saved());
    S.cam = list.filter(function (c) { return c.key === want; })[0] || S.cam || null;
    S.kind = KINDS.some(function (k) { return k[0] === opt.kind; }) ? opt.kind : (S.kind || 'all');
    S.pick = !S.cam; S.q = '';   /* كلّ فتح يبدأ مطويّاً على الكاميرا المحفوظة */
    render(); el().classList.add('on'); document.body.style.overflow = 'hidden';
  }
  function close(keep) { var m = document.getElementById('gcf'); if (m) m.classList.remove('on'); if (!keep) document.body.style.overflow = ''; }

  /* (TASK-A0519) شارة «✓ متوافق مع كاميرتك» على بطاقات المتجر: كاميرا الزبون المحفوظة ⇒ مجموعة معرّفات ما يخصّها (تُحسب مرّة وتُعاد عند تغيّر الكاميرا أو الكتالوج) */
  var _mine = { key: '', n: -1, ids: null, cam: null };
  function mine() {
    var k = saved(), P = store().products || [];
    if (!k || store().__light) return null;
    if (_mine.key !== k || _mine.n !== P.length) {
      var c = cameras().filter(function (x) { return x.key === k; })[0] || null;
      _mine = { key: k, n: P.length, cam: c, ids: c ? match(c, 'all').reduce(function (o, p) { o[p.id] = 1; return o; }, {}) : null };
    }
    return _mine.cam ? _mine : null;
  }
  function fitsMine(p) { var m = mine(); return !!(m && p && m.ids[p.id]); }
  function badge(p) { var m = mine(); if (!m || !p || !m.ids[p.id]) return ''; return '<span class="gmt-camfit" data-camfit="1" style="display:inline-block;align-self:flex-start;background:#ecfdf5;color:#047857;border-radius:8px;padding:2px 7px;font-size:10.5px;font-weight:800;line-height:1.6">✓ يناسب ' + esc(m.cam.name.replace(/^EOS\s*/, '')) + '</span>'; }
  function forget() { try { localStorage.removeItem(LS); } catch (_) {} _mine = { key: '', n: -1, ids: null, cam: null }; }

  g.GMTCamFinder = { open: open, close: close, cameras: cameras, match: match, reset: reset, keyOf: keyOf, mountOf: mountOf, mine: mine, fitsMine: fitsMine, badge: badge, forget: forget };
})(typeof window !== 'undefined' ? window : globalThis);
