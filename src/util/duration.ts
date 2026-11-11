// 秒数を分単位に丸めて「1日2時間5分」の形にする。監視は10分おきなので秒を出しても意味がない
export function formatDurationMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 1) return '1分未満'
  return formatDuration(minutes * 60)
}

// 秒数を「1日2時間5分3秒」の形にする
export function formatDuration(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.round(totalSeconds % 60)
  return (
    [d && `${d}日`, h && `${h}時間`, m && `${m}分`, s && `${s}秒`].filter(Boolean).join('') || '0秒'
  )
}
