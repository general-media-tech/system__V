cd "$(dirname "$0")"
while IFS='|' read id q; do
  [ -s t_$id.u ] && continue
  timeout 90 node yt.js "$q" 2>/dev/null | head -12 > t_$id.u
  rm -rf t_${id}img; python3 -I ../cat/sheet.py t_${id}img t_$id.jpg $(cat t_$id.u) >/dev/null 2>&1
  echo "$id $(wc -l < t_$id.u)"
done < tq.txt
