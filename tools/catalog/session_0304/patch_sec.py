# python3 -I patch_sec.py <cat_id>[,<cat_id>] [move:<inv8>=<cat_id> ...] : section sync (images rank, desc, specs, compat, alt) + drop listings whose inventory row is gone
import json,os,sys,urllib.request,datetime
U,K,SU,SK=os.environ['U'],os.environ['K'],os.environ['SU'],os.environ['SK']
def rq(url,k,method='GET',body=None,h=None):
    hh={'apikey':k,'Authorization':'Bearer '+k}; hh.update(h or {})
    d=json.dumps(body).encode() if body is not None else None
    if d: hh['Content-Type']='application/json'
    return json.loads(urllib.request.urlopen(urllib.request.Request(url,data=d,method=method,headers=hh),timeout=90).read() or b'null')
cats=sys.argv[1].split(','); moves=dict(a[5:].split('=') for a in sys.argv[2:] if a.startswith('move:'))
firsts={a[6:].split('=')[0]:int(a[6:].split('=')[1]) for a in sys.argv[2:] if a.startswith('first:')}
names=set(sum([a[5:].split(',') for a in sys.argv[2:] if a.startswith('name:')],[]))
st=rq(SU+'/rest/v1/gmt_store?id=eq.1&select=products,updated_at',SK)[0]
aud=rq(U+'/rest/v1/gmt_audit?select=entity_id,action,meta&action=in.(catalog_fix_image,catalog_enrich)&limit=10000',K)
rm=set(a['meta']['removed_image'] for a in aud if a['action']=='catalog_fix_image' and a.get('meta') and a['meta'].get('removed_image'))
dropped={}
for a in aud:
    if a['action']=='catalog_enrich' and a.get('meta') and isinstance(a['meta'].get('dropped'),dict): dropped.setdefault(a['entity_id'],set()).update(a['meta']['dropped'].keys())
def rank(u): return 2 if ('/products-images/products/' in u or '/img/products/owner/' in u) else (1 if '/img/products/shixin' in u else 0)
L=[x for x in st['products'] if x.get('category_id') in cats]
ids=[x['inv_id'] for x in L if x.get('inv_id')]
inv={}
for i in range(0,len(ids),40):
    for p in rq(U+'/rest/v1/products?select=*&id=in.('+','.join(ids[i:i+40])+')',K): inv[p['id']]=p
keep=[];gone=[];n=0
for x in st['products']:
    if x.get('category_id') in cats and x.get('inv_id') and x['inv_id'] not in inv: gone.append(x['name']); continue
    if x.get('category_id') in cats and x.get('inv_id') in inv:
        p=inv[x['inv_id']]; sp=p['specs'] if isinstance(p['specs'],dict) else {}
        allu=[]
        for u in (x.get('images') or [])+[p['image_url']]+(p['images'] or []):
            if u and u not in allu and u not in rm and not u.startswith('data:'): allu.append(u)
        x['images']=sorted(allu,key=lambda u:(rank(u),allu.index(u)))[:7]
        fi=firsts.get(x['inv_id'][:8])
        if fi is not None and fi<len(x['images']): x['images'].insert(0,x['images'].pop(fi))
        if len(sp.get('__desc') or '')>len(x.get('description') or ''): x['description']=sp['__desc']
        dl=dropped.get(p['id'],set())
        old=[e for e in (x.get('specs') or []) if isinstance(e,dict) and 'تقريبي' not in str(e.get('value','')) and not (e.get('label') in dl and e.get('label') not in sp)]
        labs={e.get('label') for e in old}
        for e in old:
            if e.get('label') in sp and sp[e['label']] and 'تقريبي' not in str(sp[e['label']]): e['value']=str(sp[e['label']])
        for k2,v in sp.items():
            if not k2.startswith('__') and v and k2 not in labs and 'تقريبي' not in str(v) and isinstance(v,(str,int,float)): old.append({'label':k2,'value':str(v)})
        x['specs']=old
        if p.get('compat') and not x.get('options'): x['compat']=p['compat']
        if p.get('alt_names'): x['alt_names']=p['alt_names']
        if x['inv_id'][:8] in names:
            x['name']=p['name']
            if 'short_name' in x: x['short_name']=p['name']   # (seq 465) بطاقات المتجر تعرض short_name
        if x['inv_id'][:8] in moves: x['category_id']=moves[x['inv_id'][:8]]; x['category_ids']=[x['category_id']]
        n+=1
    keep.append(x)
ua=datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%S.%f+00:00')
r=rq(SU+'/rest/v1/gmt_store?id=eq.1&updated_at=eq.'+st['updated_at'].replace('+','%2B'),SK,'PATCH',{'products':keep,'updated_at':ua},{'Prefer':'return=representation'})
print('synced',n,'removed',gone,'total',len(keep),'ok' if r and r[0].get('id')==1 else r)
