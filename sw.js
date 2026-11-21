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

const VERSION = 'gmt-v20261121o';       // ⬅️ غيّره في كل نشر
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
/* (TASK-0342 · المالك seq 580–584) توقّفت القاعدة الرئيسية لتجاوز «حصّة التحميل» (402 · exceed_cached_egress_quota):
   ٢٩٥٧ صورة من ٢٩٨٦ مخزَّنة بـ «no-cache» ⇒ كلّ جهاز يعيد تنزيل كلّ صورة في كلّ فتحة. الآن صور المنتجات (وليست بيانات القاعدة —
   القاعدة الصارمة أعلاه للبيانات المالية تبقى كما هي) تُحفظ على الجهاز بعد أوّل تنزيل: تُعرض فوراً من الجهاز، وتُجدَّد في
   الخلفية مرّة كلّ ٧ أيام فقط · وتظهر حتى لو توقّفت القاعدة. الاسم ثابت (لا يُمسح مع النشر) · سقف ١٥٠٠ صورة. */
const IMGS = 'gmt-imgs';
const IMG_MAX = 1500, IMG_TTL = 7 * 864e5;
/* (9 ت2 · المالك seq 598 «معظم الصور اختفت أو صارت رمادية … خاصّة البوسترات») بعد نقل الصور إلى GitHub (img/p) صارت من نفس الموقع
   فوقعت في فرع «ملفّات الموقع»: تُسأل الشبكةَ في كلّ فتحة (مئات الطلبات · رمادي حتى تردّ على اتّصال ضعيف) وتُخزَّن بلا سقف في كاش
   الصفحات (مئات م.ب) فيمتلئ تخزين الجهاز ويحذف المتصفّح ما خزّنه. الآن: صور img/p صور منتجات — من الجهاز أوّلاً في gmt-imgs. */
function isRepoImg(url) { return url.origin === location.origin && /\/img\/[pt]\//.test(url.pathname); }   /* (seq 626) img/t = المصغّرات */
function isProdImg(url) {
  if (isRepoImg(url)) return true;
  return /supabase\.co$/.test(url.hostname) &&
    /\/storage\/v1\/(object|render\/image)\/public\/products-images\//.test(url.pathname) &&
    !/\.json$/i.test(url.pathname);
}
/* (TASK-0358 · المالك seq 626 «ما في داعي يتحمّل المتجر عند الزبون وعلى جهازه») صفحات الزبون (المتجر · الموقع · البحث · التتبّع · الكفالة ·
   أماكن الوصول): طلباتها تمرّ إلى الشبكة كأيّ موقعٍ عادي — لا صور تُحفظ على الجهاز ولا صفحات. صفحات الموظّفين كما هي. */
const PUBLIC_RE = /(^|\/)(store|site|search|track_order|guarantee|%D8%A3%D9%85%D8%A7%D9%83%D9%86_%D8%A7%D9%84%D9%88%D8%B5%D9%88%D9%84|أماكن_الوصول|%D8%A7%D8%A8%D9%82_%D8%B9%D9%84%D9%89_%D8%A7%D8%B7%D9%84%D8%A7%D8%B9|ابق_على_اطلاع)\.html$/i;
function isPublicReq(req, url) {
  try {
    if (req.mode === 'navigate') return url.origin === location.origin && PUBLIC_RE.test(url.pathname);
    if (!req.referrer) return false;
    const r = new URL(req.referrer);
    return r.origin === location.origin && PUBLIC_RE.test(r.pathname);
  } catch (_) { return false; }
}
async function imgTrim(c) {
  try { const ks = await c.keys(); if (ks.length > IMG_MAX) for (const k of ks.slice(0, ks.length - IMG_MAX)) await c.delete(k); } catch (_) {}
}
async function imgFetchPut(c, href, waitUntil) {
  /* mode:'cors' (الخادم يسمح) ⇒ استجابة حقيقية بحجمها الفعلي — الاستجابة «المعتمة» لوسم <img> تُحسب في المتصفّح ~٧ م.ب لكلّ صورة */
  const res = await fetch(href, { mode: 'cors', credentials: 'omit' });
  if (res && res.ok) {
    /* (المالك seq 626) كانت الصورة تنتظر اكتمال حفظها في الكاش قبل أن تُعرض (وفشلُ الحفظ عند امتلاء التخزين يعيد تنزيلها) ⇒
       الآن تُعرض فوراً ويُحفظ نسخها في الخلفية؛ فشل الحفظ لا يمسّ العرض */
    const job = (async () => {
      const body = await res.clone().blob();
      const h = new Headers(res.headers); h.set('x-gmt-at', String(Date.now()));
      await c.put(href, new Response(body, { status: 200, headers: h }));
      if (Math.random() < 0.05) imgTrim(c);
    })().catch(() => {});
    if (waitUntil) waitUntil(job); else await job;
  }
  return res;
}

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
  './gmt-intro.js', './gmt-sound.js', './gmt-refresh.js', './gmt-autobackup.js', './gmt-notify.js', './gmt-push.js', './gmt-inbox.js', './gmt-whatsnew.js',
  './gmt-learn.js', './gmt-receipt.js', './gmt-oplog.js', './gmt-screen.js', './gmt-lessons.js', './gmt-nofab.js', './gmt-fitrow.js', './gmt-stock.js', './gmt-bidi.js', './gmt-ledger.js', './gmt-share.js', './gmt-endpoint.js', './gmt-brain.js', './gmt-selfcheck.js', './gmt-sticker.js', './gmt-gallery.js', './gmt-wclaims.js', './gmt-product-edit.js', './gmt-custcache.js', './gmt-custsync.js', './gmt-layers.js', './gmt-invoice-tpl.js', './gmt-signpad.js', './gmt-refund.js', './gmt-store-sync.js', './gmt-merge-review.js',
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
      .filter(k => k !== PAGES && k !== OCR && k !== IMGS && k !== 'gmt-push-state' && !k.startsWith(VERSION))
      .map(k => caches.delete(k)));
    /* (seq 598) صور img/p التي دخلت كاش الصفحات خطأً ⇒ تُحذف منه (تحرير تخزين الجهاز) */
    try { const pc = await caches.open(PAGES); for (const r of await pc.keys()) if (/\/img\/p\//.test(r.url)) await pc.delete(r); } catch (_) {}
    await self.clients.claim();
  })());
});

