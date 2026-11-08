#!/usr/bin/env python3
"""TASK-0342 (المالك seq 584/587/589)
⚑ قرار المالك seq 589 «بلا ما نضغط شيء … ننقلها لغيت هوب وبس · في القاعدة للمتجر فقط البوستر (صورة أساسية لكل منتج)
   · وللجرد الصورة الأساسية الحالية — ومضغوطة ما في مشكلة»:
     – بوستر المتجر (الصورة الأولى لكل قائمة) ⇐ يبقى في Supabase كما هو
     – صورة الجرد الأساسية (products.image_url) ⇐ تبقى في Supabase وتُضغط في مكانها (--shrink-main)
     – كلّ ما سواهما (صور المعرض) ⇐ GitHub **بلا ضغط** (نسخة طبق الأصل)
⚑ seq 590 «اعتمد الحلّ الأفضل أنت»: البوستر هو أكثر صورة تُحمَّل (كلّ بطاقة في المتجر) ⇒ المتجر يعرضه من نسخته على GitHub
   (بلا ضغط) وأصله يبقى في Supabase أرشيفاً لا يُحذف — فلا يمسّ المتجر حصّة القاعدة إطلاقاً.
   صورة الجرد الأساسية وحدها تبقى معروضة من Supabase (للموظّفين · محفوظة على أجهزتهم) ومضغوطة في مكانها.

نقل صور المنتجات من تخزين Supabase إلى استضافة GitHub Pages (مجلّد img/p في المستودع) مع ضغطها،
ثمّ إعادة كتابة روابطها في الجرد (products.image_url/images) والمتجر (gmt_store: صور القوائم وقيم الخيارات).

  • التصغير: أطول ضلع 1600 · JPEG بجودة 85 (PNG يبقى PNG مُحسَّناً) — نفس المسار والامتداد ⇒ رابطٌ ثابت يمكن التنبّؤ به
  • الأصل لا يُحذف من Supabase (أرشيف) · كلّ تعديل على الروابط يُنسخ قبله في gmt_audit / gmt_catalog_backup
  • لا أسرار هنا: المفاتيح من متغيّرات البيئة (MAIN_URL MAIN_KEY STORE_URL STORE_KEY)

  python3 -I tools/img_migrate.py            # تجربة: يحصي ويضغط في img/p بلا أيّ كتابة على القواعد
  python3 -I tools/img_migrate.py --apply    # بعد دفع img/ ونشره: يعيد كتابة الروابط
  python3 -I tools/img_migrate.py --apply --shrink-main   # + ضغط صورة الجرد الأساسية في مكانها
يُعاد تشغيله دورياً: ما نُقل سابقاً يُتخطّى، وما رُفع حديثاً يُنقل.
"""
import io, json, os, re, sys, urllib.request, urllib.parse
from PIL import Image

PAGES = 'https://general-media-tech.github.io/system__V/img/p/'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'p')
MAX_SIDE, Q = 1600, 85
PAT = re.compile(r'^https://ysawzwtmodkqqbqoiojj\.supabase\.co/storage/v1/object/public/products-images/(.+)$')

def env(k):
    v = os.environ.get(k)
    if not v: sys.exit('ناقص: ' + k)
    return v

def rq(base, key, m, p, body=None, prefer=None):
    h = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}
    if prefer: h['Prefer'] = prefer
    r = urllib.request.Request(base + p, data=json.dumps(body).encode() if body is not None else None, method=m, headers=h)
    with urllib.request.urlopen(r, timeout=120) as x:
        t = x.read(); return json.loads(t) if t[:1] in (b'[', b'{') else t

def shrink(data, ext):
    im = Image.open(io.BytesIO(data)); im.load()
    w, h = im.size; k = min(1.0, MAX_SIDE / max(w, h))
    if k < 1: im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
    out = io.BytesIO()
    if ext == 'png':
        im.save(out, 'PNG', optimize=True)
    elif ext == 'webp':
        im.save(out, 'WEBP', quality=Q, method=6)
    else:
        if im.mode not in ('RGB', 'L'): im = im.convert('RGB')
        im.save(out, 'JPEG', quality=Q, optimize=True, progressive=True)
    b = out.getvalue()
    return b if len(b) < len(data) else data

