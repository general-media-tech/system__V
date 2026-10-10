/* ═══════════════════════════════════════════════════════════════════════════
   gmt-order-to-invoice.js — ترحيل منتجات الأوردر إلى الفاتورة
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك (2026-09-27):
     «لتسهيل الفوترة: المنتجات اللي تمّ تعريفها من الجرد، لمّا منفوتر من نقطة
      البيع أو الأدمن، بدلاً ما نفوتر يدوياً — من الربط بأوردر تنتقل تلقائياً
      إلى الفاتورة. طبعاً الشي اللي مو موجود مخزون لا ينتقل، والشي اللي مكتوب
      كتابة لا ينتقل — أو ينتقل ككتابة بس ما تتسيَّف الفاتورة لحتى نحدّد
      المنتج. وطبعاً فيني أحدّد شو يلّي بينتقلوا، وفيني ما أنقلهن وأفوتر لحالي
      يدوي أقرأ أسماءهن وأفوترهن من البحث أو الباركود».

   لماذا ملفّ مشترك لا نسخة في كل صفحة؟
     لأنّ نقطة البيع والأدمن يفوتران من نفس الأوردرات. نسختان تعنيان أنّ
     تشديد قاعدةٍ في إحداهما يترك الأخرى تُرحّل ما لا يجوز ترحيله — بصمت.
     (قاعدة OWN-SINGLE-SOURCE.)

   🔴 العطل الذي وَلَد التشديد هنا:
     النسخة السابقة في pos.html كانت تُطابِق هكذا:
         allProducts.find(x => x.name.toLowerCase().includes(nm.toLowerCase()))
     أي أنّ «كروما» في الأوردر تُطابق **أوّل** منتج يحتوي الكلمة — «كروما
     مجموعة كاملة» مثلاً — فتدخل السلة بثقة تامّة **ويُخصم مخزون منتج آخر**.
     خطأٌ صامت في المخزون، وهو الشيء الذي بُني هذا النظام كلّه لمنعه.
     ⇒ المطابقة الآن بمحرّك gmt-suggest نفسه، وبنفس عتبة الأوردرات (97%)،
       وما دونها **يُعرَض ولا يُرحَّل** حتى يختار الإنسان.

   الاستعمال:
     GMTOrderToInvoice.open({
        order,                       // صفّ gmt_orders (فيه items_json أو product)
        catalog,                     // مصفوفة منتجات الفرع
        stockOf : p => Number(p[branchKey]) || 0,
        priceOf : p => Number(p.price) || 0,       // اختياري
        onConfirm: picked => { … },  // [{product, qty, price, from}]
        onSkip   : () => { … }       // «ما تنقل شيئاً — أفوتر يدوياً»
     });
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var CERTAIN = 0.97;   // نفس عتبة orders.html — تطابق تامّ أو بلا فواصل

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* قطع الأوردر من أي صيغة خزّنّاها عبر السنين. نبقي كل الصيغ: أوردرات
       قديمة في القاعدة لا تُعاد كتابتها. */
    function itemsOf(o) {
        var items = o && (o.items_json || o.items || o.order_items || o.products);
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = null; }
        }
        if (Array.isArray(items) && items.length) {
            return items.map(function (it) {
                return {
                    name: String(it.name || it.product_name || it.title || '').trim(),
                    qty: Math.max(1, Number(it.qty || it.quantity || 1) || 1),
                    pid: it.pid || it.product_id || null,
                    barcode: String(it.barcode || it.code || it.sku || '').trim(),
                    price: Number(it.price || it.unit_price) || 0
                };
            }).filter(function (x) { return x.name || x.barcode; });
        }
        /* أوردر قديم بلا items_json: النصّ «اسم × 2 | اسم آخر» */
        var s = String((o && o.product) || '').trim();
        if (!s) return [];
        return s.split(' | ').map(function (part) {
            var m = part.match(/^(.+?)\s*[×x]\s*(\d+)$/);
            return m ? { name: m[1].trim(), qty: parseInt(m[2], 10) || 1, pid: null, barcode: '', price: 0 }
                     : { name: part.trim(), qty: 1, pid: null, barcode: '', price: 0 };
        }).filter(function (x) { return x.name; });
    }

    /* ══ فهرس الكتالوج ══════════════════════════════════════════════════════
       ⚠️ `GMTSuggest.prepare()` يُرجع **صفوفاً جديدة** بحقول محدّدة (id · name ·
          barcode · price · qty · صورة…) ويُسقط ما عداها. وأعمدة مخزون الفرع في
          نقطة البيع اسمها اسم الفرع (`p[branch.key]`) — أي أنّها تُسقَط. فلو
          مرّرنا الصفوف المجهَّزة إلى `stockOf` لعاد صفراً دائماً و**لم يُرحَّل
          شيء أبداً**، بلا أي رسالة خطأ.
       ⇒ نُجهّز للمطابقة، ونحتفظ بفهرس إلى الصفوف **الأصلية** بالمعرّف، فكل ما
         يخرج من هنا (product) هو صفّ المضيف الأصلي بكل أعمدته.
       ولا نُضيف الأصل داخل صفوف prepare: صفحة الأوردرات تحفظ نتيجتها في
       localStorage، ومضاعفة حجمها قد تتجاوز حدّ التخزين. */
    function buildIndex(catalog) {
        var raw = catalog || [];
        var prepared = raw;
        try {
            if (global.GMTSuggest && global.GMTSuggest.prepare) prepared = global.GMTSuggest.prepare(raw);
        } catch (e) { prepared = raw; }
        var byId = {};
        for (var i = 0; i < raw.length; i++) byId[String(raw[i] && raw[i].id)] = raw[i];
        return { raw: raw, prepared: prepared, byId: byId,
                 orig: function (p) { return (p && byId[String(p.id)]) || p; } };
    }

    /* تصنيف قطعة واحدة: ok (تُرحَّل) · nostock (لا تُرحَّل) · text (تحتاج تحديد) */
    function classifyOne(it, idx, stockOf) {
        var catalog = idx.raw;
        var p = null, why = '', score = 1;

        /* ① معرّف المنتج إن حفظه الأوردر — أقوى دليل ولا يحتاج مطابقة نصّ.
              (أوردرات 2026-09-27 وما بعدها تحفظه عند تأكيد المنتج.) */
        if (it.pid) {
            p = find(catalog, function (x) { return String(x.id) === String(it.pid); });
            if (p) why = 'معرّف المنتج من الأوردر';
        }
        /* ② الباركود — تطابق تامّ لا يحتمل التأويل */
        if (!p && it.barcode) {
            p = find(catalog, function (x) { return String(x.barcode || '').trim() === it.barcode; });
            if (p) why = 'باركود';
        }
        /* ③ الاسم — بالمحرّك المتسامح، وبعتبة اليقين نفسها */
        if (!p && it.name && global.GMTSuggest) {
            var hits = [];
            try { hits = global.GMTSuggest.suggest(it.name, idx.prepared, 5, 0.3) || []; } catch (e) { hits = []; }
            if (hits.length && hits[0].score >= CERTAIN && !hits[0].tie) {
                p = idx.orig(hits[0].product); score = hits[0].score;
                why = 'تطابق ' + Math.round(score * 100) + '%';
            }
            return p
                ? withStock(p, why)
                : { state: 'text', item: it, cands: hits.slice(0, 5), reason: hits.length
                        ? 'أقرب نتيجة ' + Math.round(hits[0].score * 100) + '% — دون حدّ اليقين'
                        : 'لا مطابق في الجرد' };
        }
        if (!p) return { state: 'text', item: it, cands: [], reason: 'لا مطابق في الجرد' };
        return withStock(p, why);

        function withStock(prod, reason) {
            var have = stockOf ? Number(stockOf(prod)) || 0 : 0;
            if (have <= 0) return { state: 'nostock', item: it, product: prod, reason: 'غير متوفّر في مخزون الفرع' };
            if (have < it.qty) return { state: 'nostock', item: it, product: prod, have: have,
                                        reason: 'المتوفّر ' + have + ' والمطلوب ' + it.qty };
            return { state: 'ok', item: it, product: prod, have: have, reason: reason };
        }
    }

    function find(arr, fn) {
        for (var i = 0; i < (arr || []).length; i++) if (fn(arr[i])) return arr[i];
        return null;
    }

    function classify(order, catalog, stockOf) {
        var idx = buildIndex(catalog);
        return itemsOf(order).map(function (it) { return classifyOne(it, idx, stockOf); });
    }

    /* ══ الورقة ══════════════════════════════════════════════════════════════
       تُبنى بنفسها ولا تعتمد على أنماط الصفحة المضيفة: نقطة البيع والأدمن
       والأوردرات لكلٍّ نظام ألوانه، وورقةٌ ترث أنماط مضيفها تبدو مكسورة في
       واحدة منها على الأقل — ولا أحد يفتحها في الثلاثة ليرى.
       ══════════════════════════════════════════════════════════════════════ */
    function open(opts) {
        opts = opts || {};
        var catalog = opts.catalog || [];
        var stockOf = opts.stockOf || function () { return 0; };
        var priceOf = opts.priceOf || function (p) { return Number(p && p.price) || 0; };
        var idx = buildIndex(catalog);
        var rows = itemsOf(opts.order).map(function (it) { return classifyOne(it, idx, stockOf); });

        if (!rows.length) {
            if (opts.onEmpty) opts.onEmpty();
            else if (global.showToast) global.showToast('ℹ️ هذا الأوردر بلا قائمة قطع — أدخل القطع يدوياً', 'inf');
            return null;
        }

        var host = document.createElement('div');
        host.id = 'gmt-o2i';
        host.setAttribute('dir', 'rtl');
        host.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,20,30,.55);' +
            'display:flex;align-items:flex-end;justify-content:center;font-family:Cairo,system-ui,sans-serif';
        host.innerHTML =
            '<div style="background:#fff;width:100%;max-width:620px;max-height:92vh;display:flex;flex-direction:column;' +
                 'border-radius:18px 18px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.3)">' +
              '<div style="padding:13px 16px;border-bottom:1px solid #eef0f4;display:flex;align-items:center;gap:10px">' +
                '<div style="flex:1;min-width:0">' +
                  '<div style="font-size:14px;font-weight:900;color:#111827">📦 منتجات الأوردر</div>' +
                  '<div style="font-size:11px;font-weight:700;color:#5b6472">اختر ما يُنقَل إلى الفاتورة — والباقي تُدخِله يدوياً</div>' +
                '</div>' +
                '<button type="button" data-act="close" style="border:0;background:#f3f4f6;border-radius:10px;' +
                        'width:32px;height:32px;font-size:16px;cursor:pointer;color:#5b6472">✕</button>' +
              '</div>' +
              '<div data-part="list" style="overflow:auto;padding:10px 12px;flex:1"></div>' +
              '<div data-part="foot" style="padding:12px;border-top:1px solid #eef0f4;display:grid;grid-template-columns:2fr 1fr;gap:8px"></div>' +
            '</div>';
        document.body.appendChild(host);

        var listEl = host.querySelector('[data-part="list"]');
        var footEl = host.querySelector('[data-part="foot"]');

        function render() {
            listEl.innerHTML = rows.map(function (r, i) {
                var it = r.item;
                var tone = r.state === 'ok' ? ['#ECFDF5', '#A7F3D0', '#047857', '✅']
                         : r.state === 'nostock' ? ['#FEF2F2', '#FECACA', '#B91C1C', '⛔']
                         : ['#FFFBEB', '#FCD34D', '#92400E', '✍️'];
                var title = r.product ? r.product.name : it.name;
                var checked = r.state === 'ok' && r.pick !== false;
                return '<div style="border:1.5px solid ' + tone[1] + ';background:' + tone[0] + ';border-radius:12px;' +
                            'padding:10px 12px;margin-bottom:8px">' +
                    '<label style="display:flex;align-items:flex-start;gap:9px;cursor:' + (r.state === 'ok' ? 'pointer' : 'default') + '">' +
                      (r.state === 'ok'
                        ? '<input type="checkbox" data-pick="' + i + '"' + (checked ? ' checked' : '') +
                          ' style="width:18px;height:18px;margin-top:2px;accent-color:#047857">'
                        : '<span style="font-size:15px;line-height:1.2">' + tone[3] + '</span>') +
                      '<span style="min-width:0;flex:1">' +
                        '<span dir="auto" style="display:block;font-size:13px;font-weight:900;color:#111827;overflow-wrap:anywhere">' +
                           esc(title) + ' × ' + it.qty + '</span>' +
                        '<span style="display:block;margin-top:2px;font-size:10.5px;font-weight:800;color:' + tone[2] + '">' +
                           esc(r.reason || '') +
                           (r.state === 'ok' ? ' · متوفّر ' + r.have + ' · $' + priceOf(r.product) : '') +
                        '</span>' +
                        (r.state !== 'ok' && r.item.name !== title
                           ? '<span style="display:block;font-size:10px;color:#5b6472">في الرسالة: ' + esc(it.name) + '</span>' : '') +
                      '</span>' +
                    '</label>' +
                    (r.state === 'ok' ? '' :
                      '<div style="margin-top:8px">' +
                        '<input type="search" data-fix="' + i + '" value="' + esc(it.name || '') + '" placeholder="اكتب الاسم أو امسح الباركود…" inputmode="search" ' +
                               'style="width:100%;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:9px;' +
                                      'font-family:inherit;font-size:12px;font-weight:700;outline:none;box-sizing:border-box">' +
                        '<div data-res="' + i + '"></div>' +
                      '</div>') +
                  '</div>';
            }).join('');

            /* (٨ ت — تدقيق المطابقة) طلبك: «بيعطيك كتابة اسم المنتج — هو بيبحث عنه أو ممكن يمسحه يبحث عنه بالمنتجات —
               وطاب قائمة منسدلة». كانت الخانة فارغة. الآن اسمُ الأوردر مكتوبٌ فيها سلفاً والقائمة ظاهرةٌ فوراً،
               ومسحُه (✕) يفتح بحثاً جديداً. */
            setTimeout(function () {
                listEl.querySelectorAll('input[data-fix]').forEach(function (inp) {
                    if (inp.value) inp.dispatchEvent(new Event('input', { bubbles: true }));
                });
            }, 0);
            var ok = rows.filter(function (r) { return r.state === 'ok' && r.pick !== false; }).length;
            var left = rows.length - ok;
            footEl.innerHTML =
                '<button type="button" data-act="go" style="border:0;border-radius:12px;padding:13px;cursor:pointer;' +
                        'background:#047857;color:#fff;font-family:inherit;font-size:13px;font-weight:900">' +
                   'انقل ' + ok + ' منتجاً' + (left ? ' (' + left + ' لا يُنقَل)' : '') + '</button>' +
                '<button type="button" data-act="skip" style="border:1.5px solid #e5e7eb;border-radius:12px;padding:13px;' +
                        'cursor:pointer;background:#fff;color:#374151;font-family:inherit;font-size:12.5px;font-weight:900">' +
                   'أفوتر يدوياً</button>';
        }

        function resolve(i, prod) {
            var r = rows[i];
            var have = Number(stockOf(prod)) || 0;
            if (have <= 0) {
                r.state = 'nostock'; r.product = prod;
                r.reason = 'غير متوفّر في مخزون الفرع';
            } else {
                r.state = 'ok'; r.product = prod; r.have = have;
                r.reason = 'حدّدته أنت';
                if (have < r.item.qty) { r.state = 'nostock'; r.reason = 'المتوفّر ' + have + ' والمطلوب ' + r.item.qty; }
            }
            render();
        }

        listEl.addEventListener('input', function (e) {
            var fix = e.target.getAttribute && e.target.getAttribute('data-fix');
            if (fix === null || fix === undefined) return;
            var box = listEl.querySelector('[data-res="' + fix + '"]');
            var q = String(e.target.value || '').trim();
            /* (2026-10-05 ص) البند ٤٢: «كتابة/بحث/مسح/قائمة منسدلة» — قارئ الباركود يكتب كلوحة مفاتيح،
               فإن طابق ما كُتب باركوداً بعينه يُحدَّد المنتج فوراً بلا قائمة. */
            if (q.length >= 4) {
                var exact = catalog.filter(function (p) { return p && p.barcode && String(p.barcode).trim() === q; });
                if (exact.length === 1) { resolve(+fix, exact[0]); return; }
            }
            if (q.length < 2 || !global.GMTSuggest) { box.innerHTML = ''; return; }
            var hits = [];
            try { hits = global.GMTSuggest.suggest(q, idx.prepared, 6, 0.25) || []; } catch (er) { hits = []; }
            box.innerHTML = hits.length ? hits.map(function (h) {
                var prod = idx.orig(h.product);
                var have = Number(stockOf(prod)) || 0;
                return '<button type="button" data-use="' + fix + '" data-pid="' + esc(prod.id) + '" ' +
                        'style="display:flex;align-items:center;gap:9px;width:100%;text-align:right;border:0;border-bottom:1px solid #f3f4f6;' +
                               'background:#fff;padding:7px 10px;cursor:pointer;font-family:inherit">' +
                  /* (ص) صورة المنتج في القائمة — كي يختار بعينه لا بالاسم وحده */
                  (prod.image_url ? '<img src="' + esc(prod.image_url) + '" alt="" loading="lazy" style="width:38px;height:38px;object-fit:cover;border-radius:9px;background:#f3f4f6;flex:0 0 auto" onerror="this.style.visibility=\'hidden\'">'
                                  : '<span style="width:38px;height:38px;border-radius:9px;background:#f3f4f6;flex:0 0 auto"></span>') +
                  '<span style="flex:1;min-width:0">' +
                  '<span dir="auto" style="display:block;font-size:12.5px;font-weight:900;color:#111827">' + esc(prod.name) + '</span>' +
                  '<span style="display:block;font-size:10px;font-weight:800;color:' + (have > 0 ? '#047857' : '#B91C1C') + '">' +
                     (have > 0 ? 'متوفّر ' + have : 'غير متوفّر') + ' · $' + priceOf(prod) +
                     ' · تشابه ' + Math.round(h.score * 100) + '%' + (prod.barcode ? ' · ' + esc(prod.barcode) : '') + '</span></span>' +
                '</button>';
            }).join('') : '<div style="padding:7px 10px;font-size:11px;font-weight:700;color:#5b6472">لا مطابق</div>';
        });

        host.addEventListener('click', function (e) {
            var t = e.target.closest ? e.target.closest('[data-act],[data-use],[data-pick]') : null;
            if (!t) { if (e.target === host) close(); return; }
            var act = t.getAttribute('data-act');
            if (act === 'close') { close(); return; }
            if (act === 'skip') { close(); if (opts.onSkip) opts.onSkip(); return; }
            if (act === 'go') {
                var picked = rows.filter(function (r) { return r.state === 'ok' && r.pick !== false; })
                    .map(function (r) {
                        return { product: r.product, qty: r.item.qty,
                                 price: r.item.price > 0 ? r.item.price : priceOf(r.product),
                                 from: r.reason };
                    });
                var left = rows.length - picked.length;
                close();
                if (opts.onConfirm) opts.onConfirm(picked, left, rows);
                return;
            }
            var use = t.getAttribute('data-use');
            if (use !== null && use !== undefined) {
                var pid = t.getAttribute('data-pid');
                var prod = idx.byId[String(pid)];
                if (prod) resolve(Number(use), prod);
                return;
            }
            var pick = t.getAttribute('data-pick');
            if (pick !== null && pick !== undefined) {
                rows[Number(pick)].pick = !!t.checked;
                render();                       // لتحديث عدّاد الزرّ
            }
        });

        function close() { if (host && host.parentNode) host.parentNode.removeChild(host); }

        render();
        return { close: close, rows: rows };
    }

    global.GMTOrderToInvoice = { open: open, classify: classify, items: itemsOf, CERTAIN: CERTAIN };
}(typeof window !== 'undefined' ? window : this));
