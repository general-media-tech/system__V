# python3 -I home_pub.py : يبني store/home.json الخفيف من gmt_store ويرفعه (بدل SQL)
import json,os,urllib.request,datetime
U,K,SU,SK=os.environ['U'],os.environ['K'],os.environ['SU'],os.environ['SK']
r=json.loads(urllib.request.urlopen(urllib.request.Request(SU+'/rest/v1/gmt_store?id=eq.1&select=*',headers={'apikey':SK,'Authorization':'Bearer '+SK})).read())[0]
P=[]
for x in r['products']:
    y={k:v for k,v in x.items() if k not in ('specs','description','compat','alt_names','video_url','search_terms','images_hidden')}
    if isinstance(x.get('images'),list): y['images']=[u for u in x['images'] if isinstance(u,str) and not u.lower().startswith('data:')][:3]
    if isinstance(x.get('options'),list):
        y['options']=[dict(o, values=[{k:v for k,v in vv.items() if k not in ('specs','compat')} if isinstance(vv,dict) else vv for vv in o['values']]) if isinstance(o,dict) and isinstance(o.get('values'),list) else o for o in x['options']]
    P.append(y)
b={k:v for k,v in r.items() if k!='products'}; b.update(products=P,__light=True,__src_updated_at=r['updated_at'],__built_at=datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]+'Z')
d=json.dumps(b,ensure_ascii=False).encode()
q=urllib.request.Request(U+'/storage/v1/object/products-images/store/home.json',data=d,method='POST',headers={'apikey':K,'Authorization':'Bearer '+K,'x-upsert':'true','cache-control':'max-age=60','Content-Type':'application/json'})
print('home.json', urllib.request.urlopen(q).status, len(P))
