# python3 -I imgsheet.py out.jpg [storeonly.json] id1 id2 … — صفّ لكل منتج: صور الجرد I0.. (I0 = الأساسية) ثم صور المتجر الخاصة S0..
# يحفظ out.json: {id: {"name":…, "I": [urls], "S": [urls]}} لتستعمله reorder.py
import sys, os, json, io, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw
U, K = os.environ['U'], os.environ['K']
H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'User-Agent': 'Mozilla/5.0'}
out = sys.argv[1]; args = sys.argv[2:]
so = {}
if args and args[0].endswith('.json'): so = json.load(open(args[0])); args = args[1:]
def get(u, h=None):
    return urllib.request.urlopen(urllib.request.Request(u, headers=h or {'User-Agent': 'Mozilla/5.0'}), timeout=40).read()
rows, meta = [], {}
for pid in args:
    p = json.loads(get(U + '/rest/v1/products?id=like.%s*&select=id,name,image_url,images' % pid if len(pid) < 36 else U + '/rest/v1/products?id=eq.%s&select=id,name,image_url,images' % pid, H))[0]
    I = []
    for u in [p.get('image_url')] + list(p.get('images') or []):
        if u and u not in I: I.append(u)
    S = [u for u in so.get(p['id'], []) if u not in I]
    meta[p['id']] = {'name': p['name'], 'I': I, 'S': S}
    rows.append((p['id'], p['name'], [('I%d' % i, u) for i, u in enumerate(I)] + [('S%d' % i, u) for i, u in enumerate(S)]))
W = 170; cols = max(len(r[2]) for r in rows) if rows else 1
def th(u):
    try:
        im = Image.open(io.BytesIO(get(u))).convert('RGB'); im.thumbnail((W - 6, W - 24)); return im
    except Exception: return None
jobs = {u: None for r in rows for _, u in r[2]}
with ThreadPoolExecutor(12) as ex:
    for u, im in zip(jobs, ex.map(th, list(jobs))): jobs[u] = im
img = Image.new('RGB', (W * cols + 10, (W + 16) * len(rows)), 'white'); d = ImageDraw.Draw(img)
for r, (pid, name, cells) in enumerate(rows):
    y = r * (W + 16)
    d.text((4, y + 1), pid[:8], fill='blue')
    for c, (lab, u) in enumerate(cells):
        x = c * W
        if jobs.get(u): img.paste(jobs[u], (x + 3, y + 14))
        d.text((x + 4, y + W - 6), lab, fill='red' if lab == 'I0' else ('purple' if lab[0] == 'S' else 'black'))
        if lab == 'I0': d.rectangle([x + 1, y + 12, x + W - 2, y + W + 12], outline='red', width=2)
img.save(out)
json.dump(meta, open(out.rsplit('.', 1)[0] + '.json', 'w'), ensure_ascii=False)
for pid, name, cells in rows: print(pid[:8], len(cells), name)
