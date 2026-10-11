// ステータスはD1の key-value テーブル（init.sql）に圧縮文字列で保存する
export async function getFromStore(env: Env, key: string): Promise<string | null> {
  const stmt = env.UPTIMEFLARE_D1.prepare('SELECT value FROM uptimeflare WHERE key = ?')
  const result = await stmt.bind(key).first<{ value: string }>()
  return result?.value || null
}

export function setToStoreStatement(env: Env, key: string, value: string): D1PreparedStatement {
  return env.UPTIMEFLARE_D1.prepare(
    'INSERT INTO uptimeflare (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;'
  ).bind(key, value)
}

// 閉じたインシデントを履歴テーブル（migrations/0002）に残す文。状態JSONの保存と同じbatchで実行する
// （片方だけ成功すると、次のcronが古い「継続中」から再処理して履歴と食い違うため）
export function archiveIncidentStatement(
  env: Env,
  monitorId: string,
  incident: { start: number[]; end: number; error: string[] }
): D1PreparedStatement {
  const errors = incident.start.map((t, i) => [t, incident.error[i]])
  return env.UPTIMEFLARE_D1.prepare(
    "INSERT OR IGNORE INTO incidents (monitor_id, start, end, errors, source) VALUES (?, ?, ?, ?, 'cron')"
  ).bind(monitorId, incident.start[0], incident.end, JSON.stringify(errors))
}

export type ArchivedIncident = {
  monitor_id: string
  start: number
  end: number
  errors: string
  source: string
  ref: string | null
}

export async function listIncidents(
  env: Env,
  from: number,
  to: number
): Promise<ArchivedIncident[]> {
  const { results } = await env.UPTIMEFLARE_D1.prepare(
    'SELECT monitor_id, start, end, errors, source, ref FROM incidents WHERE start >= ? AND start < ? ORDER BY start DESC'
  )
    .bind(from, to)
    .all<ArchivedIncident>()
  return results
}

// 指定時刻以降に終わったインシデントを古い順に返す
export async function listMonitorIncidents(
  env: Env,
  monitorId: string,
  endedAfter: number
): Promise<ArchivedIncident[]> {
  const { results } = await env.UPTIMEFLARE_D1.prepare(
    'SELECT monitor_id, start, end, errors, source, ref FROM incidents WHERE monitor_id = ? AND end >= ? ORDER BY start ASC'
  )
    .bind(monitorId, endedAfter)
    .all<ArchivedIncident>()
  return results
}
