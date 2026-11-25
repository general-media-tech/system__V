#!/usr/bin/env python3
# TASK-B0550 · المالك seq B1083 «بدّي البحث لكلّ الأزرار — الفرعية والموجودة والداخلية (تعديل فاتورة مشتريات · إنشاء عرض سعر…)»
# يولّد gmt-btnindex.js: فهرس كلّ أزرار الصفحات الداخلية — الثابتة بالـHTML **والمبنيّة بالجافاسكربت** (قوالب النوافذ) — نصّها + title + data-hint.
# التشغيل: python3 tools/gen_btn_index.py  (يُعاد مع كلّ نشر يغيّر أزراراً)
import re, json, glob, os, html as H
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'store.html', 'track_order.html', 'index.html', 'offline.html'}   # صفحات الزبون العامّة
BTN = re.compile(r'<(button|a)\b([^>]*)>(.*?)</\1>', re.S | re.I)
ATTR = lambda n: re.compile(n + r'\s*=\s*(["\'])(.*?)\1', re.S | re.I)
TITLE, HINT, ONC, HREF = ATTR('title'), ATTR('data-hint'), ATTR('onclick'), ATTR('href')
def clean(t):
    t = re.sub(r'\$\{[^}]*\}', ' ', t)                 # قوالب JS
    t = re.sub(r"'\s*\+[^+]*\+\s*'", ' ', t)          # 'نص' + متغيّر + 'نص'
    t = re.sub(r'<[^>]+>', ' ', t); t = H.unescape(t)
    t = re.sub(r'[\\]n|\s+', ' ', t).strip(" '\"+·—-:")
    return t
def keep(t):
    if len(t) < 2 or len(t) > 70: return False
    if not re.search(r'[؀-ۿa-zA-Z]{2}', t): return False
    if re.fullmatch(r'(✕|×|x|X|إغلاق|إلغاء|close|ok|حسناً|نعم|لا|→|←|\d+)', t): return False
    return True
out = []
for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    name = os.path.basename(f)
    if name in SKIP: continue
    src = open(f, encoding='utf-8', errors='ignore').read()
    if 'GMT_INTERNAL' not in src: continue
    seen = set()
    for m in BTN.finditer(src):
        tag, attrs, inner = m.group(1).lower(), m.group(2), m.group(3)
        if tag == 'a':
            hr = HREF.search(attrs); 
            if not hr or hr.group(2).startswith(('http', 'tel:', 'mailto:', '#', 'javascript')): continue
        txt = clean(inner); tl = TITLE.search(attrs); hn = HINT.search(attrs)
        tl = clean(tl.group(2)) if tl else ''; hn = clean(hn.group(2)) if hn else ''
        label = txt if keep(txt) else (tl if keep(tl) else '')
        if not label: continue
        desc = tl if tl and tl != label else (hn if hn != label else '')
        k = label + '|' + desc
        if k in seen: continue
        seen.add(k); out.append([name, label, desc[:120]])
js = ('/* مولَّد آلياً بـ tools/gen_btn_index.py — لا تعدّله يدوياً (TASK-B0550 · seq B1083) */\n'
      'window.GMT_BTN_INDEX = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'gmt-btnindex.js'), 'w', encoding='utf-8').write(js)
print(len(out), 'زرّ ·', len(set(x[0] for x in out)), 'صفحة ·', round(len(js.encode()) / 1024), 'KB')
