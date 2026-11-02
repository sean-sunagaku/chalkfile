#!/usr/bin/env bash
# 講座サイト（site/dist）を GitHub Pages に出す。gh-pages ブランチを毎回 1 コミットで置き換える。
#   bash scripts/deploy_pages.sh
# 動画は Git の履歴に積まない（main には入れず、gh-pages は毎回作り直して強制 push する）。
# 訳の言語の動画（site/dist-media/<言語>）は、言語ごとの動画のサイト（site/config.json の media の repo）の gh-pages に先に出す。
#   動画のサイトは講座サイトと同じ origin（https://<owner>.github.io/<repo>/）なので、オフライン保存と途中への移動（Range）はそのまま動く。
# 初回だけ、リポジトリの Settings → Pages で「Deploy from a branch」「gh-pages」「/ (root)」を選ぶ（README の「公開」）。動画のサイトのリポジトリも同じ。
# gh-pages は丸ごと置き換わるので、最新の main から出す（古い main から出すと、あとから足した講座が消える）。違うときは止まる（ALLOW_NON_MAIN=1 で出せる）
# 出す言語は site/config.json の publishLangs（訳の動画の置き場所ができるまでは ja だけ）。SITE_LANGS=ja,en のように付けると、そちらを使う。
#   日本語だけのときは、訳のページと動画のサイトを出さない（訳の講座を保存していた人の保存は消える）
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "コミットしていない変更があります。公開するものを先にコミットしてください" >&2
  exit 1
fi

git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] && [ "${ALLOW_NON_MAIN:-0}" != "1" ]; then
  echo "いまの HEAD（$(git rev-parse --short HEAD)）が origin/main（$(git rev-parse --short origin/main)）と違います。最新の main から出してください（わざと出すなら ALLOW_NON_MAIN=1）" >&2
  exit 1
fi

SITE_LANGS=${SITE_LANGS:-$(bun -e "const c = await Bun.file('site/config.json').json(); console.log((c.publishLangs ?? []).join(','))")}
export SITE_LANGS
echo "出す言語: ${SITE_LANGS:-全部}"

# 訳の言語の動画のサイト（site/config.json の media の repo。SITE_LANGS で絞ったときはその言語だけ）。無いと訳のページの動画が出ないので、作る前に確かめる
media=$(bun -e "const c = await Bun.file('site/config.json').json(); const only = process.env.SITE_LANGS?.trim(); for (const [l, m] of Object.entries(c.media ?? {})) if (!only || only.split(',').map((x) => x.trim()).includes(l)) console.log(l + '\t' + m.repo)")
while IFS=$'\t' read -r lang repo; do
  [ -n "$lang" ] || continue
  if ! GIT_TERMINAL_PROMPT=0 git ls-remote -q "$repo.git" >/dev/null 2>&1; then
    echo "動画のサイトのリポジトリ（$lang・$repo）がありません。先に作ってください（README の「公開」）: gh repo create ${repo#https://github.com/} --public" >&2
    echo "訳のページを出さずに日本語だけ出すなら: SITE_LANGS=ja bash scripts/deploy_pages.sh" >&2
    exit 1
  fi
done <<< "$media"

# 台本とファイルの点検（AI への指示文・HTML・見えない文字・秘密情報・手元の禁止語・訳し残し）に通らなければ出さない
bun scripts/check_content.ts
bun scripts/build_site.ts --strict

rev=$(git rev-parse --short HEAD)
name=$(git config user.name)
email=$(git config user.email)

# site/dist（またはその言語の dist-media）を、指定のリポジトリの gh-pages に 1 コミットで強制 push する
publish() {
  local src=$1 remote=$2 label=$3
  local tmp
  tmp=$(mktemp -d)
  cp -R "$src/." "$tmp/"
  local size
  size=$(du -sh "$tmp" | cut -f1)
  git -C "$tmp" init -q -b gh-pages
  git -C "$tmp" add -A
  git -C "$tmp" -c user.name="$name" -c user.email="$email" commit -q -m "Deploy $rev"
  git -C "$tmp" push -q -f "$remote" gh-pages
  rm -rf "$tmp"
  echo "$label を gh-pages に出しました（main $rev・$size）"
}

# 先に動画のサイト（講座サイトのページが指す動画を、ページより先に置く）
while IFS=$'\t' read -r lang repo; do
  [ -n "$lang" ] || continue
  if [ ! -d "site/dist-media/$lang" ]; then echo "site/dist-media/$lang がありません（bun scripts/build_site.ts）" >&2; exit 1; fi
  publish "site/dist-media/$lang" "$repo.git" "動画のサイト（$lang・$repo）"
done <<< "$media"

publish site/dist "$(git remote get-url origin)" "講座サイト"
echo "反映まで 1〜2 分かかります"
