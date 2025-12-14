# V3a-08: UX Polish & Safety Guards

## Story

**Como** usuário do Vinyl-OS
**Quero** melhorias de UX no footer de gravação, toggle de idioma, e proteções de segurança
**Para** ter uma experiência mais polida e evitar gravações infinitas acidentais

## Contexto

Esta story agrupa quick wins identificados durante o uso do sistema:
- O footer de gravação mostra duração E tamanho, mas o espaço é limitado
- Não há limite de tempo nas gravações (risco de esquecer ligado)
- O i18n existe mas não há forma fácil de trocar idioma
- Falta botão de unlink nos cards de recordings

## Status: DONE (2025-12-13)

## Acceptance Criteria

### AC1: Recording Footer - Animação de Alternância
- [x] Quando gravando, alternar a cada 3s entre duração (00:05:32) e tamanho (32.5 MB)
- [x] Transição suave (fade ou slide)
- [x] Manter comportamento atual quando não está gravando

### AC2: Limite de Gravação (1 hora)
- [x] Configuração `recording.maxDurationMinutes` com default 60
- [x] Auto-stop quando atingir o limite
- [x] Toast de notificação: "Gravação finalizada automaticamente (limite de 1h)"
- [x] Evento WebSocket para frontend atualizar estado
- [x] Setting editável na página /settings

### AC3: Toggle de Idioma
- [x] Componente `LanguageToggle` com ícone Globe
- [x] Posicionado no menu "..." do footer, abaixo do toggle de tema
- [x] Persiste preferência em localStorage (via i18next-browser-languagedetector)
- [x] Troca imediata sem reload

### AC4: Botão Unlink nos Recording Cards
- [x] Adicionar botão "Unlink" (ícone Unlink do lucide) nos cards de recordings
- [x] Disponível apenas quando recording tem albumId
- [x] Chamar `PATCH /api/recordings/:id` com `albumId: null`

## Technical Notes

### Footer Animation
```typescript
// Usar useState + useEffect com setInterval
const [showDuration, setShowDuration] = useState(true);

useEffect(() => {
  if (!isRecording) return;
  const interval = setInterval(() => {
    setShowDuration(prev => !prev);
  }, 3000);
  return () => clearInterval(interval);
}, [isRecording]);
```

### Auto-stop Recording
```typescript
// RecordingManager - adicionar timer
private maxDurationTimer?: NodeJS.Timeout;

async startRecording() {
  // ... existing code ...

  const maxMinutes = config.recording.maxDurationMinutes ?? 60;
  this.maxDurationTimer = setTimeout(() => {
    this.stopRecording('max_duration_reached');
  }, maxMinutes * 60 * 1000);
}

async stopRecording(reason?: string) {
  if (this.maxDurationTimer) {
    clearTimeout(this.maxDurationTimer);
    this.maxDurationTimer = undefined;
  }
  // ... existing code ...

  if (reason === 'max_duration_reached') {
    eventBus.publish('recording.auto_stopped', { reason });
  }
}
```

### Language Toggle
```typescript
// components/LanguageToggle.tsx
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'pt-BR' ? 'en' : 'pt-BR';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggleLanguage}>
      {i18n.language === 'pt-BR' ? '🇧🇷' : '🇺🇸'}
    </Button>
  );
}
```

## Files to Modify

### Backend
- `backend/src/services/recording-manager.ts` — Auto-stop timer
- `backend/src/schemas/settings.schema.ts` — Adicionar `recording.maxDurationMinutes`

### Frontend
- `frontend/src/components/RecordingStatus.tsx` — Animação de alternância
- `frontend/src/components/LanguageToggle.tsx` — Novo componente
- `frontend/src/components/layout/Header.tsx` — Adicionar toggle
- `frontend/src/pages/Collection.tsx` ou componente de recording card — Botão unlink

## Out of Scope
- Edição de sessões (V3a-09)
- Tabela de tracks por álbum (V3b)

## Story Points
**3 pontos** — 4 tasks independentes mas simples

## Dependencies
- V1.5-13 (i18n) — Já implementado
- V3-03 (gravação) — Já implementado

---

## Adendo (pós-épico): Atualização na aba Stats

No final do Epic V3a, foi feito um ajuste na **aba `/stats`** para manter as métricas de escuta coerentes com a nova modelagem do histórico:

- **Mudança-chave:** estatísticas de escuta passaram a usar **`SessionAlbum`** (V3a-09) em vez de inferir via `Track` (log de reconhecimento).
- **Impacto:** métricas como “top álbuns”, “top artistas” e “álbuns únicos tocados” refletem a curadoria real da sessão (manual + recognition), não apenas eventos de reconhecimento.
- **Referência técnica:** `backend/src/routes/stats.ts` (comentários “V3a-09: Migrado para usar SessionAlbum em vez de Track” nos endpoints `/api/stats/listening`).
