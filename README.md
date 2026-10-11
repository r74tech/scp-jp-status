# SCP-JP 死活監視

SCP-JPのWikidotサイト群を毎分監視し、ステータスページを公開する。旧[SCP-JP/wikidotupptime](https://github.com/SCP-JP/wikidotupptime)（Upptime）の置き換え。

Cloudflare Workers 1本で動く。

- cronで毎分監視し、結果をD1に保存する（`worker/index.ts`）
- 同じWorkerが `/api/*` に応答し（`worker/api.ts`）、それ以外はViteでビルドしたSPA（`src/`）を配信する

## 設定ファイル

| ファイル | 中身 | 読む側 |
|---|---|---|
| `uptime.config.ts` | 監視対象（URL・ヘッダ・body・判定キーワード）と通知 | Workerだけ |
| `page.config.ts` | ページタイトル・リンク・グループ分け・メンテナンス告知 | Workerとブラウザ |

`page.config.ts` はブラウザ向けのバンドルに入るので、認証情報や通知先を書かない。監視対象を足すときは `uptime.config.ts` の `monitors` に追記し、グループに載せるなら `page.config.ts` の `group` にもidを足す。`id` を変えると過去の履歴が引き継がれない。

## 開発

```sh
npm install
npx wrangler d1 execute uptimeflare_d1 --local --file init.sql   # 初回のみ
npm run dev
```

監視を1回走らせるには、devサーバ起動中に `curl http://localhost:5173/cdn-cgi/handler/scheduled` を叩く。

## 初回セットアップ（Cloudflare）

1. D1を作り、出力された `database_id` を `wrangler.jsonc` に書く

   ```sh
   npx wrangler d1 create uptimeflare_d1
   ```

2. テーブルを作る

   ```sh
   npx wrangler d1 execute uptimeflare_d1 --remote --file init.sql
   ```

3. GitHubリポジトリのSecretsに `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録する。トークンにはWorkers ScriptsとD1の編集権限を付ける
4. mainへpushするか、Actionsから `Deploy to Cloudflare` を手動実行する（中身は `npm run deploy`）
5. Workerに `status.scp-jp.org` のカスタムドメインを付ける

## ライセンス

Apache License 2.0（[LICENSE](LICENSE)）。監視・状態保存・画面のコードは [lyc8503/UptimeFlare](https://github.com/lyc8503/UptimeFlare)（Copyright lyc8503）を元に、SCP-JP向けに改変した。主な改変はDurable Object・地域指定チェック・Next.js・多言語表示の削除と、Vite SPAとWorker 1本の構成への移行。
