import type { PublicMonitor } from '@/shared/config'
import { maintenances } from '@/page.config'
import OverallStatus from '@/src/components/OverallStatus'
import Header from '@/src/components/Header'
import MonitorList from '@/src/components/MonitorList'
import { Center, Text } from '@mantine/core'
import MonitorDetail from '@/src/components/MonitorDetail'
import Footer from '@/src/components/Footer'
import { useTranslation } from '@/src/util/i18n'
import { CompactedMonitorStateWrapper } from '@/shared/state'

export default function Home({
  compactedStateStr,
  monitors,
}: {
  compactedStateStr: string | null
  monitors: PublicMonitor[]
}) {
  const { t } = useTranslation('common')
  let state = new CompactedMonitorStateWrapper(compactedStateStr).uncompact()

  // Specify monitorId in URL hash to view a specific monitor (can be used in iframe)
  const monitorId = window.location.hash.substring(1)
  if (monitorId) {
    const monitor = monitors.find((monitor) => monitor.id === monitorId)
    if (!monitor || !state) {
      return <Text fw={700}>{t('Monitor not found', { id: monitorId })}</Text>
    }
    return (
      <div style={{ maxWidth: '810px' }}>
        <MonitorDetail monitor={monitor} state={state} />
      </div>
    )
  }

  return (
    <>
      <main>
        <Header />

        {state.lastUpdate === 0 ? (
          <Center>
            <Text fw={700}>{t('Monitor State not defined')}</Text>
          </Center>
        ) : (
          <div>
            <OverallStatus state={state} monitors={monitors} maintenances={maintenances} />
            <MonitorList monitors={monitors} state={state} />
          </div>
        )}

        <Footer />
      </main>
    </>
  )
}
