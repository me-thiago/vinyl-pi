# V3b-Spike-01: Chromaprint Calibration (fpcalc) — Score e Robustez

## Story

**Como** maintainer do Vinyl-OS  
**Quero** calibrar o reconhecimento local via Chromaprint (fpcalc) em cenários reais (vinil + ring buffer)  
**Para** escolher duração mínima de sample, entender distribuição de scores e definir thresholds com segurança

## Contexto

O V3b usará reconhecimento **local-first** por faixa, com fallback para AudD quando o match local for inconclusivo.

Antes de cravar thresholds, precisamos medir no **hardware real (Raspberry Pi)** e com áudio real:
- qualidade de vinil (ruído, variação de ganho)
- sample em janelas curtas
- possíveis falsos positivos

Este spike produz dados para fechar:
- duração mínima do sample (ex.: 3s/8s/15s)
- comportamento do score (normalizado 0..1) em casos “correto”, “errado” e “ambíguo”

## Hipóteses

1. Match “correto” tende a ter score alto e gap significativo para o 2º lugar.
2. Música diferente (mesmo álbum ou outro) tende a score baixo.
3. Samples muito curtos (ex.: 2–3s) podem aumentar ambiguidade/instabilidade.

## Acceptance Criteria

### AC1: Setup e ferramentas
- [ ] Confirmar disponibilidade de `fpcalc` (Chromaprint) no Pi e registrar versão.
- [ ] Confirmar pipeline para obter samples comparáveis:
  - **(A)** sample “ao vivo” (ring buffer / sample do RecognitionService)
  - **(B)** segmento equivalente do FLAC gravado (da gravação fonte)

### AC2: Matriz de testes executada
Executar no mínimo:
- [ ] **Caso 1 (correto)**: sample ao vivo de uma faixa vs fingerprint da mesma faixa
- [ ] **Caso 2 (mesmo álbum, faixa diferente)**: sample ao vivo vs fingerprint de outra faixa do mesmo álbum
- [ ] **Caso 3 (outro álbum/artista)**: sample ao vivo vs fingerprint de faixa de outro álbum
- [ ] **Caso 4 (controle)**: silêncio/ruído (quando aplicável)

E variar duração do sample:
- [ ] 3s
- [ ] 8s
- [ ] 15s

### AC3: Coleta de dados
- [ ] Para cada execução, registrar:
  - `sampleSeconds`
  - faixa alvo (albumId, trackNumber)
  - score do top-1 e top-2 (raw e normalizado 0..1)
  - decisão humana: correto/errado/ambíguo
  - observações (ruído alto, dropouts, etc.)

### AC4: Recomendações objetivas
- [ ] Recomendar:
  - duração mínima padrão do sample (e opcional: fallback para duração maior quando ambíguo)
  - heurística inicial (não definitiva) para:
    - threshold mínimo
    - gap mínimo entre top-1 e top-2
- [ ] Recomendar formato final do score exposto pelo engine (0..1) e o que representa.

### AC5: Artefato do spike (resultado)
- [ ] Preencher a seção **Resultados** neste arquivo com tabelas e conclusões.

## Procedimento sugerido (alto nível)

1. Escolher 2 álbuns com gravações boas (idealmente 1 bem limpo e 1 com ruído mais alto).
2. Para cada álbum:
   - escolher 2 faixas (uma “alvo” e uma “diferente mas próxima”)
3. Gerar fingerprints das faixas pelo método do V3b (extração do segmento + fpcalc).
4. Capturar samples ao vivo em 3 durações.
5. Rodar matching local e coletar scores.

> Nota: este spike não precisa fechar implementação final do matching engine — o objetivo é calibrar e reduzir incerteza.

## Resultados (preencher)

### Ambiente

- Pi Model / OS:
- `fpcalc --version`:
- Duração ring buffer:

### Tabela de resultados (exemplo)

| Caso | sampleSeconds | alvo | top1 (raw) | top1 (0..1) | top2 (0..1) | gap | esperado |
|------|---------------|------|------------|-------------|-------------|-----|----------|
| correto | 3s | Album X - Faixa 1 | | | | | ✅ |
| errado (mesmo álbum) | 3s | Album X - Faixa 2 | | | | | ❌ |
| errado (outro álbum) | 3s | Album Y - Faixa 3 | | | | | ❌ |

### Conclusões

- Duração mínima recomendada:
- Observações de ruído/robustez:
- Heurística inicial sugerida (a validar em stories futuras):
  - threshold:
  - gap:

## Out of Scope

- Definir UX de ambiguidades (no V3b MVP, ambíguo cai para AudD)
- Otimizações de performance (apenas medir e registrar)
