import { errorMessage } from '../i18n/errors'
import { useI18n } from '../i18n/useI18n'
import type { HttpError } from '../lib/http'
import { formatClock, formatDuration } from '../lib/time'
import type { Forecast } from '../lib/types'
import type { ResourceState } from '../state/useCachedResource'
import type { GeoState } from '../state/useGeolocation'
import { Button, Notice } from './ui/primitives'
import s from '../App.module.css'

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

interface Props {
  geo: GeoState
  onDismissGeo: () => void
  onRetryGeo: () => void
  forecast: ResourceState<Forecast> & { refresh: () => void }
  online: boolean
  now: number
}

export function StatusBanners({ geo, onDismissGeo, onRetryGeo, forecast, online, now }: Props) {
  const { t, lang, locale } = useI18n()
  const banners: React.ReactNode[] = []

  if (geo.status === 'error') {
    const msg = { denied: t.geoDenied, unavailable: t.geoUnavailable, timeout: t.geoTimeout, unsupported: t.geoUnsupported }[geo.kind]
    banners.push(
      <Notice
        key="geo"
        tone="warning"
        icon="locate"
        actions={
          <>
            {geo.kind === 'timeout' && (
              <Button size="sm" onClick={onRetryGeo}>
                {t.retry}
              </Button>
            )}
            <Button size="sm" variant="quiet" icon="close" label={t.dismiss} onClick={onDismissGeo} />
          </>
        }
      >
        {msg}
      </Notice>,
    )
  }

  // Dados exibidos, mas desatualizados: sem rede ou falha na atualização
  if (forecast.data && forecast.storedAt && (!online || forecast.stale)) {
    const saved = formatClock(forecast.storedAt, LOCAL_TZ, locale)
    const age = formatDuration(now - forecast.storedAt, lang)
    banners.push(
      <Notice
        key="stale"
        tone="info"
        icon="offline"
        actions={
          online ? (
            <Button size="sm" icon="refresh" onClick={forecast.refresh}>
              {t.retry}
            </Button>
          ) : undefined
        }
      >
        {!online ? t.offlineBanner : t.staleBanner(age)} {t.savedAt(saved)}.
      </Notice>,
    )
  }

  if (banners.length === 0) return null
  return <div className={s.banners}>{banners}</div>
}

/** Estado de erro sem dados: ocupa o lugar da leitura atual, com explicação e ação. */
export function ForecastError({ error, online, onRetry }: { error: HttpError; online: boolean; onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <section className={s.errorState} role="alert" aria-labelledby="error-title">
      <svg width="120" height="64" viewBox="0 0 120 64" aria-hidden="true" className={s.errorArt}>
        <path d="M2 40c18-22 30 10 50-6s34-22 66 2" fill="none" stroke="var(--line)" strokeWidth="1.4" strokeDasharray="3 5" />
        <path d="M2 52c22-14 34 6 54-4s38-12 62 0" fill="none" stroke="var(--line)" strokeWidth="1.2" />
        <circle cx="60" cy="30" r="5" fill="none" stroke="var(--danger)" strokeWidth="1.6" />
      </svg>
      <h1 id="error-title">{t.errorTitle}</h1>
      <p>{errorMessage(error, online, t)}</p>
      <Button icon="refresh" onClick={onRetry}>
        {t.retry}
      </Button>
    </section>
  )
}
