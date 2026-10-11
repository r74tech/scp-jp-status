import ja from '../locales/ja.json'

// 表示は日本語のみ。react-i18next の useTranslation と同じ呼び出し形を保つ
type Key = keyof typeof ja

function t(key: Key, params: Record<string, string | number> = {}): string {
  return ja[key].replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ''))
}

export function useTranslation(_ns?: string) {
  return { t }
}
