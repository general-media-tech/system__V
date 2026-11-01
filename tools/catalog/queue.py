# python3 -I queue.py [n] — المنتجات المُراجَعة (catalog_enrich) التي لم يُرتَّب بعد صورها (catalog_images) بترتيب أوّل مراجعة
import os, sys, json, urllib.request
U, K = os.environ['U'], os.environ['K']; H = {'apikey': K, 'Authorization': 'Bearer ' + K}
def g(p): return json.loads(urllib.request.urlopen(urllib.request.Request(U + p, headers=H), timeout=60).read())
rows = []
for off in range(0, 5000, 1000):
    r = g('/rest/v1/gmt_audit?action=in.(catalog_enrich,catalog_images)&select=entity_id,action,created_at&order=created_at.asc&limit=1000&offset=%d' % off)
    rows += r
    if len(r) < 1000: break
first, done = {}, set()
for r in rows:
    if r['action'] == 'catalog_images': done.add(r['entity_id'])
    else: first.setdefault(r['entity_id'], r['created_at'])
q = [i for i in sorted(first, key=first.get) if i not in done]
print(len(q), 'pending', file=sys.stderr)
print(' '.join(q[:int(sys.argv[1]) if len(sys.argv) > 1 else 10]))
