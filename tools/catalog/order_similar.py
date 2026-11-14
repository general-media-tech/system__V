# (TASK-B0381 · المالك seq B671) «اعد ترتيب المشابهات مع بعضهم … 660 بجانب 660 وبجانبه SY-1280 … 600 بجانبه 600 RGB … المنتج اذا في منه اكثر من نسخه فحط نسخه ثانيه معو»
# مفتاح العائلة: خطّ المنتج (Mini 3 · Pocket 4 · RS 5 · Lark …) أو رقم الموديل (660 · 600 …) · ملحقات الدرون حسب نوع القطعة (أرجل هبوط · واقي مراوح …)
# كلّ عائلة تُجمع عند أوّل ظهور لها في القسم وبقية الترتيب كما هو. المراجعة: python3 order_similar.py -v (يقرأ STORE_JSON) — التطبيق: apply.py في session_B0381
import json,re,sys
import os
D=os.environ.get('WORK','./')
s=json.load(open(os.environ.get('STORE_JSON',D+'kits/store_full.json')))
P=s['products']; C={c['id']:c for c in s['categories']}  # للمراجعة فقط — apply.py يمرّر البيانات الحيّة
def cats(p): return p.get('category_ids') or ([p['category_id']] if p.get('category_id') else [])
def pos(p,c): 
    o=(p.get('category_orders') or {}).get(c)
    return o if o is not None else p.get('order',0)
BRAND=[(r'\bzsyb\b','bzsyb'),(r'\bbd[- ]?\d','bbd'),(r'\bzu ?\d','pzu')]
FAMS=[  # (نمط · مفتاح) — بالترتيب، أوّل تطابق يربح
 (r'mic\s*mini()', 'micmini'), (r'dji mic\s*(\d)', 'djimic'), (r'(?:lark|لارك)\s*m\d()', 'lark'),
 (r'osmo pocket\s*(\d)', 'pocket'), (r'osmo mobile\s*(\d|se)', 'om'), (r'osmo action\s*(\d)', 'action'),
 (r'\brs\s*(\d)', 'rs'), (r'\bavata()', 'avata'), (r'\bmini\s*(\d|se)', 'mini'), (r'mavic mini','mavicmini'),
 (r'\bair\s*(\d)', 'air'), (r'\bneo\s*(\d)?', 'neo'), (r'\bflip\b()', 'flip'),
 (r'\b(r6|r8|r5|m50|m 50|5d|6d|r50|r10|r100|rp)\b', 'cam'), (r'canon.*?\b\d{2}d\b()|^\d{2}d\b()|\b\d{2}d open', 'camxxd'), (r'canon.*?\b(?:\d{3,4}) ?d\b()|^1300 ?d()|canon 800\b()', 'camxxxd'),
 (r'\b(\d{2,3})\s*[-_]\s*(\d{2,3})\b', 'zoom'), (r'(?:^|[\s\u0600-\u06FF])(50|85|24|35|16)\s*(?:mm|f|\s*stm|\s*ii|\s*1\.|$| art)', 'prime'),
]
def fam(name):
    n=name.lower()
    for rx,k in FAMS:
        m=re.search(rx,n)
        if m:
            g=[x for x in m.groups() if x is not None] if m.groups() else []
            v=''.join(g).replace(' ','')
            if k=='cam': v={'m 50':'m50'}.get(v,v)
            if k in ('pocket',) : v=v[:1]
            return k+':'+v
    for rx,k in BRAND:
        if re.search(rx,n.strip()): return k
    n=re.sub(r'\d+(\.\d+)?\s*[x×]\s*\d+(\s*[x×]\s*\d+)?','',n)
    n=re.sub(r'\d+(\.\d+)?\s*(w|واط|cm|mm|m\b|م\b|inch|انش|إنش|ml|mah|g\b|kg|v\b|"|’’|ft|k\b|fps|gb|g\b|tb)','',n)
    n=re.sub(r'[؀-ۿ]+',' ',n)
    m=re.search(r'([a-z]{0,6})[- _]?(\d{2,4})',n)
    if not m: return None
    pre,dg=m.group(1),m.group(2)
    if len(dg)>=3: return 'n'+dg
    if len(pre)>=2: return 'p'+pre
    return None
ACC={'h8_2','h8_3','h8_4','h8_5','h8_6','h12_2','h13_2'}
def fam_acc(name):
    n=name.lower()
    if re.search(r'\brc\b|rc[_ -]|ريمونت|remote|controller|remont',n): return 't:rc'
    n=re.sub(r'\([^)]*\)','',n); n=re.sub(r'[a-z0-9_.:/+\-–—·*]+',' ',n)
    n=n.replace('أ','ا').replace('إ','ا').replace('ة','ه').replace('ّ','')
    w=[x for x in n.split() if x not in ('لـ','ل','لدرون','للدرون','درون','طقم','مجموعة','مجموعه','الاصلية','الاصليه','عام','اصلية','اصليه')]
    if w and w[0] in ('مراوح','بطاريه'): return 't:'+w[0]
    return ('t:'+' '.join(w[:2])) if w else None
LINK0={'n1280':'n660','n666':'n1280'}
LINKP={'n1280':'n660','n666':'n1280','n600':'n800','n300':'n600','n560':'n300'}   # ألواح: 800 ⇐ 600 ⇐ 300 ⇐ 560 (عائلة Led RGB وأخواتها)
PANEL={'h3_1'}
LINK=LINK0   # (المالك seq 671) 660 ⇒ بجانبه SY-1280 ⇒ ثمّ المستديرة 666
def reorder(L,cid=''):
    global LINK
    LINK=LINKP if cid in PANEL else LINK0
    keys=[(fam_acc if cid in ACC else fam)(p.get('name','')) for p in L]
    out=[];used=set()
    def take(k):
        for j,p in enumerate(L):
            if j not in used and keys[j]==k: used.add(j); out.append(p)
    for i,p in enumerate(L):
        if i in used: continue
        k=keys[i]
        if k and k in LINK.values() or (k and k not in LINK):
            if k: take(k)
            else: used.add(i); out.append(p)
            # سلسلة الروابط
            cur=k
            while True:
                nxt=[a for a,b in LINK.items() if b==cur]
                if not nxt: break
                cur=nxt[0]; take(cur)
        elif k in LINK:
            # عضوٌ تابع: ينتظر رأس سلسلته إن كان في القسم
            head=LINK[k]
            while head in LINK: head=LINK[head]
            if head in keys: continue
            take(k)
        else:
            used.add(i); out.append(p)
    for i,p in enumerate(L):
        if i not in used: out.append(p)
    return out
def main():
    res={}
    for cid in C:
        L=sorted([p for p in P if cid in cats(p)],key=lambda p:pos(p,cid))
        if len(L)<3: continue
        R=reorder(L,cid)
        if [p['id'] for p in R]!=[p['id'] for p in L]:
            res[cid]=[p['id'] for p in R]
            if '-v' in sys.argv:
                print('==',cid,C[cid]['name'])
                for i,p in enumerate(R):
                    print(f"  {i:2d} {'*' if L[i]['id']!=p['id'] else ' '} [{((fam_acc if cid in ACC else fam)(p['name'])) or ''}] {p['name'][:60]}")
    json.dump(res,open(os.path.join(D,'new_orders.json'),'w'))
    print('changed categories:',len(res), list(res))
if __name__=='__main__': main()
