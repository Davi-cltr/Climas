import { useEffect, useSyncExternalStore } from 'react'
import type { ThemePref } from './settings'

const query = '(prefers-color-scheme: light)'
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia?.(query)
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}

/** Aplica o tema no <html> e devolve o tema efetivo ('dark' | 'light'). */
export function useTheme(pref: ThemePref) {
  const systemLight = useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
  const resolved = pref === 'system' ? (systemLight ? 'light' : 'dark') : pref
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = pref
    root.dataset.resolvedTheme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#eef3f7' : '#08131f')
  }, [pref, resolved])
  return resolved
}
