# (TASK-B0381 · المالك seq B671) تطبيق: الحقائب كلّها في «كلّ الحقائب» · «إضاءة دائرية» · «تصوير المنتجات» · ترتيب المتشابهات جنب بعض
# يُشغَّل مرّة (طُبِّق 14 ت2) — المفاتيح من البيئة U/K/SU/SK · نسخة احتياطية في gmt_trash قبل الكتابة · الكتابة مشروطة بـ updated_at
import json,os,sys,re,copy,urllib.request,datetime
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..')); import order_similar as fam
U,K,SU,SK=os.environ['U'],os.environ['K'],os.environ['SU'],os.environ['SK']
H=lambda k,e={}:dict({'apikey':k,'Authorization':'Bearer '+k},**e)
rec=json.loads(urllib.request.urlopen(urllib.request.Request(SU+'/rest/v1/gmt_store?id=eq.1&select=*',headers=H(SK))).read())[0]
orig=copy.deepcopy(rec)
P=rec['products']; C=rec['categories']; byname=lambda rx:[p for p in P if re.search(rx,p.get('name',''),re.I)]
def ids(p): 
    v=p.get('category_ids') or ([p['category_id']] if p.get('category_id') else []); return list(v)
def setids(p,v):
    v=[x for i,x in enumerate(v) if x not in v[:i]]; p['category_ids']=v; p['category_id']=v[0] if v else None
    co=p.get('category_orders') or {}; p['category_orders']={k:co[k] for k in co if k in v}
def add(p,c):
    v=ids(p)
    if c not in v: v.append(c); setids(p,v)
def rem(p,c):
    v=ids(p)
    if c in v and len(v)>1: v.remove(c); setids(p,v)
def one(rx):
    L=byname(rx); assert len(L)==1,(rx,[x['name'] for x in L]); return L[0]
log=[]
# ① إضاءة دائرية (القسم h4_3 «رينغ لايت» يصير «إضاءة دائرية»)
cat=next(c for c in C if c['id']=='h4_3'); cat['name']='إضاءة دائرية'
for rx in [r'E30 RGB حامل تصوير',r'^BD-300D حامل',r'^BD-300D RGB']: rem(one(rx),'h4_3')
ring=[r'RING LIGHT JM16-6',r'دائرية 10 إنش',r'دائرية 6 إنش',r'ماغ سيف دائرية',r'Mobet:M666',r'سوفت لايت دائري مع ريمونت Fc_666',r'HONGDAK HD-130',r'RF-550D فلاش ماكرو حلقي',r'^STAND FOR Ring Light']
ringP=[one(rx) for rx in ring]
for p in ringP: add(p,'h4_3')
# ② تصوير المنتجات (h14_5): بوكسات · حوامل · أذرع مائلة · خلفيات
photo=[r'E30 RGB حامل تصوير',r'^BD-300D حامل',r'^BD-300D RGB',r'^صندوق تصوير 25cm',r'^صندوق تصوير 40cm',r'^صندوق تصوير 60cm',r'Portable Photography Tabletop',r'BFT-02B',r'VocalStents',r'ذراع تعليق أفقي',r'4.5 inch Magic Arm',r'خلفية تصوير قطن',r'حامل خلفية للتصوير',r'كروما مجموعة كاملة']
photoP=[one(rx) for rx in photo]
for p in photoP: add(p,'h14_5')
# ③ كلّ الحقائب: كلّ حقيبة في h12 مباشرة · يُلغى الفرعان المكرِّران (h12_1 · h12_2)
bagRx=r'حقيب|شنت|سامسونايت|^حافظة (جيمبال|Sunnylife)'
bags=[p for p in P if re.search(bagRx,p.get('name','')) and not re.search(r'Fly More|كومبو|Combo',p.get('name',''))]
equip=[one(r'حقيبة حمل 120x38x43'),one(r'حقيبة ستاند 83x8x8')]
for p in equip: rem(p,'h9_4'); add(p,'h3_5')
add(one(r'^حافظة Sunnylife'),'h8_5')
def oldpos(p):
    co=p.get('category_orders') or {}
    if 'h12_1' in co: return (0,co['h12_1'])
    if p in equip: return (1,0)
    if re.search(r'^حافظة جيمبال',p.get('name','')): return (0.5,0)
    if 'h12_2' in co: return (2,co['h12_2'])
    return (2,999)
