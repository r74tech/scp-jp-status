import { maintenances } from '../page.config'
import type { IncidentItem, PublicMonitor } from '../shared/config'
import { CompactedMonitorStateWrapper } from '../shared/state'
import { workerConfig } from '../uptime.config'
import { getFromStore, listIncidents } from './store'

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

// ブラウザに渡すのは表示に使う項目だけ。target・headers・body は渡さない
const publicMonitors: PublicMonitor[] = workerConfig.monitors.map((monitor) => ({
  id: monitor.id,
  name: monitor.name,
  tooltip: monitor.tooltip,
  statusPageLink: monitor.statusPageLink,
  hideLatencyChart: monitor.hideLatencyChart,
}))

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (request.method !== 'GET') {
    return new Response(null, { status: 405 })
  }

  // ステータスページ用: 圧縮したままの状態を返し、展開はブラウザで行う（WorkerのCPU時間を抑えるため）
  if (pathname === '/api/status') {
    const state = await getFromStore(env, 'state')
    return new Response(JSON.stringify({ state, monitors: publicMonitors }), {
      headers: jsonHeaders,
    })
  }

  // インシデント履歴: 期間内に始まったもの（UNIX秒、from以上to未満）。開いているものは状態JSONから足す
  if (pathname === '/api/incidents') {
    const params = new URL(request.url).searchParams
    const from = Number(params.get('from'))
    const to = Number(params.get('to'))
    if (!Number.isInteger(from) || !Number.isInteger(to) || from >= to) {
      return new Response(JSON.stringify({ error: 'from and to must be integers (from < to)' }), {
        status: 400,
        headers: jsonHeaders,
      })
    }
    return new Response(JSON.stringify({ incidents: await getIncidents(env, from, to) }), {
      headers: jsonHeaders,
    })
  }

  // 外部向けの要約JSON
  if (pathname === '/api/data') {
    return getSummary(env)
  }

  return new Response(null, { status: 404 })
}

async function getSummary(env: Env): Promise<Response> {
  const headers = { ...jsonHeaders, 'Access-Control-Allow-Origin': '*' }
  const state = new CompactedMonitorStateWrapper(await getFromStore(env, 'state'))

  if (state.data.lastUpdate === 0) {
    return new Response(JSON.stringify({ error: 'No data available' }), { status: 500, headers })
  }

  const monitors: Record<string, unknown> = {}
  for (const monitor of workerConfig.monitors) {
    // 追加直後でまだcronが1回も記録していない監視
    if (state.incidentLen(monitor.id) === 0) {
      monitors[monitor.id] = { up: null, latency: null, location: null, message: 'No data yet' }
      continue
    }
    const lastIncident = state.getIncident(monitor.id, state.incidentLen(monitor.id) - 1)
    const isUp = lastIncident?.end !== null
    const latency = state.getLastLatency(monitor.id)
    monitors[monitor.id] = {
      up: isUp,
      latency: latency.ping,
      location: latency.loc,
      message: isUp ? 'OK' : lastIncident?.error[lastIncident.error.length - 1],
    }
  }

  return new Response(
    JSON.stringify({
      up: state.data.overallUp,
      down: state.data.overallDown,
      updatedAt: state.data.lastUpdate,
      monitors,
      maintenances,
    }),
    { headers }
  )
}

async function getIncidents(env: Env, from: number, to: number): Promise<IncidentItem[]> {
  const archived: IncidentItem[] = (await listIncidents(env, from, to)).map((row) => ({
    monitorId: row.monitor_id,
    start: row.start,
    end: row.end,
    errors: JSON.parse(row.errors),
    ref: row.ref,
  }))

  const state = new CompactedMonitorStateWrapper(await getFromStore(env, 'state'))
  const open: IncidentItem[] = []
  for (const monitor of workerConfig.monitors) {
    const len = state.incidentLen(monitor.id)
    if (len === 0) continue
    const last = state.getIncident(monitor.id, len - 1)
    if (last.end === null && last.start[0] >= from && last.start[0] < to) {
      open.push({
        monitorId: monitor.id,
        start: last.start[0],
        end: null,
        errors: last.start.map((t, i) => [t, last.error[i]]),
        ref: null,
      })
    }
  }
  return [...open, ...archived]
}
