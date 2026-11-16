/* ═══════════════════════════════════════════════════════════════════════════
   gmt-studio.js — «🎬 جهّز استوديوك» · TASK-A0522
   ───────────────────────────────────────────────────────────────────────────
   المالك seq 744: «جهّز استوديوك — أداة تفاعلية يحدد فيها العميل نوع الاستوديو: بودكاست، تصوير منتجات، تصوير أشخاص،
   ثم يستعرض التجهيزات المناسبة». خطّة `٩_أفكار_المتجر_وتوزيعها.md` §٧.
   القواعد:
     • نوع الاستوديو ⇐ مستوى (اقتصادي · متوسّط · احترافي) ⇐ طقم من منتجات المتجر المسعّرة (لا خصم ولا سعر جديد).
     • كلّ «خانة» في الطقم = ما يحتاجه هذا الاستوديو (مايك · ستاند مايك · إضاءة · ستاند إضاءة …) — لا منتجات متشابهة.
     • المستوى يختار من مرشّحي الخانة: الأرخص · الأوسط · الأغلى (بصورة أوّلاً) · «بدّل» ينقل للمرشّح التالي.
     • «أضف الكلّ للسلّة» و«احفظه قائمة» عبر «📋 قوائمي» (gmt-lists.js) · رابط store.html#studio=podcast&t=mid.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store() { try { return (g.__gmtStore && g.__gmtStore()) || {}; } catch (_) { return {}; } }
  function catPath(id) { try { return g._catPath ? g._catPath(id) : ['', '']; } catch (_) { return ['', '']; } }
  function cats(p) { return (p.category_ids && p.category_ids.length ? p.category_ids : [p.category_id]).map(catPath); }
  function inCat(p, top, sub) { return cats(p).some(function (c) { return (!top || top.test(c[0] || '')) && (!sub || sub.test(c[1] || '')); }); }
  function price(p) { return parseFloat(p && p.price || 0) || 0; }
  var STAND = function (n) { return /ستاند|stand/i.test(n) && !/ring|رينغ|حلق|selfie|سيلفي|عصا|^\s*q\d|مايك|mic/i.test(n); };

  /* الخانة: [المعرّف · الاسم للزبون · مرشِّح · الكمّية لكلّ مستوى [اقتصادي، متوسّط، احترافي] (0 = لا تُضاف في هذا المستوى)] */
  var TYPES = {
    podcast: { name: 'بودكاست ومقابلات', icon: '🎙️', slots: [
      ['mic', 'مايك', function (p) { return inCat(p, /المايكات/, /لاسلكية|سلكية وبودكاست/); }, [1, 1, 2]],
      ['micstand', 'ستاند مايك', function (p) { return inCat(p, /المايكات/, /ستاندات/) && /ستاند مايك|microphone stand|NB-35/i.test(p.name || ''); }, [1, 1, 2]],
      ['card', 'كرت صوت', function (p) { return /كرت صوت|sound card/i.test(p.name || ''); }, [0, 1, 1]],
      ['key', 'إضاءة رئيسية', function (p) { return inCat(p, /إضاءة الاستوديو|الإضاءة حسب الاستخدام/, /ألواح LED — كهرباء|رؤوس الإضاءة — كهرباء|Key Light/); }, [1, 1, 2]],
      ['stand', 'ستاند إضاءة', function (p) { return inCat(p, /إضاءة الاستوديو/, /ستاندات/) && STAND(p.name || ''); }, [1, 1, 2]],
      ['rgb', 'إضاءة خلفية ملوّنة', function (p) { return inCat(p, /إضاءة صنّاع المحتوى/, /تيوب وعصا/); }, [0, 1, 1]]
    ] },
    products: { name: 'تصوير منتجات', icon: '📦', slots: [
      ['box', 'صندوق/حامل تصوير منتجات', function (p) { return /صندوق تصوير|tabletop studio|photography table|حامل تصوير منتجات/i.test(p.name || '') || (inCat(p, /الإضاءة حسب الاستخدام/, /تصوير المنتجات/) && /box|صندوق|E30|BD-300/i.test(p.name || '')); }, [1, 1, 1]],
      ['panel', 'لوح إضاءة', function (p) { return inCat(p, /إضاءة الاستوديو/, /ألواح LED/); }, [1, 2, 2]],
      ['stand', 'ستاند إضاءة', function (p) { return inCat(p, /إضاءة الاستوديو/, /ستاندات/) && STAND(p.name || ''); }, [1, 2, 2]],
      ['tripod', 'ترايبود', function (p) { return inCat(p, /ترايبود وجيمبال/, /^ترايبود$/); }, [1, 1, 1]],
      ['refl', 'عاكس إضاءة', function (p) { return /عاكس|reflector/i.test(p.name || '') && !/عاكسين/.test(p.name || ''); }, [0, 1, 1]]
    ] },
    portrait: { name: 'تصوير أشخاص (بورتريه)', icon: '🧑‍🎨', slots: [
      ['head', 'رأس إضاءة', function (p) { return inCat(p, /إضاءة الاستوديو/, /رؤوس الإضاءة — كهرباء/); }, [1, 2, 2]],
      ['soft', 'سوفت بوكس', function (p) { return inCat(p, /إضاءة الاستوديو/, /سوفت بوكس ومعدّلات/) && /سوفت|softbox|بالون|اوكتا|octa/i.test(p.name || '') && !/فلاش|flash|مجموعة كاملة|براكيت|bracket|حامل|E27|socket|لمب/i.test(p.name || '');   /* سوفت بوكس بلمبات مدمجة ليس معدّلاً لرأس إضاءة */ }, [1, 2, 2]],
      ['stand', 'ستاند إضاءة', function (p) { return inCat(p, /إضاءة الاستوديو/, /ستاندات/) && STAND(p.name || ''); }, [1, 2, 2]],
      ['refl', 'عاكس إضاءة', function (p) { return /عاكس|reflector/i.test(p.name || '') && !/عاكسين/.test(p.name || ''); }, [1, 1, 1]],
      ['bg', 'خلفية تصوير', function (p) { return /خلفية|كروما|backdrop|background/i.test(p.name || '') && !/حقيبة/.test(p.name || ''); }, [0, 1, 1]]
    ] },
    mobile: { name: 'صانع محتوى بالموبايل', icon: '📱', slots: [
      ['hold', 'ترايبود ذكي / جيمبال', function (p, t) { return t === 0 ? inCat(p, /ترايبود وجيمبال/, /ترايبود ذكي/) : inCat(p, /ترايبود وجيمبال/, /أوزمو موبايل/); }, [1, 1, 1]],
      ['mic', 'مايك لاسلكي', function (p) { return inCat(p, /المايكات/, /لاسلكية/); }, [1, 1, 1]],
      ['pocket', 'إضاءة كفّ', function (p) { return inCat(p, /إضاءة صنّاع المحتوى/, /كفّ وجيب/); }, [1, 1, 2]],
      ['live', 'إضاءة بثّ', function (p) { return inCat(p, /الإضاءة حسب الاستخدام/, /بثّ مباشر/); }, [0, 0, 1]]
    ] }
  };
  var TIERS = [['eco', 'اقتصادي'], ['mid', 'متوسّط'], ['pro', 'احترافي']];

  function candidates(slot, t) {
    var P = (store().products || []).filter(function (p) { return price(p) > 0 && !Array.isArray(p.package_items) && slot[2](p, t); });
    P.sort(function (a, b) { return price(a) - price(b); });
    var withImg = P.filter(function (p) { return (p.images || []).length; }); if (withImg.length) P = withImg;   /* بصورة أوّلاً — بلا صورة فقط إن لم يوجد غيرها */
    if (!P.length) return [];
    var start = t === 0 ? 0 : t === 1 ? Math.floor((P.length - 1) / 2) : P.length - 1;
    var out = [P[start]]; for (var d = 1; out.length < P.length; d++) { [start + d, start - d].forEach(function (i) { if (i >= 0 && i < P.length && out.indexOf(P[i]) < 0) out.push(P[i]); }); }
    return out;
  }
  /* الطقم: لكلّ خانة كمّيتها في المستوى · «بدّل» = offs[slot] */
  var PAIR = /زوج|مزدوج|dual|مرسلان|مرسلين|2\s*in\s*1|كيت ثنائي/i;
  function build(type, t, offs) {
    var T = TYPES[type]; if (!T) return null; var items = [], total = 0, used = {};
    T.slots.forEach(function (s) {
      var q = s[3][t]; if (!q) return;
      var c = candidates(s, t).filter(function (p) { return !used[p.id]; }); if (!c.length) return;   /* لا نفس المنتج في خانتين */
      var p = c[((offs && offs[s[0]]) || 0) % c.length]; used[p.id] = 1;
      if (s[0] === 'mic' && q > 1 && PAIR.test(p.name || '')) q = Math.ceil(q / 2);   /* «زوج مايك» = مايكان */
      items.push({ slot: s[0], label: s[1], p: p, qty: q, n: c.length }); total += price(p) * q;
    });
    return { items: items, total: Math.round(total * 100) / 100 };
  }

  var V = { type: '', t: 1, offs: {} };
  function css() {
    if (document.getElementById('gst-css')) return;
    var st = document.createElement('style'); st.id = 'gst-css';
    st.textContent = '#gst{position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}#gst.on{display:flex}' +
      '#gst .sh{background:#fff;width:100%;max-width:640px;max-height:92vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;font-family:Cairo,Tajawal,sans-serif;direction:rtl}' +
      '#gst .hd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;border-bottom:1px solid #f0f0f0}#gst .hd h3{font:800 17px Cairo,sans-serif;margin:0}' +
      '#gst .x{width:34px;height:34px;border-radius:50%;border:0;background:#f3f4f6;font-size:16px;cursor:pointer}#gst .bd{overflow-y:auto;padding:12px 16px 24px}' +
      '#gst .lbl{font:800 13px Cairo,sans-serif;color:#6b7280;margin:10px 2px 6px}#gst .types{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '#gst .ty{border:1.5px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px 8px;font:800 13.5px Cairo,sans-serif;cursor:pointer;text-align:center}#gst .ty b{display:block;font-size:24px;margin-bottom:4px}#gst .ty.on{border-color:#D5001C;background:#fff5f5;color:#b91c1c}' +
      '#gst .chips{display:flex;gap:6px;flex-wrap:wrap}#gst .chip{border:1.5px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 14px;font:700 13px Cairo,sans-serif;cursor:pointer}#gst .chip.on{background:#D5001C;border-color:#D5001C;color:#fff}' +
      '#gst .row{display:flex;gap:10px;align-items:center;border:1px solid #f0f0f0;border-radius:14px;padding:8px;margin-top:8px}#gst .row img{width:58px;height:58px;object-fit:contain;border-radius:10px;background:#f7f7f7;flex-shrink:0}' +
      '#gst .row .t{flex:1;min-width:0}#gst .row .s{font:700 11.5px Cairo,sans-serif;color:#6b7280}#gst .row .n{font:700 13px Cairo,sans-serif;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;cursor:pointer}' +
      '#gst .row .p{font:800 13px Cairo,sans-serif;color:#D5001C}#gst .sw{border:0;background:#f3f4f6;border-radius:10px;padding:6px 10px;font:700 12px Cairo,sans-serif;cursor:pointer;flex-shrink:0}' +
      '#gst .tot{margin-top:12px;font:800 15px Cairo,sans-serif;display:flex;justify-content:space-between}#gst .acts{display:flex;gap:8px;margin-top:10px}#gst .acts button{flex:1;height:44px;border-radius:12px;border:0;font:800 14px Cairo,sans-serif;cursor:pointer}' +
      '#gst .a1{background:#D5001C;color:#fff}#gst .a2{background:#f3f4f6;color:#111}#gst .note{font:600 12px Cairo,sans-serif;color:#6b7280;margin-top:8px;line-height:1.7}#gst .msg{margin-top:8px;font:700 13px Cairo,sans-serif;color:#047857}' +
      '@media(min-width:768px){#gst{align-items:center}#gst .sh{border-radius:22px}}';
    document.head.appendChild(st);
  }
  function el() {
    var m = document.getElementById('gst'); if (m) return m;
    css(); m = document.createElement('div'); m.id = 'gst';
    m.innerHTML = '<div class="sh"><div class="hd"><h3>🎬 جهّز استوديوك</h3><button type="button" class="x" data-x aria-label="إغلاق">✕</button></div><div class="bd" data-body></div></div>';
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-x]')) return close();
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'type') { V.type = b.dataset.v; V.offs = {}; V.msg = ''; }
      else if (a === 'tier') { V.t = +b.dataset.v; V.offs = {}; V.msg = ''; }
      else if (a === 'swap') { V.offs[b.dataset.v] = (V.offs[b.dataset.v] || 0) + 1; V.msg = ''; }
      else if (a === 'open') { var pid = b.dataset.v; close(true); try { g.openProductModal && g.openProductModal(pid); } catch (_) {} return; }
      else if (a === 'cart' || a === 'list') {
        var k = build(V.type, V.t, V.offs); if (!k || !k.items.length) return;
        var items = k.items.map(function (it) { return { id: String(it.p.id), qty: it.qty }; });
        if (a === 'cart') { var L = g.GMTLists; var r = L && L.addToCart ? L.addToCart(items) : { added: 0 }; V.msg = r.added ? '✓ أُضيف ' + r.added + ' منتجات للسلّة' : 'تعذّرت الإضافة'; }
        else if (g.GMTLists && g.GMTLists.openShared && g.GMTLists.enc) { close(true); g.GMTLists.openShared(g.GMTLists.enc('استوديو ' + TYPES[V.type].name) + '~' + items.map(function (it) { return g.GMTLists.enc(it.id) + '.' + it.qty; }).join(',')); return; }
      } else if (a === 'share') {
        var u = location.origin + location.pathname + '#studio=' + V.type + '&t=' + TIERS[V.t][0];
        if (navigator.share) navigator.share({ title: 'جهّز استوديوك — ' + TYPES[V.type].name, url: u }).catch(function () {}); else try { navigator.clipboard.writeText(u); V.msg = 'تم نسخ الرابط ✓'; } catch (_) {}
      }
      render();
    });
    document.body.appendChild(m); return m;
  }
  function render() {
    var body = el().querySelector('[data-body]'), h = '';
    h += '<div class="lbl">١ · نوع الاستوديو</div><div class="types">' + Object.keys(TYPES).map(function (k) { return '<button type="button" class="ty' + (V.type === k ? ' on' : '') + '" data-act="type" data-v="' + k + '"><b>' + TYPES[k].icon + '</b>' + esc(TYPES[k].name) + '</button>'; }).join('') + '</div>';
    if (V.type) {
      h += '<div class="lbl">٢ · المستوى</div><div class="chips">' + TIERS.map(function (x, i) { return '<button type="button" class="chip' + (V.t === i ? ' on' : '') + '" data-act="tier" data-v="' + i + '">' + x[1] + '</button>'; }).join('') + '</div>';
      var k = build(V.type, V.t, V.offs);
      h += '<div class="lbl">٣ · طقمك المقترح</div>';
      if (!k || !k.items.length) h += '<div class="note">ما عنا حالياً منتجات لهالطقم — اسألنا ومنجهّزلك ياه.</div>';
      else {
        h += k.items.map(function (it) {
          var img = (it.p.images || [])[0] || '';
          return '<div class="row">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '') + '<div class="t"><div class="s">' + esc(it.label) + (it.qty > 1 ? ' × ' + it.qty : '') + '</div><div class="n" data-act="open" data-v="' + esc(it.p.id) + '">' + esc(it.p.short_name || it.p.name) + '</div><div class="p">$' + (price(it.p) * it.qty).toFixed(2) + '</div></div>' +
            (it.n > 1 ? '<button type="button" class="sw" data-act="swap" data-v="' + esc(it.slot) + '">بدّل</button>' : '') + '</div>';
        }).join('');
        h += '<div class="tot"><span>المجموع</span><span>$' + k.total.toFixed(2) + '</span></div>';
        h += '<div class="acts"><button type="button" class="a1" data-act="cart">أضف الكلّ للسلّة</button><button type="button" class="a2" data-act="list">📋 احفظه قائمة</button></div>';
        h += '<div class="acts"><button type="button" class="a2" data-act="share">مشاركة الطقم</button></div>';
        h += '<div class="note">الأسعار أسعار المتجر الحالية · «بدّل» لاختيار قطعة غيرها · تحتاج مساعدة؟ تواصل معنا على واتساب.</div>';
        if (V.msg) h += '<div class="msg">' + esc(V.msg) + '</div>';
      }
    }
    body.innerHTML = h;
  }
  function open(opt) {
    opt = opt || {};
    if (opt.type && TYPES[opt.type]) { V.type = opt.type; V.offs = {}; }
    if (opt.tier) { var i = TIERS.map(function (x) { return x[0]; }).indexOf(opt.tier); if (i >= 0) V.t = i; }
    V.msg = ''; render(); el().classList.add('on'); document.body.style.overflow = 'hidden';
  }
  function close(keep) { var m = document.getElementById('gst'); if (m) m.classList.remove('on'); if (!keep) document.body.style.overflow = ''; }

  g.GMTStudio = { open: open, close: close, build: build, candidates: candidates, TYPES: TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
