# python3 -I apply.py <job.json>
# job: {"id": pid, "imgs": [paths…], "specs": {k: v} (يُضاف الناقص فقط · __desc يُستبدل إن كان أقصر), "alt": [names], "compat": "…",
#       "source": "…", "seq": "340/343", "set_main": bool}
# يرفع الصور إلى products-images/catalog/<pid>/<n>.<ext> ثمّ يكتب المنتج (الصور تُلحق بعد الموجودة · لا حذف) + سطر تدقيق.
import sys, os, json, urllib.request, time, hashlib, re
U, K = os.environ['U'], os.environ['K']
H = {'apikey': K, 'Authorization': 'Bearer ' + K}
def req(method, path, body=None, headers=None, raw=None):
    h = dict(H); h.update(headers or {})
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    if body is not None and raw is None: h['Content-Type'] = 'application/json'
    r = urllib.request.Request(U + path, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=60) as x:
        t = x.read(); return json.loads(t) if t[:1] in (b'[', b'{') else t
job = json.load(open(sys.argv[1]))
pid = job['id']
p = req('GET', '/rest/v1/products?id=eq.%s&select=id,name,image_url,images,specs,alt_names,compat,specs_source' % pid)[0]
cur = []
for u in [p.get('image_url')] + list(p.get('images') or []):
    if u and u not in cur: cur.append(u)
new = []
# (المالك seq 347) لا تكثير: 4 صور فأكثر ⇒ لا إضافة · الناقص يُكمَّل حتى 6 فقط
room = 0 if len(cur) >= 4 else max(0, 6 - len(cur))
for f in job.get('imgs', [])[:room]:
    b = open(f, 'rb').read(); ext = 'png' if f.endswith('.png') else 'jpg'
    path = 'catalog/%s/%s.%s' % (pid, hashlib.md5(b).hexdigest()[:12], ext)
    req('POST', '/storage/v1/object/products-images/' + path, raw=b, headers={'Content-Type': 'image/png' if ext == 'png' else 'image/jpeg', 'x-upsert': 'true'})
    url = U + '/storage/v1/object/public/products-images/' + path
    if url not in cur and url not in new: new.append(url)
imgs = cur + new
patch = {'images': imgs, 'updated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
if not p.get('image_url') and imgs: patch['image_url'] = imgs[0]
if job.get('set_main') and new: patch['image_url'] = new[0]; patch['images'] = new + [u for u in cur if u not in new]
sp = p.get('specs') or {}
if isinstance(sp, str):
    try: sp = json.loads(sp)
    except Exception: sp = {}
added = []
for k, v in (job.get('specs') or {}).items():
    if not v: continue
    if k == '__desc':
        if len(str(sp.get('__desc') or '')) < len(v): sp['__desc'] = v; added.append(k)
    elif k not in sp or not str(sp.get(k) or '').strip(): sp[k] = v; added.append(k)
# (المالك seq 248/226) تصحيح خطأ مثبت بمصدر: fix={k: v} يستبدل القيمة · drop=[k] يحذف تخميناً «(تقريبي)» — القديم يُحفظ في التدقيق
# (seq 347) لا يُستعمل أبداً لتغيير الواط/القدرة المكتوبة
fixed, dropped = {}, {}
for k, v in (job.get('fix') or {}).items():
    if re.search(r'واط|القدرة|الاستطاعة|watt', k, re.I): continue
    if sp.get(k) != v: fixed[k] = sp.get(k); sp[k] = v
for k in (job.get('drop') or []):
    if k in sp and not re.search(r'واط|القدرة|الاستطاعة|watt', k, re.I): dropped[k] = sp.pop(k)
if fixed or dropped: added += ['fix:' + k for k in fixed] + ['drop:' + k for k in dropped]
if added:
    patch['specs'] = sp
    if job.get('source'): patch['specs_source'] = job['source'] if not p.get('specs_source') else (p['specs_source'] + ' + ' + job['source'])[:500]
alt = [a.strip() for a in (p.get('alt_names') or '').split('،') if a.strip()]
low = [a.lower() for a in alt]
addalt = [a for a in job.get('alt', []) if a.strip() and a.strip().lower() not in low and a.strip().lower() != p['name'].lower()]
if addalt: patch['alt_names'] = '، '.join(alt + addalt)
if job.get('compat') and not (p.get('compat') or '').strip(): patch['compat'] = job['compat']
out = req('PATCH', '/rest/v1/products?id=eq.' + pid, patch, headers={'Prefer': 'return=representation'})
assert isinstance(out, list) and out, 'لم يُحفظ'
req('POST', '/rest/v1/gmt_audit', [{'actor': 'Claude (جلسة المالك)', 'page': 'inventory', 'action': 'catalog_enrich', 'entity': 'products', 'entity_id': pid,
     'entity_name': p['name'], 'new_value': json.dumps({'images_added': len(new), 'specs_added': added, 'alt_added': addalt}, ensure_ascii=False),
     'reason': 'المالك seq %s: مراجعة المنتجات منتجاً منتجاً — صور وبوسترات وشرح ومواصفات وأسماء بديلة وتوافقيات من أمازون/علي بابا/الإنترنت · المصدر: %s' % (job.get('seq', '340/343'), job.get('source', '')),
     'meta': {'images': new, 'old_values': fixed, 'dropped': dropped}}], headers={'Prefer': 'return=minimal'})
print(json.dumps({'name': p['name'], 'images_before': len(cur), 'images_added': len(new), 'specs_added': added, 'alt_added': len(addalt)}, ensure_ascii=False))
