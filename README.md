# CLIMAS

Um instrumento digital para ler a atmosfera. O CLIMAS mostra a previsão das próximas 48 horas numa linha do tempo interativa, e essa linha do tempo comanda todo o resto da interface: um mapa com uma grade real de 63 pontos de dados, os painéis de chuva, vento e sol e um resumo em texto gerado a partir da previsão.

Os dados vêm da [Open-Meteo](https://open-meteo.com/), que é gratuita e não exige chave de API.

## O que ele faz

- **Leitura atual** com temperatura, sensação térmica, condição, mínima e máxima do dia, umidade, vento e chance de chuva.
- **Resumo atmosférico** escrito a partir dos dados por regras determinísticas e testáveis (`src/lib/summary.ts`). Quando faltam dados, ele não afirma nada.
- **Linha do tempo de 48 h** com a curva de temperatura colorida por uma rampa térmica absoluta, a chance de chuva (%) separada do volume previsto (mm) e setas de vento. Funciona com arrasto, toque e teclado (setas, PageUp/PageDown, Home/End) e tem uma tabela como alternativa textual.
- **Mapa atmosférico**: uma grade de 7×9 pontos da Open-Meteo, pedida numa única requisição. O app desenha isotermas interpoladas e partículas de vento que seguem as componentes u/v reais. A legenda informa que o campo é interpolado. Os modos são temperatura, chance de chuva e vento, e tocar no mapa consulta aquele ponto.
- **Comparação entre horas**: dá para fixar uma hora e compará-la com qualquer outra.
- **Visão de 7 dias** numa escala de temperatura compartilhada.
- **Ciclo solar** como fração do tempo entre o nascer e o pôr do sol (não é a elevação real do Sol).
- **Busca de cidades** com debounce, cancelamento e homônimos diferenciados por estado e país. Também há **geolocalização**, pedida só quando o usuário clica.
- **Favoritos**, **português/inglês**, **°C/°F**, **tema escuro/claro/do sistema**.
- **Offline**: a última previsão fica salva com data e hora, e o app pode ser instalado como PWA.

## Tecnologias

React 19, TypeScript, Vite, CSS Modules com tokens próprios, d3 (scale, shape, contour) para os gráficos, MapLibre GL com tiles do OpenFreeMap para o mapa base, Vitest e Testing Library para os testes, oxlint para o lint e vite-plugin-pwa para o modo offline.

## Rodando localmente

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros scripts:

```bash
npm test           # testes (Vitest)
npm run typecheck  # verificação de tipos
npm run lint       # oxlint
npm run build      # build de produção em dist/
npm run preview    # serve o build localmente
```

## Deploy na Vercel

O projeto já vem com `vercel.json`. Para publicar, importe o repositório em [vercel.com/new](https://vercel.com/new) e confirme as opções: framework Vite, comando `npm run build`, saída `dist`. Nenhuma variável de ambiente é necessária.

## Arquitetura

```
src/
  lib/            lógica pura e testável
    http.ts         fetch com timeout, cancelamento e erros tipados
    api/            previsão, grade do mapa e geocodificação (URL + normalização)
    summary.ts      regras do resumo
    field.ts        interpolação da grade e componentes do vento
    time.ts         datas sempre no fuso da localidade (horário de verão incluído)
    units.ts        conversões e formatação
    cache.ts        cache em memória e localStorage com data
  state/          hooks: dados com cache e proteção contra respostas fora de ordem,
                  busca, geolocalização, preferências, tema
  i18n/           textos em português e inglês
  components/     interface; map/ contém o mapa (carregado sob demanda)
  styles/         tokens e estilos globais
```

### Decisões sobre os dados

- Os horários chegam em `unixtime` e são formatados no fuso IANA da localidade, então o horário de verão é tratado sem cálculos manuais.
- A API é sempre consultada em unidades métricas. A troca para °F/mph/in acontece no cliente, sem nova requisição.
- Um valor ausente vira `null` e aparece como "—". Nenhum número é inventado.
- As condições "agora" são a estimativa do modelo para o momento atual, não uma medição de estação, e a interface diz isso.
- Respostas recentes ficam em cache por 10 min (previsão) e 20 min (grade). Requisições iguais em paralelo são deduplicadas, e respostas antigas que chegam depois de uma troca de cidade são descartadas.

## Créditos

Dados meteorológicos: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Mapa base: [OpenFreeMap](https://openfreemap.org/), © [colaboradores do OpenStreetMap](https://www.openstreetmap.org/copyright).
