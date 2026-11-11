import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-moment'
import { useState } from 'react'
import { Group, SegmentedControl, Text } from '@mantine/core'
import type { MonitorState, PublicMonitor } from '@/shared/config'
import { codeToCountry } from '@/src/util/iata'
import { useTranslation } from '@/src/util/i18n'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  TimeScale
)

// 表示期間（秒）。最長はworker/index.tsのLATENCY_RETENTIONに合わせる
const RANGES = [
  { label: '12時間', value: String(12 * 60 * 60) },
  { label: '1日', value: String(24 * 60 * 60) },
  { label: '3日', value: String(3 * 24 * 60 * 60) },
  { label: '1週間', value: String(7 * 24 * 60 * 60) },
]

// グラフ1本に描く点の上限。横幅（700px前後）より細かく描いても見分けられないため
const MAX_POINTS = 150

type ChartPoint = { x: number; y: number; loc: string }

// 期間を MAX_POINTS 個の区間に分け、区間ごとに応答時間を平均する。上限以下ならそのまま返す
function downsample(points: ChartPoint[], xMin: number, xMax: number): ChartPoint[] {
  if (points.length <= MAX_POINTS) return points
  const width = (xMax - xMin) / MAX_POINTS
  const buckets: ChartPoint[][] = []
  for (const point of points) {
    const i = Math.min(MAX_POINTS - 1, Math.floor((point.x - xMin) / width))
    ;(buckets[i] ??= []).push(point)
  }
  return buckets
    .filter(Boolean)
    .map((bucket) => ({
      x: bucket.reduce((sum, p) => sum + p.x, 0) / bucket.length,
      y: Math.round(bucket.reduce((sum, p) => sum + p.y, 0) / bucket.length),
      // 監視地点が混ざった区間の平均は、どの地点の値でもないので地点を出さない
      loc: bucket.every((p) => p.loc === bucket[0].loc) ? bucket[0].loc : '',
    }))
}

export default function DetailChart({
  monitor,
  state,
}: {
  monitor: PublicMonitor
  state: MonitorState
}) {
  const { t } = useTranslation('common')
  const [range, setRange] = useState(RANGES[0].value)
  // 横軸は選んだ期間の全体を取る。保存期間を延ばした直後など、データが期間に満たないときも軸の幅を揃えるため
  const xMax = Date.now()
  const xMin = xMax - Number(range) * 1000
  const latencyData = downsample(
    state.latency[monitor.id]
      .filter((point) => point.time * 1000 >= xMin)
      .map((point) => ({
        x: point.time * 1000,
        y: point.ping,
        loc: point.loc,
      })),
    xMin,
    xMax
  )

  let data = {
    datasets: [
      {
        data: latencyData,
        borderColor: 'rgb(112, 119, 140)',
        borderWidth: 2,
        radius: 0,
        cubicInterpolationMode: 'monotone' as const,
        tension: 0.4,
      },
    ],
  }

  let options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    animation: {
      duration: 0,
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (item: any) => {
            if (item.parsed.y) {
              return item.raw.loc
                ? `${item.parsed.y}ms (${codeToCountry(item.raw.loc)})`
                : `${item.parsed.y}ms`
            }
          },
        },
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        min: xMin,
        max: xMax,
        ticks: {
          source: 'auto' as const,
          maxRotation: 0,
          autoSkip: true,
        },
      },
    },
  }

  return (
    <>
      <Group justify="space-between" mt="xs">
        <Text size="xs" fw={600} c="dimmed">
          {t('Response times')}
        </Text>
        <SegmentedControl size="xs" data={RANGES} value={range} onChange={setRange} />
      </Group>
      <div style={{ height: '150px' }}>
        <Line options={options} data={data} />
      </div>
    </>
  )
}
