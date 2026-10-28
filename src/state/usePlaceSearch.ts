import { useEffect, useRef, useState } from 'react'
import { MIN_QUERY_LENGTH, searchPlaces } from '../lib/api/geocoding'
import { HttpError, isAbortError } from '../lib/http'
import type { Place } from '../lib/types'

export type SearchState =
  | { status: 'idle'; results: [] }
  | { status: 'searching'; results: Place[] }
  | { status: 'done'; results: Place[]; query: string }
  | { status: 'error'; results: []; error: HttpError }

export const SEARCH_DEBOUNCE_MS = 280

const memo = new Map<string, Place[]>()

type Settled = { key: string; results: Place[] } | { key: string; error: HttpError }

/** Busca com debounce, cancelamento da busca anterior e memória das consultas já feitas. */
export function usePlaceSearch(query: string, language: string, search = searchPlaces): SearchState {
  const [settled, setSettled] = useState<Settled | null>(null)
  const searchRef = useRef(search)
  useEffect(() => {
    searchRef.current = search
  }, [search])

  const q = query.trim()
  const active = q.length >= MIN_QUERY_LENGTH
  const key = `${language}|${q.toLowerCase()}`
  const cached = active ? memo.get(key) : undefined

  useEffect(() => {
    if (!active || cached) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchRef
        .current(q, language, { signal: controller.signal })
        .then((results) => {
          memo.set(key, results)
          setSettled({ key, results })
        })
        .catch((err: unknown) => {
          if (isAbortError(err)) return
          setSettled({ key, error: err instanceof HttpError ? err : new HttpError('network', String(err)) })
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [active, cached, key, q, language])

  if (!active) return { status: 'idle', results: [] }
  if (cached) return { status: 'done', results: cached, query: q }
  if (settled?.key === key) {
    return 'error' in settled ? { status: 'error', results: [], error: settled.error } : { status: 'done', results: settled.results, query: q }
  }
  // Enquanto a nova busca não termina, mantém os resultados anteriores visíveis
  return { status: 'searching', results: settled && 'results' in settled ? settled.results : [] }
}

export function clearSearchMemo() {
  memo.clear()
}
