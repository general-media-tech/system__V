/* ═══════════════════════════════════════════════════════════════════════════
   gmt-lists.js — «📋 قوائمي» قوائم تجميع المشتريات + مشاركتها برابط
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك: «العميل يستطيع إنشاء قائمة باسم «تجهيز استوديو» وإضافة المنتجات إليها ومشاركة القائمة مع شخص آخر».
   التصميم (بلا قاعدة بيانات وبلا حساب):
     • القوائم في متصفّح الزبون: localStorage['gmt_lists_v1'] = [{id, name, items:[{id, opt, qty}], at}] — حدّ ٢٠ قائمة و٦٠ منتجاً.
     • المشاركة: store.html#list=<اسم مرمّز>~<id>.<qty>,<id>.<qty> — لا سعر ولا HTML في الرابط؛ الأسعار تُقرأ من المتجر وقت الفتح.
     • منتجٌ ليس في المتجر ⇒ «لم يعد متوفّراً» ولا يُضاف للسلّة؛ ومنتجٌ بلا سعر (≤ 0) لا يُضاف للسلّة أيضاً.
     • كلّ نصٍّ من الزبون يمرّ عبر esc() · لا alert/confirm/prompt (الاسم والتأكيد داخل النافذة).
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var LS = 'gmt_lists_v1', MAX_LISTS = 20, MAX_ITEMS = 60, MAX_QTY = 99, MAX_NAME = 60;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store() { try { return (g.__gmtStore && g.__gmtStore()) || {}; } catch (_) { return {}; } }
  function cur() { try { return typeof CONFIG !== 'undefined' && CONFIG.CURRENCY ? CONFIG.CURRENCY : '$'; } catch (_) { return '$'; } }
  function money(v) { var r = Math.round(v * 100) / 100; return cur() + (Number.isInteger(r) ? String(r) : r.toFixed(2)); }
  function product(id) { var P = store().products || []; for (var i = 0; i < P.length; i++) if (String(P[i].id) === String(id)) return P[i]; return null; }
  function priceOf(p) { return p ? (parseFloat(p.price || 0) || 0) : 0; }
  function clampQty(q) { q = parseInt(q, 10); return isNaN(q) || q < 1 ? 1 : Math.min(q, MAX_QTY); }
  function cleanName(n) { return String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME); }
  function uid() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ── التخزين ── */
  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(LS) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(function (l) { return l && typeof l === 'object' && l.id; }).map(function (l) {
        return { id: String(l.id), name: cleanName(l.name) || 'قائمة', at: l.at || 0, items: (Array.isArray(l.items) ? l.items : []).filter(function (it) { return it && it.id != null; }).slice(0, MAX_ITEMS).map(function (it) { return { id: String(it.id), opt: it.opt ? String(it.opt) : '', qty: clampQty(it.qty) }; }) };
      }).slice(0, MAX_LISTS);
    } catch (_) { return []; }
  }
  function persist(a) { try { localStorage.setItem(LS, JSON.stringify(a)); return true; } catch (_) { return false; } }
  function byId(a, id) { for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }

  /* ── المجموع والتوفّر (بالأسعار الحالية) ── */
  function state(it) { var p = product(it.id); if (!p) return 'gone'; if (!(priceOf(p) > 0)) return 'noprice'; return 'ok'; }
  function totals(items) {
    var t = 0, ok = 0, bad = 0;
    items.forEach(function (it) { if (state(it) === 'ok') { t += priceOf(product(it.id)) * it.qty; ok++; } else bad++; });
    return { total: t, ok: ok, bad: bad };
  }

  /* ── الرابط ── */
  function enc(s) { return encodeURIComponent(String(s)).replace(/\./g, '%2E').replace(/~/g, '%7E'); }
  function dec(s) { return decodeURIComponent(s); }
  function linkFor(l) { return location.origin + location.pathname + '#list=' + enc(l.name) + '~' + l.items.map(function (it) { return enc(it.id) + '.' + it.qty; }).join(','); }
  function parseShared(raw) {
    try {
      raw = String(raw || ''); var i = raw.indexOf('~');
      var name = cleanName(dec(i < 0 ? raw : raw.slice(0, i))) || 'قائمة مشتركة', items = [], seen = {};
      (i < 0 ? '' : raw.slice(i + 1)).split(',').forEach(function (part) {
        var j = part.lastIndexOf('.'); if (j < 1) return;
        var id; try { id = dec(part.slice(0, j)); } catch (_) { return; }
        if (!id || id.length > 80 || seen[id] || items.length >= MAX_ITEMS) return;
        seen[id] = 1; items.push({ id: id, opt: '', qty: clampQty(part.slice(j + 1)) });
      });
      return { id: '', name: name, items: items };
    } catch (_) { return null; }
  }

  /* ── السلّة: نفس طريقة المتجر (store.cart + gmt_cart + الشارة) ── */
  function addToCart(items) {
    var S = store(), added = 0, skipped = 0;
    if (!S.cart) return { added: 0, skipped: items.length };
    items.forEach(function (it) {
      var p = product(it.id), pr = priceOf(p);
      if (!p || !(pr > 0)) { skipped++; return; }
      var raw = p.stock !== undefined ? parseInt(p.stock, 10) : 0, stock = raw && raw > 0 ? raw : 9999;
      var ex = null; S.cart.forEach(function (c) { if (c._cartId === p.id) ex = c; });
      if (ex) ex.qty = Math.min((ex.qty || 1) + it.qty, stock);
      else S.cart.push(Object.assign({}, p, { _cartId: p.id, price: pr, qty: Math.min(it.qty, stock) }));
      added++;
    });
    try { localStorage.setItem('gmt_cart', JSON.stringify(S.cart)); } catch (_) {}
    try { if (g.updateCartBadge) g.updateCartBadge(); } catch (_) {}
    return { added: added, skipped: skipped };
  }

  /* ── الواجهة ── */
  var V = { view: 'home', id: '', pid: '', shared: null, msg: '', msgBad: false, confirm: '' };
  function css() {
    if (document.getElementById('gls-css')) return;
    var st = document.createElement('style'); st.id = 'gls-css';
    st.textContent = '#gls{position:fixed;inset:0;z-index:250;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}#gls.on{display:flex}' +
      '#gls .sh{background:#fff;width:100%;max-width:640px;max-height:92vh;border-radius:22px 22px 0 0;display:flex;flex-direction:column;font-family:Cairo,Tajawal,sans-serif;direction:rtl}' +
      '#gls .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 18px 10px;border-bottom:1px solid #f0f0f0}#gls .hd h3{font:800 17px Cairo,sans-serif;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#gls .x{width:34px;height:34px;border-radius:50%;border:0;background:#f3f4f6;font-size:16px;cursor:pointer;flex-shrink:0}#gls .bd{overflow-y:auto;padding:12px 16px 24px}' +
      '#gls input{width:100%;box-sizing:border-box;height:40px;border:1.5px solid #e5e7eb;border-radius:12px;padding:0 12px;font:600 14px Cairo,sans-serif}' +
      '#gls .row{border:1.5px solid #f0f0f0;border-radius:14px;padding:10px 12px;margin-top:10px}#gls .nm{font:800 14.5px Cairo,sans-serif;word-break:break-word}#gls .sub{font:600 12.5px Cairo,sans-serif;color:#6b7280;margin-top:2px}' +
      '#gls .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#gls .b{border:0;background:#f3f4f6;border-radius:10px;padding:7px 12px;font:700 12.5px Cairo,sans-serif;cursor:pointer;color:#111}#gls .b.p{background:#D5001C;color:#fff}#gls .b.d{background:#fee2e2;color:#b91c1c}' +
      '#gls .new{display:flex;gap:6px;margin-top:6px}#gls .new .b{flex-shrink:0;height:40px}#gls .msg{margin:8px 0 0;padding:8px 10px;border-radius:10px;background:#ecfdf5;color:#047857;font:700 12.5px Cairo,sans-serif}#gls .msg.bad{background:#fef2f2;color:#b91c1c}' +
      '#gls .empty{text-align:center;color:#6b7280;font:600 13.5px Cairo,sans-serif;padding:18px 8px;line-height:1.8}#gls .tot{font:800 15px Cairo,sans-serif;margin:12px 2px 0}' +
      '#gls .grid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:10px}#gls .it{display:flex;flex-direction:column;align-items:center;gap:6px}#gls .it.gone{opacity:.5}' +
      '#gls .gonebox{width:160px;min-height:120px;border:1.5px dashed #d1d5db;border-radius:20px;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font:700 12.5px Cairo,sans-serif;color:#6b7280;box-sizing:border-box}' +
      '#gls .q{display:flex;align-items:center;gap:8px;font:800 14px Cairo,sans-serif}#gls .q button{width:28px;height:28px;border-radius:8px;border:0;background:#f3f4f6;font:800 16px Cairo,sans-serif;cursor:pointer}' +
      '@media(min-width:768px){#gls{align-items:center}#gls .sh{border-radius:22px}}';
    document.head.appendChild(st);
  }
  function el() {
    var m = document.getElementById('gls'); if (m) return m;
    css(); m = document.createElement('div'); m.id = 'gls';
    m.innerHTML = '<div class="sh"><div class="hd"><h3 data-gls-title>📋 قوائمي</h3><button type="button" class="x" data-act="close" aria-label="إغلاق">✕</button></div><div class="bd" data-gls-body></div></div>';
    m.addEventListener('click', function (e) {
      if (e.target === m) { close(); return; }
      var b = e.target.closest('[data-act]'); if (!b || !m.contains(b)) return;
      act(b.getAttribute('data-act'), b.getAttribute('data-id') || '', b);
    });
    m.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-gls-name]')) { e.preventDefault(); act(V.view === 'add' ? 'newadd' : 'new', '', e.target); } });
    document.body.appendChild(m); return m;
  }
  function say(t, bad) { V.msg = t; V.msgBad = !!bad; }
  function newForm(actName) { return '<div class="new"><input type="text" maxlength="' + MAX_NAME + '" data-gls-name placeholder="اسم قائمة جديدة: مثلاً تجهيز استوديو"><button type="button" class="b p" data-act="' + actName + '">+ قائمة جديدة</button></div>'; }
  function msgHtml() { return V.msg ? '<div class="msg' + (V.msgBad ? ' bad' : '') + '" data-gls-msg>' + esc(V.msg) + '</div>' : ''; }
  function cards(items, editable) {
    var h = '<div class="grid" data-gls-grid>' + items.map(function (it, i) {
      var gone = state(it) === 'gone';
      return '<div class="it' + (gone ? ' gone' : '') + '" data-slot="' + i + '">' + (gone ? '<div class="gonebox">لم يعد متوفّراً</div>' : '') +
        (state(it) === 'noprice' ? '<div class="sub">سعره عند الطلب — لا يُضاف للسلّة</div>' : '') +
        '<div class="q">' + (editable ? '<button type="button" data-act="dec" data-id="' + esc(it.id) + '" aria-label="أنقص">−</button>' : '') + '<span>× ' + it.qty + '</span>' + (editable ? '<button type="button" data-act="inc" data-id="' + esc(it.id) + '" aria-label="زِد">+</button><button type="button" class="b d" data-act="rm" data-id="' + esc(it.id) + '">حذف</button>' : '') + '</div></div>';
    }).join('') + '</div>';
    return h;
  }
  function fillCards(items) {
    var body = el().querySelector('[data-gls-body]');
    items.forEach(function (it, i) {
      var p = product(it.id), slot = body.querySelector('[data-slot="' + i + '"]');
      if (!p || !slot || !g._buildProductCard) return;
      try { var c = g._buildProductCard(p); c.addEventListener('click', function () { close(); }, true); slot.insertBefore(c, slot.firstChild); } catch (_) {}
    });
  }
  function render() {
    var m = el(), body = m.querySelector('[data-gls-body]'), title = m.querySelector('[data-gls-title]'), all = load(), h = '', l, t, fillItems = null;
    if (V.view === 'home') {
      title.textContent = '📋 قوائمي';
      h += '<div class="sub">اجمع منتجاتك في قائمة (مثلاً «تجهيز استوديو») وشاركها مع من تريد.</div>' + newForm('new') + msgHtml();
      h += all.length ? all.map(function (L) {
        t = totals(L.items);
        return '<div class="row" data-list="' + esc(L.id) + '"><div class="nm">' + esc(L.name) + '</div><div class="sub">' + L.items.length + ' منتج · المجموع الحالي ' + esc(money(t.total)) + (t.bad ? ' · ' + t.bad + ' غير متوفّر/بلا سعر' : '') + '</div>' +
          (V.confirm === L.id ? '<div class="btns"><span class="sub" style="align-self:center">حذف «' + esc(L.name) + '» نهائياً؟</span><button type="button" class="b d" data-act="delyes" data-id="' + esc(L.id) + '">نعم، احذف</button><button type="button" class="b" data-act="delno">تراجع</button></div>' :
          '<div class="btns"><button type="button" class="b" data-act="open" data-id="' + esc(L.id) + '">فتح</button><button type="button" class="b p" data-act="cartall" data-id="' + esc(L.id) + '">أضف الكلّ للسلّة</button><button type="button" class="b" data-act="share" data-id="' + esc(L.id) + '">شارك</button><button type="button" class="b d" data-act="del" data-id="' + esc(L.id) + '">حذف</button></div>') + '</div>';
      }).join('') : '<div class="empty">ما عندك قوائم بعد — اكتب اسماً فوق لإنشاء أولى قوائمك</div>';
    } else if (V.view === 'detail') {
      l = byId(all, V.id);
      if (!l) { V.view = 'home'; return render(); }
      t = totals(l.items); title.textContent = '📋 ' + l.name;
      h += '<div class="btns" style="margin-top:0"><button type="button" class="b" data-act="home">‹ قوائمي</button><button type="button" class="b p" data-act="cartall" data-id="' + esc(l.id) + '">أضف الكلّ للسلّة</button><button type="button" class="b" data-act="share" data-id="' + esc(l.id) + '">شارك</button></div>' + msgHtml();
      h += '<div class="tot" data-gls-total>' + l.items.length + ' منتج · المجموع الحالي ' + esc(money(t.total)) + '</div>';
      h += l.items.length ? cards(l.items, true) : '<div class="empty">القائمة فارغة — افتح أيّ منتج واضغط «📋 أضف لقائمة»</div>'; fillItems = l.items;
    } else if (V.view === 'shared') {
      l = V.shared || { name: '', items: [] }; t = totals(l.items); title.textContent = '📋 ' + l.name;
      h += '<div class="sub">قائمة مشاركة معك (للقراءة)</div><div class="btns"><button type="button" class="b" data-act="save">احفظها عندي</button><button type="button" class="b p" data-act="cartall" data-id="">أضف الكلّ للسلّة</button></div>' + msgHtml();
      h += '<div class="tot" data-gls-total>' + l.items.length + ' منتج · المجموع الحالي ' + esc(money(t.total)) + '</div>';
      h += l.items.length ? cards(l.items, false) : '<div class="empty">القائمة فارغة</div>'; fillItems = l.items;
    } else if (V.view === 'add') {
      var p = product(V.pid); title.textContent = '📋 أضف لقائمة';
      h += '<div class="sub">' + esc(p ? (p.short_name || p.name) : '') + '</div>' + newForm('newadd') + msgHtml();
      h += all.length ? all.map(function (L) { var has = L.items.some(function (it) { return it.id === String(V.pid); });
        return '<div class="row"><div class="nm">' + esc(L.name) + '</div><div class="sub">' + L.items.length + ' منتج' + (has ? ' · موجود فيها ✓' : '') + '</div><div class="btns"><button type="button" class="b p" data-act="addto" data-id="' + esc(L.id) + '">' + (has ? 'زِد الكمّية' : 'أضف إلى هذه القائمة') + '</button></div></div>'; }).join('') : '<div class="empty">أنشئ قائمتك الأولى من الحقل أعلاه</div>';
      h += '<div class="btns"><button type="button" class="b" data-act="home">📋 قوائمي</button></div>';
    }
    body.innerHTML = h;
    if (fillItems) fillCards(fillItems);
  }
  function addItem(l, pid, qty) {
    var found = null; l.items.forEach(function (it) { if (it.id === String(pid)) found = it; });
    if (found) { found.qty = clampQty(found.qty + qty); return true; }
    if (l.items.length >= MAX_ITEMS) return false;
    l.items.push({ id: String(pid), opt: '', qty: clampQty(qty) }); return true;
  }
  function readName() { var i = el().querySelector('[data-gls-name]'); return i ? cleanName(i.value) : ''; }
  function createList(name, a) {
    if (!name) { say('اكتب اسماً للقائمة أوّلاً', true); return null; }
    if (a.length >= MAX_LISTS) { say('وصلت للحدّ الأقصى (' + MAX_LISTS + ' قائمة) — احذف قائمةً قديمة', true); return null; }
    var l = { id: uid(), name: name, items: [], at: Date.now() }; a.push(l); return l;
  }
  function act(a, id, node) {
    var all = load(), l = id ? byId(all, id) : null; V.msg = '';
    if (a === 'close') return close();
    if (a === 'home') { V.view = 'home'; V.confirm = ''; return render(); }
    if (a === 'new') { var nl = createList(readName(), all); if (nl) { persist(all); say('تمّ إنشاء «' + nl.name + '» ✓'); } return render(); }
    if (a === 'newadd') {
      var n2 = createList(readName(), all);
      if (n2) { var okk = addItem(n2, V.pid, g.__gmtListQty ? g.__gmtListQty() : 1); persist(all); say(okk ? 'تمّ إنشاء «' + n2.name + '» وإضافة المنتج إليها ✓' : 'تمّ الإنشاء لكن تعذّرت الإضافة', !okk); }
      return render();
    }
    if (a === 'addto') {
      if (!l) return render();
      if (addItem(l, V.pid, g.__gmtListQty ? g.__gmtListQty() : 1)) { persist(all); say('أُضيف إلى «' + l.name + '» ✓'); } else say('القائمة ممتلئة (' + MAX_ITEMS + ' منتجاً)', true);
      return render();
    }
    if (a === 'open') { if (l) { V.view = 'detail'; V.id = l.id; } return render(); }
    if (a === 'del') { V.confirm = id; return render(); }
    if (a === 'delno') { V.confirm = ''; return render(); }
    if (a === 'delyes') { persist(all.filter(function (x) { return x.id !== id; })); V.confirm = ''; say('تمّ حذف القائمة'); return render(); }
    if (a === 'inc' || a === 'dec' || a === 'rm') {
      var d = byId(all, V.id); if (!d) return render();
      d.items = d.items.filter(function (it) { if (it.id !== id) return true; if (a === 'rm') return false; it.qty = clampQty(it.qty + (a === 'inc' ? 1 : -1)); return true; });
      persist(all); return render();
    }
    if (a === 'cartall') {
      var src = V.view === 'shared' ? V.shared : l; if (!src) return render();
      var r = addToCart(src.items);
      say(r.added ? 'أُضيف ' + r.added + ' منتج للسلّة ✓' + (r.skipped ? ' · تخطّينا ' + r.skipped + ' (غير متوفّر أو بلا سعر)' : '') : 'لا منتج قابل للإضافة (غير متوفّر أو بلا سعر)', !r.added);
      return render();
    }
    if (a === 'save') {
      if (!V.shared) return render();
      var c = createList(V.shared.name, all);
      if (c) { c.items = V.shared.items.map(function (it) { return { id: it.id, opt: '', qty: it.qty }; }); persist(all); say('تمّ حفظ القائمة عندك ✓'); } return render();
    }
    if (a === 'share') {
      var sl = V.view === 'shared' ? V.shared : l; if (!sl || !sl.items.length) { say('القائمة فارغة — لا شيء لمشاركته', true); return render(); }
      var u = linkFor(sl);
      if (navigator.share) { navigator.share({ title: sl.name, url: u }).catch(function () {}); say('جاهز للمشاركة'); }
      else { try { navigator.clipboard.writeText(u); say('تمّ نسخ رابط القائمة ✓'); } catch (_) { say(u); } }
      return render();
    }
  }
  function openEl() { var m = el(); render(); m.classList.add('on'); document.body.style.overflow = 'hidden'; }
  function open() { V.view = 'home'; V.msg = ''; V.confirm = ''; openEl(); }
  function openAdd(pid) { V.view = 'add'; V.pid = String(pid); V.msg = ''; openEl(); }
  function openShared(raw) { var s = parseShared(raw); if (!s) return; V.view = 'shared'; V.shared = s; V.msg = ''; openEl(); }
  function close() { var m = document.getElementById('gls'); if (m) m.classList.remove('on'); document.body.style.overflow = ''; }

  g.GMTLists = { open: open, openAdd: openAdd, openShared: openShared, close: close, load: load, linkFor: linkFor, parseShared: parseShared, totals: totals };
})(typeof window !== 'undefined' ? window : globalThis);
