import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}

const motionQuery = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia?.(motionQuery)
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia?.(motionQuery).matches ?? false,
    () => false,
  )
}
