/* ═══════════════════════════════════════════════════════════════════════════
   gmt-scan.js — مسح الباركود: بالكاميرا الخلفية وبالسكانر المربوط
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك (2026-09-27):
     «زرّ البحث عن منتج بالباركود مو موجود… وبدّك تحطّ في بالك إنّه ممكن البحث
      بالكاميرا الخلفية أو ممكن البحث أيضاً في جهاز سكانر يكون مربوط».

   طريقان مختلفان تماماً — ولهذا لا يكفي زرّ واحد:
     ① 📷 **الكاميرا**: زرّ يفتح عدسةً خلفية ويقرأ الرمز (ZXing).
     ② ⌨️ **السكانر المربوط**: لا يحتاج زرّاً إطلاقاً. أجهزة الباركود (USB أو
        بلوتوث) تتصرّف كلوحة مفاتيح: تكتب الرمز **بسرعة غير بشرية** ثمّ Enter.
        فنُنصِت للنمط الزمني لا للجهاز: دفعةٌ من الحروف بفواصل أقلّ من 35ms
        تنتهي بـEnter ⇒ سكانر. الإنسان لا يكتب بهذه السرعة.

   ⚠️ ولماذا الإنصات خطِر إن أُسيء؟ لأنّه يسمع كل ضغطة في الصفحة. فلو التقط
      كتابةً بشرية لسرق حرفاً من حقلٍ يُملأ يدوياً. الحواجز:
        · فاصل زمني صارم (35ms) بين الحروف
        · طول لا يقلّ عن 4 محارف
        · أرقام وحروف لاتينية فقط (الباركود لا يحوي عربية)
        · لا نلتقط داخل textarea ولا حقل كلمة سرّ
        · نُلغي الالتقاط إن تجاوز الفاصل الحدَّ — لا نُراكم عبر الزمن

   الاستعمال:
     GMTScan.camera(code => …)      // يفتح الكاميرا مرّة ويعيد الرمز
     GMTScan.listen(code => …)      // سكانر مربوط — أنصِت ما دامت الصفحة مفتوحة
     GMTScan.attach(inputEl, fn)    // زرّ 📷 بجانب حقل + إنصات — الأسهل
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var ZX_SRC = 'lib/zxing.min.js';
    var _listening = false;

    function toast(msg, kind) {
        try {
            if (global.showToast) return global.showToast(msg, kind || 'inf');
        } catch (e) {}
        try { console.log('[scan]', msg); } catch (e) {}
    }

    function loadZXing() {
        return new Promise(function (ok, bad) {
            if (typeof global.ZXing !== 'undefined') return ok(global.ZXing);
            var s = document.createElement('script');
            s.src = ZX_SRC + '?v=20261003';
            s.onload = function () { global.ZXing ? ok(global.ZXing) : bad(new Error('ZXing لم تُعرَّف')); };
            s.onerror = function () { bad(new Error('تعذّر تحميل مكتبة المسح')); };
            document.head.appendChild(s);
        });
    }

    /* ── ① الكاميرا ───────────────────────────────────────────────────────── */
    function camera(onCode) {
        /* getUserMedia لا تعمل إلّا في سياق آمن (https). والموقع على GitHub Pages
           https، لكنّ من يفتح الملفّ من القرص (file://) لن تعمل عنده — فنقول
           السبب بدل أن نبدو معطّلين. */
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast('الكاميرا غير متاحة هنا — افتح الصفحة عبر https', 'err');
            return;
        }
        var old = document.getElementById('gmt-scan-ui');
        if (old) old.remove();

        var ui = document.createElement('div');
        ui.id = 'gmt-scan-ui';
        ui.setAttribute('dir', 'rtl');
        ui.style.cssText = 'position:fixed;inset:0;z-index:100001;background:#000;display:flex;' +
            'flex-direction:column;font-family:Cairo,system-ui,sans-serif';
        ui.innerHTML =
            '<div style="padding:12px 14px;background:#111;color:#fff;display:flex;align-items:center;gap:10px">' +
              '<div style="flex:1;font-size:13.5px;font-weight:900">📷 وجّه الكاميرا إلى الباركود</div>' +
              '<button type="button" data-x style="border:0;background:#374151;color:#fff;border-radius:10px;' +
                      'width:34px;height:34px;font-size:16px;cursor:pointer">✕</button>' +
            '</div>' +
            '<div style="position:relative;flex:1;overflow:hidden;background:#000">' +
              '<video id="gmt-scan-video" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>' +
              '<div style="position:absolute;inset:14% 8%;border:3px solid rgba(255,255,255,.85);border-radius:14px;' +
                          'box-shadow:0 0 0 9999px rgba(0,0,0,.35)"></div>' +
            '</div>' +
            '<div data-msg style="padding:11px 14px;background:#111;color:#9ca3af;font-size:11.5px;font-weight:800;text-align:center">' +
              'جارٍ تشغيل الكاميرا…</div>';
        document.body.appendChild(ui);

        var controls = null, reader = null, done = false;
        function close() {
            done = true;
            try { if (controls && controls.stop) controls.stop(); } catch (e) {}
            try { if (reader && reader.reset) reader.reset(); } catch (e) {}
            /* ⚠️ إطفاء المسارات باليد أيضاً: بعض إصدارات ZXing تترك ضوء الكاميرا
               مشتعلاً بعد الإغلاق، فيظنّ الموظّف أنّنا نصوّره. */
            try {
                var v = document.getElementById('gmt-scan-video');
                if (v && v.srcObject) v.srcObject.getTracks().forEach(function (t) { t.stop(); });
            } catch (e) {}
            if (ui && ui.parentNode) ui.parentNode.removeChild(ui);
        }
        ui.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) close(); });

        loadZXing().then(function (ZX) {
            reader = new ZX.BrowserMultiFormatReader();
            var msg = ui.querySelector('[data-msg]');
            /* العدسة الخلفية صراحةً: الافتراضي على الهاتف هو الأمامية أحياناً،
               ولا أحد يمسح باركوداً بالكاميرا الأمامية. */
            return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
                .then(function (stream) {
                    var v = document.getElementById('gmt-scan-video');
                    v.srcObject = stream;
                    return v.play().catch(function () {});
                })
                .then(function () {
                    msg.textContent = 'ابحث عن الخطوط… قرّب قليلاً إن لم يُقرأ';
                    return reader.decodeFromVideoDevice(null, 'gmt-scan-video', function (result, err, ctl) {
                        if (ctl && !controls) controls = ctl;
                        if (done || !result) return;
                        var code = String(result.getText ? result.getText() : result.text || '').trim();
                        if (!code) return;
                        close();
                        try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
                        if (onCode) onCode(code, 'camera');
                    });
                });
        }).catch(function (e) {
            var msg = ui.querySelector('[data-msg]');
            if (msg) { msg.style.color = '#fca5a5'; msg.textContent = e.message || 'تعذّر تشغيل الكاميرا'; }
            setTimeout(close, 2600);
        });
    }

    /* ── ② السكانر المربوط ────────────────────────────────────────────────── */
    function listen(onCode, opt) {
        if (_listening) return;                 // منصتٌ واحد لكل صفحة
        _listening = true;
        opt = opt || {};
        var maxGap = opt.maxGap || 35;          // ms بين حرفين
        var minLen = opt.minLen || 4;
        var buf = '', last = 0;

        document.addEventListener('keydown', function (e) {
            var el = e.target;
            var tag = el && el.tagName;
            /* لا نلتقط في مناطق النصّ الحرّ ولا كلمات السرّ: هناك قد يكتب إنسانٌ
               بسرعة لصقٍ أو تكرار، والخطأ هناك مكلف. */
            if (tag === 'TEXTAREA' || (tag === 'INPUT' && /password/i.test(el.type || ''))) { buf = ''; return; }

            var now = Date.now();
            if (now - last > maxGap) buf = '';   // فاصل بشري ⇒ ابدأ من جديد
            last = now;

            if (e.key === 'Enter') {
                var code = buf; buf = '';
                if (code.length >= minLen) {
                    e.preventDefault();          // لا نُرسل النموذج بضغطة السكانر
                    if (onCode) onCode(code, 'scanner');
                }
                return;
            }
            if (e.key && e.key.length === 1 && /[A-Za-z0-9\-_.]/.test(e.key)) buf += e.key;
            else buf = '';
        }, true);
    }

    /* ── ③ الأسهل: زرّ بجانب حقل + إنصات للسكانر ─────────────────────────── */
    function attach(input, onCode, opts) {
        if (!input) return null;
        opts = opts || {};
        var fire = function (code, how) {
            input.value = code;
            /* نُطلق الحدثين معاً: صفحاتنا تربط البحث بـinput تارةً وبـchange تارة. */
            try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            if (onCode) onCode(code, how);
        };
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'مسح باركود بالكاميرا';
        btn.setAttribute('data-gmt-scan', '1');
        /* ══ (2026-10-04) طلبُك: «زرّ البحث عن المنتج افصله عن زرّ البحث
           بالباركود، وخلّي زرّ الباركود **واضح** والرسوم تبعيته واضحة —
           ما تحطّ لي رسوم كرتونيّة».
           كان رمزاً تعبيريّاً (📷) صغيراً **داخل حقل البحث**: لا يُرى، ولا
           يقول إنّه للباركود (الكاميرا تعني تصويراً لا مسحاً). صار زرّاً
           مستقلّاً بحدٍّ ونصّ، وأيقونتُه **باركودٌ مرسومٌ بخطوطٍ** لا صورةَ
           كاميرا — أي الشيءُ نفسُه الذي يمسحه. */
        btn.setAttribute('aria-label', 'مسح باركود');
        btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2" stroke-linecap="round" aria-hidden="true">'
          + '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>'
          + '<path d="M7 8v8M10.5 8v8M14 8v8M17 8v8"/></svg>'
          + '<span class="gmt-scan-tx">باركود</span>';
        btn.style.cssText = opts.style || ('display:inline-flex;align-items:center;gap:6px;'
          + 'border:1px solid var(--u-border,#e5e7eb);background:var(--u-surface,#fff);'
          + 'color:var(--u-ink-2,#334155);cursor:pointer;font-family:inherit;font-size:12px;'
          + 'font-weight:800;line-height:1;padding:0 11px;min-height:34px;border-radius:9px;'
          + 'white-space:nowrap;');
        btn.addEventListener('click', function (e) { e.preventDefault(); camera(fire); });
        (opts.into || input.parentElement || document.body).appendChild(btn);
        listen(fire);
        return btn;
    }

    global.GMTScan = { camera: camera, listen: listen, attach: attach };
}(typeof window !== 'undefined' ? window : this));
