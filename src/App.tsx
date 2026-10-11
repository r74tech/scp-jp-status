import { useEffect, useState } from 'react'
import { Center, Loader, Text } from '@mantine/core'
import type { PublicMonitor } from '@/shared/config'
import StatusPage from '@/src/pages/StatusPage'
import IncidentsPage from '@/src/pages/IncidentsPage'

type StatusResponse = { state: string | null; monitors: PublicMonitor[] }

// 1分ごとにcronが状態を更新するので、表示側も同じ間隔で取り直す
const REFRESH_MS = 60_000

export default function App() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/status')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData(await res.json())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  if (!data) {
    return (
      <Center h="100vh">
        {error ? <Text c="red">読み込みに失敗しました（{error}）</Text> : <Loader />}
      </Center>
    )
  }

  if (window.location.pathname === '/incidents') {
    return <IncidentsPage monitors={data.monitors} />
  }
  return <StatusPage compactedStateStr={data.state} monitors={data.monitors} />
}
