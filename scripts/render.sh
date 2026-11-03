#!/usr/bin/env bash
# 講座動画を書き出す。映像（Remotion・無音）→ 音（mix.py の WAV）と合わせて Web 用 MP4 → ポスター画像。
#   bash scripts/render.sh                  # 全部の動画（全部の言語）
#   bash scripts/render.sh L03 L05          # 一部だけ
#   bash scripts/render.sh P01.en P01.zh    # 訳の動画（レクチャー ID.言語。コンポジションは P01-en）
# 出力: out/master/<id>.mp4（映像のみ・高画質）、site/media/<id>.mp4（サイト用）、site/media/<id>.jpg（<id> は動画の名前。訳は P01.en.mp4）
# サイト用の動画は、site/limits.ts の VIDEO_TARGET_BYTES（14,500 KiB）を目安に crf を上げて合わせる。crf 29 でも目安を超えたら、警告して
#   そのまま使う（目安は上限ではない）。上限は保存の 1 ファイルの OFFLINE_FILE_MAX_BYTES（32 MiB）で、超えると学ぶ人が講座を保存できない。
#   超えても、ここでは警告だけにして書き出した動画を残す（確かめるため）。Releases に置く bun scripts/media.ts push と、組み立ての
#   build_site が止める。2 つの値は、写さずに bun で site/limits.ts から読む（読めなければ、何も書き出さずに止まる）。環境変数で渡したり
#   名前を付けて写したりすると、また 5 か所で値がずれる。render.sh はもう bun で動画の一覧を読んでいて、1 回 0.1 秒もかからない
# CAPTIONS=1 を付けると、日本語の字幕を焼き込んだ版も作る: out/captioned/<id>.mp4（講座サイトの外で、音なしでも見られる版）と、
#   site/media/<id>.cc.mp4（講座サイト用。字幕オンのときにこちらを流すので、全画面でも字幕が見える）
# CONCURRENCY=12 のように渡すと、Remotion の並列数を変える（既定 8。CPU のコア数より少なくする）
# 出力は一時の名前（<id>.tmp.mp4 など）に書き、できてから置き換える。失敗したら 0 でない終了コードで止まり、前の書き出しの残り
#   （字幕つきの映像・CHUNK の部品）で先へ進まない。Remotion の書き出し（字幕つきの版も）が全部できるまで、サイト用の出力は変えない
set -euo pipefail
cd "$(dirname "$0")/.."
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then read -r -a ids <<< "$(bun -e "import { VIDEOS } from './content'; console.log(VIDEOS.map((v) => v.key).join(' '))")"; fi
fail() { echo "$1" >&2; exit 1; }
# サイト用の動画の大きさの目安と、保存の 1 ファイルの上限（バイト。正本は site/limits.ts）
limits=$(bun -e "import { OFFLINE_FILE_MAX_BYTES, VIDEO_TARGET_BYTES } from './site/limits'; console.log(VIDEO_TARGET_BYTES, OFFLINE_FILE_MAX_BYTES)") ||
  fail "site/limits.ts の上限を読めません"
