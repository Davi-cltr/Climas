import { useI18n } from '../i18n/useI18n'
import { thermalOffset } from '../lib/color'
import { extent } from '../lib/derive'
import { formatDayShort } from '../lib/time'
import type { DayPoint } from '../lib/types'
import { formatPercent, formatPrecip, formatTemp } from '../lib/units'
import { conditionLabel } from '../lib/weatherCodes'
import s from './WeekView.module.css'

/** Sete dias numa escala de temperatura compartilhada: as barras são comparáveis entre si. */
export function WeekView({ days, timeZone }: { days: DayPoint[]; timeZone: string }) {
  const { t, lang, locale, units } = useI18n()
  const ext = extent(days.flatMap((d) => [d.tempMin, d.tempMax])) ?? [0, 1]
  const span = Math.max(1, ext[1] - ext[0])
  const pos = (v: number) => ((v - ext[0]) / span) * 100

  return (
    <table className={s.table}>
      <caption className="visually-hidden">{t.weekTitle}</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">{t.colTime}</th>
          <th scope="col">{t.colCondition}</th>
          <th scope="col">
            {t.min} / {t.max}
          </th>
          <th scope="col">{t.colRain}</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d, i) => (
          <tr key={d.time}>
            <th scope="row" className={s.day}>
              {i === 0 ? t.today : formatDayShort(d.time, timeZone, locale)}
            </th>
            <td className={s.cond}>{conditionLabel(d.weatherCode, lang)}</td>
            <td className={s.rangeCell}>
              <span className={`${s.temp} tabular`}>{formatTemp(d.tempMin, units, locale)}</span>
              <span className={s.track} aria-hidden="true">
                {d.tempMin !== null && d.tempMax !== null && (
                  <span
                    className={s.bar}
                    style={{
                      left: `${pos(d.tempMin)}%`,
                      width: `${Math.max(2, pos(d.tempMax) - pos(d.tempMin))}%`,
                      // Cada barra pinta a fatia da rampa absoluta entre a mínima e a máxima do dia
                      backgroundImage: `linear-gradient(90deg, ${rampAt(thermalOffset(d.tempMin))}, ${rampAt(thermalOffset(d.tempMax))})`,
                    }}
                  />
                )}
              </span>
              <span className={`${s.temp} tabular`}>{formatTemp(d.tempMax, units, locale)}</span>
            </td>
            <td className={`${s.rain} tabular`}>
              {formatPercent(d.precipProbabilityMax, locale)}
              {d.precipitationSum ? <small>{formatPrecip(d.precipitationSum, units, locale)}</small> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Cor da rampa numa posição 0–1 via color-mix entre os tokens do tema. */
function rampAt(f: number) {
  const stops: [number, string][] = [
    [0, 'var(--t-cold)'],
    [0.487, 'var(--t-mild)'],
    [0.744, 'var(--t-warm)'],
    [1, 'var(--t-hot)'],
  ]
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i]
    const [a, ca] = stops[i - 1]
    if (f <= b) {
      const p = Math.round(((f - a) / (b - a)) * 100)
      return `color-mix(in oklab, ${ca} ${100 - p}%, ${cb})`
    }
  }
  return 'var(--t-hot)'
}
