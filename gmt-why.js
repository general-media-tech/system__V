/* ═══════════════════════════════════════════════════════════════════════════
   gmt-why.js — يترجم خطأ القاعدة إلى سببٍ وإجراء  ·  2026-10-03
   ─────────────────────────────────────────────────────────────────────────
   العطل الذي وَلَد هذا الملف (الصورة ٢٦ · بلاغ المالك):

       «حدث خطأ أثناء حفظ الشهادة في قاعدة البيانات: Failed to fetch»

   ‏«Failed to fetch» ليست رسالة خطأ — هي **اعتراف المتصفّح بأنّه لا يعرف**.
   تظهر حين لا يصل الطلب إلى الخادم أصلاً: لا إنترنت، أو **مشروع Supabase
   موقوف** (الخطة المجانية توقف المشروع المهمَل)، أو الموقع محجوب. والمالك
   لا يملك من هذه الجملة شيئاً يفعله.

   ولماذا وحدة مشتركة لا تعديل في موضع البلاغ؟ لأنّ المسح أظهر **١٤١ موضعاً**
   تعرض `e.message` للمستخدم كما هي. ترقيع موضعٍ واحد يترك ١٤٠ على حالها،
   وأيّ طلبٍ جديد يعيد المشكلة. هنا مترجمٌ واحد يُستدعى من أي مكان.

   الاستعمال:
       GMTWhy.say(err)                      ⇒ نصٌّ عربيّ يشرح ويقترح
       GMTWhy.say(err, { what: 'حفظ الكفالة' })
       await GMTWhy.probe(url)              ⇒ هل تستجيب هذه القاعدة الآن؟

   🛡️ لا يغيّر أي سلوك ولا يبتلع خطأً — يحوّل نصّه فقط.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* رسائل انقطاع الشبكة كما تكتبها المتصفّحات المختلفة */
  var NET = /failed to fetch|networkerror|load failed|network request failed|err_|ecconnrefused|fetch failed/i;

  function statusOf(err) {
    if (!err) return 0;
    if (typeof err.status === 'number') return err.status;
    var m = String(err.message || err).match(/\bHTTP\s*(\d{3})\b/);
    return m ? Number(m[1]) : 0;
  }

  function bodyOf(err) { return String((err && (err.body || err.message)) || err || ''); }

  function say(err, opts) {
    var o    = opts || {};
    var what = o.what ? ('«' + o.what + '»: ') : '';
    var txt  = bodyOf(err);
    var st   = statusOf(err);

    /* ① لم يصل الطلب إطلاقاً — وهذه حالة المالك في الصورة ٢٦ */
    if (!st && NET.test(txt)) {
      return what + 'القاعدة لم تردّ إطلاقاً — الطلب لم يصل إليها.\n' +
             'الأسباب بترتيب الاحتمال:\n' +
             '① مشروع Supabase **موقوف** (الخطة المجانية توقف المشروع المهمَل) — افتح لوحة Supabase وشغّله.\n' +
             '② لا إنترنت على الجهاز.\n' +
             '③ الشبكة تحجب الموقع (واي‑فاي شركة أو مزوّد).\n' +
             'جرّب زرّ «افحص الاتصال» لتعرف أيّها.';
    }

    /* ② عمودٌ غير موجود — النمط P1: عمودٌ واحد يرفض الطلب كلّه */
    if (/42703|PGRST204|column .* does not exist|schema cache/i.test(txt)) {
      var col = (txt.match(/column\s+"?([a-z_][a-z0-9_]*)"?/i) || [])[1];
      return what + 'القاعدة رفضت الطلب لأنّ فيه عموداً لا تعرفه' +
             (col ? ' («' + col + '»)' : '') + '.\n' +
             'المعنى: ملفّ SQL الذي يُنشئ هذا العمود **لم يُشغَّل بعد**.\n' +
             'شغّل ملفّات SQL بالترتيب ثمّ أعِد المحاولة.';
    }

    /* ③ صلاحيات */
    if (st === 401 || st === 403 || /42501|row-level security|JWT|permission denied/i.test(txt)) {
      return what + 'القاعدة ردّت بـ«ممنوع» — المفتاح غير صالح أو سياسة الصلاحيات (RLS) تمنع هذه العملية.\n' +
             'راجع المفتاح في gmt-config.js وسياسات الجدول.';
    }

    if (st === 404) {
      return what + 'المسار غير موجود — غالباً اسم الجدول خطأ أو الجدول غير مُنشأ في هذه القاعدة.';
    }

    if (st === 409 || /duplicate key|23505/i.test(txt)) {
      return what + 'هذا السجلّ موجودٌ مسبقاً — القاعدة منعت التكرار. ولم يُضَف شيء مرّتين.';
    }

    if (st >= 500) {
      return what + 'خطأٌ في خادم القاعدة (' + st + ') — ليس من عندنا. أعِد المحاولة بعد قليل.';
    }

    if (st === 400) {
      return what + 'القاعدة رفضت شكل الطلب (400).\nتفصيلها: ' + txt.slice(0, 220);
    }

    return what + (txt ? txt.slice(0, 260) : 'خطأ غير معروف');
  }

  /* يفحص إن كانت قاعدةٌ تستجيب الآن. يرجع { ok, status, why } */
  async function probe(url, key) {
    var base = String(url || '').replace(/\/+$/, '');
    try {
      var h = key ? { apikey: key, Authorization: 'Bearer ' + key } : undefined;
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, 12000);
      var r = await fetch(base + '/rest/v1/', { headers: h, signal: ctrl.signal });
      clearTimeout(t);
      return { ok: r.ok || r.status === 401 || r.status === 404,   // ردّت = حيّة
               status: r.status,
               why: (r.ok || r.status === 401 || r.status === 404)
                      ? 'القاعدة تستجيب'
                      : 'ردّت بالحالة ' + r.status };
    } catch (e) {
      return { ok: false, status: 0,
               why: (e && e.name === 'AbortError')
                      ? 'انتهت المهلة بلا ردّ — القاعدة لا تستجيب (موقوفة أو لا إنترنت)'
                      : 'لم تردّ إطلاقاً — غالباً المشروع موقوف على Supabase أو لا إنترنت' };
    }
  }

  global.GMTWhy = { say: say, probe: probe };
})(window);