def main():
    apply = '--apply' in sys.argv
    shrink_main = '--shrink-main' in sys.argv
    MU, MK, SU, SK = env('MAIN_URL'), env('MAIN_KEY'), env('STORE_URL'), env('STORE_KEY')
    prods, off = [], 0
    while True:
        page = rq(MU, MK, 'GET', '/rest/v1/products?select=id,name,image_url,images&order=id&limit=1000&offset=%d' % off)
        prods += page; off += 1000
        if len(page) < 1000: break
    store = rq(SU, SK, 'GET', '/rest/v1/gmt_store?id=eq.1&select=id,updated_at,products')[0]
    urls = set()
    def add(u):
        if isinstance(u, str) and PAT.match(u) and not u.lower().endswith('.json'): urls.add(u)
    for p in prods:
        add(p.get('image_url')); [add(u) for u in (p.get('images') or [])]
    for sp in store.get('products') or []:
        [add(u) for u in (sp.get('images') or [])]; add(sp.get('image'))
        for o in sp.get('options') or []:
            for v in (o.get('values') or []) if isinstance(o, dict) else []:
                if isinstance(v, dict): add(v.get('image')); add(v.get('image_url'))
    store_urls = set()
    for sp in store.get('products') or []:
        for u in (sp.get('images') or []):
            if isinstance(u, str): store_urls.add(u)
    mains = {p.get('image_url') for p in prods if isinstance(p.get('image_url'), str)}
    keep = mains - store_urls   # تبقى معروضة من Supabase: صورة الجرد الأساسية التي لا يعرضها المتجر
    mp, before, after, fail = {}, 0, 0, []
    for u in sorted(urls - keep):
        rel = urllib.parse.unquote(PAT.match(u).group(1).split('?')[0])
        dst = os.path.join(ROOT, rel); ext = rel.rsplit('.', 1)[-1].lower() if '.' in rel else 'jpg'
        if not os.path.exists(dst):
            try:
                with urllib.request.urlopen(u, timeout=120) as x: data = x.read()
                b = data; before += len(data); after += len(b)   # seq 589: بلا ضغط
                os.makedirs(os.path.dirname(dst), exist_ok=True); open(dst, 'wb').write(b)
            except Exception as e:
                fail.append((u, str(e)[:80])); continue
        mp[u] = PAGES + urllib.parse.quote(rel)
    if shrink_main and apply:   # صورة الجرد الأساسية: تُضغط في مكانها (نفس الرابط) + تخزين 30 يوماً
        done = 0
        for u in sorted(mains & urls):
            try:
                with urllib.request.urlopen(u, timeout=120) as x: data = x.read()
                rel = PAT.match(u).group(1).split('?')[0]; ext = rel.rsplit('.', 1)[-1].lower()
                b = shrink(data, ext)
                if len(b) < len(data) * 0.9:
                    ct = 'image/png' if ext == 'png' else 'image/webp' if ext == 'webp' else 'image/jpeg'
                    r = urllib.request.Request(MU + '/storage/v1/object/products-images/' + rel, data=b, method='PUT',
                        headers={'apikey': MK, 'Authorization': 'Bearer ' + MK, 'Content-Type': ct, 'cache-control': 'max-age=2592000', 'x-upsert': 'true'})
                    urllib.request.urlopen(r, timeout=120).read(); done += 1
            except Exception as e:
                fail.append((u, 'main: ' + str(e)[:60]))
        print(json.dumps({'main_images_shrunk_in_place': done}, ensure_ascii=False))
    print(json.dumps({'images': len(urls), 'kept_in_supabase': len(urls & keep), 'to_github': len(mp), 'failed': len(fail), 'MB_before': round(before / 1048576, 1), 'MB_after': round(after / 1048576, 1)}, ensure_ascii=False))
    for f in fail[:10]: print('fail', f)
    if not apply: return
    # الجرد
    n = 0
    for p in prods:
        im = p.get('image_url'); ims = p.get('images') or []
        nim = im   # صورة الجرد الأساسية: رابطها لا يتغيّر (تبقى في Supabase)
        nims = [mp.get(u, u) for u in ims]
        if nim != im or nims != ims:
            rq(MU, MK, 'POST', '/rest/v1/gmt_audit', {'actor': 'Claude (جلسة المالك)', 'page': 'tools', 'action': 'img_migrate', 'entity': 'products', 'entity_id': str(p['id']), 'entity_name': p.get('name'),
                'field': 'image_url,images', 'old_value': json.dumps({'image_url': im, 'images': ims}, ensure_ascii=False), 'reason': 'المالك seq 584/587: الصور إلى استضافة GitHub مضغوطة'}, 'return=minimal')
            rq(MU, MK, 'PATCH', '/rest/v1/products?id=eq.' + str(p['id']), {'image_url': nim, 'images': nims}, 'return=minimal'); n += 1
    # المتجر (نسخة كاملة قبل الكتابة · بشرط updated_at)
    rq(MU, MK, 'POST', '/rest/v1/gmt_catalog_backup', {'source': 'store', 'reason': 'قبل نقل الصور إلى GitHub (seq 587)', 'rows_count': len(store.get('products') or []), 'data': store}, 'return=minimal')
    def fx(u): return mp.get(u, u) if isinstance(u, str) else u
    nl = []
    for sp in store.get('products') or []:
        x = dict(sp)
        if isinstance(x.get('images'), list): x['images'] = [fx(u) for u in x['images']]
        if 'image' in x: x['image'] = fx(x['image'])
        if isinstance(x.get('options'), list):
            x['options'] = [dict(o, values=[(dict(v, **{k: fx(v[k]) for k in ('image', 'image_url') if k in v}) if isinstance(v, dict) else v) for v in (o.get('values') or [])]) if isinstance(o, dict) and isinstance(o.get('values'), list) else o for o in x['options']]
        nl.append(x)
    q = '/rest/v1/gmt_store?id=eq.1&updated_at=eq.' + urllib.parse.quote(store['updated_at'])
    r = rq(SU, SK, 'PATCH', q, {'products': nl, 'updated_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z'}, 'return=representation')
    print(json.dumps({'products_rewritten': n, 'store_written': bool(r)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
