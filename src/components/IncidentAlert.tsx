import { Alert, Anchor, List, Text } from '@mantine/core'
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react'
import type { IncidentItem } from '@/shared/config'
import { formatDuration } from '@/src/util/duration'
import { useTranslation } from '@/src/util/i18n'

const formatTime = (sec: number) => new Date(sec * 1000).toLocaleString('ja-JP')

export default function IncidentAlert({
  incident,
  monitorName,
}: {
  incident: IncidentItem
  monitorName: string
}) {
  const { t } = useTranslation('common')
  const ongoing = incident.end === null
  const end = incident.end ?? Math.floor(Date.now() / 1000)
  const period = {
    start: formatTime(incident.start),
    end: formatTime(end),
    duration: formatDuration(end - incident.start),
  }

  return (
    <Alert
      icon={ongoing ? <IconAlertCircle /> : <IconCircleCheck />}
      title={
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>
          {t(ongoing ? 'Incident ongoing' : 'Incident resolved', { name: monitorName })}
        </span>
      }
      color={ongoing ? 'red' : 'gray'}
      withCloseButton={false}
      style={{ margin: '16px auto 0 auto' }}
    >
      <Text size="sm">
        {t(ongoing ? 'Incident period ongoing' : 'Incident period', period)}
      </Text>
      <List size="sm" mt={4}>
        {incident.errors.map(([at, error]) => (
          <List.Item key={at}>
            {formatTime(at)} {error}
          </List.Item>
        ))}
      </List>
      {incident.ref && (
        <Anchor href={incident.ref} target="_blank" size="sm">
          {t('Original issue')}
        </Anchor>
      )}
    </Alert>
  )
}
