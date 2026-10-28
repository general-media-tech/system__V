/* ═══════════════════════════════════════════════════════════════════════════
   sw.js — عامل الخدمة (PWA)  ·  2026-08-26
   ─────────────────────────────────────────────────────────────────────────
   قرار المالك (2026-08-22): «رح أحوّله لتطبيق، وأي حدا بيفتحه بالبداية بتنزل
   عنده كل البيانات والصور — كرمال نخفّف الضغط على قاعدة البيانات، ويصير فقط تزامن».

   تقسيم المسؤوليات (مهم — لا تخلطها):
     • هذا الملف  ⇐ **الصفحات والمكتبات والخطوط** فقط (قشرة التطبيق).
     • GMTCache    ⇐ بيانات القاعدة والصور (IndexedDB).
     • GMTSync     ⇐ طابور الكتابة بلا إنترنت.
     • GMTWarmup   ⇐ التنزيل الأوّلي الكامل مرّة واحدة.

   🔒 قاعدة صارمة: **بيانات Supabase لا تُخزَّن هنا إطلاقاً** — دائماً من الشبكة.
      (تخزينها يعني عرض أرقام مالية قديمة، وهو أخطر من عدم العمل بلا إنترنت.)

   ⚠️ شرط المالك الإلزامي: تحديث مربوط بالإصدار + زر «تحديث الآن» —
      تفادياً لتكرار شكوى «الإصلاحات لا تعمل» (نمط P12).
      ⇒ غيّر VERSION في كل نشر، وسيُعرض إشعار تحديث تلقائياً.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERSION = 'gmt-v20261029j';       // ⬅️ غيّره في كل نشر
const LIBS    = VERSION + '-libs';
/* (22 ت1 · TASK-0122) ملفّات قارئ الإيصال (lib/ocr: نواة التعرّف ٣٫٩ م.ب + نموذج العربية ١٫٧ م.ب) — كانت «الشبكة أوّلاً» مثل
   صفحات الموقع، فتُطلب من الشبكة في كل فتحة صفحة (بطيءٌ على اتّصالٍ ضعيف). محتواها ثابتٌ لاسمها (tesseract.js 7.0.0)
   ⇒ «الكاش أوّلاً» في كاشٍ باسم إصدار المكتبة لا يُحذف مع كل نشرة. تغيير المكتبة ⇐ اسمٌ جديد هنا. */
const OCR     = 'gmt-ocr-tess7.0.0';
function isOcr(url) { return url.origin === location.origin && /\/lib\/ocr\//.test(url.pathname); }

/* ══════════════════════════════════════════════════════════════════════════
   🔴 (2026-10-03 · بلاغ المالك) «التطبيق لمّا عم افتحه وما في إنترنت ما عم
   يفتح أبداً ويكتب لا يوجد اتصال — وهذا مخالف لكل شغلنا، ما عم يدخّلني
   عالواجهة الرئيسية حتى».

   سببان اجتمعا:
     ① اسم كاش الصفحات كان يحمل رقم الإصدار، و`activate` يحذف كل ما لا يبدأ
        بالإصدار الجديد ⇒ **كل نشرةٍ تمسح صفحات المستخدم المخزَّنة**، فيبقى
        بلا شيء حتى يزور كل صفحةٍ وهو متّصل. وهذا يناقض أساس المشروع نفسه:
        «أي حدا بيفتحه بالبداية بتنزل عنده كل البيانات والصور».
     ② المطابقة عند الانقطاع كانت دقيقةً حرفياً، فرابطٌ فيه `?v=` أو `?src=pwa`
        لا يطابق المخزَّن ⇒ يسقط فوراً إلى صفحة «لا يوجد اتصال».

   العلاج:
     • كاش الصفحات **ثابت الاسم** لا يُمسح مع الإصدار (الشبكة أوّلاً تضمن
       الطزاجة عند الاتصال، فلا خطر من بقائه).
     • سلسلة سقوطٍ متدرّجة عند الانقطاع: مطابقة دقيقة ← بتجاهل الاستعلام ←
       الصفحة الرئيسية ← index ← الجذر ← ثمّ صفحة الخطأ **أخيراً**.
     • `c.add` صار يُبلّغ عن فشله بدل ابتلاعه، كي لا يبقى التثبيت ناقصاً بصمت.
   ══════════════════════════════════════════════════════════════════════════ */
const PAGES = 'gmt-pages';             // ⚠️ بلا رقم إصدار — عمداً

/* قشرة التطبيق: تُخزَّن عند التثبيت. الصفحات الكبيرة تُخزَّن عند أوّل زيارة. */
const CORE = [
  './', './home.html', './index.html',
  './gmt-theme.css', './lib/tailwind.css',
  './gmt-config.js', './gmt-core.js', './gmt-staff.js', './gmt-sync.js',
  './gmt-image-guard.js', './gmt-warmup.js', './gmt-hints.js',
  './gmt-brand.js', './gmt-auth.js', './gmt-pwa.js', './gmt-updater.js',
  './manifest.json',
  /* (2026-10-04 ي) الواجهةُ الرئيسيّة الجديدة تحتاجها لتفتح بلا إنترنت */
  './gmt-ui.css', './gmt-tools.js', './gmt-account.js', './gmt-icons.js', './gmt-home.js', './gmt-ask.js',
  './gmt-intro.js', './gmt-sound.js', './gmt-refresh.js', './gmt-autobackup.js', './gmt-notify.js', './gmt-whatsnew.js',
  './gmt-learn.js', './gmt-receipt.js', './gmt-oplog.js', './gmt-screen.js', './gmt-lessons.js', './gmt-nofab.js', './gmt-fitrow.js', './gmt-stock.js', './gmt-bidi.js', './gmt-ledger.js', './gmt-share.js', './gmt-sticker.js', './gmt-gallery.js', './gmt-wclaims.js', './gmt-product-edit.js', './gmt-custcache.js', './gmt-invoice-tpl.js', './gmt-signpad.js', './gmt-refund.js',
  /* (TASK-0105) صورة/PDF الأوردر بلا إنترنت: المُصيِّر الداخلي وخطّ Cairo المستضاف + شارة قفل الأوردرات */
  './gmt-render.js', './gmt-orders-lock.js', './lib/fonts/Cairo-var-arabic.woff2', './lib/fonts/Cairo-var-latin.woff2',
  './logo.jpg', './favicon.ico', './canonlogo.png',   /* (TASK-0216 · المالك seq 172) شعار Canon الأصلي من المالك */
];

/* المكتبات صارت **مستضافة ذاتياً** في lib/ (2026-08-26) ⇒ تُخزَّن كملفات موقع عادية.
   يبقى مضيفو الخطوط فقط خارجيين. */
const LIB_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(PAGES);
    const failed = [];
    await Promise.all(CORE.map(u => c.add(u).catch(() => failed.push(u))));
    if (failed.length) console.warn('[GMT sw] لم تُخزَّن عند التثبيت:', failed);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    /* نحذف كاشات المكتبات القديمة فقط — وكاش الصفحات يبقى.
       (كان الحذف يشمل الصفحات، فيفقد المستخدم كل ما خزّنه مع كل نشرة.) */
    await Promise.all(keys
      .filter(k => k !== PAGES && k !== OCR && !k.startsWith(VERSION))
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* رسالة من الصفحة: «حدّث الآن» */
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting' || (e.data && e.data.type === 'skipWaiting')) self.skipWaiting();
});

