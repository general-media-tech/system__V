# python3 -I reorder.py dec.json — (المالك seq 366–368) ترتيب الصور:
#   الجرد: الأساسية = صورة العلبة إن وُجدت (main) ثم البوستر ثم الباقي · المتجر: البوستر أوّلاً ثم العلبة ثم الباقي
#   drop: الصورة القديمة التي وُجدت نفسها أو شبيهة بها بجودة أفضل ⇒ تُفصل عن المنتج (الملف لا يُحذف · محفوظة في التدقيق للاسترجاع)
# dec.json: {"sheet": "p/x.json", "seq": "366", "d": {"<id-prefix>": {"main": "I3", "poster": "I1", "drop": ["I0", "S0"]}}}
# يكتب p/<dec>.store.json = {inv_id: {"imgs": [...مرتّبة للمتجر], "drop": [...]}} لتطبيقه على المتجر بـ store_set.sql
import sys, os, json, time, urllib.request
U, K = os.environ['U'], os.environ['K']
H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json'}
def req(m, path, body=None, extra=None):
    h = dict(H); h.update(extra or {})
    r = urllib.request.Request(U + path, data=json.dumps(body).encode() if body is not None else None, method=m, headers=h)
    t = urllib.request.urlopen(r, timeout=60).read(); return json.loads(t) if t[:1] in (b'[', b'{') else t
dec = json.load(open(sys.argv[1])); meta = json.load(open(dec['sheet']))
store = {}
for pre, o in dec['d'].items():
    pid = next(k for k in meta if k.startswith(pre)); m = meta[pid]
    lab = lambda L: (m['I'] if L[0] == 'I' else m['S'])[int(L[1:])]
    drop = [lab(L) for L in o.get('drop', [])]
    main = lab(o['main']) if o.get('main') else None
    poster = lab(o['poster']) if o.get('poster') else None
    assert main not in drop and poster not in drop, pid
    rest = [u for u in m['I'] if u not in drop and u not in (main, poster)]
    inv = [u for u in [main, poster] if u] + rest
    inv = list(dict.fromkeys(inv))
    st = list(dict.fromkeys([u for u in [poster, main] if u] + rest))
    cur = json.loads(urllib.request.urlopen(urllib.request.Request(U + '/rest/v1/products?id=eq.%s&select=image_url,images' % pid, headers=H), timeout=60).read())[0]
    out = req('PATCH', '/rest/v1/products?id=eq.' + pid, {'image_url': inv[0], 'images': inv, 'updated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, {'Prefer': 'return=representation'})
    assert isinstance(out, list) and out, 'لم يُحفظ ' + pid
    req('POST', '/rest/v1/gmt_audit', [{'actor': 'Claude (جلسة المالك)', 'page': 'inventory', 'action': 'catalog_images', 'entity': 'products', 'entity_id': pid, 'entity_name': m['name'],
         'old_value': json.dumps({'image_url': cur.get('image_url'), 'images': cur.get('images')}, ensure_ascii=False),
         'new_value': json.dumps({'image_url': inv[0], 'images': inv, 'store_first': st[0] if st else None}, ensure_ascii=False),
         'reason': 'المالك seq %s: الصورة الأساسية القديمة تُستبدل إن وُجدت نفسها أو شبيهة بها بجودة أفضل · المتجر: البوستر أوّلاً · الجرد: صورة العلبة أساسية' % dec.get('seq', '366–368'),
         'meta': {'removed': drop, 'main': main, 'poster': poster}}], {'Prefer': 'return=minimal'})
    store[pid] = {'imgs': st, 'drop': drop}
    print(pid[:8], 'inv', len(cur.get('images') or []), '→', len(inv), '· drop', len(drop), '·', m['name'][:50])
json.dump(store, open(sys.argv[1].rsplit('.', 1)[0] + '.store.json', 'w'), ensure_ascii=False)
