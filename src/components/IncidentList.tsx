import { Anchor, Box, Divider, Group, Paper, Stack, Text } from '@mantine/core'
import { Fragment } from 'react'
import type { IncidentGroup } from '@/src/util/incidents'
import { errorsWithMonitors } from '@/src/util/incidents'
import { formatDurationMinutes } from '@/src/util/duration'
import { useTranslation } from '@/src/util/i18n'

const dayKey = (sec: number) => new Date(sec * 1000).toDateString()
const formatDay = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
const formatClock = (sec: number) =>
  new Date(sec * 1000).toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit' })
// 開始日と違う日に終わったときだけ日付を付ける
const formatEnd = (start: number, end: number) =>
  dayKey(start) === dayKey(end)
    ? formatClock(end)
    : new Date(end * 1000).toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })

function IncidentRow({
  group,
  now,
  monitorName,
}: {
  group: IncidentGroup
  now: number
  monitorName: (id: string) => string
}) {
  const { t } = useTranslation('common')
  const ongoing = group.end === null
  const duration = formatDurationMinutes((group.end ?? now) - group.start)

  return (
    <Group align="flex-start" wrap="wrap" gap="xs" px="md" py="sm">
      <Box w={{ base: '100%', xs: 170 }} style={{ flexShrink: 0 }}>
        <Text size="sm" fw={600} c={ongoing ? 'red' : undefined}>
          {formatClock(group.start)} 〜 {ongoing ? '' : formatEnd(group.start, group.end!)}
        </Text>
        <Text size="xs" c={ongoing ? 'red' : 'dimmed'}>
          {ongoing ? t('Incident ongoing for', { duration }) : duration}
        </Text>
      </Box>
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        {errorsWithMonitors(group.incidents).map(({ label, raw, incidents }) => (
          <Text size="sm" key={label}>
            {incidents.map((incident, i) => (
              <Fragment key={incident.monitorId}>
                {i > 0 && '、'}
                {incident.ref ? (
                  <Anchor href={incident.ref} target="_blank" title={t('Original issue')} inherit>
                    {monitorName(incident.monitorId)}
                  </Anchor>
                ) : (
                  monitorName(incident.monitorId)
                )}
              </Fragment>
            ))}
            <Text
              span
              size="sm"
              c="dimmed"
              ml="xs"
              title={raw}
              style={{ display: 'inline-block' }}
            >
              {label}
            </Text>
          </Text>
        ))}
      </Stack>
    </Group>
  )
}

// 新しい順に並んだインシデントを、開始日ごとに区切って表示する
export default function IncidentList({
  groups,
  now,
  monitorName,
}: {
  groups: IncidentGroup[]
  now: number
  monitorName: (id: string) => string
}) {
  const days: IncidentGroup[][] = []
  for (const group of groups) {
    const last = days[days.length - 1]
    if (last && dayKey(last[0].start) === dayKey(group.start)) last.push(group)
    else days.push([group])
  }

  return (
    <Stack gap="lg">
      {days.map((day) => (
        <Box key={dayKey(day[0].start)}>
          <Text size="sm" fw={600} c="dimmed" mb={6}>
            {formatDay(day[0].start)}
          </Text>
          <Paper withBorder radius="md">
            {day.map((group, i) => (
              <Fragment key={`${group.start}-${group.incidents[0].monitorId}`}>
                {i > 0 && <Divider />}
                <IncidentRow group={group} now={now} monitorName={monitorName} />
              </Fragment>
            ))}
          </Paper>
        </Box>
      ))}
    </Stack>
  )
}
