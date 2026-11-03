# 初回の設定（Cloudflare と GitHub）

chalkfile.com を Actions から出せるようにする、最初の 1 回の設定。token を作り直すときも使う。持ち主だけが行う（Cloudflare と GitHub の管理の権限が要る）。

- 決めたこと: Workers Free のままにし、有料プラン・R2・Terraform を使わない（[ADR](../adr/2026-11-02-workers-free-only.md)）。配り方の設計は [配信の設計](../architecture/delivery.md)
- ふだんの公開は [公開の順番](publish.md)、token の入れ替えと戻し方は [戻し方](recovery.md)

## 守ること

- 認証ファイル・`.env`・token の値を読まない・表示しない
- token の値は、その場で GitHub の secret の欄に入れる。会話・Issue・PR・ファイル・ログ・Wrangler の設定に貼らない
- 個人の Wrangler の OAuth token を、CI に使わない
- Actions では、Cloudflare の secret を Deploy の手順にだけ渡す。依存のインストール・素材の取り出し・テスト・組み立てには渡さない
- 権限が足りないときに、広い権限（Admin など）へ広げない

## 1. 手元の Wrangler

- Wrangler は devDependency の固定の版を使う（`npx --no-install wrangler`。版は `package.json`）
- 手元で初めて使うときは `npx --no-install wrangler login`。前の OAuth が使えるときは、ログインし直さない

## 2. GitHub の production environment

- リポジトリの [Environments](https://github.com/sean-sunagaku/chalkfile/settings/environments) の `production` で、デプロイしてよい branch を `main` だけにする（custom branch policy）。workflow の側でも、リポジトリと ref が main かを確かめている
- `CLOUDFLARE_ACCOUNT_ID` を、この environment の vars に入れる
- `CLOUDFLARE_API_TOKEN` を、この environment の secret に入れる（次の 3 で作る）

## 3. Cloudflare の API token

Cloudflare の管理画面で、対象の account の Manage Account → Account API Tokens から作る。権限は次の 3 つだけにする。

| 権限 | 範囲 | 何に使うか |
|---|---|---|
| Workers Editor | 対象の account | 今ある `chalkfile` Worker を更新する。Custom Domain が Worker ごとの権限に対応していないので、範囲は account にする |
| Workers Routes Write | `chalkfile.com` の zone だけ | Custom Domain の経路 |
| Zone Read | `chalkfile.com` の zone だけ | zone を読む |

- 前からある Workers Scripts Write は選ばない（今は、もっと広い Workers Admin に当たる）
- D1・KV・R2・Registrar・請求・全部の zone・token の発行の権限は付けない
- account ID は vars で渡すので、account の一覧を読む権限も CI に付けない
- 権限と Custom Domain の制約: [Workers の権限](https://developers.cloudflare.com/workers/authorization/workers/)

## 4. 登録して、公開を始める

```bash
bun scripts/setup_cloudflare_ci.ts plan    # 何も変えず、認証もしない。対象と 3 つの権限と、秘密の値の扱いを出す
# ここで、管理画面で 3 の token を作り、GitHub の production の secret の欄に直接入れる
bun scripts/setup_cloudflare_ci.ts apply   # main だけの policy・account ID・secret の名前を読み戻し、main の Actions を始める
```

- `apply` は、secret がもうあれば新しい token を作らず、値も読まない
- 2026-11-03 に、公式の cf `1.0.0-beta.26` で確かめた制約: Workers Editor に当たる `workers-scripts.edit` を CLI が認可できず、CLI では最小の権限の token を作れなかった。権限の一覧の `is_selectable: false` を無視したり、Admin へ広げたり、同じ認可を繰り返したりしない。CLI の対応が変わるまでは、管理画面で作る
- CLI で最小の権限を作れる認可を使うときだけ、`apply` は zone と 3 つの権限を確かめ、作った token をメモリから `gh secret set` の標準入力へ渡す（表示・保存・引数に出さない）。登録に失敗したら、その実行で作った token だけを失効させる。途中で止まったら、token の名前と ID・secret の名前で状態を確かめ、二重に作らない。認可の profile は OS の keychain に置く（[cf CLI の認可](https://developers.cloudflare.com/cf/get-started/)・[作れる権限と is_selectable](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/)）
- 初回の設定だけに使った cf の profile は、名前を指定した `cf auth delete <profile>` で消し、一覧で消えたことを確かめる。ふだんの Wrangler の認証は消さない
- CI の token には、token を作る権限・KV・R2・D1・Registrar・請求の権限を渡さない。ふだんの公開は、固定の版の Wrangler のまま（cf には移さない）
- 秘密情報の点検は、Cloudflare の今の接頭辞つきの値も、文章の全部から見つける（[token の形](https://developers.cloudflare.com/fundamentals/api/get-started/token-formats/)）

## 5. 初めて出す

```bash
npx --no-install wrangler deploy --env preview   # 試しの Worker（chalkfile-preview。経路なし）
npx --no-install wrangler deploy --env=""        # 本番（手元から出すのは初回だけ）
```

- Custom Domain の DNS は Wrangler が作る。www も、同じ Worker の Custom Domain に付ける
- 以後の公開は、main への push か、main を選んだ workflow_dispatch だけ。main 以外を選んだ実行は、job の条件と environment の policy で止まる
- 出したあと、[公開の順番](publish.md) の「公開後の確認」を流す
