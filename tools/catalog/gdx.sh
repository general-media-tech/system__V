#!/bin/bash
# gdx.sh <godox-slug> <tag> — صور صفحة Godox الرسمية + لوحة
C=/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/cat
timeout 120 node $C/pwpage.js "$( [[ $1 == http* ]] && echo $1 || echo https://www.godox.com/product-d/$1.html )" > $C/p/$2.gdx.json 2>/dev/null
python3 - "$C/p/$2.gdx.json" > $C/p/$2.urls <<'PY'
import json,sys
try: d=json.load(open(sys.argv[1]))
except Exception: sys.exit()
print('\n'.join(u for u in d.get('imgs',[]) if not u.endswith('.svg') and '/image/' in u))
PY
echo "$1 → $(wc -l < $C/p/$2.urls) imgs · $(python3 -c "import json;print(json.load(open('$C/p/$2.gdx.json'))['title'][:60])" 2>/dev/null)"
[ -s $C/p/$2.urls ] && python3 -I $C/sheet.py $C/img/$2 $C/p/$2.jpg $(cat $C/p/$2.urls) > /dev/null 2>&1
