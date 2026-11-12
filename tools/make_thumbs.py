#!/usr/bin/env python3
"""مصغّرات صور المتجر (المالك seq 626 «صور المتجر ما عم تحمّل إلا القليل»).
لكلّ صورة في img/p/<مسار>.<امتداد> تُصنع img/t/<مسار>.webp بعرض/ارتفاع أقصى 400px.
البطاقات في المتجر تطلب المصغّرة (عشرات ك.ب بدل مئات) وإن لم توجد ترجع للأصلية تلقائياً.
تشغيل: python3 tools/make_thumbs.py   (يتخطّى ما صُنع من قبل إلا إذا تغيّرت الأصلية)"""
import os, sys
from PIL import Image, ImageOps
SRC, DST, MAX, Q = 'img/p', 'img/t', 400, 72
done = skip = fail = 0
for root, _, files in os.walk(SRC):
    for f in files:
        if not f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif')): continue
        src = os.path.join(root, f)
        rel = os.path.relpath(src, SRC)
        dst = os.path.join(DST, os.path.splitext(rel)[0] + '.webp')
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): skip += 1; continue
        try:
            im = Image.open(src); im = ImageOps.exif_transpose(im)
            if im.mode in ('P', 'LA'): im = im.convert('RGBA')
            if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGB')
            im.thumbnail((MAX, MAX), Image.LANCZOS)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst, 'WEBP', quality=Q, method=4)
            done += 1
        except Exception as e:
            fail += 1; print('fail', src, e, file=sys.stderr)
print('made', done, 'skipped', skip, 'failed', fail)
