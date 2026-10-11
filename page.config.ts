// ステータスページの表示設定とメンテナンス情報
// ブラウザ向けのバンドルに含まれるため、公開してよい情報だけを書く（監視先の認証情報や通知先は uptime.config.ts へ）
import type { MaintenanceConfig, PageConfig } from './shared/config'

export const pageConfig: PageConfig = {
  title: 'SCP-JP 死活監視',
  links: [
    { link: 'https://scp-jp.wikidot.com/', label: 'SCP-JP' },
    { link: 'https://github.com/SCP-JP', label: 'GitHub' },
  ],
  group: {
    Wikidot: ['wikidot'],
    'SCP-JP': ['scp-jp', 'scp-jp-sandbox3', 'scp-jp-storage', '05command-ja', 'scp-jp-amc'],
  },
  favicon: 'https://scp-jp.wikidot.com/local--favicon/favicon.gif',
}

// メンテナンス中はステータスページに告知を出し、対象監視の通知を止める
export const maintenances: MaintenanceConfig[] = []
