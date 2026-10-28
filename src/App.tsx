import { useCallback, useEffect, useMemo, useState } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { HourDetail } from './components/HourDetail'
import { HourTable } from './components/HourTable'
import { MapPanel } from './components/map/MapPanel'
import type { MapMode } from './components/map/overlay'
import { RainPanel } from './components/RainPanel'
import { Readout, ReadoutSkeleton } from './components/Readout'
import { ForecastError, StatusBanners } from './components/StatusBanners'
import { SunPanel } from './components/SunPanel'
import { Timeline } from './components/Timeline'
import { Button, Segmented } from './components/ui/primitives'
import { WeekView } from './components/WeekView'
import { WindPanel } from './components/WindPanel'
import { useI18n } from './i18n/useI18n'
import { derive } from './lib/derive'
import type { HourPoint, Place } from './lib/types'
import { formatPercent, formatSpeed, formatTemp } from './lib/units'
import { DEFAULT_PLACE, updateSettings, useSettings } from './state/settings'
import { useForecast, useGrid } from './state/useForecastData'
import { useGeolocation } from './state/useGeolocation'
import { useNow } from './state/useNow'
import { useOnline, useReducedMotion } from './state/useOnline'
import { useTheme } from './state/useTheme'
import s from './App.module.css'

type View = '48h' | '7d'

const NO_HOURS: HourPoint[] = []

