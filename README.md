# SCP-JP 死活監視

SCP-JPのWikidotサイト群を10分ごとに監視し、ステータスページを公開する。旧[SCP-JP/wikidotupptime](https://github.com/SCP-JP/wikidotupptime)（Upptime）の置き換え。

Cloudflare Workers 1本で動く。

- cronで10分ごとに監視し、結果をD1に保存する（`worker/index.ts`）
- 同じWorkerが `/api/*` に応答し（`worker/api.ts`）、それ以外はViteでビルドしたSPA（`src/`）を配信する

## 設定ファイル

| ファイル | 中身 | 読む側 |
|---|---|---|
| `uptime.config.ts` | 監視対象（URL・ヘッダ・body・判定キーワード） | Workerだけ |
| `page.config.ts` | ページタイトル・リンク・グループ分け・メンテナンス告知 | Workerとブラウザ |

`page.config.ts` はブラウザ向けのバンドルに入るので、監視先のヘッダーやbodyを書かない。監視対象を足すときは `uptime.config.ts` の `monitors` に追記し、グループに載せるなら `page.config.ts` の `group` にもidを足す。`id` を変えると過去の履歴が引き継がれない。

## インシデント

監視が落ちたと判定した時点で自動で開き、正常に戻った時点で閉じる。閉じたものはD1の `incidents` テーブルに残り、`/incidents` で月ごとに見られる。各監視の日ごとのバー（直近90日）は状態JSONから描く。旧wikidotupptimeのissue 137件は `migrations/0003` で取り込み済み。

`page.config.ts` の `maintenances` に書いたメンテナンス告知も `/incidents` に並ぶ。

## 開発

```sh
npm install
npx wrangler d1 migrations apply uptimeflare_d1 --local
npm run dev
```

監視を1回走らせるには、devサーバ起動中に `curl http://localhost:5173/cdn-cgi/handler/scheduled` を叩く。

## デプロイ

Cloudflareの[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)でこのリポジトリと接続し、mainへのpushでCloudflare側がビルドとデプロイを行う。GitHub Actionsは使わない。

Workers Buildsの設定:

| 項目 | 値 |
|---|---|
| Git branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler d1 migrations apply uptimeflare_d1 --remote && npx wrangler deploy` |

Workers Buildsが自動で作るAPIトークンにはD1の権限が無い。Deploy commandでmigrationを流すため、そのトークンに「D1 編集」を足す。

公開先のホスト名は `wrangler.jsonc` の `routes`（Custom Domain）で決まり、デプロイ時に付く。今は `status.r74.tech`。

### 別のアカウントに作り直すとき

1. D1を作り、出力された `database_id` を `wrangler.jsonc` に書く

   ```sh
   npx wrangler d1 create uptimeflare_d1
   ```

2. `wrangler.jsonc` の `routes` を、そのアカウントにあるゾーンのホスト名に変える
3. Workers Buildsでリポジトリと接続する（上の表のとおり）

## DBスキーマの変更

`migrations/` に連番のSQLを足す。mainへのpushでデプロイ前に本番へ適用される。

```sh
npx wrangler d1 migrations create uptimeflare_d1 <変更内容>
npx wrangler d1 migrations apply uptimeflare_d1 --local
```

## ライセンス

Apache License 2.0（[LICENSE](LICENSE)）。監視・状態保存・画面のコードは [lyc8503/UptimeFlare](https://github.com/lyc8503/UptimeFlare)（Copyright lyc8503）を元に、SCP-JP向けに改変した。主な改変はDurable Object・地域指定チェック・Next.js・多言語表示の削除と、Vite SPAとWorker 1本の構成への移行。
