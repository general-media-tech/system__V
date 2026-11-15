#!/usr/bin/env bash
# (TASK-A0507 · المالك seq 749–750) مقطع قصير لمنتج: «لا تتجاوز 30 ثانية، لل45 بالكتير» · «انت اجتزئ مقاطع من انستقرام الشركة او علي بابا او امازون —
#  يا برومو المنتج يا اوبن بوكس — اختارها بعناية» · المشغّل لا يقصّ: القصّ هنا قبل الاستضافة.
# الاستعمال: tools/host_clip.sh <رابط أو ملفّ محلّي> <اسم لاتيني قصير> [بداية بالثواني=0] [المدّة=30]
#   ① بلا استضافة — للمراجعة فقط:  REVIEW=1 tools/host_clip.sh <رابط> <اسم> 5 30   ⇒ لوحة 8 لقطات في /tmp/clip_<اسم>.jpg (تُراجَع بالعين قبل الاعتماد)
#   ② الاعتماد: نفس الأمر بلا REVIEW ⇒ img/v/<اسم>.mp4 + .webm + .jpg ثمّ video_url = https://general-media-tech.github.io/system__V/img/v/<اسم>.mp4
set -euo pipefail
SRC="$1"; NAME="$2"; SS="${3:-0}"; DUR="${4:-30}"
[[ "$NAME" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "الاسم لاتيني/أرقام فقط"; exit 2; }
awk "BEGIN{exit !($DUR>0 && $DUR<=45)}" || { echo "المدّة يجب أن تكون بين 1 و45 ثانية (طلب المالك seq 749)"; exit 2; }
OUT="$(cd "$(dirname "$0")/.." && pwd)/img/v"; TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -f "$SRC" ]; then cp "$SRC" "$TMP/in.mp4"; else python3 -m yt_dlp -q --no-warnings -f "best[ext=mp4]/best" -o "$TMP/in.%(ext)s" "$SRC"; mv "$TMP"/in.* "$TMP/in.mp4" 2>/dev/null || true; fi
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/in.mp4")
echo "المصدر: ${TOTAL}s · المقطع: من ${SS}s لمدّة ${DUR}s"
if [ "${REVIEW:-}" = "1" ]; then
  ffmpeg -loglevel error -y -ss "$SS" -t "$DUR" -i "$TMP/in.mp4" -vf "fps=8/$DUR,scale=320:-2,tile=4x2" -frames:v 1 "/tmp/clip_$NAME.jpg"
  echo "لوحة المراجعة: /tmp/clip_$NAME.jpg — انظر إليها: المنتج نفسه؟ بلا شعار متجر آخر أو سعر؟ برومو أو أوبن بوكس؟"; exit 0
fi
mkdir -p "$OUT"
VF="scale='if(gt(iw,ih),min(960,iw),-2)':'if(gt(iw,ih),-2,min(960,ih))',fps=30"
ffmpeg -loglevel error -y -ss "$SS" -t "$DUR" -i "$TMP/in.mp4" -vf "$VF" -c:v libx264 -preset slow -crf 30 -profile:v main -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart "$OUT/$NAME.mp4"
ffmpeg -loglevel error -y -ss "$SS" -t "$DUR" -i "$TMP/in.mp4" -vf "${VF//960/720}" -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 -deadline good -cpu-used 4 -c:a libopus -b:a 48k "$OUT/$NAME.webm"
ffmpeg -loglevel error -y -ss "$(awk "BEGIN{print $SS+$DUR/2}")" -i "$TMP/in.mp4" -frames:v 1 -vf "scale='min(720,iw)':-2" -q:v 4 "$OUT/$NAME.jpg"
ls -la "$OUT/$NAME".*
echo "video_url = https://general-media-tech.github.io/system__V/img/v/$NAME.mp4"
