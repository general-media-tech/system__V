/* ═══════════════════════════════════════════════════════════════════════════
   gmt-tools.js — سجلُّ الأدوات: مصدرٌ واحدٌ لكلّ أداةٍ في النظام
   أُنشئ: 2026-10-04 (ي)

   ══ لماذا وُلد هذا الملفّ ══
   شكواك: «الواجهة الرئيسية من أجهزة تفتح فيها أدوات ناقصة، ومن واجهات أخرى
   بتفتح فيها كل الأدوات… وفي أدوات مو موجودة أو ما بتفتح أو عم تفتح ملف
   برمجي».

   السببُ الجذريّ لم يكن عطلاً في جهاز، بل **بوّابتان منفصلتان**:
     • index.html — يفتحها المتصفّح: ١٩ بطاقةً مكتوبةً باليد، تنقصها
       كلمات السر والتوظيف وسجل المبيعات والملصقات وغيرها.
     • home.html  — يفتحها التطبيق المثبَّت (start_url في manifest.json):
       قائمةٌ أخرى فيها ملفّات SQL وبايثون وMarkdown ⇒ «تفتح ملف برمجي».
   فمن يفتح من المتصفّح يرى نظاماً، ومن يفتح من التطبيق يرى نظاماً آخر.

   الحلّ: قائمةٌ واحدةٌ هنا، والبوّابتان تقرآن منها. لا أداةَ تُكتب في
   مكانين، ولا ملفَّ برمجيّاً يُعرض كأداة.

   ══ حقول كلّ أداة ══
     f   الصفحة                    t  الاسم كما يراه المستخدم
     d   ماذا تفعل (سطرٌ واحد)     ic أيقونة من gmt-icons.js
     g   المجموعة الوظيفيّة         a  من يراها:
                                       'public' ⇐ الكلّ (صفحاتُ الزبون)
                                       'staff'  ⇐ الموظّف والأدمن
                                       'admin'  ⇐ الأدمن وحده
     k   كلماتٌ للبحث               ds وصفٌ بديلٌ يراه الموظّف (اختياريّ)
     n   اسمٌ قصيرٌ للشريط السفليّ على الهاتف (اختياريّ)
     p   (١١ ت١) أداةٌ فرعيّة: صفحةُ الأب التي تُفتح منها — لا تظهر على الرئيسيّة ولا في البحث، وتبقى صفحتُها محميّةً
         كما هي (الحارس يقرأ السجلّ كلّه). «الفحوصات متباعدة جداً… أداة واحدة» (Notes ٩ ت١ ٦:٣٦ ص).

   ⚠️ الإخفاءُ هنا ليس حماية: كلُّ صفحةٍ إداريّة تحرس نفسها. هذا الملفّ
      يقرّر ما **يُعرض** فقط، كي لا يرى الموظّفُ زرّاً لا يعمل له.
   ⚠️ أيُّ صفحةٍ جديدة تُضاف هنا — وفحصُ «سجل الأدوات» يفشل إن وُجدت صفحةٌ
      منشورةٌ ليست في السجلّ، أو أداةٌ في السجلّ لا صفحةَ لها.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTTools) return;

  /* المجموعاتُ مرتّبةٌ بالوظيفة لا بتاريخ البناء — قاعدةُ وثيقتك:
     «كل شيء يجب أن يكون في المكان الذي يتوقّع المستخدم أن يجده فيه». */
  var GROUPS = [
    { id: 'sell',   t: 'البيع اليومي',        d: 'الفواتير والطلبات والكفالات والملصقات', ic: 'receipt' },
    { id: 'stock',  t: 'المخزون والمنتجات',    d: 'الجرد والشراء والربط بالمتجر',          ic: 'box' },
    { id: 'money',  t: 'المال والتقارير',      d: 'الموافقات والصندوق والأرباح',           ic: 'coins' },
    { id: 'online', t: 'المتجر والموقع',       d: 'إدارة ما يراه الزبون',                  ic: 'store' },
    { id: 'team',   t: 'الفريق والأمان',       d: 'المستخدمون وكلمات السر والنسخ',          ic: 'users' },
    { id: 'brain',  t: 'عقل النظام والفحص',    d: 'التشخيص والبوتات والتجريب',             ic: 'brain' },
    { id: 'know',   t: 'المعرفة والخطط',       d: 'الأدلّة والتوثيق وما الجديد',            ic: 'book' },
    { id: 'public', t: 'واجهات الزبون',        d: 'صفحاتٌ عامّة يفتحها أيّ زبون',          ic: 'globe' }
  ];

  var TOOLS = [
    /* ── البيع اليومي ── */
    { f: 'pos.html', n: 'نقطة', t: 'نقطة البيع', d: 'فاتورة جديدة بالمنتجات والصور', ic: 'monitor', g: 'sell', a: 'staff',
      k: 'كاشير فاتورة بيع صندوق مبيع pos' },
    { f: 'orders.html', n: 'الأوردرات', t: 'الأوردرات', d: 'طلبات الشحن والتبليغ والتحصيل', ic: 'clipboard', g: 'sell', a: 'staff',
      k: 'اوردر طلبات شحن توصيل تحصيل تبليغ واتساب' },
    { f: 'guarantee.html', t: 'إنشاء كفالة', d: 'شهادة كفالة Canon للزبون', ic: 'shield', g: 'sell', a: 'staff',
      k: 'كفالة ضمان شهادة كانون warranty' },
    { f: 'ردود_سريعة.html', t: 'ردود سريعة', d: 'ابحث عن المنتج ⇐ ردٌّ جاهز ⇐ واتساب بزنس أو إنستغرام', ic: 'copy', g: 'sell', a: 'staff',
      k: 'ردود رد سريع واتساب انستغرام كليشة بوست كيبورد فقاعة زبون رسالة' },
    /* (TASK-0131) ماسحٌ متعدّد الصفحات: حدودٌ بأربع نقاط أو أكثر · رسم الحدود باليد · PDF · نصٌّ مستخرج — كلّه على الجهاز */
    { f: 'scanner.html', t: 'الماسح الضوئي', d: 'صوّر مستنداً ⇐ قصّ وتصحيح ⇐ PDF أو صور أو نصّ', ic: 'scan', g: 'sell', a: 'staff',
      k: 'ماسح مسح ضوئي سكانر scanner camscanner pdf مستند وثيقة ورقة تصوير ocr نص استخراج' },
    { f: 'labels.html', t: 'طابعة الملصقات', d: 'باركود · أسعار · ملصق الكفالة', ic: 'barcode', g: 'sell', a: 'staff',
      k: 'ملصق ملصقات باركود طباعة سعر label' },
    { f: 'أماكن_الوصول.html', t: 'أماكن الوصول', d: 'مكاتب شركات الشحن وأرقامها', ic: 'pin', g: 'sell', a: 'staff',
      k: 'مكاتب شحن الرافدين المفتي عناوين استلام فروع' },
    { f: 'deal.html', t: 'العقود', d: 'عقود البيع والتوظيف والعهدة والتسليم', ic: 'pen', g: 'sell', a: 'admin',
      k: 'عقد عقود توظيف عهدة تسليم تدريب nda' },

    /* ── المخزون والمنتجات ── */
    { f: 'inventory.html?mode=products', t: 'إدارة المنتجات', d: 'الأسماء · الأسعار · الصور · المواصفات · العروض', ic: 'tag', g: 'stock', a: 'staff',
      k: 'إدارة منتجات منتج اسم سعر صورة مواصفات products' },
    { f: 'inventory.html', n: 'الجرد', t: 'الجرد والمخزون', d: 'المخزون حسب الفرع والمجموعة', ds: 'معاينة المنتجات والكمّيات — الإجراءات للإدارة',
      ic: 'box', g: 'stock', a: 'staff', k: 'جرد مخزون منتجات مجموعات تصنيف كميات inventory' },
    { f: 'المنتجات.html', t: 'المنتجات', d: 'بحث ومسح باركود · تفاصيل · توفّر بالفروع · كتالوج', ic: 'box', g: 'stock', a: 'staff',
      k: 'منتجات كتالوج باركود بحث مواصفات توفر منتج' },
    { f: 'purchase.html', t: 'المشتريات', d: 'فواتير الشراء والشحنات القادمة', ic: 'factory', g: 'stock', a: 'admin',
      k: 'شراء مشتريات استيراد مورد المانيا الصين purchase' },
    { f: 'أداة_التسويات.html', t: 'أداة التسويات', d: 'كل ما يحتاج تسوية: نقل · شراء · مخزون · أوردرات · مصاريف — مع الشرح والتصرّف الصحيح', ic: 'scale', g: 'money', a: 'admin',
      k: 'تسوية تسويات نقل ناقص مختوم مضاعفة تدقيق فاتورة تعذر خصم فروقات' },
    { f: 'مراجعة_الأسعار_والمشتريات.html', t: 'مراجعة الأسعار والمشتريات', d: 'المتجر مقابل الجرد · بلا مبيع/كلفة · بخسارة — ووين راح المشترى: اشتُري · بِيع · موجود بكلّ فرع · الفرق (seq B1040)', ic: 'scale', g: 'money', a: 'admin' },
    { f: 'سجل_الأجهزة.html', t: 'سجلّ الأجهزة', d: 'ابحث عن أيّ جهاز بـ IMEI أو الرقم التسلسلي: لمن بِيع · بأيّ فاتورة · كفالته · تاريخه (seq B1038)', ic: 'search', g: 'stock', a: 'admin', k: 'imei سيريال رقم تسلسلي جهاز كفالة بحث هاتف كاميرا' },
    /* (TASK-B0551 · seq B1082 «فكّر بالشغل») الاستلام وحده — بلا قائمة المشتريات وأسعارها: تُمنح للموظّف من «الأمان والمستخدمون ⇠ الصلاحيات» */
    { f: 'purchase.html?tab=recv', t: 'استلام البضاعة (بالمسح)', d: 'استلام فواتير الشراء الواصلة بالمسح فقط — بلا قائمة المشتريات ولا أسعارها', ic: 'boxes', g: 'stock', a: 'admin', p: 'purchase.html',
      k: 'استلام بضاعة واصلة مسح مستودع موظف صلاحية الاستلام' },
    /* (TASK-B0551 · A0587 · المالك A1026) جهاز المستودع: استلام بالمسح · جرد · نقل · ملصقات — للموظّف بالمستودع */
    { f: 'مستودع.html', t: 'جهاز المستودع', d: 'استلام البضاعة بالمسح · الجرد · النقل · الملصقات — من الموبايل أو جهاز السكانر', ic: 'boxes', g: 'stock', a: 'staff',
      k: 'مستودع جهاز المستودع استلام بضاعة واصلة مسح سكانر جرد نقل ملصقات باركود warehouse' },
    { f: 'طلبات_غير_متوفرة.html', t: 'ما يطلبه الزبائن ولا نملكه', d: 'الأصناف التي طُلبت ولم نجدها أو نفدت — الأكثر طلباً أولاً لنتسوّقها', ic: 'tag', g: 'stock', a: 'admin',
      k: 'طلبات غير متوفرة مفقود الزبون يطلب لا نملك نفد طلب كثير نسوق تسوق ناقص' },
    { f: 'ما_يجب_شراؤه.html', t: 'ما يجب أن نشتريه', d: 'منتجات مخزونها قليل بصورها وأصلها، وملف طلب عرض سعر للمورّد', ic: 'cart', g: 'stock', a: 'admin',
      k: 'شراء اشتري نقص مخزون قليل قائمة شراء عرض سعر مورد طلب الصين المانيا سوريا اكسل rfq' },
    { f: 'bridge.html', t: 'الجسر', d: 'ربط منتجات الجرد بالمتجر ومزامنة الأسعار', ic: 'link', g: 'stock', a: 'admin',
      k: 'جسر ربط متجر مزامنة اسعار bridge' },
    { f: 'دليل_التوافقيات_والمواصفات.html', t: 'دليل التوافقيات', d: 'الهودات والأغطية والبطاريات المتوافقة', ic: 'layers', g: 'stock', a: 'staff',
      k: 'توافق متوافق هود غطاء بطارية مواصفات' },

    /* ── المال والتقارير ── */
    /* (٨ ت — تدقيق المطابقة) «أداة العملاء» كانت تبويباً داخل أدمن النقاط بلا مدخلٍ من الرئيسيّة */
    { f: 'admin_pos.html?tab=customers', t: 'العملاء', d: 'سجلّ الزبائن الواحد · الرصيد والدين · الحظر', ic: 'users', g: 'money', a: 'admin',
      k: 'عملاء زبائن زبون عميل سجل رصيد دين حظر customers' },
    /* (المالك seq 210) أدواتٌ منفصلة لا تبويبات في أدمن نقاط البيع */
    { f: 'admin_pos.html?tab=offers', t: 'العروض', d: 'الباقات والعروض على المنتجات', ic: 'tag', g: 'money', a: 'admin', k: 'عروض عرض باقة باقات offers' },
    { f: 'admin_pos.html?tab=coupons', t: 'الكوبونات', d: 'كوبونات الخصم وحالتها', ic: 'tag', g: 'money', a: 'admin', k: 'كوبون كوبونات خصم coupons' },
    { f: 'admin_pos.html?tab=users', t: 'الموظفون', d: 'حسابات الموظفين وصلاحياتهم وفروعهم', ic: 'user', g: 'money', a: 'admin', k: 'موظفين موظف مستخدمين حسابات صلاحيات users' },
    { f: 'admin_pos.html?tab=assets', t: 'الأصول الثابتة', d: 'سجلّ أصول الشركة وقيمتها', ic: 'building', g: 'money', a: 'admin', k: 'اصول ثابتة اصل اثاث معدات assets' },
    { f: 'admin_pos.html', n: 'أدمن', t: 'أدمن نقاط البيع', d: 'الموافقات · الصندوق · العمولات · المحاسبة', ic: 'shield', g: 'money', a: 'admin',
      k: 'ادمن نقاط بيع موافقة عمولة صندوق تسوية ديون مصاريف محاسبة نقل' },
    /* (TASK-B0509 · المالك seq 825) «الادوات يلي طالعتهن من ادمن نقاط البيع … جمعهن بصفحة وحدة المتشابهات» —
       صفحةٌ واحدة بأربع مجموعات (الناس · البيع والتسعير · المال · المخزون والأصول). الأدوات أدناه باقيةٌ كما هي (بحثٌ ورابطٌ مباشر)،
       لكنّ «كل صفحات النظام» في الرئيسية تعرضها مجمّعةً هنا بدل ١٢ سطراً متشابهاً. */
    { f: 'الإدارة.html', n: 'الإدارة', t: 'الإدارة', d: 'الموظفون والعملاء · الفواتير والعروض والكوبونات · الصندوق والديون والمصاريف والمحاسبة · نقل المخزون والأصول', ic: 'grid', g: 'money', a: 'admin',
      k: 'ادارة الادارة موظفين عملاء فواتير عروض كوبونات صندوق ديون مصاريف محاسبة تقفيل نقل مخزون اصول' },
    /* (١١ ت١ ٢٠٢٦ — ملاحظات ١٠ ت١ ٩:٢١) «افرط الأدمن السيادي وأدمن نقاط البيع إلى أدوات خارجية خاصّة منفصلة في الواجهة الرئيسية».
       كل تبويبٍ في أدمن النقاط صار أداةً بمدخلها على الرئيسية، تفتح الصفحةَ نفسها على تبويبها (?tab=…) — لا نسخةٌ ثانية من الكود
       ولا منطقٌ مكرّر. الأدمن الكلّي نفسه كانت أدواتُه مفصولةً أصلاً (الجرد · الربط · المتجر · الموقع · الكفالات · العقود · النسخ).
       الحراسةُ تبقى على الصفحة (admin_pos.html) فلا تُمنح هذه المداخل كصلاحيّاتٍ منفردة. */
    { f: 'admin_pos.html?tab=invoices', t: 'مراجعة الفواتير', d: 'فواتير الفروع بانتظارك: الموافقة والعمولة والاعتماد', ic: 'receipt', g: 'money', a: 'admin',
      k: 'مراجعة فواتير موافقة اعتماد عمولة فواتير الفروع' },
    { f: 'admin_pos.html?tab=transfers', t: 'الصندوق والتسويات', d: 'صندوق كل فرع · التحصيل والنقل المالي للإدارة', ic: 'coins', g: 'money', a: 'admin',
      k: 'صندوق تسويات تحصيل نقل مالي فرع' },
    { f: 'admin_pos.html?tab=stocktransfers', t: 'نقل المخزون بين الفروع', d: 'فواتير النقل الداخلي · التأكيد والتسوية', ic: 'truck', g: 'money', a: 'admin',
      k: 'نقل مخزون فواتير نقل داخلي تحويل بين الفروع تسوية استلام' },
    { f: 'admin_pos.html?tab=closings', t: 'سجل التقفيلات', d: 'التقفيل اليومي · العجز والزيادة', ic: 'lock', g: 'money', a: 'admin',
      k: 'تقفيل تقفيلات عجز زيادة يومي صندوق' },
    { f: 'admin_pos.html?tab=debts', t: 'الديون', d: 'الذمم الآجلة والدفعات الجزئية', ic: 'wallet', g: 'money', a: 'admin',
      k: 'ديون دين آجل ذمم دفعات جزئية' },
    { f: 'admin_pos.html?tab=expenses', t: 'المصاريف', d: 'مصاريف الفروع والإدارة · المراجعة آخر الشهر', ic: 'receipt', g: 'money', a: 'admin',
      k: 'مصاريف مصروف عام فرع موافقة سعر صرف' },
    { f: 'admin_pos.html?tab=accounting', t: 'المحاسبة وكشف الحساب', d: 'ملخّص الأرباح · كشف حساب الفرع الشهري', ic: 'chart', g: 'money', a: 'admin',
      k: 'محاسبة كشف حساب ارباح شهري عمولات' },
    /* (TASK-0368 · المالك seq 637 · B693) «إنشاء عرض سعر: ينكتب يدوياً — منتجات من النظام أو مكتوبة — بتفصيلات خاصّة» */
    { f: 'quote.html', t: 'عرض سعر', d: 'منتجات من النظام أو مكتوبة يدوياً · صلاحية وعملة · بورقة الفاتورة ولا يُعدّ فاتورة', ic: 'doc', g: 'sell', a: 'staff',
      k: 'عرض سعر عروض اسعار تسعيرة quotation quote بروفورما زبون' },
    { f: 'admin_pos.html?tab=adminInvoice', t: 'فاتورة من الإدارة', d: 'أنشئ فاتورةً باسمك لأي نقطة بيع، بعمولة أو بدونها', ic: 'plus', g: 'sell', a: 'admin',
      k: 'فاتورة جديدة ادمن من الاداره انشاء فاتورة نقطة بيع' },
    /* (المالك seq 210) «أداة جديدة شغلتها تفلتر»: صورة واحدة · متشابهات المتجر والجرد · بلا سعر/مجموعة/تصنيف/ربط/مواصفات · والتسعير */
    /* (TASK-0288 · المالك seq 229) «اداه تسعير تفرزني كل شيء بلا اسعار تعرض لي اياه لحتى اسعره» */
    /* (TASK-0291 · المالك seq 235) «الاشياء اللي بدها دمج او شاكك فيها خليها تطلع قدامي فورا اول ما ادخل على السيستم … اعرضها لي مع الصور» */
    { f: 'home.html?review=merge', t: 'مشابهات تنتظر قرارك', d: 'كل منتجين قد يكونان واحداً بالصور وكل التفاصيل — نعم ادمجهما / لا مختلفان · وتظهر وحدها عند الدخول', ic: 'search', g: 'stock', a: 'admin',
      k: 'مشابهات متشابهات مكرر مكررة دمج تكرار منتجات متشابهة قرار مراجعة duplicate merge review' },
    { f: 'inventory.html?check=no_price', t: 'التسعير', d: 'كل منتجٍ بلا سعر بخانة سعره · ومنها «⚡ اختلاف الأسعار بين الجرد والمتجر» (الجسر) — المالك seq 262–263', ic: 'tag', g: 'money', a: 'admin',
      k: 'تسعير اسعار بلا سعر بدون سعر منتجات جديدة فاتورة تسعير المنتجات price pricing اختلاف الاسعار فرق السعر الجرد المتجر الجسر' },
    { f: 'inventory.html?check=one_img', t: 'فحص المنتجات', d: 'صورة واحدة فقط · متشابهات المتجر والجرد للربط · بلا سعر/مجموعة/تصنيف/مواصفات/ربط · ومنها التسعير', ic: 'search', g: 'stock', a: 'admin',
      k: 'فحص منتجات فلتر صورة واحدة متشابهات ربط بلا سعر بلا مجموعة بلا تصنيف بلا مواصفات تسعير اسعار' },
    /* (٨ ث — تدقيق المطابقة) طلبك: «العروض والتسعير والكوبونات برّا بأداة مستقلّة على الخريطة الرئيسيّة بوصولٍ سياديّ» */
    { f: 'العروض_والتسعير.html', t: 'العروض والتسعير والكوبونات', d: 'الفعّال الآن في الثلاثة · ومنها لمحرّر كلٍّ منها', ic: 'tag', g: 'money', a: 'admin',
      k: 'عروض عرض تسعير تخفيض مؤقت كوبون كوبونات خصم باقة offers coupons' },
    { f: 'sales_log.html', n: 'سجل', t: 'سجل المبيعات والأرباح', d: 'الأكثر مبيعاً والأرباح من كل الفروع', ds: 'مبيعات نقطة بيعك',
      ic: 'chart', g: 'money', a: 'staff', k: 'مبيعات ارباح هامش سجل الاكثر مبيعا' },
    { f: 'morning.html', t: 'اللوحة الصباحية', d: 'مبيعات الأمس واليوم لكلّ فرع · آخر بيع · التحويلات والطلبات المعلّقة · ما يطلبه الزبائن ولا نملكه', ic: 'chart', g: 'money', a: 'admin',
      k: 'صباح صباحية لوحة ملخص يومي مبيعات الامس معلق تحويلات طلبات dashboard' },
    { f: 'weekly_report.html', t: 'التقرير الأسبوعي وتقارير الحارس', d: 'ملخّص الأسبوع والأخطاء والتحذيرات · تقرير الحارس 🐞 (بدل الزرّ العائم)', ic: 'calendar', g: 'money', a: 'admin',
      k: 'تقرير اسبوعي ملخص' },
    { f: 'المراجعة_المالية_الشاملة.html', t: 'المراجعة المالية الشاملة', d: 'تقريرٌ مكتوب بتاريخ ٢٦/٩ — للأرشيف، ليس فحصاً حيّاً', ic: 'coins', g: 'money', a: 'admin',
      k: 'مراجعة مالية صندوق تحصيل فجوة' },

    /* ── المتجر والموقع ── */
    { f: 'admin_store.html', t: 'أدمن المتجر', d: 'المنتجات · العروض · الكوبونات · الطلبات', ic: 'store', g: 'online', a: 'admin',
      k: 'ادمن متجر عروض كوبونات بكج تقييم' },
    { f: 'admin_site.html', t: 'أدمن الموقع', d: 'محتوى الموقع الرسمي والأخبار', ic: 'globe', g: 'online', a: 'admin',
      k: 'ادمن موقع اخبار فروع وكلاء' },
    { f: 'guarantee_admin.html', t: 'إدارة الكفالات', d: 'عرض الكفالات وإلغاؤها وتعديلها', ic: 'shield', g: 'online', a: 'admin',
      k: 'ادارة كفالات ضمان الغاء' },

    /* ── الفريق والأمان ── */
    { f: 'الأمان_والمستخدمون.html', t: 'الأمان والمستخدمون', d: 'المستخدمون حسب الفرع والأجهزة', ic: 'users', g: 'team', a: 'admin',
      k: 'مستخدمين امان جهاز تثبيت صلاحيات موظفين' },
    { f: 'سجل_العمليات.html', t: 'سجل العمليات', d: 'من فعل ماذا ومتى — أوردرات وفواتير ومصاريف ومخزون وحسابات', ic: 'clock', g: 'team', a: 'admin',
      k: 'سجل عمليات تدقيق من فعل متى تتبع audit log تاريخ تعديلات' },
    { f: 'home.html?sounds=1', t: 'معرض الأصوات', d: 'اسمع كل أصوات النظام · كتم أو تشغيل (أو اضغط مطوّلاً على زرّ الصوت في الشريط)', ic: 'volume', g: 'team', a: 'staff',
      k: 'صوت اصوات معرض كتم تشغيل نغمة رنين sound sounds mute' },
    { f: 'سلة_المحذوفات.html', t: 'سلّة المحذوفات', d: 'كل ما حُذف في النظام — استرجاع أو حذف نهائي', ic: 'layers', g: 'team', a: 'admin',
      k: 'سلة محذوفات حذف استرجاع ارجاع محذوف trash' },
    { f: 'passwords.html', t: 'كلمات السر', d: 'كلّ كلمات سرّ النظام في مكانٍ واحد', ic: 'key', g: 'team', a: 'admin',
      k: 'كلمة سر كلمات السر باسورد password' },
    { f: 'admin_sovereign.html', t: 'الأدمن الكلي', d: 'العمليات السياديّة وفكّ الأختام', ic: 'lock', g: 'team', a: 'admin',
      k: 'سيادي سيادة ادمن كلي ختم' },
    { f: 'backup.html', t: 'النسخ الاحتياطي', d: 'نسخ البيانات واسترجاعها', ic: 'database', g: 'team', a: 'admin',
      k: 'نسخ احتياطي backup استرجاع' },
    { f: 'أدمن_التوظيف.html', t: 'طلبات التوظيف', d: 'الطلبات الواردة · الفرز بالنتيجة · الحالة والملاحظات · واتساب', ic: 'briefcase', g: 'team', a: 'admin',
      k: 'توظيف وظيفة سيرة ذاتية متقدمين hiring' },

    /* ── عقل النظام والفحص ── */
    { f: 'تفعيل_عقل_النظام.html', t: 'تفعيل عقل النظام', d: 'رابط الوسيط ومفاتيح الذكاء', ic: 'brain', g: 'brain', a: 'admin',
      k: 'عقل ذكاء وسيط مفتاح api' },
    { f: 'checks.html', t: 'الفحص الشامل', d: 'كل الفحوصات بالتتابع في مكانٍ واحد، وتقريرٌ كاملٌ واحدٌ يُنسخ', ic: 'flask', g: 'brain', a: 'admin',
      k: 'فحص فحوصات بوتات تقرير' },
    { f: 'central_inspector.html', p: 'checks.html', t: 'مركز الفحص الشامل', d: 'يفتح كل صفحة ويفحص أزرارها وروابطها', ic: 'search', g: 'brain', a: 'admin',
      k: 'فاحص مفتش شامل' },
    { f: 'check.html', p: 'checks.html', t: 'تشخيص سريع', d: 'حالة الاتصال والقواعد بلمحة', ic: 'info', g: 'brain', a: 'admin',
      k: 'تشخيص اتصال قاعدة' },
    { f: 'guard_bots.html', p: 'checks.html', t: 'بوتات الحماية', d: 'الحرّاس الذين يراقبون الأخطاء', ic: 'bot', g: 'brain', a: 'admin',
      k: 'بوت بوتات حماية حارس' },
    { f: 'test_board.html', p: 'checks.html', t: 'لوحة التجريب', d: 'تجريب الأدوات المنجَزة بأمان', ic: 'grid', g: 'brain', a: 'admin',
      k: 'تجريب تجربة ساندبوكس' },
    { f: 'system_tools.html', t: 'أدوات المالك', d: 'ما تجرّبه · فحص النشر · العمل بلا إنترنت · الفاحص العميق · طبيب المخطط',
      ic: 'settings', g: 'brain', a: 'admin', k: 'نشر 404 بلا انترنت تنزيل فاحص عميق مخطط اعمدة' },

    /* ── المعرفة والخطط ── */
    { f: 'user_guide.html', t: 'دليل المستخدم', d: 'كل زرّ وما يفعله', ic: 'book', g: 'know', a: 'staff',
      k: 'دليل شرح تعليم مساعدة' },
    { f: 'شو_الجديد.html', t: 'شو الجديد', d: 'كل التحديثات وأين صارت', ic: 'sparkle', g: 'know', a: 'staff',
      k: 'جديد تحديثات ما الجديد' },
    { f: 'center.html', t: 'مركز المعرفة', d: 'كل شيء عن النظام', ic: 'book', g: 'know', a: 'admin',
      k: 'معرفة توثيق سجلات' },
    { f: 'full_docs.html', t: 'التوثيق الشامل', d: 'المرجع التقني للنظام', ic: 'doc', g: 'know', a: 'admin',
      k: 'توثيق مرجع' },
    { f: 'خريطة_الطريق.html', t: 'خريطة الطريق', d: 'ما لم يكتمل وما نقترحه', ic: 'route', g: 'know', a: 'admin',
      k: 'خطة طريق قادم ناقص' },
    { f: 'deploy_plan.html', t: 'خطة النشر', d: 'خطوات رفع النظام بالترتيب', ic: 'route', g: 'know', a: 'admin',
      k: 'نشر رفع github' },
    { f: 'الهوية_البصرية_2.html', t: 'الهوية البصرية ٢٫٠', d: 'التقرير التصميميّ والرموز', ic: 'palette', g: 'know', a: 'admin',
      k: 'هوية بصرية تصميم الوان' },
    { f: 'دراسة_كيبورد_المبيعات.html', t: 'كيبورد المبيعات', d: 'الدراسة المعماريّة للكيبورد والفقاعة', ic: 'keyboard', g: 'know', a: 'admin',
      k: 'كيبورد فقاعة مبيعات' },
    { f: 'preview_ui2.html', t: 'معاينة الواجهة الجديدة', d: 'الإنترو الجديد من عناصر الشعار · الشاشة الرئيسية · الهيدرات المتحرّكة — للمعاينة قبل التطبيق', ic: 'image', g: 'know', a: 'admin',
      k: 'معاينة واجهة جديدة انترو رئيسية هيدر تصميم' },
    { f: 'معاينة_النظام_الجديد.html', t: 'معاينة النظام الجديد', d: 'الشاشات المقترحة بلا خادم', ic: 'image', g: 'know', a: 'admin',
      k: 'معاينة شاشات تصميم' },

    /* (٨ ث — تدقيق المطابقة) أُخرجت من السجلّ: «معاينة_فاتورة.html» جزءٌ خام تبنيه أداة المعاينة (ليس صفحة)،
       و«plan.html» خطّة آب القديمة، و«guard_bots_19.html» نسخةٌ مكرّرة من بوتات الحماية. الملفّات باقية للمرجع. */

    /* ── واجهات الزبون ── */
    { f: 'store.html', t: 'المتجر الإلكتروني', d: 'التسوّق والطلب', ic: 'bag', g: 'public', a: 'public',
      k: 'متجر تسوق سلة store' },
    { f: 'site.html', t: 'الموقع الرسمي', d: 'وكيل Canon الرسمي في سوريا', ic: 'globe', g: 'public', a: 'public',
      k: 'موقع رسمي' },
    { f: 'track_order.html', t: 'تتبع الشحنة', d: 'حالة الطلب ورقم التتبع', ic: 'truck', g: 'public', a: 'public',
      k: 'تتبع شحنة طلب' },
    { f: 'search.html', t: 'التحقّق من الكفالة', d: 'البحث برقم الكفالة أو الرقم التسلسلي', ic: 'search', g: 'public', a: 'public',
      k: 'بحث كفالة تحقق تسلسلي' },
    { f: 'hiring.html', t: 'بوابة التوظيف', d: 'التقديم على وظيفة', ic: 'briefcase', g: 'public', a: 'public',
      k: 'توظيف تقديم وظيفة' }
  ];

  /* الوصولُ السريع الافتراضيّ لكلّ دور — يبدأ منه المستخدم، ثمّ يثبّت ما
     يريد بضغطةٍ طويلة (هاتف) أو كبسةٍ يمنى (كمبيوتر). */
  var QUICK_DEFAULT = {
    /* (2026-10-04 م) كما في نموذجك المعتمد حرفياً — «كل أدواتك» */
    admin: ['pos.html', 'inventory.html', 'orders.html', 'admin_pos.html', 'الإدارة.html', 'store.html', 'track_order.html', 'inventory.html?check=no_price'],   /* (TASK-B0509) + الإدارة */   /* (المالك seq 262) «أداة التسعير على الواجهة الرئيسية» */
    staff: ['pos.html', 'inventory.html', 'orders.html', 'sales_log.html', 'track_order.html', 'guarantee.html']
  };

  /* الشريطُ السفليّ على الهاتف: أربعُ وجهاتٍ ثابتة + «الكلّ». */
  var MOBILE_NAV = {
    /* كما في نموذجك: الرئيسية · نقطة · الجرد · الأوردرات · (أدمن النقاط للأدمن / سجل المبيعات للموظّف) */
    admin: ['pos.html', 'inventory.html', 'orders.html', 'admin_pos.html'],
    staff: ['pos.html', 'inventory.html', 'orders.html', 'sales_log.html']
  };

  function visible(tool, role) {
    if (tool.a === 'public') return true;
    if (role === 'admin') return true;
    if (role === 'staff') return tool.a === 'staff';
    return false;
  }

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[ًٌٍَُِّْـ]/g, '');
  }

  global.GMTTools = {
    groups: GROUPS,
    all: TOOLS,
    quickDefault: QUICK_DEFAULT,
    mobileNav: MOBILE_NAV,
    visible: visible,
    /* الأدواتُ التي يراها هذا الدور، بترتيب المجموعات */
    forRole: function (role) {
      return TOOLS.filter(function (x) { return visible(x, role) && !x.p; });
    },
    find: function (f) {
      for (var i = 0; i < TOOLS.length; i++) {
        if (TOOLS[i].f === f && TOOLS[i].g !== 'public') return TOOLS[i];
      }
      for (var j = 0; j < TOOLS.length; j++) if (TOOLS[j].f === f) return TOOLS[j];
      return null;
    },
    /* بحثٌ يتسامح مع الهمزات والتاء المربوطة: «اداره» تجد «إدارة» */
    search: function (q, role) {
      var n = norm(q).trim();
      var list = TOOLS.filter(function (x) { return visible(x, role) && !x.p; });    /* الفرعيّة (p) تُفتح من أداة أبيها */
      if (!n) return list;
      var words = n.split(/\s+/);
      return list.map(function (x) {
        var hay = norm(x.t + ' ' + x.d + ' ' + (x.ds || '') + ' ' + x.k + ' ' + x.f);
        var title = norm(x.t);
        var score = 0;
        for (var i = 0; i < words.length; i++) {
          if (hay.indexOf(words[i]) < 0) return null;
          score += title.indexOf(words[i]) === 0 ? 3 : title.indexOf(words[i]) > 0 ? 2 : 1;
        }
        return { x: x, s: score };
      }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).map(function (r) { return r.x; });
    },
    norm: norm,
    /* (TASK-B0546 · المالك seq B1077 «سألته سؤال بالنظام ما عرفه» — «وين بحس بعمل عرض سعر») بحثٌ متسامح بكلام عاديّ:
       يتجاهل كلمات السؤال (وين · كيف · بعمل · بدي…) ويرتّب بعدد الكلمات المطابقة — search() يطلب كلّ الكلمات فيفشل بالجُمل */
    match: function (q, role) {
      var STOP = /^(وين|فين|كيف|شلون|شو|ايش|بدي|بدو|بدنا|بعمل|اعمل|نعمل|يعمل|منعمل|بحس|بقدر|فيني|ممكن|لاقي|القي|الاقي|بلاقي|صفحه|صفحة|اداه|اداة|زر|زرار|مكان|هون|هنا|في|من|على|عن|الى|إلى|لل|ل|و|يا|انا|أنا|هو|هي|شي|عم|رح|لحتى|حتى|بال|بس|كمان|منين|لوين|قديش|ليش|هل)$/;
      var words = norm(q).replace(/[؟?!.,،:]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 2 && !STOP.test(w); })
        .map(function (w) { return w.replace(/^(بال|وال|ال|ب|و)(?=\S{3,})/, ''); });
      if (!words.length) return [];
      var list = TOOLS.filter(function (x) { return visible(x, role) && !x.p; });
      return list.map(function (x) {
        var hay = norm(x.t + ' ' + x.d + ' ' + (x.ds || '') + ' ' + x.k), title = norm(x.t), hit = 0, sc = 0;
        words.forEach(function (w) { if (hay.indexOf(w) >= 0) { hit++; sc += title.indexOf(w) >= 0 ? 3 : 1; } });
        if (title.indexOf(words.join(' ')) >= 0) sc += 5;
        return hit ? { x: x, s: sc, hit: hit } : null;
      }).filter(function (r) { return r && r.hit >= Math.max(1, Math.ceil(words.length / 2)); })
        .sort(function (a, b) { return b.s - a.s; }).map(function (r) { return r.x; });
    }
  };

  /* ══ (TASK-B0546 · المالك seq B1077 «زرّ بحث عن الإعدادات، أيّ زرّ إعدادات — وزرّ العقل يكون لحاله»)
     🔎 بحث الأدوات والإعدادات بكلّ صفحة داخلية — بالشريط العلويّ المشترك جنب 🧠 (كان بالرئيسية فقط) ══ */
  function role() { try { return global.GMTRole && GMTRole.isAdmin && GMTRole.isAdmin() ? 'admin' : 'staff'; } catch (_) { return 'staff'; } }
  function escT(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* ══ (TASK-B0550 · المالك seq B1083 «بدّي البحث لكلّ الأزرار — الفرعية والموجودة والداخلية: تعديل فاتورة مشتريات · إنشاء عرض سعر…»)
     بحث واحد بثلاث مجموعات: 🧰 الأدوات · 📍 أزرار بهالصفحة (حتى المخفيّة بنوافذ/تبويبات) · 🗂️ أزرار بصفحات تانية (فهرس gmt-btnindex.js
     المولَّد من كلّ الصفحات — حتى الأزرار المبنيّة جوّا النوافذ). الضغط على زرّ بصفحة تانية ⇐ بتنفتح ويتعلّم الزرّ (?gofind=). ══ */
  var IDX = null, IDX_LOADING = null;
  function loadIndex() {
    if (IDX) return Promise.resolve(IDX);
    if (global.GMT_BTN_INDEX) { IDX = global.GMT_BTN_INDEX; return Promise.resolve(IDX); }
    if (IDX_LOADING) return IDX_LOADING;
    IDX_LOADING = new Promise(function (res) {
      var sc = document.createElement('script'); sc.src = 'gmt-btnindex.js?v=' + (global.GMT_BTNIDX_V || '20261125b24');
      sc.onload = function () { IDX = global.GMT_BTN_INDEX || []; res(IDX); }; sc.onerror = function () { IDX = []; res(IDX); };
      document.head.appendChild(sc);
    });
    return IDX_LOADING;
  }
  var QSTOP = /^(وين|فين|كيف|شلون|شو|بدي|بدو|بعمل|اعمل|بحس|بقدر|فيني|لاقي|القي|الاقي|زر|زرار|صفحه|اداه|في|من|على|عن|الى|ل|و|يا|انا|هون|هنا|لنفرض|مثلا)$/;
  function qwords(q) { return norm(q).replace(/[؟?!.,،:«»"']/g, ' ').split(/\s+/).filter(function (w) { return w && w.length >= 2 && !QSTOP.test(w); }).map(function (w) { return w.replace(/^(بال|وال|ال|ب|و)(?=\S{3,})/, ''); }); }
  function score(hayRaw, titleRaw, words) {
    if (!words.length) return 0; var hay = norm(hayRaw), title = norm(titleRaw), hit = 0, sc = 0;
    words.forEach(function (w) { if (hay.indexOf(w) >= 0) { hit++; sc += title.indexOf(w) >= 0 ? 3 : 1; } });
    if (hit < Math.max(1, Math.ceil(words.length * 0.6))) return 0;
    return sc + (hit === words.length ? 4 : 0);
  }
  function here() { return decodeURIComponent((location.pathname.split('/').pop() || 'home.html')); }
  function liveButtons() {
    var out = [], seen = {};
    [].forEach.call(document.querySelectorAll('button,a[href],[role="button"],[data-hint]'), function (el) {
      if (el.closest('#gmt-tsearch')) return;
      var t = String(el.textContent || '').replace(/\s+/g, ' ').trim(), ti = el.getAttribute('title') || el.getAttribute('aria-label') || '', h = el.getAttribute('data-hint') || '';
      var label = (t.length >= 2 && t.length <= 70 ? t : '') || ti; if (!label || label.length > 90) return;
      var k = label + '|' + ti; if (seen[k]) return; seen[k] = 1;
      out.push({ el: el, label: label, desc: ti !== label ? ti : h });
    });
    return out;
  }
  function flash(el, label, desc) {
    var vis = el && el.offsetParent !== null && el.getClientRects().length;
    if (!vis) { banner('«' + label + '» موجود بهالصفحة جوّا نافذة أو تبويب' + (desc ? ' — ' + desc : '') + '. افتح النافذة/التبويب يلي فيه وبتلاقيه.'); return false; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.setAttribute('data-gofound', '1');
    var o = el.style.outline, sh = el.style.boxShadow; el.style.outline = '3px solid #D5001C'; el.style.boxShadow = '0 0 0 6px rgba(213,0,28,.25)';
    setTimeout(function () { el.style.outline = o; el.style.boxShadow = sh; }, 3500);
    return true;
  }
  function banner(msg) {
    var b = document.getElementById('gmt-tsearch-banner'); if (b) b.remove();
    b = document.createElement('div'); b.id = 'gmt-tsearch-banner'; b.setAttribute('data-keep-fab', '1');
    b.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:2147483460;max-width:92vw;background:#0f1219;color:#fff;border-radius:14px;padding:10px 14px;font:inherit;font-size:13px;font-weight:800;direction:rtl;box-shadow:0 12px 30px rgba(0,0,0,.25)';
    b.textContent = '🔎 ' + msg; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 7000);
  }
  function pageName(f) { var x = global.GMTTools.find(f); return x ? x.t : f.replace('.html', '').replace(/_/g, ' '); }
  function openSearch(initial) {
    var old = document.getElementById('gmt-tsearch'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'gmt-tsearch'; w.setAttribute('data-keep-fab', '1');
    w.style.cssText = 'position:fixed;inset:0;z-index:2147483450;background:rgba(15,18,25,.45);display:flex;align-items:flex-start;justify-content:center;padding:6vh 12px;direction:rtl;font-family:inherit';
    w.innerHTML = '<div style="width:100%;max-width:620px;background:#fff;border-radius:18px;padding:12px;box-shadow:0 30px 80px rgba(15,18,25,.25)">' +
      '<div style="display:flex;gap:8px;align-items:center"><input data-ts-q placeholder="🔎 أيّ زرّ أو أداة أو إعداد… (مثلاً: تعديل فاتورة مشتريات · إنشاء عرض سعر · كلمات السرّ)" autocomplete="off" style="flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:11px 12px;font:inherit;font-size:15px">' +
      '<button type="button" data-ts-x style="border:0;background:#f1f5f9;border-radius:10px;padding:9px 12px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
      '<div data-ts-res style="margin-top:8px;max-height:66vh;overflow:auto"></div>' +
      '<div style="font-size:11.5px;color:#64748b;margin-top:6px">بيلاقي كلّ الأزرار — حتى يلي جوّا النوافذ وبصفحات تانية. للأسئلة والشرح: 🧠 العقل.</div></div>';
    document.body.appendChild(w);
    var inp = w.querySelector('[data-ts-q]'), res = w.querySelector('[data-ts-res]'), items = [], sel = 0, live = liveButtons(), cur = here();
    function row(i, title, sub, tag) {
      return '<a data-ts-i="' + i + '" href="#" style="display:block;text-decoration:none;color:inherit;border-radius:12px;padding:8px 11px;margin-bottom:4px;' + (i === sel ? 'background:#fef2f2;' : 'background:#f8fafc;') + '">' +
        '<b style="font-size:14px">' + escT(title) + '</b>' + (tag ? ' <span style="font-size:11px;color:#b45309;font-weight:800">' + escT(tag) + '</span>' : '') + (sub ? '<div style="font-size:12px;color:#526077">' + escT(sub) + '</div>' : '') + '</a>';
    }
    function head(t) { return '<div style="font-size:12px;font-weight:900;color:#334155;margin:8px 2px 4px">' + t + '</div>'; }
    function draw() {
      var q = inp.value, r = role(), words = qwords(q), html = '';
      items = [];
      var tools = q.trim() ? global.GMTTools.search(q, r) : global.GMTTools.search('', r);
      if (q.trim() && !tools.length) tools = global.GMTTools.match(q, r);
      tools = tools.slice(0, q.trim() ? 6 : 30);
      if (tools.length) { html += head('🧰 الأدوات'); tools.forEach(function (x) { items.push({ k: 'tool', x: x }); html += row(items.length - 1, x.t, x.d); }); }
      if (q.trim()) {
        var lv = live.map(function (b) { return { b: b, s: score(b.label + ' ' + b.desc, b.label, words) }; }).filter(function (z) { return z.s; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
        if (lv.length) { html += head('📍 بهالصفحة'); lv.forEach(function (z) { items.push({ k: 'live', b: z.b }); html += row(items.length - 1, z.b.label, z.b.desc, z.b.el.offsetParent === null ? 'جوّا نافذة/تبويب' : ''); }); }
        var ix = (IDX || []).filter(function (e) { return e[0] !== cur; }).map(function (e) { return { e: e, s: score(e[1] + ' ' + e[2] + ' ' + pageName(e[0]), e[1], words) }; })
          .filter(function (z) { return z.s; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 15);
        if (ix.length) { html += head('🗂️ بصفحات تانية'); ix.forEach(function (z) { items.push({ k: 'idx', e: z.e }); html += row(items.length - 1, z.e[1], '📄 ' + pageName(z.e[0]) + (z.e[2] ? ' — ' + z.e[2] : '')); }); }
        if (!IDX) html += '<div style="font-size:12px;color:#64748b;padding:4px">⏳ عم حمّل فهرس كلّ الأزرار…</div>';
      }
      sel = Math.min(sel, Math.max(0, items.length - 1));
      res.innerHTML = html || '<div style="padding:16px;text-align:center;color:#64748b">ما لقيت شي بهالاسم — جرّب كلمة تانية، أو اسأل 🧠 العقل.</div>';
    }
    function go(it, newTab) {
      if (!it) return;
      if (it.k === 'tool') { if (newTab) window.open(it.x.f, '_blank'); else location.href = it.x.f; return; }
      if (it.k === 'live') { w.remove(); flash(it.b.el, it.b.label, it.b.desc); return; }
      var f = it.e[0], url = f + (f.indexOf('?') >= 0 ? '&' : '?') + 'gofind=' + encodeURIComponent(it.e[1]) + (it.e[2] ? '&gohint=' + encodeURIComponent(it.e[2]) : '');
      if (newTab) window.open(url, '_blank'); else location.href = url;
    }
    inp.addEventListener('input', function () { sel = 0; draw(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); go(items[sel], e.ctrlKey || e.metaKey); }
      else if (e.key === 'Escape') w.remove();
    });
    w.addEventListener('click', function (e) {
      if (e.target === w || e.target.closest('[data-ts-x]')) { w.remove(); return; }
      var a = e.target.closest('[data-ts-i]'); if (a) { e.preventDefault(); go(items[+a.getAttribute('data-ts-i')], e.ctrlKey || e.metaKey); }
    });
    if (initial) inp.value = initial;
    draw(); setTimeout(function () { inp.focus(); }, 30);
    loadIndex().then(function () { if (document.body.contains(w)) draw(); });
    return w;
  }
  /* ?gofind=<نصّ الزرّ> — جيت من البحث بصفحة تانية ⇐ لاقي الزرّ وعلّمه (أو قلّي وين هو إذا جوّا نافذة) */
  function gofind() {
    var p = null; try { p = new URLSearchParams(location.search); } catch (_) { return; }
    var t = p && p.get('gofind'); if (!t) return; var hint = p.get('gohint') || '', tries = 0;
    (function look() {
      /* الإيموجي بالأزرار بيتحوّل لأيقونة رسم (gmt-icons) ⇒ «📒 الآجلة» بالمصدر = «الآجلة» بالصفحة ⇒ المقارنة بالحروف والأرقام بس */
      var bare = function (x) { return norm(x).replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); };
      var nt = bare(t), hit = null, hidden = null; if (!nt) return;
      [].forEach.call(document.querySelectorAll('button,a[href],[role="button"],[data-hint]'), function (el) {
        if (hit) return; var s = bare((el.textContent || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || ''));
        if (s.indexOf(nt) < 0) return; if (el.offsetParent !== null) hit = el; else if (!hidden) hidden = el;
      });
      if (hit) return flash(hit, t, hint);
      if (++tries < 16) return setTimeout(look, 500);
      banner('«' + t + '» بهالصفحة جوّا نافذة أو بيطلع بعد ما تفتح شي' + (hint ? ' — ' + hint : '') + '.');
    })();
  }
  global.GMTTools.loadIndex = loadIndex; global.GMTTools.qwords = qwords; global.GMTTools.score = score;
  global.GMTTools.openSearch = openSearch;
  function mountSearch(tries) {
    try {
      if (!(global.GMT_INTERNAL === true || global.GMT_INTERNAL === 1)) return;
      if (document.getElementById('gmt-tsearch-btn')) return;
      /* (seq B1083 «زرّين بحث جنب بعض» · B1085 «رجع اختفى زرّ البحث») الزرّ بينخفى بس إذا حقل «بحث في النظام» **ظاهر** —
         بالرئيسية على الموبايل الحقل مخفي (.phone .srch.dk) ⇒ كان ما في بحث أبداً. الآن بيتبع ظهور الحقل (ومع تغيير حجم الشاشة) */
      var host = document.querySelector('.gmt-refresh-bar') || document.getElementById('gmt-refresh-bar');
      if (!host) { if ((tries || 0) < 20) setTimeout(function () { mountSearch((tries || 0) + 1); }, 500); return; }
      var b = document.createElement('button');
      b.id = 'gmt-tsearch-btn'; b.type = 'button'; b.title = '🔎 بحث بالأدوات والإعدادات'; b.setAttribute('aria-label', 'بحث بالأدوات والإعدادات'); b.setAttribute('data-keep-fab', '1'); b.textContent = '🔎';
      b.style.cssText = 'position:relative;width:30px;height:30px;border-radius:9px;border:1px solid rgba(0,0,0,.08);background:#fff;color:#0f172a;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;padding:0;flex:none';
      b.onclick = function () { openSearch(''); };
      host.insertBefore(b, host.firstChild);
      var sync = function () { var q = document.querySelector('input#q[aria-label="بحث في النظام"]'), vis = !!(q && q.offsetParent !== null && q.getClientRects().length); if (vis) b.style.setProperty('display', 'none', 'important'); else b.style.removeProperty('display'); };   /* important: قاعدة الشريط بتفرض الظهور */
      sync(); setTimeout(sync, 1200); global.addEventListener('resize', sync);
    } catch (_) {}
  }
  if (typeof document !== 'undefined') { var _boot = function () { mountSearch(0); setTimeout(gofind, 900); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot); else _boot(); }
})(window);

/* ══ (TASK-A0527 · P0 · بلاغ البوت «GMTAsk is not defined» orders.html:1518 · صيد النمط) ══
   gmt-ask.js يُحمَّل مؤجَّلاً (defer) في كلّ الصفحات، وأزرارٌ كثيرة تناديه مباشرة (سجلّ التراجع · التجميد · التأكيدات …)
   ⇒ نقرةٌ قبل اكتمال تحميله = خطأ وزرٌّ لا يعمل. هذا الملفّ يُحمَّل متزامناً في كلّ صفحةٍ تستعمل GMTAsk، فيضع **بديلاً مؤقّتاً**
   بنفس الدوالّ: ينتظر الحقيقيّ (حتى ٨ ث، ويحمّله بنفسه إن لم يصل) ثمّ يسلّمه الطلب كما هو. gmt-ask.js يكتب فوقه حين يصل. */
(function (g) {
  if (g.GMTAsk) return;
  var loading = false;
  function real() { var A = g.GMTAsk; return A && !A.__stub ? A : null; }
  function later(name) {
    return function () {
      var a = arguments, t0 = Date.now();
      return new Promise(function (res) {
        (function w() {
          var A = real();
          if (A && typeof A[name] === 'function') return res(A[name].apply(A, a));
          if (!loading && Date.now() - t0 > 2500) {   // لم يصل ⇒ نحمّله نحن مرّة
            loading = true;
            try { var s = document.createElement('script'); s.src = 'gmt-ask.js'; (document.head || document.documentElement).appendChild(s); } catch (_) {}
          }
          if (Date.now() - t0 > 8000) return res(name === 'confirm' ? false : null);   // لا نافذة ⇒ «لا» (لا تنفيذ بلا موافقة)
          setTimeout(w, 40);
        })();
      });
    };
  }
  g.GMTAsk = { __stub: 1, alert: later('alert'), confirm: later('confirm'), choose: later('choose'), form: later('form'), prompt: later('prompt') };
})(typeof window !== 'undefined' ? window : globalThis);

/* ══ (TASK-A0543 · المالك seq 928 «خطأ حرج: rcptBatchOpen is not defined») ضغطةٌ قبل أن يجهز كود الصفحة ══
   الأزرار تُرسم قبل أن يُنفَّذ سكربت الصفحة (أو مكتبةٌ «defer») ⇒ ضغطةٌ في الثواني الأولى على هاتفٍ بطيء تنادي دالةً لم تُعرَّف ⇒
   «خطأ حرج». صيد النمط من سجلّ الأخطاء (30 يوماً): rcptBatchOpen · GMTMuftiReview · GMTAsk (الأوردرات) · unlock (الأمان والمستخدمون).
   الحارس العامّ: قبل تنفيذ onclick نقرأ اسم الدالة الأولى فيه؛ إن لم تُعرَّف بعد (لا على window ولا كتعريفٍ عامّ) تُوقَف الضغطة
   بلطف «⏳ الصفحة عم تتحمّل» — ولا شيء يتغيّر بعد التحميل. */
(function () {
  if (typeof document === 'undefined' || window.__gmtEarlyGuard) return;
  window.__gmtEarlyGuard = true;
  var SKIP = { if: 1, return: 1, event: 1, this: 1, document: 1, window: 1, location: 1, history: 1, alert: 1, confirm: 1, var: 1, let: 1, const: 1, typeof: 1, void: 1, new: 1, try: 1 };
  function defined(name) {
    if (typeof window[name] !== 'undefined') return true;
    try { return (0, eval)('typeof ' + name) !== 'undefined'; } catch (e) { return true; }   // تعذّر الفحص ⇒ لا نُوقف شيئاً
  }
  function note() {
    var n = document.getElementById('gmt-wait-note');
    if (!n) { n = document.createElement('div'); n.id = 'gmt-wait-note'; n.setAttribute('role', 'status');
      n.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483000;background:#111827;color:#fff;padding:10px 16px;border-radius:12px;font:900 13px Cairo,Tahoma,sans-serif;direction:rtl;box-shadow:0 8px 24px rgba(0,0,0,.3)';
      (document.body || document.documentElement).appendChild(n); }
    n.textContent = '⏳ الصفحة عم تتحمّل — لحظة وأعد الضغط'; n.style.display = 'block';
    clearTimeout(n.__t); n.__t = setTimeout(function () { n.style.display = 'none'; }, 2200);
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('[onclick]'); if (!el) return;
    var m = String(el.getAttribute('onclick') || '').match(/^\s*(?:return\s+)?(?:window\.)?([A-Za-z_$][\w$]*)\s*[.(]/);
    if (!m || SKIP[m[1]] || defined(m[1])) return;
    e.preventDefault(); e.stopPropagation(); note();
  }, true);
})();