/* رسالة من الصفحة: «حدّث الآن» */
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting' || (e.data && e.data.type === 'skipWaiting')) self.skipWaiting();
  /* (TASK-B0420) الإشعارات الفوريّة: مسح الشارة · حفظ إعدادات إعادة الاشتراك التلقائي */
  if (e.data && e.data.type === 'gmt-badge-clear') { e.waitUntil((async () => { await pushState(() => ({ n: 0 })); try { if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); } catch (_) {} })()); }
  if (e.data && e.data.type === 'gmt-push-cfg' && e.data.cfg) e.waitUntil(pushState(() => ({ cfg: e.data.cfg })));
});

/* ═══ (TASK-B0420 · docs/دراسة_الإشعارات_الفورية.md المهمّة ٧) الإشعارات الفوريّة: الاستقبال · النقر · الشارة · تجديد الاشتراك ═══ */
const PUSHST = 'gmt-push-state';            // اسمٌ ثابت — مستثنى من حذف الكاشات القديمة في activate
async function pushState(patch) {
  const c = await caches.open(PUSHST), r = await c.match('st');
  const st = r ? await r.json() : { n: 0 };
  if (patch) { Object.assign(st, patch(st)); await c.put('st', new Response(JSON.stringify(st))); }
  return st;
}
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { t: 'GMT', b: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const seen = wins.some(w => w.focused && w.visibilityState === 'visible');
    wins.forEach(w => { try { w.postMessage({ type: 'gmt-push', d }); } catch (_) {} });   // الصفحة تُحدَّث وتُصدر صوتها
    const st = await pushState(seen ? null : (x) => ({ n: (x.n || 0) + 1 }));
    try { if (!seen && self.navigator.setAppBadge) await self.navigator.setAppBadge(st.n); } catch (_) {}
    await self.registration.showNotification(d.t || 'GMT', {
      body: d.b || '', tag: d.tag || d.k || 'gmt', renotify: d.k === 'order' || d.k === 'transfer',
      icon: './gmt-icon-192.png', badge: './gmt-icon-192.png', dir: 'rtl', lang: 'ar', silent: seen, image: d.img || undefined,   /* (TASK-B0424 · الحملات) صورة الحملة */
      vibrate: (d.k === 'order' || d.k === 'transfer') ? [200, 100, 200] : undefined,
      data: { u: d.u || './home.html', k: d.k }, timestamp: Date.now() });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let u; try { u = new URL((e.notification.data && e.notification.data.u) || './home.html', self.registration.scope); } catch (_) {}
  if (!u || u.origin !== self.location.origin) u = new URL('./home.html', self.registration.scope);   // رابطٌ من أصلٍ آخر ⇒ الرئيسية
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find(x => { try { return new URL(x.url).pathname === u.pathname; } catch (_) { return false; } }) || wins[0];
    if (w) {
      await w.focus();
      let same = false; try { same = new URL(w.url).pathname === u.pathname; } catch (_) {}
      if (same) { w.postMessage({ type: 'gmt-push-open', u: u.href }); return; }
      if (w.navigate) return w.navigate(u.href);
    }
    return self.clients.openWindow(u.href);
  })());
});
/* تغيّر الاشتراك (المتصفّح جدّد المفتاح) ⇒ نشترك من جديد بالإعدادات التي خزّنتها الصفحة ونبلّغ الخادم */
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const st = await pushState(); const cfg = st.cfg; if (!cfg || !cfg.fn || !cfg.vapid || !cfg.sub) return;
      const pad = '='.repeat((4 - cfg.vapid.length % 4) % 4), raw = atob((cfg.vapid + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const key = Uint8Array.from(raw, c => c.charCodeAt(0));
      const ns = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const j = ns.toJSON();
      const post = (b) => fetch(cfg.fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.anon, Authorization: 'Bearer ' + cfg.anon }, body: JSON.stringify(b) });
      await post(Object.assign({}, cfg.sub, { action: 'subscribe', sub: { endpoint: j.endpoint, keys: j.keys } }));
      if (cfg.old) await post({ action: 'unsubscribe', endpoint: cfg.old.endpoint, auth: cfg.old.auth });
      await pushState(() => ({ cfg: Object.assign({}, cfg, { old: { endpoint: j.endpoint, auth: j.keys.auth } }) }));
    } catch (_) { /* سيُجدَّد عند فتح التطبيق (resync) */ }
  })());
});

