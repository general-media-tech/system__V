-- TASK-A0534 (المالك seq 909 · 21 ت2 2026) — طُبّق على القاعدة الرئيسية (migration a0534_transfer_items_qty_allow_zero)
-- المشكلة: inventory.html يوسم بند النقل الذي فشل خصمه بـ qty = 0 (المنقول فعلاً) و«لم تُنقل» القديمة تكتب qty = 0،
--          بينما القيد كان qty > 0 ⇒ الوسم يُرفض ⇒ يبقى البند بكميته الكاملة ويُعرَض/يُستلم كأنه نُقل.
-- الإصلاح: السماح بالصفر (ما زال يمنع السالب).
alter table public.stock_transfer_items drop constraint if exists stock_transfer_items_qty_check;
alter table public.stock_transfer_items add constraint stock_transfer_items_qty_check check (qty >= 0);
