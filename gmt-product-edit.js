/* ═══════════════════════════════════════════════════════════════════════════
   gmt-product-edit.js — صفحة تعديل كلّ بيانات المنتج: الجرد · الأسعار · جدول المواصفات · المتجر
   أُنشئ: 2026-10-27 · TASK-0201 (المالك seq 133) — للأدمن فقط

   طلبُك: «صفحه تعديل بيانات المنتج … بعدل فيه كل شيء سواء في المتجر او في الجرد او في الجدول او في الفئه او في فئته في المتجر
   او في الاسامي الاخرى او في تصنيف او كل شيء كل شيء كل شيء عنه حتى الاسعار».
   صفحةٌ واحدة (ملء الشاشة) بأقسام:
     ① الجرد: الاسم · المختصر · الباركود · المجموعة · التصنيف · الماركة · الأسماء الأخرى (تُضاف لكلمات البحث)
     ② الأسعار: البيع · الجملة · الحدّ الأدنى (والتكلفة للقراءة — تكتبها فواتير الشراء) · وسعر المتجر (أو «مثل سعر البيع»)
     ③ جدول المواصفات: صفوفٌ تُعدَّل وتُضاف وتُحذف · الوصف · الموديل · التوافق
     ④ المتجر (إن كان مربوطاً): الاسم فيه · أقسامه · وصفه · صوره (ترتيب · حذف · إضافة · «صورة الجرد»)
   «💾 احفظ» يكتب ما تغيّر فقط: الجرد عبر دالّة الصفحة (saveInv) ثمّ منتج المتجر المربوط بكتابةٍ مشروطة واحدة (GMTSpecs.pushToStore).
   الكميات لا تُعدَّل من هنا (لها النقل والجرد وإعادة الإنشاء).

   GMTProductEdit.open(p, { saveInv(patch) ⇒ Promise<{error}>, groups, categories, onSaved(p2) })
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTProductEdit) return;
  var doc = global.document;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function asObj(sp) { if (!sp) return {}; if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch (_) { return {}; } } return (sp && typeof sp === 'object' && !Array.isArray(sp)) ? sp : {}; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function storeDb() { return global.GMT_DB && GMT_DB.STORE && GMT_DB.STORE.url ? GMT_DB.STORE : null; }
  async function storeRec() {
    var D = storeDb(); if (!D) return null;
    var r = await fetch(D.url + '/rest/v1/gmt_store?id=eq.1&select=categories,products', { headers: { apikey: D.key, Authorization: 'Bearer ' + D.key } });
    if (!r.ok) throw new Error('المتجر HTTP ' + r.status);
    return (await r.json())[0] || null;
  }
  /* (TASK-0233 · المالك seq 161) «… وايضا تتعبى هي الماركه تلقائيا»: الماركة الفارغة تُستنتج من الاسم والأسماء الأخرى وجدول المواصفات —
     من ماركات منتجاتك الموجودة (ctx.brands) + قائمة الماركات الشائعة · وبالعربية (كانون · سوني …). تُكتب في الحقل «تلقائياً» قابلةً للتعديل. */
  var BRANDS = ['Canon', 'Sony', 'Nikon', 'Fujifilm', 'Panasonic', 'Olympus', 'Leica', 'Godox', 'SanDisk', 'Lexar', 'Kingston', 'Samsung', 'Sigma', 'Tamron', 'Tokina', 'Viltrox',
    'Yongnuo', 'Meike', '7artisans', 'DJI', 'Zhiyun', 'GoPro', 'Insta360', 'Rode', 'Boya', 'Saramonic', 'Hollyland', 'Manfrotto', 'Benro', 'Ulanzi', 'SmallRig', 'Neewer',
    'Aputure', 'Profoto', 'Elinchrom', 'Westcott', 'Nanlite', 'Jinbei', 'Hoya', 'K&F Concept', 'Epson', 'HP', 'Peak Design', 'Lowepro', 'Vanguard', 'Feiyu', 'Moza', 'Sirui'];
  var AR = { 'كانون': 'Canon', 'كانن': 'Canon', 'سوني': 'Sony', 'نيكون': 'Nikon', 'فوجي': 'Fujifilm', 'فوجي فيلم': 'Fujifilm', 'باناسونيك': 'Panasonic', 'غودوكس': 'Godox', 'جودوكس': 'Godox',
    'قودوكس': 'Godox', 'سانديسك': 'SanDisk', 'سان ديسك': 'SanDisk', 'ليكسار': 'Lexar', 'كينغستون': 'Kingston', 'سامسونغ': 'Samsung', 'سيغما': 'Sigma', 'سيجما': 'Sigma', 'تامرون': 'Tamron',
    'يونغنو': 'Yongnuo', 'دي جي آي': 'DJI', 'ژيون': 'Zhiyun', 'زيون': 'Zhiyun', 'غوبرو': 'GoPro', 'رود': 'Rode', 'بويا': 'Boya', 'مانفروتو': 'Manfrotto', 'أولانزي': 'Ulanzi', 'سمول ريغ': 'SmallRig', 'نيوير': 'Neewer' };
  function guessBrand(p, known) {
    p = p || {}; var sp = asObj(p.specs);
    var direct = String(p.brand || sp.__brand || sp['الماركة'] || sp['العلامة التجارية'] || sp.Brand || sp.brand || '').trim();
    if (direct) return direct;
    var list = [], seen = {};
    [].concat(known || [], BRANDS).forEach(function (b) { b = String(b || '').trim(); var k = b.toLowerCase(); if (b && b.length > 1 && !seen[k]) { seen[k] = 1; list.push(b); } });
    list.sort(function (a, b) { return b.length - a.length; });      // الأطول أوّلاً («K&F Concept» قبل «K»)
    var hay = [p.name, p.short, p.alt_names, p.search_terms].filter(Boolean).join(' · ');
    for (var i = 0; i < list.length; i++) {
      var b = list[i], re = new RegExp('(^|[^A-Za-z0-9])' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9])', 'i');
      if (re.test(hay)) return b;
    }
    var ar = Object.keys(AR).sort(function (a, b) { return b.length - a.length; });
    for (var j = 0; j < ar.length; j++) if (hay.indexOf(ar[j]) !== -1) return AR[ar[j]];
    return '';
  }
  /* كتابةٌ مشروطة على الكتالوج الطازج (updated_at) — كالجسر: mut(products) ⇒ مصفوفةٌ جديدة أو null (لا كتابة) */
  async function storeWrite(mut) {
    var D = storeDb(); if (!D) throw new Error('قاعدة المتجر غير مهيّأة');
    var H = { apikey: D.key, Authorization: 'Bearer ' + D.key };
    for (var i = 0; i < 3; i++) {
      var r = await fetch(D.url + '/rest/v1/gmt_store?id=eq.1&select=id,products,updated_at', { headers: H });
      if (!r.ok) throw new Error('المتجر HTTP ' + r.status);
      var rec = (await r.json())[0]; if (!rec) throw new Error('سجلّ المتجر غير موجود');
      var next = mut((Array.isArray(rec.products) ? rec.products : []).slice()); if (!next) return null;
      var u = D.url + '/rest/v1/gmt_store?id=eq.1&select=id', body = { products: next };
      if ('updated_at' in rec) { u += rec.updated_at ? '&updated_at=eq.' + encodeURIComponent(rec.updated_at) : '&updated_at=is.null'; body.updated_at = new Date().toISOString(); }
      var w = await fetch(u, { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, H), body: JSON.stringify(body) });
      if (!w.ok) throw new Error('حفظ المتجر HTTP ' + w.status);
      var rows = await w.json().catch(function () { return null; });
      if (Array.isArray(rows) && rows.length) { try { localStorage.removeItem('sbc_store'); } catch (_) {} return next; }
    }
    throw new Error('الكتالوج يتغيّر من جهةٍ أخرى — أعد المحاولة');
  }
  function storePageUrl(id) { try { return new URL('store.html', global.location.href).href + '#product=' + encodeURIComponent(id); } catch (_) { return 'store.html#product=' + encodeURIComponent(id); } }
  function isHttp(u) { return /^https?:\/\//i.test(String(u || '')); }
  function realImg(u) { return global.GMTUtil && GMTUtil.imgUrl ? GMTUtil.imgUrl(u) : String(u || '').trim(); }   // (TASK-0258) رابط نتيجة غوغل ⇒ الصورة
  function css() {
    if (doc.getElementById('gmt-pe-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-pe-css';
    s.textContent =
      '#gmt-pe{position:fixed;inset:0;z-index:2147483100;background:#f3f4f6;display:flex;flex-direction:column;direction:rtl;font-family:Cairo,Tajawal,system-ui,sans-serif;color:#0f1219}' +
      '#gmt-pe .pe-top{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #e5e7eb}' +
      '#gmt-pe .pe-top b{flex:1;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#gmt-pe button{font:inherit;font-weight:800;cursor:pointer;border-radius:10px;border:1px solid #e5e7eb;background:#fff;padding:8px 12px;font-size:13px}' +
      '#gmt-pe button.p{background:#D5001C;border-color:#D5001C;color:#fff}#gmt-pe button:disabled{opacity:.5}' +
      '#gmt-pe .pe-body{flex:1;overflow:auto;padding:12px;display:grid;gap:12px;align-content:start;max-width:980px;width:100%;margin:0 auto;box-sizing:border-box}' +
      '@media(min-width:900px){#gmt-pe .pe-body{grid-template-columns:1fr 1fr}#gmt-pe .pe-wide{grid-column:1/-1}}' +
      '#gmt-pe section{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:12px}' +
      '#gmt-pe h3{margin:0 0 10px;font-size:14px;font-weight:900}' +
      '#gmt-pe label{display:block;font-size:12px;font-weight:800;color:#374151;margin-bottom:8px}' +
      '#gmt-pe input,#gmt-pe textarea,#gmt-pe select{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:#fff;color:inherit}' +
      '#gmt-pe input[type=checkbox]{display:inline-block;width:auto;margin:0 0 0 6px}' +
      '#gmt-pe .pe-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '#gmt-pe .pe-row{display:grid;grid-template-columns:1fr 1.4fr auto auto;gap:6px;margin-bottom:6px;align-items:center}#gmt-pe .pe-row input{margin:0}' +
      '#gmt-pe .pe-row [data-rax]{font-weight:900;color:#9ca3af}#gmt-pe .pe-row [data-rax][aria-pressed="true"]{color:#b45309;background:#fffbeb;border-color:#fcd34d}' +
      '#gmt-pe .pe-imgs{display:flex;flex-wrap:wrap;gap:8px}#gmt-pe .pe-img{width:92px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#f9fafb}' +
      '#gmt-pe .pe-img img{width:92px;height:92px;object-fit:cover;display:block}#gmt-pe .pe-img div{display:flex;justify-content:space-between}#gmt-pe .pe-img button{border:0;border-radius:0;padding:4px 8px;background:transparent}' +
      '#gmt-pe .pe-cats{display:flex;flex-wrap:wrap;gap:6px}#gmt-pe .pe-cats label{display:inline-flex;align-items:center;border:1px solid #e5e7eb;border-radius:999px;padding:5px 10px;margin:0;font-weight:700}' +
      '#gmt-pe .pe-note{font-size:12px;color:#6b7280;line-height:1.7;margin:4px 0 0}#gmt-pe .pe-msg{font-size:12.5px;font-weight:800;padding:0 12px 8px;min-height:18px}' +
      '#gmt-pe h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap}#gmt-pe h3 button{margin-inline-start:auto;font-size:12px;padding:6px 10px}' +
      '#gmt-pe [data-auto="1"]{border-color:#93c5fd;background:#eff6ff}#gmt-pe .pe-auto{font-size:11px;font-weight:800;color:#1d4ed8;margin-inline-start:6px}' +
      '#gmt-pe .pe-invimg{display:flex;gap:8px;align-items:center}#gmt-pe .pe-invimg img{width:56px;height:56px;object-fit:contain;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;flex-shrink:0}' +
      '#gmt-pe .pe-btns{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 8px}#gmt-pe .pe-btns a,#gmt-pe .pe-btns button{font-size:12px;font-weight:800;padding:6px 10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#0f1219;text-decoration:none}' +
      '#gmt-pe .pe-btns a[aria-disabled="true"]{opacity:.45;pointer-events:none}' +
      '#gmt-pe .pe-up{display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;padding:6px 10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;margin:0;flex:1 1 auto}' +
      '#gmt-pe .pe-imglink{display:flex;gap:6px;flex:1 1 100%;align-items:center}#gmt-pe .pe-imglink input{flex:1;min-width:0;margin:0;font-size:12.5px}#gmt-pe .pe-imglink button{flex:0 0 auto}' +
      '#gmt-pe .pe-search{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px}#gmt-pe .pe-search button,#gmt-pe .pe-search a{flex:1 1 auto;text-align:center}#gmt-pe .pe-search [data-pe-auto]{background:#0f172a;border-color:#0f172a;color:#fff}' +
      '#gmt-pe .pe-sugg{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}#gmt-pe .pe-sugg figure{margin:0;width:96px;flex-shrink:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff}' +
      '#gmt-pe .pe-sugg img{width:96px;height:96px;object-fit:contain;display:block;background:#f9fafb}#gmt-pe .pe-sugg figure button{display:block;width:100%;border:0;border-top:1px solid #f1f5f9;border-radius:0;padding:5px 4px;font-size:11px}' +
      '#gmt-pe .pe-cand{display:flex;gap:8px;align-items:center;border:1px solid #e5e7eb;border-radius:12px;padding:6px;margin-top:6px;background:#fff}#gmt-pe .pe-cand img{width:44px;height:44px;object-fit:contain;border-radius:8px;background:#f9fafb;flex-shrink:0}' +
      '#gmt-pe .pe-cand span{flex:1;min-width:0;font-size:12.5px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#gmt-pe .pe-cand small{display:block;font-weight:700;color:#6b7280}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  function open(p, ctx) {
    ctx = ctx || {};
    if (!p) return null;
    css(); var old = doc.getElementById('gmt-pe'); if (old) old.remove();
    /* (TASK-0241 · المالك seq 164) «ما طلبت تحذف كل شيء تقريبا … يعطيني اشاره عليها انه تقريبي لكن ما تنكتب كلمه تقريب»:
       كانت البنود التقديريّة تُخفى هنا **فيحذفها الحفظ**. الآن تظهر كلّها بقيمتها نظيفةً (بلا الكلمة) ومعها زرّ «≈» مُفعَّل —
       أطفئه بعد التأكّد. الحفظ يُبقي القيمة ويكتب العلامة في specs.__approx لا في النصّ. */
    var sp0 = asObj(p.specs);
    var rows0 = global.GMTSpecs && GMTSpecs.rows ? GMTSpecs.rows(sp0).map(function (r) { return { k: r.key, v: r.value, ax: r.approx }; })
      : Object.keys(sp0).filter(function (k) { return k.indexOf('__') !== 0; }).map(function (k) { return { k: k, v: String(sp0[k]), ax: false }; });
    var root = doc.createElement('div'); root.id = 'gmt-pe'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('data-keep-fab', '1');
    var dl = function (id, list) { return '<datalist id="' + id + '">' + (list || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'; };
    root.innerHTML =
      '<div class="pe-top"><button type="button" data-pe-x aria-label="إغلاق">✕</button><b>✏️ تعديل المنتج — ' + esc(p.name) + '</b>' +
        (ctx.onQuick ? '<button type="button" data-pe-quick title="الكميّات في الفروع — النافذة السريعة">📦 الكميّات</button>' : '') +
        '<button type="button" class="p" data-pe-save>💾 احفظ</button></div>' +
      '<div class="pe-msg" role="status" data-pe-msg></div>' +
      '<div class="pe-body">' +
        '<section><h3>📦 الجرد</h3>' +
          '<label>الاسم<input data-f="name" value="' + esc(p.name) + '"></label>' +
          '<div class="pe-2"><label>الاسم المختصر<input data-f="short" value="' + esc(p.short) + '"></label><label>الباركود<input data-f="barcode" dir="ltr" value="' + esc(p.barcode) + '"></label></div>' +
          '<div class="pe-2"><label>المجموعة<input data-f="group_name" list="pe-groups" value="' + esc(p.group_name) + '"></label><label>التصنيف<input data-f="category" list="pe-cats" value="' + esc(p.category) + '"></label></div>' +
          dl('pe-groups', ctx.groups) + dl('pe-cats', ctx.categories) +
          '<label>الماركة<span class="pe-auto" data-pe-brandnote hidden>🔎 تلقائياً — تأكّد</span><input data-f="brand" list="pe-brands" value="' + esc(p.brand || sp0.__brand) + '"></label>' + dl('pe-brands', ctx.brands) +
          '<label>الأسماء الأخرى (عربي وإنجليزي — بينها فاصلة)<textarea data-f="alt_names" rows="2">' + esc(p.alt_names) + '</textarea></label>' +
          '<p class="pe-note">الأسماء الأخرى تُضاف لكلمات البحث: الجرد ونقطة البيع والأوردرات يجدون المنتج بها.</p>' +
          /* (TASK-0233) صورة الجرد هنا أيضاً — كانت في نافذة «تعديل المنتج» وحدها */
          '<label>صورة الجرد (رابط)<div class="pe-invimg"><img data-pe-invprev alt="" src="' + esc(p.image_url) + '"' + (p.image_url ? '' : ' hidden') + '><input data-f="image_url" dir="ltr" placeholder="https://…" value="' + esc(p.image_url) + '"></div></label>' +
          /* (TASK-0247 · المالك seq 165) «في هذه الصفحة فيني ابحث عن صور من غوغل» · (TASK-0245 · seq 164) «البحث على جوجل باستخدام الصوره … في العدسه» */
          '<div class="pe-btns"><a data-pe-gimg target="_blank" rel="noopener">🔍 صور من غوغل</a><a data-pe-lens target="_blank" rel="noopener" title="بحث بالصورة (عدسة غوغل) — يحتاج صورةً برابط https">🔎 عدسة غوغل</a></div>' +
          '<p class="pe-note">من غوغل: افتح الصورة ⇐ «نسخ عنوان الصورة» ⇐ الصقه في الحقل أعلاه (أو في صور المتجر).</p>' +
          '<div data-pe-suggbox hidden><div style="font-size:12px;font-weight:800;color:#374151;margin:8px 0 6px">🖼️ صور وجدها البحث التلقائي</div><div class="pe-sugg" data-pe-sugg></div></div>' +
        '</section>' +
        '<section><h3>💲 الأسعار</h3>' +
          '<div class="pe-2"><label>سعر البيع $<input data-f="price" type="number" step="0.01" min="0" inputmode="decimal" value="' + esc(p.price) + '"></label><label>سعر الجملة $<input data-f="wholesale_price" type="number" step="0.01" min="0" inputmode="decimal" value="' + esc(p.wholesale_price) + '"></label></div>' +
          '<div class="pe-2"><label>الحدّ الأدنى للمخزون<input data-f="min_stock" type="number" step="1" min="0" value="' + esc(p.min_stock) + '"></label><label>التكلفة $ (للقراءة)<input value="' + esc(p.cost_price) + '" disabled></label></div>' +
          '<div data-pe-sprice></div>' +
        '</section>' +
        '<section class="pe-wide"><h3>📋 جدول المواصفات</h3>' +
          /* (TASK-0245 · المالك seq 175 · 176) «من هذه الشاشه … زر اعاده البحث التلقائي والبحث على الصور ايضا عدسه جوجل» · «البحث عن صور المنتج بعدسة غوغل ما لقيته»:
             شريط بحثٍ واحد ظاهر هنا فوق الجدول — لا تحت حقل الصورة وحده */
          '<div class="pe-btns pe-search" data-pe-searchbar>' +
            (global.GMTBrain && GMTBrain.productImportDialog ? '<button type="button" data-pe-auto title="يبحث العقل بصورة المنتج واسمه (علي بابا وغيره) ويعبّئ هذه الصفحة — تراجعها ثمّ تحفظ">🤖 المواصفات التلقائية</button>' : '') +
            '<button type="button" data-pe-lensgo title="يفتح عدسة غوغل بصورة هذا المنتج — صورٌ مشابهة ومصادرها">🔎 عدسة غوغل (بحث بالصورة)</button>' +
            '<a data-pe-gimg2 target="_blank" rel="noopener" title="صور غوغل باسم المنتج وماركته">🔍 صور غوغل</a>' +
            /* (TASK-0256 · seq 178) «ابحث بنفسك … من جهازك … موجوده فقط في تجهيز كل ما ليس لهم مواصفات … وليست موجوده لكل منتج على حده» */
            (global.GMTEnrichQueue && GMTEnrichQueue._search ? '<button type="button" data-pe-webimg title="يبحث في الويب عن صور هذا المنتج ويعرضها لتختار">🖼️ صور من الويب</button>' : '') +
            '<a data-pe-ali target="_blank" rel="noopener" title="نتائج علي بابا باسم المنتج — تجد صفحته فتلصق رابطها في «🔄 إعادة البحث التلقائي»">علي بابا ↗</a>' +
            (ctx.uploadImage ? '<label class="pe-up" title="صورة من جهازك: للجرد أو لصور المتجر">📷 من جهازك<input type="file" accept="image/*" data-pe-file hidden></label>' : '') +
            /* (TASK-0256 · seq 181) «في هذه الشاشه لا يوجد اضافه صور او روابط صور» */
            '<div class="pe-imglink"><input data-pe-linkimg dir="ltr" placeholder="🔗 الصق رابط صورة (من غوغل أو أيّ موقع)"><button type="button" data-pe-linkinv>للجرد</button><button type="button" data-pe-linkst>+ للمتجر</button></div>' +
          '</div><div data-pe-rows></div>' +
          '<button type="button" data-pe-addrow>+ بند</button>' +
          '<div class="pe-2" style="margin-top:10px"><label>الموديل<input data-f="__model" value="' + esc(sp0.__model) + '"></label><label>التوافق (متوافق مع)<input data-f="compat" value="' + esc(p.compat) + '"></label></div>' +
          '<label>الوصف<textarea data-f="__desc" rows="3">' + esc(sp0.__desc) + '</textarea></label>' +
          '<p class="pe-note">الجدول والموديل والتوافق والوصف تنتقل لمنتج المتجر المربوط عند الحفظ.</p>' +
        '</section>' +
        '<section class="pe-wide" data-pe-store><h3>🛒 المتجر</h3><p class="pe-note">⏳ جارٍ قراءة منتج المتجر…</p></section>' +
      '</div>';
    doc.body.appendChild(root);
    var $ = function (q) { return root.querySelector(q); }, msg = $('[data-pe-msg]');
    function say(t, bad) { msg.textContent = t || ''; msg.style.color = bad ? '#b91c1c' : '#047857'; }
    /* صفوف الجدول */
    var rowsEl = $('[data-pe-rows]');
    function addRow(k, v, ax) {
      var d = doc.createElement('div'); d.className = 'pe-row';
      d.innerHTML = '<input data-rk placeholder="البند (مثل: الوزن)" value="' + esc(k) + '"><input data-rv placeholder="القيمة" value="' + esc(v) + '">' +
        '<button type="button" data-rax aria-pressed="' + (ax ? 'true' : 'false') + '" title="≈ قيمة تقديرية — أطفئها بعد التأكّد">≈</button><button type="button" data-rdel aria-label="احذف البند">✕</button>';
      d.querySelector('[data-rdel]').onclick = function () { d.remove(); };
      d.querySelector('[data-rax]').onclick = function () { this.setAttribute('aria-pressed', this.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); };
      rowsEl.appendChild(d); return d;
    }
    rows0.forEach(function (r) { addRow(r.k, r.v, r.ax); });
    if (!rows0.length) addRow('', '');
    $('[data-pe-addrow]').onclick = function () { addRow('', '').querySelector('input').focus(); };
    /* (TASK-0233) الماركة الفارغة ⇒ تُستنتج تلقائياً (قابلة للتعديل) */
    var brandEl = $('[data-f="brand"]'), brandNote = $('[data-pe-brandnote]');
    function autoBrand(src) {
      if (brandEl.value.trim() && brandEl.dataset.auto !== '1') return;
      var g = guessBrand(src || p, ctx.brands);
      if (g && g !== brandEl.value) { brandEl.value = g; brandEl.dataset.auto = '1'; brandNote.hidden = false; }
    }
    brandEl.addEventListener('input', function () { brandEl.dataset.auto = ''; brandNote.hidden = true; });
    autoBrand();
    $('[data-f="name"]').addEventListener('change', function () { autoBrand({ name: this.value, alt_names: $('[data-f="alt_names"]').value, specs: p.specs }); });
    var imgIn = $('[data-f="image_url"]'), imgPrev = $('[data-pe-invprev]');
    imgIn.addEventListener('change', function () { var u = realImg(imgIn.value); if (u !== imgIn.value) imgIn.value = u; imgPrev.hidden = !u; if (u) imgPrev.src = u; links(); });
    function links() {
      var q = ($('[data-f="name"]').value.trim() || p.name || '') + (brandEl.value.trim() && ($('[data-f="name"]').value || '').toLowerCase().indexOf(brandEl.value.trim().toLowerCase()) === -1 ? ' ' + brandEl.value.trim() : '');
      $('[data-pe-gimg]').href = $('[data-pe-gimg2]').href = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q.trim());
      $('[data-pe-ali]').href = 'https://www.alibaba.com/trade/search?SearchText=' + encodeURIComponent(q.trim());
      var u = imgIn.value.trim(), L = $('[data-pe-lens]');
      L.href = isHttp(u) ? 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(u) : '#';   // يُفتح عبر «🔎 عدسة غوغل» نفسها (ترفع المضمَّنة أوّلاً)
      L.setAttribute('role', 'button'); L.removeAttribute('aria-disabled');
    }
    $('[data-f="name"]').addEventListener('input', links); brandEl.addEventListener('input', links); links();
    /* صور البحث التلقائي (صفحة المنتج) — اختر: صورة الجرد · أو أضفها لصور المتجر */
    function showSugg(list) {
      list = (list || []).map(String).filter(isHttp).filter(function (u, i, a) { return a.indexOf(u) === i; }).slice(0, 12);
      var box = $('[data-pe-suggbox]'), row = $('[data-pe-sugg]'); row.innerHTML = '';
      list.forEach(function (u) {
        var f = doc.createElement('figure');
        f.innerHTML = '<img alt="" loading="lazy" src="' + esc(u) + '"><button type="button" data-a="inv">صورة الجرد</button><button type="button" data-a="st">+ المتجر</button>';
        f.querySelector('img').onerror = function () { f.remove(); };
        f.querySelector('[data-a=inv]').onclick = function () { imgIn.value = u; imgIn.dispatchEvent(new Event('change')); say('🖼️ اخترتَها صورةً للجرد — «💾 احفظ»'); };
        f.querySelector('[data-a=st]').onclick = function () { if (!S.sp) { say('اربط المنتج بالمتجر أو أنشئه فيه أوّلاً (قسم «🛒 المتجر»)', true); return; } if (S.imgs.indexOf(u) === -1) { S.imgs.push(u); paintImgs(); } say('🖼️ أُضيفت لصور المتجر — «💾 احفظ»'); };
        row.appendChild(f);
      });
      box.hidden = !list.length;
    }
    /* (TASK-0233 · seq 161) «ادمج … مع تعديل بيانات تلقائيه … كل مواصفات المنتج في مكان واحد»: المواصفات التلقائية تعبّئ هذه الصفحة نفسها
       (الجدول · الوصف · الموديل · الماركة · التوافق · الأسماء الأخرى) — لا تحفظ وحدها: تراجعها هنا ثمّ «💾 احفظ». */
    function fillFromAuto(pr) {
      pr = pr || {}; var n = 0;
      (pr.specs || []).forEach(function (x) {
        var k = x && String(x.k || '').trim().slice(0, 60), v = x && String(x.v == null ? '' : x.v).trim().slice(0, 300); if (!k || !v) return;
        var row = [].filter.call(rowsEl.querySelectorAll('.pe-row'), function (r) { return r.querySelector('[data-rk]').value.trim() === k; })[0]
          || [].filter.call(rowsEl.querySelectorAll('.pe-row'), function (r) { return !r.querySelector('[data-rk]').value.trim() && !r.querySelector('[data-rv]').value.trim(); })[0];
        if (!row) row = addRow('', '');
        row.querySelector('[data-rk]').value = k; row.querySelector('[data-rv]').value = v; n++;
      });
      var set = function (f, v, always) { var e = $('[data-f="' + f + '"]'); v = String(v || '').trim(); if (e && v && (always || !e.value.trim() || e.dataset.auto === '1')) { e.value = v; e.dataset.auto = '1'; } };
      set('__desc', pr.description_ar, true); set('__model', pr.model); set('compat', Array.isArray(pr.compat) ? pr.compat.join(' · ') : pr.compat);
      if (pr.brand) { set('brand', pr.brand); brandNote.hidden = false; }
      var alt = $('[data-f="alt_names"]'), have = alt.value.split(/[،,|·\n]+/).map(function (x) { return x.trim(); }).filter(Boolean);
      [].concat(pr.aliases_ar || [], pr.aliases_en || [], pr.name_en ? [pr.name_en] : []).forEach(function (a) { a = String(a || '').trim(); if (a && !have.some(function (x) { return x.toLowerCase() === a.toLowerCase(); })) have.push(a); });
      alt.value = have.join('، ');
      if (pr.source_url) S.source = pr.source_url;
      showSugg([].concat(pr.images || [], pr.image ? [pr.image] : []));      // (TASK-0241) «البحث عن الصور مع البحث عن المواصفات»
      say('🤖 عُبّئت ' + n + ' مواصفة' + (pr.description_ar ? ' والوصف' : '') + ' — راجعها ثمّ «💾 احفظ»');
      try { rowsEl.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {}
    }
    /* عدسة غوغل بصورة المنتج: رابط https ⇐ تُفتح فوراً · صورةٌ مضمَّنة (data:) ⇐ تُرفع أوّلاً لمخزن الصور (ctx.uploadImage) فتصير رابطاً
       (ويصير هو صورة الجرد عند «💾 احفظ») · بلا صورة ⇐ يقول ذلك. النافذة تُفتح مع الضغطة نفسها كي لا يحجبها المتصفّح. */
    var linkIn = $('[data-pe-linkimg]');
    function linkTo(where) {
      var u = realImg(linkIn.value); if (!isHttp(u)) { say('الصق رابط صورة يبدأ بـ https', true); return; }
      linkIn.value = '';
      if (where === 'st') { if (!S.sp) { say('اربط المنتج بالمتجر أو أنشئه فيه أوّلاً (قسم «🛒 المتجر»)', true); return; } if (S.imgs.indexOf(u) === -1) { S.imgs.push(u); paintImgs(); } say('🖼️ أُضيفت لصور المتجر — «💾 احفظ»'); }
      else { imgIn.value = u; imgIn.dispatchEvent(new Event('change')); say('🖼️ صارت صورة الجرد — «💾 احفظ»'); }
    }
    $('[data-pe-linkinv]').onclick = function () { linkTo('inv'); };
    $('[data-pe-linkst]').onclick = function () { linkTo('st'); };
    /* (seq 181 «عدسة غوغل مو شغالة»: الزرّ تحت صورة الجرد كان معطّلاً لصورةٍ مضمَّنة) ⇒ الزرّان ينفّذان الشيء نفسه */
    $('[data-pe-lens]').addEventListener('click', function (e) { e.preventDefault(); $('[data-pe-lensgo]').click(); });
    var webB = $('[data-pe-webimg]');
    if (webB) webB.onclick = async function () {
      var q = ($('[data-f="name"]').value.trim() || p.name || '') + (brandEl.value.trim() ? ' ' + brandEl.value.trim() : '');
      webB.disabled = true; say('⏳ يبحث عن صور «' + q.trim() + '»…');
      try {
        var r = await GMTEnrichQueue._search('images', q.trim(), 24), list = ((r && r.images) || []).map(function (x) { return x && x.url; }).filter(isHttp);
        showSugg(list); say(list.length ? '🖼️ ' + list.length + ' صورة — اختر «صورة الجرد» أو «+ المتجر»' : 'لم يجد صوراً — جرّب «🔍 صور غوغل» أو «🔎 عدسة غوغل»', !list.length);
      } catch (e) {
        say(e && e.code === 'no_keys' ? 'بحث الصور في الويب يحتاج مفتاحاً مجانياً (Tavily) في أسرار Supabase — إلى ذلك: «🔍 صور غوغل» أو «🔎 عدسة غوغل»' : '❌ تعذّر البحث: ' + ((e && e.message) || e), true);
      }
      webB.disabled = false;
    };
    var fileIn = $('[data-pe-file]');
    if (fileIn) fileIn.onchange = async function () {
      var f = fileIn.files && fileIn.files[0]; fileIn.value = ''; if (!f) return;
      var where = S.sp ? await (global.GMTAsk ? GMTAsk.choose('أين تضع الصورة؟', { title: '📷 صورة من جهازك', choices: [{ k: 'inv', t: 'صورة الجرد' }, { k: 'st', t: 'صور المتجر' }] }) : 'inv') : 'inv';
      if (!where) return;
      say('⏳ رفع الصورة…'); var u = null; try { u = await ctx.uploadImage(f); } catch (_) {}
      if (!u) { say('❌ تعذّر رفع الصورة', true); return; }
      if (where === 'st') { if (S.imgs.indexOf(u) === -1) { S.imgs.push(u); paintImgs(); } say('🖼️ أُضيفت لصور المتجر — «💾 احفظ»'); }
      else { imgIn.value = u; imgIn.dispatchEvent(new Event('change')); say('🖼️ صارت صورة الجرد — «💾 احفظ»'); }
    };
    $('[data-pe-lensgo]').onclick = async function () {
      var u = imgIn.value.trim() || p.image_url || '';
      if (!u) { say('لا صورة لهذا المنتج — أضف صورة الجرد أوّلاً (أو استعمل «🔍 صور غوغل»)', true); return; }
      var w = null; try { w = global.open('about:blank', '_blank'); } catch (_) {}
      if (!isHttp(u)) {
        if (!/^data:image\//.test(u) || typeof ctx.uploadImage !== 'function') { if (w) w.close(); say('صورة المنتج ليست رابطاً — لا تقبلها العدسة', true); return; }
        say('⏳ رفع صورة المنتج للعدسة…');
        var up = null; try { up = await ctx.uploadImage(u); } catch (_) {}
        if (!up) { if (w) w.close(); say('❌ تعذّر رفع الصورة', true); return; }
        u = up; imgIn.value = up; imgIn.dispatchEvent(new Event('change')); say('🖼️ صارت صورة المنتج رابطاً — «💾 احفظ» لتثبيتها');
      }
      var lens = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(u);
      if (w) w.location.href = lens; else global.open(lens, '_blank');
    };
    var autoB = $('[data-pe-auto]');
    if (autoB) autoB.onclick = function () {
      autoB.textContent = '🔄 إعادة البحث التلقائي';
      GMTBrain.productImportDialog(async function (pr) { fillFromAuto(pr); }, { url: '', name: $('[data-f="name"]').value.trim() || p.name || '', imageUrl: imgIn.value.trim() || p.image_url || '' });
    };
    var quickB = $('[data-pe-quick]');
    if (quickB) quickB.onclick = function () { close(); ctx.onQuick(p); };
    /* المتجر */
    var S = { rec: null, sp: null, imgs: [], cats: [] };
    function paintImgs() {
      var box = $('[data-pe-imgs]'); if (!box) return; box.innerHTML = '';
      S.imgs.forEach(function (u, i) {
        var d = doc.createElement('div'); d.className = 'pe-img';
        d.innerHTML = '<img alt="" src="' + esc(u) + '"><div><button type="button" data-a="r" aria-label="قدّم">›</button><button type="button" data-a="x" aria-label="احذف">✕</button><button type="button" data-a="l" aria-label="أخّر">‹</button></div>';
        d.querySelector('[data-a=x]').onclick = function () { S.imgs.splice(i, 1); paintImgs(); };
        d.querySelector('[data-a=r]').onclick = function () { if (i > 0) { var t = S.imgs[i - 1]; S.imgs[i - 1] = S.imgs[i]; S.imgs[i] = t; paintImgs(); } };
        d.querySelector('[data-a=l]').onclick = function () { if (i < S.imgs.length - 1) { var t = S.imgs[i + 1]; S.imgs[i + 1] = S.imgs[i]; S.imgs[i] = t; paintImgs(); } };
        box.appendChild(d);
      });
      var inv = $('[data-pe-invimg]'); if (inv) inv.style.display = p.image_url && S.imgs.indexOf(p.image_url) === -1 ? '' : 'none';
    }
    function loadStore() { return storeRec().then(function (rec) {
      var sec = $('[data-pe-store]'); S.rec = rec;
      var prods = rec && Array.isArray(rec.products) ? rec.products : [], sp = prods.length && global.GMTSpecs && GMTSpecs._findStore ? GMTSpecs._findStore(prods, p) : null;
      S.sp = sp;
      if (!sp) { unlinked(sec, rec); return; }
      S.imgs = (Array.isArray(sp.images) ? sp.images : []).slice(); S.cats = (Array.isArray(sp.category_ids) && sp.category_ids.length ? sp.category_ids : (sp.category_id ? [sp.category_id] : [])).map(String);
      var cats = (rec.categories || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      sec.innerHTML = '<h3>🛒 المتجر</h3>' +
        '<div class="pe-2"><label>الاسم في المتجر<input data-s="name" value="' + esc(sp.name) + '"></label><label>السعر في المتجر $<input data-s="price" type="number" step="0.01" min="0" inputmode="decimal" value="' + esc(sp.price) + '"></label></div>' +
        '<label style="display:flex;align-items:center;font-weight:700"><input type="checkbox" data-s-same> السعر في المتجر = سعر البيع في الجرد</label>' +
        '<div style="font-size:12px;font-weight:800;color:#374151;margin:8px 0 6px">أقسامه في المتجر</div><div class="pe-cats">' +
          cats.map(function (c) { return '<label><input type="checkbox" data-scat="' + esc(c.id) + '"' + (S.cats.indexOf(String(c.id)) !== -1 ? ' checked' : '') + '>' + esc(c.name) + '</label>'; }).join('') + '</div>' +
        '<label style="margin-top:10px">الوصف في المتجر<textarea data-s="description" rows="3">' + esc(sp.description) + '</textarea></label>' +
        /* (TASK-0256 · seq 181) «… روابط الفيديوهات التي تكون في المتجر» */
        '<label>رابط فيديو المنتج في المتجر (يوتيوب · إنستغرام)<input data-s="video_url" dir="ltr" placeholder="https://…" value="' + esc(sp.video_url) + '"></label>' +
        '<div style="font-size:12px;font-weight:800;color:#374151;margin:8px 0 6px">صوره في المتجر (الأولى هي الرئيسية)</div><div class="pe-imgs" data-pe-imgs></div>' +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><input data-pe-newimg dir="ltr" placeholder="https://… رابط صورة" style="flex:1;min-width:180px;margin:0"><button type="button" data-pe-addimg>+ أضف</button><button type="button" data-pe-invimg>+ صورة الجرد</button></div>';
      paintImgs();
      $('[data-pe-addimg]').onclick = function () { var i = $('[data-pe-newimg]'), u = realImg(i.value); if (/^https?:\/\//.test(u) && S.imgs.indexOf(u) === -1) { S.imgs.push(u); i.value = ''; paintImgs(); } };
      $('[data-pe-invimg]').onclick = function () { if (p.image_url && S.imgs.indexOf(p.image_url) === -1) { S.imgs.push(p.image_url); paintImgs(); } };
      var same = $('[data-s-same]'), spr = $('[data-s="price"]');
      same.checked = num(sp.price) === num(p.price);
      var sync = function () { if (same.checked) { spr.value = $('[data-f="price"]').value; spr.disabled = true; } else spr.disabled = false; };
      same.onchange = sync; $('[data-f="price"]').addEventListener('input', sync); sync();
    }, function (e) { $('[data-pe-store]').innerHTML = '<h3>🛒 المتجر</h3><p class="pe-note" style="color:#b91c1c">تعذّرت قراءة المتجر: ' + esc(e && e.message || e) + '</p>'; }); }
    loadStore();
    /* (TASK-0247 · المالك seq 165) «الربط بالمتجر او الانشاء» — من هذه الصفحة نفسها (كان: «اربطه من الجسر») */
    function unlinked(sec, rec) {
      var prods = rec && Array.isArray(rec.products) ? rec.products : [], cats = (rec && rec.categories || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      sec.innerHTML = '<h3>🛒 المتجر</h3><p class="pe-note">هذا المنتج غير مربوط بمنتجٍ في المتجر.</p>' +
        '<div class="pe-btns"><button type="button" data-pe-link>🔗 ربط بمنتجٍ موجود في المتجر</button><button type="button" data-pe-create>➕ إنشاء في المتجر</button></div>' +
        '<div data-pe-linkbox hidden><input data-pe-linkq placeholder="ابحث باسم منتج المتجر أو باركوده"><div data-pe-linklist></div></div>' +
        '<div data-pe-createbox hidden><div style="font-size:12px;font-weight:800;color:#374151;margin:8px 0 6px">أقسامه في المتجر (قسمٌ واحد على الأقلّ)</div><div class="pe-cats">' +
          cats.map(function (c) { return '<label><input type="checkbox" data-ccat="' + esc(c.id) + '">' + esc(c.name) + '</label>'; }).join('') + '</div>' +
          '<p class="pe-note">يُنشأ بالاسم والسعر والصورة وجدول المواصفات والتوافق والوصف من هذه الصفحة.</p><button type="button" class="p" data-pe-docreate>➕ أنشئه في المتجر</button></div>';
      var linkbox = $('[data-pe-linkbox]'), q = $('[data-pe-linkq]'), list = $('[data-pe-linklist]');
      var free = prods.filter(function (x) { return x && (x.inv_id == null || x.inv_id === '' || String(x.inv_id) === String(p.id)); });
      var words = function (t) { return String(t || '').toLowerCase().split(/[\s\-_/·،,()]+/).filter(function (w) { return w.length > 1; }); };
      function paint() {
        var qq = q.value.trim().toLowerCase(), mine = words(qq || $('[data-f="name"]').value), bc = String(p.barcode || '').trim();
        var scored = free.map(function (x) {
          var n = String(x.name || '').toLowerCase(), sc = 0;
          if (qq) { if (n.indexOf(qq) !== -1 || String(x.barcode || '') === qq) sc = 10; else sc = words(qq).filter(function (w) { return n.indexOf(w) !== -1; }).length; }
          else { sc = mine.filter(function (w) { return n.indexOf(w) !== -1; }).length + (bc && String(x.barcode || '').trim() === bc ? 10 : 0); }
          return { x: x, sc: sc };
        }).filter(function (o) { return o.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 8);
        list.innerHTML = scored.length ? scored.map(function (o) { var x = o.x, im = Array.isArray(x.images) && x.images[0];
          return '<div class="pe-cand">' + (im ? '<img alt="" src="' + esc(im) + '">' : '') + '<span>' + esc(x.name) + '<small>$' + esc(x.price) + (x.barcode ? ' · ' + esc(x.barcode) : '') + '</small></span><button type="button" data-linkto="' + esc(x.id) + '">اربط</button></div>'; }).join('')
          : '<p class="pe-note">لا منتج مطابق — اكتب جزءاً من الاسم، أو «➕ إنشاء في المتجر».</p>';
      }
      $('[data-pe-link]').onclick = function () { linkbox.hidden = !linkbox.hidden; $('[data-pe-createbox]').hidden = true; if (!linkbox.hidden) { paint(); q.focus(); } };
      q.addEventListener('input', paint);
      list.addEventListener('click', async function (e) {
        var b = e.target.closest('[data-linkto]'); if (!b) return; var sid = b.getAttribute('data-linkto'); b.disabled = true;
        try {
          var inv = collect();
          await storeWrite(function (arr) {
            var t = arr.filter(function (x) { return x && String(x.id) === sid; })[0]; if (!t) throw new Error('منتج المتجر لم يعد موجوداً');
            if (t.inv_id != null && t.inv_id !== '' && String(t.inv_id) !== String(p.id)) throw new Error('هذا المنتج مربوطٌ بمنتجٍ آخر من الجرد');
            var upd = { inv_id: p.id }; if (inv.barcode) upd.barcode = inv.barcode;
            var imgs = Array.isArray(t.images) ? t.images.slice() : []; if (isHttp(inv.image_url) && imgs.indexOf(inv.image_url) === -1) { imgs.push(inv.image_url); upd.images = imgs; }
            if (global.GMTSpecs && GMTSpecs.storeFields) Object.assign(upd, GMTSpecs.storeFields({ specs: inv.specs, compat: inv.compat }, t));
            return arr.map(function (x) { return x === t ? Object.assign({}, x, upd) : x; });
          });
          var url = storePageUrl(sid), r = await ctx.saveInv({ store_url: url }); if (r && r.error) throw new Error('الجرد: ' + r.error);
          p.store_url = url; say('✅ رُبط بمنتج المتجر — الباركود والمواصفات والصورة انتقلت إليه'); loadStore();
          if (ctx.onSaved) try { ctx.onSaved(p, { inv: { store_url: url } }); } catch (_) {}
        } catch (er) { say('❌ ' + (er && er.message || er), true); b.disabled = false; }
      });
      $('[data-pe-create]').onclick = function () { var c = $('[data-pe-createbox]'); c.hidden = !c.hidden; linkbox.hidden = true; };
      $('[data-pe-docreate]').onclick = async function () {
        var b = this, ids = [].map.call(root.querySelectorAll('[data-ccat]:checked'), function (x) { return x.getAttribute('data-ccat'); });
        if (!ids.length) { say('❌ اختر قسماً واحداً على الأقلّ', true); return; }
        var inv = collect(); if (!inv.name) { say('❌ الاسم مطلوب', true); return; }
        b.disabled = true;
        try {
          var created = null, existed = null;
          await storeWrite(function (arr) {
            existed = arr.filter(function (x) { return x && x.inv_id != null && String(x.inv_id) === String(p.id); })[0] || null; if (existed) return null;
            var f = global.GMTSpecs && GMTSpecs.storeFields ? GMTSpecs.storeFields({ specs: inv.specs, compat: inv.compat }, {}) : {};
            created = { id: 'p_' + Date.now(), inv_id: p.id, barcode: inv.barcode || '', name: inv.name, short_name: inv.short || inv.name, price: inv.price,
              description: f.description || '', specs: f.specs || [], compat: f.compat || '', images: isHttp(inv.image_url) ? [inv.image_url] : [],
              category_id: ids[0], category_ids: ids, order: arr.length + 1, stock: typeof ctx.stockOf === 'function' ? (Number(ctx.stockOf(p)) || 0) : 0, options: [] };
            return arr.concat([created]);
          });
          var sp = existed || created, url = storePageUrl(sp.id), r = await ctx.saveInv({ store_url: url }); if (r && r.error) throw new Error('الجرد: ' + r.error);
          p.store_url = url; say(existed ? '⚠️ موجودٌ في المتجر سلفاً («' + (existed.name || '') + '») — رُبط به' : '✅ أُنشئ في المتجر وربط به'); loadStore();
          if (ctx.onSaved) try { ctx.onSaved(p, { inv: { store_url: url } }); } catch (_) {}
        } catch (er) { say('❌ ' + (er && er.message || er), true); b.disabled = false; }
      };
    }

    function close() { root.remove(); doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape' && !root.querySelector(':focus-within textarea:focus')) { e.preventDefault(); close(); } }
    doc.addEventListener('keydown', onKey, true);
    $('[data-pe-x]').onclick = close;

    function collect() {
      var f = function (k) { var e = $('[data-f="' + k + '"]'); return e ? e.value.trim() : ''; };
      var specs = {};
      var approx = [];
      rowsEl.querySelectorAll('.pe-row').forEach(function (r) {
        var k = r.querySelector('[data-rk]').value.trim().slice(0, 60), v = r.querySelector('[data-rv]').value.trim().slice(0, 300);
        var c = global.GMTSpecs && GMTSpecs.clean ? GMTSpecs.clean(v) : { value: v, approx: false };     // كتب أحدٌ «تقريبي» بيده ⇒ علامةٌ لا كلمة
        var axBtn = r.querySelector('[data-rax]'), axOn = !!axBtn && axBtn.getAttribute('aria-pressed') === 'true';
        if (k && c.value) { specs[k] = c.value; if (c.approx || axOn) approx.push(k); }
      });
      if (approx.length) specs.__approx = approx;
      if (f('__desc')) specs.__desc = f('__desc').slice(0, 2000);
      if (f('brand')) specs.__brand = f('brand');
      if (f('__model')) specs.__model = f('__model');
      var inv = { name: f('name'), short: f('short'), barcode: f('barcode'), group_name: f('group_name'), category: f('category') || null, brand: f('brand') || null,
        alt_names: f('alt_names') || null, price: num(f('price')), wholesale_price: num(f('wholesale_price')), min_stock: parseInt(f('min_stock'), 10) || 0, specs: specs, compat: f('compat') || null,
        image_url: f('image_url') || null };
      return inv;
    }
    function changed(inv) {
      var patch = {};
      Object.keys(inv).forEach(function (k) {
        var a = inv[k], b = p[k];
        if (k === 'specs') { if (JSON.stringify(a) !== JSON.stringify(asObj(b))) patch.specs = a; return; }
        if (typeof a === 'number') { if (num(b) !== a) patch[k] = a; return; }
        if (String(a == null ? '' : a) !== String(b == null ? '' : b)) patch[k] = a;
      });
      /* الأسماء الأخرى ⇒ كلمات البحث (كما في نافذة المنتج) */
      if ('alt_names' in patch) {
        var cur = String(p.search_terms || '').split(/\s*[,،·]\s*/).filter(Boolean);
        String(patch.alt_names || '').split(/\s*[,،·]\s*/).filter(Boolean).forEach(function (a) { if (cur.indexOf(a) === -1) cur.push(a); });
        if (cur.length) patch.search_terms = cur.join(' · ');
      }
      return patch;
    }
    $('[data-pe-save]').onclick = async function () {
      var b = this, inv = collect();
      if (!inv.name) { say('❌ الاسم مطلوب', true); return; }
      if (!(inv.price >= 0)) { say('❌ السعر غير صحيح', true); return; }
      var patch = changed(inv), sp = S.sp, sUpd = null;
      if (S.source && patch.specs) { patch.specs_source = S.source; patch.specs_checked_at = new Date().toISOString(); }
      if (sp) {
        var g = function (k) { var e = $('[data-s="' + k + '"]'); return e ? e.value.trim() : ''; };
        var cats = [].map.call(root.querySelectorAll('[data-scat]:checked'), function (x) { return x.getAttribute('data-scat'); });
        var sPrice = $('[data-s-same]') && $('[data-s-same]').checked ? inv.price : num(g('price'));
        var want = { name: g('name') || sp.name, price: sPrice, description: g('description'), images: S.imgs.slice(), video_url: g('video_url') };
        if (cats.length) { want.category_ids = cats; want.category_id = cats[0]; }
        sUpd = {};
        Object.keys(want).forEach(function (k) { if (JSON.stringify(want[k]) !== JSON.stringify(k === 'price' ? num(sp[k]) : (sp[k] == null ? (k === 'description' || k === 'video_url' ? '' : sp[k]) : sp[k]))) sUpd[k] = want[k]; });
        if (patch.specs || 'compat' in patch) { var fs = global.GMTSpecs ? GMTSpecs.forStore(inv.specs) : []; sUpd.specs = fs; sUpd.compat = inv.compat || ''; }
        if (!Object.keys(sUpd).length) sUpd = null;
      }
      if (!Object.keys(patch).length && !sUpd) { say('لا تغيير لحفظه'); return; }
      b.disabled = true; b.textContent = '⏳ …'; say('');
      try {
        if (Object.keys(patch).length) {
          var r = await ctx.saveInv(patch);
          if (r && r.error) throw new Error('الجرد: ' + r.error);
          Object.assign(p, patch);
        }
        var st = null;
        if (sUpd) {
          st = await GMTSpecs.pushToStore(p, { only: function (cur) { var o = {}; for (var k in sUpd) o[k] = sUpd[k]; if (!('description' in o) && sUpd.specs && inv.specs.__desc) { var d = String(cur.description || ''); if (d.indexOf(inv.specs.__desc) === -1) o.description = inv.specs.__desc + (d ? '\n' + d : ''); } return o; } });
          if (!st) throw new Error('لم يُعثر على منتج المتجر المربوط');
        }
        say('✅ حُفظ' + (Object.keys(patch).length ? ' في الجرد' : '') + (st ? (Object.keys(patch).length ? ' والمتجر' : ' في المتجر') : ''));
        if (ctx.onSaved) try { ctx.onSaved(p, { inv: patch, store: sUpd }); } catch (_) {}
        if (sp && sUpd) Object.assign(sp, sUpd);
      } catch (e) { say('❌ ' + (e && e.message || e), true); }
      b.disabled = false; b.textContent = '💾 احفظ';
    };
    if (ctx.autoSpecs && autoB) setTimeout(function () { autoB.click(); }, 50);   // من «المواصفات التلقائية» في قائمة المنتج
    if (ctx.prefill) { fillFromAuto(ctx.prefill); if (autoB) autoB.textContent = '🔄 إعادة البحث التلقائي'; }   // (TASK-0256) من أداة التجهيز: ما جهّزه العقل
    return root;
  }
  global.GMTProductEdit = { open: open, guessBrand: guessBrand };
})(typeof window !== 'undefined' ? window : this);
