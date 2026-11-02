#!/usr/bin/env bash
# 旧 GitHub Pages を移行案内へ置き換える専用手順。通常公開は Actions / Wrangler。
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ -n "$(git status --porcelain)" ]; then
  echo "公開する変更を先にコミットしてください" >&2
  exit 1
fi
git fetch -q origin main
git fetch -q origin +refs/heads/gh-pages:refs/remotes/origin/gh-pages
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "移行は最新の origin/main から行ってください" >&2
  exit 1
fi
# 切替前に公開先・全動画・CSP・SW scope を実際に確認する。
bun scripts/check_content.ts --require-denylist
bun scripts/verify_public.ts
bun tests/worker-site-smoke.ts https://chalkfile.com/
bun scripts/build_migration.ts
bun scripts/check_delivery.ts site/migration-dist
previous=$(git rev-parse origin/gh-pages)
rev=$(git rev-parse --short HEAD)
# 復旧用のローカル参照だけを残す。他のブランチやリモートには push しない。
git update-ref "refs/chalkfile-backups/gh-pages-$rev" "$previous"
remote=$(git remote get-url origin)
name=$(git config user.name)
email=$(git config user.email)
case "$email" in
  *@users.noreply.github.com) ;;
  *) echo "公開commitの作者には GitHub noreply メールを設定してください" >&2; exit 1 ;;
esac
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
