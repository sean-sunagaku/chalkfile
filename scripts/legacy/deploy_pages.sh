#!/usr/bin/env bash
# 旧 GitHub Pages（gh-pages）を移行案内へ置き換える専用手順。旧 Pages の移行の案内を出すときだけ使う。通常公開は Actions / Wrangler。
#   bash scripts/legacy/deploy_pages.sh                  # 下見（既定）: 確かめて、置き換える中身と今の gh-pages の SHA を出すだけ。push しない
#   bash scripts/legacy/deploy_pages.sh --confirm <SHA>  # 下見で出た今の gh-pages の SHA を渡したときだけ、gh-pages を置き換える（強制 push）
#   bash scripts/legacy/deploy_pages.sh --help
set -euo pipefail
usage() {
  cat <<'EOF'
旧 GitHub Pages（gh-pages）を、chalkfile.com への移行案内に置き換える。旧 Pages の移行の案内を出すときだけ使う。
通常の公開には使わない（main へのマージで Actions / Wrangler が公開する。docs/operations/publish.md）。

  bash scripts/legacy/deploy_pages.sh                  下見（既定）。確かめて、置き換える中身と今の gh-pages の SHA を出すだけ。push しない
  bash scripts/legacy/deploy_pages.sh --confirm <SHA>  下見で出た今の gh-pages の SHA を渡したときだけ、gh-pages を置き換える（強制 push）
  bash scripts/legacy/deploy_pages.sh --help           この説明を出す

どちらも、最新の origin/main と同じ HEAD・変更の無い作業フォルダ・GitHub の noreply のメール・台本とファイルの点検
（禁止語の一覧も要る）・公開先の全動画と CSP/SW の確認・移行案内の組み立てと点検に通らないと止まる。
EOF
}
confirm=''
while [ $# -gt 0 ]; do
  case $1 in
    -h | --help) usage; exit 0 ;;
    --confirm)
      if [ $# -lt 2 ] || [ -z "$2" ]; then echo "--confirm には、下見で出た今の gh-pages の SHA を付けてください" >&2; exit 2; fi
      confirm=$2
      shift 2
      ;;
    *) echo "知らない引数です: $1（使い方は --help）" >&2; exit 2 ;;
  esac
done
cd "$(dirname "$0")/../.."
if [ -n "$(git status --porcelain)" ]; then
  echo "公開する変更を先にコミットしてください" >&2
  exit 1
fi
git fetch -q origin main
git fetch -q origin +refs/heads/gh-pages:refs/remotes/origin/gh-pages
previous=$(git rev-parse origin/gh-pages)
echo "今の gh-pages: $(git log -1 --format='%H（%s・%cd）' --date=format:'%Y-%m-%d %H:%M' "$previous")"
# 下見のあとで gh-pages が変わっていたら（または SHA が違えば）、時間のかかる確認の前に止める
if [ -n "$confirm" ] && [ "$confirm" != "$previous" ]; then
  echo "--confirm の SHA が今の gh-pages と違います。下見をやり直し、出た SHA（40 文字）をそのまま渡してください" >&2
  exit 1
fi
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "移行は最新の origin/main から行ってください" >&2
  exit 1
fi
name=$(git config user.name) || { echo "git の user.name を設定してください" >&2; exit 1; }
email=$(git config user.email) || email=''
case "$email" in
  *@users.noreply.github.com) ;;
  *) echo "公開commitの作者には GitHub noreply メールを設定してください" >&2; exit 1 ;;
esac
# 切替前に公開先・全動画・CSP・SW scope を実際に確認する。
bun scripts/check_content.ts --require-denylist
bun scripts/verify_public.ts
bun tools/verify/worker-site-smoke.ts https://chalkfile.com/
bun scripts/build_migration.ts
bun scripts/check_delivery.ts site/migration-dist
# 置き換える中身を、今の gh-pages と比べて出す（同じファイルは数だけ）
echo "置き換える中身: site/migration-dist の $(find site/migration-dist -type f | wc -l | tr -d ' ') ファイル（今の gh-pages は $(git ls-tree -r --name-only "$previous" | wc -l | tr -d ' ') ファイル）"
same=0
while IFS= read -r f; do
  old=$(git rev-parse -q --verify "$previous:$f" || true)
  if [ -z "$old" ]; then
    echo "  足す    $f"
  elif [ "$old" != "$(git hash-object --no-filters "site/migration-dist/$f")" ]; then
    echo "  変える  $f"
  else
    same=$((same + 1))
  fi
done < <(cd site/migration-dist && find . -type f | sed 's|^\./||' | LC_ALL=C sort)
while IFS= read -r f; do
  if [ ! -e "site/migration-dist/$f" ]; then echo "  消す    $f"; fi
done < <(git ls-tree -r --name-only "$previous")
echo "  同じ    $same ファイル"
if [ -z "$confirm" ]; then
  echo "下見だけで終えました（push していません）。置き換えるときは、公開の許可をもらってから次を流す:"
  echo "  bash scripts/legacy/deploy_pages.sh --confirm $previous"
  exit 0
fi
rev=$(git rev-parse --short HEAD)
# 復旧用のローカル参照だけを残す。他のブランチやリモートには push しない。
git update-ref "refs/chalkfile-backups/gh-pages-$rev" "$previous"
remote=$(git remote get-url origin)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cp -R site/migration-dist/. "$tmp/"
git -C "$tmp" init -q -b gh-pages
git -C "$tmp" add -A
git -C "$tmp" -c user.name="$name" -c user.email="$email" commit -q -m "Chalkfile の移行案内 main $rev"
# 見ていない更新があれば停止する。動画を含む古いサイトを誤って公開し直さない。
git -C "$tmp" push -q --force-with-lease="refs/heads/gh-pages:$previous" "$remote" HEAD:refs/heads/gh-pages
git fetch -q origin +refs/heads/gh-pages:refs/remotes/origin/gh-pages
echo "gh-pages を移行案内にしました。旧版のローカル復旧参照: refs/chalkfile-backups/gh-pages-$rev"
