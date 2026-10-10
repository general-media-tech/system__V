/* ═══════════════════════════════════════════════════════════════════════════
   gmt-home.js — لوحةُ البداية · الهوية البصرية ٢٫٠
   أُنشئ: 2026-10-04

   ══ من أين جاءت هذه الشاشة ══
   طلبُك حرفياً، في ثلاث جُمل:
     ① «لازم يعطي البند في كل نظام: أهلاً بك مع اسم المستخدم».
     ② «بدي في الواجهة الرئيسية يظهر سجل المبيعات والأرباح — هي بتعرض كل شيء
        للأدمن، ولكن للموظف تعرض له فقط نقطة بيعه».
     ③ «طالِع الشاشة موجودة في الأعلى لكل المستخدمين: بيطالع مين الفرع الأكثر
        مبيعاً وشو باع وقديش المبيوع عنده، طبعاً عدد أوردرات لأنها مَبيعة
        أونلاين… والفرع الأكثر نشاطاً».

   وكانت البوابة الرئيسية قبل اليوم **شبكةَ روابطَ فقط**: تفتحها فلا تعرف
   شيئاً عن عملك — لا مبيعاً ولا ربحاً ولا أيّ فرعٍ يتقدّم. وهذا ما تقوله
   مراجعُك الثلاثةُ كلّها بصوتٍ واحد: كلُّ لوحةٍ فيها تفتح بـ
   «Good morning, <name> 👋» ثمّ صفِّ مؤشّراتٍ ثمّ التفاصيل.

   ══ ماذا أخذتُ من المراجع — وماذا رفضتُ ══
   • من Learnova وTaskly: صفُّ المؤشّرات بأربع بطاقات، كلٌّ منها
     «تسميةٌ خافتة ⇠ رقمٌ كبير ⇠ سطرٌ صغير» مع مربّعِ أيقونةٍ ملوّن.
     أخذتُ البنية — ورفضتُ أن يكون لكلّ بطاقةٍ لونُها الخاصّ (أربعةُ ألوانٍ
     باستيل)، لأنّ ذلك هو بالضبط ما اشتكيتَ منه: «ألوانها كثيرة وفاقعة».
     فصارت المربّعاتُ رماديّةً، والأحمرُ للرقم الحاكم وحده.
   • من Proton Vault: صفُّ «الوصول السريع» بأيقوناتٍ صغيرةٍ وعدّاد.
   • من Taxr: إخفاءُ الكسور في المبالغ (‎$1,240**.50**) كي تُقرأ الأرقام
     الكبيرة بلمحة.
   • رفضتُ الزرَّ العائم في وسط شريط التنقّل (موجودٌ في ثلاثة مراجع) —
     لأنّك منعتَ العائمَ في كلّ النظام.

   ══ قاعدتان لا تُكسران هنا ══
   ① **لا عمودَ جديدٌ في قاعدة البيانات.** أنت لم تُشغّل أيَّ SQL، فكلُّ قراءةٍ
     هنا متدرّجة: نطلب الأعمدةَ المحدّدة، فإن رفض PostgREST (نمط P1: عمودٌ
     واحدٌ مجهولٌ يُسقط الطلبَ كلَّه) نُعيد الطلبَ بـ select=* ونحسب محلياً.
   ② **لا نكتب صفراً لم نقرأه.** إن فشلت القراءة تُكتب «تعذّرت القراءة» —
     لأنّ صفراً مكذوباً في شاشة مبيعاتٍ أسوأُ من لا شيء.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTHome) return;

  var MOUNT_ID = 'gmt-home';
  var LS_USE   = 'gmt_home_use_v1';   // عدّادُ استعمال الأدوات ⇐ الوصولُ السريع

  /* ── أدواتٌ صغيرة ───────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  /* المبلغ: الجزءُ الصحيح عريضٌ والكسرُ خافت — فكرةٌ من مرجع Taxr.
     الهدفُ قراءةُ الرقم الحاكم بلمحةٍ لا عدُّ خاناته. */
  function money(n, cur) {
    if (n == null || isNaN(n)) return null;
    var v = Math.abs(Number(n));
    var s = v.toFixed(2).split('.');
    var whole = Number(s[0]).toLocaleString('en-US');
    return '<span class="u-kpi" style="font-size:inherit;color:inherit;">'
         + (cur || '$') + whole
         + '<span style="font-size:.62em;font-weight:800;opacity:.55;">.' + s[1] + '</span></span>';
  }
  function num(n) {
    if (n == null || isNaN(n)) return null;
    return '<span style="direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;">'
         + Number(n).toLocaleString('en-US') + '</span>';
  }

  /* أيقونةٌ من الطقم الموحَّد، وإلّا رمزٌ تعبيريٌّ احتياطيّ — فلا تختفي
     الأيقونةُ إن لم تُحمَّل الوحدة. */
  var ICON_FALLBACK = { money: '💵', receipt: '🧾', truck: '🚚', box: '📦', trophy: '🏆' };
  function ic(name) {
    try { if (global.GMTIcon && GMTIcon.has(name)) return GMTIcon.svg(name, 19); } catch (_) {}
    return ICON_FALLBACK[name] || '';
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 5)  return 'سهرةً طيّبة';
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'نهارك سعيد';
    return 'مساء الخير';
  }

  /* اسمُ المستخدم — يُقرأ من كلّ مكانٍ قد يكون فيه.
     (درسٌ سابق: قراءةُ خاصيّةٍ غير موجودةٍ تُرجع undefined بصمت، فيظهر
      «أهلاً بك، undefined». لذلك نجرّب ستّةَ حقولٍ ثمّ نكتفي بتحيّةٍ بلا اسم.) */
  function userName() {
    var s = {};
    try { s = JSON.parse(lsGet('gmt_session', '{}')) || {}; } catch (_) {}
    var cands = [s.display_name, s.full_name, s.name, s.username, s.user_name, s.cashier_name,
                 lsGet('gmt_user_name', ''), lsGet('gmt_username', '')];
    for (var i = 0; i < cands.length; i++) {
      var v = (cands[i] || '').toString().trim();
      if (v && v.length < 40 && !/^\d+$/.test(v)) return v;
    }
    return '';
  }
  function branchOfSession() {
    var s = {};
    try { s = JSON.parse(lsGet('gmt_session', '{}')) || {}; } catch (_) {}
    return { key: s.branch_key || lsGet('gmt_branch', '') || '', name: s.branch_name || '' };
  }
  function isAdmin() {
    try { if (global.GMTRole && GMTRole.isAdmin) return !!GMTRole.isAdmin(); } catch (_) {}
    try { return sessionStorage.getItem('gmt_admin_mode') === '1'; } catch (_) { return false; }
  }

  /* ── القراءةُ المتدرّجة ─────────────────────────────────────────────── */
  function db() {
    try {
      if (global.GMT_DB && GMT_DB.MAIN && GMT_DB.MAIN.url) return GMT_DB.MAIN;
    } catch (_) {}
    if (global.SUPABASE_URL && global.SUPABASE_KEY) return { url: global.SUPABASE_URL, key: global.SUPABASE_KEY };
    return null;
  }

  async function rest(path) {
    var d = db();
    if (!d) throw new Error('لا إعدادات قاعدة');
    var h = (global.GMT_DB && GMT_DB.headers) ? GMT_DB.headers(d)
          : { apikey: d.key, Authorization: 'Bearer ' + d.key };
    var res = await fetch(d.url + path, { headers: h });
    /* ⚠️ الترتيبُ مقصود: res.ok **قبل** res.json().
       كان في النظام نمطٌ يقرأ الجسمَ أوّلاً، فإن كان الجوابُ خطأً قرأه
       كـ«لا نتائج» وأخبر المستخدمَ أنّ مبيعاته صفر. */
    if (!res.ok) {
      var why = '';
      try { why = (await res.json()).message || ''; } catch (_) {}
      var e = new Error(why || ('HTTP ' + res.status)); e.status = res.status; throw e;
    }
    return await res.json();
  }

  /* رسالةٌ بالعربية بدل نصِّ المتصفّح. كان يظهر «Failed to fetch» لصاحب
     المحلّ — وهي جملةٌ لا تقول له ما العمل. */
  function sayWhy(msg) {
    var m = String(msg || '');
    if (/Failed to fetch|NetworkError|net::/i.test(m)) return 'لا اتصالَ بالإنترنت أو بقاعدة البيانات الآن.';
    if (/لا إعدادات قاعدة/.test(m))                    return 'إعداداتُ قاعدة البيانات غير محمَّلةٍ في هذه الصفحة.';
    if (/^HTTP 40[13]/.test(m))                        return 'القاعدةُ رفضت الطلب (صلاحية أو مفتاح).';
    if (/^HTTP 404/.test(m))                           return 'الجدولُ المطلوب غير موجودٍ في القاعدة.';
    if (/JWT|expired/i.test(m))                        return 'انتهت صلاحيةُ مفتاح القاعدة.';
    return m;
  }

  /* نطلب الأعمدةَ المحدّدة؛ فإن سقط الطلبُ بسبب عمودٍ مجهول (نمط P1)
     نُعيده بـ select=* — فلا ميزةَ تموت لأنّ عموداً لم يُنشَأ بعد. */
  async function tiered(table, query, cols) {
    try {
      return await rest('/rest/v1/' + table + '?' + query + '&select=' + cols.join(','));
    } catch (e) {
      if (!/column|does not exist|42703|PGRST/i.test(e.message || '')) throw e;
      return await rest('/rest/v1/' + table + '?' + query + '&select=*');
    }
  }

  function startOfToday() {
    var d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }

  /* ── جمعُ الأرقام ──────────────────────────────────────────────────── */
  async function collect() {
    var mine = branchOfSession();
    var admin = isAdmin();
    var since = startOfToday();
    var out = { admin: admin, branch: mine };

    var rows = await tiered('invoices',
      'created_at=gte.' + since + '&order=created_at.desc&limit=3000',
      ['id', 'branch_key', 'branch_name', 'total', 'sale_type', 'created_at']);
    if (!Array.isArray(rows)) rows = [];

    /* الموظّفُ يرى نقطةَ بيعه وحدها — طلبُك ②. والأدمن يرى الكلّ. */
    var seen = admin ? rows : rows.filter(function (r) {
      return !mine.key || String(r.branch_key || '') === String(mine.key);
    });

    out.sales  = seen.reduce(function (s, r) { return s + (Number(r.total) || 0); }, 0);
    out.count  = seen.length;
    out.online = seen.filter(function (r) { return /شحن|آجل|أونلاين/.test(String(r.sale_type || '')); })
                     .reduce(function (s, r) { return s + (Number(r.total) || 0); }, 0);

    /* (2026-10-04 م) خطُّ المبيعات التراكميّ بالساعة — لشريط البطاقة الكحليّة في نموذجك */
    try {
      var hb = new Array(24).fill(0);
      seen.forEach(function (r) { var d = new Date(r.created_at); if (!isNaN(d)) hb[d.getHours()] += Number(r.total) || 0; });
      var nowH = new Date().getHours(), first = hb.findIndex(function (v) { return v > 0; });
      var cum = [], acc = 0;
      if (first >= 0) for (var h = first; h <= nowH; h++) { acc += hb[h]; cum.push(acc); }
      out.hours = cum;
    } catch (_) { out.hours = []; }

    /* الفرعُ الأكثر مبيعاً — طلبُك ③، ويُعرض لكلّ المستخدمين. */
    var per = {};
    rows.forEach(function (r) {
      var k = r.branch_key || r.branch_name || '—';
      per[k] = per[k] || { key: k, name: r.branch_name || k, total: 0, n: 0, online: 0 };
      per[k].total += Number(r.total) || 0;
      per[k].n += 1;
      if (/شحن|آجل|أونلاين/.test(String(r.sale_type || ''))) per[k].online += Number(r.total) || 0;
    });
    var list = Object.keys(per).map(function (k) { return per[k]; })
                     .sort(function (a, b) { return b.total - a.total; });
    out.top = list[0] || null;
    out.branches = list.length;
    out.list = list;                     /* (2026-10-04 ي) ترتيبُ الفروع كاملاً للواجهة الجديدة */

    /* (2026-10-04 ي) سطرُ المقارنة مع الأمس — البندُ ٥ من «ما لم يكتمل».
       قراءةٌ مستقلّة: فشلُها لا يُسقط أرقام اليوم، ولا نكتب «أمس صفر» لم نقرأه. */
    try {
      var y0 = new Date(); y0.setHours(0, 0, 0, 0); y0.setDate(y0.getDate() - 1);
      var yr = await tiered('invoices',
        'created_at=gte.' + y0.toISOString() + '&created_at=lt.' + since + '&limit=3000',
        ['id', 'branch_key', 'total', 'sale_type']);
      if (!Array.isArray(yr)) yr = [];
      var ys = admin ? yr : yr.filter(function (r) { return !mine.key || String(r.branch_key || '') === String(mine.key); });
      out.prev = {
        sales:  ys.reduce(function (s, r) { return s + (Number(r.total) || 0); }, 0),
        count:  ys.length,
        online: ys.filter(function (r) { return /شحن|آجل|أونلاين/.test(String(r.sale_type || '')); })
                  .reduce(function (s, r) { return s + (Number(r.total) || 0); }, 0)
      };
    } catch (_) { out.prev = null; }

    /* أوردراتُ الشحن اليوم — جدولٌ آخر، وفشلُه لا يُسقط البقيّة. */
    try {
      var o = await tiered('gmt_orders', 'created_at=gte.' + since + '&limit=2000',
                           ['id', 'status', 'created_at']);
      out.orders = Array.isArray(o) ? o.length : null;
    } catch (_) { out.orders = null; }

    return out;
  }

  /* ── الوصولُ السريع (طلبك ١٥٣) ─────────────────────────────────────
     ليست قائمةً اخترتُها أنا: ترتيبُها من **استعمالك الفعليّ**. كلُّ فتحةِ
     أداةٍ من البوابة تُزيد عدّادَها، وأكثرُ أربعٍ تصعد إلى الأعلى.
     فمن يفتح الأوردرات عشر مرّاتٍ يومياً يجدها أوّلاً بلا بحث. */
  var TOOLS = [
    { href: 'pos.html',        ic: 'receipt', t: 'نقطة البيع' },
    { href: 'orders.html',     ic: 'doc',     t: 'الأوردرات' },
    { href: 'inventory.html',  ic: 'box',     t: 'الجرد' },
    { href: 'purchase.html',   ic: 'factory', t: 'المشتريات' },
    { href: 'guarantee.html',  ic: 'shield',  t: 'الكفالة' },
    { href: 'admin_pos.html',  ic: 'boxes',   t: 'أدمن النقاط' },
  ];
  function uses() { try { return JSON.parse(lsGet(LS_USE, '{}')) || {}; } catch (_) { return {}; } }
  function noteUse(href) {
    var u = uses(); u[href] = (u[href] || 0) + 1; lsSet(LS_USE, JSON.stringify(u));
  }
  function quickList() {
    var u = uses();
    return TOOLS.slice().sort(function (a, b) { return (u[b.href] || 0) - (u[a.href] || 0); }).slice(0, 4)
      .map(function (t) { return { href: t.href, ic: t.ic, t: t.t, n: u[t.href] || 0 }; });
  }

  /* ── الرسم ────────────────────────────────────────────────────────── */
  function kpiCard(label, valueHtml, sub, icon, strong) {
    return '<div class="u-card u-card--tight" style="display:flex;align-items:center;gap:11px;">'
      + '<div class="u-ico' + (strong ? '' : ' u-ico--mute') + '">' + icon + '</div>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div class="u-label" style="margin:0 0 1px;">' + esc(label) + '</div>'
      +   '<div style="font-size:19px;font-weight:900;letter-spacing:-.4px;line-height:1.2;'
      +     (strong ? 'color:var(--u-brand,#D5001C);' : 'color:var(--u-ink,#0f172a);') + '">'
      +     (valueHtml == null ? '<span style="color:var(--u-ink-3,#526077);font-size:14px;">—</span>' : valueHtml)
      +   '</div>'
      +   (sub ? '<div class="u-cap" style="margin-top:1px;">' + esc(sub) + '</div>' : '')
      + '</div></div>';
  }

  function skeleton() {
    var one = '<div class="u-card u-card--tight"><div class="u-skel u-skel--line" style="width:45%"></div>'
            + '<div class="u-skel u-skel--line" style="width:70%;height:20px"></div></div>';
    return '<div class="u-g u-g--4">' + one + one + one + one + '</div>';
  }

  function render(host, data, err) {
    var name = userName();
    var hi = greeting() + (name ? '، ' + esc(name) : '') + ' 👋';
    var mine = branchOfSession();
    var ctx = err ? 'تعذّرت قراءةُ أرقام اليوم'
            : (data && data.admin ? 'هذا ما جرى في كلّ الفروع اليوم'
                                  : 'هذا ما جرى في ' + esc(mine.name || 'نقطة بيعك') + ' اليوم');

    var head =
      '<div class="u-row u-row--split" style="margin-bottom:14px;">'
      + '<div><div class="u-h2" style="margin:0;">' + hi + '</div>'
      +      '<div class="u-bodys" style="margin-top:2px;">' + ctx + '</div></div>'
      + '<div class="u-row u-row--tight" id="gmt-home-actions"></div>'
      + '</div>';

    var body;
    if (err) {
      /* حالةُ خطأٍ مُحكمةٌ لا شاشةٌ فارغةٌ طويلة: سطرٌ واحدٌ يقول ما جرى،
         وزرٌّ واحدٌ يُعيد المحاولة. والجملةُ الأخيرة وعدٌ لا اعتذار. */
      body = '<div class="u-banner u-banner--warn">'
           + '<span class="u-banner__i">⚠️</span>'
           + '<span class="u-banner__b"><span class="u-banner__t">تعذّرت قراءةُ أرقام اليوم</span>'
           +   esc(sayWhy(err)) + ' — لم أكتب صفراً لم أقرأه.</span>'
           + '<span class="u-banner__cta"><button class="u-btn u-btn--second u-btn--sm" onclick="GMTHome.refresh()">إعادة المحاولة</button></span>'
           + '</div>';
    } else {
      var k = '<div class="u-g u-g--4">'
        + kpiCard('مبيعات اليوم', money(data.sales), data.admin ? 'كلّ الفروع' : (mine.name || ''), ic('money'), true)
        + kpiCard('فواتير اليوم', num(data.count), data.count === 0 ? 'لا فاتورةَ بعد' : '', ic('receipt'))
        + kpiCard('منها أونلاين/آجل', money(data.online), 'مبيعُ الشحن', ic('truck'))
        + kpiCard('أوردرات الشحن', data.orders == null ? null : num(data.orders),
                  data.orders == null ? 'تعذّرت القراءة' : 'اليوم', ic('box'))
        + '</div>';

      var top = '';
      if (data.top && data.top.total > 0) {
        /* طلبُك ③ بالحرف: الفرعُ الأكثر مبيعاً · كم باع · كم منه أونلاين · كم أوردر. */
        top = '<div class="u-card" style="margin-top:12px;">'
            + '<div class="u-section" style="margin:0 0 11px;"><span class="u-section__i">' + ic('trophy') + '</span> الفرع الأكثر مبيعاً اليوم</div>'
            + '<div class="u-row u-row--split" style="gap:14px;">'
            +   '<div><div class="u-h3" style="margin:0;">' + esc(data.top.name || data.top.key) + '</div>'
            +        '<div class="u-cap">الأكثر نشاطاً من بين ' + num(data.branches) + ' فرعاً</div></div>'
            +   '<div style="text-align:center;"><div class="u-label">باع</div>'
            +        '<div style="font-size:21px;font-weight:900;color:var(--u-brand,#D5001C);">' + money(data.top.total) + '</div></div>'
            +   '<div style="text-align:center;"><div class="u-label">منه أونلاين</div>'
            +        '<div style="font-size:16px;font-weight:900;">' + money(data.top.online) + '</div></div>'
            +   '<div style="text-align:center;"><div class="u-label">أوردرات</div>'
            +        '<div style="font-size:16px;font-weight:900;">' + num(data.top.n) + '</div></div>'
            + '</div></div>';
      } else if (data.top) {
        top = '<div class="u-panel" style="margin-top:12px;"><div class="u-bodys">لا مبيعَ مسجّلاً اليوم بعد — الشاشةُ تُحدَّث مع أوّل فاتورة.</div></div>';
      }
      body = k + top;
    }

    /* الوصولُ السريع — طلبك ١٥٣، ومرجعُ Proton Vault/Taxr */
    var q = quickList().map(function (t) {
      return '<a class="u-card u-card--tight u-card--click" href="' + esc(t.href) + '" '
           + 'onclick="GMTHome.use(\'' + esc(t.href) + '\')" '
           + 'style="display:flex;align-items:center;gap:9px;text-decoration:none;color:inherit;">'
           + '<span class="u-ico u-ico--sm">' + ic(t.ic) + '</span>'
           + '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:800;">' + esc(t.t) + '</span>'
           + (t.n ? '<span class="u-pill u-pill--quiet" style="font-size:10px;">' + num(t.n) + '</span>' : '')
           + '</a>';
    }).join('');
    var quick = '<div style="margin-top:14px;">'
      + '<div class="u-divider--text" style="margin:0 0 9px;">الوصول السريع</div>'
      + '<div class="u-g u-g--4">' + q + '</div></div>';

    host.innerHTML = '<div class="u-in">' + head + body + quick + '</div>';
  }

  /* ── التركيب ──────────────────────────────────────────────────────── */
  function hostEl() {
    var el = document.getElementById(MOUNT_ID);
    if (el) return el;
    /* لا مُثبّتَ في الصفحة؟ نضعه بعد الترويسة — لا نُزيح شيئاً ولا نحذف. */
    var h = document.querySelector('.wrap > header') || document.querySelector('header');
    if (!h || !h.parentNode) return null;
    el = document.createElement('div');
    el.id = MOUNT_ID;
    el.style.margin = '4px 0 6px';
    h.parentNode.insertBefore(el, h.nextSibling);
    return el;
  }

  var busy = false;
  async function refresh() {
    var host = hostEl();
    if (!host || busy) return;
    busy = true;
    host.innerHTML = '<div class="u-skel u-skel--line" style="width:30%;height:18px"></div>' + skeleton();
    try {
      var d = await collect();
      render(host, d, null);
    } catch (e) {
      render(host, null, (e && e.message) ? e.message : 'سببٌ غير معروف');
    } finally { busy = false; }
  }

  global.GMTHome = {
    mount: refresh, refresh: refresh, use: noteUse,
    collect: collect, sayWhy: sayWhy, money: money, name: userName,
    _collect: collect, _name: userName
  };

  function boot() {
    /* (2026-10-04 ي) الواجهةُ الرئيسيّة الجديدة ترسم أرقامها بنفسها من collect()
       — فلا نُركّب لوحةً ثانيةً فوقها. بقيّة الصفحات لا تتأثّر. */
    if (global.GMT_HOME_SHELL) return;
    if (!global.GMT_INTERNAL) return;         // صفحاتُ الزبون لا تعرض أرقامَ الشركة
    if (!document.querySelector('.wrap > header, header')) return;
    /* كلُّ رابطِ أداةٍ في البوابة يُسجّل استعماله — بلا تعديلِ أيّ رابط. */
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('a.card[href]');
      if (a) noteUse(a.getAttribute('href'));
    }, true);
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
