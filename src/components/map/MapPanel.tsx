import { lazy, Suspense, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { rampWindow } from '../../lib/color'
import { formatDayShort, formatHourShort } from '../../lib/time'
import type { ForecastGrid } from '../../lib/types'
import { formatPercent, formatSpeed, formatTemp } from '../../lib/units'
import type { ResourceState } from '../../state/useCachedResource'
import { Button, Notice, Segmented } from '../ui/primitives'
import type { FieldStats, MapMode } from './overlay'
import s from './MapPanel.module.css'

const AtmosMap = lazy(() => import('./AtmosMap'))

interface Props {
  latitude: number
  longitude: number
  placeName: string
  grid: ResourceState<ForecastGrid> & { refresh: () => void }
  time: number
  timeZone: string
  centerValue: string
  mode: MapMode
  onModeChange: (m: MapMode) => void
  reducedMotion: boolean
  themeKey: string
  onPick: (lat: number, lon: number) => void
}

export function MapPanel(props: Props) {
  const { latitude, longitude, placeName, grid, time, timeZone, centerValue, mode, onModeChange, reducedMotion, themeKey, onPick } = props
  const { t, locale, units } = useI18n()
  const [stats, setStats] = useState<FieldStats | null>(null)
  const [baseError, setBaseError] = useState(false)
  const n = grid.data ? grid.data.rows * grid.data.cols : 63

  const fmt = (v: number) =>
    mode === 'temperature' ? formatTemp(v, units, locale) : mode === 'rain' ? formatPercent(v, locale) : formatSpeed(v, units, locale)
  const legend = mode === 'temperature' ? t.mapLegendTemp(n) : mode === 'rain' ? t.mapLegendRain(n) : t.mapLegendWind(n)
  const rangeText = stats
    ? (mode === 'temperature' ? t.mapRangeTemp : mode === 'rain' ? t.mapRangeRain : t.mapRangeWind)(fmt(stats.min), fmt(stats.max))
    : ''

  return (
    <section className={s.panel} aria-labelledby="map-title">
      <h2 id="map-title" className="visually-hidden">
        {t.mapTitle}
      </h2>
      <p className="visually-hidden" aria-live="polite">
        {t.mapDescription(placeName, rangeText)}
      </p>

      <Suspense fallback={<div className={s.placeholder} />}>
        <AtmosMap
          latitude={latitude}
          longitude={longitude}
          grid={grid.data}
          time={time}
          mode={mode}
          reducedMotion={reducedMotion}
          themeKey={themeKey}
          centerLabel={`${placeName}  ${centerValue}`}
          onPick={onPick}
          onStats={setStats}
          onBaseError={() => setBaseError(true)}
        />
      </Suspense>

      <div className={s.top}>
        <Segmented<MapMode>
          label={t.mapTitle}
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'temperature', label: t.mapTemp },
            { value: 'rain', label: t.mapRain },
            { value: 'wind', label: t.mapWind },
          ]}
        />
        <p className={s.hour}>
          <span>{t.mapShowing}</span>
          <b className="numeral" key={time}>
            {formatHourShort(time, timeZone, locale)}
          </b>
          <span>{formatDayShort(time, timeZone, locale)}</span>
        </p>
      </div>

      <div className={s.bottom}>
        {grid.status === 'loading' && !grid.data && <p className={s.status}>{t.mapLoading}</p>}
        {grid.status === 'error' && !grid.data && (
          <Notice tone="warning" actions={<Button size="sm" onClick={grid.refresh}>{t.retry}</Button>}>
            {t.mapGridError}
          </Notice>
        )}
        {grid.data && (
          <div className={s.legend}>
            <p>{legend}</p>
            <div className={s.ramp} data-mode={mode} style={stats ? rampStyle(mode, stats) : undefined} aria-hidden="true" />
            {stats && (
              <p className={`${s.rampLabels} tabular`}>
                <span>{fmt(stats.min)}</span>
                <span>{fmt(stats.max)}</span>
              </p>
            )}
            <p className={s.flow}>
              <span className={s.flowSwatch} aria-hidden="true" />
              {t.mapFlow}
            </p>
            <p className={s.hint}>{t.mapClickHint}</p>
            {baseError && <p className={s.hint}>{t.mapBaseError}</p>}
          </div>
        )}
      </div>
    </section>
  )
}

/** A barra da legenda mostra só o trecho da escala presente na região, na mesma cor usada no mapa. */
function rampStyle(mode: MapMode, { min, max }: FieldStats): React.CSSProperties {
  if (mode === 'temperature') return { ...rampWindow(min, max), backgroundRepeat: 'no-repeat' }
  const token = mode === 'rain' ? '--rain' : '--wind'
  const full = mode === 'rain' ? 100 : 50
  const pct = (v: number) => Math.round(Math.max(0, Math.min(1, v / full)) * 100)
  return {
    background: `linear-gradient(90deg, color-mix(in oklab, var(${token}) ${pct(min)}%, var(--surface-0)), color-mix(in oklab, var(${token}) ${pct(max)}%, var(--surface-0)))`,
  }
}