function isLib(url) { return LIB_HOSTS.includes(url.hostname); }

/* (١ ت2 · المالك seq 329 «لما بتبعث تحديثات ما عم تنزل») «الشبكة أوّلاً» كانت تمرّ بكاش المتصفّح العاديّ، وGitHub Pages
   يسمح له بإعادة الملفّ نفسه ١٠ دقائق (max-age=600) ⇒ بعد النشر تُفتح الصفحة القديمة بنصّها القديم وأرقام ?v= القديمة.
   الآن: الصفحات وكلّ ملفٍّ بلا ?v= تُسأل عنها الخادمَ كلّ مرّة (no-cache: إن لم تتغيّر يردّ «لم يتغيّر» بلا تنزيل).
   الملفّات ذات ?v= يتغيّر رابطها مع كلّ نشر فتبقى كما هي. */
async function fresh(req, url) {
  const page = req.mode === 'navigate' || /\.html$/.test(url.pathname) || /\/$/.test(url.pathname);
  if (!page && url.search) return fetch(req);
  if (req.mode !== 'navigate') return fetch(req, { cache: 'no-cache' });
  /* طلب التنقّل لا يُنسخ بخيارات ⇒ نطلب رابطه؛ وإن أعاد الخادم توجيهاً نترك المتصفّح يتبعه بطلبه الأصليّ */
  const res = await fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' });
  return res.redirected ? fetch(req) : res;
}

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
  if (isPublicReq(req, url)) return;                      // (TASK-0358) صفحة زبون: شبكة عادية — لا تخزين على جهازه

  /* صور المنتجات: من الجهاز أوّلاً (انظر IMGS أعلاه) */
  if (isProdImg(url)) {
    e.respondWith((async () => {
      const c = await caches.open(IMGS), href = url.href;
      const hit = await c.match(href);
      if (hit) {
        const at = Number(hit.headers.get('x-gmt-at') || 0);
        if (Date.now() - at > IMG_TTL) e.waitUntil(imgFetchPut(c, href).catch(() => {}));
        return hit;
      }
      try { return await imgFetchPut(c, href, p => { try { e.waitUntil(p); } catch (_) {} }); }
      catch (err) { return fetch(req); }
    })());
    return;
  }

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
        const res = await fresh(req, url);
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
