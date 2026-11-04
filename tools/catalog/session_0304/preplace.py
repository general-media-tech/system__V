# python3 preplace.py seq "source" pfx:t1,t6 ...   (يمسح صور المنتج القديمة ثم يضيف المختارة وحدها)
import json,sys,os,subprocess,urllib.request
U=os.environ['U'];K=os.environ['K']
H={'apikey':K,'Authorization':'Bearer '+K,'Content-Type':'application/json'}
for arg in sys.argv[3:]:
    k=arg.split(':')[0]
    pid=json.loads(urllib.request.urlopen(urllib.request.Request(U+'/rest/v1/products?select=id&id=gte.%s-0000-0000-0000-000000000000&id=lte.%s-ffff-ffff-ffff-ffffffffffff'%(k,k),headers=H)).read())[0]['id']
    urllib.request.urlopen(urllib.request.Request(U+'/rest/v1/products?id=eq.'+pid,data=json.dumps({'images':[],'image_url':None}).encode(),method='PATCH',headers=H))
    print(subprocess.run(['python3','-I','./work/papply.py',sys.argv[1],sys.argv[2],arg],capture_output=True,text=True).stdout.strip()[:150])
