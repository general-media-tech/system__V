# الأقفال — locks/

ملفّ `TASK-xxxx.lock` لكل مهمة محجوزة (المادة ٦). **لا تُنشئها ولا تحذفها يدوياً** — استعمل `scripts/gov.sh claim | release | takeover`.
الحجز يكون ذرّياً لأنّ دفع Git إلى فرع التنسيق عمليةُ «قارن ثمّ بدّل»: من يُرفض دفعه يجلب الحالة ويُعيد الفحص، فلا تفوز جلستان بالمهمة نفسها.
الحقول: task · session · branch · files · claimed_at · status · release (و taken_over_from · takeover_reason عند الاستلام).
