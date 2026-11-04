import json,os,io,sys,urllib.request,concurrent.futures as cf
import numpy as np
from PIL import Image,ImageFilter
S='./'   # مجلّد العمل (يحوي nonsq.json وتُحفظ o_<id>.jpg)
def squarify(im, cap=1000):
    im=im.convert('RGB'); w,h=im.size
    a=np.asarray(im).astype(int)
    b=max(2,int(min(w,h)*0.03))
    border=np.concatenate([a[:b].reshape(-1,3),a[-b:].reshape(-1,3),a[:,:b].reshape(-1,3),a[:,-b:].reshape(-1,3)])
    bg=np.median(border,axis=0); frac=(np.abs(border-bg).sum(axis=1)<45).mean()
    if frac>=0.86:
        diff=np.abs(a-bg).sum(axis=2)>70
        ys,xs=np.where(diff)
        box=(0,0,w,h) if len(ys)<60 else (int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1)
        bw,bh=box[2]-box[0],box[3]-box[1]
        side=int(max(bw,bh)*1.14)
        out=Image.new('RGB',(side,side),tuple(int(x) for x in bg))
        out.paste(im.crop(box),((side-bw)//2,(side-bh)//2)); mode='bg'
    else:
        g=im.convert('L').filter(ImageFilter.FIND_EDGES); ga=np.asarray(g).astype(float)
        tot=ga.sum()+1e-6; ys,xs=np.mgrid[0:h,0:w]
        cx=(ga*xs).sum()/tot; cy=(ga*ys).sum()/tot
        side=min(w,h)
        l=int(min(max(cx-side/2,0),w-side)); t=int(min(max(cy-side/2,0),h-side))
        out=im.crop((l,t,l+side,t+side)); mode='crop'
    if out.width>cap: out=out.resize((cap,cap),Image.LANCZOS)
    return out,mode
if __name__=='__main__':
    SU,SK=os.environ['SU'],os.environ['SK']
    st=json.loads(urllib.request.urlopen(urllib.request.Request(SU+'/rest/v1/gmt_store?id=eq.1&select=products',headers={'apikey':SK,'Authorization':'Bearer '+SK}),timeout=90).read())[0]
    byid={p['id']:p for p in st['products']}
    bad=json.load(open(S+'nonsq.json'))
    def one(r):
        pid=r[0]; u=byid[pid]['images'][0]
        d=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read()
        im=Image.open(io.BytesIO(d)); out,mode=squarify(im)
        fn=S+'o_'+pid+'.jpg'; out.save(fn,quality=90); return pid,mode,im.size
    with cf.ThreadPoolExecutor(8) as ex: res=list(ex.map(one,bad))
    json.dump(res,open(S+'sq_done.json','w'))
    from collections import Counter; print(Counter(r[1] for r in res),len(res))
