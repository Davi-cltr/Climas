import { useCallback, useEffect, useRef, useState } from 'react'

export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'success'; latitude: number; longitude: number; accuracy: number }
  | { status: 'error'; kind: GeoErrorKind }

export function mapGeoError(code: number): GeoErrorKind {
  // 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
  if (code === 1) return 'denied'
  if (code === 3) return 'timeout'
  return 'unavailable'
}

/**
 * Só pede a localização quando `locate()` é chamado por uma ação do usuário.
 * Nunca no carregamento da página.
 */
export function useGeolocation(onLocated: (lat: number, lon: number) => void) {
  const [state, setState] = useState<GeoState>({ status: 'idle' })
  const onLocatedRef = useRef(onLocated)
  useEffect(() => {
    onLocatedRef.current = onLocated
  }, [onLocated])
  const active = useRef(0)

  useEffect(
    () => () => {
      active.current++
    },
    [],
  )

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState({ status: 'error', kind: 'unsupported' })
      return
    }
    const id = ++active.current
    setState({ status: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (id !== active.current) return
        const { latitude, longitude, accuracy } = pos.coords
        setState({ status: 'success', latitude, longitude, accuracy })
        onLocatedRef.current(latitude, longitude)
      },
      (err) => {
        if (id !== active.current) return
        setState({ status: 'error', kind: mapGeoError(err.code) })
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 },
    )
  }, [])

  const dismiss = useCallback(() => setState({ status: 'idle' }), [])

  return { state, locate, dismiss }
}
