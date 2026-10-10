/* ═══════════════════════════════════════════════════════════════════════════
   gmt-lessons.js — محتوى الدروس خطوة بخطوة (المحرّك: gmt-learn.js)  ·  ٧ ت١ ٢٠٢٦ (ط)
   ─────────────────────────────────────────────────────────────────────────
   كل درس = عمليّة كاملة كما تحدث في يوم العمل، على الأزرار الحقيقيّة.
   الخطوة: { sel, title, text, do:'click'|'type'|'pick'|'read', until(el)?, prep()?, warn?, miss? }
     do:'click' ⇒ ينتقل وحده حين تضغط الزرّ المُضاء · until ⇒ ينتقل وحده حين يتحقّق الشرط.
   كل محدِّد هنا مُتحقَّقٌ منه آليّاً على الصفحة الحقيقيّة (فحص_الدروس.py) — لا تخمين.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.GMTLearn) return;
  var val = function (el) { return el && String(el.value || '').trim().length >= 2; };
  var shown = function (sel) { return function () { var e = document.querySelector(sel); return !!(e && e.offsetParent !== null); }; };

  /* ══════════════════════════ نقطة البيع ══════════════════════════ */
  var addProduct = [
    { sel: '#searchInput', do: 'type', title: 'ابحث عن القطعة', test: 'كاميرا',
      text: 'اكتب جزءاً من الاسم أو امسح الباركود بالماسح — النتائج تظهر فوراً. تقدر أيضاً تتصفّح بالتصنيفات تحته.',
      hint: 'اكتب ثمّ «التالي» — أو «التالي» مباشرةً للتصفّح' },
    { sel: '#prodsGrid button[onclick*="toggleProd"]', do: 'click', title: 'أضِف القطعة للسلّة',
      text: 'زرّ <b>+</b> على البطاقة يضيف قطعة. اضغطه مرّةً ثانية لقطعتين من نفس المنتج — العدد يظهر على البطاقة.',
      miss: 'لا منتجات ظاهرة — امسح البحث أو اختر «الكل»' },
    { sel: ['#cartPriceRows', '#v-cart'], do: 'read', title: 'هذه سلّتك',
      text: 'البنود والكمّيات والإجمالي — كلّها في الصفحة نفسها. أكمل الإضافة من فوق متى شئت.' },
    { sel: 'button[onclick*="v-checkout"]', do: 'click', title: 'التالي — بيانات العميل',
      text: 'حين تنتهي من القطع انتقل لبيانات الزبون.' }
  ];

  GMTLearn.define('pos', [
    { id: 'sale-cash', icon: '🧾', title: 'بيع نقدي — فاتورة كاملة', writes: true, creates: 'فاتورة بيع',
      goal: 'من البحث عن القطعة حتى الحفظ والطباعة — ١٧ خطوة.',
      after: 'هذه هي الفاتورة كاملة. جرّب بعدها «بيع آجل بشحن» و«مرتجع».',
      steps: addProduct.concat([
        { sel: 'button[onclick^="setSaleType(\'نقدي\'"]', do: 'click', title: 'نوع البيع: نقدي',
          text: '<b>نقدي</b> = الزبون يدفع الآن. <b>آجل (شحن)</b> = بضاعةٌ تُشحن ويُحصَّل ثمنها لاحقاً (له درسٌ خاص).' },
        { sel: '#checkout-btn-usd', do: 'read', title: 'العملة',
          text: 'دولار أو ليرة. الليرة تُحسب بسعر الصرف المسجّل وتُطبع على الفاتورة بالعملة التي اخترتها.' },
        { sel: '#custName', do: 'type', title: 'اسم الزبون', until: val,
          text: 'ابدأ بكتابة الاسم — إن كان زبوناً سابقاً يظهر لك لتختاره بضغطة. مستحسنٌ دائماً، وإلزاميٌّ في الآجل.' },
        { sel: '#custPhone', do: 'type', title: 'هاتف الزبون',
          text: 'يُطبع على الفاتورة، ومنه تُعبَّأ الكفالة والتتبّع تلقائياً. اختياريٌّ في النقدي.' },
        { sel: 'button[onclick*="validateCheckout"]', do: 'click', title: 'التالي — مراجعة الفاتورة',
          text: 'ترى الفاتورة كما ستُطبع، وتعدّل أيّ شيءٍ قبل الحفظ.' },
        { sel: '#inv-sale-type', do: 'read', title: 'راجع البيانات',
          text: 'الاسم · الهاتف · نوع البيع · الملاحظات — كلّها قابلة للتعديل هنا قبل الحفظ.' },
        { sel: '#v-print input[onclick="this.select()"]', do: 'read', title: 'السعر قابلٌ للتعديل',
          text: 'عند المساومة عدّل سعر البند هنا. <b>فوق الجملة</b> = عمولة لك · <b>تحت الجملة</b> = عمولة سالبة · <b>تحت التكلفة</b> ممنوع ويحتاج الإدارة.' },
        { sel: '#v-print button[onclick^="changePreviewQty"]', do: 'read', title: 'الكمّية',
          text: '− و + لتعديل الكمّية. لا تتجاوز مخزون فرعك (إلّا العروض).' },
        { sel: '#couponCode', do: 'read', title: 'كوبون الخصم',
          text: 'معه كوبون؟ اكتب رقمه ثم «تطبيق». الكوبون يُختم مرّةً واحدة فقط — لا يُستعمل مرّتين.' },
        { sel: '#btn-save-invoice', do: 'click', title: 'احفظ الفاتورة نهائياً', delay: 900,
          text: 'الحفظ يسجّل الفاتورة · يخصم المخزون من فرعك · يحسب عمولتك · يُشعر الإدارة. <b>لا تُلغى بعدها إلّا بمرتجع.</b>',
          warn: 'في الوضع التدريبي كل هذا محاكاة — لا شيء يُحفظ ولا يُخصم.' },
        { sel: 'button[onclick*="goTo(\'v-print\')"]', do: 'click', title: 'تمّت الفاتورة ✓',
          text: 'من هنا ثلاثة: <b>طباعة / تنزيل</b> · <b>🛡️ كفالة</b> (للكاميرات والعدسات) · <b>فاتورة جديدة</b> للزبون التالي. اضغط «طباعة / تنزيل».',
          miss: 'لم يكتمل الحفظ — راجع الرسالة الظاهرة' },
        { sel: '#printer-profile', do: 'pick', title: 'نوع طابعتك',
          text: 'اختره مرّةً واحدة (A4 أو حراريّة ٨٠ مم) — الجهاز يتذكّره في كل فاتورة بعدها.' },
        { sel: 'button[onclick="printByProfile()"]', do: 'read', title: 'اطبع — أو أرسل صورة',
          text: '«🖨 اطبع بطابعتي» للطباعة. و«صورة» تحفظ الفاتورة صورةً ترسلها للزبون على واتساب.' }
      ]) },

    { id: 'sale-ship', icon: '📦', title: 'بيع آجل بشحن — ينشئ أوردر', writes: true, creates: 'فاتورة آجلة وأوردر شحن',
      goal: 'فاتورة تُشحن للزبون ويُحصَّل ثمنها لاحقاً — والأوردر يُنشأ معها تلقائياً.',
      after: 'الأوردر صار في صفحة الأوردرات «محضّر» ومقفولاً على هذه الفاتورة، وعمولته صفر (قرارك).',
      steps: addProduct.concat([
        { sel: 'button[onclick^="setSaleType(\'آجل"]', do: 'click', title: 'نوع البيع: آجل (شحن)',
          text: 'الآجل يفتح حقول الشحن والدفعة المقدّمة، ويظهر في تقارير التحصيل عند الإدارة.' },
        { sel: '#partialPaymentAmount', do: 'type', title: 'الدفعة المقدّمة (إن وُجدت)',
          text: 'دفع الزبون جزءاً الآن؟ اكتبه — ويظهر لك المتبقّي عليه. اتركه صفراً إن لم يدفع شيئاً.' },
        { sel: '#order-mode-new', do: 'click', title: 'أوردر جديد أم موجود؟',
          text: '<b>أوردر جديد</b> = يُنشأ الآن من هذه الفاتورة. <b>أوردر موجود</b> = طلبٌ سجّلته سابقاً في الأوردرات — تختاره فتنزل قطعه في السلّة.' },
        { sel: '#order-new-address', do: 'type', title: 'عنوان الشحن', text: 'المحافظة والمنطقة والعنوان التفصيلي — يُطبع على ملصق الشحن.' },
        { sel: '#order-new-company', do: 'pick', title: 'شركة الشحن', text: 'منها تُحسب مدّة الوصول المتوقّعة في صفحة التتبّع.' },
        { sel: '#custName', do: 'type', title: 'اسم الزبون (إلزامي هنا)', until: val, text: 'الآجل لا يُحفظ بلا اسم — هو صاحب الأوردر.' },
        { sel: '#custPhone', do: 'type', title: 'هاتف الزبون', text: 'عليه يصل تبليغ الوصول ورابط التتبّع.' },
        { sel: 'button[onclick*="validateCheckout"]', do: 'click', title: 'التالي — مراجعة الفاتورة', text: 'راجع ثمّ احفظ.' },
        { sel: '#btn-save-invoice', do: 'click', title: 'احفظ', delay: 900,
          text: 'تُحفظ الفاتورة وينشأ الأوردر «محضّراً» ومقفولاً عليها — لا يُربط بفاتورةٍ ثانية.',
          warn: 'في الوضع التدريبي: محاكاة — لا فاتورة ولا أوردر حقيقيّ.' },
        { sel: 'button[onclick="newInvoice()"]', do: 'read', title: 'تمّ ✓',
          text: 'الأوردر الآن في «الأوردرات». حين يُشحن ويُحصَّل يدخل المبلغ صندوق الفرع.' }
      ]) },

    { id: 'refund', icon: '↩️', title: 'مرتجع — إرجاع قطعة من فاتورة', writes: true, creates: 'فاتورة مرتجع',
      goal: 'الزبون أعاد قطعة: نُعيدها للمخزون ونعكس أثرها — دون حذف الفاتورة الأصليّة.',
      after: 'المرتجع لا يحذف شيئاً: الفاتورة الأصليّة تبقى، والمرتجع فاتورةٌ سالبة مربوطةٌ بها.',
      steps: [
        { sel: 'button[onclick="openInvoiceHistory()"]', do: 'click', title: 'افتح «الفواتير»', text: 'كل فواتيرك في هذا الفرع.' },
        { sel: 'button[onclick^="setInvHistFilter"]', do: 'read', title: 'فلترة السجلّ', text: 'الكل · نقدي · آجل · مرتجع — وزرّ ↻ للتحديث.' },
        { sel: '[onclick^="openInvDetailModal"]', do: 'click', title: 'اختر الفاتورة',
          text: 'اضغط الفاتورة التي أعاد الزبون منها قطعاً.', miss: 'السجلّ فارغ — أنشئ فاتورةً بدرس «بيع نقدي» أوّلاً' },
        { sel: 'button[onclick^="startRefundFromHistory"]', do: 'click', title: '↩ مرتجع',
          text: 'من تفاصيل الفاتورة: طباعة · كفالة · مرتجع.' },
        { sel: '#refund-type-full', do: 'read', title: 'كلّي أم جزئي؟',
          text: '<b>كلّي</b> = كل البنود. <b>جزئي</b> = تختار الكمّيات بنداً بنداً — والنظام يمنع إرجاع أكثر ممّا بيع فعلاً.' },
        { sel: '#refund-reason', do: 'type', title: 'سبب الإرجاع', text: 'سطرٌ قصير — يصل الإدارة مع إشعار المرتجع.' },
        { sel: '#btn-confirm-refund', do: 'click', title: 'تأكيد الإرجاع', delay: 900,
          text: 'يُنشئ فاتورةً سالبة مربوطة بالأصل · يُعيد القطع لمخزونك · يعكس عمولتك عليها تلقائياً.',
          warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'expense', icon: '💸', title: 'تسجيل مصروف من الصندوق', writes: true, creates: 'طلب مصروف',
      goal: 'مصروفٌ دفعته من صندوق الفرع — يبقى معلّقاً حتى توافق الإدارة.',
      after: 'لا يُخصم المصروف من الصندوق إلّا بعد موافقة الإدارة — وتراه في «طلباتك المعلّقة».',
      steps: [
        { sel: '#hdr-more-btn', do: 'click', title: 'افتح «المزيد»', text: 'أدوات الفرع كلّها هنا.' },
        { sel: 'button[onclick*="openBranchStats"]', do: 'click', title: 'إحصائيات الفرع', text: 'مبيعات اليوم · العمولات · المصاريف — ومنها تسجيل المصروف وتقفيل اليوم.' },
        { sel: 'button[onclick="openExpenseRequest()"]', do: 'click', title: 'تسجيل مصروف' },
        { sel: '#ex-title', do: 'type', title: 'وصف المصروف', until: val, text: 'مثل: «أجرة شحن طرد» أو «قرطاسية».' },
        { sel: '#ex-amount', do: 'type', title: 'المبلغ', text: 'الرقم فقط.' },
        { sel: '#ex-cur', do: 'pick', title: 'العملة', text: 'بالليرة؟ يظهر حقل سعر الصرف لتكتبه.' },
        { sel: '#ex-kind', do: 'pick', title: 'نوع المصروف', text: '<b>رأسمالي</b> (سيارة · لابتوب · رفوف) لا يدخل في ربح الشهر. الباقي تشغيليّ.' },
        { sel: '#ex-save', do: 'click', title: 'سجّل — بانتظار الموافقة', text: 'يصل الإدارة إشعار، ولا يُخصم من الصندوق حتى توافق.', warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'close-day', icon: '✅', title: 'تقفيل اليوم', writes: true, creates: 'سجلّ تقفيل',
      goal: 'تعدّ الكاش في الدرج فيقارنه النظام بالمتوقّع ويُظهر العجز أو الزيادة.',
      steps: [
        { sel: '#hdr-more-btn', do: 'click', title: 'افتح «المزيد»' },
        { sel: 'button[onclick*="openBranchStats"]', do: 'click', title: 'إحصائيات الفرع' },
        { sel: 'button[onclick="openDailyClose()"]', do: 'click', title: 'تقفيل اليوم' },
        { sel: '#dc-counted', do: 'type', title: 'الكاش المعدود', text: 'عدّ ما في الدرج فعلاً واكتبه.' },
        { sel: '#dc-variance', do: 'read', title: 'الفرق', text: 'عجزٌ أو زيادة — يُحسب لحظياً من مبيعات اليوم ومصاريفه.' },
        { sel: '#dc-note', do: 'type', title: 'ملاحظة', text: 'سبب الفرق إن وُجد.' },
        { sel: '#dc-save', do: 'click', title: 'سجّل التقفيل', warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'incoming', icon: '📥', title: 'استلام نقلٍ وارد لفرعك', writes: true, creates: 'استلام بضاعة',
      goal: 'بضاعةٌ نُقلت لفرعك من فرعٍ آخر: تؤكّد وصولها فتدخل مخزونك.',
      steps: [
        { sel: '#inc-trf-btn', do: 'click', title: '«📥 وارد» في الرأس', miss: 'لا نقل وارد لفرعك الآن — يظهر الزرّ حين يُرسَل لك نقل',
          text: 'يظهر بجانب «الفواتير» حين تُرسَل لفرعك بضاعة، وعليه عددها.' },
        { sel: 'button[onclick^="viewIncomingItems"]', do: 'read', title: 'تفاصيل الفاتورة', text: 'افتحها لترى القطع والكمّيات قبل التأكيد.' },
        { sel: 'button[onclick^="confirmIncomingTransfer"]', do: 'click', title: '✔ تأكيد الاستلام',
          text: 'تُضاف الكمّيات لمخزون فرعك. وإن تعذّر بند، تبقى الفاتورة للانتظار وتُعاد بأمان دون مضاعفة ما استُلم.' }
      ] }
  ]);

  /* ══════════════════════════ الأوردرات ══════════════════════════ */
  GMTLearn.define('orders', [
    { id: 'order-new', icon: '📝', title: 'أوردر جديد — من رسالة الزبون', writes: true, creates: 'أوردر',
      goal: 'تلصق رسالة الزبون فتتعبّأ الحقول وحدها، تراجع، وتحفظ — ١٢ خطوة.',
      after: 'الأوردر الآن في «قيد التجهيز»، ووصل الزبونَ تبليغُ الاستلام تلقائياً.',
      steps: [
        { sel: 'button[onclick*="addModal"]', do: 'click', title: 'إضافة طلب', text: 'نافذة الطلب الجديد.' },
        { sel: '#sp-text', do: 'type', title: 'الصق رسالة الزبون', test: 'محمد أحمد 0999123456 حلب الجميلية كاميرا تجربة 2',
          text: 'انسخ رسالة الزبون كما هي من واتساب والصقها هنا: الاسم والرقم والعنوان والمنتج.' },
        { sel: 'button[onclick="smartFillFromPaste()"]', do: 'click', title: '⬇️ عبّي الحقول تلقائياً', text: 'يقرأ الرسالة ويوزّعها على الحقول — وتراجعها أنت.' },
        { sel: '#in-name', do: 'type', title: 'اسم الزبون', text: 'تأكّد منه. إن كان زبوناً سابقاً تظهر بياناته من رقمه.' },
        { sel: '#in-phone', do: 'type', title: 'رقم الزبون', test: '0999123456', text: '١٠ أرقام تبدأ بـ09 — عليه يصل التبليغ ورابط التتبّع.' },
        { sel: '#in-addr', do: 'type', title: 'العنوان', text: 'المحافظة والمنطقة — منها تُقترح أجرة الشحن ومدّة الوصول.' },
        { sel: '#addModal input[placeholder="اسم المنتج *"]', do: 'type', title: 'المنتج', test: 'كاميرا تجربة 2',
          text: 'اكتب اسمه — يقترح النظام المطابق من الجرد: «✓ هذا» يعتمد المقترح، و«✓ كما كُتب» يُبقي ما كتبته كما هو.' },
        { sel: 'button[onclick="gmtToggleRecog()"]', do: 'read', title: 'التعرّف من الجرد', text: 'لا تريد الاقتراحات؟ أوقفه من هنا — والأسماء تُحفظ كما تكتبها.' },
        { sel: '#in-price', do: 'type', title: 'السعر', test: '150', text: 'سعر القطع. أجرة الشحن تُضاف وحدها تحته فيتحدّث الإجمالي (٣٠٠ ⇐ ٣٠٣).' },
        { sel: '#in-ship-fee', do: 'read', title: 'أجرة الشحن المقترحة', text: 'مقترحةٌ من العنوان والشركة وتُضاف للإجمالي تلقائياً — عدّلها إن اختلفت، و«إعادة الاقتراح» ترجعها.' },
        { sel: '#in-company', do: 'pick', title: 'شركة الشحن', text: 'اختياريّةٌ الآن — يحدّدها من يعتمد الشحن لاحقاً.' },
        { sel: '#saveBtn', do: 'click', title: 'حفظ الطلب', delay: 900, text: 'يُحفظ «قيد التجهيز» ويصل الزبون تبليغ الاستلام.', warn: 'في الوضع التدريبي: محاكاة — لا يُرسل شيء لأحد.' }
      ] },

    { id: 'order-ship', icon: '🚚', title: 'إرسال أوردر للشحن', writes: true, creates: 'تحديث حالة أوردر',
      goal: 'من «قيد التجهيز» إلى «في الطريق»: الشركة ورقم التتبّع — والزبون يصله التبليغ.',
      steps: [
        { sel: '#tab-pending', do: 'click', title: 'تبويب «قيد التجهيز»', text: 'الأوردرات التي لم تُشحن بعد.' },
        { sel: 'button[onclick^="openShipModal"]', do: 'click', title: '📦 إرسال للشحن', miss: 'لا أوردرات قيد التجهيز الآن', text: 'على بطاقة الأوردر.' },
        { sel: '#ship-company', do: 'pick', title: 'شركة الشحن (إلزامي)', text: 'منها تُحسب مدّة الوصول في صفحة التتبّع.' },
        { sel: '#ship-tracking', do: 'type', title: 'رقم التتبّع', test: 'TRK-123', text: 'اختياريّ — إن أعطتك الشركة رقماً.' },
        { sel: 'button[onclick="confirmShipping()"]', do: 'click', title: 'اعتماد الشحن', delay: 900, text: 'يصير الأوردر «في الطريق» ويُرسل للزبون كليشيه الشحن.', warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'order-collect', icon: '💰', title: 'الاستلام ثمّ التحصيل', writes: true, creates: 'تحديث حالة أوردر',
      goal: 'الزبون استلم ⇐ «بانتظار التحصيل» ⇐ وصل المبلغ ⇐ «تمّ التحصيل».',
      steps: [
        { sel: '#tab-shipped', do: 'click', title: 'تبويب «في الطريق»' },
        { sel: 'button[onclick^="requestConfirm"][onclick*="\'delivered\'"]', do: 'click', title: '✅ تأكيد الاستلام', miss: 'لا أوردرات في الطريق الآن', text: 'حين تؤكّد الشركة أنّ الزبون استلم.' },
        { sel: 'button[onclick="executeConfirm()"]', do: 'click', title: 'تأكيد', text: 'ينتقل إلى «بانتظار التحصيل».' },
        { sel: '#tab-delivered', do: 'click', title: 'تبويب «بانتظار التحصيل»' },
        { sel: 'button[onclick^="requestConfirm"][onclick*="\'completed\'"]', do: 'click', title: '💰 تمّ التحصيل', miss: 'لا أوردرات بانتظار التحصيل', text: 'حين يصل المبلغ من شركة الشحن.' },
        { sel: 'button[onclick="executeConfirm()"]', do: 'click', title: 'تأكيد', text: 'يُغلق الأوردر — والمبلغ يدخل صندوق الفرع.', warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'order-linked', icon: '🔗', title: 'أوردر مرتبط بفاتورة: مرتجع أو فكّ', goal: 'الأوردر المقفول على فاتورة لا يُعدَّل مباشرةً — هذه طرقه الثلاث.',
      steps: [
        { sel: '#tab-prepared', do: 'click', title: 'تبويب «محضّرة»', text: 'الأوردرات المربوطة بفاتورة تظهر هنا بإطارٍ أخضر.' },
        { sel: 'button[onclick^="openLinkedActions"]', do: 'click', title: 'رمز الارتباط', miss: 'لا أوردر مرتبط الآن', text: 'على زاوية البطاقة المرتبطة.' },
        { sel: '#gmt-linked-sheet [data-k="none"]', do: 'read', title: '↩︎ مرتجع الفاتورة', text: 'كلّياً أو جزئياً — ولو كان الأوردر قد شُحن. يفتح نقطة البيع على مرتجع تلك الفاتورة.' },
        { sel: '#gmt-linked-sheet [data-k="edit"]', do: 'read', title: '✎ مرتجع + فكّ ⇐ تعديل', text: 'بعد مرتجعٍ كامل يُفكّ الأوردر ويُفتح لتعديل الاسم أو الرقم أو أيّ شيء.' },
        { sel: '#gmt-linked-sheet [data-k="reinvoice"]', do: 'read', title: '🧾 مرتجع + فكّ ⇐ فاتورة جديدة', text: 'الفاتورة القديمة تصير مرتجعاً والأوردر يعود جاهزاً لفاتورةٍ جديدة.' },
        { sel: '#gmt-linked-sheet [data-k="x"]', do: 'click', title: 'إلغاء', text: 'لن نغادر الآن — هذا للتعرّف فقط.' }
      ] }
  ]);

  /* ══════════════════════════ الجرد ══════════════════════════ */
  GMTLearn.define('inventory', [
    { id: 'inv-new', icon: '🆕', title: 'تعريف منتج جديد', writes: true, creates: 'منتج',
      goal: 'الاسم والمجموعة والأسعار والصورة — والكمّيات تدخل لاحقاً من فاتورة الشراء.',
      after: 'المنتج معرَّفٌ بلا كمّيات. أدخل كمّياته من «المشتريات» — كي يبقى لكل قطعةٍ مصدر.',
      steps: [
        { sel: '#add-product-btn', media: '(min-width: 769px)', do: 'click', title: '«منتج جديد»', text: 'في شريط الأدوات أعلى الجرد.' },
        { sel: '#bottom-nav [onclick="openProductModal()"]', media: '(max-width: 768px)', do: 'click', title: '«إضافة»', text: 'الزرّ الأحمر في وسط الشريط السفلي.' },
        { sel: '#f-name', do: 'type', title: 'اسم المنتج', until: val, test: 'كاميرا درس', text: 'الاسم الكامل كما يُطبع على الفاتورة — مثل «Canon EOS 80D».' },
        { sel: '#f-group-name', do: 'type', title: 'المجموعة', test: 'كاميرات', text: 'المنتج في مجموعةٍ واحدة. اكتب أوّل حرفين — تظهر المجموعات الموجودة لتختار.' },
        { sel: '#f-category', do: 'type', title: 'التصنيف والماركة', test: 'تصوير', text: 'التصنيف يجمع عدّة مجموعات (تصوير · صوت…) والماركة للبحث والتقارير.' },
        { sel: '#f-alt-names', do: 'read', title: 'أسماء بديلة', text: 'كيف يسمّيه الزبائن؟ «نفتي فيفتي» لعدسة 50mm مثلاً — فيتعرّف عليها البحث ولصق الأوردرات.' },
        { sel: '#f-price', do: 'type', title: 'سعر المستهلك', test: '250', text: 'بالدولار.' },
        { sel: '#f-wholesale-price', do: 'type', title: 'سعر الجملة', test: '220', text: 'منه تُحسب عمولة الكاشير: البيع فوق الجملة = عمولة.' },
        { sel: '#pm2-margins', do: 'read', title: 'الهامش أمامك', text: 'حين تكون التكلفة معروفة يظهر ربح المستهلك والجملة عليها — وإنذارٌ إن كانت الجملة أعلى من المستهلك.' },
        { sel: '#img-upload-area', do: 'read', title: 'الصورة', text: 'اضغط لرفع صورة من جهازك، أو الصق رابطها تحتها.' },
        { sel: '#f-barcode', do: 'read', title: 'الباركود', text: 'يُولَّد وحده — أو اكتب باركود العلبة إن وُجد. «توليد» لرقمٍ جديد.' },
        { sel: '#dynamic-form-fields', do: 'read', title: 'الكمّيات مقفولة هنا عمداً', text: 'الكمّية تدخل من <b>فاتورة الشراء</b> فقط (أو الشراء السريع) — لا مخزون بلا مصدر.' },
        { sel: '#product-modal button[onclick="saveProduct()"]', do: 'click', title: 'حفظ المنتج', delay: 900, warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'inv-price', icon: '💲', title: 'تعديل سعر منتج', writes: true, creates: 'تعديل سعر',
      goal: 'تجد المنتج، تعدّل سعره، وترى الهامش قبل الحفظ.',
      after: 'للتخفيض المؤقّت لمدّة (عرض) استعمل «جماعي ⇠ الأسعار ⇠ ⏳ تخفيضٌ مؤقّت» — يعود السعر وحده.',
      steps: [
        { sel: '#search-input', do: 'type', title: 'ابحث عن المنتج', test: 'كاميرا تجربة 3', text: 'بالاسم أو الباركود.' },
        { sel: 'button[onclick*="invGuardedEdit"]', media: '(min-width: 769px)', do: 'click', title: 'تعديل', miss: 'لم يظهر المنتج — غيّر البحث', text: 'زرّ التعديل في صفّ المنتج (للأدمن).' },
        /* (٨ ت) على الهاتف صار الجرد «قائمة» بلا أزرار في الصفّ: المنتج ⇠ التفاصيل ⇠ «تعديل» */
        { sel: '#list-grid .sl-row', media: '(max-width: 768px)', do: 'click', title: 'افتح المنتج', miss: 'لم يظهر المنتج — غيّر البحث', text: 'اضغط على المنتج فتنفتح تفاصيله.' },
        { sel: '#detail-edit-btn', media: '(max-width: 768px)', do: 'click', title: 'تعديل', text: 'زرّ «تعديل» في التفاصيل (للأدمن).' },
        { sel: '#f-price', do: 'type', title: 'السعر الجديد', test: '199', text: 'سعر المستهلك بالدولار.' },
        { sel: '#pm2-margins', do: 'read', title: 'راجع الهامش', text: 'قبل الحفظ: هل ما زال الربح على التكلفة معقولاً؟' },
        { sel: '#product-modal button[onclick="saveProduct()"]', do: 'click', title: 'حفظ', delay: 900, text: 'إن كان المنتج مربوطاً بالمتجر يتحدّث سعره هناك تلقائياً.', warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'inv-transfer', icon: '🔁', title: 'فاتورة نقل بين فرعين', writes: true, creates: 'فاتورة نقل',
      goal: 'تنقل قطعاً من فرعٍ لآخر: تُخصم من المصدر فوراً وتصير «في الطريق» حتى يستلمها الفرع.',
      after: 'الفاتورة «في الطريق». حين يستلمها الفرع تدخل مخزونه — وتُؤكَّد وحدها بعد ٤ أيام إن نُسيت (SQL ٢٣).',
      steps: [
        { sel: '#mode-btn-transfer', media: '(min-width: 769px)', do: 'click', title: 'قسم «النقل»', text: 'في شريط الأقسام أعلى الجرد.' },
        { sel: '#bottom-nav [onclick="openMoreSheet()"]', media: '(max-width: 768px)', do: 'click', title: '«المزيد»', text: 'في الشريط السفلي.' },
        { sel: '#more-transfer-btn', media: '(max-width: 768px)', do: 'click', title: '«النقل بين الفروع»' },
        { sel: '#new-transfer-invoice-btn', do: 'click', title: '+ فاتورة نقل جديدة' },
        { sel: '#st-creator-name', do: 'type', title: 'اسمك', test: 'فاحص النظام', text: 'يُطبع على الفاتورة كمُرسِل.' },
        { sel: '#st-from-select', do: 'pick', title: 'من فرع', test: 'haleb', text: 'المصدر — منه تُخصم القطع.' },
        { sel: '#st-to-select', do: 'pick', title: 'إلى فرع', test: 'daraa', text: 'الوجهة — تصلها «في الطريق» حتى تستلم.' },
        { sel: '#st-search', do: 'type', title: 'ابحث عن القطعة', test: 'كاميرا', text: 'أو «من المجموعات» لتحدّد عدّة قطعٍ دفعةً واحدة.' },
        { sel: '#st-search-results [onclick^="stAddProduct"]', do: 'click', title: 'أضِفها للفاتورة', miss: 'لا نتائج — غيّر البحث' },
        { sel: '#st-selected-list input[oninput*="\'qty\'"]', do: 'type', title: 'الكمّية', test: '2', text: 'الافتراضيّ قطعة. وإن طلبت أكثر من مخزون المصدر يسألك: أرفعه وأكمل؟' },
        { sel: 'button[onclick="saveStockTransfer()"]', do: 'click', title: 'حفظ وإرسال', delay: 1200, text: 'يُخصم من المصدر ويُرسل للفرع إشعار.', warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    { id: 'inv-receive', icon: '📥', title: 'استلام فاتورة نقل', goal: 'الفرع وصلته البضاعة: اسم المستلم وصورة التوقيع ⇐ تدخل مخزونه.',
      steps: [
        { sel: '#mode-btn-transfer', media: '(min-width: 769px)', do: 'click', title: 'قسم «النقل»' },
        { sel: '#bottom-nav [onclick="openMoreSheet()"]', media: '(max-width: 768px)', do: 'click', title: '«المزيد»', text: 'في الشريط السفلي.' },
        { sel: '#more-transfer-btn', media: '(max-width: 768px)', do: 'click', title: '«النقل بين الفروع»' },
        { sel: '#st-subtab-pending', do: 'click', title: '«في الطريق»', text: 'الفواتير التي لم تُستلم بعد.' },
        { sel: '[onclick^="openStockTransferDetail"]', do: 'click', title: 'افتح الفاتورة', miss: 'لا فواتير في الطريق الآن' },
        { sel: '#st-received-by', do: 'type', title: 'اسم المستلم', test: 'مستلم الفرع', text: 'من استلم القطع فعلاً.' },
        { sel: 'button[onclick^="stOpenCamera"]', do: 'read', title: 'صورة التوقيع', text: 'صوّر توقيع المستلم أو ارفع صورته — فيتمّ الاستلام وتدخل الكمّيات مخزون الفرع.' },
        { sel: 'button[onclick^="stAdminConfirm"]', do: 'read', title: 'بلا صورة؟', text: 'تأكيدٌ إداريّ بكلمة السرّ مع السبب — يُسجَّل باسمك. وإن تعذّر بند تبقى الفاتورة وتُعاد بأمان دون مضاعفة.' }
      ] },

    { id: 'inv-missing', icon: '🔎', title: 'تقرير النقص', goal: 'المنتجات بلا صورة أو باركود أو سعر أو مجموعة — وتصلحها من مكانها.',
      steps: [
        { sel: 'button[onclick="openMissingReport()"]', media: '(min-width: 769px)', do: 'click', title: '🔎 النقص', text: 'في شريط الجرد.' },
        { sel: '#bottom-nav [onclick="openMoreSheet()"]', media: '(max-width: 768px)', do: 'click', title: '«المزيد»', text: 'في الشريط السفلي.' },
        { sel: '#more-sheet [onclick*="openMissingReport"]', media: '(max-width: 768px)', do: 'click', title: '🔎 النقص' },
        { sel: '#gmt-missing > div', do: 'read', title: 'ما ينقص كل منتج', text: 'لكل منتج ما ينقصه — وصورةٌ ترفعها مباشرةً من هنا دون فتح نافذته.' }
      ] }
  ]);

  /* ══════════════════════════ أدمن نقاط البيع ══════════════════════════ */
  GMTLearn.define('admin_pos', [
    { id: 'adm-commission', icon: '✅', title: 'مراجعة العمولات والموافقة', writes: true, creates: 'اعتماد عمولة',
      goal: 'الفواتير التي عمولتها لم تُعتمد تظهر أوّل الصفحة — موافقةٌ بضغطة، أو تعديلٌ من الفاتورة.',
      after: 'الموافقة ذرّيّة: ضغطتان أو جهازان لا يعتمدان العمولة مرّتين.',
      steps: [
        { sel: 'button[onclick="switchTab(\'overview\')"]', do: 'click', title: '«نظرة عامة»', text: 'أوّل ما فيها: «بانتظار مراجعتك» — الأقدم أوّلاً.' },
        { sel: 'button[onclick^="quickApproveCommission"]', do: 'click', title: '✓ موافقة بضغطة', delay: 900, miss: 'لا فواتير بانتظار مراجعتك الآن',
          text: 'فوق كل فاتورة عمولتها المحسوبة. «✓ موافقة» تعتمدها كما هي.', warn: 'في الوضع التدريبي: محاكاة.' },
        { sel: '[onclick^="openInvoiceDetail"]', do: 'read', title: 'تعديل أو تصفير؟', text: 'افتح الفاتورة نفسها لتغيّر مبلغ العمولة أو تصفّرها مع السبب — لا تُحذف عمولةٌ أبداً، تُصفَّر فقط.' }
      ] },

    { id: 'adm-expense', icon: '🧾', title: 'الموافقة على مصروف', writes: true, creates: 'اعتماد مصروف',
      goal: 'مصروفٌ سجّله فرع: توافق فيُخصم من صندوقه مرّةً واحدة.',
      steps: [
        { sel: 'button[onclick="switchTab(\'expenses\')"]', do: 'click', title: '«المصاريف»', text: 'أو البطاقة الصفراء «مصاريف بانتظار موافقتك» في النظرة العامة.' },
        { sel: 'button[onclick^="approveExpense"]', do: 'click', title: '✓ موافقة', delay: 900, miss: 'لا مصاريف بانتظار موافقتك',
          text: 'تختار: «من صندوق الفرع» فيُخصم، أو «أنا دفعته» فلا يُمسّ الصندوق. وسعر الصرف تقرّره أنت. الرأسماليّ (سيارة · لابتوب) لا يدخل في ربح الشهر.', warn: 'في الوضع التدريبي: محاكاة.' }
      ] },

    /* (٨ ث — تدقيق المطابقة) «تدريب الأدمن: ثلاثة دروس فقط» — أُضيفت دروس ما بُني في هذه الدفعة */
    { id: 'adm-expense-month', icon: '🗓', title: 'مراجعة المصاريف آخر الشهر', writes: true, creates: 'اعتماد مصاريف',
      goal: 'كل المعلّقة دفعةً واحدة، والمعتمدة مجمّعةٌ شهراً شهراً بمجموع كل شهر.',
      steps: [
        { sel: 'button[onclick="switchTab(\'expenses\')"]', do: 'click', title: '«المصاريف»' },
        { sel: 'button[onclick^="approveAllPendingExpenses"]', do: 'read', title: '✓ موافقة على الكل', miss: 'أقلّ من مصروفين بانتظارك — فلا زرّ للدفعة',
          text: 'تختار مصدر الدفع مرّةً واحدة، وكل مصروفٍ يُخصم بسعر صرفه المسجّل.' },
        { sel: '#app-content details summary', do: 'read', title: 'الشهور', miss: 'لا مصاريف معتمدة بعد', text: 'كل شهرٍ بعدد مصاريفه ومجموعها بالدولار — اضغطه ليتفتّح.' }
      ] },

    { id: 'adm-customers', icon: '👥', title: 'تصنيف العملاء وملاحظاتهم', writes: true, creates: 'تصنيف عميل',
      goal: 'جملة أو مفرق لكل عميل، وملاحظةٌ لا تظهر له — وفلترٌ بالتصنيف.',
      steps: [
        { sel: 'button[onclick="switchTab(\'customers\')"]', do: 'click', title: '«العملاء»' },
        { sel: '#cust-type-flt', do: 'read', title: 'الفلتر', text: 'الكل · جملة · مفرق · غير مصنّف.' },
        { sel: 'button[onclick^="setCustomerType"]', do: 'read', title: 'صنّف', miss: 'لا عملاء بعد', text: 'على بطاقة العميل: «جملة/مفرق». (يحتاج ملف SQL رقم 33.)' },
        { sel: 'button[onclick^="editCustomerNote"]', do: 'read', title: '📝 ملاحظة', miss: 'لا عملاء بعد', text: 'ملاحظتك عنه — تُبحث أيضاً من خانة البحث.' }
      ] },

    { id: 'adm-invoice-order', icon: '🔗', title: 'فاتورة من الإدارة لأوردر', writes: true, creates: 'فاتورة',
      goal: 'تفوتر أوردراً من هنا فتُربط به من الطرفين، بلا عمولة (قرار ت٩)، وتُخصم من مخزون الفرع.',
      steps: [
        { sel: 'button[onclick="switchTab(\'adminInvoice\')"]', do: 'click', title: '«فاتورة جديدة»' },
        { sel: '#ai-branch', do: 'pick', title: 'الفرع', text: 'من مخزونه تُخصم القطع.' },
        { sel: '#ai-order-q', do: 'read', title: '📦 من أوردر', text: 'رقم الأوردر أو اسم الزبون — فتنتقل قطعه وبياناته، ويظهر «مرتبطة بالأوردر #…» ومعه «فكّ الربط».' }
      ] },

    { id: 'adm-statement', icon: '📊', title: 'كشف الحساب الشهري', goal: 'كل حركات فرعٍ في شهر: مبيعات · عمولات · مصاريف · ترحيلات — للطباعة.',
      steps: [
        { sel: 'button[onclick="switchTab(\'accounting\')"]', do: 'click', title: '«المحاسبة»' },
        { sel: '#acc-month-select', do: 'pick', title: 'الشهر', text: 'كل أرقام الصفحة تتبع الشهر المختار.' },
        { sel: 'button[onclick^="openStatement"]', do: 'click', title: 'كشف الحساب', text: 'كشفٌ شهريّ مفصّل لكل فرع.' },
        { sel: '#st-br', do: 'pick', title: 'الفرع', text: 'اختر الفرع — أو الكلّ.' },
        { sel: '#gmt-stmt', do: 'read', title: 'اقرأ واطبع', text: 'الحركات بترتيبها مع الرصيد بعد كل حركة. اطبعه أو احفظه PDF من زرّ الطباعة فيه.' }
      ] }
  ]);

  /* ══════════════════════════ المشتريات ══════════════════════════ */
  GMTLearn.define('purchase', [
    { id: 'pur-instant', icon: '⚡', title: 'شراء فوري ينزل على نقطة بيع', writes: true, creates: 'فاتورة شراء',
      goal: 'بضاعةٌ اشتريتها محلياً: المورد · القطع وأسعارها · نقطة البيع ⇐ تنزل كمّياتها فوراً ويتحدّث سعر الشراء.',
      after: 'هذا هو الطريق الوحيد لدخول كمّياتٍ للجرد — فيبقى لكل قطعةٍ مصدرٌ وفاتورة.',
      steps: [
        { sel: 'button[onclick="showTypeChooser()"]', do: 'click', title: 'فاتورة شراء جديدة' },
        { sel: 'button[onclick="openInstantMode()"]', do: 'click', title: '⚡ مشتريات فوريّة', text: 'تنزل الكمّيات على نقطة البيع فوراً. (الاستيراد مع الشحن والتخليص له قسمه.)' },
        { sel: '#ins-supplier', do: 'type', title: 'المورد', test: 'مورد تجربة', until: val, text: 'اسم المورد — يُحفظ للفواتير القادمة.' },
        { sel: '#ins-currency', do: 'pick', title: 'العملة', text: 'تُحوَّل الأسعار للدولار في الجرد بسعر الصرف.' },
        { sel: '#ins-branch', do: 'pick', title: 'نقطة البيع', test: 'haleb', text: 'إليها تنزل الكمّيات.' },
        { sel: '#ins-prod-search', do: 'type', title: 'ابحث عن القطعة', test: 'كاميرا', text: 'بالاسم أو الباركود. غير موجودة؟ «تعريف منتج جديد» يظهر في آخر القائمة.' },
        { sel: '#ins-ac-list .ac-item', do: 'click', title: 'أضِفها', miss: 'لا نتائج — غيّر البحث أو عرّف منتجاً جديداً' },
        { sel: '#ins-cart-tbody input[oninput^="insUpdQ"]', do: 'type', title: 'الكمّية', test: '3' },
        { sel: '#ins-cart-tbody input[oninput*="\'unitPrice\'"]', do: 'type', title: 'سعر الشراء للقطعة', test: '70', text: 'منه تُحسب تكلفة المنتج في الجرد (ولا تُعدَّل التكلفة إلّا من هنا).' },
        { sel: '#ins-expenses', do: 'read', title: 'مصاريف إضافيّة', text: 'نقلٌ أو تحميل؟ اكتبها ثم «توزيع على سعر الشراء» تُقسَّم على القطع.' },
        { sel: '#ins-cash-payment', do: 'read', title: 'المدفوع للمورد', text: 'ما دفعته الآن — والباقي يظهر ديناً عليه في «الديون».' },
        { sel: '#ins-saveBtn', do: 'click', title: 'تأكيد وإنزال فوري', delay: 1200, text: 'تُحفظ الفاتورة وتنزل الكمّيات لنقطة البيع ويتحدّث سعر الشراء.', warn: 'في الوضع التدريبي: محاكاة.' }
      ] }
  ]);
})();