bagsSorted=sorted(bags,key=oldpos)
for p in bags:
    v=[('h12' if x in ('h12_1','h12_2') else x) for x in ids(p)]
    if 'h12' not in v: v.append('h12')
    setids(p,v)
for i,p in enumerate(bagsSorted): p.setdefault('category_orders',{})['h12']=i
rec['categories']=[c for c in C if c['id'] not in ('h12_1','h12_2')]
assert not any(x in ('h12_1','h12_2') for p in P for x in ids(p))
# ترتيب صريح للقسمين الجديدين
for i,p in enumerate(ringP): p['category_orders']['h4_3']=i
for i,p in enumerate(photoP): p['category_orders']['h14_5']=i
# ④ المتشابهات جنب بعض في كلّ قسم
changed=[]
for c in rec['categories']:
    cid=c['id']
    L=sorted([p for p in P if cid in ids(p)],key=lambda p:((p.get('category_orders') or {}).get(cid, p.get('order',0))))
    if not L: continue
    R=fam.reorder(L,cid) if cid not in ('h4_3','h14_5') else L
    if [p['id'] for p in R]!=[p['id'] for p in L] or any((p.get('category_orders') or {}).get(cid)!=i for i,p in enumerate(R)):
        changed.append(cid)
    for i,p in enumerate(R): p.setdefault('category_orders',{})[cid]=i
# «كلّ الحقائب» = حقائب الكاميرا (بترتيبها الجديد) ⇐ حافظة الجيمبال ⇐ حقائب المعدّات ⇐ حقائب الدرون (بترتيبها الجديد) ⇐ الباقي
def ordered(cid): return sorted([p for p in P if cid in ids(p)],key=lambda p:p['category_orders'][cid])
_c=[p for p in ordered('h9_4') if not re.search(r'^حافظة جيمبال',p['name'])]+[one(r'^حافظة جيمبال')]
for i,p in enumerate(_c): p['category_orders']['h9_4']=i
seq=[p for p in ordered('h9_4') if not re.search(r'^حافظة جيمبال',p['name'])]+[one(r'^حافظة جيمبال')]+equip+ordered('h8_5')
seq=[p for i,p in enumerate(seq) if p in bags and p not in seq[:i]]; seq+=[p for p in bags if p not in seq]
for i,p in enumerate(seq): p['category_orders']['h12']=i
print('bags',len(bags),'ring',len(ringP),'photo',len(photoP),'orders rewritten',len(changed))
if '--go' not in sys.argv: json.dump(rec,open(os.path.join(fam.D,'preview.json'),'w'),ensure_ascii=False); sys.exit(0)
# نسخة احتياطية ثمّ كتابة مشروطة
bk={'tbl':'gmt_store','db':'store','row_id':'1','label':'(seq B671 · TASK-B0381) قبل: الحقائب · إضاءة دائرية · تصوير المنتجات · ترتيب المتشابهات','data':orig,'deleted_by':'claude B0381','page':'sim/apply.py'}
r=urllib.request.urlopen(urllib.request.Request(U+'/rest/v1/gmt_trash',data=json.dumps(bk).encode(),method='POST',headers=H(K,{'Content-Type':'application/json','Prefer':'return=minimal'}))); print('backup',r.status)
now=datetime.datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]+'Z'
body={'categories':rec['categories'],'products':P,'updated_at':now}
q=urllib.request.Request(SU+'/rest/v1/gmt_store?id=eq.1&updated_at=eq.'+urllib.parse.quote(orig['updated_at']),data=json.dumps(body,ensure_ascii=False).encode(),method='PATCH',headers=H(SK,{'Content-Type':'application/json','Prefer':'return=representation'}))
res=json.loads(urllib.request.urlopen(q).read()); print('patched rows',len(res), now)
