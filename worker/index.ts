import { workerConfig } from '../uptime.config'
import { doMonitor } from './monitor'
import { getWorkerLocation } from './util'
import { CompactedMonitorStateWrapper } from '../shared/state'
import {
  archiveIncidentStatement,
  getFromStore,
  listMonitorIncidents,
  setToStoreStatement,
} from './store'
import { handleApi } from './api'
import pLimit from 'p-limit'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleApi(request, env)
  },

  async scheduled(_controller, env): Promise<void> {
    const workerLocation = (await getWorkerLocation()) || 'ERROR'
    console.log(`Running scheduled event on ${workerLocation}...`)

    // Create a wrapped MonitorState from stored compacted state
    const state = new CompactedMonitorStateWrapper(await getFromStore(env, 'state'))
    state.data.overallDown = 0
    state.data.overallUp = 0

    let statusChanged = false
    // 閉じたインシデントの履歴INSERT。状態JSONの保存と同じbatchで流す（閉じた監視があれば statusChanged も立つ）
    const archives: D1PreparedStatement[] = []
    const currentTimeSecond = Math.round(Date.now() / 1000)

    // Parallel check multiple monitors
    // Max concurrent connection is 6 limited by Cloudflare Workers, we use 5 here to be safe
    type CheckResult = { id: string; location: string; status: { ping: number; up: boolean; err: string } }
    let checkQueue: Promise<CheckResult>[] = []
    let checkResult: Record<string, CheckResult> = {};
    const limit = pLimit(5);
    for (const monitor of workerConfig.monitors) {
      checkQueue.push(limit(() => doMonitor(monitor, workerLocation)))
    }
    for (const result of await Promise.all(checkQueue)) {
      checkResult[result.id] = result
    }

    // Update each monitor's state based on check results
    for (const monitor of workerConfig.monitors) {
      console.log(`Processing monitor result: ${monitor.name} (${monitor.id})`)

      let monitorStatusChanged = false
      const { location: checkLocation, status } = checkResult[monitor.id]

      // Update counters
      status.up ? state.data.overallUp++ : state.data.overallDown++

      // Update incidents
      // 初回（状態JSONにこの監視が無い）は監視開始時刻と直近90日の停止記録を履歴テーブルから作る
      if (state.incidentLen(monitor.id) === 0) {
        await seedIncidents(env, state, monitor.id, currentTimeSecond)
      }

      // Then lastIncident here must not be null
      let lastIncident = state.getIncident(monitor.id, state.incidentLen(monitor.id) - 1)

      if (status.up) {
        // Current status is up
        // close existing incident if any
        if (lastIncident.end === null) {
          lastIncident.end = currentTimeSecond
          // write back the modified last incident
          state.setIncident(monitor.id, state.incidentLen(monitor.id) - 1, lastIncident)
          archives.push(
            archiveIncidentStatement(env, monitor.id, { ...lastIncident, end: currentTimeSecond })
          )

          monitorStatusChanged = true
        }
      } else {
        // Current status is down
        // open new incident if not already open
        if (lastIncident.end !== null) {
          state.appendIncident(monitor.id, {
            start: [currentTimeSecond],
            end: null,
            error: [status.err],
          })
          monitorStatusChanged = true
        } else if (lastIncident.end === null && lastIncident.error.slice(-1)[0] !== status.err) {
          // append if the error message changes
          lastIncident.start.push(currentTimeSecond)
          lastIncident.error.push(status.err)

          // write back the modified last incident
          state.setIncident(monitor.id, state.incidentLen(monitor.id) - 1, lastIncident)
          monitorStatusChanged = true
        }
      }

      // append to latency data
      state.appendLatency(monitor.id, {
        loc: checkLocation,
        ping: status.ping,
        time: currentTimeSecond,
      })

      // discard old data
      while (state.getFirstLatency(monitor.id).time < currentTimeSecond - 12 * 60 * 60) {
        state.unshiftLatency(monitor.id)
      }

      // discard old incidents
      while (
        state.incidentLen(monitor.id) > 0 &&
        state.getIncident(monitor.id, 0).end &&
        state.getIncident(monitor.id, 0).end! < currentTimeSecond - 90 * 24 * 60 * 60
      ) {
        state.shiftIncident(monitor.id)
      }

      if (
        state.incidentLen(monitor.id) === 0 ||
        (state.getIncident(monitor.id, 0).start[0] > currentTimeSecond - 90 * 24 * 60 * 60 &&
          state.getIncident(monitor.id, 0).error[0] != 'dummy')
      ) {
        // put the dummy incident back
        state.unshiftIncident(monitor.id, {
          start: [currentTimeSecond - 90 * 24 * 60 * 60],
          end: currentTimeSecond - 90 * 24 * 60 * 60,
          error: ['dummy'],
        })
      }

      statusChanged ||= monitorStatusChanged
    }

    console.log(
      `statusChanged: ${statusChanged}, lastUpdate: ${state.data.lastUpdate}, currentTime: ${currentTimeSecond}`
    )
    // Update state
    // Allow for a cooldown period before writing to storage
    if (
      statusChanged ||
      currentTimeSecond - state.data.lastUpdate >=
        (workerConfig.kvWriteCooldownMinutes ?? 3) * 60 - 10 // Allow for 10 seconds of clock drift
    ) {
      console.log('Updating state...')
      state.data.lastUpdate = currentTimeSecond
      await env.UPTIMEFLARE_D1.batch([
        ...archives,
        setToStoreStatement(env, 'state', state.getCompactedStateStr()),
      ])
    } else {
      console.log('Skipping state update due to cooldown period.')
    }
  },
} satisfies ExportedHandler<Env>

const NINETY_DAYS = 90 * 24 * 60 * 60

// 状態JSONに監視を初めて載せるときの初期化。先頭のdummyインシデントの時刻が監視開始時刻になり、
// 日ごとの稼働率バーはそれ以降を「監視時間 − 停止時間」で計算する
// 履歴テーブルに記録がある監視（旧Upptimeから引き継いだもの等）は90日前から監視していた扱いにして停止記録を載せる。
// 記録が無い監視は今から監視開始
async function seedIncidents(
  env: Env,
  state: CompactedMonitorStateWrapper,
  monitorId: string,
  now: number
): Promise<void> {
  const rows = await listMonitorIncidents(env, monitorId, now - NINETY_DAYS)
  if (rows.length === 0) {
    state.appendIncident(monitorId, { start: [now], end: now, error: ['dummy'] })
    return
  }

  const since = Math.min(now - NINETY_DAYS, rows[0].start)
  state.appendIncident(monitorId, { start: [since], end: since, error: ['dummy'] })
  for (const row of rows) {
    const errors: [number, string][] = JSON.parse(row.errors)
    state.appendIncident(monitorId, {
      start: errors.map(([t]) => t),
      end: row.end,
      error: errors.map(([, e]) => e),
    })
  }
  console.log(`[${monitorId}] seeded ${rows.length} incidents from history since ${since}`)
}
