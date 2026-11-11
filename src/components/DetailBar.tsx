import type { MonitorState, PublicMonitor } from '@/shared/config'
import { getColor } from '@/src/util/color'
import { Box, Tooltip, Modal, Group, Stack, Text } from '@mantine/core'
import { useResizeObserver } from '@mantine/hooks'
import { useState } from 'react'
import { useTranslation } from '@/src/util/i18n'
import { formatDurationMinutes } from '@/src/util/duration'
import { describeError, formatClock, formatDay, formatEnd } from '@/src/util/incidents'

// その日に重なる停止の区間。エラー文が途中で変わった停止は区間ごとに分かれる
type DayPart = { start: number; end: number; ongoing: boolean; error: string }

export default function DetailBar({
  monitor,
  state,
}: {
  monitor: PublicMonitor
  state: MonitorState
}) {
  const { t } = useTranslation('common')
  const [barRef, barRect] = useResizeObserver()
  const [modalOpened, setModalOpened] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modelContent, setModelContent] = useState(<div />)

  const overlapLen = (x1: number, x2: number, y1: number, y2: number) => {
    return Math.max(0, Math.min(x2, y2) - Math.max(x1, y1))
  }

  const uptimePercentBars = []

  const currentTime = Math.round(Date.now() / 1000)
  const montiorStartTime = state.incident[monitor.id][0].start[0]

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  for (let i = 89; i >= 0; i--) {
    const dayStart = Math.round(todayStart.getTime() / 1000) - i * 86400
    const dayEnd = dayStart + 86400

    const dayMonitorTime = overlapLen(dayStart, dayEnd, montiorStartTime, currentTime)
    let dayDownTime = 0

    const dayParts: DayPart[] = []

    for (let incident of state.incident[monitor.id]) {
      const incidentStart = incident.start[0]
      const incidentEnd = incident.end ?? currentTime

      const overlap = overlapLen(dayStart, dayEnd, incidentStart, incidentEnd)
      dayDownTime += overlap

      // Incident history for the day
      if (overlap > 0) {
        for (let i = 0; i < incident.error.length; i++) {
          const isLast = i === incident.error.length - 1
          let partStart = incident.start[i]
          let partEnd = isLast ? incident.end ?? currentTime : incident.start[i + 1]
          partStart = Math.max(partStart, dayStart)
          partEnd = Math.min(partEnd, dayEnd)

          if (overlapLen(dayStart, dayEnd, partStart, partEnd) > 0) {
            dayParts.push({
              start: partStart,
              end: partEnd,
              ongoing: isLast && incident.end === null && partEnd === currentTime,
              error: incident.error[i],
            })
          }
        }
      }
    }

    const dayPercent = (((dayMonitorTime - dayDownTime) / dayMonitorTime) * 100).toPrecision(4)

    uptimePercentBars.push(
      <Tooltip
        multiline
        key={i}
        events={{ hover: true, focus: false, touch: true }}
        label={
          Number.isNaN(Number(dayPercent)) ? (
            t('No Data')
          ) : (
            <>
              <div>
                {t('percent at date', {
                  percent: dayPercent,
                  date: new Date(dayStart * 1000).toLocaleDateString(),
                })}
              </div>
              {dayDownTime > 0 && (
                <div>
                  {t('Down for', {
                    duration: formatDurationMinutes(dayDownTime),
                  })}
                </div>
              )}
            </>
          )
        }
      >
        <div
          style={{
            height: '20px',
            width: '7px',
            background: getColor(dayPercent, false),
            borderRadius: '2px',
            marginLeft: '1px',
            marginRight: '1px',
          }}
          onClick={() => {
            if (dayDownTime > 0) {
              setModalTitle(
                t('incidents at', {
                  name: monitor.name,
                  date: formatDay(dayStart, true),
                })
              )
              setModelContent(
                <Stack gap={6}>
                  {dayParts.map((part, index) => (
                    <Group key={index} gap="md" wrap="nowrap" align="baseline">
                      <Text size="sm" fw={600} w={120} style={{ flexShrink: 0 }}>
                        {formatClock(part.start)} 〜{' '}
                        {part.ongoing ? '' : formatEnd(part.start, part.end)}
                      </Text>
                      <Text
                        size="sm"
                        c={part.ongoing ? 'red' : 'dimmed'}
                        w={part.ongoing ? undefined : 70}
                        style={{ flexShrink: 0 }}
                      >
                        {part.ongoing
                          ? t('Incident ongoing for', {
                              duration: formatDurationMinutes(part.end - part.start),
                            })
                          : formatDurationMinutes(part.end - part.start)}
                      </Text>
                      <Text size="sm" title={part.error}>
                        {describeError(part.error)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )
              setModalOpened(true)
            }
          }}
        />
      </Tooltip>
    )
  }

  return (
    <>
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={modalTitle}
        size={'40em'}
      >
        {modelContent}
      </Modal>
      <Box
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          marginTop: '10px',
          marginBottom: '5px',
        }}
        visibleFrom="540"
        ref={barRef}
      >
        {uptimePercentBars.slice(Math.floor(Math.max(9 * 90 - barRect.width, 0) / 9), 90)}
      </Box>
    </>
  )
}
