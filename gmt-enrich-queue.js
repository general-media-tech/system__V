/* ═════════════════════════════════════════════════════════════════════
   gmt-enrich-queue.js — تجهيز المنتجات تلقائياً مجموعةً مجموعة / تصنيفاً تصنيفاً  ·  (25 ت1 · TASK-0164)
   ─────────────────────────────────────────────────────────────────────
   طلب المالك (seq 75): «ضع أداة تعمل تلقائياً لكل المنتجات الموجودة — تبلّش فيهن مجموعة مجموعة أو تصنيف تصنيف داخل الجرد،
   بحيث أبلّش مثلاً بالكفرات السيليكون أو رؤوس الإضاءة يزبّطهم كلهم واحد تلو الآخر، بحيث يشتغل في الخلفية: لما أنا عم راجع
   أوّل منتج — ممكن أعدّله أو أكتب أو أمسح أو أشوف شيء أو أضيف صور — يكون هو عم يشتغل على الثاني والثالث والرابع…»
   + «العقل يركّز على جمع كل شي — كل شي مهم» + (seq 54) «الشخص فقط يراجع التعبئة التلقائية: يعطيه حفظ أو يعدّل يدوياً».
   ⚙️ كيف تعمل:
     • طابورٌ بترتيب المنتجات؛ العقل يجهّز منتجاً واحداً في كل مرّة (لا يُرهق الوسيط ولا الحصّة) ويستمرّ وحده حتى آخر الطابور،
       وأنت تراجع ما جهز — لا ينتظرك.
     • لكل منتج (بصورته واسمه الموجودَين): الاسم الإنجليزي · الماركة · الموديل · الأسماء البديلة · الوصف · جدول المواصفات ·
       التوافق · صورٌ مرشّحة (من صفحات المنتج حين يتاح البحث). كلّه قابلٌ للتعديل قبل الحفظ.
     • لا يُكتب شيءٌ بلا «💾 حفظ» منك. «⏭️ تخطّي» يتركه كما هو. «🔁 أعد البحث» برابطٍ أو ملاحظة.
     • الصور: «اجعلها الرئيسية في الجرد» · «أضفها لصور المتجر» (للمنتج المربوط بالمتجر) · ورفع صورةٍ من جهازك أو رابط.
     • الطابور محفوظ على هذا الجهاز: تغلق الأداة وتعود فتكمل من حيث توقّفت (ما جُهّز لا يُعاد).
   ⚠️ البحث الحقيقي في الويب (علي بابا · الصور) يتوقّف على مفتاحٍ يسمح بالبحث في أسرار الوسيط (TASK-0040). بدونه يجمع العقل من
      معرفته ويقولها صراحةً «ثقة منخفضة — ليست من صفحة المنتج» — فراجعها.
   الاستعمال: GMTEnrichQueue.open({ title, key, products, save(p, patch), upload(blob, name), storeAddImages(p, urls), onSaved(p, patch) })
   ═════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var LS = 'gmt_enrich_queue_v1', GAP_MS = 1200;
  var S = null;   // الجلسة الجارية

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function brainUrl() {
    try { if (global.GMTEndpoint && GMTEndpoint.get) { var u = GMTEndpoint.get('brain'); if (u) return u; } } catch (_) {}
    try { var v = localStorage.getItem('gmt_brain_endpoint') || ''; return /^https:\/\/ysawzwtmodkqqbqoiojj\.(?:supabase\.co\/functions\/v1|functions\.supabase\.co)\/gmt-brain\/?$/i.test(v) ? v : ''; } catch (_) { return ''; }
  }
  /* (TASK-0040 · المالك seq 103–104 «الأفضل والمجاني» ⇐ «ابنِه وحطّ وسيط تاني وحطّ غوغل وجمناي») وسيط البحث gmt-search بجانب العقل:
     Brave ثمّ Google ثمّ Gemini (كلٌّ بحدّه اليومي المجاني). صفحة المنتج الحقيقية ⇐ يقرأ العقل مواصفاتها منها · وصورٌ كثيرة تختار منها */
  function searchUrl() { var b = brainUrl(); return b ? b.replace(/\/gmt-brain\/?$/, '/gmt-search') : ''; }
  async function search(kind, q, count) {
    var u = searchUrl(); if (!u || !q) return null;
    var r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: kind, q: q, count: count }) });
    var j = {}; try { j = await r.json(); } catch (_) {}
    if (!r.ok || j.error) { var e = new Error(j.error || ('HTTP ' + r.status)); e.code = j.code || r.status; throw e; }
    return j;
  }
  /* صفحاتٌ ليست صفحة منتج (نتائج بحث · قوائم · متاجر كاملة) */
  var LISTING = /\/(trade\/search|search|showroom|catalog|category|categories|wholesale|s)\b|[?&](q|k|searchtext|keyword)=/i;
  async function proxy(body) {
    var u = brainUrl(); if (!u) throw new Error('عقل النظام غير مفعّل');
    var r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = {}; try { j = await r.json(); } catch (_) {}
    if (!r.ok || j.error) { var e = new Error(j.error || ('HTTP ' + r.status)); e.code = j.code || r.status; throw e; }
    return j;
  }
  function b64Blob(b64, type) { var bin = atob(b64), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: type || 'image/jpeg' }); }
  /* صورة عبر المتصفّح، وإلّا عبر الوسيط (CORS) */
  async function imgBlob(url) {
    if (!url) return null;
    try { var r = await fetch(url, { mode: 'cors' }); if (r.ok) { var b = await r.blob(); if (/^image\//.test(b.type || '')) return b; } } catch (_) {}
    try { var j = await proxy({ mode: 'image_fetch', url: url }); return j && j.data ? b64Blob(j.data, j.type) : null; } catch (_) { return null; }
  }
  function load() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (_) { return null; } }
  function persist() {
    if (!S) return;
    try { localStorage.setItem(LS, JSON.stringify({ key: S.key, title: S.title, at: Date.now(),
      items: S.items.map(function (it) { return { id: it.id, st: it.st === 'run' ? 'wait' : it.st, res: it.res || null, err: it.err || '' }; }) })); } catch (_) {}
  }

  /* (TASK-0172 · المالك seq 87 «اسمه EF-M وجاب EF-EOS R — لازم ياخذ الصورة والاسم») رموز الموديل في اسم منتجك (EF-M · M50 · SB-1517 · RF)
     هي المرجع: تُرسَل للعقل «يجب أن يطابقها»، وما لا تحمله النتيجة يُنبَّه عليه في البطاقة. */
  function nameTokens(name) {
    var out = [];
    String(name || '').split(/[^A-Za-z0-9\-\/]+/).forEach(function (w) {
      w = w.replace(/^[-\/]+|[-\/]+$/g, '');
      if (w.length < 2 || !/[A-Za-z]/.test(w)) return;
      if (!(/\d/.test(w) || /[-\/]/.test(w) || /^[A-Z]{2,5}$/.test(w))) return;
      if (out.indexOf(w) === -1) out.push(w);
    });
    return out.slice(0, 6);
  }
  function missingTokens(p, r) {
    if (!r) return [];
    var words = {}, txt = [r.name_en, r.model, r.brand, r.compat, r.desc].concat((r.specs || []).map(function (s) { return s.k + ' ' + s.v; })).join(' ');
    txt.toUpperCase().split(/[^A-Z0-9]+/).forEach(function (w) { if (w) words[w] = 1; });
    var flat = txt.toUpperCase().replace(/[^A-Z0-9]+/g, '');
    return nameTokens(p.name).filter(function (t) {
      var parts = t.toUpperCase().split(/[-\/]+/).filter(Boolean);
      return !(parts.every(function (x) { return words[x]; }) || flat.indexOf(t.toUpperCase().replace(/[^A-Z0-9]+/g, '')) !== -1);
    });
  }
  /* ── العقل: كل ما يُجمع لمنتجٍ واحد ── */
  async function enrichOne(p, extra) {
    extra = extra || {};
    var toks = nameTokens(p.name);
    /* الملاحظة قصيرة: الوسيط يقصّها عند ٣٠٠ حرف وفيها أيضاً طلب المواصفات (GMTBrain · TASK-0173) */
    var hint = [p.name, p.brand, extra.hint].filter(Boolean).join(' — ') +
      (toks.length ? ' — الاسم هو المرجع: الموديل يطابق «' + toks.join('»، «') + '»' : '') +
      (extra.deep ? ' — بحث أعمق: الصورة والاسم معاً' : '');
    var file = extra.noImage ? null : await imgBlob(p.image_url);
    /* (TASK-0040) الاستعلام: الماركة والموديل كما في الاسم (أدقّ من الاسم العربي) — و«بحث أعمق» يسأل بصيغةٍ أخرى فتختلف النتائج */
    var q = ([p.brand || '', toks.join(' ')].join(' ').trim() || p.name || '').slice(0, 120);
    var page = extra.url || '', searchNote = '', web = null, pics = null;
    if (q && !page) {
      try { web = await search('web', extra.deep ? q + ' specifications datasheet' : q, 8); } catch (e) { searchNote = e && e.code === 'no_keys' ? 'no_keys' : ((e && e.message) || ''); }
      var hit = web && (web.web || []).filter(function (w) { return w && /^https:\/\//i.test(w.url) && !LISTING.test(w.url); })[extra.deep ? 1 : 0];
      if (!hit && web && extra.deep) hit = (web.web || []).filter(function (w) { return w && /^https:\/\//i.test(w.url) && !LISTING.test(w.url); })[0];
      if (hit) page = hit.url;
    }
    /* (TASK-0187) اسمنا ومعرّفنا ومجموعتنا: مفتاح الإكسسوار في دليل التوافقيات يُبنى من اسمنا لا ممّا وجده العقل */
    var pr = await global.GMTBrain.importProduct({ url: page, hint: hint, file: file, pid: p.id, pname: p.name, group: [p.group_name, p.category].filter(Boolean).join(' ') });
    var meta = pr._meta || {}, imgs = [], thumbs = {};
    (pr.images || []).forEach(function (u) { if (/^https?:\/\//i.test(u) && imgs.indexOf(u) === -1) imgs.push(u); });
    /* (TASK-0040 · seq 91 «على الأقل ٢٠ صورة: جميلة · إعلانية · خلفية بيضاء · صور مواصفات — أختار منها ٥–٦») */
    if (q && searchNote !== 'no_keys') {
      try { pics = await search('images', extra.deep ? q + ' product white background' : q, 40); } catch (e) { if (!searchNote) searchNote = e && e.code === 'no_keys' ? 'no_keys' : ((e && e.message) || ''); }
      ((pics && pics.images) || []).forEach(function (im) { if (im && /^https:\/\//i.test(im.url) && imgs.indexOf(im.url) === -1) { imgs.push(im.url); if (im.thumb) thumbs[im.url] = im.thumb; } });
    }
    /* صورٌ مرشّحة إضافية من البحث — فقط حين يكون البحث متاحاً (نتيجةٌ من الذاكرة ⇒ البحث معطَّل: لا نداءٌ فاشلٌ آخر) */
    if (imgs.length < 20 && (!meta.from_memory || extra.deep) && searchNote !== 'no_keys') {
      try { var ps = await proxy({ mode: 'product_search', hint: hint, url: extra.url || '' });
        (ps.candidates || []).forEach(function (c) { (c.image_urls || []).forEach(function (u) { if (/^https?:\/\//i.test(u) && imgs.indexOf(u) === -1) imgs.push(u); }); });
      } catch (_) {}
    }
    return {
      name_en: pr.name_en || '', name_ar: pr.name || '', brand: pr.brand || '', model: pr.model || '',
      desc: pr.description_ar || '', compat: Array.isArray(pr.compat) ? pr.compat.join(' · ') : (pr.compat || ''),
      specs: (pr.specs || []).filter(function (s) { return s && s.k; }).map(function (s) { return { k: String(s.k), v: String(s.v == null ? '' : s.v) }; }),
      images: imgs.slice(0, 40), thumbs: thumbs, source: pr.source_url || page || '', confidence: pr.confidence || '', from_memory: !!meta.from_memory, notes: pr.notes || '',
      page_ok: !!meta.page_ok, search: web || pics ? ((web && web.provider) || (pics && pics.provider) || '') : '', search_note: searchNote,
      aliases_ar: Array.isArray(pr.aliases_ar) ? pr.aliases_ar.slice(0, 10) : [], aliases_en: Array.isArray(pr.aliases_en) ? pr.aliases_en.slice(0, 10) : [],   // (TASK-0175) أسماء البحث الأخرى
      compat_ai: !!meta.compat_added,   // (TASK-0183) توافق الإكسسوار من طلب التوافق — يُراجَع
      compat_web: !!meta.compat_web, compat_src: (meta.compat_sources || []).slice(0, 5), kb_added: meta.kb_added || 0, compat_known: meta.compat_known || 0   // (TASK-0187) من الإنترنت ⇐ في الدليل
    };
  }

  /* ── الطابور: يعمل وحده بالترتيب ── */
  async function pump() {
    var s = S;                                   // الجلسة التي بدأ عليها — إغلاقها أو فتح غيرها أثناء الانتظار لا يخلطهما
    if (!s || s.busy || s.paused || s.closed) return;
    var it = s.items.filter(function (x) { return x.st === 'wait'; })[0];
    if (!it) { render(); return; }
    s.busy = true; it.st = 'run'; render();
    var res = null, err = '';
    try { res = await enrichOne(it.p, it.again); }
    catch (e) { err = (e && e.message) || String(e) || 'خطأ'; }
    s.busy = false;
    if (s.closed || s !== S) return;             // أُغلقت الأداة: يُعاد هذا المنتج حين تفتحها (لم يُحفظ له شيء)
    if (err) {
      /* حدّ الحصّة ⇒ ننتظر ثمّ نعيد مرّةً واحدة */
      if (/429|quota|rate/i.test(err) && !it.retried) { it.retried = true; it.st = 'wait'; persist(); render(); setTimeout(pump, 20000); return; }
      it.st = 'err'; it.err = err;
    } else { it.res = res; it.st = 'ready'; it.err = ''; }
    it.again = null; persist();
    /* لا نسحبك من منتجٍ تراجعه: ننتقل لأوّل جاهز فقط إن لم يكن أمامك ما يُراجَع */
    var ci = curItem(); if (!ci || (ci.st !== 'ready' && ci.st !== 'err')) { var r0 = s.items.filter(function (x) { return x.st === 'ready'; })[0]; if (r0) s.cur = r0.id; }
    render();
    setTimeout(pump, GAP_MS);
  }
  function curItem() { return S && S.items.filter(function (x) { return String(x.id) === String(S.cur); })[0]; }
  function nextReady() { var r = S.items.filter(function (x) { return x.st === 'ready'; })[0]; S.cur = r ? r.id : (S.items.filter(function (x) { return x.st === 'run' || x.st === 'wait'; })[0] || {}).id || null; }

  /* ── الواجهة ── */
  var ST = { wait: ['⏳', 'بالانتظار', '#64748b'], run: ['🔄', 'العقل يعمل عليه', '#2563eb'], ready: ['📝', 'جاهز لمراجعتك', '#b45309'],
             saved: ['✅', 'حُفظ', '#15803d'], skip: ['⏭️', 'تُخطّي', '#64748b'], err: ['⚠️', 'تعذّر', '#b91c1c'] };
  function counts() { var c = { wait: 0, run: 0, ready: 0, saved: 0, skip: 0, err: 0 }; S.items.forEach(function (x) { c[x.st]++; }); return c; }
  function render() {
    if (!S || !S.ov) return;
    var c = counts(), done = c.saved + c.skip, run = S.items.filter(function (x) { return x.st === 'run'; })[0];
    var head = S.ov.querySelector('[data-q-head]');
    head.innerHTML = '<b style="font-size:15px;display:block">🧠 تجهيز «' + esc(S.title) + '»</b>' +
      '<span style="font-size:12px;color:#526077">' + S.items.length + ' منتج · جاهز للمراجعة ' + c.ready + ' · حُفظ ' + c.saved + ' · تُخطّي ' + c.skip + (c.err ? ' · تعذّر ' + c.err : '') +
      (run ? ' · <b style="color:#2563eb">يعمل الآن على: ' + esc(run.p.name) + '</b>' : (c.wait ? (S.paused ? ' · ⏸️ متوقّف' : '') : ' · انتهى العقل من الطابور')) + '</span>' +
      '<div style="height:5px;background:#e2e8f0;border-radius:4px;margin-top:6px;overflow:hidden"><div style="height:100%;width:' + Math.round(100 * (done + c.ready) / Math.max(1, S.items.length)) + '%;background:#16a34a"></div></div>';
    S.ov.querySelector('[data-q-pause]').textContent = S.paused ? '▶️ تابع' : '⏸️ إيقاف مؤقّت';
    var sa = S.ov.querySelector('[data-q-saveall]');
    if (sa && !S.savingAll) { sa.style.display = c.ready ? '' : 'none'; sa.textContent = '💾 احفظ كل الجاهز (' + c.ready + ')'; sa.disabled = false; }
    var list = S.ov.querySelector('[data-q-list]');
    list.innerHTML = S.items.map(function (x) { var t = ST[x.st];
      return '<button type="button" data-q-pick="' + esc(x.id) + '" style="display:flex;gap:6px;align-items:center;width:100%;text-align:right;border:1px solid ' + (String(x.id) === String(S.cur) ? '#0f1219' : '#e2e8f0') + ';background:#fff;border-radius:10px;padding:6px 8px;font:inherit;font-size:12px;cursor:pointer">' +
        '<span>' + t[0] + '</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.p.name) + '</span><span style="color:' + t[2] + ';font-weight:800;white-space:nowrap">' + t[1] + '</span></button>'; }).join('');
    renderCard();
  }
  /* (TASK-0184 · المالك seq 117 «أوّلاً المواصفات اللي حدّدناها نحن بالجرد والجديدة … ثمّ المكتوبة في المتجر — ممكن أحذفها كلها») */
  function asObj(sp) { if (!sp) return {}; if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch (_) { return {}; } } return (sp && typeof sp === 'object' && !Array.isArray(sp)) ? sp : {}; }
  function sval(v) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(function (x) { return (x && typeof x === 'object') ? [x.brand, x.mount, x.model, x.version].filter(Boolean).join(' ') : String(x); }).filter(Boolean).join(' · ');
    if (typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; }).filter(function (x) { return x != null && x !== ''; }).join(' · ');
    return String(v).trim();
  }
  function kNorm(k) { return String(k || '').replace(/[\u064B-\u065F\u0640]/g, '').replace(/^ال/, '').replace(/[\s·:()\/\-]+/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase(); }
  /* مواصفات الجرد الموجودة أوّلاً (بمفاتيحها) ثمّ ما جاء به العقل ولم يكن موجوداً */
  function specRows(p, r) {
    var base = asObj(p.specs), have = {}, out = [];
    Object.keys(base).forEach(function (k) { if (k.indexOf('__') === 0) return; var v = sval(base[k]); if (!v) return; have[kNorm(k)] = 1; out.push({ k: k, v: v, orig: k }); });
    ((r && r.specs) || []).forEach(function (x) { if (!x || !x.k || !x.v) return; var n = kNorm(x.k); if (have[n]) return; have[n] = 1; out.push({ k: x.k, v: x.v }); });
    return out;
  }
  function rowHTML(s, i) {
    return '<div data-spec-row' + (s.orig ? ' data-orig="' + esc(s.orig) + '"' : '') + ' style="display:flex;gap:6px;margin-bottom:6px"><input data-k value="' + esc(s.k) + '" placeholder="الخاصيّة" style="flex:0 0 38%;min-width:0;border:1px solid ' + (s.orig ? '#bfdbfe' : '#e2e8f0') + ';border-radius:8px;padding:7px;font:inherit;font-size:13px">' +
      '<input data-v value="' + esc(s.v) + '" placeholder="القيمة" style="flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:8px;padding:7px;font:inherit;font-size:13px">' +
      '<button type="button" data-row-del style="border:0;background:#fee2e2;color:#b91c1c;border-radius:8px;padding:0 9px;cursor:pointer">✕</button></div>';
  }
  function field(label, key, val, multi) {
    var st = 'width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px';
    return '<label style="display:block;margin-top:8px"><span style="display:block;font-size:11.5px;font-weight:800;color:#526077;margin-bottom:3px">' + label + '</span>' +
      (multi ? '<textarea data-f="' + key + '" rows="3" style="' + st + ';resize:vertical">' + esc(val) + '</textarea>' : '<input data-f="' + key + '" value="' + esc(val) + '" style="' + st + '">') + '</label>';
  }
  function renderCard() {
    var box = S.ov.querySelector('[data-q-card]'), it = curItem();
    if (!it) { box.innerHTML = '<div style="padding:30px 10px;text-align:center;color:#526077">لا شيء للمراجعة بعد — العقل يجهّز أوّل منتج…</div>'; return; }
    if (box.getAttribute('data-for') === String(it.id) + ':' + it.st) return;      // لا نُعيد رسم ما تكتب فيه
    box.setAttribute('data-for', String(it.id) + ':' + it.st);
    var p = it.p, r = it.res || {};
    var top = '<div style="display:flex;gap:10px;align-items:center">' + (p.image_url ? '<img data-q-main-img src="' + esc(p.image_url) + '" alt="" style="width:64px;height:64px;object-fit:contain;border-radius:12px;background:#fff;border:1px solid #e2e8f0" onerror="this.remove()">' : '') +
      '<div style="flex:1;min-width:0"><b style="display:block;font-size:15px">' + esc(p.name) + '</b><span style="font-size:12px;color:#526077">' + esc(p.barcode || '') + (p.group_name ? ' · ' + esc(p.group_name) : '') + '</span></div></div>';
    if (it.st === 'wait' || it.st === 'run') { box.innerHTML = top + '<div style="padding:24px 4px;text-align:center;color:#2563eb;font-weight:800">' + (it.st === 'run' ? '🔄 العقل يجمع معلوماته الآن…' : '⏳ بالانتظار — يأتي دوره بعد ما قبله') + '</div>'; return; }
    var deepBtn = '<button type="button" data-act="deep" style="' + btn('#eff6ff', '#1d4ed8') + '">🔎 بحث أعمق</button>';
    if (it.st === 'err') { box.innerHTML = top + '<div style="margin-top:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px;color:#991b1b;font-size:13px">⚠️ ' + esc(it.err) + '</div>' + againHTML() + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' + deepBtn + '<button type="button" data-act="skip" style="' + btn('#f1f5f9', '#0f1219') + '">⏭️ تخطّي</button></div>' + selfSearch(p); return; }
    /* (TASK-0172 · المالك seq 88 «إذا تخطّيت منتج … لازم يبقى عندي: إعادة مراجعة أو زرّ إعادة بحث أعمق») المتخطّى والمحفوظ لا يصيران
       طريقاً مسدوداً: البطاقة كاملة كما هي (تعدّل وتحفظ) مع «🔎 بحث أعمق» */
    var banner = it.st === 'skip' ? '<div style="margin-top:10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;font-size:12.5px;font-weight:800;color:#334155">⏭️ تخطّيتَه — لم يُحفظ له شيء بعد. راجعه واحفظه، أو «🔎 بحث أعمق».</div>'
               : it.st === 'saved' ? '<div style="margin-top:10px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:8px 10px;font-size:12.5px;font-weight:800;color:#047857">✅ حُفظ — تقدر تعدّل وتعيد الحفظ، أو «🔎 بحث أعمق».</div>' : '';
    if ((it.st === 'saved' || it.st === 'skip') && !it.res) { box.innerHTML = top + banner + againHTML() + '<div style="display:flex;gap:8px;margin-top:10px">' + deepBtn + '</div>' + selfSearch(p); return; }
    var miss = missingTokens(p, r);
    var mismatch = miss.length ? '<div data-mismatch style="margin-top:10px;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:8px 10px;color:#991b1b;font-size:12.5px;line-height:1.7;font-weight:800">⚠️ النتيجة لا تطابق اسم منتجك: «' + miss.map(esc).join('»، «') + '» غير موجود فيها — قد تكون لمنتجٍ آخر. صحّحها أو «🔎 بحث أعمق».</div>' : '';
    /* (TASK-0040 · seq 91 «رسالة ليست من صفحة المنتج») مصدر النتيجة بوضوح: صفحة المنتج (ورابطها) · أو المعرفة العامّة ولماذا */
    var host = ''; try { host = r.source ? new URL(r.source).hostname.replace(/^www\./, '') : ''; } catch (_) { host = ''; }
    var warn = (r.page_ok && host) ? '<div data-src-ok style="margin-top:10px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:8px 10px;color:#065f46;font-size:12px;line-height:1.7">📄 من صفحة المنتج: <a href="' + esc(r.source) + '" target="_blank" rel="noopener" dir="ltr">' + esc(host) + '</a>' + (r.search ? ' · وجدها البحث (' + esc(r.search) + ')' : '') + '</div>'
      : r.from_memory ? '<div style="margin-top:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:8px 10px;color:#92400e;font-size:12px;line-height:1.7">⚠️ ليست من صفحة المنتج — ' +
        (r.search_note === 'no_keys' ? 'وسيط البحث بلا مفتاح بعد (أضف مفتاح Brave في أسرار Supabase ليبحث في الويب ويجلب الصور)' : 'لم يجد البحث صفحته الآن') + '، فهذه من معرفة الذكاء الاصطناعي (ثقة منخفضة). راجعها، أو «🔁 أعد البحث» برابط صفحته على علي بابا.</div>' : '';
    var imgs = (r.images || []).map(function (u) {
      var th = (r.thumbs && r.thumbs[u]) || u;
      return '<div data-img-tile style="border:1px solid #e2e8f0;border-radius:12px;padding:6px;background:#fff;width:108px;position:relative">' +
        (S.storeAddImages ? '<label style="position:absolute;top:8px;right:8px;background:#fff;border-radius:8px;padding:1px 3px;line-height:0"><input type="checkbox" data-img-pick="' + esc(u) + '" style="width:18px;height:18px"></label>' : '') +
        /* data-gimg-allow/done: صور المرشّحين تُعرض من مصدرها ولا يخزّنها حارس الصور على الجهاز (٤٠ صورة لكل منتج كانت ستملأ التخزين) */
        '<img src="' + esc(th) + '" data-gimg-allow="1" data-gimg-done="1" alt="" loading="lazy" style="width:100%;height:84px;object-fit:contain" onerror="if(this.parentNode)this.parentNode.remove()">' +
        '<button type="button" data-img-main="' + esc(u) + '" style="' + btn('#0f1219', '#fff') + ';width:100%;margin-top:4px;padding:5px;font-size:11px">رئيسية للجرد</button>' +
        (S.storeAddImages ? '<button type="button" data-img-store="' + esc(u) + '" style="' + btn('#ecfdf5', '#047857') + ';width:100%;margin-top:4px;padding:5px;font-size:11px">+ صور المتجر</button>' : '') + '</div>'; }).join('');
    box.innerHTML = top + banner + mismatch + warn +
      field('الاسم بالإنجليزية', 'name_en', r.name_en) + field('الماركة', 'brand', r.brand || p.brand || '') + field('الموديل', 'model', r.model) +
      field('الأسماء البديلة — عربي وإنجليزي (يبحث بها الجرد ونقطة البيع)', 'alt', mergeAlt(p.alt_names, [r.name_en, r.model].concat(r.aliases_ar || [], r.aliases_en || []))) +
      field('الوصف (يظهر في المتجر)', 'desc', sval(asObj(p.specs).__desc) || r.desc, true) +
      '<div style="margin-top:10px"><span style="display:block;font-size:11.5px;font-weight:800;color:#526077;margin-bottom:4px">📋 جدول المواصفات — المحدَّد في الجرد أوّلاً (بإطارٍ أزرق) ثمّ الجديد من العقل</span><div data-rows>' + specRows(p, r).map(rowHTML).join('') + '</div>' +
      '<button type="button" data-row-add style="' + btn('#f1f5f9', '#0f1219') + ';font-size:12px;padding:6px 10px">+ صفّ</button></div>' +
      '<div data-store-box style="margin-top:10px"></div>' +
      field('متوافق مع' + (r.compat_web ? ' — 🌐 من الإنترنت' + (r.kb_added ? ' · أُضيف ' + r.kb_added + ' لدليل التوافقيات' : ' · في دليل التوافقيات') + ' (احذف الغلط من صفحة الدليل)'
        : r.compat_ai ? ' — ⚠️ من ذاكرة العقل بقواعد دليل التوافقيات — لم يُتحقَّق من الإنترنت: تأكّد من كل عدسة/جهاز قبل الحفظ (يُبحث به لاحقاً)' : ''), 'compat', r.compat, true) +
      (r.compat_web && r.compat_src && r.compat_src.length ? '<div data-compat-src style="font-size:11px;color:#526077;margin-top:4px;overflow-wrap:anywhere">مصادر التوافق: ' + r.compat_src.map(function (s) {
        var host = ''; try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (_) {}
        return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title || host || s.url) + '</a>'; }).join(' · ') + '</div>' : '') +
      '<div style="margin-top:12px"><span style="display:block;font-size:11.5px;font-weight:800;color:#526077;margin-bottom:4px">🖼️ الصور</span>' +
        (imgs ? '<div style="font-size:11.5px;color:#526077;margin-bottom:6px">' + (r.images || []).length + ' صورة — علّم ما تريده (٥–٦) ثمّ «أضف المحدَّد للمتجر»، أو «رئيسية للجرد» لواحدة</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;max-height:420px;overflow:auto">' + imgs + '</div>' +
          (S.storeAddImages ? '<button type="button" data-img-store-picked style="' + btn('#047857', '#fff') + ';margin-top:8px;font-size:12.5px;padding:8px 12px">+ أضف المحدَّد للمتجر (<span data-img-n>0</span>)</button>' : '')
          : '<div style="font-size:12px;color:#526077">لم يجد العقل صوراً مرشّحة' + (r.search_note === 'no_keys' ? ' (وسيط البحث بلا مفتاح بعد — أضف مفتاح Brave في أسرار Supabase)' : r.from_memory ? ' (البحث في الويب غير متاح)' : '') + ' — ارفع صورة أو الصق رابطها:</div>') +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><label style="' + btn('#f1f5f9', '#0f1219') + ';font-size:12px;padding:7px 10px">📷 من جهازك<input type="file" accept="image/*" data-img-file hidden></label>' +
        '<input data-img-url dir="ltr" placeholder="https://… رابط صورة" style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:10px;padding:7px;font:inherit;font-size:12px">' +
        '<button type="button" data-img-url-main style="' + btn('#0f1219', '#fff') + ';font-size:12px;padding:7px 10px">رئيسية</button>' +
        (S.storeAddImages ? '<button type="button" data-img-url-store style="' + btn('#ecfdf5', '#047857') + ';font-size:12px;padding:7px 10px">+ المتجر</button>' : '') + '</div>' +
        '<div data-img-msg style="font-size:12px;font-weight:800;margin-top:6px;min-height:1em"></div></div>' +
      (r.source ? '<div style="font-size:11px;color:#526077;margin-top:8px;overflow-wrap:anywhere">المصدر: ' + esc(r.source) + '</div>' : '') +
      againHTML() + selfSearch(p) +
      '<div style="display:flex;gap:8px;margin-top:12px;position:sticky;bottom:0;background:#f8fafc;padding-top:8px;flex-wrap:wrap"><button type="button" data-act="save" style="' + btn('#D5001C', '#fff') + ';flex:1">' + (it.st === 'ready' ? '💾 حفظ والتالي' : '💾 حفظ') + '</button>' +
      deepBtn + (it.st === 'ready' ? '<button type="button" data-act="skip" style="' + btn('#f1f5f9', '#0f1219') + '">⏭️ تخطّي</button>' : '') + '</div>' +
      '<div data-save-msg style="font-size:12px;font-weight:800;margin-top:6px;min-height:1em"></div>';
    storeBox(it);
  }
  /* (TASK-0184) «🛒 المكتوب في المتجر الآن» تحت ما سبق — كل سطرٍ يُحذف بـ✕، وما يبقى يُحفظ تحت وصفك في المتجر */
  function storeBox(it) {
    var box = S.ov.querySelector('[data-q-card] [data-store-box]'); if (!box || !S.storeInfo) return;
    var paint = function () {
      if (!S || curItem() !== it) return;
      var b = S.ov.querySelector('[data-q-card] [data-store-box]'); if (!b) return;
      var st = it.store;
      if (!st || !st.loaded) { b.innerHTML = '<div style="font-size:12px;color:#526077">🛒 جارٍ قراءة المكتوب في المتجر…</div>'; return; }
      if (!st.info) { b.innerHTML = '<div style="font-size:12px;color:#526077">🛒 غير مربوط بمنتجٍ في المتجر — يُحفظ في الجرد وحده (اربطه من «الجسر»).</div>'; return; }
      var mine = (sval(asObj(it.p.specs).__desc) || (it.res && it.res.desc) || '').split('\n').map(function (x) { return x.trim(); });
      var lines = String(st.info.description || '').split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x && mine.indexOf(x) === -1; });
      b.innerHTML = '<span style="display:block;font-size:11.5px;font-weight:800;color:#526077;margin-bottom:4px">🛒 المكتوب في المتجر الآن — يُحفظ تحت وصفك؛ احذف ما لا تريده' + ((st.info.specs || []).length ? ' · (جدول المتجر الحالي ' + st.info.specs.length + ' صفّاً يُستبدل بجدولك)' : '') + '</span>' +
        (lines.length ? lines.map(function (l) { return '<div data-store-line style="display:flex;gap:6px;margin-bottom:5px;align-items:flex-start"><span data-t style="flex:1;min-width:0;background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:6px 8px;font-size:12.5px;overflow-wrap:anywhere">' + esc(l) + '</span><button type="button" data-store-del style="border:0;background:#fee2e2;color:#b91c1c;border-radius:8px;padding:5px 9px;cursor:pointer">✕</button></div>'; }).join('')
          : '<div style="font-size:12px;color:#526077">لا وصف مكتوب في المتجر.</div>');
    };
    if (it.store) return paint();
    it.store = { loaded: false }; paint();
    Promise.resolve().then(function () { return S.storeInfo(it.p); }).then(function (info) { it.store = { loaded: true, info: info || null }; paint(); }, function () { it.store = { loaded: true, info: null }; paint(); });
  }
  function againHTML() {
    return '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;font-weight:800;color:#0f1219">🔁 أعد البحث برابطٍ أو ملاحظة</summary>' +
      '<input data-again-url dir="ltr" placeholder="https://www.alibaba.com/product-detail/…" style="width:100%;box-sizing:border-box;margin-top:6px;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font:inherit;font-size:12px">' +
      '<input data-again-hint placeholder="ملاحظة: اسم أو موديل أدقّ" style="width:100%;box-sizing:border-box;margin-top:6px;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font:inherit;font-size:12px">' +
      '<button type="button" data-act="again" style="' + btn('#0f1219', '#fff') + ';margin-top:6px;font-size:12px;padding:7px 12px">أعد البحث (يعود لأوّل الطابور)</button></details>';
  }
  /* البحث بنفسك: صفحة نتائج علي بابا / صور Google باسم المنتج — تجد صفحته فتلصق رابطها في «🔁 أعد البحث» */
  function selfSearch(p) {
    var q = encodeURIComponent(String(p.name || '').replace(/\s+/g, ' ').trim());
    var a = 'display:inline-block;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;font-size:12px;font-weight:800;color:#0f1219;text-decoration:none;background:#fff';
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:11.5px;color:#526077">ابحث بنفسك: ' +
      '<a target="_blank" rel="noopener" href="https://www.alibaba.com/trade/search?SearchText=' + q + '" style="' + a + '">علي بابا ↗</a>' +
      '<a target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=' + q + '" style="' + a + '">صور Google ↗</a></div>';
  }
  function btn(bg, fg) { return 'border:0;background:' + bg + ';color:' + fg + ';border-radius:10px;padding:10px 14px;font:inherit;font-weight:900;cursor:pointer'; }
  function mergeAlt(cur, add) {
    var list = String(cur || '').split(/[،,|·\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    (add || []).forEach(function (a) { a = String(a || '').trim(); if (a && !list.some(function (x) { return x.toLowerCase() === a.toLowerCase(); })) list.push(a); });
    return list.join('، ');
  }
  function readCard() {
    var box = S.ov.querySelector('[data-q-card]'), v = function (k) { var el = box.querySelector('[data-f="' + k + '"]'); return el ? el.value.trim() : ''; };
    var rows = [].map.call(box.querySelectorAll('[data-spec-row]'), function (row) { return { k: row.querySelector('[data-k]').value.trim(), v: row.querySelector('[data-v]').value.trim(), orig: row.getAttribute('data-orig') || '' }; })
      .filter(function (s) { return s.k && s.v; });
    var it = curItem(), sl = box.querySelector('[data-store-box] [data-store-line]') || (it && it.store && it.store.loaded && it.store.info) ? [].map.call(box.querySelectorAll('[data-store-box] [data-store-line] [data-t]'), function (x) { return x.textContent.trim(); }).join('\n') : null;
    return { name_en: v('name_en'), brand: v('brand'), model: v('model'), alt: v('alt'), desc: v('desc'), compat: v('compat'), rows: rows, storeDesc: sl };
  }
  /* (TASK-0183) ما في البطاقة لمنتجٍ جاهز لم تفتحه: نتيجة العقل كما هي (كما كانت ستظهر لك) */
  function cardFromRes(it) {
    var r = it.res || {};
    return { name_en: String(r.name_en || '').trim(), brand: String(r.brand || it.p.brand || '').trim(), model: String(r.model || '').trim(),
             alt: mergeAlt(it.p.alt_names, [r.name_en, r.model].concat(r.aliases_ar || [], r.aliases_en || [])), desc: (sval(asObj(it.p.specs).__desc) || String(r.desc || '')).trim(),
             compat: String(r.compat || '').trim(), rows: specRows(it.p, r), storeDesc: null };
  }
  /* (TASK-0183 · المالك seq 115 «بعد ما أعمل حفظ للجميع ما في زرّ حفظ … أغلقت الأداة وما حفظ شيء») — حفظ كل الجاهز دفعةً واحدة:
     المفتوح أمامك بما عدّلتَه فيه، والبقيّة بما جهّزه العقل. ما لا يطابق اسم منتجك (⚠️) لا يُحفظ معها — يبقى لمراجعتك */
  async function saveAll() {
    if (!S || S.savingAll) return { ok: 0, left: 0, fail: [], warns: [] };
    var s = S, cur = curItem(), list = s.items.filter(function (x) { return x.st === 'ready'; });
    var mism = list.filter(function (x) { return missingTokens(x.p, x.res).length; }), go = list.filter(function (x) { return mism.indexOf(x) === -1; });
    var sa = s.ov && s.ov.querySelector('[data-q-saveall]'), ok = 0, fail = [], warns = [];
    s.savingAll = true;
    var curF = cur && cur.st === 'ready' ? readCard() : null;
    for (var i = 0; i < go.length; i++) {
      var it = go[i];
      if (sa) { sa.disabled = true; sa.textContent = '💾 جارٍ الحفظ ' + (i + 1) + '/' + go.length + '…'; }
      try {
        var ff = it === cur && curF ? curF : cardFromRes(it), patch = buildPatch(it, ff);
        var r = await s.save(it.p, patch, { storeDesc: ff.storeDesc });
        if (r && r.error) throw new Error(r.error);
        if (r && r.warn) warns.push(it.p.name + ': ' + r.warn);
        Object.assign(it.p, patch); if (s.onSaved) s.onSaved(it.p, patch);
        it.st = 'saved'; ok++;
      } catch (e) { fail.push(it.p.name + ': ' + ((e && e.message) || e)); }
      persist();
    }
    s.savingAll = false;
    if (S === s) { if (cur && cur.st === 'saved') nextReady(); render(); }
    return { ok: ok, left: mism.length, fail: fail, warns: warns };
  }
  function saveAllMsg(r) {
    return '✅ حُفظ ' + r.ok + (r.left ? ' · ⚠️ ' + r.left + ' لا تطابق اسم المنتج تُركت لمراجعتك' : '') + (r.fail.length ? ' · ❌ تعذّر ' + r.fail.length + ': ' + r.fail.slice(0, 2).join(' / ') : '') +
      ((r.warns || []).length ? ' · ⚠️ المتجر لم يُحدَّث لـ' + r.warns.length + ': ' + r.warns[0] : '');
  }
  /* الحفظ: أعمدة SQL ٢١/٢٧ نفسها التي تكتبها «مواصفات من علي بابا» — المواصفات (+__desc/__brand/__model) · التوافق · كلمات البحث ·
     الماركة · الأسماء البديلة · المصدر ومن راجع ومتى */
  function buildPatch(it, f) {
    var base = asObj(it.p.specs), specs = {};
    Object.keys(base).forEach(function (k) { if (k.indexOf('__') === 0) specs[k] = base[k]; });      // الوصف/الماركة/الموديل المحفوظة تبقى ما لم تُستبدل
    f.rows.forEach(function (s) {
      if (s.orig && Object.prototype.hasOwnProperty.call(base, s.orig) && s.k === s.orig && sval(base[s.orig]) === s.v) specs[s.orig] = base[s.orig];   // كما هي (ولو مصفوفة)
      else specs[s.k.slice(0, 60)] = s.v.slice(0, 300);
    });
    if (f.desc) specs.__desc = f.desc.slice(0, 2000);
    if (f.brand) specs.__brand = f.brand;
    if (f.model) specs.__model = f.model;
    var terms = [it.p.search_terms, f.name_en, f.model, f.brand].filter(Boolean).join(' ');
    var seen = {}; terms = terms.split(/\s+/).filter(function (w) { var k = w.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).join(' ').slice(0, 500);
    return { specs: specs, compat: f.compat.slice(0, 1000) || null, search_terms: terms || null, brand: f.brand || it.p.brand || null,
             alt_names: mergeAlt(f.alt, [f.name_en, f.model]).slice(0, 500) || null,      // الاسم الإنجليزي كما عدّلتَه يُبحث به أيضاً
             specs_source: (it.res && it.res.source) || (it.res && it.res.from_memory ? 'ai-memory' : 'alibaba'),
             specs_checked_at: new Date().toISOString(), specs_checked_by: S.operator || 'عقل النظام' };
  }
  async function imageTo(it, url, file, where) {
    var msg = S.ov.querySelector('[data-img-msg]'), say = function (t, ok) { if (msg) { msg.style.color = ok ? '#15803d' : '#b91c1c'; msg.textContent = t; } };
    try {
      say('لحظة…', true);
      if (where === 'store') {
        if (!url && file) { var up0 = await S.upload(file, 'store'); url = up0; }
        await S.storeAddImages(it.p, [url]); say('✅ أُضيفت لصور المنتج في المتجر', true); return;
      }
      var blob = file || await imgBlob(url);
      if (!blob) throw new Error('تعذّر تنزيل الصورة — جرّب صورةً أخرى أو ارفعها من جهازك');
      var pub = await S.upload(blob, 'inv');
      var r = await S.save(it.p, { image_url: pub });
      if (r && r.error) throw new Error(r.error);
      it.p.image_url = pub; if (S.onSaved) S.onSaved(it.p, { image_url: pub });
      say('✅ صارت الصورة الرئيسية في الجرد', true);
      /* صورة المنتج في رأس البطاقة وحدها (كان «أوّل صورة في البطاقة»: منتجٌ بلا صورة ⇒ تُستبدل أوّل صورةٍ مرشّحة فتختفي من القائمة) */
      var im = S.ov.querySelector('[data-q-card] [data-q-main-img]'); if (im) im.src = pub;
    } catch (e) { say('❌ ' + ((e && e.message) || e)); }
  }
  async function onCardClick(e) {
    var it = curItem(); if (!it) return;
    var t = e.target.closest('button, [data-img-file]'); if (!t) return;
    var box = S.ov.querySelector('[data-q-card]');
    if (t.hasAttribute('data-row-add')) { box.querySelector('[data-rows]').insertAdjacentHTML('beforeend', rowHTML({ k: '', v: '' })); return; }
    if (t.hasAttribute('data-row-del')) { t.closest('[data-spec-row]').remove(); return; }
    if (t.hasAttribute('data-store-del')) { t.closest('[data-store-line]').remove(); return; }
    if (t.hasAttribute('data-img-main')) return imageTo(it, t.getAttribute('data-img-main'), null, 'inv');
    if (t.hasAttribute('data-img-store')) return imageTo(it, t.getAttribute('data-img-store'), null, 'store');
    if (t.hasAttribute('data-img-store-picked')) {
      var urls = [].map.call(box.querySelectorAll('[data-img-pick]:checked'), function (c) { return c.getAttribute('data-img-pick'); });
      var m1 = box.querySelector('[data-img-msg]');
      if (!urls.length) { if (m1) { m1.style.color = '#b91c1c'; m1.textContent = 'علّم الصور أوّلاً (٥–٦)'; } return; }
      try { if (m1) { m1.style.color = '#15803d'; m1.textContent = 'لحظة…'; } await S.storeAddImages(it.p, urls); if (m1) m1.textContent = '✅ أُضيفت ' + urls.length + ' صور لصور المنتج في المتجر'; }
      catch (e2) { if (m1) { m1.style.color = '#b91c1c'; m1.textContent = '❌ ' + ((e2 && e2.message) || e2); } }
      return;
    }
    if (t.hasAttribute('data-img-url-main') || t.hasAttribute('data-img-url-store')) {
      var u = (box.querySelector('[data-img-url]') || {}).value || ''; u = u.trim();
      if (!/^https:\/\//i.test(u)) { var m0 = box.querySelector('[data-img-msg]'); if (m0) { m0.style.color = '#b91c1c'; m0.textContent = 'الصق رابط صورةٍ يبدأ بـ https://'; } return; }
      return imageTo(it, u, null, t.hasAttribute('data-img-url-store') ? 'store' : 'inv');
    }
    var act = t.getAttribute('data-act');
    if (act === 'skip') { it.st = 'skip'; persist(); nextReady(); render(); return; }
    if (act === 'again' || act === 'deep') {
      it.again = { url: ((box.querySelector('[data-again-url]') || {}).value || '').trim(), hint: ((box.querySelector('[data-again-hint]') || {}).value || '').trim(), deep: act === 'deep' };
      it.st = 'wait'; it.res = null; it.retried = false;
      S.items.splice(S.items.indexOf(it), 1); var firstWait = S.items.findIndex(function (x) { return x.st === 'wait'; });
      S.items.splice(firstWait < 0 ? S.items.length : firstWait, 0, it);               // أوّل الانتظار: لا ينتظر الطابور كلّه
      persist(); render(); pump(); return;
    }
    if (act === 'save') {
      var f = readCard(), patch = buildPatch(it, f), msg = box.querySelector('[data-save-msg]');
      t.disabled = true; t.textContent = 'لحظة…';
      try {
        var r = await S.save(it.p, patch, { storeDesc: f.storeDesc });
        if (r && r.error) throw new Error(r.error);
        Object.assign(it.p, patch); if (S.onSaved) S.onSaved(it.p, patch);
        it.st = 'saved'; it.store = null; persist(); nextReady(); render();
        if (global.showToast) showToast(r && r.warn ? '⚠️ ' + r.warn : '✅ حُفظ' + (r && r.store ? ' في الجرد والمتجر (' + r.store.specs + ' مواصفة)' : ' في الجرد'), r && r.warn ? 'error' : 'success');
      } catch (er) { t.disabled = false; t.textContent = '💾 حفظ والتالي'; if (msg) { msg.style.color = '#b91c1c'; msg.textContent = '❌ لم يُحفظ: ' + ((er && er.message) || er); } }
    }
  }
  async function onCardChange(e) {
    var it = curItem(); if (!it || !e.target.hasAttribute('data-img-file')) return;
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var where = S.storeAddImages ? await (global.GMTAsk ? GMTAsk.choose('أين تضع الصورة؟', { title: '🖼️ صورة المنتج', choices: [{ k: 'inv', t: 'الصورة الرئيسية في الجرد' }, { k: 'store', t: 'إضافتها لصور المتجر' }] }) : 'inv') : 'inv';
    if (where) imageTo(it, null, f, where);
    e.target.value = '';
  }

  function open(o) {
    if (!global.GMTBrain || !GMTBrain.importProduct) { if (global.showToast) showToast('عقل النظام لم يُحمَّل في هذه الصفحة', 'error'); return; }
    close(true);
    /* (TASK-0189 · المالك seq 126 «بدّي أرجع أبحث عنها») «أعد التجهيز من جديد»: لا استئناف — كل منتجٍ ينتظر العقل من جديد، والمحفوظ لا يتغيّر إلّا بحفظك */
    var saved = o.fresh ? null : load(), byId = {};
    if (saved && saved.key === o.key) (saved.items || []).forEach(function (x) { byId[String(x.id)] = x; });
    S = { key: o.key, title: o.title, operator: o.operator || '', save: o.save, upload: o.upload, storeAddImages: o.storeAddImages || null, storeInfo: o.storeInfo || null, onSaved: o.onSaved || null, onClose: o.onClose || null,
          items: o.products.map(function (p) { var s0 = byId[String(p.id)] || {}; return { id: p.id, p: p, st: s0.st || 'wait', res: s0.res || null, err: s0.err || '' }; }),
          cur: null, busy: false, paused: false, closed: false };
    var ready = S.items.filter(function (x) { return x.st === 'ready'; })[0]; S.cur = ready ? ready.id : (S.items[0] || {}).id;
    var wide = innerWidth > 820, ov = document.createElement('div');
    ov.id = 'gmt-enrich-q'; ov.setAttribute('data-keep-fab', '1');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147482500;background:rgba(15,18,25,.5);display:flex;align-items:' + (wide ? 'center' : 'flex-end') + ';justify-content:center;direction:rtl;font-family:inherit';
    ov.innerHTML = '<div style="width:100%;max-width:' + (wide ? '1040px' : '100%') + ';height:' + (wide ? '90vh' : '94vh') + ';background:#f8fafc;border-radius:' + (wide ? '22px' : '22px 22px 0 0') + ';display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -20px 60px rgba(15,18,25,.25)">' +
      '<div style="display:flex;gap:8px;align-items:flex-start;padding:12px 14px;border-bottom:1px solid #e2e8f0;background:#fff"><div data-q-head style="flex:1;min-width:0"></div>' +
      '<button type="button" data-q-saveall style="' + btn('#D5001C', '#fff') + ';padding:8px 10px;font-size:12px;display:none"></button>' +
      '<button type="button" data-q-pause style="' + btn('#f1f5f9', '#0f1219') + ';padding:8px 10px;font-size:12px"></button><button type="button" data-q-close style="' + btn('#e2e8f0', '#0f1219') + ';padding:8px 12px;font-size:12px">إغلاق</button></div>' +
      '<div style="flex:1;min-height:0;display:flex;flex-direction:' + (wide ? 'row' : 'column') + '">' +
      '<div data-q-list style="' + (wide ? 'width:300px;border-left:1px solid #e2e8f0;' : 'max-height:22vh;border-bottom:1px solid #e2e8f0;') + 'overflow:auto;padding:8px;display:grid;gap:6px;align-content:start"></div>' +
      '<div data-q-card style="flex:1;min-height:0;overflow:auto;padding:12px 14px"></div></div></div>';
    document.body.appendChild(ov); S.ov = ov;
    ov.querySelector('[data-q-list]').addEventListener('click', function (e) { var b = e.target.closest('[data-q-pick]'); if (!b) return; S.cur = b.getAttribute('data-q-pick'); render(); });
    ov.querySelector('[data-q-card]').addEventListener('click', onCardClick);
    /* (TASK-0040) عدّاد الصور المعلَّمة على زرّ «أضف المحدَّد للمتجر» */
    ov.querySelector('[data-q-card]').addEventListener('change', function (e) {
      if (!e.target.hasAttribute('data-img-pick')) return;
      var box = ov.querySelector('[data-q-card]'), n = box.querySelectorAll('[data-img-pick]:checked').length, el = box.querySelector('[data-img-n]'); if (el) el.textContent = n;
      var tile = e.target.closest('[data-img-tile]'); if (tile) tile.style.borderColor = e.target.checked ? '#047857' : '#e2e8f0';
    });
    ov.querySelector('[data-q-card]').addEventListener('change', onCardChange);
    ov.querySelector('[data-q-pause]').addEventListener('click', function () { S.paused = !S.paused; render(); if (!S.paused) pump(); });
    ov.querySelector('[data-q-close]').addEventListener('click', function () { closeAsk(); });
    ov.querySelector('[data-q-saveall]').addEventListener('click', async function () {
      var r = await saveAll(); if (global.showToast) showToast('🧠 ' + saveAllMsg(r), r.fail.length ? 'error' : 'success');
    });
    render(); pump();
    return S;
  }
  /* (TASK-0183 · seq 115) «إغلاق» وفي الطابور ما جهز ولم يُحفظ ⇒ لا يضيع بصمت: احفظه كلّه ثمّ أغلق · أو أغلق (يبقى على هذا الجهاز) · أو رجوع */
  async function closeAsk() {
    if (!S) return;
    var n = counts().ready;
    if (!n || !global.GMTAsk) return close();
    var k = await GMTAsk.choose('عندك ' + n + ' منتج جاهز لم يُحفظ بعد في الجرد.\nنحفظها كلّها الآن (المفتوح بما عدّلتَه فيه) ثمّ نغلق؟', {
      title: '💾 قبل الإغلاق', cancelText: 'رجوع',
      choices: [{ k: 'save', t: 'احفظها كلها وأغلق', pri: 1 }, { k: 'close', t: 'أغلق بلا حفظ (تبقى على هذا الجهاز)' }] });
    if (!S) return;
    if (k === 'save') { var r = await saveAll(); if (global.showToast) showToast('🧠 ' + saveAllMsg(r), r.fail.length ? 'error' : 'success'); if (r.fail.length || r.left) return; close(true); return; }
    if (k === 'close') close();
  }
  function close(silent) {
    if (!S) return;
    S.closed = true; persist();
    if (S.ov) S.ov.remove();
    if (!silent && global.showToast) { var c = counts(); showToast('🧠 أُغلقت الأداة — ما جهزه العقل محفوظ على هذا الجهاز (' + c.ready + ' بانتظار مراجعتك)، وتكمل من حيث توقّفت', 'info'); }
    var oc = S.onClose; S = null; try { if (oc) oc(); } catch (_) {}
  }
  /* اختيار المجموعة/التصنيف — قائمةٌ قابلة للبحث (المجموعات كثيرة: نافذة الأزرار لا تتّسع لها) ·
     opts.sections = [{ title, items: [{ k, t, n, left }] }] ⇒ { k, onlyLeft, fresh, filters } أو null
     (TASK-0189) opts.filters = [{ k, label, options: [[قيمة, نصّ]…] }] + opts.build(قيم) ⇒ sections: الفلتر نفسه الذي في قائمة الجرد يعيد حساب الأقسام وأعدادها */
  function pick(opts) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div'); ov.id = 'gmt-enrich-pick'; ov.setAttribute('data-keep-fab', '1');
      var wide = innerWidth > 700;
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147482600;background:rgba(15,18,25,.5);display:flex;align-items:' + (wide ? 'center' : 'flex-end') + ';justify-content:center;direction:rtl;font-family:inherit';
      ov.innerHTML = '<div style="width:100%;max-width:520px;max-height:' + (wide ? '86vh' : '90vh') + ';display:flex;flex-direction:column;background:#fff;border-radius:' + (wide ? '22px' : '22px 22px 0 0') + ';overflow:hidden">' +
        '<div style="padding:14px 16px 8px"><b style="font-size:16px;display:block">🧠 تجهيز المنتجات تلقائياً</b><span style="font-size:12.5px;color:#526077;line-height:1.7;display:block;margin-top:2px">' + esc(opts.message || '') + '</span>' +
        '<input data-pq type="search" placeholder="🔎 ابحث عن مجموعة أو تصنيف" style="width:100%;box-sizing:border-box;margin-top:8px;border:1px solid #e2e8f0;border-radius:12px;padding:9px 12px;font:inherit;font-size:14px">' +
        (opts.filters && opts.filters.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px">' + opts.filters.map(function (f) {
          return '<label style="display:flex;gap:4px;align-items:center;font-size:12.5px;font-weight:800">' + esc(f.label) + '<select data-pf="' + esc(f.k) + '" style="border:1px solid #e2e8f0;border-radius:10px;padding:5px 6px;font:inherit;font-size:12.5px;background:#fff">' +
            f.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(f.value || '') === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }).join('') + '</div>' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><label style="display:flex;gap:6px;align-items:center;font-size:13px;font-weight:800"><input type="checkbox" data-pleft checked> غير المجهَّزة فقط</label>' +
        /* (TASK-0189 · جواب seq 127: زرّ «أعد التجهيز من جديد») */
        '<button type="button" data-pfresh aria-pressed="false" style="' + btn('#f1f5f9', '#0f1219') + ';padding:6px 10px;font-size:12.5px">🔁 أعد التجهيز من جديد</button></div>' +
        '<div data-pfresh-note style="display:none;font-size:12px;color:#b45309;font-weight:800;line-height:1.7;margin-top:6px">🔁 العقل يرجع يبحث عن كل منتجات ما تختاره — حتى المجهَّز والمحفوظ. والمنتج لا يتغيّر إلّا حين تحفظه بعد المراجعة.</div></div>' +
        '<div data-plist style="flex:1;overflow:auto;padding:0 16px 10px"></div>' +
        '<div style="padding:10px 16px 14px;border-top:1px solid #e2e8f0"><button type="button" data-pclose style="' + btn('#f1f5f9', '#0f1219') + ';width:100%">إلغاء</button></div></div>';
      document.body.appendChild(ov);
      var list = ov.querySelector('[data-plist]'), q = ov.querySelector('[data-pq]');
      function draw() {
        var t = q.value.trim().toLowerCase();
        list.innerHTML = (opts.sections || []).map(function (sec) {
          var its = sec.items.filter(function (x) { return !t || String(x.t).toLowerCase().indexOf(t) !== -1; });
          if (!its.length) return '';
          return '<div style="font-size:11.5px;font-weight:900;color:#526077;margin:10px 0 6px">' + esc(sec.title) + '</div>' + its.map(function (x) {
            return '<button type="button" data-pk="' + esc(x.k) + '" style="display:flex;gap:8px;align-items:center;width:100%;text-align:right;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px 12px;margin-bottom:6px;font:inherit;cursor:pointer">' +
              '<span style="flex:1;min-width:0;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.t) + '</span>' +
              '<span style="font-size:11.5px;color:#526077;white-space:nowrap">' + x.n + ' منتج' + (x.left != null ? ' · غير مجهَّز ' + x.left : '') + '</span></button>'; }).join('');
        }).join('') || '<div style="padding:20px;text-align:center;color:#526077">لا نتائج</div>';
      }
      function done(v) { ov.remove(); resolve(v); }
      function vals() { var o = {}; [].forEach.call(ov.querySelectorAll('[data-pf]'), function (x) { o[x.getAttribute('data-pf')] = x.value; }); return o; }
      var fresh = false, fb = ov.querySelector('[data-pfresh]'), pl = ov.querySelector('[data-pleft]');
      fb.addEventListener('click', function () {
        fresh = !fresh; fb.setAttribute('aria-pressed', fresh ? 'true' : 'false');
        fb.style.background = fresh ? '#b45309' : '#f1f5f9'; fb.style.color = fresh ? '#fff' : '#0f1219';
        pl.disabled = fresh; if (fresh) pl.checked = false;
        ov.querySelector('[data-pfresh-note]').style.display = fresh ? 'block' : 'none';
      });
      [].forEach.call(ov.querySelectorAll('[data-pf]'), function (x) { x.addEventListener('change', function () { if (opts.build) { opts.sections = opts.build(vals()); draw(); } }); });
      q.addEventListener('input', draw);
      list.addEventListener('click', function (e) { var b = e.target.closest('[data-pk]'); if (b) done({ k: b.getAttribute('data-pk'), onlyLeft: !fresh && pl.checked, fresh: fresh, filters: vals() }); });
      ov.querySelector('[data-pclose]').addEventListener('click', function () { done(null); });
      ov.addEventListener('click', function (e) { if (e.target === ov) done(null); });
      draw();
    });
  }
  global.GMTEnrichQueue = { open: open, close: close, closeAsk: closeAsk, saveAll: saveAll, pick: pick, _nameTokens: nameTokens, _missingTokens: missingTokens, state: function () { return S; }, _enrichOne: enrichOne, _mergeAlt: mergeAlt };
})(typeof window !== 'undefined' ? window : this);
