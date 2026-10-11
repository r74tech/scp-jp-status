import { maintenances } from '../page.config'
import type { PublicMonitor } from '../shared/config'
import { CompactedMonitorStateWrapper } from '../shared/state'
import { workerConfig } from '../uptime.config'
import { getFromStore } from './store'

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
