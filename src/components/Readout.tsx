import { useMemo } from 'react'
import { summaryToSentences } from '../i18n/summaryText'
import { useI18n } from '../i18n/useI18n'
import { rampWindow } from '../lib/color'
import { summarize } from '../lib/summary'
import { formatClock, formatDateLong } from '../lib/time'
import type { DayPoint, Forecast, Place } from '../lib/types'
import { compassPoint, formatPercent, formatSpeed, formatTemp, tempUnit } from '../lib/units'
import { conditionLabel } from '../lib/weatherCodes'
import { isFavorite, toggleFavorite, useSettings } from '../state/settings'
import { formatCoords, placeDetail } from '../lib/place'
import { Button } from './ui/primitives'
import s from './Readout.module.css'

interface Props {
  place: Place
  forecast: Forecast
  nowIndex: number
  today: DayPoint | null
  now: number
}

export function Readout({ place, forecast, nowIndex, today, now }: Props) {
  const { t, lang, locale, units } = useI18n()
  const settings = useSettings()
  const tz = forecast.timezone
  const cur = forecast.current
  const hourNow = forecast.hourly[nowIndex]

  // "Agora" é a estimativa de condições atuais do modelo; se faltar, usa a hora vigente da previsão
  const temperature = cur?.temperature ?? hourNow?.temperature ?? null
  const apparent = cur?.apparentTemperature ?? hourNow?.apparentTemperature ?? null
  const code = cur?.weatherCode ?? hourNow?.weatherCode ?? null
  const humidity = cur?.humidity ?? hourNow?.humidity ?? null
  const windSpeed = cur?.windSpeed ?? hourNow?.windSpeed ?? null
  const windDir = cur?.windDirection ?? hourNow?.windDirection ?? null

  const sentences = useMemo(
    () => summaryToSentences(summarize(forecast.hourly, nowIndex), { lang, locale, units, timeZone: tz }),
    [forecast.hourly, nowIndex, lang, locale, units, tz],
  )

  const fav = isFavorite(settings, place)
  const detail = placeDetail(place)
  const title = place.kind === 'device' ? t.myLocation : place.kind === 'point' ? t.mapPoint : place.name

  // Posição da temperatura atual entre mínima e máxima do dia
  const range = today && today.tempMin !== null && today.tempMax !== null ? ([today.tempMin, today.tempMax] as const) : null
  const pos =
    range && temperature !== null && range[1] > range[0]
      ? Math.max(0, Math.min(1, (temperature - range[0]) / (range[1] - range[0])))
      : null

  return (
    <section className={s.readout} aria-labelledby="readout-title">
      <div className={s.place}>
        <div className={s.titleRow}>
          <h1 id="readout-title" className={s.title}>
            {title}
          </h1>
          <Button
            icon="star"
            iconFilled={fav}
            variant="quiet"
            className={s.fav}
            aria-pressed={fav}
            label={fav ? t.removeFavorite : t.addFavorite}
            onClick={() => toggleFavorite(place)}
          />
        </div>
        <p className={`${s.meta} tabular`}>
          {detail && <span>{detail}</span>}
          <span>{formatCoords(forecast.latitude, forecast.longitude, lang)}</span>
          <span>
            {formatDateLong(now, tz, locale)}, {formatClock(now, tz, locale)} {forecast.timezoneAbbreviation}
          </span>
        </p>
      </div>

      <div className={s.now}>
        <p className={s.temp} aria-label={`${formatTemp(temperature, units, locale)} ${tempUnit(units)}`}>
          <span className={`${s.tempValue} numeral`} key={`${place.id}-${units}`}>
            {formatTemp(temperature, units, locale).replace('°', '')}
          </span>
          <span className={s.tempUnit}>{tempUnit(units)}</span>
        </p>
        <div className={s.condition}>
          <p className={s.conditionLabel}>{conditionLabel(code, lang)}</p>
          <p className={s.feels}>
            {t.feelsLike} <b className="tabular">{formatTemp(apparent, units, locale)}</b>
          </p>
        </div>
      </div>

      {range && (
        <div className={`${s.range} tabular`}>
          <span>{formatTemp(range[0], units, locale)}</span>
          <span
            className={s.rangeBar}
            style={rampWindow(range[0], range[1])}
            aria-hidden="true"
          >
            {pos !== null && <i style={{ left: `${pos * 100}%` }} />}
          </span>
          <span>{formatTemp(range[1], units, locale)}</span>
          <span className={s.rangeLabel}>{t.todayRange}</span>
        </div>
      )}

      <div className={s.summary}>
        {sentences.length > 0 ? (
          <p className={s.lede}>{sentences.join(' ')}</p>
        ) : (
          <p className={s.lede}>{t.summaryEmpty}</p>
        )}
        <p className={s.note}>{cur ? `${t.summaryNote} ${t.estimateNote}` : t.summaryNote}</p>
      </div>

      <dl className={s.facts}>
        <div>
          <dt>{t.humidity}</dt>
          <dd className="tabular">{formatPercent(humidity, locale)}</dd>
        </div>
        <div>
          <dt>{t.wind}</dt>
          <dd className="tabular">
            {formatSpeed(windSpeed, units, locale)} {windSpeed !== null && windSpeed >= 1 ? compassPoint(windDir, lang) : ''}
          </dd>
        </div>
        <div>
          <dt>{t.rainChanceToday}</dt>
          <dd className="tabular">{formatPercent(today?.precipProbabilityMax ?? null, locale)}</dd>
        </div>
      </dl>
    </section>
  )
}

export function ReadoutSkeleton() {
  return (
    <section className={s.readout} aria-busy="true">
      <div className={s.place}>
        <span className="skeleton" style={{ width: '60%', height: 38 }} />
        <span className="skeleton" style={{ width: '80%', height: 16, marginTop: 12 }} />
      </div>
      <span className="skeleton" style={{ width: 220, height: 140 }} />
      <span className="skeleton" style={{ width: '70%', height: 10 }} />
      <span className="skeleton" style={{ width: '90%', height: 64 }} />
      <span className="skeleton" style={{ width: '100%', height: 48, marginTop: 'auto' }} />
    </section>
  )
}
