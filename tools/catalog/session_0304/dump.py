# python3 -I dump.py <category_id>  → sec_<cat>.json : store listing + inventory row merged
import json,os,sys,urllib.request
U,K,SU,SK=os.environ['U'],os.environ['K'],os.environ['SU'],os.environ['SK']
def g(url,k): return json.loads(urllib.request.urlopen(urllib.request.Request(url,headers={'apikey':k,'Authorization':'Bearer '+k}),timeout=60).read())
st=g(SU+'/rest/v1/gmt_store?id=eq.1&select=products',SK)[0]['products']
cat=sys.argv[1]
L=[x for x in st if x.get('category_id')==cat or cat in (x.get('category_ids') or [])]
ids=[x['inv_id'] for x in L if x.get('inv_id')]
inv={}
for i in range(0,len(ids),40):
    for p in g(U+'/rest/v1/products?select=*&id=in.('+','.join(ids[i:i+40])+')',K): inv[p['id']]=p
out=[]
for x in L:
    p=inv.get(x.get('inv_id')) or {}
    sp=p.get('specs') if isinstance(p.get('specs'),dict) else {}
    out.append({'sid':x['id'],'inv':x.get('inv_id'),'name':x.get('name'),'iname':p.get('name'),'simgs':x.get('images') or [],'iimgs':list(dict.fromkeys([u for u in [p.get('image_url')]+(p.get('images') or []) if u])),
      'sdesc':x.get('description') or '','idesc':sp.get('__desc') or '','sspecs':len(x.get('specs') or []),'ispecs':len([k for k in sp if not k.startswith('__')]),
      'compat':p.get('compat') or x.get('compat') or '','alt':p.get('alt_names') or '','cat_sub':p.get('cat_sub'),'price':x.get('price'),'stock':x.get('stock')})
json.dump(out,open('sec_%s.json'%cat,'w'),ensure_ascii=False,indent=0)
for o in out:
    fl=[]
    if len(o['simgs'])<3: fl.append('img%d'%len(o['simgs']))
    if len(o['sdesc'])<40 and len(o['idesc'])<40: fl.append('desc')
    if max(o['sspecs'],o['ispecs'])<3: fl.append('spec')
    if not o['compat']: fl.append('compat')
    if not o['alt']: fl.append('alt')
    print(o['inv'][:8] if o['inv'] else '--------', (o['name'] or '')[:45].ljust(45), len(o['simgs']), ' '.join(fl))
print(len(out))
