# python3 papply.py seq "source" pfx:idx,idx ...   (يحلّ المعرّف الكامل من البادئة)
import json,sys,os,subprocess,glob,urllib.request
R='./work/'
U=os.environ['U'];K=os.environ['K']
seq,src=sys.argv[1],sys.argv[2]
for arg in sys.argv[3:]:
    pp=arg.split(':',2); k,idx=pp[0],pp[1]; extra=pp[2] if len(pp)>2 else None
    r=json.loads(urllib.request.urlopen(urllib.request.Request(U+'/rest/v1/products?select=id&id=gte.%s-0000-0000-0000-000000000000&id=lte.%s-ffff-ffff-ffff-ffffffffffff'%(k,k),headers={'apikey':K,'Authorization':'Bearer '+K})).read())
    assert len(r)==1,(k,r)
    imgs=[]
    for n in idx.split(','):
        f=glob.glob(R+('t_%simg/%02d.*'%(k,int(n[1:])) if n.startswith('t') else 'b_%simg/%02d.*'%(k,int(n))))
        if f: imgs.append(f[0])
    job={'id':r[0]['id'],'imgs':imgs,'more':True,'seq':seq,'source':src}
    if extra:
        ex=json.loads(extra); fx=ex.pop('__fix',None)
        if ex: job['specs']=ex
        if fx: job['fix']=fx
    p=R+'j_%s.json'%k; json.dump(job,open(p,'w'),ensure_ascii=False)
    print(k, subprocess.run(['python3','-I','/home/user/system__V/tools/catalog/apply.py',p],capture_output=True,text=True).stdout.strip()[:170])
