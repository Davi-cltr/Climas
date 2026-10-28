/**
 * Requisições JSON com timeout, cancelamento e erros tipados.
 * Toda chamada HTTP do app passa por aqui.
 */

export type HttpErrorKind = 'offline' | 'network' | 'timeout' | 'http' | 'invalid' | 'aborted'

export class HttpError extends Error {
  readonly kind: HttpErrorKind
  readonly status?: number

  constructor(kind: HttpErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'HttpError'
    this.kind = kind
    this.status = status
  }
}

export const isAbortError = (error: unknown): boolean =>
  error instanceof HttpError ? error.kind === 'aborted' : error instanceof DOMException && error.name === 'AbortError'

export interface FetchJsonOptions {
  signal?: AbortSignal
  /** Tempo máximo em milissegundos. Padrão: 12 s. */
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const { signal, timeoutMs = 12_000, fetchImpl = fetch } = options

  if (signal?.aborted) throw new HttpError('aborted', 'Requisição cancelada')
  if (isOffline()) throw new HttpError('offline', 'Sem conexão com a internet')

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  let response: Response
  try {
    response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if (timedOut) throw new HttpError('timeout', 'O serviço demorou demais para responder')
    if (signal?.aborted) throw new HttpError('aborted', 'Requisição cancelada')
    if (isOffline()) throw new HttpError('offline', 'Sem conexão com a internet')
    throw new HttpError('network', error instanceof Error ? error.message : 'Falha de rede')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new HttpError(response.ok ? 'invalid' : 'http', 'Resposta não é JSON válido', response.status)
  }

  if (!response.ok) {
    // A Open-Meteo responde erros como { error: true, reason: "..." }
    const reason =
      body && typeof body === 'object' && 'reason' in body && typeof body.reason === 'string'
        ? body.reason
        : `HTTP ${response.status}`
    throw new HttpError('http', reason, response.status)
  }
  return body
}
