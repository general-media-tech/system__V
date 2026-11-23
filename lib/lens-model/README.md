# عين العدسة المحلّية — MobileNetV2 (1.0 · 224)

- المصدر: نموذج `mobilenet_v2_1.0_224` المحوَّل لـ TensorFlow.js من مستودع `tfjs-models` لدى Google (storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224).
- الرخصة: Apache License 2.0 (مثل `lib/tf.min.js` — TensorFlow.js 4.22.0).
- الاستعمال: `gmt-lens-local.js` يأخذ مخرج الطبقة `Logits/AvgPool` (١٢٨٠ رقماً) ثم يضغطه إلى ١٢٨ بُعداً (`lens-index.json`) — TASK-A0580.
- ثابت الاسم في عامل الخدمة (`sw.js` كاش `gmt-ocr-…`) ⇒ تغيير النموذج يحتاج اسم كاش جديداً.
