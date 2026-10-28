/* ═══════════════════════════════════════════════════════════════════════════
   gmt-gallery.js — كلّ صور المنتج (الجرد + المتجر) في عارضٍ واحد
   أُنشئ: 2026-10-27 · TASK-0197 (المالك seq 133)

   طلبُك: «في المتجر ممكن في الجرد ممكن اكبس عليها او في نقطه البيع تعرض لي باقي الصور يعني عرض في المتجر».
   كانت صورة الجرد وحدها تُعرض (والنقر عليها يكبّرها). الآن النقر على صورة المنتج في تفاصيله (الجرد · نقطة البيع)
   يفتح عارضاً بكلّ صوره: صورة الجرد ثمّ صور منتج المتجر المربوط (رابط المتجر · inv_id · الباركود) — بلا تكرار.
   وشارةٌ صغيرة «🖼️ N» على الصورة حين تكون عنده أكثر من صورة.

   GMTGallery.open(urls, start, title)   عارضٌ: ‹ › · سحبٌ بالإصبع · أسهم لوحة المفاتيح · مصغّرات · Esc
   GMTGallery.imagesFor(p) ⇒ Promise<[url]>  صورة الجرد + صور المتجر (الكتالوج يُقرأ مرّةً كل دقيقة)
   GMTGallery.openFor(p, title)           يجمعها ثمّ يعرضها
   GMTGallery.badge(el, p)                يضيف «🖼️ N» على عنصر الصورة إن زادت على واحدة
   GMTGallery.inline(el, p, title)        (TASK-0208) التقليب داخل صورة التفاصيل نفسها: ‹ › · سحب · «٢ من ٥» — والنقر يفتح العارض على الصورة نفسها

   (TASK-0208 · المالك seq 139 «لازم ادخل على الصوره حتى يفتح لي اياها ولازم يعطيني ازرار انتقال او في السحب» · «صور ما عم تنعرض …
   كم نقطه في وسط الشاشه») الصورة الكبيرة كانت عنصراً واحداً يُبدَّل رابطه، وحارس الصور (gmt-image-guard.js) يعلّمه «انتهى» بعد أوّل صورة
   فيبقى النائب الرماديّ (نقاط) لكل صورةٍ بعدها. الآن عنصرٌ جديد لكل صورة ⇒ يُحمَّل كلٌّ منها (من نسخة الجهاز إن وُجدت).
   الترتيب: في الجرد صورة الجرد أوّلاً ثمّ صور المتجر — وفي المتجر صوره كما رُتّبت وصورة الجرد تُضاف في آخرها (gmt-specs.js · bridge.html).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTGallery) return;
  var doc = global.document, cat = null;

  function storeDb() { return global.GMT_DB && global.GMT_DB.STORE && global.GMT_DB.STORE.url ? global.GMT_DB.STORE : null; }
  function catalog() {
    if (cat && Date.now() - cat.at < 60000) return cat.p;
    var D = storeDb(); if (!D) return Promise.resolve([]);
    var p = fetch(D.url + '/rest/v1/gmt_store?id=eq.1&select=products', { headers: { apikey: D.key, Authorization: 'Bearer ' + D.key } })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (a) { return (a && a[0] && Array.isArray(a[0].products)) ? a[0].products : []; })
      .catch(function () { return []; });
    cat = { at: Date.now(), p: p };
    return p;
  }
  function findStore(prods, p) {
    if (global.GMTSpecs && GMTSpecs._findStore) return GMTSpecs._findStore(prods, p);
    var m = /#product=([^&]+)/.exec(String(p.store_url || '')), sid = m ? decodeURIComponent(m[1]) : '', bc = String(p.barcode || '').trim();
    var byBc = bc ? prods.filter(function (x) { return x && String(x.barcode || '').trim() === bc; }) : [];
    return (sid && prods.filter(function (x) { return x && String(x.id) === sid; })[0]) ||
      prods.filter(function (x) { return x && x.inv_id != null && String(x.inv_id) === String(p.id); })[0] || (byBc.length === 1 ? byBc[0] : null);
  }
  function uniq(a) { var seen = {}; return a.filter(function (u) { u = String(u || '').trim(); if (!u || seen[u]) return false; seen[u] = 1; return true; }); }
  function imagesFor(p) {
    /* (TASK-0259) صور الجرد كلّها بترتيب الجرد (images) — ثمّ صور المتجر */
    var own = p && Array.isArray(p.images) && p.images.length ? p.images.concat(p.image_url || []) : (p && p.image_url ? [p.image_url] : []);
    if (!p) return Promise.resolve([]);
    return catalog().then(function (prods) {
      var sp = findStore(prods, p), si = sp ? [].concat(sp.image || [], sp.image_url || [], sp.images || []) : [];
      return uniq(own.concat(si.map(function (x) { return typeof x === 'string' ? x : (x && (x.url || x.src)) || ''; })));
    }, function () { return own; });
  }

  function css() {
    if (doc.getElementById('gmt-gal-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-gal-css';
    s.textContent =
      '#gmt-gal{position:fixed;inset:0;z-index:2147483300;background:#0b0d11;display:flex;flex-direction:column;direction:rtl;font-family:Cairo,system-ui,sans-serif;color:#fff}' +
      '#gmt-gal .gg-top{display:flex;align-items:center;gap:8px;padding:10px 12px}#gmt-gal .gg-top b{flex:1;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#gmt-gal button{font:inherit;font-weight:900;color:#fff;background:rgba(255,255,255,.12);border:0;border-radius:12px;cursor:pointer}' +
      '#gmt-gal .gg-x{width:40px;height:40px;font-size:18px}#gmt-gal .gg-n{font-size:12px;font-weight:800;opacity:.85}' +
      '#gmt-gal .gg-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;touch-action:pan-y}' +
      '#gmt-gal .gg-stage img{max-width:100%;max-height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none;background:#fff;border-radius:6px}' +
      '#gmt-gal .gg-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;font-size:22px}#gmt-gal .gg-prev{right:8px}#gmt-gal .gg-next{left:8px}' +
      '#gmt-gal .gg-thumbs{display:flex;gap:6px;overflow-x:auto;padding:8px 10px calc(10px + env(safe-area-inset-bottom));scrollbar-width:none}' +
      '#gmt-gal .gg-thumbs button{flex:0 0 auto;width:54px;height:54px;padding:0;overflow:hidden;border:2px solid transparent;background:#fff}#gmt-gal .gg-thumbs button.on{border-color:#D5001C}' +
      '#gmt-gal .gg-thumbs img{width:100%;height:100%;object-fit:cover}' +
      '.gmt-gal-in{position:relative;touch-action:pan-y}.gmt-gal-in>img{display:block}' +
      '.gmt-gal-in .gi-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:38px;height:38px;border-radius:50%;border:0;background:rgba(15,18,25,.62);color:#fff;font:900 20px/1 system-ui,sans-serif;cursor:pointer;display:grid;place-items:center}' +
      '.gmt-gal-in .gi-prev{right:8px}.gmt-gal-in .gi-next{left:8px}' +
      '.gmt-gal-in .gi-n{position:absolute;bottom:8px;left:8px;z-index:3;background:rgba(15,18,25,.72);color:#fff;font:800 11.5px/1 Cairo,system-ui,sans-serif;padding:5px 9px;border-radius:999px;pointer-events:none;direction:rtl;unicode-bidi:isolate}' +
      '.gmt-gal-in .gi-dots{position:absolute;bottom:9px;right:50%;transform:translateX(50%);z-index:3;display:flex;gap:4px;pointer-events:none}.gmt-gal-in .gi-dots i{width:7px;height:7px;border-radius:50%;background:rgba(15,18,25,.28);box-shadow:0 0 0 1.5px rgba(255,255,255,.9)}.gmt-gal-in .gi-dots i.on{background:#D5001C}' +
      '.gmt-gal-badge{position:absolute;bottom:8px;left:8px;background:rgba(15,18,25,.78);color:#fff;font:800 11px/1 Cairo,system-ui,sans-serif;padding:5px 8px;border-radius:999px;pointer-events:none;z-index:2}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  function open(urls, start, title) {
    urls = uniq(urls || []); if (!urls.length) return null;
    css(); var old = doc.getElementById('gmt-gal'); if (old) old.remove();
    var i = Math.max(0, Math.min(urls.length - 1, start || 0));
    var root = doc.createElement('div'); root.id = 'gmt-gal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('data-keep-fab', '1');
    root.innerHTML = '<div class="gg-top"><b></b><span class="gg-n"></span><button type="button" class="gg-x" aria-label="إغلاق">✕</button></div>' +
      '<div class="gg-stage"><img alt="" class="gg-img"><button type="button" dir="ltr" class="gg-nav gg-prev" aria-label="السابقة">&#x203A;</button><button type="button" dir="ltr" class="gg-nav gg-next" aria-label="التالية">&#x2039;</button></div>' +
      '<div class="gg-thumbs"></div>';
    doc.body.appendChild(root);
    root.querySelector('.gg-top b').textContent = title || '';
    var stage = root.querySelector('.gg-stage'), img = stage.querySelector('.gg-img'), n = root.querySelector('.gg-n'), th = root.querySelector('.gg-thumbs');
    var prev = root.querySelector('.gg-prev'), next = root.querySelector('.gg-next');
    urls.forEach(function (u, k) { var b = doc.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'صورة ' + (k + 1)); var t = doc.createElement('img'); t.src = u; t.alt = ''; t.loading = 'lazy'; b.appendChild(t); b.onclick = function () { show(k); }; th.appendChild(b); });
    if (urls.length < 2) { prev.style.display = next.style.display = 'none'; th.style.display = 'none'; }
    function show(k) {
      i = (k + urls.length) % urls.length;
      var im2 = doc.createElement('img'); im2.className = 'gg-img'; im2.alt = (title || 'صورة') + ' ' + (i + 1); im2.src = urls[i];   // عنصرٌ جديد (حارس الصور)
      img.replaceWith(im2); img = im2;
      n.textContent = urls.length > 1 ? (i + 1) + ' من ' + urls.length : '';
      [].forEach.call(th.children, function (b, j) { b.className = j === i ? 'on' : ''; if (j === i && b.scrollIntoView) try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (_) {} });
    }
    function close() { root.remove(); doc.removeEventListener('keydown', onKey, true); try { doc.body.style.overflow = ov; } catch (_) {} }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i + 1); }      // واجهةٌ من اليمين لليسار: اليسار = التالية
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(i - 1); }
    }
    var ov = doc.body.style.overflow; doc.body.style.overflow = 'hidden';
    doc.addEventListener('keydown', onKey, true);
    root.querySelector('.gg-x').onclick = close;
    prev.onclick = function () { show(i - 1); }; next.onclick = function () { show(i + 1); };
    stage.addEventListener('click', function (e) { if (e.target === this) close(); });
    swipe(stage, function (d) { show(i + d); });
    show(i);
    return root;
  }
  /* سحبٌ أفقيّ بالإصبع: يسارٌ ⇒ التالية (+1) · يمينٌ ⇒ السابقة (−1) · el.__swiped يمنع أن تُعدّ السحبة نقرةً تفتح العارض */
  function swipe(el, go) {
    var sx = null, sy = 0;
    el.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (sx == null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { el.__swiped = Date.now(); go(dx < 0 ? 1 : -1); }
    });
  }
  /* (TASK-0208) التقليب داخل صورة التفاصيل نفسها */
  function inline(el, p, title) {
    if (!el || !p) return Promise.resolve(0);
    return imagesFor(p).then(function (u) {
      if (!el.isConnected) return u.length;
      css(); var i = 0, old = el.querySelector('img');
      var openAt = function () { if (Date.now() - (el.__swiped || 0) < 400) return; open(u.length ? u : (p.image_url ? [p.image_url] : []), i, title || p.name || ''); };
      if (old) { old.removeAttribute('onclick'); old.onclick = openAt; old.style.cursor = 'zoom-in'; }
      if (u.length < 2) return u.length;
      el.classList.add('gmt-gal-in'); if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var b0 = el.querySelector('.gmt-gal-badge'); if (b0) b0.remove();
      var prev = doc.createElement('button'), next = doc.createElement('button'), cnt = doc.createElement('span'), dots = doc.createElement('span');
      prev.type = next.type = 'button'; prev.className = 'gi-nav gi-prev'; next.className = 'gi-nav gi-next'; prev.setAttribute('dir', 'ltr'); next.setAttribute('dir', 'ltr');
      prev.setAttribute('aria-label', 'الصورة السابقة'); next.setAttribute('aria-label', 'الصورة التالية'); prev.innerHTML = '&#x203A;'; next.innerHTML = '&#x2039;';
      cnt.className = 'gi-n'; dots.className = 'gi-dots';
      if (u.length <= 10) dots.innerHTML = u.map(function () { return '<i></i>'; }).join('');
      el.appendChild(prev); el.appendChild(next); el.appendChild(cnt); el.appendChild(dots);
      var show = function (k) {
        i = (k + u.length) % u.length;
        var cur = el.querySelector('img'), im2 = doc.createElement('img');
        if (cur) { im2.className = cur.className; im2.style.cssText = cur.style.cssText; im2.alt = cur.alt; }
        im2.decoding = 'async'; im2.onclick = openAt; im2.style.cursor = 'zoom-in'; im2.src = u[i];       // عنصرٌ جديد لكل صورة (حارس الصور)
        if (cur) cur.replaceWith(im2); else el.insertBefore(im2, el.firstChild);
        cnt.textContent = (i + 1) + ' من ' + u.length;
        [].forEach.call(dots.children, function (d, j) { d.className = j === i ? 'on' : ''; });
      };
      prev.onclick = function (e) { e.stopPropagation(); show(i - 1); };
      next.onclick = function (e) { e.stopPropagation(); show(i + 1); };
      swipe(el, function (d) { show(i + d); });
      cnt.textContent = '1 من ' + u.length; [].forEach.call(dots.children, function (d, j) { d.className = j === 0 ? 'on' : ''; });
      el.__gal = { show: show, urls: u, at: function () { return i; } };
      return u.length;
    });
  }
  function openFor(p, title) { return imagesFor(p).then(function (u) { return open(u.length ? u : (p && p.image_url ? [p.image_url] : []), 0, title || (p && p.name) || ''); }); }
  function badge(el, p) {
    if (!el || !p) return Promise.resolve(0);
    return imagesFor(p).then(function (u) {
      if (u.length < 2 || !el.isConnected) return u.length;
      css(); if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var b = el.querySelector('.gmt-gal-badge') || doc.createElement('span'); b.className = 'gmt-gal-badge'; b.textContent = '🖼️ ' + u.length + ' صور'; el.appendChild(b);
      return u.length;
    });
  }
  global.GMTGallery = { open: open, openFor: openFor, imagesFor: imagesFor, badge: badge, inline: inline, _reset: function () { cat = null; } };
})(typeof window !== 'undefined' ? window : this);
