# python3 -I cmp.py out.jpg "ourimg|query" ... — صفّ لكل منتج: صورتنا ثم أوّل 4 نتائج أمازون (asin تحتها)
import sys,json,subprocess,urllib.request,io
from PIL import Image, ImageDraw
C='/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/cat'
out=sys.argv[1]; rows=sys.argv[2:]; W=180
img=Image.new('RGB',(W*5,W*len(rows)),'white'); d=ImageDraw.Draw(img)
def load(u):
    if u.startswith('/'): return Image.open(u)
    return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read()))
res={}
for r,row in enumerate(rows):
    ours,q=row.split('|',1)
    try:
        im=load(ours).convert('RGB'); im.thumbnail((W-6,W-20)); img.paste(im,(3,r*W+3))
    except Exception as e: pass
    d.text((4,r*W+W-15),'OURS',fill='blue')
    try: rs=json.loads(subprocess.run(['timeout','150','node',f'{C}/amz.js','search',q],capture_output=True,text=True).stdout)[:4]
    except Exception: rs=[]
    res[q]=[(x['asin'],x['t'][:80]) for x in rs]
    for c,x in enumerate(rs):
        try:
            im=load(x['img']).convert('RGB'); im.thumbnail((W-6,W-20)); img.paste(im,((c+1)*W+3,r*W+3))
        except Exception: pass
        d.text(((c+1)*W+4,r*W+W-15),x['asin'],fill='red')
img.save(out); print(json.dumps(res,ensure_ascii=False,indent=0))
