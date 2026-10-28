/* ═══════════════════════════════════════════════════════════════════════════
   gmt-screen.js — «تحليل الشاشة»: صورةُ منتج و/أو رسالةُ زبون ⇒ ما عندنا + رسالةُ ردّ جاهزة + تسجيلُ ما لا نملكه
   أُنشئ: 2026-10-11 · Notes ٨ ت١ ١٠:٢٠م:
     «خلي عقل النظام يقرأ الشاشة مثل عدسة جوجل، تحلّل طلب الزبون، ثمّ تكتب لك: شوفي عنا منتجات مع صورهم مع ردود مع روابط مع
      مواصفات… في عندي زر اسمه تحليل الشاشة بيحلّل عن صورة منتج أو عن طلب زبون برسالة نصّية، أو الاثنتين معاً.
      وأيضاً لما يكون شيء مو متوفّر عندنا ولا شبيهه، تلقائياً يُضاف الطلب لمكانٍ معيّن (أداة تنشئها) — ونحن نشوف شو الشيء اللي عم
      ينطلب كتير ونتسوّقه.»

   كيف يعمل (والحدود بصراحة):
     ١) **محلّياً دائماً وبلا ذكاء ولا رصيد**: الرسالة تُفكَّك لكلمات (يُهمَل «بدي/سعر/هل عندكم…»)، وتُطابَق بأسماء المنتجات والباركود
        والمجموعة في قاعدتك. وصورةٌ فيها باركود/QR تُقرأ بـZXing (الموجود أصلاً) فيُعرف المنتج بيقين.
     ٢) **بالذكاء (إن فُعّل الوسيط)**: تُرسَل الرسالة + الصورة + قائمة ما وجدناه محلّياً (فقط) إلى الوسيط بوضع `screen`، فيقرأ الصورة
        (منتجٌ أو لقطة محادثة)، ويحدّد الأصناف المطلوبة، ويربطها بباركودات من القائمة **فقط**، ويكتب ردّاً جاهزاً بالعامية.
        ⚠️ الصورة لا تُقرأ بلا الوسيط (وبلا نسخته المحدَّثة): نقول ذلك ولا نتظاهر.
     ٣) كل صنفٍ لا نملكه ولا شبيهه (أو نفد) **يُسجَّل تلقائياً** في «طلبات_غير_متوفرة.html» (عبر gmt_audit — بلا جدول جديد) فتُرى الأكثر
        طلباً. والذي نملكه لا يُسجَّل. لا شيء يُسجَّل بلا أثرٍ ظاهر: يُعلَن في النتيجة ويمكن إلغاؤه.
     ٤) لا يكتب في المخزون ولا الأوردرات. الردّ يُنسخ أو يُرسَل بواتساب بيدك.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTScreen) return;

  var Z = 2147483500;
  var CAT_TTL = 10 * 60 * 1000;
  var cat = { at: 0, rows: [], cols: [], store: null };

  /* ── تطبيع وتفكيك ── */
  var STOP = ('بدي بدنا بدك اريد أريد اريدك عندكم عندك عنا عندنا هل شو شوو كم كام سعر سعره سعرها اسعار أسعار متوفر متوفرة موجود موجودة موجودين ' +
    'ممكن لو سمحت سمحتي مرحبا مرحباً اهلا أهلاً السلام عليكم ورحمة الله وبركاته يعطيك العافية العافية شكرا شكراً يسلمو تسلم ' +
    'في من على عن الى إلى او أو ثم مع هاد هاي هيدا هذا هذه ذلك كذا كيف ليش وين متى حبيبي اخي أخي استاذ أستاذ يا والله ان إن لك لي لنا بس ' +
    'عن شي شيء اي أي نوع انواع أنواع بالضبط طلب طلبت اطلب احتاج أحتاج محتاج ضروري كتير كثير جدا جداً').split(/\s+/);
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[norm(w)] = 1; });
  function latinDigits(s) { return String(s).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); }); }
  function norm(s) {
    return latinDigits(String(s == null ? '' : s)).toLowerCase()
      .replace(/[ً-ٟـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^a-z0-9ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* تقارب كلمتين (مفرد/جمع/لواحق): بادئةٌ مشتركة ≥ ٤ أحرف، أو إحداهما تبدأ بالأخرى (≥ ٣) */
  function near(a, b) {
    if (!a || !b) return false;
    if (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) return true;
    return Math.min(a.length, b.length) >= 3 && (a.indexOf(b) === 0 || b.indexOf(a) === 0);
  }
  function tokens(s) { return norm(s).split(' ').filter(function (t) { return t && !STOPSET[t] && (t.length >= 2 || /\d/.test(t)); }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }

  /* ── الكتالوج ── */
  function db() { return (global.GMT_DB && global.GMT_DB.MAIN) || null; }
  async function getAll(path, page) {
    var d = db(), out = [], off = 0;
    for (;;) {
      var r = await fetch(d.url + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'limit=' + page + '&offset=' + off,
        { headers: { apikey: d.key, Authorization: 'Bearer ' + d.key }, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = await r.json(); out = out.concat(rows); if (rows.length < page) break; off += page;
    }
    return out;
  }
  async function loadCatalog(force) {
    if (!force && cat.rows.length && Date.now() - cat.at < CAT_TTL) return cat;
    if (!db()) throw new Error('إعدادات القاعدة غير محمّلة');
    cat.cols = (await getAll('/rest/v1/inv_columns?select=key_name,display_name,include_in_total,is_branch,sort_order&order=sort_order.asc', 500).catch(function () { return []; })) || [];
    cat.rows = await getAll('/rest/v1/products?select=*&order=name.asc', 1000);
    cat.at = Date.now();
    return cat;
  }
  function stockOf(p) { return cat.cols.filter(function (c) { return c.include_in_total; }).reduce(function (s, c) { return s + (Number(p[c.key_name]) || 0); }, 0); }
  function perBranch(p) { return cat.cols.filter(function (c) { return c.is_branch && c.include_in_total; }).map(function (c) { var v = Number(p[c.key_name]) || 0; return v > 0 ? (c.display_name || c.key_name) + ' ' + v : ''; }).filter(Boolean).join(' · '); }

  /* مطابقة: نقاطٌ بالكلمات + باركود صريح. strong = كلمةٌ مميِّزة (رقم/لاتيني/طويلة) طابقت */
  function match(text, codes) {
    var qt = tokens(text), codeSet = {};
    (codes || []).forEach(function (c) { var d = latinDigits(c).replace(/\D/g, ''); if (d.length >= 6) codeSet[d] = 1; });
    var qnum = latinDigits(text).match(/\d{8,14}/g) || []; qnum.forEach(function (c) { codeSet[c] = 1; });
    var out = [];
    cat.rows.forEach(function (p) {
      var bc = latinDigits(String(p.barcode || '')).replace(/\D/g, '');
      var score = 0, strong = 0, how = '';
      if (bc && codeSet[bc]) { score += 100; strong += 2; how = 'barcode'; }
      var nt = tokens(p.name + ' ' + (p.short_name || '') + ' ' + (p.alt_names || p.aliases || '')), ns = {}; nt.forEach(function (t) { ns[t] = 1; });
      qt.forEach(function (t) {
        var distinct = /\d/.test(t) || /^[a-z]+$/.test(t) || t.length >= 5;
        if (ns[t]) { score += distinct ? 4 : 3; strong += distinct ? 1 : 0.5; }
        else if (t.length >= 3 && nt.some(function (x) { return near(x, t); })) {
          /* مفرد/جمع (بطارية ≈ بطاريات): كلمةٌ مميِّزة طويلة تُحتسب شبه كاملة، والقصيرة ضعيفة */
          if (t.length >= 5) { score += 3; strong += 0.75; } else { score += 1.5; strong += 0.25; }
        }
      });
      if (score >= 3 && (strong >= 0.75 || qt.length === 1)) out.push({ p: p, score: score, how: how });
    });
    out.sort(function (a, b) { return b.score - a.score || stockOf(b.p) - stockOf(a.p); });
    return out;
  }
  /* «شبيه»: نفس المجموعة/التصنيف لكلمةٍ في الطلب (بطارية ⇒ مجموعة بطاريات) — نعرض الموجود منها */
  function similar(text, exclude) {
    var qt = tokens(text), groups = {};
    cat.rows.forEach(function (p) { var g = String(p.group_name || ''); if (!g) return; var gt = tokens(g); if (qt.some(function (t) { return t.length >= 3 && gt.some(function (x) { return near(x, t); }); })) groups[g] = 1; });
    var ex = {}; (exclude || []).forEach(function (m) { ex[m.p.id] = 1; });
    var out = cat.rows.filter(function (p) { return groups[String(p.group_name || '')] && !ex[p.id] && stockOf(p) > 0; });
    out.sort(function (a, b) { return stockOf(b) - stockOf(a); });
    return out.slice(0, 4).map(function (p) { return { p: p, score: 0, how: 'group' }; });
  }

  /* ── صور ── */
  function shrink(file, max) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('تعذّرت قراءة الصورة')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { rej(new Error('ملفٌّ ليس صورة')); };
        im.onload = function () {
          var r = Math.min(1, (max || 1280) / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * r), h = Math.round(im.naturalHeight * r);
          var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
          var url = c.toDataURL('image/jpeg', 0.82);
          res({ b64: url.split(',')[1], type: 'image/jpeg', url: url });
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  async function readCodes(file) {
    try {
      if (!global.GMTReceipt) await new Promise(function (ok) { var s = document.createElement('script'); s.src = 'gmt-receipt.js?v=20261029l'; s.onload = ok; s.onerror = ok; document.head.appendChild(s); });
      if (!global.GMTReceipt) return [];
      var r = await GMTReceipt.readTracking(file, { maxSide: 1400 });
      return (r && r.all) || [];
    } catch (_) { return []; }
  }

  /* ── الوسيط ── */
  function endpoint() {
    try { if (global.GMTEndpoint && GMTEndpoint.get) { var u = GMTEndpoint.get('brain'); if (u) return u; } } catch (_) {}
    try { var v = localStorage.getItem('gmt_brain_endpoint') || ''; return /^https:\/\/ysawzwtmodkqqbqoiojj\.(?:supabase\.co\/functions\/v1|functions\.supabase\.co)\/gmt-brain\/?$/i.test(v) ? v : ''; } catch (_) { return ''; }   // (17 ت1) دالّة مشروعنا فقط
  }
  async function askAI(text, img, cands) {
    var url = endpoint(); if (!url) return { off: true };
    var list = cands.slice(0, 12).map(function (m) { var p = m.p; return { barcode: p.barcode || '', name: p.name, price: p.price, stock: stockOf(p), link: p.store_url || p.store_link || '', group: p.group_name || '' }; });
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'screen', text: String(text || '').slice(0, 3000), image: img ? img.b64 : '', image_type: img ? img.type : '', candidates: list }) });
    if (!r.ok) { var tx = await r.text().catch(function () { return ''; }); throw new Error(global.GMTEndpoint && GMTEndpoint.explain ? GMTEndpoint.explain(r.status, tx, url) : ('الوسيط ردّ ' + r.status + ' — ' + tx.slice(0, 140))); }
    var d = await r.json();
    if (d.error) throw new Error(d.error);
    return { analysis: d.analysis || null, imageUsed: d.image_used === true, provider: d.provider || '' };
  }

  /* ── تسجيل ما لا نملكه ── */
  function demandKey(term) { return tokens(term).join(' '); }
  function logUnmet(items, ctx) {
    var done = [];
    function go() {
      items.forEach(function (it) {
        var k = demandKey(it.term); if (!k) return;
        try {
          global.GMTOpLog.log({ action: 'unmet_demand', entity: 'demand', entityName: trunc(it.term, 100), entityId: k, field: it.kind,
            newValue: { msg: trunc(ctx.text, 240), image: !!ctx.image, src: 'screen', k: k }, meta: { kind: it.kind } });
          done.push(it);
        } catch (_) {}
      });
      try { global.GMTOpLog.flush(); } catch (_) {}
    }
    if (global.GMTOpLog) go();
    else {
      var s = document.createElement('script'); s.src = 'gmt-oplog.js?v=20261024g'; s.onload = function () { setTimeout(go, 50); }; (document.head || document.documentElement).appendChild(s);
    }
    return items.length;
  }

  /* ── الواجهة ── */
  var CSS = '.sc-ov{position:fixed;inset:0;z-index:' + Z + ';background:rgba(15,23,42,.55);backdrop-filter:blur(2px);display:flex;align-items:flex-end;justify-content:center;font-family:Cairo,Tajawal,"Segoe UI",Tahoma,system-ui,sans-serif;direction:rtl}' +
    '.sc-bx{background:#fff;color:#0f172a;width:min(640px,100%);height:92vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;box-shadow:0 -12px 50px rgba(0,0,0,.35)}' +
    '.sc-hd{padding:14px 18px;border-bottom:1px solid #eef1f5;display:flex;align-items:center;gap:10px}.sc-hd b{font-size:16px;flex:1}' +
    '.sc-bd{flex:1;overflow:auto;padding:14px 18px 18px}' +
    '.sc-ta{width:100%;min-height:96px;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;background:#f8fafc;outline:none;resize:vertical;box-sizing:border-box}.sc-ta:focus{border-color:#D5001C;background:#fff}' +
    '.sc-lb{font-size:12px;font-weight:800;color:#64748b;margin:12px 0 4px}' +
    '.sc-b{border:1.5px solid #e2e8f0;background:#fff;border-radius:11px;padding:9px 14px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;color:#334155}.sc-b.p{background:#D5001C;border-color:#D5001C;color:#fff}.sc-b:disabled{opacity:.5;cursor:not-allowed}' +
    '.sc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '.sc-pv{display:flex;gap:10px;align-items:center;margin-top:8px}.sc-pv img{width:84px;height:84px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0}' +
    '.sc-card{display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:14px;padding:9px 11px;margin:7px 0}.sc-card img,.sc-card .ph{width:62px;height:62px;border-radius:10px;object-fit:cover;background:#f1f3f6;flex:0 0 auto;display:grid;place-items:center;font-size:10.5px;color:#94a3b8}' +
    '.sc-card .n{font-weight:900;font-size:13.5px;line-height:1.5}.sc-card .m{font-size:12px;color:#64748b;margin-top:2px;line-height:1.7}' +
    '.sc-chip{display:inline-block;border-radius:99px;padding:0 9px;font-size:11.5px;font-weight:900}.sc-ok{background:#dcfce7;color:#166534}.sc-lo{background:#fef3c7;color:#92400e}.sc-no{background:#fee2e2;color:#991b1b}.sc-sm{background:#e0e7ff;color:#3730a3}' +
    '.sc-sec{margin:14px 0 4px;font-weight:900;font-size:13.5px}' +
    '.sc-w{padding:10px 12px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;font-weight:700;font-size:12.5px;line-height:1.8;margin:8px 0}' +
    '.sc-u{padding:10px 12px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d;font-weight:700;font-size:12.5px;line-height:1.8;margin:8px 0}';   /* (TASK-0143) أُزيلت قاعدة الوضع الداكن — النظام فاتحٌ دائماً */
  function css() { if (document.getElementById('gmt-screen-css')) return; var st = document.createElement('style'); st.id = 'gmt-screen-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }

  function replyTemplate(found, similarList) {
    var f = found.filter(function (m) { return stockOf(m.p) > 0; }).slice(0, 4);
    if (f.length) {
      return 'أهلاً وسهلاً فيك، شكراً لتواصلك مع مجموعة ميديا تيك التجارية.\nالمتوفر عندنا:\n' +
        f.map(function (m) { var p = m.p; return '• ' + p.name + (p.price ? ' — ' + p.price + '$' : '') + (stockOf(p) <= 3 ? ' (كمية محدودة)' : ' (متوفر)') + ((p.store_url || p.store_link) ? '\n  ' + (p.store_url || p.store_link) : ''); }).join('\n') +
        '\nبتحب نأكّد لك الطلب أو نوضّح أكتر؟';
    }
    var s = (similarList || []).slice(0, 3);
    if (s.length) return 'أهلاً وسهلاً فيك. للأسف هالصنف مو متوفر حالياً، بس عندنا بدائل قريبة:\n' + s.map(function (m) { return '• ' + m.p.name + (m.p.price ? ' — ' + m.p.price + '$' : ''); }).join('\n') + '\nبتحب أعرفك عليهم؟';
    return 'أهلاً وسهلاً فيك. حالياً ما عندنا هالصنف، وبنسجّل طلبك لنتواصل معك أول ما يتوفر. إذا عندك صورة أو تفاصيل أكتر بتساعدنا.';
  }

  function open(opts) {
    opts = opts || {};
    css();
    var old = document.getElementById('gmt-screen-ov'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'gmt-screen-ov'; ov.className = 'sc-ov'; ov.setAttribute('data-keep-fab', '1');
    ov.innerHTML = '<div class="sc-bx"><div class="sc-hd"><b>تحليل الشاشة</b><button class="sc-b" data-x>إغلاق</button></div>' +
      '<div class="sc-bd"><div style="font-size:12.5px;color:#64748b;line-height:1.8">الصق رسالة الزبون، أو ارفع صورة (منتج أو لقطة محادثة)، أو الاثنين معاً — فأخبرك ما عندنا وبأي سعر، وأكتب لك الردّ، وما لا نملكه يُسجَّل تلقائياً.</div>' +
      '<div class="sc-lb">رسالة الزبون</div><textarea class="sc-ta" data-t placeholder="مثال: مرحبا بدي بطارية لكانون R6 وكم سعرها؟"></textarea>' +
      '<div class="sc-lb">صورة (اختياري)</div><div class="sc-row"><button class="sc-b" data-f>اختيار صورة</button><button class="sc-b" data-c>التقاط بالكاميرا</button><span style="font-size:12px;color:#94a3b8">أو الصق صورةً (Ctrl+V)</span></div>' +
      '<input type="file" accept="image/*" data-fi hidden><input type="file" accept="image/*" capture="environment" data-ci hidden>' +
      '<div data-pv></div><div class="sc-row" style="margin-top:14px"><button class="sc-b p" data-go>حلّل</button><span data-st style="font-size:12.5px;color:#64748b;font-weight:700"></span></div>' +
      '<div data-out></div></div></div>';
    document.body.appendChild(ov);
    var $ = function (s) { return ov.querySelector(s); };
    var img = null, imgFile = null, busy = false;
    $('[data-t]').value = opts.text || '';
    function setImg(file) {
      if (!file) return;
      shrink(file, 1280).then(function (r) { img = r; imgFile = file; $('[data-pv]').innerHTML = '<div class="sc-pv"><img src="' + r.url + '" alt=""><button class="sc-b" data-rm>إزالة الصورة</button></div>'; }, function (e) { $('[data-st]').textContent = e.message; });
    }
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-x]')) ov.remove();
      else if (e.target.closest('[data-f]')) $('[data-fi]').click();
      else if (e.target.closest('[data-c]')) $('[data-ci]').click();
      else if (e.target.closest('[data-rm]')) { img = null; imgFile = null; $('[data-pv]').innerHTML = ''; }
      else if (e.target.closest('[data-go]')) run();
      else if (e.target.closest('[data-cp]')) { var t = ov.querySelector('[data-reply]'); try { navigator.clipboard.writeText(t.value); $('[data-st]').textContent = 'نُسخ الرد'; } catch (_) {} }
      else if (e.target.closest('[data-wa]')) { var t2 = ov.querySelector('[data-reply]'); try { global.open('https://wa.me/?text=' + encodeURIComponent(t2.value), '_blank'); } catch (_) {} }
    });
    $('[data-fi]').addEventListener('change', function () { setImg(this.files[0]); });
    $('[data-ci]').addEventListener('change', function () { setImg(this.files[0]); });
    ov.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) if (items[i].type.indexOf('image') === 0) { setImg(items[i].getAsFile()); e.preventDefault(); return; }
    });

    async function run() {
      if (busy) return;
      var text = $('[data-t]').value.trim();
      if (!text && !img) { $('[data-st]').textContent = 'الصق رسالة أو ارفع صورة أولاً'; return; }
      busy = true; $('[data-go]').disabled = true; $('[data-out]').innerHTML = ''; $('[data-st]').textContent = 'جارٍ تجهيز الكتالوج…';
      try {
        await loadCatalog();
        var codes = []; if (imgFile) { $('[data-st]').textContent = 'أقرأ الباركود من الصورة…'; codes = await readCodes(imgFile); }
        var local = match(text, codes), sim = [];
        if (!local.length) sim = similar(text, local);
        var ai = null, aiErr = '';
        if (endpoint()) {
          $('[data-st]').textContent = 'العقل يحلّل…';
          try { ai = await askAI(text, img, local.concat(sim)); } catch (e) { aiErr = e.message || String(e); }
        }
        $('[data-st]').textContent = '';
        render(text, codes, local, sim, ai, aiErr);
      } catch (e) { $('[data-out]').innerHTML = '<div class="sc-u">تعذّر التحليل: ' + esc((e && e.message) || e) + '</div>'; $('[data-st]').textContent = ''; }
      busy = false; $('[data-go]').disabled = false;
    }

    function card(m, tag) {
      var p = m.p, st = stockOf(p), pb = perBranch(p), link = p.store_url || p.store_link || '';
      return '<div class="sc-card">' + (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="" onerror="this.outerHTML=\'<div class=ph>بلا صورة</div>\'">' : '<div class="ph">بلا صورة</div>') +
        '<div style="flex:1;min-width:0"><div class="n">' + esc(p.name) + '</div><div class="m">' +
        '<span class="sc-chip ' + (st <= 0 ? 'sc-no' : st <= 3 ? 'sc-lo' : 'sc-ok') + '">' + (st <= 0 ? 'نافد' : st <= 3 ? 'كمية محدودة ' + st : 'متوفر ' + st) + '</span> ' +
        (tag ? '<span class="sc-chip sc-sm">' + tag + '</span> ' : '') + (p.price ? '<b>$' + esc(p.price) + '</b>' : '') +
        (pb ? '<br>' + esc(pb) : '') + (p.group_name ? '<br>' + esc(p.group_name) : '') + (link ? '<br><span dir="ltr" style="word-break:break-all">' + esc(link) + '</span>' : '') + '</div></div></div>';
    }

    function render(text, codes, local, sim, ai, aiErr) {
      var out = $('[data-out]'), html = '';
      var an = ai && ai.analysis;
      if (imgFile && !(ai && ai.imageUsed) && !codes.length) {
        html += '<div class="sc-w">' + (endpoint() ? (aiErr ? 'تعذّر الاتصال بالوسيط: ' + esc(aiErr) + '. ' : 'الوسيط لم يقرأ الصورة — يلزم نشر النسخة المحدَّثة من الوسيط (وضع screen). ') : 'قراءة الصور تحتاج وسيط العقل (غير مفعَّل).') +
          'بلا ذلك لا أستطيع فهم محتوى الصورة؛ يمكنك كتابة اسم المنتج في خانة الرسالة وسأبحث عنه.</div>';
      } else if (!imgFile && endpoint() && aiErr) {
        html += '<div class="sc-w">تعذّر الذكاء (' + esc(aiErr) + ') — النتيجة أدناه من بحثٍ محلّي فقط.</div>';
      }
      if (codes.length) html += '<div class="sc-w" style="background:#ecfdf5;border-color:#a7f3d0;color:#065f46">قرأتُ من الصورة رمزاً: <span dir="ltr">' + esc(codes.slice(0, 3).join(' · ')) + '</span></div>';
      if (an && an.summary) html += '<div class="sc-sec">فهمتُ من الطلب</div><div style="font-size:13.5px;line-height:1.8">' + esc(an.summary) + '</div>';

      /* الأصناف: من الذكاء إن وُجد، وإلا من التفكيك المحلّي */
      var unmet = [];
      var byBc = {}; local.concat(sim).forEach(function (m) { byBc[String(m.p.barcode || '')] = m; });
      var shown = {};
      var wanted = (an && Array.isArray(an.wanted)) ? an.wanted : [];
      if (wanted.length) {
        html += '<div class="sc-sec">الأصناف المطلوبة</div>';
        wanted.forEach(function (w) {
          var m = w.matched_barcode ? byBc[String(w.matched_barcode)] : null;
          var st = m ? stockOf(m.p) : 0;
          var label = esc(w.what || '') + (w.specs ? ' — ' + esc(w.specs) : '');
          if (m) {
            shown[m.p.id] = 1;
            html += '<div style="margin-top:6px;font-size:13px;font-weight:800">' + label + '</div>' + card(m, m.how === 'barcode' ? 'مطابق بالباركود' : '');
            if (st <= 0) unmet.push({ term: w.what || (m.p.name), kind: 'out' });
          } else {
            var sm = similar((w.what || '') + ' ' + (w.specs || ''), local);
            html += '<div style="margin-top:6px;font-size:13px;font-weight:800">' + label + ' <span class="sc-chip sc-no">غير موجود</span></div>';
            sm.forEach(function (x) { if (!shown[x.p.id]) { shown[x.p.id] = 1; html += card(x, 'شبيه'); } });
            if (!sm.length) unmet.push({ term: [w.what, w.brand, w.specs].filter(Boolean).join(' '), kind: 'none' });
          }
        });
      }
      var rest = local.concat(sim).filter(function (m) { return !shown[m.p.id]; });
      if (rest.length) {
        html += '<div class="sc-sec">' + (wanted.length ? 'أيضاً عندنا' : (local.length ? 'عندنا' : 'أصنافٌ شبيهة')) + '</div>';
        rest.slice(0, 6).forEach(function (m) { html += card(m, m.how === 'barcode' ? 'مطابق بالباركود' : m.how === 'group' ? 'شبيه' : ''); });
        /* نفد: كلّ المطابقات نافدة، أو أوّلها بوضوحٍ (الموديل المطلوب) نافد وإن وُجد غيره من نفس الفئة */
        if (!wanted.length && local.length) {
          var top = local[0], allOut = !local.some(function (m) { return stockOf(m.p) > 0; });
          var clearTop = local.length === 1 || (top.score - local[1].score >= 3);
          if (stockOf(top.p) <= 0 && (allOut || clearTop)) unmet.push({ term: top.p.name, kind: 'out' });
        }
      }
      if (!wanted.length && !local.length) {
        var term = tokens(text).slice(0, 6).join(' ');
        if (term && !sim.length) unmet.push({ term: term, kind: 'none' });
      }

      /* الرد */
      var reply = (an && an.reply) ? String(an.reply) : replyTemplate(local, sim);
      html += '<div class="sc-sec">الردّ الجاهز' + (an && an.reply ? '' : ' <span style="font-weight:700;color:#94a3b8;font-size:11.5px">(قالبٌ بلا ذكاء — عدّله)</span>') + '</div>' +
        '<textarea class="sc-ta" data-reply style="min-height:130px">' + esc(reply) + '</textarea>' +
        '<div class="sc-row" style="margin-top:8px"><button class="sc-b p" data-cp>نسخ الردّ</button><button class="sc-b" data-wa>فتح واتساب بالردّ</button></div>';

      /* ما لا نملكه ⇒ تسجيلٌ تلقائيّ ظاهر */
      var seen = {}; unmet = unmet.filter(function (u) { var k = demandKey(u.term); if (!k || seen[k]) return false; seen[k] = 1; return true; });
      if (unmet.length) {
        logUnmet(unmet, { text: text, image: !!img });
        html += '<div class="sc-u"><b>سُجِّل في «طلبات غير متوفرة»:</b><br>' + unmet.map(function (u) { return '• ' + esc(u.term) + (u.kind === 'out' ? ' (نفد عندنا)' : ' (لا نملكه ولا شبيهه)'); }).join('<br>') +
          '<br><a href="طلبات_غير_متوفرة.html" style="color:#7f1d1d;font-weight:900">افتح القائمة ←</a></div>';
      }
      out.innerHTML = html;
    }
    return { close: function () { ov.remove(); } };
  }

  global.GMTScreen = { open: open, _match: match, _tokens: tokens, _norm: norm, _loadCatalog: loadCatalog, _similar: similar, _demandKey: demandKey };
})(typeof window !== 'undefined' ? window : this);
