/* ═══════════════════════════════════════════════════════════════════════════
   gmt-lens.js — «عدسة GMT 2.0»: وجّه الكاميرا على المنتج أو علبته ⇒ أقرب منتجاتنا فوراً (TASK-A0576 · A0580 · المالك seq 974 · 979–981 · 998 · 1001)
   «فوراً تعمل الالتقاط وتبحث فوراً … ما يكون فيها ذكاء اصطناعي ولا خادم ولا مفتاح … بوت مدرّب من عندنا … مثل عدسة جوجل
    بس بدل ما ياخذ من جوجل ياخذ من المخزون اللي عندنا» · «لما اصوّر المنتج يقترح لي أكثر من منتج لحتى أختار»
   ─────────────────────────────────────────────────────────────────────────────
   ① الكاميرا حيّة داخل النافذة — الاقتراحات تتبدّل وأنت توجّه (كلّ ~٠٫٨ث) — بلا ضغط
   ② «📸 التقط» يثبّت اللقطة ⇒ أفضل ٥ فوراً من «العين المحلّية» (gmt-lens-local.js) + الباركود إن ظهر
   ③ قراءة الكتابة على العلبة (OCR محلّي) بالخلفية ⇒ يعيد الترتيب حين تنتهي (الموديل المطبوع أقوى دليل)
   ④ «🤖 اسأل العقل» اختياري فقط — حين لا تكفي المطابقة المحلّية (gmt-vision)
   ⑤ «هذا هو» ⇒ اللقطة تُحفظ عيّنةً للمنتج (يتعلّم) + للأدمن: الموديل المقروء يُضاف لأسمائه البديلة
   GMTLens.open({ products: () => [...], branchKey, onPick(p, info), learn: async (p, names) => bool, isAdmin, by })
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
  function loadOnce(name, src) {
    if (global[name]) return Promise.resolve(true);
    return new Promise(function (res) { var s = doc.createElement('script'); s.src = src; s.onload = function () { res(!!global[name]); }; s.onerror = function () { res(false); }; doc.head.appendChild(s); });
  }
  function needMatch() { return loadOnce('GMTMatch', 'gmt-match.js?v=20261122y'); }
  function needLocal() { loadOnce('GMTSuggest', 'gmt-suggest.js?v=20261123e'); return loadOnce('GMTLensLocal', 'gmt-lens-local.js?v=20261124c'); }   /* البحث بخوارزمية النظام نفسها (seq A1009) */
  function fileToCanvas(file) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var m = 1280, s = Math.min(1, m / Math.max(im.naturalWidth, im.naturalHeight)), c = doc.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c);
      };
      im.onerror = function () { URL.revokeObjectURL(u); res(null); };
      im.src = u;
    });
  }
  /* ── العقل (اختياري): يقرأ ما على المنتج ── */
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
  /* الترتيب بالنصّ (المكتوب أو ما قرأه العقل): gmt-match + gmt-suggest */
  function rankBy(read, typed, list) {
    var M = global.GMTMatch, SG = global.GMTSuggest;
    var words = [read && read.name_on_box, read && read.model, read && read.query, read && read.compat, read && read.arabic_name, typed].concat(read ? (read.texts || []).slice(0, 12) : []).filter(Boolean);
    var src = { name: (read && (read.name_on_box || read.query)) || typed || '', alt_names: words.join(' '), brand: (read && read.brand) || '', model: (read && read.model) || '' };
    var R = M && M.rank ? M.rank(src, list) : list.map(function (x) { return { item: x, score: 0 }; });
    var q = String((read && (read.model || read.query)) || typed || '').trim().toLowerCase();
    R.forEach(function (r) {
      var p = r.item;
      if (q && SG && SG.hitsProduct) { try { if (SG.hitsProduct(q, p)) r.score += 0.25; } catch (_) {} }
      if (q && p.barcode && String(p.barcode).toLowerCase() === q) r.score += 1;
    });
    return R.sort(function (a, b) { return b.score - a.score; }).filter(function (r) { return r.score > 0.05; }).slice(0, 8);
  }
  function css() {
    if (doc.getElementById('gmt-lens-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-lens-css';
    s.textContent = '#gmt-lens{position:fixed;inset:0;z-index:2147482900;background:rgba(15,18,25,.6);display:flex;align-items:flex-end;justify-content:center;font-family:Cairo,Tahoma,sans-serif;direction:rtl}' +
      '@media(min-width:700px){#gmt-lens{align-items:center}}' +
      '#gmt-lens .bx{background:#fff;width:100%;max-width:560px;max-height:94vh;overflow:auto;border-radius:18px 18px 0 0;padding:12px}@media(min-width:700px){#gmt-lens .bx{border-radius:18px}}' +
      '#gmt-lens h3{margin:0;font-size:15px}#gmt-lens .sub{font-size:11.5px;color:#64748b;margin:2px 0 8px;line-height:1.6}' +
      '#gmt-lens .row{display:flex;gap:8px;margin-bottom:8px}#gmt-lens button{font-family:inherit;font-weight:800;border-radius:10px;border:1.5px solid #d1d5db;background:#fff;padding:9px 12px;cursor:pointer;font-size:13px}' +
      '#gmt-lens button.p{background:#D5001C;border-color:#D5001C;color:#fff}#gmt-lens input[type=text]{flex:1;min-width:0;font-family:inherit;font-size:13px;border:1.5px solid #d1d5db;border-radius:10px;padding:9px}' +
      '#gmt-lens .cam{position:relative;background:#0b0d12;border-radius:14px;overflow:hidden;aspect-ratio:4/3;max-height:40vh;margin:0 auto 8px;width:100%}' +
      '#gmt-lens .cam video,#gmt-lens .cam canvas,#gmt-lens .cam img{width:100%;height:100%;object-fit:cover;display:block}' +
      '#gmt-lens .cam .guide{position:absolute;inset:10% 14%;border:2.5px solid rgba(255,255,255,.85);border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.18);pointer-events:none}' +
      '#gmt-lens .cam .msg{position:absolute;inset:auto 0 8px 0;text-align:center;color:#fff;font-size:12px;font-weight:800;text-shadow:0 1px 3px #000}' +
      '#gmt-lens .shut{width:100%;font-size:15px;padding:11px}' +
      '#gmt-lens .st{font-size:12px;font-weight:800;color:#0f766e;margin:4px 0;min-height:16px}#gmt-lens .rd{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px 9px;font-size:12px;line-height:1.7;margin-bottom:6px}' +
      '#gmt-lens .it{display:flex;gap:10px;align-items:center;border:1.5px solid #e5e7eb;border-radius:12px;padding:7px;margin-bottom:6px}#gmt-lens .it.best{border-color:#16a34a;background:#f0fdf4}' +
      '#gmt-lens .it img{width:58px;height:58px;object-fit:contain;border-radius:8px;background:#f8fafc;flex-shrink:0}#gmt-lens .it .nm{font-size:13px;font-weight:800;line-height:1.4}' +
      '#gmt-lens .it .mt{font-size:11px;color:#64748b}#gmt-lens .it .go{margin-inline-start:auto;flex-shrink:0;background:#16a34a;border-color:#16a34a;color:#fff}' +
      '#gmt-lens .bd{display:inline-block;font-size:10.5px;font-weight:800;border-radius:999px;padding:0 7px;margin-inline-end:4px;background:#eef2ff;color:#3730a3}#gmt-lens .bd.bc{background:#dcfce7;color:#166534}#gmt-lens .bd.tx{background:#fef3c7;color:#92400e}' +
      '#gmt-lens .why{font-size:11.5px;color:#166534;font-weight:700;margin-top:2px}#gmt-lens label.lrn{display:flex;gap:6px;align-items:flex-start;font-size:12px;font-weight:700;margin:8px 0;color:#334155}' +
      /* (TASK-A0590 · المالك seq A1131/A1137) لا إطارات خارجة على الهاتف: صندوقٌ بحدود الشاشة وكلّ نصٍّ يلتفّ */'#gmt-lens,#gmt-lens *{box-sizing:border-box}#gmt-lens .bx{max-height:94vh;max-height:94dvh;overflow-x:hidden;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}#gmt-lens .it>div{min-width:0}#gmt-lens .it .nm,#gmt-lens .rd,#gmt-lens .why{overflow-wrap:anywhere}#gmt-lens .row>*{min-width:0}' +
      '#gmt-lens .tools{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}#gmt-lens .tools button{font-size:12px;padding:7px 10px}';
    doc.head.appendChild(s);
  }
  var LIVE = null;
  function close() {
    if (LIVE) { try { clearInterval(LIVE.timer); } catch (_) {} try { LIVE.stream && LIVE.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {} LIVE = null; }
    var o = doc.getElementById('gmt-lens'); if (o) o.remove();
  }
  /* الموديل المطبوع على العلبة (حروف + أرقام) — وحده يُتعلَّم اسماً بديلاً، لا كلّ ما قرأه OCR */
  /* ما يُتعلَّم اسماً بديلاً من الكتابة المقروءة (seq A1008–A1009): الكود كما ظهر على العلبة (كلمة أو كلمتان/ثلاث متتالية) —
     ولا شيء إن كانت خوارزمية البحث تجده أصلاً (لا تكرار) · بلا أنصاف كود ولا شرطات معلّقة */
  function modelWords(words, p) {
    var w = words || [], SG = global.GMTSuggest, out = [];
    /* (seq A1015 «900g Co Carey» اقتُرح اسماً بديلاً) الكود: حروف كبيرة وأرقام وشرطات فقط (RL-24 · YM-600-SS · LP-E17) */
    var code = function (s) { var f = s.replace(/[^A-Za-z0-9]/g, ''); return f.length >= 4 && f.length <= 20 && /\d/.test(f) && /[A-Z]/.test(f) && s.split(' ').every(function (tk) { return /^[A-Z0-9][A-Z0-9\-\/.]*$/.test(tk); }); };
    for (var i = 0; i < w.length; i++) for (var n = 3; n >= 1; n--) {
      if (i + n > w.length) continue;
      var ph = w.slice(i, i + n).join(' ').replace(/\s*([\-_.\/])\s*/g, '$1').replace(/^[\-_.\/]+|[\-_.\/]+$/g, '');
      if (!code(ph)) continue;
      if (p && SG && SG.hitsProduct) { try { if (SG.hitsProduct(ph, p)) return []; } catch (_) {} }
      out.push(ph); break;
    }
    out.sort(function (a, b) { return b.replace(/[^A-Za-z0-9]/g, '').length - a.replace(/[^A-Za-z0-9]/g, '').length; });
    return out.filter(function (x, i) { var f = x.replace(/[^A-Za-z0-9]/g, '').toLowerCase(); return !out.slice(0, i).some(function (y) { return y.replace(/[^A-Za-z0-9]/g, '').toLowerCase().indexOf(f) >= 0; }); }).slice(0, 1);
  }


  async function open(ctx) {
    ctx = ctx || {}; css(); close();
    /* (المالك seq A1014) «الأشياء التي على الطريق ولم تصل بعد ما في داعي تنعرض … لتقليل الاحتمالات»:
       منتجٌ كلّ كمّيته في العبور (الصين · أوروبا · in_transit) ولا شيء منه في أيّ فرع ⇒ لا يُقترح (ما في بين إيديك) */
    var TRANSIT = { china: 1, germany: 1, in_transit: 1 }, BR = ['haleb', 'daraa', 'homs', 'fakhouri', 'kurani', 'sarmada', 'hny_sbyl'];
    try { (global.allBranches || []).forEach(function (b) { var k = b && (b.key_name || b.key); if (k && !TRANSIT[k] && BR.indexOf(k) < 0) BR.push(k); }); } catch (_) {}
    function transitOnly(p) {
      var tr = (Number(p.china) || 0) + (Number(p.germany) || 0);
      try { var it = p.in_transit; if (it && typeof it === 'object') for (var k in it) tr += Number(it[k]) || 0; } catch (_) {}
      if (tr <= 0) return false;
      var have = false; BR.forEach(function (k) { if ((Number(p[k]) || 0) > 0) have = true; });
      return !have;
    }
    function freshList() { var a = []; try { a = (typeof ctx.products === 'function' ? ctx.products() : ctx.products) || []; } catch (_) { a = []; } return ctx.includeTransit ? a : a.filter(function (p) { return !transitOnly(p); }); }
    var list = freshList();   /* يُعاد قراءتها عند كلّ لقطة — المنتجات قد تكتمل بعد فتح العدسة */
    var root = doc.createElement('div'); root.id = 'gmt-lens'; root.setAttribute('role', 'dialog'); root.setAttribute('data-keep-fab', '1');
    root.innerHTML = '<div class="bx"><div style="display:flex;align-items:center;gap:8px"><h3 style="flex:1">🔍 عدسة GMT — ما هذا المنتج عندنا؟</h3><button type="button" data-x aria-label="إغلاق">✕</button></div>' +
      '<div class="sub">وجّه الكاميرا على المنتج أو علبته داخل الإطار — الاقتراحات من <b>صور منتجاتنا نحن</b> على الجهاز مباشرةً (بلا إنترنت ولا ذكاء اصطناعي).</div>' +
      '<div class="cam" data-cam><div class="guide"></div><div class="msg" data-cmsg>…</div></div>' +
      '<div class="row"><button type="button" class="p shut" data-snap>📸 التقط</button></div>' +
      '<div class="row"><button type="button" data-shot style="flex:1">🖼️ صورة من الجهاز</button><input type="file" accept="image/*" capture="environment" data-file hidden>' +
      '<button type="button" data-again hidden style="flex:1">🔄 لقطة جديدة</button></div>' +
      '<div class="row"><input type="text" data-q placeholder="أو اكتب ما على العلبة (اسم · موديل · باركود)…"><button type="button" data-find>بحث</button></div>' +
      '<div class="st" data-st></div><div data-read></div><div data-type></div><div data-res></div>' +
      '<div class="tools" data-tools hidden><button type="button" data-ai>🤖 اسأل العقل (اختياري)</button></div>' +
      '<div class="tools"><button type="button" data-learnq hidden>🧠 تعلّمات الموظّفين تنتظر اعتمادك</button></div><div data-lq></div></div>';
    root.setAttribute('data-gmt-modal', ''); root._gmtClose = close;   /* زرّ رجوع الهاتف بيسكّرها (الملحق «ح» ١ · seq B1117) */
    doc.body.appendChild(root);
    var $ = function (s) { return root.querySelector(s); };
    var S = { read: null, shot: null, typed: '', vec: null, words: [], code: '', vis: [], frozen: false, scope: null };
    root._S = S;   /* للفحص الآليّ */
    $('[data-x]').onclick = close;
    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    $('[data-shot]').onclick = function () { $('[data-file]').click(); };
    function st(t) { $('[data-st]').textContent = t || ''; }
    function cmsg(t) { var m = $('[data-cmsg]'); if (m) m.textContent = t || ''; }
    var L = null, ready = false, camNote = '', LIVE_MIN = 0.6;   /* بعد تدريب LDA (A1016): عند 0.6 تُعرض ~79٪ من اللقطات وصحيحٌ منها ~85٪ */

    /* ── الترتيب المحلّي الموحّد: صورة + كتابة + باركود ── */
    function combined() {
      var by = new Map(), LL = global.GMTLensLocal;
      function row(p) { var k = String(p.id); if (!by.has(k)) by.set(k, { item: p, vis: 0, txt: 0, bc: false, score: 0 }); return by.get(k); }
      (S.vis || []).forEach(function (r) { row(r.item).vis = r.vis; });
      if (S.code) { var lc = S.code.toLowerCase(); list.forEach(function (p) { if (p.barcode && String(p.barcode).toLowerCase() === lc) row(p).bc = true; }); }
      if (S.words.length && LL) list.forEach(function (p) { var t = LL.textScore(S.words, p); if (t > 0) row(p).txt = t; });
      if (S.typed || S.read) rankBy(S.read, S.typed, list).forEach(function (r) { var x = row(r.item); x.txt = Math.max(x.txt, Math.min(1, r.score)); });
      if (S.scope) {                                     /* «📂 النوع» و«🔗 متوافق مع»: كلّ منتجات النوع (أو ما يركب) مرتّبةً بشبه الصورة */
        var pool = list.filter(function (p) { return (!S.scope.cat || typeKey(p) === S.scope.cat) && (!S.scope.compat || compatHit(p, S.scope.compat)); });
        var vv = S.vec && LL ? LL.search(S.vec, pool, 60) : [];
        pool.forEach(function (p) { row(p); }); vv.forEach(function (r) { row(r.item).vis = r.vis; });
        var keep = {}; pool.forEach(function (p) { keep[String(p.id)] = 1; });
        var RS = Array.from(by.values()).filter(function (x) { return keep[String(x.item.id)]; });
        RS.forEach(function (x) { x.score = Math.max(0, x.vis) + 0.8 * x.txt + (x.txt >= 0.5 ? 0.2 : 0) + (x.bc ? 2 : 0) + 0.001 - variantMiss(x); });
        return RS.sort(function (a, b) { return b.score - a.score; }).slice(0, 14);
      }
      var R = Array.from(by.values());
      R.forEach(function (x) { x.score = Math.max(0, x.vis) + 0.8 * x.txt + (x.txt >= 0.5 ? 0.2 : 0) + (x.bc ? 2 : 0) - variantMiss(x); });
      return R.sort(function (a, b) { return b.score - a.score; }).filter(function (x) { return x.score > 0.05 || x.vis > -0.3 && S.vec; }).slice(0, 5);   /* اقتراحات الصورة تُعرض ولو ضعيفة — الخيار للموظّف */
    }
    /* (المالك seq A1025 «قرأت LED 600 فاقترح Led 600 RGB ولم يقترح 600 العادي — صيد النمط») كلمة **النسخة** في اسم المنتج
       (RGB · Max · Plus · Ultra · Lite · II · III · Mk2 …) لم تُقرأ على العلبة، بينما قُرئ موديلها ⇒ ليس هو على الأرجح: يُنزَل
       فيتقدّم «Led 600» على «Led 600 RGB» — والعكس: إن قُرئت RGB يتقدّم ما في اسمه RGB */
    var VARW = { rgb: 1, max: 1, plus: 1, ultra: 1, lite: 1, ii: 1, iii: 1, iv: 1, mk2: 1, mk3: 1, mkii: 1, combo: 1, bi: 0 };
    function variantMiss(x) {
      if (!S.words || !S.words.length || !(x.txt >= 0.5)) return 0;
      var read = {}; S.words.join(' ').toLowerCase().split(/[^a-z0-9]+/).forEach(function (w) { if (w) read[w] = 1; });
      var nm = String(x.item.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean), pen = 0;
      nm.forEach(function (w) { if (VARW[w] && !read[w]) pen += 0.35; });
      return Math.min(0.7, pen);
    }
    /* ── النوع: حين لا تعرف العين الموديل (قشاط · كفر · سوفت بوكس) تعرف النوع ⇒ كلّ منتجاته لتختار (seq 1002) ── */
    function typeKey(p) { return String(p.cat_sub || p.group_name || p.category || '').trim(); }
    /* (TASK-A0580 · المالك seq A1139) القسم من **الكتابة** أوّلاً («Microphone» ⇒ المايكات) — كان من الشكل وحده فعلبة مايك نائمة على جنبها
       صارت «ستاندات وترايبود» وحُصرت النتائج فيه فاختفى المايك الصحيح */
    function typeGuess() {
      var LL = global.GMTLensLocal, tt = LL && LL.textType && S.words && S.words.length ? LL.textType(S.words, list, typeKey) : null;
      if (tt && tt.share >= 0.6) return { cat: tt.cat, share: tt.share, n: list.filter(function (p) { return typeKey(p) === tt.cat; }).length, from: 'text' };
      return visType();
    }
    function visType() {
      var w = {}, tot = 0;
      (S.vis || []).slice(0, 8).forEach(function (r, i) { var k = typeKey(r.item); if (!k) return; var x = Math.max(0, r.vis) * (1 - i * 0.06); w[k] = (w[k] || 0) + x; tot += x; });
      var best = '', bw = 0; for (var k in w) if (w[k] > bw) { bw = w[k]; best = k; }
      return best && tot ? { cat: best, share: bw / tot, n: list.filter(function (p) { return typeKey(p) === best; }).length } : null;
    }
    /* ── التوافق: «لأيّ كاميرا/عدسة؟» ⇒ دليل التوافقيات (GMTCompatKB) + ما كُتب في التوافق والأسماء (seq 1002 «طوّر البحث بالتوافقيات») ── */
    var KW = { battery: 'بطارية', charger: 'شاحن', grip: 'قبضة', hood: 'هود', cap: 'غطاء', filter: 'فلتر', flash: 'فلاش', trigger: 'تريغر', adapter: 'محول', mic: 'مايك' };
    function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); }).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }
    function compatHit(p, q) {
      var KB = global.GMTCompatKB, nm = [p.name, p.alt_names].filter(Boolean).join(' ');
      if (KB && KB.resolve && KB.intentHit && KB.kindOf) {
        var kd = KB.kindOf(nm + ' ' + (p.group_name || ''));
        if (KW[kd]) { try { var it = KB.resolve(KW[kd] + ' ' + q); if (it && KB.intentHit(p, it)) return true; } catch (_) {} }
      }
      var hay = norm([nm, p.compat, p.search_terms, KB && KB.fitsFor ? KB.fitsFor(p) : ''].filter(Boolean).join(' '));
      var glued = hay.replace(/([a-z])[\s\-]+(?=\d)/g, '$1').replace(/[\-_.\/]+/g, '');
      var toks = norm(q).split(/[\s,،]+/).filter(Boolean);
      return toks.length > 0 && toks.every(function (w) {
        var f = w.replace(/[\-_.\/]+/g, '');
        if (/\d/.test(f) && /[a-z]/.test(f)) return new RegExp('(^|[^a-z0-9])' + f + '($|[^a-z0-9])').test(glued);   /* الكود بالمساواة: R5 ≠ R50 */
        if (/^\d+$/.test(f)) return new RegExp('(^|[^0-9])' + f + '($|[^0-9])').test(hay);
        return hay.indexOf(w) >= 0;
      });
    }
    function paintType() {
      var box = $('[data-type]'); if (!box) return;
      if (!S.frozen || !S.vec) { box.innerHTML = ''; return; }
      var g = S.scope ? { cat: S.scope.cat } : typeGuess();
      box.innerHTML = '<div class="rd" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
        (S.scope && S.scope.cat ? '<b>📂 كلّ «' + esc(S.scope.cat) + '»</b><button type="button" data-unscope style="font-size:11.5px;padding:4px 8px">✕ رجوع لأقرب ٥</button>'
          : g && g.cat ? '<span>📂 النوع المحتمل: <b>' + esc(g.cat) + '</b></span><button type="button" data-scope style="font-size:11.5px;padding:4px 8px">اعرض كلّ هذا النوع (' + g.n + ')</button>' : '') +
        (S.scope && !S.scope.cat && S.scope.compat ? '<button type="button" data-unscope style="font-size:11.5px;padding:4px 8px">✕ رجوع لأقرب ٥</button>' : '') +
        '<span style="flex-basis:100%;height:0"></span><input type="text" data-compat placeholder="🔗 متوافق مع… (R50 · 18-55 · LP-E17)" value="' + esc(S.scope && S.scope.compat || '') + '" style="flex:1;min-width:140px;font-size:12.5px;padding:6px 8px">' +
        '<button type="button" data-compat-go style="font-size:11.5px;padding:5px 9px">فلترة</button></div>';
      var sc = box.querySelector('[data-scope]'); if (sc) sc.onclick = function () { S.scope = { cat: g.cat, compat: '' }; paint(false); };
      var un = box.querySelector('[data-unscope]'); if (un) un.onclick = function () { S.scope = null; paint(false); };
      var go = box.querySelector('[data-compat-go]'), ci = box.querySelector('[data-compat]');
      go.onclick = async function () {
        var q = ci.value.trim();
        if (q) await loadOnce('GMTCompatKB', 'gmt-compat-kb.js?v=20261116d');
        if (q && global.GMTCompatKB && GMTCompatKB.ready) { try { await GMTCompatKB.ready(); } catch (_) {} }
        S.scope = q ? { cat: S.scope && S.scope.cat || '', compat: q } : (S.scope && S.scope.cat ? { cat: S.scope.cat, compat: '' } : null);
        paint(false);
        if (q && !combined().length) st('لا شيء بهذا التوافق' + (S.scope.cat ? ' ضمن «' + S.scope.cat + '»' : '') + ' — جرّب كتابةً أخرى (R50 · EOS R50 · 18-55)');
      };
      ci.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go.click(); } };
    }
    /* (المالك seq A1016 «تعرف تقرأ لحالها وتختار شو لازم تقرأ وشو ما لازم») قاموسٌ من أسماء منتجاتنا وأسمائها البديلة:
       الكلمة المقروءة «مهمّة» إن كانت كوداً/ماركة/كلمة في منتجاتنا — والباقي («Made in China» · «Photographic» · ضجيج) يُتجاهل */
    var VOC = null;
    function vocab() {
      if (VOC) return VOC; VOC = {};
      list.forEach(function (p) {
        String([p.name, p.alt_names, p.brand].filter(Boolean).join(' ')).toLowerCase().split(/[،,]/).forEach(function (part) {
          var toks = part.split(/[^a-z0-9]+/).filter(Boolean);
          toks.forEach(function (tk, i) { if (tk.length >= 3 && !/^\d+$/.test(tk)) VOC[tk] = (VOC[tk] || 0) + 1; if (toks[i + 1]) { var g = tk + toks[i + 1]; if (/\d/.test(g) && /[a-z]/.test(g)) VOC[g] = (VOC[g] || 0) + 1; } });
          var glued = part.replace(/[^a-z0-9]+/g, ''); if (glued.length >= 4 && glued.length <= 14 && /\d/.test(glued) && /[a-z]/.test(glued)) VOC[glued] = (VOC[glued] || 0) + 1;
          if (toks.length >= 2 && toks.length <= 5 && toks.join(' ').length >= 9) VOC['\u0001' + toks.join(' ')] = 1;   /* (seq A1139) اسم بديل كامل = جملة على العلبة */
        });
      });
      /* كلماتٌ وصفيّة عامّة لا تميّز منتجاً (موجودة على كلّ علبة) */
      ['made', 'china', 'led', 'leds', 'light', 'lights', 'lighting', 'photographic', 'photography', 'photo', 'fill', 'video', 'camera', 'with', 'the', 'and', 'for', 'new', 'input', 'output', 'model',
       'color', 'colour', 'digital', 'portable', 'professional', 'studio', 'kit', 'set', 'power', 'battery', 'charger', 'lens', 'stand', 'holder', 'case', 'bag', 'cable', 'type', 'usb', 'pro', 'max', 'mini', 'plus'].forEach(function (k) { delete VOC[k]; });
      return VOC;
    }
    function smartWords(w) {
      var V = vocab(), keep = [], seen = {}, SGc = global.GMTSuggest && GMTSuggest.codeNear;
      for (var i = 0; i < w.length; i++) {
        var a = String(w[i]).toLowerCase().replace(/[^a-z0-9]/g, ''), b = i + 1 < w.length ? a + String(w[i + 1]).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        var hit = (b && V[b] && /\d/.test(b)) ? w[i] + ' ' + w[i + 1] : (a.length >= 3 && V[a]) ? w[i] : '';
        /* كودٌ قرأته (حروف وأرقام) يطابق منتجاً بخوارزمية البحث ولو كُتب مكسوراً («1-600-SS») */
        if (!hit && SGc && /\d/.test(a) && /[a-z]/.test(a) && a.length >= 4) { for (var j = 0; j < Math.min(list.length, 800); j++) { if (SGc(w[i], list[j])) { hit = w[i]; break; } } }
        if (!hit && b && SGc && /\d/.test(b) && /[a-z]/.test(b) && b.length >= 4) { for (var j2 = 0; j2 < Math.min(list.length, 800); j2++) { if (SGc(w[i] + ' ' + w[i + 1], list[j2])) { hit = w[i] + ' ' + w[i + 1]; break; } } }
        if (hit && !seen[hit.toLowerCase()]) { seen[hit.toLowerCase()] = 1; keep.push(hit); }
      }
      /* (seq A1139) جملةٌ مقروءة تساوي اسماً بديلاً كاملاً («Wireless Lavalier Microphone») تُعرض ولو كانت كلماتها عامّة */
      var lw = w.map(function (x) { return String(x).toLowerCase().replace(/[^a-z0-9]/g, ''); });
      for (var n = 5; n >= 2; n--) for (var s0 = 0; s0 + n <= lw.length; s0++) {
        var ph = lw.slice(s0, s0 + n).filter(Boolean).join(' ');
        if (ph && V['\u0001' + ph] && !seen['\u0001' + ph]) { seen['\u0001' + ph] = 1; keep.unshift(w.slice(s0, s0 + n).join(' ')); }
      }
      return keep;
    }
    function paintRead() {
      var r = S.read, w = S.words, sw = w.length ? smartWords(w) : [];
      $('[data-read]').innerHTML = (S.code ? '<div class="rd">🏷️ <b>باركود في الصورة:</b> ' + esc(S.code) + '</div>' : '') +
        (w.length ? '<div class="rd">🔤 <b>قرأت على العلبة:</b> ' + (sw.length ? '<b style="color:#0f766e">' + esc(sw.slice(0, 8).join(' · ')) + '</b>' : '<span style="color:#64748b">لا كلمة تخصّ منتجاتنا</span>') +
          ' <span style="color:#94a3b8;font-size:11px">(تجاهلتُ ' + Math.max(0, w.length - sw.length) + ' كلمة لا تخصّنا)</span></div>' : '') +
        (r ? '<div class="rd">🤖 <b>قرأ العقل:</b> ' + esc([r.brand, r.name_on_box, r.model].filter(Boolean).join(' · ') || '—') + (r.product_type ? '<br>النوع: ' + esc(r.product_type) : '') + '</div>' : '');
    }
    function imgsOf(p) {
      var hid = Array.isArray(p.images_hidden) ? p.images_hidden : [];
      return [p.image_url].concat(Array.isArray(p.images) ? p.images : []).filter(function (u, i, a) { return typeof u === 'string' && u && !/^data:/.test(u) && a.indexOf(u) === i && hid.indexOf(u) < 0; });
    }
    function gallery(p, idx) {
      var ims = imgsOf(p), k = 0; if (!ims.length) return;
      var ov = doc.createElement('div'); ov.setAttribute('data-gallery', '');
      ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom));box-sizing:border-box';
      function draw() {
        ov.innerHTML = '<div style="color:#fff;font:800 14px Cairo,system-ui,sans-serif;margin-bottom:8px;text-align:center;max-width:100%;overflow-wrap:anywhere">' + esc(p.name || '') + ' <span style="color:#cbd5e1;font-weight:600">(' + (k + 1) + ' من ' + ims.length + ')</span></div>' +
          '<img src="' + esc(ims[k]) + '" alt="" style="max-width:100%;max-height:70vh;object-fit:contain;border-radius:12px;background:#fff">' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:center">' + (ims.length > 1 ? '<button type="button" data-gp style="font-size:14px;padding:8px 14px">›</button><button type="button" data-gn style="font-size:14px;padding:8px 14px">‹</button>' : '') +
          '<button type="button" data-gpick style="font-size:13px;padding:8px 14px;background:#16a34a;color:#fff;border:0;border-radius:10px">هذا هو</button><button type="button" data-gx style="font-size:13px;padding:8px 14px">✕ رجوع</button></div>';
        var a = ov.querySelector('[data-gp]'), b = ov.querySelector('[data-gn]');
        if (a) a.onclick = function () { k = (k - 1 + ims.length) % ims.length; draw(); };
        if (b) b.onclick = function () { k = (k + 1) % ims.length; draw(); };
        ov.querySelector('[data-gx]').onclick = function () { ov.remove(); };
        ov.querySelector('[data-gpick]').onclick = function () { ov.remove(); var bt = root.querySelector('[data-pick="' + idx + '"]'); if (bt) bt.click(); };
      }
      ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
      var x0 = null; ov.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      ov.addEventListener('touchend', function (e) { if (x0 == null || ims.length < 2) return; var d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 40) { k = (k + (d < 0 ? 1 : -1) + ims.length) % ims.length; draw(); } x0 = null; });
      draw(); doc.body.appendChild(ov);
    }
    function paintRes(R, pick, live) {
      if (!R.length) {
        $('[data-res]').innerHTML = live ? '' : S.scope ? '<div class="rd" style="color:#b45309">لا منتج بهذا الفلتر.</div>' : '<div class="rd" style="color:#b45309">لا منتج قريب — قرّب الكاميرا من الكتابة/الموديل، أو اكتبه، أو «🤖 اسأل العقل». إن لم يكن معرَّفاً فهو منتجٌ جديد يُعرَّف (دستور المنتجات §٥).</div>';
        return;
      }
      var bk = ctx.branchKey;
      $('[data-res]').innerHTML = '<div style="font-size:12px;font-weight:900;color:#334155;margin:6px 0">' + (live ? '👁️ أقرب منتجاتنا لما تراه الكاميرا:' : 'اختر المنتج — الأعلى هو الأقرب:') + '</div>' + R.map(function (r, i) {
        var p = r.item, best = (pick && pick.item === p) || (!pick && i === 0 && (r.bc || r.score >= 0.75)), img = p.image_url || (Array.isArray(p.images) && p.images[0]) || '';
        var bd = (r.bc ? '<span class="bd bc">🏷️ الباركود</span>' : '') + (r.vis > 0 ? '<span class="bd">👁️ ' + Math.round(Math.max(0, Math.min(1, r.vis)) * 100) + '%</span>' : '') + (r.txt >= 0.5 ? '<span class="bd tx">🔤 الكتابة</span>' : '');
        var nImg = imgsOf(p).length;
        return '<div class="it' + (best ? ' best' : '') + '">' + (img ? '<span class="gim" data-gal="' + i + '" role="button" tabindex="0" title="اضغط لتصفّح صور المنتج" style="position:relative;flex-shrink:0;cursor:zoom-in"><img src="' + esc(img) + '" alt="" loading="lazy">' + (nImg > 1 ? '<b style="position:absolute;bottom:2px;inset-inline-start:2px;background:rgba(15,23,42,.75);color:#fff;font-size:10px;border-radius:6px;padding:0 4px">🖼️ ' + nImg + '</b>' : '') + '</span>' : '<span style="width:58px;text-align:center">📦</span>') +
          '<div style="min-width:0"><div class="nm">' + (best ? '🎯 ' : '') + esc(p.name || '') + '</div><div class="mt">' + esc(p.barcode || 'بلا باركود') + (bk && p[bk] != null ? ' · المسجّل: ' + esc(p[bk]) : '') + (p.price != null && p.price !== '' ? ' · $' + esc(p.price) : '') + '</div>' +
          '<div>' + bd + '</div>' + (pick && pick.item === p && pick.why ? '<div class="why">🤖 ' + esc(pick.why) + ' (' + pick.confidence + '%)</div>' : '') + '</div>' +
          '<button type="button" class="go" data-pick="' + i + '">هذا هو</button></div>';
      }).join('') + (!live && ctx.learn && (S.read || modelWords(S.words, null).length) ? '<label class="lrn"><input type="checkbox" data-learn' + (S.read ? ' checked' : '') + '> أضف ما على العلبة (' + esc((S.read ? [S.read.name_on_box, S.read.model] : modelWords(S.words)).filter(Boolean).join(' · ').slice(0, 80)) + ') إلى أسمائه البديلة</label>' : '');
      /* (TASK-A0580 · المالك seq A1139 «لما بيعرض لي المنتجات في قائمة الخيارات … فيني ادخل على المنتج اتصفّح صوره الأخرى») */
      root.querySelectorAll('[data-gal]').forEach(function (g) { g.onclick = function () { gallery(R[+g.getAttribute('data-gal')].item, +g.getAttribute('data-gal')); }; g.onkeydown = function (e) { if (e.key === 'Enter') g.onclick(); }; });
      root.querySelectorAll('[data-pick]').forEach(function (b) {
        b.onclick = async function () {
          var p = R[+b.getAttribute('data-pick')].item, learned = false, sampled = false;
          var lr = $('[data-learn]');
          if (ctx.learn && lr && lr.checked) {
            var names = S.read ? [S.read.name_on_box, S.read.model, S.read.arabic_name] : modelWords(S.words, p);
            names = names.filter(function (x) { return x && String(x).trim().length > 1; });
            try { learned = names.length ? await ctx.learn(p, names) : false; } catch (_) { learned = false; }
          }
          if (S.vec && global.GMTLensLocal) {
            var adm = typeof ctx.isAdmin === 'function' ? !!ctx.isAdmin() : (global.GMTRole && GMTRole.isAdmin ? !!GMTRole.isAdmin() : false);
            try { sampled = await GMTLensLocal.addSample(p, S.vec, { admin: adm, by: ctx.by || null, source: ctx.source || location.pathname.split('/').pop(), words: S.words, canvas: S.shot, fromAI: !!S.read, names: S.read ? [S.read.name_on_box, S.read.model].filter(function (x) { return x && String(x).trim().length > 1; }) : modelWords(S.words, p) }); } catch (_) {}
          }
          try {
            var rank = R.indexOf(R[+b.getAttribute('data-pick')]) + 1, lp = S.logP;
            var upd = { picked_id: String(p.id), picked_name: String(p.name || '').slice(0, 120), picked_rank: rank, used_ai: !!S.read, ai_read: S.read ? [S.read.brand, S.read.name_on_box, S.read.model].filter(Boolean).join(' · ').slice(0, 200) : null };
            if (lp) lp.then(function (id) { if (id) GMTLensLocal.logPatch(id, upd); });
            else if (global.GMTLensLocal && S.shot) GMTLensLocal.logSearch(Object.assign({ page: ctx.source || location.pathname.split('/').pop(), typed: S.typed || null, canvas: S.shot }, upd));
          } catch (_) {}
          close();
          try { if (global.GMTSound && GMTSound.cue) GMTSound.cue('scan'); } catch (_) {}
          if (ctx.onPick) ctx.onPick(p, { read: S.read, learned: learned, sampled: sampled, words: S.words });
        };
      });
    }
    function paint(live) { paintRead(); if (!live) paintType(); paintRes(combined(), S.aiPick || null, live); }

    /* ── تجهيز العين والفهرس ── */
    st('⏳ تجهيز العدسة…');
    var eyeErr = '';
    /* (المالك seq A1020 «العدسة لما بفتحها كثير عم تعلّق وتهنّك الجهاز») كان كلّ الثقيل يبدأ معاً عند الفتح: العين + قارئ الكتابة + حساب صور
       المنتجات الجديدة + المعاينة كلّ ٠٫٨ث. الآن: العين أوّلاً · قارئ الكتابة بعدها حين يفرغ الجهاز · صور المنتجات الجديدة عند اللقطة فقط ·
       المعاينة كلّ ١٫٤ث وتتوقّف حين تختفي الصفحة · والأجهزة الضعيفة (ذاكرة ≤٣ج.ب) بلا معاينةٍ حيّة: «📸 التقط» فقط */
    var LOWEND = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    var idle = function (fn, ms) { setTimeout(function () { (global.requestIdleCallback || function (f) { setTimeout(f, 1); })(fn, { timeout: 4000 }); }, ms || 0); };
    var localP = needLocal().then(function (ok) { if (ok) L = global.GMTLensLocal; return ok; });   /* (seq A1007) قارئ الكتابة يُجهَّز فوراً مع فتح العدسة */
    var prepP = (async function () {
      if (!(await localP)) throw new Error('محرّك العدسة لم يُحمَّل');
      await Promise.all([L.loadModel(), L.loadIndex()]);
      ready = true; root.setAttribute('data-ready', '1'); st(camNote || '');
      idle(function () { if (doc.body.contains(root)) L.warmOCR(); }, 1500);
      return true;
    })();
    prepP.catch(function (e) { eyeErr = String((e && e.message) || e || '').slice(0, 80); root.setAttribute('data-ready', '0'); st('👁️ مطابقة الصور غير متاحة على هذا الجهاز — التقط وسأقرأ الكتابة والباركود على العلبة'); $('[data-tools]').hidden = false; });
    needMatch();

    /* ── الكاميرا الحيّة ── */
    var cam = $('[data-cam]'), video = null;
    async function startCam() {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { cam.hidden = true; $('[data-snap]').hidden = true; return; }
      try {
        var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (!doc.body.contains(root)) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        video = doc.createElement('video'); video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = stream;
        cam.insertBefore(video, cam.firstChild); await video.play().catch(function () {});
        LIVE = { stream: stream, timer: null, busy: false, hist: [], steady: 0, auto: false };
        cmsg('وجّه على المنتج — ثم «📸 التقط»');
        if (!LOWEND) LIVE.timer = setInterval(liveTick, 1400); else cmsg('وجّه على المنتج ثمّ «📸 التقط»');
      } catch (e) { cam.hidden = true; $('[data-snap]').hidden = true; camNote = 'الكاميرا غير متاحة هنا — استعمل «🖼️ صورة من الجهاز» أو اكتب ما على العلبة'; if (ready) st(camNote); }
    }
    async function liveTick() {
      if (!LIVE || LIVE.busy || S.frozen || !ready || !video || video.readyState < 2 || doc.hidden) return;
      LIVE.busy = true;
      try {
        var q = await L.embed(video, 'shot'); if (S.frozen) return;
        /* (seq A1016 «إذا ما كبست التقاط كثير عم يخرب») المعاينة الحيّة: متوسّط آخر ٣ إطارات (لا قفز بين إطارٍ وآخر) ·
           تُعرض فقط حين تكون واثقة · وحين تثبت الكاميرا ~٢ث تلتقط وحدها (قراءة كاملة + كتابة) مثل عدسة جوجل */
        var prev = LIVE.hist.length ? LIVE.hist[LIVE.hist.length - 1] : null, still = prev ? L.sim(prev, q) : 0;
        LIVE.hist.push(q); if (LIVE.hist.length > 3) LIVE.hist.shift();
        LIVE.steady = still > 0.9 ? LIVE.steady + 1 : 0;
        var avg = new Float32Array(q.length); LIVE.hist.forEach(function (v) { for (var i = 0; i < v.length; i++) avg[i] += v[i] / LIVE.hist.length; });
        var n = 0; for (var i2 = 0; i2 < avg.length; i2++) n += avg[i2] * avg[i2]; n = Math.sqrt(n) || 1; for (i2 = 0; i2 < avg.length; i2++) avg[i2] /= n;
        S.vec = avg; S.vis = L.search(avg, list, 8);
        if ('BarcodeDetector' in global) { try { var c0 = await L.barcode(video); if (c0) S.code = c0; } catch (_) {} }
        var R0 = combined(), top = R0[0], gap = R0[1] ? top.score - R0[1].score : 1;
        if (top && (top.bc || (top.vis >= LIVE_MIN && gap >= 0.02))) { paint(true); cmsg(top.bc ? '🏷️ ' + top.item.name : 'ثبّت الكاميرا لحظة — أو «📸 التقط»'); }
        else { $('[data-res]').innerHTML = ''; cmsg(LIVE.hist.length < 2 ? '…' : 'قرّب المنتج/العلبة من الإطار'); }
        if (LIVE.steady >= 3 && !LIVE.auto) { LIVE.auto = true; cmsg('📸 التقطت تلقائياً'); analyse(frameCanvas()); }
      } catch (_) {} finally { if (LIVE) LIVE.busy = false; }
    }
    function frameCanvas() {
      var c = doc.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0); return c;
    }
    /* ── اللقطة: فوريّ (صورة + باركود) ثمّ قراءة الكتابة بالخلفية ── */
    async function analyse(canvas) {
      list = freshList(); VOC = null;
      try { if (global.GMTLensLocal && GMTLensLocal.setCatalog) GMTLensLocal.setCatalog(list); } catch (_) {}   /* (seq A1139) عدّ الأسماء البديلة المشتركة */
      S.frozen = true; S.shot = canvas; S.words = []; S.code = ''; S.read = null; S.aiPick = null; S.scope = null; S.vec = null; S.vis = []; S.logP = null;
      if (video) video.hidden = true;
      var old = cam.querySelector('canvas.frz'); if (old) old.remove();
      canvas.className = 'frz'; cam.insertBefore(canvas, cam.firstChild); cmsg('');
      $('[data-snap]').hidden = true; $('[data-again]').hidden = false; $('[data-tools]').hidden = false;
      var t0 = performance.now(), stale = function () { return !S.frozen || S.shot !== canvas; };
      if (!(await localP)) { paint(false); st('محرّك العدسة لم يُحمَّل — اكتب ما على العلبة أو «🤖 اسأل العقل»'); return; }
      /* (seq A1006–A1007) ثلاث قراءات معاً ولا تنتظر إحداها الأخرى: الباركود · الكتابة على العلبة (OCR) · شبه الصورة.
         كانت الكتابة لا تُقرأ إطلاقاً إن تعذّرت «العين» على الهاتف ⇒ «لا منتج قريب» رغم أنّ «YM-600-SS» واضحة على العلبة. */
      var pending = 3, done = function () {
        if (--pending !== 0 || stale()) return;
        var R = combined();
        /* (المالك seq A1019–A1020) «إذا ما عرف المنتج على الأقلّ يعرف تصنيفه وقسمه ويعرض الأكثر تشابهاً» — حين لا يكون الأوّل واثقاً
           ولا كودٌ مقروء يطابقه ⇒ نعرض **قسمه** مباشرةً وداخله الأكثر تشابهاً أوّلاً (والرجوع لأقرب ٥ بزرّ) */
        var top0 = R[0], unsure = !top0 || (!top0.bc && top0.txt < 0.5 && (top0.score < 0.62 || (R[1] && top0.score - R[1].score < 0.03)));
        /* (seq A1139) الحصر التلقائيّ بالقسم فقط إن دلّت عليه الكتابة، أو كان الشكل واثقاً (أعلى شبه ≥ 0.45) — شكلٌ ضعيف (35٪) لا يحصر */
        if (unsure && !S.scope) { var tg = typeGuess(), v0 = (S.vis && S.vis[0] && S.vis[0].vis) || 0;
          if (tg && tg.cat && tg.n > 1 && (tg.from === 'text' || (tg.share >= 0.35 && v0 >= 0.45))) { S.scope = { cat: tg.cat, compat: '', auto: true }; paint(false); R = combined(); } }
        st(S.scope && S.scope.auto ? '🤔 لم أعرفه بالضبط — هذا قسمه «' + S.scope.cat + '» والأكثر شبهاً أوّلاً' : R.length ? 'اختر المنتج — الأعلى هو الأقرب' : 'لا تطابق — جرّب «🤖 اسأل العقل» أو اكتب الموديل');
        /* سجلّ البحث: ما قُرئ وما اقتُرح — يُكمَل بما اختير */
        S.logP = L.logSearch({ page: ctx.source || location.pathname.split('/').pop(), by_name: ctx.by || (global.GMTRole && GMTRole.name && GMTRole.name()) || null, ms: Math.round(performance.now() - t0),
          barcode: S.code || null, ocr: (S.words || []).join(' ').slice(0, 600) || null,
          top: R.map(function (x) { return { id: String(x.item.id), name: String(x.item.name || '').slice(0, 80), s: Math.round(x.score * 100) / 100, v: Math.round(x.vis * 100) / 100, t: Math.round(x.txt * 100) / 100, bc: !!x.bc }; }), canvas: canvas });
      };
      st('🔎 أقرأ الباركود والكتابة وأقارن الصورة…');
      L.barcode(canvas).then(function (c) { if (stale()) return; if (c) { S.code = c; paint(false); } }, function () {}).then(done);
      (L.ocrPasses ? L.ocrPasses(canvas, function (w) {
        if (stale()) return true;
        S.words = w || []; paint(false);
        var top = combined()[0]; return !!(top && top.txt >= 0.6);     /* كودٌ مطابق وُجد ⇒ لا حاجة لقراءةٍ مائلة أخرى */
      }) : L.ocr(canvas).then(function (w) { if (!stale()) { S.words = w || []; paint(false); } })).then(function () {}, function () {}).then(done);
      (async function () {
        try { await prepP; } catch (_) { if (!stale()) st('👁️ مطابقة الصور غير متاحة على هذا الجهاز' + (eyeErr ? ' (' + eyeErr + ')' : '') + ' — 🔤 أقرأ الكتابة على العلبة…'); return; }
        try { await L.fillMissing(list, 12); } catch (_) {}   /* منتجٌ أُضيف بعد بناء الفهرس ⇒ بصمته الآن (قليلة عادةً) */
        if (stale()) return;
        L.hold(true);
        try { var vs = await L.embedMulti(canvas); if (stale()) return; S.vec = vs[0] || null; S.vis = L.search(vs, list, 12); }   /* الشكل بثلاثة تأطيرات (seq A1010) */
        catch (e) { if (!stale()) st('👁️ تعذّرت مقارنة الصورة (' + String(e && e.message || e).slice(0, 60) + ') — 🔤 أقرأ الكتابة…'); }
        finally { L.hold(false); }
        if (stale()) return;
        paint(false);
        if (pending > 1) st('⚡ ' + Math.round(performance.now() - t0) + ' م.ث — 🔤 أقرأ الكتابة على العلبة…');
      })().then(done, function (e) { try { console.warn('[lens] visual', e); } catch (_) {} done(); });
    }
    $('[data-snap]').onclick = function () { if (video && video.readyState >= 2) analyse(frameCanvas()); };
    $('[data-again]').onclick = function () {
      S.frozen = false; S.read = null; S.words = []; S.code = ''; S.aiPick = null; S.scope = null; $('[data-type]').innerHTML = '';
      if (LIVE) { LIVE.hist = []; LIVE.steady = 0; LIVE.auto = false; }
      var f = cam.querySelector('canvas.frz'); if (f) f.remove(); if (video) video.hidden = false;
      cam.hidden = !video; $('[data-snap]').hidden = !video; $('[data-again]').hidden = true; $('[data-read]').innerHTML = ''; $('[data-res]').innerHTML = ''; st('');
      if (!video) $('[data-file]').click();
    };
    $('[data-file]').onchange = async function () {
      var f = this.files && this.files[0]; if (!f) return;
      var c = await fileToCanvas(f); if (!c) { st('تعذّر فتح الصورة'); return; }
      cam.hidden = false; analyse(c);
    };
    /* ── العقل: اختياريّ فقط ── */
    $('[data-ai]').onclick = async function () {
      if (!S.shot) { st('التقط صورةً أوّلاً'); return; }
      var b = this; b.disabled = true; st('🤖 العقل يقرأ ما على المنتج…');
      try {
        S.read = await readImage(S.shot.toDataURL('image/jpeg', 0.85)); paint(false);
        try { if (S.logP) S.logP.then(function (id) { if (id) L.logPatch(id, { used_ai: true, ai_read: [S.read.brand, S.read.name_on_box, S.read.model].filter(Boolean).join(' · ').slice(0, 200) }); }); } catch (_) {}
        await needMatch();
        var R = combined();
        if (global.GMTMatch && GMTMatch.vision && R.length > 1) {
          st('🤖 العقل يقارن صورتك بصور أقرب المرشّحين…');
          var v = await GMTMatch.vision({ name: S.read.name_on_box || S.read.query || '', image_url: S.shot.toDataURL('image/jpeg', 0.8), brand: S.read.brand }, R.map(function (x) { return { item: x.item, score: x.score }; }));
          if (v && v.item) { S.aiPick = { item: v.item, why: v.why, confidence: v.confidence }; R.sort(function (a, c) { return (c.item === v.item) - (a.item === v.item); }); paintRead(); paintRes(R, S.aiPick, false); st('✅ اختار العقل الأقرب — تأكّد واضغط «هذا هو»'); b.disabled = false; return; }
        }
        st('اختر المنتج — الأعلى هو الأقرب');
      } catch (e) { st('العقل لم يجب (' + (e.message || e) + ') — المطابقة المحلّية باقية'); }
      b.disabled = false;
    };
    $('[data-find]').onclick = async function () {
      S.typed = $('[data-q]').value.trim(); if (!S.typed && !S.read && !S.vec) return;
      await needMatch(); S.frozen = true; paint(false); st(combined().length ? 'اختر المنتج — الأعلى هو الأقرب' : '');
    };
    $('[data-q]').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $('[data-find]').click(); } };
    /* ── الأدمن: تعلّمات الموظّفين ⇒ اعتماد/رفض (اللقطة المصغّرة + المنتج الذي اختاروه) ── */
    var isAdm = typeof ctx.isAdmin === 'function' ? !!ctx.isAdmin() : (global.GMTRole && GMTRole.isAdmin ? !!GMTRole.isAdmin() : false);
    if (isAdm) prepP.then(function () { return L.pending(); }).then(function (rows) {
      var b = $('[data-learnq]'); if (!b || !rows || !rows.length) return;
      b.hidden = false; b.textContent = '🧠 تعلّمات الموظّفين تنتظر اعتمادك (' + rows.length + ')';
      b.onclick = function () {
        var box = $('[data-lq]');
        box.innerHTML = rows.map(function (r) {
          return '<div class="it" data-lr="' + r.id + '"' + (r.from_ai ? ' data-from-ai="1" title="تجربة العقل"' : '') + '>' + (r.thumb ? '<img src="' + esc(r.thumb) + '" alt="">' : '<span style="width:58px;text-align:center">📷</span>') +
            '<div style="min-width:0"><div class="nm">' + (r.from_ai ? '🤖 ' : '') + esc(r.product_name || r.product_id) + '</div><div class="mt">' + esc([r.by_name, r.source, String(r.created_at || '').slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · ')) + '</div>' + (r.names ? '<div class="why">+ أسماء: ' + esc(r.names) + '</div>' : '') + '</div>' +
            '<button type="button" class="go" data-lok="' + r.id + '">✔ صحيح</button><button type="button" data-lno="' + r.id + '">✕</button></div>';
        }).join('');
        box.querySelectorAll('[data-lok],[data-lno]').forEach(function (x) {
          x.onclick = async function () {
            var id = x.getAttribute('data-lok') || x.getAttribute('data-lno'), ok = x.hasAttribute('data-lok');
            x.disabled = true; var done = await L.review(id, ok, ctx.by || null);
            if (done) { var rw = box.querySelector('[data-lr="' + id + '"]'); if (rw) rw.remove(); rows = rows.filter(function (r) { return String(r.id) !== String(id); }); b.textContent = '🧠 تعلّمات الموظّفين تنتظر اعتمادك (' + rows.length + ')'; if (!rows.length) b.hidden = true; }
            else x.disabled = false;
          };
        });
      };
    }).catch(function () {});
    startCam();
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