read -r TARGET MAX_FILE <<< "$limits"
case "$TARGET:$MAX_FILE" in *[!0-9:]* | :* | *:) fail "site/limits.ts の上限が数ではありません: $limits" ;; esac
mkdir -p out/master site/media site/posters .work/render-public
# 映像は無音で書き出すので public/（音声で 1GB 近い）は要らない。空のフォルダを渡して、一時フォルダへの複製を避ける
# crf 29 でも目安を超えたサイト用の動画と、保存の上限も超えた動画（最後にまとめて警告する）
over=''
big=''
# 書きかけの一時ファイルと CHUNK の部品を消す。書き出しの前と、途中で止まったときに使う（できたものは置き換え済みなので消えない）
leftovers() {
  rm -f "out/master/$1".tmp.mp4 "out/master/$1".cc.tmp.mp4 "out/master/$1".part*.mp4 "out/master/$1.parts.txt" \
    "site/media/$1".tmp.mp4 "site/media/$1".cc.tmp.mp4 "site/media/$1".tmp.jpg "site/posters/$1".tmp.jpg "out/captioned/$1".tmp.mp4
}
trap 'if [ -n "${id:-}" ]; then leftovers "$id"; fi' EXIT
# Remotion で映像（無音）を書き出す。$1: 出力、残り: Remotion に足す引数。
# 出力を grep で間引く（1 行も残らないと grep は 1 を返す）ので、成否は Remotion の終了コード（PIPESTATUS[0]）と、空でないファイルで見る
remotion_render() {
  local out=$1 code=0
  shift
  rm -f "$out"
  npx remotion render src/index.ts "$comp" "$out" "$@" --public-dir=.work/render-public --muted --codec=h264 --crf=16 --concurrency="${CONCURRENCY:-8}" --log=error 2>&1 | grep -v "network requests" || code=${PIPESTATUS[0]}
  if [ "$code" -ne 0 ]; then echo "Remotion が終了コード $code で止まりました" >&2; return 1; fi
  if [ ! -s "$out" ]; then echo "Remotion の出力が空です" >&2; return 1; fi
}
# サイト用の MP4 にする（目安の大きさ以下になるまで crf を上げる）。$1: 映像（無音）、$2: 出力、$3: レクチャー ID
# crf 29 でも目安を超えたら、警告して先へ進む。保存の上限も超えたら、別に警告する（止めるのは media.ts push と build_site）
site_encode() {
  local tmp="${2%.mp4}.tmp.mp4"
  crf=21
  # 6 分より長い動画は、これまで crf 27 か 29 でしか上限（約 14MB）に近づかなかった（3 講座の 23 本）。21〜25 を試す書き出しを省く
  if [ "$(python3 -c "import json; t=json.load(open('src/generated/timeline.json'))['$3']; print(t['durationInFrames'] // t['fps'])")" -gt 360 ]; then crf=27; fi
  while :; do
    ffmpeg -y -hide_banner -loglevel error -i "$1" -i "public/audio/mix/$3.wav" \
      -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf "$crf" -maxrate 2000k -bufsize 4000k \
      -pix_fmt yuv420p -profile:v high -g 150 -c:a aac -b:a 128k -ar 48000 -shortest -movflags +faststart \
      "$tmp"
    size=$(( $(wc -c < "$tmp") ))
    if [ "$size" -le "$TARGET" ] || [ "$crf" -ge 29 ]; then break; fi
    crf=$((crf + 2))
  done
  mv -f "$tmp" "$2"
  if [ "$size" -gt "$TARGET" ]; then
    echo "警告: $2 は crf $crf でも $(( size / 1024 )) KiB で、目安（$(( TARGET / 1024 )) KiB）を超えています" >&2
    over="$over $2"
  fi
  if [ "$size" -gt "$MAX_FILE" ]; then
    echo "警告: $2 は保存の 1 ファイルの上限（$(( MAX_FILE / 1024 / 1024 )) MiB）も超えています。このままでは講座を保存できないので、bun scripts/media.ts push が止めます" >&2
    big="$big $2"
  fi
}
# CHUNK=1500 のように渡すと、その枚数ずつ分けて書き出して最後につなぐ。
# Remotion は書き出し中のフレームを一時フォルダに JPEG で置く（5 分で 1〜2GB）ので、ディスクの空きが少ないとき用
CHUNK=${CHUNK:-0}
for id in "${ids[@]}"; do
  start=$(date +%s)
  # Remotion のコンポジションの ID はドットを使えない（P01.en → P01-en）
  comp=${id//./-}
  # 前の書き出しの残り（映像・字幕つきの映像・CHUNK の部品）を先に消す。残っていると、書き出しに失敗しても前の映像で先へ進んでしまう
  rm -f "out/master/$id.mp4" "out/master/$id.cc.mp4"
  leftovers "$id"
  if [ "${CAPTIONS:-0}" != "1" ] && [ -e "site/media/$id.cc.mp4" ]; then
    echo "注意: $id: 字幕つきの版（site/media/$id.cc.mp4）は作り直さず、前のままです。そろえるなら CAPTIONS=1 を付ける" >&2
  fi
  if [ "$CHUNK" -gt 0 ]; then
    total=$(python3 -c "import json; print(json.load(open('src/generated/timeline.json'))['$id']['durationInFrames'])")
    list="out/master/$id.parts.txt"
    : > "$list"
    s=0
    k=0
    while [ "$s" -lt "$total" ]; do
      e=$((s + CHUNK - 1))
      if [ "$e" -ge "$total" ]; then e=$((total - 1)); fi
      remotion_render "out/master/$id.part$k.mp4" --frames="$s-$e" || fail "$id: 映像の書き出しに失敗しました（$s-$e）"
      echo "file '$id.part$k.mp4'" >> "$list"
      s=$((e + 1))
      k=$((k + 1))
    done
    ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$list" -c copy "out/master/$id.tmp.mp4"
    rm -f "out/master/$id".part*.mp4 "$list"
    if [ ! -s "out/master/$id.tmp.mp4" ]; then fail "$id: 映像の書き出しに失敗しました"; fi
  else
    remotion_render "out/master/$id.tmp.mp4" || fail "$id: 映像の書き出しに失敗しました"
  fi
  mv -f "out/master/$id.tmp.mp4" "out/master/$id.mp4"
  # 字幕つきの映像も、サイト用の出力を作る前に書き出す（失敗したとき、通常版だけが新しくならないように）
  if [ "${CAPTIONS:-0}" = "1" ]; then
    remotion_render "out/master/$id.cc.tmp.mp4" --props='{"captions":true}' || fail "$id: 字幕つきの映像の書き出しに失敗しました"
    mv -f "out/master/$id.cc.tmp.mp4" "out/master/$id.cc.mp4"
  fi
  site_encode "out/master/$id.mp4" "site/media/$id.mp4" "$id"
  ffmpeg -y -hide_banner -loglevel error -ss 4.2 -i "out/master/$id.mp4" -frames:v 1 -vf scale=1280:-2 -q:v 3 "site/posters/$id.tmp.jpg"
  mv -f "site/posters/$id.tmp.jpg" "site/posters/$id.jpg"
  cp "site/posters/$id.jpg" "site/media/$id.tmp.jpg"
  mv -f "site/media/$id.tmp.jpg" "site/media/$id.jpg"
  echo "$id: $(( $(date +%s) - start )) 秒  crf=$crf  $(( size / 1024 / 1024 )) MB"
  if [ "${CAPTIONS:-0}" = "1" ]; then
    mkdir -p out/captioned
    ffmpeg -y -hide_banner -loglevel error -i "out/master/$id.cc.mp4" -i "public/audio/mix/$id.wav" \
      -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high -g 150 \
      -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "out/captioned/$id.tmp.mp4"
    mv -f "out/captioned/$id.tmp.mp4" "out/captioned/$id.mp4"
    echo "$id: 字幕つき $(( $(wc -c < "out/captioned/$id.mp4") / 1024 / 1024 )) MB"
    site_encode "out/master/$id.cc.mp4" "site/media/$id.cc.mp4" "$id"
    echo "$id: サイト用の字幕つき crf=$crf  $(( size / 1024 / 1024 )) MB"
  fi
done
if [ -n "$over" ]; then echo "警告: crf 29 でもサイト用の目安（$(( TARGET / 1024 )) KiB）を超えた動画があります:$over" >&2; fi
if [ -n "$big" ]; then echo "警告: 保存の 1 ファイルの上限（$(( MAX_FILE / 1024 / 1024 )) MiB）を超えた動画があります（動画を短く分ける）:$big" >&2; fi