function isLib(url) { return LIB_HOSTS.includes(url.hostname); }

/* سلسلة السقوط عند الانقطاع — من الأدقّ إلى الأعمّ، وصفحة الخطأ آخرها */
async function offlineFallback(c, req) {
  let hit = await c.match(req);
  if (hit) return hit;
  hit = await c.match(req, { ignoreSearch: true });          // يتجاوز ?v= و ?src=pwa
  if (hit) return hit;
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    for (const u of ['./home.html', './index.html', './']) {
      hit = await c.match(new URL(u, self.registration.scope).href, { ignoreSearch: true });
      if (hit) return hit;
    }
  }
  return null;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // الكتابة لا تُعترض أبداً
  if (req.headers.has('range')) return;                   // (١٨ ت1) طلبات الفيديو/الصوت الجزئية (206) للمتصفّح نفسه — الكاش لا يقبل 206 وسفاري يحتاجها كما هي
  const url = new URL(req.url);

  /* 🔒 بيانات القاعدة والتخزين والإشعارات: شبكة فقط — لا كاش إطلاقاً */
  if (/supabase\.co$/.test(url.hostname) || /api\.telegram\.org$/.test(url.hostname) || /jsonbin/.test(url.hostname)) return;

  /* المكتبات والخطوط وقارئ الإيصال: من الكاش أولاً (لا تتغيّر — مثبّتة الإصدار) */
  if (isLib(url) || isOcr(url)) {
    e.respondWith((async () => {
      const c = await caches.open(isOcr(url) ? OCR : LIBS);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || (res.type === 'opaque' && !isOcr(url)))) c.put(req, res.clone());
        return res;
      } catch (err) {
        return hit || Response.error();
      }
    })());
    return;
  }

  /* ملفات الموقع نفسه: الشبكة أولاً (كي تصل الإصلاحات فوراً) ثم الكاش عند الانقطاع */
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(PAGES);
      try {
        const res = await fetch(req);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await offlineFallback(c, req);
        if (hit) return hit;
        /* لا نصل هنا إلا لصفحةٍ لم تُفتح قطّ ولا قشرةَ تطبيقٍ مخزَّنة */
        return new Response(
          '<!DOCTYPE html><html dir="rtl"><meta charset="utf-8">' +
          '<body style="font-family:Tahoma,sans-serif;text-align:center;padding:40px">' +
          '<h2>لا يوجد اتصال</h2><p>هذه الصفحة لم تُفتح من قبل، فلم تُحفظ على جهازك.</p>' +
          '<p style="color:#5b6472;font-size:13px">افتحها مرّة واحدة وأنت متصل لتعمل لاحقاً بلا إنترنت.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        );
      }
    })());
  }
});
