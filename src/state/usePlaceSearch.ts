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

/** Busca com debounce, cancelamento da busca anterior e memória das consultas já feitas. */
export function usePlaceSearch(query: string, language: string, search = searchPlaces): SearchState {
  const [state, setState] = useState<SearchState>({ status: 'idle', results: [] })
  const searchRef = useRef(search)
  useEffect(() => {
    searchRef.current = search
  }, [search])

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH) {
      setState({ status: 'idle', results: [] })
      return
    }
    const key = `${language}|${q.toLowerCase()}`
    const hit = memo.get(key)
    if (hit) {
      setState({ status: 'done', results: hit, query: q })
      return
    }

    setState((prev) => ({ status: 'searching', results: prev.results }))
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchRef
        .current(q, language, { signal: controller.signal })
        .then((results) => {
          memo.set(key, results)
          setState({ status: 'done', results, query: q })
        })
        .catch((err: unknown) => {
          if (isAbortError(err)) return
          setState({ status: 'error', results: [], error: err instanceof HttpError ? err : new HttpError('network', String(err)) })
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, language])

  return state
}

export function clearSearchMemo() {
  memo.clear()
}
