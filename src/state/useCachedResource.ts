import { useCallback, useEffect, useRef, useState } from 'react'
import { isFresh, readCache, writeCache } from '../lib/cache'
import { HttpError, isAbortError } from '../lib/http'

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ResourceState<T> {
  status: ResourceStatus
  data: T | null
  /** Quando os dados exibidos foram obtidos. */
  storedAt: number | null
  error: HttpError | null
  /** Há uma requisição em andamento enquanto dados anteriores continuam visíveis. */
  refreshing: boolean
  /** Os dados exibidos vieram do cache porque a atualização falhou. */
  stale: boolean
}

const initial: ResourceState<never> = {
  status: 'idle',
  data: null,
  storedAt: null,
  error: null,
  refreshing: false,
  stale: false,
}

/** Requisições em andamento por chave: evita pedidos duplicados para o mesmo recurso. */
const inflight = new Map<string, { promise: Promise<unknown>; controller: AbortController; users: number }>()

function shared<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  let entry = inflight.get(key)
  if (!entry) {
    const controller = new AbortController()
    const promise = fetcher(controller.signal).finally(() => {
      if (inflight.get(key)?.promise === promise) inflight.delete(key)
    })
    entry = { promise, controller, users: 0 }
    inflight.set(key, entry)
  }
  entry.users++
  const e = entry
  return {
    promise: e.promise as Promise<T>,
    release() {
      e.users--
      // Só cancela a rede quando ninguém mais espera por esta resposta
      if (e.users <= 0 && inflight.get(key) === e) {
        e.controller.abort()
        inflight.delete(key)
      }
    },
  }
}

const toHttpError = (e: unknown) => (e instanceof HttpError ? e : new HttpError('network', String(e)))

/**
 * Busca um recurso com cache (stale-while-revalidate), cancelamento,
 * proteção contra respostas fora de ordem e deduplicação.
 */
export function useCachedResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  ttlMs: number,
) {
  const [state, setState] = useState<ResourceState<T>>(initial)
  const requestId = useRef(0)
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])
  const releaseRef = useRef<(() => void) | null>(null)

  const run = useCallback(
    (force: boolean) => {
      if (!key) {
        setState(initial)
        return
      }
      const id = ++requestId.current
      releaseRef.current?.()
      releaseRef.current = null

      const cached = readCache<T>(key)
      if (!force && cached && isFresh(cached, ttlMs)) {
        setState({ status: 'success', data: cached.value, storedAt: cached.storedAt, error: null, refreshing: false, stale: false })
        return
      }

      setState((prev) => {
        // Ao trocar de chave, nunca mostrar dados da chave anterior
        const sameKeyData = cached?.value ?? (force ? prev.data : null)
        return {
          status: sameKeyData ? 'success' : 'loading',
          data: sameKeyData,
          storedAt: cached?.storedAt ?? (force ? prev.storedAt : null),
          error: null,
          refreshing: true,
          stale: false,
        }
      })

      const { promise, release } = shared(key, (signal) => fetcherRef.current(signal))
      releaseRef.current = release
      promise.then(
        (value) => {
          if (id !== requestId.current) return
          releaseRef.current = null
          const now = Date.now()
          writeCache(key, value, now)
          setState({ status: 'success', data: value, storedAt: now, error: null, refreshing: false, stale: false })
        },
        (err: unknown) => {
          if (id !== requestId.current || isAbortError(err)) return
          releaseRef.current = null
          const error = toHttpError(err)
          setState((prev) =>
            prev.data
              ? { ...prev, error, refreshing: false, stale: true }
              : { status: 'error', data: null, storedAt: null, error, refreshing: false, stale: false },
          )
        },
      )
    },
    [key, ttlMs],
  )

  useEffect(() => {
    run(false)
    return () => {
      requestId.current++
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [run])

  const refresh = useCallback(() => run(true), [run])
  return { ...state, refresh }
}
