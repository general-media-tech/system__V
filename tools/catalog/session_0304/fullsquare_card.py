# إعادة بناء صور الكروت: يجد الأصل لكل صورة store-card ثم يبني مربّعاً **كاملاً** (بلا قصّ): خلفية متجانسة ⇒ حشو بلونها · غير ذلك ⇒ خلفية ضبابية من الصورة نفسها
import json,os,io,sys,urllib.request,concurrent.futures as cf
import numpy as np
from PIL import Image,ImageFilter,ImageEnhance
sys.path.insert(0,'./work')
from squarify import squarify
OUT='./work/'
U,K,SU,SK=os.environ['U'],os.environ['K'],os.environ['SU'],os.environ['SK']
def get(url):
    try: return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read())).convert('RGB')
    except Exception: return None
def thumb(im): return np.asarray(im.resize((48,48))).astype(float)
def fullsquare(im,cap=1000):
    w,h=im.size; a=np.asarray(im).astype(int)
    b=max(2,int(min(w,h)*0.03))
    border=np.concatenate([a[:b].reshape(-1,3),a[-b:].reshape(-1,3),a[:,:b].reshape(-1,3),a[:,-b:].reshape(-1,3)])
    bg=np.median(border,axis=0); frac=(np.abs(border-bg).sum(axis=1)<45).mean()
    if frac>=0.86:                      # خلفية متجانسة: المنتج كاملاً على مربّع بلون الخلفية نفسها
        diff=np.abs(a-bg).sum(axis=2)>70; ys,xs=np.where(diff)
        box=(0,0,w,h) if len(ys)<60 else (int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1)
        bw,bh=box[2]-box[0],box[3]-box[1]; side=int(max(bw,bh)*1.12)
        out=Image.new('RGB',(side,side),tuple(int(x) for x in bg)); out.paste(im.crop(box),((side-bw)//2,(side-bh)//2)); mode='pad'
    else:                               # صورة/بوستر بخلفية مصوَّرة: كاملةً فوق نسخةٍ ضبابية منها تملأ المربّع
        side=max(w,h)
        bgim=im.resize((side,side) if False else (int(w*side/min(w,h)),int(h*side/min(w,h))))
        l=(bgim.width-side)//2; t=(bgim.height-side)//2
        bgim=bgim.crop((l,t,l+side,t+side)).filter(ImageFilter.GaussianBlur(side/28))
        bgim=ImageEnhance.Brightness(bgim).enhance(0.92)
        bgim.paste(im,((side-w)//2,(side-h)//2)); out=bgim; mode='blur'
    if out.width>cap: out=out.resize((cap,cap),Image.LANCZOS)
    return out,mode
if __name__=='__main__':
    st=json.loads(urllib.request.urlopen(urllib.request.Request(SU+'/rest/v1/gmt_store?id=eq.1&select=products',headers={'apikey':SK,'Authorization':'Bearer '+SK}),timeout=90).read())[0]
    todo=[p for p in st['products'] if p.get('images') and 'store-card' in p['images'][0]]
    print('cards',len(todo))
    def inv_imgs(iid):
        if not iid: return []
        try:
            r=json.loads(urllib.request.urlopen(urllib.request.Request(U+'/rest/v1/products?id=eq.%s&select=image_url,images'%iid,headers={'apikey':K,'Authorization':'Bearer '+K}),timeout=40).read())
            return [x for x in ([r[0]['image_url']]+list(r[0]['images'] or [])) if x] if r else []
        except Exception: return []
    def one(p):
        card=get(p['images'][0]);
        cands=list(dict.fromkeys([u for u in p['images'][1:] if 'store-card' not in u]+inv_imgs(p.get('inv_id'))))
        best=None
        if card:
            ct=thumb(card)
            for u in cands:
                im=get(u)
                if im is None: continue
                try: sq,_=squarify(im)
                except Exception: continue
                d=float(((thumb(sq)-ct)**2).mean())
                if best is None or d<best[0]: best=(d,u,im)
        if best is None:
            for u in cands:
                im=get(u)
                if im: best=(9e9,u,im); break
        if best is None: return (p['id'],None,None,None,None)
        d,u,im=best
        r=im.width/im.height
        if 0.9<=r<=1.11: return (p['id'],u,'asis',d,None)
        out,mode=fullsquare(im); fn=OUT+'c_'+p['id']+'.jpg'; out.save(fn,quality=90)
        return (p['id'],u,mode,d,fn)
    with cf.ThreadPoolExecutor(10) as ex: res=list(ex.map(one,todo))
    json.dump(res,open(OUT+'res.json','w'),ensure_ascii=False)
    from collections import Counter
    print(Counter(r[2] for r in res)); print('weak match',sum(1 for r in res if r[3] is not None and r[3]>400))
