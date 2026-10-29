#!/usr/bin/env bash
# 講座動画を書き出す。映像（Remotion・無音）→ 音（mix.py の WAV）と合わせて Web 用 MP4 → ポスター画像。
#   bash scripts/render.sh            # 全レクチャー
#   bash scripts/render.sh L03 L05    # 一部だけ
# 出力: out/master/<id>.mp4（映像のみ・高画質）、site/media/<id>.mp4（15MB 以下）、site/media/<id>.jpg
set -euo pipefail
cd "$(dirname "$0")/.."
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then read -r -a ids <<< "$(bun -e "import { LECTURES } from './content'; console.log(LECTURES.map((l) => l.id).join(' '))")"; fi
mkdir -p out/master site/media .work/render-public
# 映像は無音で書き出すので public/（音声で 1GB 近い）は要らない。空のフォルダを渡して、一時フォルダへの複製を避ける
LIMIT=$((14500 * 1024))
# CHUNK=1500 のように渡すと、その枚数ずつ分けて書き出して最後につなぐ。
# Remotion は書き出し中のフレームを一時フォルダに JPEG で置く（5 分で 1〜2GB）ので、ディスクの空きが少ないとき用
CHUNK=${CHUNK:-0}
for id in "${ids[@]}"; do
  start=$(date +%s)
  rm -f "out/master/$id.mp4"
  if [ "$CHUNK" -gt 0 ]; then
    total=$(python3 -c "import json; print(json.load(open('src/generated/timeline.json'))['$id']['durationInFrames'])")
    list="out/master/$id.parts.txt"
    : > "$list"
    s=0
    k=0
    while [ "$s" -lt "$total" ]; do
      e=$((s + CHUNK - 1))
      if [ "$e" -ge "$total" ]; then e=$((total - 1)); fi
      npx remotion render src/index.ts "$id" "out/master/$id.part$k.mp4" --frames="$s-$e" --public-dir=.work/render-public --muted --codec=h264 --crf=16 --concurrency=8 --log=error 2>&1 | grep -v "network requests" || true
      if [ ! -s "out/master/$id.part$k.mp4" ]; then echo "$id: 映像の書き出しに失敗しました（$s-$e）" >&2; exit 1; fi
      echo "file '$id.part$k.mp4'" >> "$list"
      s=$((e + 1))
      k=$((k + 1))
    done
    ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$list" -c copy "out/master/$id.mp4"
    rm -f "out/master/$id".part*.mp4 "$list"
  else
    npx remotion render src/index.ts "$id" "out/master/$id.mp4" --public-dir=.work/render-public --muted --codec=h264 --crf=16 --concurrency=8 --log=error 2>&1 | grep -v "network requests" || true
  fi
  if [ ! -s "out/master/$id.mp4" ]; then echo "$id: 映像の書き出しに失敗しました" >&2; exit 1; fi
  crf=21
  while :; do
    ffmpeg -y -hide_banner -loglevel error -i "out/master/$id.mp4" -i "public/audio/mix/$id.wav" \
      -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf "$crf" -maxrate 2000k -bufsize 4000k \
      -pix_fmt yuv420p -profile:v high -g 150 -c:a aac -b:a 128k -ar 48000 -shortest -movflags +faststart \
      "site/media/$id.mp4"
    size=$(stat -f%z "site/media/$id.mp4")
    if [ "$size" -le "$LIMIT" ] || [ "$crf" -ge 29 ]; then break; fi
    crf=$((crf + 2))
  done
  ffmpeg -y -hide_banner -loglevel error -ss 4.2 -i "out/master/$id.mp4" -frames:v 1 -vf scale=1280:-2 -q:v 3 "site/media/$id.jpg"
  echo "$id: $(( $(date +%s) - start )) 秒  crf=$crf  $(( size / 1024 / 1024 )) MB"
done
