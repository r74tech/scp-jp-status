// 監視対象と通知の設定。Workerだけが読み、ブラウザには配信しない
// SCP-JP/wikidotupptime（Upptime）の .upptimerc.yml から移行した。項目の型は types/config.ts の WorkerConfig
import type { WorkerConfig } from './shared/config'

export const workerConfig: WorkerConfig = {
  monitors: [
    {
      id: 'wikidot',
      name: 'Wikidot',
      method: 'GET',
      target: 'https://www.wikidot.com/',
      statusPageLink: 'https://www.wikidot.com/',
    },
    {
      id: 'scp-jp',
      name: 'SCP-JP MAINサイト',
      method: 'GET',
      target: 'https://scp-jp.wikidot.com/',
      statusPageLink: 'https://scp-jp.wikidot.com/',
    },
    {
      id: 'scp-jp-sandbox3',
      name: 'SCP-JP サンドボックスⅢ(SB3)',
      method: 'GET',
      target: 'https://scp-jp-sandbox3.wikidot.com/',
      statusPageLink: 'https://scp-jp-sandbox3.wikidot.com/',
    },
    {
      id: 'scp-jp-storage',
      name: 'SCP-JP ファイルストレージ(FS)',
      method: 'GET',
      target: 'https://scp-jp-storage.wikidot.com/',
      statusPageLink: 'https://scp-jp-storage.wikidot.com/',
    },
    {
      id: '05command-ja',
      name: 'SCP-JP 財団日本支部理事会(05)',
      method: 'GET',
      target: 'https://05command-ja.wikidot.com/',
      statusPageLink: 'https://05command-ja.wikidot.com/',
    },
    {
      // AMCはエラー時もHTTP 200を返すため、レスポンス本文の status で判定する
      id: 'scp-jp-amc',
      name: 'SCP-JP AMC',
      method: 'POST',
      target: 'https://scp-jp.wikidot.com/ajax-module-connector.php',
      tooltip: 'ajax-module-connector.php（最近の更新モジュール）',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: 'wikidot_token7=123456',
      },
      body: 'wikidot_token7=123456&moduleName=changes%2FSiteChangesListModule',
      responseKeyword: '"status":"ok"',
    },
  ],
}
