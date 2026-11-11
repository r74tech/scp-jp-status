import { Anchor, Box, Divider, Group, Paper, Stack, Text } from '@mantine/core'
import { Fragment } from 'react'
import type { IncidentGroup } from '@/src/util/incidents'
import {
  dayKey,
  errorsWithMonitors,
  formatClock,
  formatDay,
  formatEnd,
} from '@/src/util/incidents'
import { formatDurationMinutes } from '@/src/util/duration'
import { useTranslation } from '@/src/util/i18n'

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
