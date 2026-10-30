#!/usr/bin/env bash
# 講座サイト（site/dist）を GitHub Pages に出す。gh-pages ブランチを毎回 1 コミットで置き換える。
#   bash scripts/deploy_pages.sh
# 動画は Git の履歴に積まない（main には入れず、gh-pages は毎回作り直して強制 push する）。
# 初回だけ、リポジトリの Settings → Pages で「Deploy from a branch」「gh-pages」「/ (root)」を選ぶ（README の「公開」）。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "コミットしていない変更があります。公開するものを先にコミットしてください" >&2
  exit 1
fi

# 台本とファイルの点検（AI への指示文・HTML・見えない文字・秘密情報・手元の禁止語）に通らなければ出さない
bun scripts/check_content.ts
bun scripts/build_site.ts --strict

remote=$(git remote get-url origin)
rev=$(git rev-parse --short HEAD)
name=$(git config user.name)
email=$(git config user.email)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cp -R site/dist/. "$tmp/"
size=$(du -sh "$tmp" | cut -f1)
git -C "$tmp" init -q -b gh-pages
git -C "$tmp" add -A
git -C "$tmp" -c user.name="$name" -c user.email="$email" commit -q -m "Deploy $rev"
git -C "$tmp" push -q -f "$remote" gh-pages

echo "gh-pages に出しました（main $rev・サイト $size）。反映まで 1〜2 分かかります"
