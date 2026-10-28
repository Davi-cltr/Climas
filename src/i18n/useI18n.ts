import { useMemo } from 'react'
import { useSettings } from '../state/settings'
import { LOCALES, STRINGS } from './strings'

export function useI18n() {
  const { lang, units } = useSettings()
  return useMemo(() => ({ t: STRINGS[lang], lang, locale: LOCALES[lang], units }), [lang, units])
}

export type I18n = ReturnType<typeof useI18n>
