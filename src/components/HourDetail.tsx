import { useI18n } from '../i18n/useI18n'
import { formatDayShort, formatHourShort } from '../lib/time'
import type { HourPoint } from '../lib/types'
import {
  compassPoint,
  convertSpeed,
  convertTempDelta,
  formatNumber,
  formatPercent,
  formatPrecip,
  formatSpeed,
  formatTemp,
  speedUnit,
} from '../lib/units'
import { conditionLabel } from '../lib/weatherCodes'
import { Button, PanelTitle } from './ui/primitives'
import s from './panels.module.css'

interface Props {
  hour: HourPoint
  /** Hora de referência para comparação (a fixada ou "agora"). */
  reference: HourPoint | null
  referenceIsNow: boolean
  isPinned: boolean
  isNow: boolean
  onTogglePin: () => void
  timeZone: string
}

function signed(v: number, locale: string, digits = 0) {
  const r = Number(v.toFixed(digits))
  if (r === 0) return null
  return `${r > 0 ? '+' : '−'}${formatNumber(Math.abs(r), locale, digits)}`
}

export function HourDetail({ hour, reference, referenceIsNow, isPinned, isNow, onTogglePin, timeZone }: Props) {
  const { t, lang, locale, units } = useI18n()
  const when = `${formatDayShort(hour.time, timeZone, locale)}, ${formatHourShort(hour.time, timeZone, locale)}`

  const comparisons: string[] = []
  if (reference && reference.time !== hour.time) {
    if (hour.temperature !== null && reference.temperature !== null) {
      const d = signed(convertTempDelta(hour.temperature - reference.temperature, units), locale)
      comparisons.push(t.compareTemp(d ? `${d}°` : t.sameValue))
    }
    if (hour.precipProbability !== null && reference.precipProbability !== null) {
      const d = signed(hour.precipProbability - reference.precipProbability, locale)
      comparisons.push(t.compareRain(d ? `${d} ${t.pointsUnit}` : t.sameValue))
    }
    if (hour.windSpeed !== null && reference.windSpeed !== null) {
      const d = signed(convertSpeed(hour.windSpeed - reference.windSpeed, units), locale)
      comparisons.push(t.compareWind(d ? `${d} ${speedUnit(units)}` : t.sameValue))
    }
  }
  const refLabel = referenceIsNow
    ? t.now
    : reference
      ? `${formatDayShort(reference.time, timeZone, locale)}, ${formatHourShort(reference.time, timeZone, locale)}`
      : ''

  return (
    <section className={`${s.panel} ${s.selected}`} aria-labelledby="hour-title">
      <PanelTitle id="hour-title" title={t.selectedHour} context={isNow ? `${when} (${t.now})` : when} />
      <div className={s.bigRow}>
        <span className={`${s.big} numeral swap`} key={`t${hour.time}${units}`}>
          {formatTemp(hour.temperature, units, locale)}
        </span>
        <span className={s.bigSide}>
          <span className="swap" key={`c${hour.time}${lang}`}>
            {conditionLabel(hour.weatherCode, lang)}
          </span>
          <span>
            {t.feelsLike.toLowerCase()} {formatTemp(hour.apparentTemperature, units, locale)}
          </span>
        </span>
      </div>
      <dl className={`${s.list} tabular`}>
        <dt>{t.rainChance}</dt>
        <dd>{formatPercent(hour.precipProbability, locale)}</dd>
        <dt>{t.rainAmount}</dt>
        <dd>{formatPrecip(hour.precipitation, units, locale)}</dd>
        <dt>{t.wind}</dt>
        <dd>
          {formatSpeed(hour.windSpeed, units, locale)} {hour.windSpeed !== null && hour.windSpeed >= 1 ? compassPoint(hour.windDirection, lang) : ''}
        </dd>
        <dt>{t.gusts}</dt>
        <dd>{formatSpeed(hour.windGusts, units, locale)}</dd>
        <dt>{t.humidity}</dt>
        <dd>{formatPercent(hour.humidity, locale)}</dd>
        <dt>{t.cloudCover}</dt>
        <dd>{formatPercent(hour.cloudCover, locale)}</dd>
      </dl>

      <div className={s.compare}>
        {comparisons.length > 0 ? (
          <p className="tabular">
            <b>{t.comparingWith(refLabel)}:</b> {comparisons.join(', ')}.
          </p>
        ) : (
          <p>&nbsp;</p>
        )}
        <Button size="sm" icon="pin" variant={isPinned ? 'outline' : 'quiet'} aria-pressed={isPinned} onClick={onTogglePin}>
          {isPinned ? t.unpinHour : t.pinHour}
        </Button>
      </div>
    </section>
  )
}
