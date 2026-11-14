#!/usr/bin/env python3
# (TASK-B0397 · المالك seq B653) صورة مصغّرة لكلّ قسمٍ فرعيّ بلا صورة = صورة منتجٍ من داخله على خلفية بيضاء مربّعة تقريباً (نمط الأقسام القديمة) · بلا تكرار صورة ولا منتج بين الأقسام
# يكتب subthumbs.json فقط (لا يكتب في القاعدة) — المفاتيح من البيئة SU/SK · التطبيق: نسخة في gmt_trash ثمّ PATCH شرطي على updated_at
import json, os, sys, urllib.request, re
from PIL import Image, ImageStat
SU, SK = os.environ['SU'], os.environ['SK']
REPO = '/home/user/system__V/'
req = urllib.request.Request(SU + '/rest/v1/gmt_store?id=eq.1&select=categories,products,updated_at', headers={'apikey': SK, 'Authorization': 'Bearer ' + SK})
st = json.load(urllib.request.urlopen(req))[0]
json.dump(st, open('store_before_subthumbs.json', 'w'), ensure_ascii=False)
cats, prods = st['categories'], st['products']
def pcats(p): return [str(x) for x in (p.get('category_ids') or [p.get('category_id')]) if x]
def local(u):
    m = re.search(r'/system__V/(img/.+)$', u or '')
    return REPO + m.group(1) if m and os.path.exists(REPO + m.group(1)) else None
def score(path):
    try:
        im = Image.open(path).convert('RGB'); w, h = im.size
        ar = w / h
        if not 0.75 <= ar <= 1.34: return None
        s = max(4, min(w, h) // 12); vals = []
        for (x, y) in [(0, 0), (w - s, 0), (0, h - s), (w - s, h - s)]:
            st_ = ImageStat.Stat(im.crop((x, y, x + s, y + s))); vals.append((sum(st_.mean) / 3, sum(st_.stddev) / 3))
        if not all(m > 236 and sd < 12 for m, sd in vals): return None
        cen = ImageStat.Stat(im.crop((w // 4, h // 4, 3 * w // 4, 3 * h // 4)).convert('L'))
        if cen.mean[0] > 240: return None   # شبه فارغة
        g = im.convert('L').resize((120, 120)); f = sum(1 for v in g.getdata() if v < 225) / 14400
        return f
    except Exception: return None
used_img, used_prod = set(), set()
for c in cats:   # صور الأقسام الرئيسية محجوزة
    if c.get('image'): used_img.add(c['image'])
out = {}
for c in cats:
    if not c.get('parent_id') or c.get('image'): continue
    cid = str(c['id']); par = str(c['parent_id'])
    ps = [p for p in prods if cid in pcats(p) and not p.get('package_items')]
    ps.sort(key=lambda p: (p.get('category_orders') or {}).get(cid, p.get('order') or 0))
    pick = None
    LOW = {'h3_5': 0.03}   # الستاندات نحيلة بطبيعتها
    FORCE = {'h14_3': 'lens_f38182bf-d776-4639-bad5-cae938b73806_1793191631554.png'}   # بدل بوستر داكن (فُحص بالعين)
    for p in (ps if cid in FORCE else []):
        for u in (p.get('images') or []):
            if u.endswith(FORCE[cid]) and u not in used_img: pick = (u, p.get('name'), p.get('id'))
    for minf, uniq_prod in (() if pick else ((LOW.get(cid, 0.15), True), (LOW.get(cid, 0.15), False), (0.05, False))):
        for p in ps:
            if uniq_prod and p.get('id') in used_prod: continue
            for u in (p.get('images') or []):
                if u in used_img or '99f4045f-af13' in u: continue   # بوستر داكن (فُحص بالعين)
                lp = local(u); f = lp and score(lp)
                if f and f >= minf: pick = (u, p.get('name'), p.get('id')); break
            if pick: break
        if pick: break
    if pick: out[cid] = pick[0]; used_img.add(pick[0]); used_prod.add(pick[2])
    print(cid, c['name'], '⇐', (pick[1] if pick else '— لا صورة مناسبة'), '|', len(ps), 'منتج')
json.dump(out, open('subthumbs.json', 'w'), ensure_ascii=False, indent=1)
print('picked', len(out))
