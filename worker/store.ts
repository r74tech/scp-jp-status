// ステータスはD1の key-value テーブル（init.sql）に圧縮文字列で保存する
export async function getFromStore(env: Env, key: string): Promise<string | null> {
  const stmt = env.UPTIMEFLARE_D1.prepare('SELECT value FROM uptimeflare WHERE key = ?')
  const result = await stmt.bind(key).first<{ value: string }>()
  return result?.value || null
}

export async function setToStore(env: Env, key: string, value: string): Promise<void> {
  const stmt = env.UPTIMEFLARE_D1.prepare(
    'INSERT INTO uptimeflare (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;'
  )
  await stmt.bind(key, value).run()
}

// 閉じたインシデントを履歴テーブル（migrations/0002）に残す。同じ監視・開始時刻は1件にまとめる
export async function archiveIncident(
  env: Env,
  monitorId: string,
  incident: { start: number[]; end: number; error: string[] }
): Promise<void> {
  const errors = incident.start.map((t, i) => [t, incident.error[i]])
  await env.UPTIMEFLARE_D1.prepare(
    "INSERT OR IGNORE INTO incidents (monitor_id, start, end, errors, source) VALUES (?, ?, ?, ?, 'cron')"
  )
    .bind(monitorId, incident.start[0], incident.end, JSON.stringify(errors))
    .run()
}

export type ArchivedIncident = {
  monitor_id: string
  start: number
  end: number
  errors: string
  source: string
  ref: string | null
}

export async function listIncidents(env: Env, from: number, to: number): Promise<ArchivedIncident[]> {
  const { results } = await env.UPTIMEFLARE_D1.prepare(
    'SELECT monitor_id, start, end, errors, source, ref FROM incidents WHERE start >= ? AND start < ? ORDER BY start DESC'
  )
    .bind(from, to)
    .all<ArchivedIncident>()
  return results
}
