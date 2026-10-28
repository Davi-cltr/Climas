import { useI18n } from '../i18n/useI18n'
import { formatDayShort, formatHourShort } from '../lib/time'
import type { HourPoint } from '../lib/types'
import { compassPoint, formatPercent, formatPrecip, formatSpeed, formatTemp } from '../lib/units'
import { conditionLabel } from '../lib/weatherCodes'
import s from './HourTable.module.css'

/** Alternativa textual completa à linha do tempo. */
export function HourTable({ hours, timeZone, selected }: { hours: HourPoint[]; timeZone: string; selected: number }) {
  const { t, lang, locale, units } = useI18n()
  return (
    <div className={s.wrap} tabIndex={0} role="region" aria-label={t.hourTable}>
      <table className={`${s.table} tabular`}>
        <caption className="visually-hidden">{t.hourTable}</caption>
        <thead>
          <tr>
            <th scope="col">{t.colTime}</th>
            <th scope="col">{t.colCondition}</th>
            <th scope="col">{t.colTemp}</th>
            <th scope="col">{t.rainChance}</th>
            <th scope="col">{t.rainAmount}</th>
            <th scope="col">{t.colWind}</th>
            <th scope="col">{t.gusts}</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h, i) => (
            <tr key={h.time} aria-current={i === selected ? 'true' : undefined}>
              <th scope="row">
                {formatDayShort(h.time, timeZone, locale)} {formatHourShort(h.time, timeZone, locale)}
              </th>
              <td>{conditionLabel(h.weatherCode, lang)}</td>
              <td>{formatTemp(h.temperature, units, locale)}</td>
              <td>{formatPercent(h.precipProbability, locale)}</td>
              <td>{formatPrecip(h.precipitation, units, locale)}</td>
              <td>
                {formatSpeed(h.windSpeed, units, locale)} {compassPoint(h.windDirection, lang)}
              </td>
              <td>{formatSpeed(h.windGusts, units, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
