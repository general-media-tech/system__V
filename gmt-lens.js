/* ═══════════════════════════════════════════════════════════════════════════
   gmt-lens.js — «عدسة GMT»: صوّر المنتج أو علبته ⇒ أقرب منتجاتنا في الجرد (TASK-A0576 · المالك seq 974)
   «مثل عدسة جوجل — أفتحها وأصوّر المنتج — لكن شغلتها ما تبحث على جوجل، تبحث في السيستم عندنا من خلال الكتابة أو الأسماء،
    يشتغلها العقل، يعطيني أقرب المطابقات لأعرف شو اسم هذا المنتج على الجرد» — للجرد: بضاعة بلا باركود واسمها على العلبة غير اسمها في الجرد.
   ① العقل يقرأ ما على المنتج/العلبة (gmt-vision): الماركة · الموديل · الاسم المكتوب · كلّ نصّ ظاهر
   ② البحث في الجرد بالقراءة: الأسماء · الأسماء البديلة · الموديل · التوافق (gmt-match · gmt-suggest) — أو بما تكتبه أنت
   ③ العقل يقارن صورتك بصور أقرب المرشّحين (gmt-match.vision) ويرتّب
   ④ تختار المنتج ⇒ اسمه على العلبة يُضاف إلى «أسمائه البديلة» (للأدمن) ⇒ المرّة القادمة يُعرف مباشرةً
   GMTLens.open({ products: () => [...], branchKey, onPick(p, info), learn: async (p, names) => bool })
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTLens) return;
  var doc = global.document;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function visionURL() {
    try { var u = global.GMT_DB && GMT_DB.MAIN && GMT_DB.MAIN.url; if (u) return String(u).replace(/\/+$/, '') + '/functions/v1/gmt-vision'; } catch (_) {}
    return 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-vision';
  }
  function needMatch() {
    if (global.GMTMatch) return Promise.resolve(true);
    return new Promise(function (res) {
      var s = doc.createElement('script'); s.src = 'gmt-match.js?v=20261122y'; s.onload = function () { res(!!global.GMTMatch); }; s.onerror = function () { res(false); }; doc.head.appendChild(s);
    });
  }
  function shrink(file) {
    return new Promise(function (res) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var m = 1280, s = Math.min(1, m / Math.max(im.naturalWidth, im.naturalHeight)), c = doc.createElement('canvas');
          c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.85));
        };
        im.onerror = function () { res(String(fr.result || '')); };
        im.src = fr.result;
      };
      fr.onerror = function () { res(''); };
      fr.readAsDataURL(file);
    });
  }
  var RSYS = 'أنت تقرأ صورة منتجٍ من محلّ تصوير (كاميرا · عدسة · درون · بطارية · شاحن · إضاءة · مايك · ستاند · حقيبة · كفر · فلتر · إكسسوار) أو صورة علبته. ' +
    'اقرأ **كلّ ما هو مكتوب** على المنتج أو العلبة حرفياً (الماركة · اسم المنتج · رقم الموديل · السعة · المقاس · التوافق) وصف نوع المنتج. لا تخترع ما لا يظهر.';
  var RQ = 'أعد JSON فقط: {"brand":"","product_type":"نوع المنتج بالعربية","name_on_box":"الاسم كما هو مكتوب","model":"رقم/اسم الموديل",' +
    '"compat":"لأيّ جهاز إن كان مكتوباً","texts":["كلّ سطرٍ مقروء مهمّ"],"arabic_name":"اسمٌ عربيّ قصير للمنتج","query":"أفضل عبارة بحث قصيرة"}';
  async function readImage(dataUrl) {
    var b64 = String(dataUrl).split(',')[1] || '';
    var r = await fetch(visionURL(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: RQ, system: RSYS, image: b64, image_type: 'image/jpeg' }) });
    var j = {}; try { j = await r.json(); } catch (_) {}
    if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
    var t = String(j.answer || ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    var o = null; try { o = a >= 0 ? JSON.parse(t.slice(a, b + 1)) : null; } catch (_) { o = null; }
    if (!o) throw new Error('لم يُفهم ما قرأه العقل');
    if (!Array.isArray(o.texts)) o.texts = [];
    return o;
  }
  /* الترتيب: مطابقة العقل العميقة (gmt-match) + إصابات gmt-suggest بأيّ اسم */
  function rankBy(read, typed, list) {
    var M = global.GMTMatch, SG = global.GMTSuggest;
    var words = [read && read.name_on_box, read && read.model, read && read.query, read && read.compat, read && read.arabic_name, typed].concat(read ? read.texts.slice(0, 12) : []).filter(Boolean);
    var src = { name: (read && (read.name_on_box || read.query)) || typed || '', alt_names: words.join(' '), brand: (read && read.brand) || '', model: (read && read.model) || '' };
    var R = M && M.rank ? M.rank(src, list) : list.map(function (x) { return { item: x, score: 0 }; });
    var q = String((read && (read.model || read.query)) || typed || '').trim().toLowerCase();
    R.forEach(function (r) {
      var p = r.item;
      if (q && SG && SG.hitsProduct) { try { if (SG.hitsProduct(q, p)) r.score += 0.25; } catch (_) {} }
      if (q && p.barcode && String(p.barcode) === q) r.score += 1;
    });
    return R.sort(function (a, b) { return b.score - a.score; }).filter(function (r) { return r.score > 0.05; }).slice(0, 8);
  }
  function css() {
    if (doc.getElementById('gmt-lens-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-lens-css';
    s.textContent = '#gmt-lens{position:fixed;inset:0;z-index:2147482900;background:rgba(15,18,25,.6);display:flex;align-items:flex-end;justify-content:center;font-family:Cairo,Tahoma,sans-serif;direction:rtl}' +
      '@media(min-width:700px){#gmt-lens{align-items:center}}' +
      '#gmt-lens .bx{background:#fff;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:14px}@media(min-width:700px){#gmt-lens .bx{border-radius:18px}}' +
      '#gmt-lens h3{margin:0 0 4px;font-size:16px}#gmt-lens .sub{font-size:12px;color:#64748b;margin-bottom:10px;line-height:1.7}' +
      '#gmt-lens .row{display:flex;gap:8px;margin-bottom:8px}#gmt-lens button{font-family:inherit;font-weight:800;border-radius:10px;border:1.5px solid #d1d5db;background:#fff;padding:9px 12px;cursor:pointer;font-size:13px}' +
      '#gmt-lens button.p{background:#D5001C;border-color:#D5001C;color:#fff}#gmt-lens input[type=text]{flex:1;font-family:inherit;font-size:13px;border:1.5px solid #d1d5db;border-radius:10px;padding:9px}' +
      '#gmt-lens .st{font-size:12.5px;font-weight:800;color:#0f766e;margin:6px 0}#gmt-lens .rd{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-size:12px;line-height:1.7;margin-bottom:8px}' +
      '#gmt-lens .shot{max-width:100%;max-height:180px;border-radius:10px;display:block;margin:0 auto 8px}' +
      '#gmt-lens .it{display:flex;gap:10px;align-items:center;border:1.5px solid #e5e7eb;border-radius:12px;padding:8px;margin-bottom:6px}#gmt-lens .it.best{border-color:#16a34a;background:#f0fdf4}' +
      '#gmt-lens .it img{width:54px;height:54px;object-fit:contain;border-radius:8px;background:#f8fafc;flex-shrink:0}#gmt-lens .it .nm{font-size:13px;font-weight:800;line-height:1.4}' +
      '#gmt-lens .it .mt{font-size:11px;color:#64748b}#gmt-lens .it .go{margin-inline-start:auto;flex-shrink:0;background:#16a34a;border-color:#16a34a;color:#fff}' +
      '#gmt-lens .why{font-size:11.5px;color:#166534;font-weight:700;margin-top:2px}#gmt-lens label.lrn{display:flex;gap:6px;align-items:flex-start;font-size:12px;font-weight:700;margin:8px 0;color:#334155}';
    doc.head.appendChild(s);
  }
  function close() { var o = doc.getElementById('gmt-lens'); if (o) o.remove(); }

  async function open(ctx) {
    ctx = ctx || {}; css(); close();
    var list = (typeof ctx.products === 'function' ? ctx.products() : ctx.products) || [];
    var root = doc.createElement('div'); root.id = 'gmt-lens'; root.setAttribute('role', 'dialog'); root.setAttribute('data-keep-fab', '1');
    root.innerHTML = '<div class="bx"><div style="display:flex;align-items:center;gap:8px"><h3 style="flex:1">🔍 عدسة GMT — ما اسم هذا المنتج عندنا؟</h3><button type="button" data-x aria-label="إغلاق">✕</button></div>' +
      '<div class="sub">صوّر المنتج أو علبته — العقل يقرأ ما عليها ويبحث في <b>جردنا نحن</b> (الأسماء · الأسماء البديلة · الموديل · الصور) ويعطيك أقرب المطابقات.</div>' +
      '<div class="row"><button type="button" class="p" data-shot style="flex:1">📸 صوّر المنتج / العلبة</button><input type="file" accept="image/*" capture="environment" data-file hidden></div>' +
      '<div class="row"><input type="text" data-q placeholder="أو اكتب ما على العلبة (اسم · موديل · رقم)…"><button type="button" data-find>بحث</button></div>' +
      '<div data-img></div><div class="st" data-st></div><div data-read></div><div data-res></div></div>';
    doc.body.appendChild(root);
    var $ = function (s) { return root.querySelector(s); };
    var S = { read: null, shot: '', typed: '' };
    $('[data-x]').onclick = close;
    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    $('[data-shot]').onclick = function () { $('[data-file]').click(); };
    function st(t) { $('[data-st]').textContent = t || ''; }
    function paintRead() {
      var r = S.read; if (!r) { $('[data-read]').innerHTML = ''; return; }
      $('[data-read]').innerHTML = '<div class="rd">🤖 <b>قرأ العقل:</b> ' + esc([r.brand, r.name_on_box, r.model].filter(Boolean).join(' · ') || '—') +
        (r.product_type ? '<br>النوع: ' + esc(r.product_type) : '') + (r.compat ? '<br>التوافق: ' + esc(r.compat) : '') +
        (r.texts && r.texts.length ? '<br><span style="color:#64748b">' + esc(r.texts.slice(0, 6).join(' · ')) + '</span>' : '') + '</div>';
    }
    function paintRes(R, pick) {
      if (!R.length) { $('[data-res]').innerHTML = '<div class="rd" style="color:#b45309">لا منتج قريب في الجرد — جرّب صورةً أوضح للكتابة أو اكتب الموديل. إن لم يكن معرَّفاً فهو منتجٌ جديد يُعرَّف (دستور المنتجات §٥).</div>'; return; }
      var bk = ctx.branchKey;
      $('[data-res]').innerHTML = '<div style="font-size:12px;font-weight:900;color:#334155;margin:6px 0">أقرب المطابقات في الجرد:</div>' + R.map(function (r, i) {
        var p = r.item, best = pick && pick.item === p, img = p.image_url || (Array.isArray(p.images) && p.images[0]) || '';
        return '<div class="it' + (best ? ' best' : '') + '">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<span style="width:54px;text-align:center">📦</span>') +
          '<div style="min-width:0"><div class="nm">' + (best ? '🎯 ' : '') + esc(p.name || '') + '</div><div class="mt">' + esc(p.barcode || 'بلا باركود') + (bk && p[bk] != null ? ' · المسجّل: ' + esc(p[bk]) : '') + ' · ' + Math.round(Math.min(1, r.score) * 100) + '%</div>' +
          (best && pick.why ? '<div class="why">👁️ ' + esc(pick.why) + ' (' + pick.confidence + '%)</div>' : '') + '</div>' +
          '<button type="button" class="go" data-pick="' + i + '">هذا هو</button></div>';
      }).join('') + (ctx.learn && S.read ? '<label class="lrn"><input type="checkbox" data-learn checked> أضف ما على العلبة (' + esc([S.read.name_on_box, S.read.model].filter(Boolean).join(' · ').slice(0, 80)) + ') إلى أسمائه البديلة — ليُعرف مباشرةً المرّة القادمة</label>' : '');
      root.querySelectorAll('[data-pick]').forEach(function (b) {
        b.onclick = async function () {
          var p = R[+b.getAttribute('data-pick')].item, learned = false;
          var lr = $('[data-learn]');
          if (ctx.learn && S.read && lr && lr.checked) {
            var names = [S.read.name_on_box, S.read.model, S.read.arabic_name].filter(function (x) { return x && String(x).trim().length > 1; });
            try { learned = await ctx.learn(p, names); } catch (_) { learned = false; }
          }
          close();
          try { if (global.GMTSound && GMTSound.cue) GMTSound.cue('scan'); } catch (_) {}
          if (ctx.onPick) ctx.onPick(p, { read: S.read, learned: learned });
        };
      });
    }
    async function run() {
      var ok = await needMatch();
      st('🔎 البحث في الجرد…');
      var R = rankBy(S.read, S.typed, list);
      paintRes(R, null);
      if (S.shot && ok && global.GMTMatch && GMTMatch.vision && R.length > 1) {
        st('👁️ العقل يقارن صورتك بصور أقرب المرشّحين…');
        try {
          var src = { name: S.read && (S.read.name_on_box || S.read.query) || '', image_url: S.shot, brand: S.read && S.read.brand };
          var v = await GMTMatch.vision(src, R.slice(0, 6));
          if (v && v.item) { R.sort(function (a, b) { return (b.item === v.item) - (a.item === v.item); }); paintRes(R, { item: v.item, why: v.why, confidence: v.confidence }); st('✅ اختار العقل الأقرب — تأكّد واضغط «هذا هو»'); return; }
          st('العقل لم يجزم بمنتجٍ واحد — اختر من القائمة');
          return;
        } catch (e) { st('المقارنة بالصور تعذّرت (' + (e.message || e) + ') — الترتيب بالقراءة'); return; }
      }
      st(R.length ? 'اختر المنتج — الأعلى هو الأقرب' : '');
    }
    $('[data-file]').onchange = async function () {
      var f = this.files && this.files[0]; if (!f) return;
      S.shot = await shrink(f); $('[data-img]').innerHTML = S.shot ? '<img class="shot" src="' + S.shot + '" alt="">' : '';
      st('🤖 العقل يقرأ ما على المنتج/العلبة…'); $('[data-res]').innerHTML = '';
      try { S.read = await readImage(S.shot); paintRead(); if (S.read.model || S.read.name_on_box) $('[data-q]').value = [S.read.name_on_box, S.read.model].filter(Boolean).join(' '); }
      catch (e) { S.read = null; paintRead(); st('تعذّرت القراءة (' + (e.message || e) + ') — اكتب ما على العلبة'); return; }
      run();
    };
    $('[data-find]').onclick = function () { S.typed = $('[data-q]').value.trim(); if (!S.typed && !S.read) return; run(); };
    $('[data-q]').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-find]').click(); } };
    return root;
  }
  /* يضيف الأسماء إلى alt_names بلا تكرار (أيّ صفحة تمرّر patch(id, fields)) */
  function mergeAlt(cur, names) {
    var have = String(cur || '').split(/[،,]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    var low = have.map(function (x) { return x.toLowerCase(); }), add = [];
    (names || []).forEach(function (n) { n = String(n || '').trim(); if (n && low.indexOf(n.toLowerCase()) < 0) { add.push(n); low.push(n.toLowerCase()); } });
    return { value: have.concat(add).join('، '), added: add };
  }
  global.GMTLens = { open: open, close: close, readImage: readImage, rankBy: rankBy, mergeAlt: mergeAlt };
})(window);
