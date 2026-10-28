import { useI18n } from '../i18n/useI18n'
import { formatClock, formatDuration } from '../lib/time'
import type { DayPoint } from '../lib/types'
import { useSize } from '../state/useSize'
import { PanelTitle } from './ui/primitives'
import s from './panels.module.css'

interface Props {
  today: DayPoint | null
  now: number
  timeZone: string
}

const H = 112
const BASE = 92
const ARC = 70

/**
 * Ciclo solar como fração de tempo entre nascer e pôr do sol.
 * O arco é uma representação temporal; não indica a elevação real do Sol.
 */
export function SunPanel({ today, now, timeZone }: Props) {
  const { t, lang, locale } = useI18n()
  const [ref, { width }] = useSize<HTMLDivElement>()
  const w = Math.max(180, width)
  const sunrise = today?.sunrise ?? null
  const sunset = today?.sunset ?? null

  if (sunrise === null || sunset === null || sunset <= sunrise) {
    return (
      <section className={s.panel} aria-labelledby="sun-title">
        <PanelTitle id="sun-title" title={t.sunTitle} context={t.today} />
        <p className={s.small}>{t.sunUnavailable}</p>
      </section>
    )
  }

  const frac = (now - sunrise) / (sunset - sunrise)
  const clamped = Math.max(0, Math.min(1, frac))
  const left = 8
  const right = w - 8
  const point = (f: number): [number, number] => [left + (right - left) * f, BASE - Math.sin(f * Math.PI) * ARC]
  const arcPath = (to: number) => {
    const pts: string[] = []
    for (let f = 0; f <= to + 1e-6; f += 0.02) pts.push(point(Math.min(f, to)).join(','))
    return `M${pts.join(' L')}`
  }
  const [sx, sy] = point(clamped)
  const up = frac > 0 && frac < 1

  let status: string
  if (frac <= 0) status = t.sunNotUp
  else if (frac >= 1) status = t.sunDown
  else status = `${t.daylightLeft}: ${formatDuration(sunset - now, lang)}`

  return (
    <section className={s.panel} aria-labelledby="sun-title">
      <PanelTitle id="sun-title" title={t.sunTitle} context={t.today} />
      <div ref={ref} className={s.chart}>
        <svg width={w} height={H} aria-hidden="true">
          <line x1={0} x2={w} y1={BASE} y2={BASE} className={s.horizon} />
          <path d={arcPath(1)} className={s.arcTrack} />
          {clamped > 0 && <path d={arcPath(clamped)} className={s.arcDone} />}
          <circle cx={sx} cy={up ? sy : BASE} r={up ? 6 : 4} className={up ? s.sun : s.sunDown} />
          <text x={left} y={BASE + 16} className={s.axisText}>
            {formatClock(sunrise, timeZone, locale)}
          </text>
          <text x={right} y={BASE + 16} textAnchor="end" className={s.axisText}>
            {formatClock(sunset, timeZone, locale)}
          </text>
        </svg>
      </div>
      <dl className={`${s.list} tabular`}>
        <dt>{t.sunrise}</dt>
        <dd>{formatClock(sunrise, timeZone, locale)}</dd>
        <dt>{t.sunset}</dt>
        <dd>{formatClock(sunset, timeZone, locale)}</dd>
        <dt>{t.daylightTotal}</dt>
        <dd>{formatDuration(sunset - sunrise, lang)}</dd>
      </dl>
      <p className={s.small}>{status}</p>
      <p className={s.footnote}>{t.sunNote}</p>
    </section>
  )
}
