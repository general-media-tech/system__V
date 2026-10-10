/* ═══════════════════════════════════════════════════════════════════════════
   gmt-icons.js — طقمُ الأيقونات الموحَّد
   أُنشئ: 2026-10-04

   ══ طلبُك ══
   «الإيموجي الموجود بالجنب الإجمالي وسعر مستهلك والصورة، والإيموجي الموجود
    داخل كلّ فرع — كثير سيّئين، بدنا نغيّرهم. بدنا نعمل واجهة رسوميّة جديدة
    جميلة أنيقة حديثة».

   ══ لماذا كانت سيّئة فعلاً — لا ذوقاً ══
   الرمزُ التعبيريّ ليس أيقونة: **يرسمه نظامُ التشغيل لا نحن**. فالأيقونةُ
   نفسُها تظهر مسطّحةً على أندرويد، ومجسّمةً ملوّنةً على آيفون، ورماديّةً
   على ويندوز القديم. ولذلك كانت شاشاتُك تبدو من تطبيقاتٍ مختلفة **على
   أجهزةٍ مختلفة لنفس الشاشة**. وهي أيضاً:
     • لا تأخذ لونَ النصّ، فلا تخفت مع الحالة المعطَّلة ولا تحمر مع النشِطة.
     • أحجامُها غيرُ متساوية (📦 أعرضُ من 💵)، فتقفز الصفوف.
     • لا يقرأها القارئُ الصوتيّ باسمٍ مفهوم.

   ══ القرار ══
   طقمٌ واحدٌ **خطّيّ** (stroke) بسماكةٍ واحدة ١٫٨ ونهاياتٍ مدوّرة، يرث
   `currentColor` فيتبع لونَ سياقه تلقائياً. مرسومٌ هنا بالإحداثيات — لا
   مكتبةَ أيقوناتٍ تُحمَّل من الإنترنت (ونظامُك يعمل بلا إنترنت).

   ══ الاستعمال ══
     GMTIcon.svg('box', 18)        ⇒ نصُّ SVG
     GMTIcon.html('box')            ⇒ للإدراج في قالب
     <i data-icon="box"></i>        ⇒ تُستبدَل تلقائياً عند الإقلاع
     GMTIcon.scan(root)             ⇒ لإعادة المسح بعد رسمٍ جديد
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTIcon) return;

  /* كلُّ مسارٍ مرسومٌ على شبكة 24×24 — نفسُ الشبكة لكلّ أيقونة،
     فلا تختلف الأوزانُ البصريّة بين واحدةٍ وأخرى. */
  var P = {
    /* مخزونٌ وتجارة */
    box:      '<path d="M20.5 7.3 12 2 3.5 7.3v9.4L12 22l8.5-5.3z"/><path d="M3.5 7.3 12 12.6l8.5-5.3M12 22v-9.4"/>',
    boxes:    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    tag:      '<path d="M20.6 13.4 12 22l-8.5-8.5A2 2 0 0 1 3 12.1V4a1 1 0 0 1 1-1h8.1a2 2 0 0 1 1.4.6l8.6 8.6a1.4 1.4 0 0 1 0 2z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    cart:     '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.2l2.3 11.4a1.6 1.6 0 0 0 1.6 1.3h8.8a1.6 1.6 0 0 0 1.6-1.3L21 7H5"/>',
    store:    '<path d="M3 9.5 4.6 4h14.8L21 9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M4.5 11.8V20h15v-8.2"/><path d="M9.5 20v-5h5v5"/>',
    truck:    '<path d="M3 5h12v11H3z"/><path d="M15 9h3.6l2.4 2.8V16h-6z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>',
    factory:  '<path d="M3 21V10l5 3V10l5 3V7l8 4v10z"/><path d="M7 21v-3M12 21v-3M17 21v-3"/>',

    /* ماليّات */
    money:    '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M5.5 12h.01M18.5 12h.01"/>',
    coins:    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v5c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5"/>',
    receipt:  '<path d="M5 2h14v20l-2.3-1.6L14.4 22l-2.4-1.6L9.6 22l-2.3-1.6L5 22z"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/>',
    chart:    '<path d="M3 21h18"/><rect x="5" y="12" width="3.4" height="6" rx="1"/><rect x="10.3" y="8" width="3.4" height="10" rx="1"/><rect x="15.6" y="4" width="3.4" height="14" rx="1"/>',
    trend:    '<path d="M3 17l5.5-5.5 3.5 3.5L21 6"/><path d="M15.5 6H21v5.5"/>',
    wallet:   '<path d="M3 7a2 2 0 0 1 2-2h12v4"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H5a2 2 0 0 1-2-2z"/><circle cx="17" cy="14" r="1.2"/>',

    /* أشخاصٌ وفروع */
    user:     '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    users:    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19.5a6.5 6.5 0 0 1 13 0"/><path d="M16.5 5.3a3.2 3.2 0 0 1 0 5.4M18 19.5a6.4 6.4 0 0 0-2-4.6"/>',
    branch:   '<path d="M4 21V8l8-5 8 5v13"/><path d="M9.5 21v-6h5v6"/><path d="M8 11.5h1.5M14.5 11.5H16"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',

    /* حالات */
    check:    '<path d="M4 12.5 9.5 18 20 6"/>',
    alert:    '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    error:    '<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
    shield:   '<path d="M12 2.5 20 6v6c0 5-3.4 8.3-8 9.5-4.6-1.2-8-4.5-8-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',

    /* أدوات */
    search:   '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    barcode:  '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10.5 8v8M14 8v8M17 8v8"/>',
    print:    '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    image:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.6" cy="8.6" r="1.6"/><path d="M21 15.5 16 10.5 5 21"/>',
    camera:   '<path d="M3 8.5h3.3l1.6-2.4h8.2l1.6 2.4H21a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.8" r="3.6"/>',
    share:    '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8 15.8 6.7M8.2 13.2l7.6 4.1"/>',
    refresh:  '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
    bell:     '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z"/><path d="M13.7 19.5a2 2 0 0 1-3.4 0"/>',
    doc:      '<path d="M14 2H6.5A1.5 1.5 0 0 0 5 3.5v17A1.5 1.5 0 0 0 6.5 22h11a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 2v5h5"/><path d="M8.5 12.5h7M8.5 16.5h5"/>',
    trophy:   '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H4.5v1.8A3 3 0 0 0 7 10.2M17 5.5h2.5v1.8A3 3 0 0 1 17 10.2"/><path d="M12 14v3M9 20h6M10 17h4v3h-4z"/>',
    home:     '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    edit:     '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash:    '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9.5 6V4h5v2"/>',
    /* (2026-10-04 ي) أيقوناتُ الواجهة الرئيسية الجديدة — نفسُ الشبكة والسماكة */
    clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    pin:      '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    pen:      '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3M13 20h7"/>',
    link:     '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    layers:   '<path d="M12 3 2.5 8 12 13l9.5-5z"/><path d="m2.5 12.5 9.5 5 9.5-5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
    key:      '<circle cx="8" cy="15" r="4"/><path d="M11 12 20 3M17 6l3 3M15 8l2 2"/>',
    lock:     '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    brain:    '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 3 3 0 0 1-3-3"/>',
    flask:    '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
    bot:      '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
    grid:     '<circle cx="6" cy="6" r="1.4"/><circle cx="12" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/><circle cx="6" cy="18" r="1.4"/><circle cx="12" cy="18" r="1.4"/><circle cx="18" cy="18" r="1.4"/>',
    book:     '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
    sparkle:  '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    route:    '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
    palette:  '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.2-1-1.6-1-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    logout:   '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
    menu:     '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close:    '<path d="M6 6l12 12M18 6 6 18"/>',
    chevron:  '<path d="M15 6l-6 6 6 6"/>',
    star:     '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    volume:   '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    mute:     '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    monitor:  '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    bag:      '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    copy:     '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  };

  /* الاسمُ العربيّ لقارئ الشاشة — الأيقونةُ وحدها لا تقول شيئاً للمكفوف */
  var AR = {
    box: 'مخزون', boxes: 'مجموعات', tag: 'سعر', cart: 'سلّة', store: 'متجر',
    truck: 'شحن', factory: 'مشتريات', money: 'مبلغ', coins: 'عملات',
    receipt: 'فاتورة', chart: 'إحصاء', trend: 'اتجاه', wallet: 'محفظة',
    user: 'مستخدم', users: 'مستخدمون', branch: 'فرع', building: 'مبنى',
    check: 'تمّ', alert: 'تنبيه', error: 'خطأ', info: 'معلومة', clock: 'وقت',
    shield: 'كفالة', search: 'بحث', barcode: 'باركود', print: 'طباعة',
    image: 'صورة', camera: 'كاميرا', share: 'مشاركة', refresh: 'تحديث',
    bell: 'إشعارات', doc: 'مستند', trophy: 'الأعلى', home: 'الرئيسية',
    settings: 'إعدادات', plus: 'إضافة', edit: 'تعديل', trash: 'حذف',
    clipboard: 'طلبات', pin: 'موقع', pen: 'عقد', link: 'ربط', layers: 'توافقيات',
    calendar: 'تقويم', globe: 'موقع إلكتروني', key: 'كلمة سرّ', lock: 'قفل',
    database: 'نسخ احتياطي', briefcase: 'توظيف', brain: 'عقل النظام', flask: 'فحص',
    bot: 'بوت', grid: 'كل الأدوات', book: 'دليل', sparkle: 'جديد', route: 'خطّة',
    palette: 'هوية بصرية', keyboard: 'كيبورد', logout: 'خروج', menu: 'قائمة',
    close: 'إغلاق', volume: 'الصوت يعمل', mute: 'الصوت مكتوم', chevron: 'فتح', star: 'مثبّت', external: 'نافذة جديدة', copy: 'نسخ', monitor: 'نقطة البيع', bag: 'المتجر',
  };

  /* خريطةُ تحويلٍ من الرموز التعبيريّة التي كانت مستعملةً في النظام */
  var FROM_EMOJI = {
    '📦': 'box', '🗂️': 'boxes', '🗂': 'boxes', '🏷️': 'tag', '🏷': 'tag',
    '🛒': 'cart', '🏪': 'store', '🛍️': 'store', '🚚': 'truck', '🏭': 'factory',
    '💵': 'money', '💰': 'coins', '🧾': 'receipt', '📊': 'chart', '📈': 'trend',
    '👤': 'user', '👥': 'users', '🏢': 'branch', '🏬': 'building',
    '✅': 'check', '✔️': 'check', '⚠️': 'alert', '⛔': 'error', '❌': 'error',
    'ℹ️': 'info', '⏳': 'clock', '🕐': 'clock', '🛡️': 'shield', '🛡': 'shield',
    '🔍': 'search', '🔎': 'search', '🖨️': 'print', '🖼️': 'image', '📷': 'camera',
    '📤': 'share', '⟳': 'refresh', '🔔': 'bell', '📄': 'doc', '📋': 'doc',
    '🏆': 'trophy', '🏠': 'home', '⚙️': 'settings', '🔢': 'chart',
    /* أُضيفت بعد مسحِ ما بقي من رموزٍ في الشاشات (2026-10-04) */
    '📜': 'doc', '📝': 'edit', '👷': 'users', '👑': 'shield', '🏅': 'trophy',
    '🎬': 'image', '🔑': 'shield', '💳': 'wallet', '🧭': 'search', '🎛️': 'settings',
    '🎵': 'bell', '📑': 'doc', '🧮': 'chart', '🗄️': 'boxes', '🏬': 'building',
    '📲': 'home', '📱': 'home', '🖥️': 'home', '🔲': 'barcode', '🖨': 'print',
    '📕': 'doc', '📚': 'doc', '🧠': 'search', '🔗': 'share', '🔒': 'shield',
  };

  function svg(name, size, cls) {
    var d = P[name];
    if (!d) return '';
    var s = size || 18;
    return '<svg class="gmt-i' + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s + '"'
         + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
         + ' stroke-linecap="round" stroke-linejoin="round" role="img"'
         + ' aria-label="' + (AR[name] || name) + '">' + d + '</svg>';
  }

  function scan(root) {
    root = root || document;
    var n = 0;
    root.querySelectorAll('[data-icon]').forEach(function (el) {
      if (el.querySelector('svg.gmt-i')) return;
      var name = el.getAttribute('data-icon');
      var size = +el.getAttribute('data-icon-size') || 18;
      var h = svg(name, size);
      if (h) { el.innerHTML = h; n++; }
    });
    return n;
  }

  global.GMTIcon = {
    svg: svg,
    html: function (name, size) { return svg(name, size); },
    has: function (name) { return !!P[name]; },
    list: Object.keys(P),
    ar: AR,
    fromEmoji: function (e) { return FROM_EMOJI[e] || null; },
    scan: scan,
    /* يستبدل رمزاً تعبيريّاً داخل عنصرٍ بأيقونةٍ خطّيّة إن عرفناها */
    swap: function (el, size) {
      if (!el) return false;
      var t = (el.textContent || '').trim();
      var name = FROM_EMOJI[t];
      if (!name) return false;
      el.innerHTML = svg(name, size || 18);
      return true;
    }
  };

  function boot() {
    scan(document);
    /* تُعاد بعد الرسوم المتأخّرة */
    setTimeout(function () { scan(document); }, 900);
    setTimeout(function () { scan(document); }, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
