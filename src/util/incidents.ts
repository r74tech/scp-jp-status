import type { IncidentItem } from '@/shared/config'

// 時刻の表示（UNIX秒、ブラウザのローカル時刻）
export const dayKey = (sec: number) => new Date(sec * 1000).toDateString()
export const formatDay = (sec: number, withYear = false) =>
  new Date(sec * 1000).toLocaleDateString('ja-JP', {
    year: withYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
export const formatClock = (sec: number) =>
  new Date(sec * 1000).toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit' })
// 開始日と違う日に終わったときだけ日付を付ける
export const formatEnd = (start: number, end: number) =>
  dayKey(start) === dayKey(end)
    ? formatClock(end)
    : new Date(end * 1000).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })

// 期間が重なるインシデントのまとまり。同じ時間帯に落ちた複数の監視を1行で見せる
export type IncidentGroup = {
  start: number
  end: number | null // 継続中ならnull
  incidents: IncidentItem[]
}

// 期間が重なるインシデントを1つにまとめ、新しい順に返す
export function groupOverlapping(incidents: IncidentItem[], now: number): IncidentGroup[] {
  const sorted = [...incidents].sort((a, b) => a.start - b.start)
  const groups: IncidentGroup[] = []
  let groupEnd = -Infinity
  for (const incident of sorted) {
    const end = incident.end ?? now
    const last = groups[groups.length - 1]
    if (last && incident.start < groupEnd) {
      last.incidents.push(incident)
      last.end = last.end === null || incident.end === null ? null : Math.max(last.end, end)
      groupEnd = Math.max(groupEnd, end)
    } else {
      groups.push({ start: incident.start, end: incident.end, incidents: [incident] })
      groupEnd = end
    }
  }
  return groups.reverse()
}

// worker/monitor.ts と旧Upptimeが記録したエラー文を、画面向けの日本語にする。知らない形はそのまま返す
export function describeError(raw: string): string {
  const code = raw.match(/^Expected codes: .*, Got: (\d+)$/)
  if (code) return `HTTP ${code[1]} エラー`
  const timeout = raw.match(/^Timeout after (\d+)ms$/)
  if (timeout) return `応答なし（${Number(timeout[1]) / 1000}秒でタイムアウト）`
  if (raw === 'No response') return '応答なし'
  if (raw === "HTTP response doesn't contain the configured keyword") return 'ページの内容が想定と異なる'
  if (raw === 'HTTP response contains the configured forbidden keyword')
    return 'ページに異常を示す文字列がある'
  return raw
}

// 監視ごとのエラーを、同じエラー文ごとに監視をまとめた形にする（記録順）
export function errorsWithMonitors(
  incidents: IncidentItem[]
): { label: string; raw: string; incidents: IncidentItem[] }[] {
  const byLabel = new Map<string, { label: string; raw: string; incidents: IncidentItem[] }>()
  for (const incident of incidents) {
    const seen = new Set<string>()
    for (const [, raw] of incident.errors) {
      const label = describeError(raw)
      if (seen.has(label)) continue
      seen.add(label)
      const entry = byLabel.get(label) ?? { label, raw, incidents: [] }
      entry.incidents.push(incident)
      byLabel.set(label, entry)
    }
  }
  return [...byLabel.values()]
}
