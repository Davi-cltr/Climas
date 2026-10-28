import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { normalizeForecast } from '../lib/api/forecast'
import { clearMemoryCache } from '../lib/cache'
import { HttpError } from '../lib/http'
import { GEOCODING_SAO_PAULO, makeForecastResponse, T0 } from '../test/fixtures'
import { resetSettings } from '../state/settings'
import { useCachedResource } from '../state/useCachedResource'
import { clearSearchMemo } from '../state/usePlaceSearch'
import { SearchBox } from './SearchBox'
import { Timeline } from './Timeline'

// O app carrega o mapa sob demanda; nos testes ele é substituído (jsdom não tem WebGL)
vi.mock('./map/AtmosMap', () => ({ default: () => <div data-testid="atmos-map" /> }))

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

/** A grade do mapa é a única requisição com forecast_hours. */
const isGrid = (url: string) => String(url).includes('forecast_hours=')

beforeEach(() => {
  clearMemoryCache()
  clearSearchMemo()
  // jsdom usa en-US; os testes verificam a interface em português
  localStorage.setItem('climas:settings:v1', JSON.stringify({ lang: 'pt', units: 'metric', theme: 'dark' }))
  resetSettings()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('SearchBox', () => {
  it('aguarda o debounce, mostra estado e país e escolhe com o teclado', async () => {
    const fetchMock = vi.fn(() => json(GEOCODING_SAO_PAULO))
    vi.stubGlobal('fetch', fetchMock)
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SearchBox onSelect={onSelect} />)

    const input = screen.getByRole('combobox', { name: 'Buscar cidade' })
    await user.type(input, 'São')
    expect(fetchMock).toHaveBeenCalledTimes(0) // ainda no debounce

    expect(await screen.findByText('Pará, Brasil')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('name=S%C3%A3o')

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'São Paulo', admin1: 'Pará' }))
  })

  it('não escolhe um resultado da consulta anterior enquanto a nova busca está pendente', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(GEOCODING_SAO_PAULO)))
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SearchBox onSelect={onSelect} />)
    const input = screen.getByRole('combobox')
    await user.type(input, 'São')
    await screen.findByText('Pará, Brasil')
    await user.type(input, ' Tomé{Enter}')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('informa quando não há resultados', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ generationtime_ms: 0.1 })))
    render(<SearchBox onSelect={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'Xyzzy')
    expect(await screen.findByText(/Nenhuma localidade encontrada/, { selector: 'p' })).toBeInTheDocument()
  })

  it('informa falha da busca', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<SearchBox onSelect={() => {}} />)
    await userEvent.type(screen.getByRole('combobox'), 'Lisboa')
    expect(await screen.findByText(/A busca falhou/, { selector: 'p' })).toBeInTheDocument()
  })
})

describe('Timeline', () => {
  it('gira as setas de vento pela direção de origem (a forma base aponta para o sul)', () => {
    const h = normalizeForecast(makeForecastResponse()).hourly.slice(0, 4).map((x) => ({ ...x, windDirection: 0 }))
    const { container } = render(<Timeline hours={h} selected={0} pinned={null} onSelect={() => {}} timeZone="UTC" animationKey="a" />)
    const arrows = [...container.querySelectorAll('g[transform*="rotate"]')].map((g) => g.getAttribute('transform'))
    // Vento de norte (0°) sopra para o sul: sem rotação adicional
    expect(arrows.length).toBeGreaterThan(0)
    expect(arrows.every((t) => t?.endsWith('rotate(0)'))).toBe(true)
  })

  const hours = normalizeForecast(makeForecastResponse()).hourly.slice(0, 48)

  it('é um slider operável por teclado com texto descritivo', () => {
    const onSelect = vi.fn()
    render(<Timeline hours={hours} selected={0} pinned={null} onSelect={onSelect} timeZone="America/Sao_Paulo" animationKey="a" />)
    const slider = screen.getByRole('slider', { name: 'Hora selecionada na previsão' })
    expect(slider).toHaveAttribute('aria-valuemax', '47')
    expect(slider.getAttribute('aria-valuetext')).toMatch(/0h, \d+°/)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(onSelect).toHaveBeenLastCalledWith(47)
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenLastCalledWith(0)
  })
})

describe('useCachedResource', () => {
  it('ignora respostas antigas que chegam depois de uma troca de chave', async () => {
    const resolvers: Record<string, (v: string) => void> = {}
    const fetcher = (key: string) => () => new Promise<string>((r) => (resolvers[key] = r))
    const { result, rerender } = renderHook(({ k }) => useCachedResource(k, fetcher(k), 1000), { initialProps: { k: 'a' } })
    rerender({ k: 'b' })
    await act(async () => {
      resolvers.b('B')
    })
    await act(async () => {
      resolvers.a?.('A') // chega fora de ordem
    })
    expect(result.current.data).toBe('B')
  })

  it('mantém os dados anteriores e marca como desatualizados quando a atualização falha', async () => {
    let fail = false
    const fetcher = () => (fail ? Promise.reject(new HttpError('network', 'x')) : Promise.resolve('ok'))
    const { result } = renderHook(() => useCachedResource('k', fetcher, 1000))
    await waitFor(() => expect(result.current.data).toBe('ok'))
    fail = true
    await act(async () => result.current.refresh())
    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.data).toBe('ok')
    expect(result.current.error?.kind).toBe('network')
  })
})

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: (T0 + 14 * 3600 + 32 * 60) * 1000 })
  })

  it('carrega a cidade padrão e mostra leitura, resumo e painéis', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (isGrid(url) ? json([]) : json(makeForecastResponse()))),
    )
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'São Paulo' })).toBeInTheDocument()
    expect(screen.getByText(/Predominantemente limpo|Parcialmente nublado|Encoberto|Chuva/, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/chance de chuva/i, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Hora selecionada/ })).toBeInTheDocument()
  })

  it('mostra erro compreensível e recupera ao tentar de novo', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (isGrid(url)) return json([], 200)
        calls++
        return calls === 1 ? json({ error: true, reason: 'Service unavailable' }, 503) : json(makeForecastResponse())
      }),
    )
    render(<App />)
    expect(await screen.findByText(/indisponível no momento/)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Tentar de novo' })[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'São Paulo' })).toBeInTheDocument()
  })
})
