import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { formatClock } from '../lib/time'
import type { Place } from '../lib/types'
import { updateSettings, useSettings, type ThemePref } from '../state/settings'
import { SearchBox } from './SearchBox'
import { Button, Segmented } from './ui/primitives'
import s from './Header.module.css'

/** O horário da última atualização é mostrado no relógio de quem usa o app. */
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

interface Props {
  onSelectPlace: (p: Place) => void
  onLocate: () => void
  locating: boolean
  storedAt: number | null
  refreshing: boolean
  onRefresh: () => void
}

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11.5" fill="none" stroke="var(--atmos)" strokeWidth="1.2" />
      <path d="M3 15c4-5 7 3 10-2s7-4 10 0" fill="none" stroke="var(--signal)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 9.5c3-3 6 1 9-1.5s6-2 8.5 0" fill="none" stroke="var(--atmos)" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

export function Header({ onSelectPlace, onLocate, locating, storedAt, refreshing, onRefresh }: Props) {
  const { t, locale } = useI18n()
  const updated = storedAt ? formatClock(storedAt, LOCAL_TZ, locale) : null

  return (
    <header className={s.header}>
      <a className={s.brand} href="./" aria-label="CLIMAS">
        <Mark />
        <span className={s.wordmark}>CLIMAS</span>
      </a>
      <SearchBox onSelect={onSelectPlace} />
      <Button icon="locate" className={s.locate} onClick={onLocate} disabled={locating} busy={locating} label={t.useMyLocation}>
        <span className={s.locateText}>{locating ? t.locating : t.useMyLocation}</span>
      </Button>
      <div className={s.end}>
        {updated && (
          <span className={`${s.updated} tabular`} aria-live="polite">
            <i className={s.dot} data-refreshing={refreshing || undefined} aria-hidden="true" />
            {refreshing ? t.refreshing : t.updatedAt(updated)}
          </span>
        )}
        <Button icon="refresh" variant="quiet" label={t.refresh} onClick={onRefresh} disabled={refreshing} busy={refreshing} />
        <SettingsMenu />
      </div>
    </header>
  )
}

function SettingsMenu() {
  const { t } = useI18n()
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={s.settings} ref={rootRef}>
      <Button
        ref={buttonRef}
        icon="settings"
        variant="quiet"
        label={t.settings}
        aria-expanded={open}
        aria-controls="climas-settings"
        onClick={() => setOpen((o) => !o)}
      />
      <div id="climas-settings" className={s.menu} hidden={!open} role="group" aria-label={t.settings}>
        <p className={s.menuLabel}>{t.language}</p>
        <Segmented
          label={t.language}
          value={settings.lang}
          options={[
            { value: 'pt', label: 'Português' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(lang) => updateSettings({ lang })}
        />
        <p className={s.menuLabel}>{t.units}</p>
        <Segmented
          label={t.units}
          value={settings.units}
          options={[
            { value: 'metric', label: '°C  km/h  mm' },
            { value: 'imperial', label: '°F  mph  in' },
          ]}
          onChange={(units) => updateSettings({ units })}
        />
        <p className={s.menuLabel}>{t.theme}</p>
        <Segmented<ThemePref>
          label={t.theme}
          value={settings.theme}
          options={[
            { value: 'system', label: t.themeSystem },
            { value: 'dark', label: t.themeDark },
            { value: 'light', label: t.themeLight },
          ]}
          onChange={(theme) => updateSettings({ theme })}
        />
      </div>
    </div>
  )
}
