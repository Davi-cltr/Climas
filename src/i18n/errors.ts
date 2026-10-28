import type { HttpError } from '../lib/http'
import type { Strings } from './strings'

export function errorMessage(error: HttpError, online: boolean, t: Strings) {
  if (!online || error.kind === 'offline') return t.errorOffline
  if (error.kind === 'timeout') return t.errorTimeout
  if (error.kind === 'http' && (error.status ?? 0) >= 500) return t.errorUnavailable
  if (error.kind === 'http') return t.errorHttp(error.message)
  if (error.kind === 'invalid') return t.errorInvalid
  return t.errorNetwork
}
