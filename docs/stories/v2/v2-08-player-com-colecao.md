# Story V2-08: Link Reconhecimento → Coleção no Player

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** deferred

---

## User Story

Como usuário,  
quero ver a capa do álbum e metadados completos quando uma música é reconhecida,  
para que tenha uma experiência visual rica e persistente no player.

---

## ⚠️ Status: Adiado (Revisão Pós-Epic V2)

Esta story foi adiada durante a implementação do Epic V2 devido a:

### 1. Overlap com V2-07

Vários critérios originais já foram implementados em V2-07:
- ✅ Botão "Adicionar à coleção" se não encontrado → Toast com ação + navegação com prefill
- ✅ WebSocket event `track_recognized` → Já implementado em V2-06
- ⚠️ Link para álbum na coleção → Modal mostra matches, mas não há link direto no player

### 2. Problema de Reconhecimento Manual vs Automático

**Dilema central:** Sem reconhecimento automático, qualquer UI de "Now Playing" fica desatualizada.

- O usuário precisa clicar manualmente no botão [🎵] para identificar
- Se a música muda e ele não reconhece novamente, o display mostra música antiga
- Isso cria uma experiência confusa e potencialmente enganosa

### 3. Reconhecimento Automático Exige Plano Robusto

Para resolver o problema acima, seria necessário implementar:

| Feature | Complexidade | Descrição |
|---------|--------------|-----------|
| Timing dinâmico | Alta | Usar `durationSeconds` da faixa para agendar próximo reconhecimento |
| Detecção de silêncio/gap | Média | Identificar troca de faixa para trigger automático |
| Rate limiting inteligente | Média | Evitar gastar créditos de API desnecessariamente |
| UI de status de auto-reconhecimento | Baixa | Toggle on/off, indicador de próximo reconhecimento |
| Fallback quando API falha | Média | O que mostrar se o auto-reconhecimento falhar? |

**Referência:** Ver Tech Spec V2, seção "Workflow 2: Reconhecimento Automático" e AC-11.

Este escopo ultrapassa uma única story e pode exigir:
- Refatoração do reconhecimento atual
- Decisões de UX sobre como lidar com "música desconhecida"
- Testes extensivos de consumo de API

---

## Proposta de Escopo Revisado (Para Futuro)

Se esta story for retomada, sugerimos dividir em:

### V2-08a: UI de Now Playing (Visual Only)
- Expandir PlayerBar quando há música reconhecida
- Mostrar capa, título, artista, álbum, ano
- Link para álbum na coleção
- **Sem** reconhecimento automático
- Exibe última música reconhecida manualmente

### V2-08b: Reconhecimento Automático
- Toggle para habilitar/desabilitar
- Timing baseado em `durationSeconds`
- Integração com detecção de silêncio/troca de faixa (V1-12)
- Controle de rate limiting
- UI de status (próximo reconhecimento em X segundos)

---

## Critérios de Aceitação (Original - Para Referência)

1. ~~Player atualizado para mostrar capa do álbum quando reconhecido~~
2. ~~Metadados completos: artista, título, álbum, ano~~
3. ~~Link para álbum na coleção (se encontrado)~~
4. ~~Botão "Adicionar à coleção" se não encontrado~~ → **Implementado em V2-07**
5. ~~WebSocket event `track_recognized` atualiza player em tempo real~~ → **Implementado em V2-06**

---

## Design Proposto (Opção A - PlayerBar Expandido)

Quando há música reconhecida, o footer cresce para mostrar capa + metadados:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🖼️  "Hey Jude" - The Beatles (1968)                   [Ver álbum] │
│       Album: Hey Jude                                               │
├─────────────────────────────────────────────────────────────────────┤
│ [Play] [Backend] --- [VU Meter] [🎵] --- [Volume] [Latency] [Menu]  │
└─────────────────────────────────────────────────────────────────────┘
```

**Nota:** Este design depende de decisão sobre reconhecimento automático.

---

## Pré-requisitos

- [x] V2-07 - UI de Matching/Confirmação
- [ ] V1-12 - Detecção Troca de Faixa (deferred) → Necessário para auto-reconhecimento

---

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.4 (UI Expandida - Player Atualizado)
- [PRD v3.0](../prd-v3.md) - Seção 7.2 (WebSocket Events - Track Reconhecido)
- [Tech Spec V2](../tech-spec-epic-v2.md) - Workflow 2 (Reconhecimento Automático), AC-11
- [Epics](../epics.md) - Epic V2

---

## Histórico

| Data | Ação | Motivo |
|------|------|--------|
| 2025-12-06 | Status → `deferred` | Overlap com V2-07, problema de reconhecimento automático não resolvido |
