import { scaleBand, scaleLinear } from 'd3-scale'
import { useI18n } from '../i18n/useI18n'
import { formatHourShort } from '../lib/time'
import type { HourPoint } from '../lib/types'
import { formatPercent, formatPrecip } from '../lib/units'
import { useSize } from '../state/useSize'
import { PanelTitle } from './ui/primitives'
import s from './panels.module.css'

interface Props {
  hours: HourPoint[]
  selectedTime: number
  onSelectTime: (ms: number) => void
  timeZone: string
}

const H = 150
const AXIS = 20

/** Próximas 12h: probabilidade (%) e volume (mm) em escalas separadas e identificadas. */
export function RainPanel({ hours, selectedTime, onSelectTime, timeZone }: Props) {
  const { t, locale, units } = useI18n()
  const [ref, { width }] = useSize<HTMLDivElement>()
  const data = hours.slice(0, 12)
  const w = Math.max(200, width)
  const x = scaleBand<number>()
    .domain(data.map((_, i) => i))
    .range([0, w - 34])
    .padding(0.28)
  const y = scaleLinear().domain([0, 100]).range([H - AXIS, 8])
  const mmMax = Math.max(4, ...data.map((d) => d.precipitation ?? 0))
  const yMm = scaleLinear().domain([0, mmMax]).range([H - AXIS, 8])
  const anyAmount = data.some((d) => (d.precipitation ?? 0) > 0)
  const anyProb = data.some((d) => (d.precipProbability ?? 0) > 0)
  const total = data.reduce((sum, d) => sum + (d.precipitation ?? 0), 0)

  return (
    <section className={s.panel} aria-labelledby="rain-title">
      <PanelTitle id="rain-title" title={t.rainTitle} context={t.next12h} />
      <div ref={ref} className={s.chart}>
        <svg width={w} height={H} aria-hidden="true">
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={0} x2={w - 34} y1={y(v)} y2={y(v)} className={s.gridLine} />
              <text x={w - 30} y={y(v) + 4} className={s.axisText}>
                {v}%
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const isSel = d.time === selectedTime
            return (
              <g key={d.time} className={s.barGroup} onClick={() => onSelectTime(d.time)}>
                <rect x={x(i)} y={0} width={x.bandwidth()} height={H - AXIS} fill="transparent" />
                {d.precipProbability !== null && d.precipProbability > 0 && (
                  <rect
                    x={x(i)}
                    y={y(d.precipProbability)}
                    width={x.bandwidth()}
                    height={y(0) - y(d.precipProbability)}
                    rx={2}
                    className={s.probBar}
                  />
                )}
                {d.precipitation !== null && d.precipitation > 0 && (
                  <rect x={x(i)} y={yMm(d.precipitation)} width={x.bandwidth()} height={Math.max(1.5, yMm(0) - yMm(d.precipitation))} rx={2} className={s.amountBar} />
                )}
                {isSel && <rect x={(x(i) ?? 0) - 2} y={2} width={x.bandwidth() + 4} height={H - AXIS - 2} rx={3} className={s.selBox} />}
                {i % 3 === 0 && (
                  <text x={(x(i) ?? 0) + x.bandwidth() / 2} y={H - 4} textAnchor="middle" className={s.axisText}>
                    {i === 0 ? t.now : formatHourShort(d.time, timeZone, locale)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <p className={s.small}>
        {!anyProb && !anyAmount ? t.rainNone : t.rainLegend}
        {anyAmount && (
          <>
            {' '}
            <span className="tabular">
              {t.rainAmount}: {formatPrecip(total, units, locale)}, {t.max} {formatPrecip(Math.max(...data.map((d) => d.precipitation ?? 0)), units, locale)}/h.
            </span>
          </>
        )}
      </p>
      <span className="visually-hidden">
        {data.map((d) => `${formatHourShort(d.time, timeZone, locale)}: ${formatPercent(d.precipProbability, locale)}, ${formatPrecip(d.precipitation, units, locale)}`).join('; ')}
      </span>
    </section>
  )
}
