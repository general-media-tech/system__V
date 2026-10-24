# TASK-0041 — رُقعٌ جزئية قديمة (لم تُطبَّق ولم تُراجَع)

نشرتها الجلسة `session_01MWfC494J8Ayokvio9Ve6C9` في 24 ت1 2026 من حاويتها (TASK-0139) — كانت محفوظةً عندها فقط، ولهذا سُجّلت TASK-0041 «موقوفة: غير موجود على origin».

| الملفّ | ما فيه | ملفّات الكود التي يلمسها | أساسه |
|---|---|---|---|
| `wf30b_track1.patch` | صورة/PDF الأوردر بمُصيِّرٍ داخلي (`gmt-render.js`) وخطّ Cairo مستضاف + مشاركة (`gmt-share.js`) + «قفل الأوردرات» (`gmt-orders-lock.js`) | `orders.html` · `gmt-core.js` · `gmt-render.js` · `gmt-share.js` · `gmt-orders-lock.js` · `lib/fonts/*` | نسخة 17 ت1 القديمة |
| `wf30b_track2.patch` | سجل العمليات المقروء + الجلسة الدائمة | `سجل_العمليات.html` · `gmt-oplog.js` · `gmt-account.js` · `gmt-auth.js` | نسخة 17 ت1 القديمة |
| `orders_partial_attempt1.patch` | محاولةٌ أقدم للأوّل | كالأوّل بلا `gmt-orders-lock.js` | 12 ت1 |
| `oplog_partial_on_old_main.patch` | محاولةٌ أقدم للثاني | كالثاني + `gmt-whatsnew.js` | 12 ت1 |

⚠️ **لا تُطبَّق كما هي:** الأساس قديم جداً، و`gmt-account.js`/`gmt-auth.js` تغيّرا بعدها لأسبابٍ أمنية (TASK-0112) — أيّ دمجٍ يُعاد بناؤه يدوياً على الحالة الحيّة ويُختبر، ولا يُعاد إدخال أيّ منطقٍ قديم لكلمات المرور. فُحصت الرقع قبل النشر: لا مفاتيح ولا أسرار.
