# python3 -I sheet.py <outdir> <sheet.jpg> url1 url2 ...  — ينزّل الصور (مرقّمة) ويصنع لوحة تلامس للمراجعة البصرية
import sys, os, io, urllib.request
from PIL import Image, ImageDraw
out, sheet, urls = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(out, exist_ok=True)
thumbs = []
for i, u in enumerate(urls):
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        b = urllib.request.urlopen(req, timeout=40).read()
        im = Image.open(io.BytesIO(b)); im.load()
        ext = 'png' if (im.format or '').upper() == 'PNG' else 'jpg'
        fn = os.path.join(out, '%02d.%s' % (i, ext))
        if ext == 'jpg' and im.mode not in ('RGB', 'L'): im = im.convert('RGB')
        if ext == 'jpg': im.save(fn, 'JPEG', quality=90)
        else: im.save(fn, 'PNG')
        t = im.convert('RGB'); t.thumbnail((300, 300)); thumbs.append((i, t, im.size))
        print(i, im.size, fn)
    except Exception as e:
        print(i, 'ERR', e)
if thumbs:
    cols = 4; rows = (len(thumbs) + cols - 1) // cols
    S = Image.new('RGB', (cols * 310, rows * 330), 'white'); d = ImageDraw.Draw(S)
    for k, (i, t, sz) in enumerate(thumbs):
        x, y = (k % cols) * 310 + 5, (k // cols) * 330 + 5
        S.paste(t, (x, y)); d.text((x, y + 305), '#%d %dx%d' % (i, sz[0], sz[1]), fill='red')
    S.save(sheet, 'JPEG', quality=80)
