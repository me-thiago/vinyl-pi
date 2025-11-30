# Story V1.12: Detecção de Troca de Faixa

**Epic:** V1 - Foundation Core (MVP)
**Status:** ⏸️ Adiada (2025-01-29)

**User Story:**
Como usuário,
quero que o sistema detecte quando uma faixa termina e outra começa,
para que possa ter eventos marcando trocas de faixa.

## Critérios de Aceitação

1. Detecção baseada em mudança abrupta de nível + silêncio curto
2. Thresholds ajustáveis (nível, duração do silêncio)
3. Evento `track.change.detected` emitido via EventBus
4. Precisão inicial pode ser <80% (aceitável)
5. Metadata inclui timestamp da detecção

## Pré-requisitos

- V1.9 - Detecção de Clipping

## Nota

Calibração manual via UI será adicionada em V1.15

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.1.3 (Reconhecimento Sonoro - Detecção de Troca de Faixa)
- [Epics](../epics.md) - Epic V1

---

## Decisão: Story Adiada

**Data:** 2025-01-29
**Decisão:** Adiar implementação para revisão futura

### Justificativa

Após análise prática com discos reais (incluindo álbuns mais antigos com ruído), identificamos que:

1. **Precisão insuficiente**: O ruído de fundo do vinil (chiado, pops, crackles) raramente permite que o nível caia abaixo do threshold de silêncio (-50dB) nos gaps entre faixas
2. **Variabilidade alta**: Gaps variam de 0.5s a 3s+, alguns álbuns têm faixas que emendam (crossfade, medley)
3. **Dados sem uso imediato**: Não há caso de uso definido para esses dados no momento
4. **Risco de poluir o banco**: Alta taxa de falsos positivos encheria o banco com ruído estatístico

### Alternativas Consideradas

- **Threshold dinâmico**: Complexo, pode gerar falsos positivos
- **Detecção por queda de energia**: Pode confundir com passagens quietas
- **Threshold configurável simples**: Não resolve discos ruidosos

### Próximos Passos

- Avançar para V2 (Dashboard/Frontend)
- Revisitar quando houver demanda real para essa feature
- Possível implementação futura com machine learning ou fingerprinting

