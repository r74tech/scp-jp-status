import type { IncidentItem, MaintenanceConfig, PublicMonitor } from '@/shared/config'
import { maintenances } from '@/page.config'
import Header from '@/src/components/Header'
import { Box, Button, Center, Container, Group, Loader, Paper, Select, Text } from '@mantine/core'
import Footer from '@/src/components/Footer'
import { useEffect, useState } from 'react'
import MaintenanceAlert from '@/src/components/MaintenanceAlert'
import IncidentList from '@/src/components/IncidentList'
import { groupOverlapping } from '@/src/util/incidents'
import { formatDurationMinutes } from '@/src/util/duration'
import { useTranslation } from '@/src/util/i18n'

const toMonthStr = (date: Date) =>
  date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')

// 選択中の月（ブラウザのローカル時刻）の範囲をUNIX秒で返す
function monthRange(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number)
  return {
    from: new Date(year, month - 1, 1).getTime() / 1000,
    to: new Date(year, month, 1).getTime() / 1000,
  }
}

function getSelectedMonth() {
  const hash = window.location.hash.replace('#', '')
  if (!hash) return toMonthStr(new Date())
  return hash.split('-').splice(0, 2).join('-')
}

function filterMaintenancesByMonth(
  items: MaintenanceConfig[],
  monthStr: string,
  monitors: PublicMonitor[]
): (Omit<MaintenanceConfig, 'monitors'> & { monitors: PublicMonitor[] })[] {
  return items
    .filter((item) => toMonthStr(new Date(item.start)) === monthStr)
    .map((e) => ({
      ...e,
      monitors: (e.monitors || []).map((e) => monitors.find((mon) => mon.id === e)!),
    }))
    .sort((a, b) => (new Date(a.start) > new Date(b.start) ? -1 : 1))
}

function getPrevNextMonth(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number)
  return {
    prev: toMonthStr(new Date(year, month - 2)),
    next: toMonthStr(new Date(year, month)),
  }
}

export default function IncidentsPage({ monitors }: { monitors: PublicMonitor[] }) {
  const { t } = useTranslation('common')
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>('')
  const [selectedMonth, setSelectedMonth] = useState(getSelectedMonth())

  useEffect(() => {
    const onHashChange = () => setSelectedMonth(getSelectedMonth())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // 監視で自動記録されたインシデント（履歴テーブル＋継続中）
  const [incidents, setIncidents] = useState<IncidentItem[] | null>(null)
  const [incidentsError, setIncidentsError] = useState(false)
  useEffect(() => {
    const { from, to } = monthRange(selectedMonth)
    let cancelled = false
    setIncidents(null)
    setIncidentsError(false)
    const load = () =>
      fetch(`/api/incidents?from=${from}&to=${to}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<{ incidents: IncidentItem[] }>
        })
        .then((data) => {
          if (cancelled) return
          setIncidents(data.incidents)
          setIncidentsError(false)
        })
        .catch(() => !cancelled && setIncidentsError(true))
    load()
    // 停止の発生・復旧を開いたまま反映する（cronは10分ごと、取り直しは5分ごと）
    const timer = setInterval(load, 5 * 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [selectedMonth])

  const now = Math.floor(Date.now() / 1000)
  const monitorName = (id: string) => monitors.find((m) => m.id === id)?.name ?? id
  const groups = groupOverlapping(
    (incidents ?? []).filter((i) => !selectedMonitor || i.monitorId === selectedMonitor),
    now
  )
  // 月の合計は選択月の範囲に切って数える（前月から続いている停止や、継続中の停止の未来分を含めない）
  const { from: monthFrom, to: monthTo } = monthRange(selectedMonth)
  const totalDown = groups.reduce(
    (sum, g) =>
      sum + Math.max(0, Math.min(g.end ?? now, monthTo, now) - Math.max(g.start, monthFrom)),
    0
  )

  const monthMaintenances = filterMaintenancesByMonth(maintenances, selectedMonth, monitors).filter(
    (m) => !selectedMonitor || m.monitors.find((e) => e?.id === selectedMonitor)
  )

  const { prev, next } = getPrevNextMonth(selectedMonth)
  const [year, month] = selectedMonth.split('-').map(Number)
  const isCurrentOrLater = selectedMonth >= toMonthStr(new Date())

  const monitorOptions = [
    { value: '', label: t('All') },
    ...monitors.map((monitor) => ({ value: monitor.id, label: monitor.name })),
  ]

  return (
    <>
      <main>
        <Header style={{ marginBottom: '40px' }} />
        <Center>
          <Container size="md" style={{ width: '100%' }}>
            <Group justify="space-between" mb="sm">
              <Button variant="default" onClick={() => (window.location.hash = prev)}>
                {t('Backwards')}
              </Button>
              <Text fw={600} size="lg">
                {t('Month label', { year, month })}
              </Text>
              <Button
                variant="default"
                disabled={isCurrentOrLater}
                onClick={() => (window.location.hash = next)}
              >
                {t('Forward')}
              </Button>
            </Group>
            <Group justify="space-between" mb="lg" wrap="wrap">
              <Text size="sm" c="dimmed">
                {incidents !== null &&
                  groups.length > 0 &&
                  t('Month summary', {
                    count: groups.length,
                    duration: formatDurationMinutes(totalDown),
                  })}
              </Text>
              <Select
                placeholder={t('Select monitor')}
                data={monitorOptions}
                value={selectedMonitor}
                onChange={setSelectedMonitor}
                clearable
                style={{ width: 300, maxWidth: '100%' }}
              />
            </Group>
            <Box>
              {monthMaintenances.map((maintenance, i) => (
                <MaintenanceAlert key={i} maintenance={maintenance} style={{ marginBottom: 16 }} />
              ))}
              {incidentsError ? (
                <Text c="red">{t('Failed to load incidents')}</Text>
              ) : incidents === null ? (
                <Center py="xl">
                  <Loader size="sm" />
                </Center>
              ) : groups.length > 0 ? (
                <IncidentList groups={groups} now={now} monitorName={monitorName} />
              ) : (
                monthMaintenances.length === 0 && (
                  <Paper withBorder radius="md" p="md">
                    <Text c="dimmed">{t('No incidents in this month')}</Text>
                  </Paper>
                )
              )}
            </Box>
          </Container>
        </Center>
        <Footer />
      </main>
    </>
  )
}
