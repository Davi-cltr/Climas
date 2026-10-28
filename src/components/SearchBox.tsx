import { useEffect, useId, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { formatCoords, placeDetail } from '../lib/place'
import type { Place } from '../lib/types'
import { updateSettings, useSettings, samePlace } from '../state/settings'
import { usePlaceSearch } from '../state/usePlaceSearch'
import { Icon } from './ui/Icon'
import s from './SearchBox.module.css'

interface Props {
  onSelect: (place: Place) => void
}

/** Combobox de busca (padrão WAI-ARIA 1.2): setas navegam, Enter escolhe, Esc fecha. */
export function SearchBox({ onSelect }: Props) {
  const { t, lang } = useI18n()
  const { favorites } = useSettings()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const search = usePlaceSearch(query, lang)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const showingFavorites = query.trim().length === 0
  const items: Place[] = showingFavorites ? favorites : search.results

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const choose = (p: Place) => {
    onSelect(p)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(-1, i - 1))
    } else if (e.key === 'Enter') {
      const target = items[active >= 0 ? active : 0]
      if (target && open) {
        e.preventDefault()
        choose(target)
      }
    } else if (e.key === 'Escape') {
      if (open) setOpen(false)
      else setQuery('')
    }
  }

  let status: string | null = null
  if (!showingFavorites) {
    if (query.trim().length < 2) status = t.searchMinChars
    else if (search.status === 'searching' && items.length === 0) status = t.searchSearching
    else if (search.status === 'error') status = t.searchError
    else if (search.status === 'done' && items.length === 0) status = t.searchNoResults(query.trim())
  }
  const announce =
    !showingFavorites && search.status === 'done' && items.length > 0 ? t.searchResultsCount(items.length) : (status ?? '')

  const expanded = open && (items.length > 0 || status !== null)

  return (
    <div className={s.root} ref={rootRef}>
      <div className={s.field} data-busy={search.status === 'searching' || undefined}>
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t.searchLabel}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={t.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <span className={s.progress} aria-hidden="true" />
      </div>

      <div className={s.popover} hidden={!expanded}>
        {showingFavorites && items.length > 0 && <p className={s.groupLabel}>{t.favorites}</p>}
        <ul id={listId} role="listbox" aria-label={showingFavorites ? t.favorites : t.searchLabel} className={s.list}>
          {items.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={s.option}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onPointerEnter={() => setActive(i)}
            >
              <span className={s.name}>{p.name}</span>
              <span className={s.detail}>{placeDetail(p) || formatCoords(p.latitude, p.longitude, lang)}</span>
              <span className={`${s.coords} tabular`}>{formatCoords(p.latitude, p.longitude, lang, 1)}</span>
              {showingFavorites && (
                <button
                  type="button"
                  className={s.remove}
                  aria-label={t.removeFavoriteNamed(p.name)}
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    updateSettings((st) => ({ favorites: st.favorites.filter((f) => !samePlace(f, p)) }))
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {status && <p className={s.status}>{status}</p>}
      </div>
      <span className="visually-hidden" aria-live="polite">
        {open ? announce : ''}
      </span>
    </div>
  )
}
