import { useI18n } from '../i18n/useI18n'
import { formatHourShort } from '../lib/time'
import type { HourPoint } from '../lib/types'
import { compassName, compassPoint, convertSpeed, formatNumber, formatSpeed, speedUnit } from '../lib/units'
import { PanelTitle } from './ui/primitives'
import s from './panels.module.css'

interface Props {
  hour: HourPoint
  next24: HourPoint[]
  isNow: boolean
  timeZone: string
}

const R = 58

/**
 * Rosa dos ventos: o ponto marca de onde o vento vem; a seta, para onde vai.
 * O anel externo mostra as direções das próximas 24h (opacidade cresce com a velocidade).
 */
export function WindPanel({ hour, next24, isNow, timeZone }: Props) {
  const { t, lang, locale, units } = useI18n()
  const dir = hour.windDirection
  const calm = hour.windSpeed !== null && hour.windSpeed < 1
  const name = compassName(dir, lang)
  const speeds = next24.map((h) => h.windSpeed).filter((v): v is number => v !== null)
  const maxSpeed = speeds.length ? Math.max(...speeds) : null
  const cardinals = lang === 'pt' ? ['N', 'L', 'S', 'O'] : ['N', 'E', 'S', 'W']
  const context = isNow ? t.now : formatHourShort(hour.time, timeZone, locale)

  return (
    <section className={s.panel} aria-labelledby="wind-title">
      <PanelTitle id="wind-title" title={t.windTitle} context={context} />
      <div className={s.windBody}>
        <svg width={R * 2 + 32} height={R * 2 + 32} viewBox={`${-R - 16} ${-R - 16} ${R * 2 + 32} ${R * 2 + 32}`} aria-hidden="true">
          <circle r={R} className={s.ring} />
          {Array.from({ length: 24 }, (_, i) => i * 15).map((a) => (
            <line key={a} y1={-R} y2={-R + (a % 90 === 0 ? 9 : 4)} transform={`rotate(${a})`} className={a % 90 === 0 ? s.tickMajor : s.tickMinor} />
          ))}
          {cardinals.map((c, i) => (
            <text key={c} x={Math.sin((i * Math.PI) / 2) * (R + 10)} y={-Math.cos((i * Math.PI) / 2) * (R + 10) + 4} textAnchor="middle" className={s.axisText}>
              {c}
            </text>
          ))}
          {/* Rastro das próximas 24h */}
          {next24.map((h) =>
            h.windDirection !== null && h.windSpeed !== null ? (
              <circle
                key={h.time}
                r={1.8}
                cx={Math.sin((h.windDirection * Math.PI) / 180) * (R + 1)}
                cy={-Math.cos((h.windDirection * Math.PI) / 180) * (R + 1)}
                className={s.trace}
                style={{ opacity: 0.15 + 0.6 * (h.windSpeed / Math.max(1, maxSpeed ?? 1)) }}
              />
            ) : null,
          )}
          {dir !== null && !calm && (
            <g style={{ transform: `rotate(${dir}deg)` }} className={s.needle}>
              <circle cy={-R + 14} r={4} className={s.needleTail} />
              <path d={`M0,${-R + 14} L0,${R - 14}`} className={s.needleLine} />
              <path d={`M-6,${R - 25} L0,${R - 13} L6,${R - 25}`} className={s.needleLine} />
            </g>
          )}
        </svg>
        <div className={s.windText}>
          <p>
            <span className={`${s.mid} numeral swap`} key={`${hour.time}${units}`}>
              {hour.windSpeed === null ? '—' : formatNumber(convertSpeed(hour.windSpeed, units), locale)}
            </span>{' '}
            <span className={s.unit}>{speedUnit(units)}</span>
          </p>
          <p className={s.muted}>{calm ? t.windCalm : name ? `${t.windFrom(name)} (${compassPoint(dir, lang)})` : '—'}</p>
          <p className={s.muted} style={{ marginTop: 12 }}>
            {t.gusts}
          </p>
          <p className={`${s.value} tabular`}>{formatSpeed(hour.windGusts, units, locale)}</p>
        </div>
      </div>
      <p className={s.small}>
        {t.windNext24}: {t.max} {formatSpeed(maxSpeed, units, locale)}
      </p>
    </section>
  )
}
