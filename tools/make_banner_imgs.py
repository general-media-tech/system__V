#!/usr/bin/env python3
"""نسخٌ خفيفة لبانرات المتجر (TASK-A0563 · المالك seq 961).
البانر يُعرض بعرض الشاشة كاملاً ⇒ لا يصلح له مصغّر البطاقات (400px) — ولا يحتاج الأصل الثقيل (بانر PNG كان 529 ك.ب فلم يحمّل على شبكة الهاتف).
لكلّ صورة img/p/<مسار>.<امتداد> مستعملةٍ بانراً تُصنع img/b/<مسار>.webp بعرض أقصى 1280px (جودة 80).
المتجر يطلب img/b/… وإن لم توجد يعود للأصلية تلقائياً (gmtBanner + gmtImgRetry).
تشغيل: python3 tools/make_banner_imgs.py img/p/s/a.png img/p/s/b.jpg …   (أو بلا وسائط: كلّ صور img/p/s التي يذكرها ملفّ banners.txt إن وُجد)"""
import os, sys
from PIL import Image, ImageOps
MAXW, Q = 1280, 80
args = sys.argv[1:]
for src in args:
    if not src.startswith('img/p/'): print('skip (ليست في img/p)', src); continue
    rel = os.path.relpath(src, 'img/p')
    dst = os.path.join('img/b', os.path.splitext(rel)[0] + '.webp')
    im = Image.open(src); im = ImageOps.exif_transpose(im)
    if im.mode in ('P', 'LA'): im = im.convert('RGBA')
    if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGB')
    if im.width > MAXW: im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=Q, method=6)
    print(f'{src} {os.path.getsize(src)//1024}K ⇒ {dst} {os.path.getsize(dst)//1024}K ({im.width}×{im.height})')
