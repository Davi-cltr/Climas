import type { SummaryFact } from '../lib/summary'
import { formatHourShort } from '../lib/time'
import { formatPercent, formatPrecip, formatSpeed, formatTemp, type UnitSystem } from '../lib/units'
import type { Lang } from '../lib/weatherCodes'

interface Ctx {
  lang: Lang
  locale: string
  units: UnitSystem
  timeZone: string
}

/** Converte os fatos do resumo em frases curtas, uma por fato. */
export function summaryToSentences(facts: SummaryFact[], ctx: Ctx): string[] {
  const { lang, locale, units, timeZone } = ctx
  const T = (c: number) => formatTemp(c, units, locale)
  const H = (ms: number) => formatHourShort(ms, timeZone, locale)
  const P = (v: number) => formatPercent(v, locale)
  const pt = lang === 'pt'

  return facts.map((f) => {
    switch (f.kind) {
      case 'tempRise':
        return pt ? `A temperatura sobe até ${T(f.to)} por volta das ${H(f.at)}.` : `Temperature climbs to ${T(f.to)} around ${H(f.at)}.`
      case 'tempFall':
        return pt ? `A temperatura cai para ${T(f.to)} por volta das ${H(f.at)}.` : `Temperature drops to ${T(f.to)} around ${H(f.at)}.`
      case 'tempSteady':
        return pt ? `A temperatura fica perto de ${T(f.around)} nas próximas horas.` : `Temperature holds near ${T(f.around)} over the coming hours.`
      case 'rainLikely':
        return pt
          ? `A chance de chuva passa de 50% a partir das ${H(f.from)} e chega a ${P(f.peak)}.`
          : `Chance of rain goes above 50% from ${H(f.from)}, peaking at ${P(f.peak)}.`
      case 'rainPossible':
        return pt
          ? `Há chance de chuva de até ${P(f.peak)}, maior por volta das ${H(f.at)}.`
          : `Rain is possible, up to ${P(f.peak)} around ${H(f.at)}.`
      case 'rainUnlikely':
        return pt ? 'A chance de chuva fica abaixo de 20%.' : 'Chance of rain stays below 20%.'
      case 'rainAmount':
        return pt
          ? `O modelo prevê cerca de ${formatPrecip(f.mm, units, locale)} de chuva no período.`
          : `The model expects about ${formatPrecip(f.mm, units, locale)} of rain in this period.`
      case 'gusts':
        return pt
          ? `Rajadas podem chegar a ${formatSpeed(f.speed, units, locale)} por volta das ${H(f.at)}.`
          : `Gusts may reach ${formatSpeed(f.speed, units, locale)} around ${H(f.at)}.`
    }
  })
}
