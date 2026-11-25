/* ═════════════════════════════════════════════════════════════════════
   gmt-brainbank.js — بنك أسئلة تدريب العقل (TASK-B0553 · طابور Q2 · المالك seq B1078 «العقل درّبه أنت على كلّ شي — حتى على الأسئلة والاقتراحات»)
   كلّ سؤال بكلامنا + الجواب الصحيح المتوقَّع — GMTBrain.selfTest() بيشغّلهم على الطبقة الفوريّة (بلا رصيد) وبيعطي علامة وقائمة الغلط.
   أنواع:  where — لازم الجواب يدلّ على الصفحة f (أيّ واحدة من القائمة)
           how   — لازم الجواب (شرح فوري) يطابق has
           advise— لازم يفهم: grp (نوع المنتج من مجموعات الجرد) · mode/max/min/target (الميزانية) · watt
   أيّ سؤال جديد غلط فيه العقل بالاستعمال ⇐ ينضاف هون مع جوابه الصحيح ⇐ بيصير جزء من العلامة لكلّ نشر.
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  var B = [
    /* ── وين (الصفحات والأدوات) ── */
    { q: 'وين بعمل عرض سعر', t: 'where', f: ['quote.html'] },
    { q: 'بدي اعمل عرض سعر لزبون', t: 'where', f: ['quote.html'] },
    { q: 'وين بلاقي فواتير الشراء', t: 'where', f: ['purchase.html'] },
    { q: 'وين المشتريات', t: 'where', f: ['purchase.html'] },
    { q: 'وين الموردين', t: 'where', f: ['purchase.html'] },
    { q: 'وين بستلم البضاعة الواصلة', t: 'where', f: ['مستودع.html', 'purchase.html'] },
    { q: 'وين جهاز المستودع', t: 'where', f: ['مستودع.html'] },
    { q: 'وين بطبع باركود', t: 'where', f: ['labels.html'] },
    { q: 'وين طابعة الملصقات', t: 'where', f: ['labels.html'] },
    { q: 'وين بعمل كفالة', t: 'where', f: ['guarantee.html'] },
    { q: 'وين بدوّر على جهاز بالسيريال', t: 'where', f: ['سجل_الأجهزة.html'] },
    { q: 'وين بلاقي جهاز برقم IMEI', t: 'where', f: ['سجل_الأجهزة.html'] },
    { q: 'وين الديون', t: 'where', f: ['admin_pos.html?tab=debts'] },
    { q: 'وين المصاريف', t: 'where', f: ['admin_pos.html?tab=expenses'] },
    { q: 'وين التقفيلات', t: 'where', f: ['admin_pos.html?tab=closings'] },
    { q: 'وين نقل المخزون بين الفروع', t: 'where', f: ['admin_pos.html?tab=stocktransfers'] },
    { q: 'وين العملاء', t: 'where', f: ['admin_pos.html?tab=customers'] },
    { q: 'وين كشف حساب عميل دائم', t: 'where', f: ['admin_pos.html?tab=customers'] },
    { q: 'وين الكوبونات', t: 'where', f: ['admin_pos.html?tab=coupons', 'العروض_والتسعير.html'] },
    { q: 'وين العروض', t: 'where', f: ['admin_pos.html?tab=offers', 'العروض_والتسعير.html'] },
    { q: 'وين الموظفين', t: 'where', f: ['admin_pos.html?tab=users', 'الأمان_والمستخدمون.html'] },
    { q: 'وين صلاحيات الموظفين', t: 'where', f: ['الأمان_والمستخدمون.html'] },
    { q: 'وين كلمات السر', t: 'where', f: ['passwords.html'] },
    { q: 'وين النسخ الاحتياطي', t: 'where', f: ['backup.html'] },
    { q: 'وين سلة المحذوفات', t: 'where', f: ['سلة_المحذوفات.html'] },
    { q: 'وين سجل المبيعات', t: 'where', f: ['sales_log.html'] },
    { q: 'وين الأرباح', t: 'where', f: ['sales_log.html', 'admin_pos.html?tab=accounting'] },
    { q: 'وين التقرير الأسبوعي', t: 'where', f: ['weekly_report.html'] },
    { q: 'وين أداة التسويات', t: 'where', f: ['أداة_التسويات.html'] },
    { q: 'وين المنتجات يلي أسعارها ناقصة', t: 'where', f: ['أداة_التسويات.html', 'inventory.html?check=no_price', 'مراجعة_الأسعار_والمشتريات.html'] },
    { q: 'وين بشوف شو لازم نشتري', t: 'where', f: ['ما_يجب_شراؤه.html'] },
    { q: 'وين الأشياء يلي طلبوها الزبائن وما عنا', t: 'where', f: ['طلبات_غير_متوفرة.html'] },
    { q: 'وين الفحص الشامل', t: 'where', f: ['checks.html'] },
    { q: 'وين شو الجديد', t: 'where', f: ['شو_الجديد.html'] },
    { q: 'وين الجرد', t: 'where', f: ['inventory.html'] },
    { q: 'وين الأوردرات', t: 'where', f: ['orders.html'] },
    { q: 'وين نقطة البيع', t: 'where', f: ['pos.html'] },
    { q: 'وين بعمل فاتورة من الإدارة', t: 'where', f: ['admin_pos.html?tab=adminInvoice'] },
    { q: 'وين الأصول الثابتة', t: 'where', f: ['admin_pos.html?tab=assets'] },
    { q: 'وين ردود سريعة للزبائن', t: 'where', f: ['ردود_سريعة.html'] },
    { q: 'وين دليل التوافقيات', t: 'where', f: ['دليل_التوافقيات_والمواصفات.html'] },
    { q: 'وين اللوحة الصباحية', t: 'where', f: ['morning.html'] },
    /* ── كيف (الشرح) ── */
    { q: 'كيف بعمل مرتجع', t: 'how', has: /مرتجع/ },
    { q: 'كيف بسجّل مصروف', t: 'how', has: /مصروف/ },
    { q: 'كيف بعمل كفالة', t: 'how', has: /كفال/ },
    /* ── اقتراحات (ترشيح لزبون) ── */
    { q: 'زبون بدو اضاءة مستمرة بسعر 50 دولار', t: 'advise', grp: /اضا|ليد|لايت/, mode: 'around', target: 50 },
    { q: 'اضائة حوالي 50 واط. اقل او اكثر قليلا ميزانيتي اقل من 100 دولار', t: 'advise', grp: /اضا|ليد|لايت/, mode: 'max', max: 100, watt: 50 },
    { q: 'زبون بدو مايك تحت 40 دولار', t: 'advise', grp: /مايك/, mode: 'max', max: 40 },
    { q: 'بدي ترايبود بين 20 و 50 دولار', t: 'advise', grp: /ستاند|ترايبود/, mode: 'between', min: 20, max: 50 },
    { q: 'رشحلي عدسة بحدود 300 دولار', t: 'advise', grp: /عدس/, mode: 'around', target: 300 },
    { q: 'زبون بدو بطارية', t: 'advise', grp: /بطاريات|شواحن/ },
    { q: 'شو عندنا سوفت بوكس', t: 'advise', grp: /سوفت|عواكس/ },
    { q: 'زبون بدو جيمبال للموبايل', t: 'advise', grp: /اوزمو|رونين/ },
    { q: 'زبون بدو اضاءة 100 واط', t: 'advise', grp: /اضا|ليد|لايت/, watt: 100 },
    { q: 'بدي كرت ذاكرة رخيص', t: 'advise', grp: /كروت/ },
    { q: 'زبون بدو فلتر للعدسة', t: 'advise', grp: /فلات/ },
    { q: 'شو عندنا حقيبة كاميرا بأقل من 70 دولار', t: 'advise', grp: /حقائب/, mode: 'max', max: 70 }
  ];
  g.GMT_BRAIN_BANK = B;
  if (typeof module !== 'undefined' && module.exports) module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
