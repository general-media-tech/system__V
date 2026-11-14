#!/usr/bin/env bash
# (TASK-B0392 · المالك seq B678/B691) استضافة فيديو منتج معنا بدل رابطٍ خارجي (إنستغرام…) ⇒ يعمل داخل معرض المنتج كالصور
# الاستعمال: tools/host_video.sh <رابط الفيديو أو ملفّ محلّي> <اسم قصير لاتيني>   مثال: tools/host_video.sh https://www.instagram.com/reel/XXXX/ rl660
# يُنتج img/v/<الاسم>.mp4 (H.264 · ≤960) + .webm احتياطاً + .jpg غلافاً — ثمّ ضع في المنتج: video_url = https://general-media-tech.github.io/system__V/img/v/<الاسم>.mp4
set -euo pipefail
SRC="$1"; NAME="$2"; OUT="$(cd "$(dirname "$0")/.." && pwd)/img/v"; TMP="$(mktemp -d)"
mkdir -p "$OUT"
if [ -f "$SRC" ]; then cp "$SRC" "$TMP/in.mp4"; else python3 -m yt_dlp -q --no-warnings -f "best[ext=mp4]/best" -o "$TMP/in.%(ext)s" "$SRC"; mv "$TMP"/in.* "$TMP/in.mp4" 2>/dev/null || true; fi
VF="scale='if(gt(iw,ih),min(960,iw),-2)':'if(gt(iw,ih),-2,min(960,ih))',fps=30"
ffmpeg -loglevel error -y -i "$TMP/in.mp4" -vf "$VF" -c:v libx264 -preset slow -crf 30 -profile:v main -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart "$OUT/$NAME.mp4"
ffmpeg -loglevel error -y -i "$TMP/in.mp4" -vf "${VF//960/720}" -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 -deadline good -cpu-used 4 -c:a libopus -b:a 48k "$OUT/$NAME.webm"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/in.mp4"); ffmpeg -loglevel error -y -ss "$(python3 -c "print(float('$D')/2)")" -i "$TMP/in.mp4" -frames:v 1 -vf "scale='min(720,iw)':-2" -q:v 4 "$OUT/$NAME.jpg"
rm -rf "$TMP"; ls -la "$OUT/$NAME".*
echo "video_url = https://general-media-tech.github.io/system__V/img/v/$NAME.mp4"