export default function App() {
  const settings = useSettings()
  const { t, lang, locale, units } = useI18n()
  const resolvedTheme = useTheme(settings.theme)
  const reducedMotion = useReducedMotion()
  const online = useOnline()
  const now = useNow()

  const [place, setPlace] = useState<Place>(() => settings.lastPlace ?? DEFAULT_PLACE)
  /** Instantes absolutos (ms) — não índices — para não deslocar quando o relógio avança. */
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const [pinnedTime, setPinnedTime] = useState<number | null>(null)
  const [view, setView] = useState<View>('48h')
  const [showTable, setShowTable] = useState(false)
  const [mapMode, setMapMode] = useState<MapMode>('temperature')

  const forecast = useForecast(place)
  const grid = useGrid(place, true)

  const selectPlace = useCallback((p: Place) => {
    setPlace(p)
    setSelectedTime(null)
    setPinnedTime(null)
    updateSettings({ lastPlace: p })
  }, [])

  const geo = useGeolocation(
    useCallback(
      (lat: number, lon: number) =>
        selectPlace({ id: `device:${lat.toFixed(3)},${lon.toFixed(3)}`, kind: 'device', name: 'device', latitude: lat, longitude: lon }),
      [selectPlace],
    ),
  )

  const onPick = useCallback(
    (lat: number, lon: number) =>
      selectPlace({ id: `point:${lat.toFixed(3)},${lon.toFixed(3)}`, kind: 'point', name: 'point', latitude: lat, longitude: lon }),
    [selectPlace],
  )

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
  }, [lang])

  const data = forecast.data
  const derived = useMemo(() => (data ? derive(data, now) : null), [data, now])
  const hours = useMemo(() => derived?.window ?? NO_HOURS, [derived])
  const selectedIndex = Math.max(0, selectedTime === null ? 0 : hours.findIndex((h) => h.time === selectedTime))
  const pinnedIndex = pinnedTime === null ? null : hours.findIndex((h) => h.time === pinnedTime)
  const selectedHour = hours[selectedIndex] ?? null
  const reference = pinnedIndex !== null && pinnedIndex >= 0 ? hours[pinnedIndex] : (hours[0] ?? null)
  const timeZone = data?.timezone ?? place.timezone ?? 'UTC'
  const placeName = place.kind === 'device' ? t.myLocation : place.kind === 'point' ? t.mapPoint : place.name

  useEffect(() => {
    const temp = data?.current?.temperature ?? hours[0]?.temperature ?? null
    document.title = temp !== null ? `${formatTemp(temp, units, locale)} ${placeName} | CLIMAS` : 'CLIMAS'
  }, [data, hours, placeName, units, locale])

  const select = useCallback((i: number) => setSelectedTime(hours[i]?.time ?? null), [hours])

  const mapTime = selectedHour?.time ?? now
  const centerValue = !selectedHour
    ? ''
    : mapMode === 'temperature'
      ? formatTemp(selectedHour.temperature, units, locale)
      : mapMode === 'rain'
        ? formatPercent(selectedHour.precipProbability, locale)
        : formatSpeed(selectedHour.windSpeed, units, locale)

  return (
    <>
      <a className="skip-link" href="#main">
        {t.skipToContent}
      </a>
      <Header
        onSelectPlace={selectPlace}
        onLocate={geo.locate}
        locating={geo.state.status === 'locating'}
        storedAt={forecast.storedAt}
        refreshing={forecast.refreshing && !!data}
        onRefresh={() => {
          forecast.refresh()
          grid.refresh()
        }}
      />

      <main id="main" className={s.main} tabIndex={-1}>
        <StatusBanners geo={geo.state} onDismissGeo={geo.dismiss} onRetryGeo={geo.locate} forecast={forecast} online={online} now={now} />

        <div className={s.top} key={place.id}>
          {data && derived ? (
            <Readout place={place} forecast={data} nowIndex={derived.nowIndex} today={derived.today} now={now} />
          ) : forecast.status === 'error' && forecast.error ? (
            <ForecastError error={forecast.error} online={online} onRetry={forecast.refresh} />
          ) : (
            <ReadoutSkeleton />
          )}
          <MapPanel
            latitude={place.latitude}
            longitude={place.longitude}
            placeName={placeName}
            grid={grid}
            time={mapTime}
            timeZone={timeZone}
            centerValue={centerValue}
            mode={mapMode}
            onModeChange={setMapMode}
            reducedMotion={reducedMotion}
            themeKey={resolvedTheme}
            onPick={onPick}
          />
        </div>

        <section className={s.timeline} aria-labelledby="timeline-title">
          <div className={s.timelineHead}>
            <h2 id="timeline-title">{view === '48h' ? t.timelineTitle : t.weekTitle}</h2>
            {view === '48h' && <p>{t.timelineHint}</p>}
            <div className={s.timelineControls}>
              <Segmented<View>
                label={t.timelineTitle}
                value={view}
                onChange={setView}
                options={[
                  { value: '48h', label: t.view48h },
                  { value: '7d', label: t.view7d },
                ]}
              />
              {view === '48h' && (
                <Button size="sm" variant="quiet" icon="table" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
                  {showTable ? t.hideTable : t.showTable}
                </Button>
              )}
            </div>
          </div>
          {!data || !derived ? (
            <div className="skeleton" style={{ height: 300 }} aria-hidden="true" />
          ) : view === '48h' ? (
            <>
              <Timeline
                hours={hours}
                selected={selectedIndex}
                pinned={pinnedIndex !== null && pinnedIndex >= 0 ? pinnedIndex : null}
                onSelect={select}
                timeZone={timeZone}
                animationKey={`${place.id}-${data.fetchedAt}`}
              />
              {showTable && <HourTable hours={hours} timeZone={timeZone} selected={selectedIndex} />}
            </>
          ) : (
            <WeekView days={data.daily} timeZone={timeZone} />
          )}
        </section>

        {data && derived && selectedHour && (
          <div className={s.lower}>
            <HourDetail
              hour={selectedHour}
              reference={reference}
              referenceIsNow={pinnedIndex === null || pinnedIndex < 0}
              isPinned={pinnedTime !== null && pinnedTime === selectedHour.time}
              isNow={selectedIndex === 0}
              onTogglePin={() => setPinnedTime((p) => (p === selectedHour.time ? null : selectedHour.time))}
              timeZone={timeZone}
            />
            <RainPanel hours={hours} selectedTime={selectedHour.time} onSelectTime={(ms) => setSelectedTime(ms)} timeZone={timeZone} />
            <WindPanel hour={selectedHour} next24={hours.slice(0, 24)} isNow={selectedIndex === 0} timeZone={timeZone} />
            <SunPanel today={derived.dayOf(now)} now={now} timeZone={timeZone} />
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}

