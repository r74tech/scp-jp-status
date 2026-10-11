// ステータスページの表示設定とメンテナンス情報
// ブラウザ向けのバンドルに含まれるため、公開してよい情報だけを書く（監視先のヘッダーやbodyは uptime.config.ts へ）
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

// メンテナンス告知。ステータスページと /incidents に表示する
export const maintenances: MaintenanceConfig[] = []
