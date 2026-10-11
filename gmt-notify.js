/* ═══════════════════════════════════════════════════════════════════════════
   gmt-notify.js — لوحةُ الإشعارات المركزية
   أُنشئ: 2026-10-03 · طلبك ٩١

   طلبُك: «لوحة إشعاراتٍ مركزية لكل حدثٍ في أي ملفّ».

   المشكلة التي يحلّها: الأحداث المهمّة تحدث في عشر أدواتٍ مستقلّة ثمّ
   **تذوب**. فاتورةُ نقلٍ وصلت ولم تُؤكَّد · طلبٌ شُحن ولم يُبلَّغ زبونه ·
   عرضٌ انتهت مدّته والسعر ما زال مخفّضاً · أوردرٌ من المتجر لم يُفوتر ·
   منتجٌ بلا قسمٍ في المتجر. كلُّ واحدٍ منها يظهر — إن ظهر — داخل أداته
   وحدها، فمن لا يفتح تلك الأداة اليوم لا يعرف.

   التصميم — وهذا هو الجزء المهمّ:
     • **لا جدولَ جديد ولا SQL.** أنت لم تُشغّل أيّ SQL، فلوحةٌ تعتمد على
       جدول إشعاراتٍ في القاعدة كانت ستُولَد ميتة. فاللوحة **تستنتج** من
       البيانات الموجودة أصلاً: تسأل القاعدة أسئلةً محدّدةً جاهزة.
     • **لا تخترع رقماً.** كلُّ بندٍ يحمل عددَه الحقيقيّ من القاعدة، وإن
       تعذّرت القراءة قال «تعذّرت القراءة» ولم يقل «صفر» — الصفرُ الكاذب
       أسوأ من الاعتراف، لأنّه يُطمئنك بالخطأ.
     • **كلُّ بندٍ له زرٌّ يفتح مكانه** — لا إشعارٌ بلا طريقٍ إلى الحلّ.
     • الأعمدةُ التي قد لا توجد (مثل علامات التبليغ من SQL ٣٤) تُقرأ
       **بتدرّج**: إن رفضت القاعدة السؤال سقط ذلك البند وحده ولا تسقط اللوحة.

   تُستعمل: `GMTNotify.open()` أو الزرّ الذي يُحقن في الشريط العلوي.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTNotify) return;

  var Z = 2147482500;
  var LAST_SEEN_KEY = 'gmt_notify_seen_at';

  function db() {
    try {
      if (global.GMT_DB && global.GMT_DB.MAIN) return global.GMT_DB.MAIN;
      if (global.GMT_CONFIG) return { url: global.GMT_CONFIG.SUPABASE_URL, key: global.GMT_CONFIG.SUPABASE_ANON_KEY };
    } catch (e) {}
    return null;
  }

  /* سؤالٌ واحد للقاعدة يُرجع العدد فقط (Prefer: count=exact · بلا تنزيل صفوف) */
  async function countOf(table, query) {
    var d = db();
    if (!d) return { err: 'لا مفاتيح قاعدة في هذه الصفحة' };
    var url = d.url + '/rest/v1/' + table + '?select=id&limit=1' + (query ? '&' + query : '');
    try {
      var r = await fetch(url, {
        headers: {
          apikey: d.key, Authorization: 'Bearer ' + d.key,
          Prefer: 'count=exact', Range: '0-0'
        }
      });
      /* ⚠️ `res.ok` قبل أي قراءةٍ للجسم — قاعدةٌ مُسجَّلة عندنا: جسمُ الخطأ
         المقروءُ كنتيجةٍ يقول «لا يوجد» وهو في الحقيقة «لم نسأل بنجاح». */
      if (!r.ok) {
        var t = await r.text().catch(function () { return ''; });
        return { err: 'HTTP ' + r.status + (t ? ' · ' + t.slice(0, 90) : '') };
      }
      var cr = r.headers.get('content-range') || '';
      var n = parseInt(String(cr).split('/')[1], 10);
      if (isFinite(n)) return { n: n };
      var rows = await r.json().catch(function () { return []; });
      return { n: Array.isArray(rows) ? rows.length : 0 };
    } catch (e) {
      return { err: (e && e.message) || 'تعذّر الاتصال' };
    }
  }

  /* ── البنود: كلٌّ يعرف سؤالَه ووجهتَه ومعنى عددِه ─────────────────────── */
  var ITEMS = [
    {
      id: 'transfers_unconfirmed',
      title: 'فواتير نقلٍ بانتظار تأكيد الاستلام',
      why: 'بضاعةٌ خرجت من فرعٍ ولم يُقِرّ الفرعُ الآخر باستلامها — فرقُ الجرد يبقى معلّقاً.',
      go: { label: 'فواتير النقل', href: 'inventory.html' },
      run: function () { return countOf('branch_stock_transfers', 'status=neq.received'); },
      tone: 'warn'
    },
    {
      id: 'orders_shipped_no_tracking',
      title: 'طلباتٌ شُحنت بلا رقم تتبّع',
      why: 'الزبون لا يستطيع تتبّع شحنته، ولا نحن.',
      go: { label: 'الأوردرات', href: 'orders.html' },
      run: function () { return countOf('gmt_orders', 'status=eq.shipped&or=(tracking_number.is.null,tracking_number.eq.)'); },
      tone: 'warn'
    },
    {
      id: 'orders_pending',
      title: 'طلباتٌ بانتظار التجهيز',
      why: 'أوردراتٌ لم تُجهَّز بعد.',
      go: { label: 'الأوردرات', href: 'orders.html' },
      run: function () { return countOf('gmt_orders', 'status=eq.pending'); },
      tone: 'info'
    },
    {
      id: 'imports_not_transferred',
      title: 'فواتير استيرادٍ وصلت ولم تُرحَّل للمخزون',
      why: 'بضاعةٌ وصلت ولا تظهر في الجرد — فالبيعُ يرفضها وهي موجودةٌ في المستودع.',
      go: { label: 'المشتريات', href: 'purchase.html' },
      run: function () { return countOf('import_log', 'status=eq.arrived&transferred=is.false'); },
      tone: 'warn'
    },
    {
      id: 'products_zero',
      title: 'منتجاتٌ نفد مخزونها كلّياً',
      why: 'تظهر للزبون في المتجر ولا يمكن تسليمُها.',
      go: { label: 'الجرد', href: 'inventory.html' },
      run: function () { return countOf('products', 'count=eq.0'); },
      tone: 'info'
    },
    {
      id: 'hiring_new',
      title: 'طلباتُ توظيفٍ جديدة',
      why: 'طلبٌ وصل ولم يُراجَع.',
      go: { label: 'التوظيف', href: 'أدمن_التوظيف.html' },   /* (٨ ت) كان يفتح استمارة المتقدّم لا لوحة الإدارة */
      run: function () { return countOf('gmt_job_applications', 'status=eq.' + encodeURIComponent('جديد')); },   /* (ر) كان يسأل gmt_applications · new ⇒ 404 — الجدول الحقيقيّ وحالته من SQL 19 */
      tone: 'info'
    }
  ];

  /* (٨ ت — تدقيق المطابقة) طلبك: «لوحة الإشعارات فيها كل جديد» — كانت ستّة عدّادات. أُضيف ما يحتاج تدخّلك
     ونعرف جدوله يقيناً: طلبات المتجر الجديدة · المصاريف بانتظار الموافقة · العمولات بانتظار المراجعة ·
     الحسابات الجديدة بانتظار الموافقة. (ما لا جدول له — التقييمات والتعليقات — لا يُخترَع له عدّاد.) */
  ITEMS.push(
    {
      id: 'store_orders_new',
      title: 'طلباتٌ جديدة من المتجر الإلكتروني',
      why: 'زبونٌ طلب من المتجر وما زال الطلب بانتظار التجهيز.',
      go: { label: 'الأوردرات', href: 'orders.html' },
      run: function () { return countOf('gmt_orders', 'status=eq.pending&branch=eq.' + encodeURIComponent('المتجر الإلكتروني')); },
      tone: 'warn'
    },
    {
      id: 'expenses_pending',
      title: 'مصاريف بانتظار موافقتك',
      why: 'مصروفٌ سجّلته نقطة بيع ولم يُعتمد — الصندوق لا يُخصم حتى توافق.',
      go: { label: 'أدمن نقاط البيع', href: 'admin_pos.html' },
      run: function () { return countOf('gmt_expenses', 'approved=is.false'); },
      tone: 'warn'
    },
    {
      id: 'commissions_pending',
      title: 'عمولاتٌ بانتظار مراجعتك',
      why: 'فواتير بيعٍ عمولتها لم تُعتمد بعد.',
      go: { label: 'أدمن نقاط البيع', href: 'admin_pos.html' },
      run: function () { return countOf('invoice_commissions', 'approved=is.false&paid=is.false'); },
      tone: 'info'
    },
    {
      id: 'transfers_received_today',
      title: 'فواتير نقلٍ أكّد فرعُها استلامَها اليوم',
      why: 'الفرع المستلِم أقرّ بوصول البضاعة وأُضيفت لمخزونه — للاطّلاع.',
      go: { label: 'فواتير النقل', href: 'inventory.html' },
      run: function () { var d = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); return countOf('branch_stock_transfers', 'status=eq.received&received_at=gte.' + encodeURIComponent(d)); },
      tone: 'info'
    },
    {
      id: 'accounts_pending',
      title: 'حساباتٌ جديدة بانتظار الموافقة',
      why: 'مستخدمٌ أنشأ حساباً ويتصفّح فقط حتى توافق.',
      go: { label: 'الأمان والمستخدمون', href: 'الأمان_والمستخدمون.html' },
      /* (٨ ج) عمود gmt_users.approved لا يوجد في قاعدتك (SQL 25 لم يُشغَّل) فكان كلُّ فحصٍ يرمي 42703 ويُسجَّل «حرجاً» —
         نتذكّر غيابه لهذه الجلسة فلا نعيد السؤال. (مفتاح user_pending_<id> يغطّي الموافقة بدونه.) */
      run: function () {
        try { if (sessionStorage.getItem('gmt_no_users_approved') === '1') return Promise.resolve({ n: 0 }); } catch (_) {}
        return Promise.resolve(countOf('gmt_users', 'approved=is.false')).then(function (res) {
          if (res && res.err && /42703|approved|does not exist/i.test(String(res.err))) { try { sessionStorage.setItem('gmt_no_users_approved', '1'); } catch (_) {} return { n: 0 }; }
          return res;
        });
      },
      tone: 'warn'
    }
  );

  var _lastResults = null;

  async function collect() {
    var out = [];
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      /* eslint-disable no-await-in-loop */
      var r = await it.run();
      out.push({ item: it, n: r.n, err: r.err });
    }
    _lastResults = out;
    return out;
  }

  function style() {
    if (document.getElementById('gmtnotify-style')) return;
    var css = [
      '.gn-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;',
      'justify-content:center;padding:22px 14px;z-index:' + Z + ';font-family:Cairo,Tajawal,system-ui,sans-serif;',
      'opacity:0;transition:opacity .16s;overflow-y:auto}',
      '.gn-ov.in{opacity:1}',
      '.gn-bx{background:#fff;border-radius:18px;max-width:560px;width:100%;direction:rtl;text-align:right;',
      'box-shadow:0 24px 60px rgba(2,6,23,.3);overflow:hidden}',
      '.gn-hd{padding:16px 18px;background:linear-gradient(135deg,#15171d,#8a000d 75%,#D5001C);color:#fff}',
      '.gn-hd h3{margin:0;font-size:17px;font-weight:900}',
      '.gn-hd p{margin:5px 0 0;font-size:12px;opacity:.9;line-height:1.8}',
      '.gn-bd{padding:12px 14px 6px;max-height:62vh;overflow-y:auto}',
      '.gn-row{border:1.5px solid #e5e7eb;border-radius:13px;padding:11px 13px;margin-bottom:9px;display:flex;',
      'gap:11px;align-items:flex-start}',
      '.gn-row.warn{border-color:#fdba74;background:#fff7ed}',
      '.gn-row.quiet{opacity:.6}',
      '.gn-row.err{border-color:#fca5a5;background:#fef2f2}',
      '.gn-n{flex:0 0 auto;min-width:36px;height:36px;border-radius:11px;display:flex;align-items:center;',
      'justify-content:center;font-weight:900;font-size:15px;background:#f1f5f9;color:#334155;padding:0 7px}',
      '.gn-row.warn .gn-n{background:#D5001C;color:#fff}',
      '.gn-row.err .gn-n{background:#fee2e2;color:#991b1b;font-size:12px}',
      '.gn-t{font-size:13.5px;font-weight:800;color:#0f172a;line-height:1.7}',
      '.gn-w{font-size:11.5px;color:#526077;line-height:1.75;margin-top:2px}',
      '.gn-go{margin-top:6px;display:inline-block;font-size:11.5px;font-weight:800;color:#D5001C;',
      'background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:4px 10px;text-decoration:none}',
      '.gn-ft{padding:12px 16px 16px;display:flex;gap:8px}',
      '.gn-b{flex:1;padding:11px;border:0;border-radius:11px;font-weight:800;font-size:13.5px;',
      'font-family:inherit;cursor:pointer}',
      '.gn-b.pri{background:#D5001C;color:#fff}.gn-b.sec{background:#f1f5f9;color:#475569}',
      '.gn-dot{position:absolute;top:-2px;left:-2px;min-width:16px;height:16px;border-radius:99px;',
      'background:#D5001C;color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;',
      'justify-content:center;padding:0 4px;border:1.5px solid #fff}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'gmtnotify-style'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function open() {
    style();
    var ov = document.createElement('div');
    ov.className = 'gn-ov';
    ov.innerHTML =
      '<div class="gn-bx">' +
        '<div class="gn-hd"><h3>🔔 لوحة الإشعارات</h3>' +
        '<p>كلُّ ما يحتاج تدخّلاً الآن، من كل أدوات النظام في مكانٍ واحد.</p></div>' +
        '<div class="gn-bd" id="gn-body"><div style="padding:22px;text-align:center;color:#5b6472;font-size:13px">جارٍ السؤال…</div></div>' +
        '<div class="gn-ft">' +
          '<button class="gn-b pri" id="gn-refresh">تحديث</button>' +
          '<button class="gn-b sec" id="gn-close">إغلاق</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('in'); });

    function close() {
      ov.classList.remove('in');
      try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch (e) {}
      setTimeout(function () { try { ov.remove(); } catch (e) {} }, 180);
      paintBadge(0);
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#gn-close').onclick = close;
    ov.querySelector('#gn-refresh').onclick = function () { fill(); };

    async function fill() {
      var body = ov.querySelector('#gn-body');
      body.innerHTML = '<div style="padding:22px;text-align:center;color:#5b6472;font-size:13px">جارٍ السؤال…</div>';
      var rows = await collect();
      var html = '';
      var anyAction = 0;
      rows.forEach(function (r) {
        var cls = r.err ? 'err' : (r.n > 0 ? (r.item.tone === 'warn' ? 'warn' : '') : 'quiet');
        var num = r.err ? 'تعذّر' : String(r.n);
        if (!r.err && r.n > 0) anyAction++;
        html += '<div class="gn-row ' + cls + '">' +
          '<div class="gn-n">' + esc(num) + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="gn-t">' + esc(r.item.title) + '</div>' +
            '<div class="gn-w">' + esc(r.err ? ('تعذّرت القراءة: ' + r.err + ' — لا أكتب «صفر» لأنّي لا أعرف.') : r.item.why) + '</div>' +
            ((!r.err && r.n > 0) ? '<a class="gn-go" href="' + esc(r.item.go.href) + '">افتح ' + esc(r.item.go.label) + ' ↗</a>' : '') +
          '</div></div>';
      });
      if (!anyAction) {
        html = '<div style="padding:16px;text-align:center;background:#f0fdf4;border:1.5px solid #86efac;' +
               'border-radius:13px;color:#166534;font-size:13.5px;font-weight:800;margin-bottom:9px">' +
               '✅ لا شيء ينتظر تدخّلك الآن</div>' + html;
      }
      body.innerHTML = html;
    }
    fill();
  }

  /* ── الزرّ في الشريط العلوي + شارةُ العدد ───────────────────────────────── */
  function paintBadge(n) {
    var dot = document.getElementById('gn-badge');
    if (!dot) return;
    if (n > 0) { dot.textContent = n > 99 ? '99+' : String(n); dot.style.display = 'flex'; }
    else dot.style.display = 'none';
  }

  function mountButton() {
    if (document.getElementById('gmt-notify-btn')) return;
    if (!global.GMT_INTERNAL) return;          /* صفحاتُ الزبون لا تحمل هذا الزرّ */
    /* (٨ ت — تدقيق المطابقة) صفحتا التوظيف والكفالة «داخليّتان» لكنّ الزبون يفتحهما (الاستمارة · شهادة الكفالة ?w=)
       فكان يرى جرسنا بأرقام القاعدة. الجرس لمن عنده جلسة موظّف، ولا يظهر على الشهادة العامّة أبداً. */
    try { if (!localStorage.getItem('gmt_session') || /[?&]w=/.test(location.search)) return; } catch (_) { return; }
    var b = document.createElement('button');
    b.id = 'gmt-notify-btn';
    b.type = 'button';
    b.title = 'لوحة الإشعارات — كلُّ ما يحتاج تدخّلاً';
    b.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;' +
      'width:30px;height:30px;border-radius:9px;border:1px solid rgba(15,23,42,.10);background:#fff;' +
      'cursor:pointer;font-size:14px;line-height:1;padding:0;transition:background .14s,border-color .14s;';
    b.onmouseenter = function () { b.style.background = '#f8fafc'; };
    b.onmouseleave = function () { b.style.background = '#fff'; };
    /* 🎨 جرسٌ مرسومٌ لا إيموجي: الإيموجي يُرسَم بألوان النظام (أصفرُ صارخ)
       فيسحب العين إلى الكروم بدل العمل. الرسمُ يأخذ لونَ النصّ فيتنحّى. */
    b.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>' +
      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span class="gn-dot" id="gn-badge" style="display:none"></span>';
    b.onclick = function () { open(); };
    style();

    /* 🎨 يُركَّب في **أوّل** الشريط (جهة اليمين في العربية) لا في آخره —
       فتتوزّع الزاويتان: إشعاراتٌ يميناً وتحديثٌ يساراً، بدل تكدّسٍ في طرف. */
    /* ⚠️ عطلٌ كشفته لقطةُ الواجهة: هذا الملفّ مؤجَّل (`defer`) وقد يعمل
       **قبل** أن يبني شريطُ التحديث نفسه. فكان الجرس يسقط إلى زرٍّ عائم —
       وهو بالضبط ما طلب المالك إزالته ثلاث مرّات. فننتظر الشريط بدل أن
       نسقط فوراً، ولا نعوم إلّا إن لم يظهر إطلاقاً خلال ثانيتين. */
    var tries = 0;
    (function attach() {
      var host = document.getElementById('gmt-refresh-bar') ||
                 document.querySelector('.gmt-refresh-bar');
      if (host) { host.insertBefore(b, host.firstChild); return; }
      if (++tries < 20) { setTimeout(attach, 100); return; }
      /* بلا شريطٍ إطلاقاً: زاويةٌ ثابتة صغيرة — آخرُ حلّ لا أوّلُه */
      b.style.cssText += 'position:fixed;top:8px;inset-inline-start:8px;z-index:' + (Z - 50) + ';';
      document.body.appendChild(b);
    })();
  }

  /* عدُّ ما يحتاج تدخّلاً مرّةً بعد الإقلاع — بهدوء، بلا إبطاء الصفحة */
  async function quietCount() {
    try {
      var rows = await collect();
      var n = rows.reduce(function (s, r) { return s + ((!r.err && r.n > 0) ? 1 : 0); }, 0);
      paintBadge(n);
    } catch (e) {}
  }

  global.GMTNotify = {
    open: open,
    items: ITEMS,
    collect: collect,
    last: function () { return _lastResults; },
    mount: mountButton
  };

  function boot() {
    mountButton();
    /* التأجيل مقصود: اللوحة لا تُزاحم أوّلَ رسمٍ للصفحة (درسُ البلاغ ١٦٩) */
    setTimeout(quietCount, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
