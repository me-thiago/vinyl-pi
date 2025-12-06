# Story V2-11: Export de Dados

**Epic:** V2 - Coleção & Reconhecimento Musical  
**Status:** done

---

## User Story

Como usuário,  
quero poder exportar meus dados (coleção e histórico de escuta),  
para que tenha backup dos meus dados e possa usá-los em outros sistemas.

---

## Contexto

Esta story adiciona funcionalidade de export para que o usuário possa:
1. Fazer backup dos dados da coleção
2. Compartilhar a lista de álbuns (ex: para Discogs, planilhas)
3. Analisar histórico de escuta externamente

---

## Critérios de Aceitação

### AC-1: Backend - Export da Coleção
- [x] `GET /api/export/collection?format=json` retorna coleção em JSON
- [x] `GET /api/export/collection?format=csv` retorna coleção em CSV
- [x] Inclui todos os campos: title, artist, year, label, format, condition, tags, notes, discogsId
- [x] Opção `?archived=true` para incluir álbuns arquivados (default: false)
- [x] Header `Content-Disposition` para download do arquivo

### AC-2: Backend - Export do Histórico
- [x] `GET /api/export/history?format=json` retorna histórico em JSON
- [x] `GET /api/export/history?format=csv` retorna histórico em CSV
- [x] Inclui: data da sessão, duração, álbuns tocados
- [x] Filtro por período: `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- [x] Header `Content-Disposition` para download do arquivo

### AC-3: UI - Botões de Export
- [x] Botão "Exportar" na página Collection (dropdown: JSON/CSV)
- [x] Botão "Exportar Histórico" na página Sessions (dropdown: JSON/CSV)
- [x] Feedback visual durante download
- [x] Arquivo baixa automaticamente com nome descritivo

---

## Formato dos Arquivos

### Coleção - JSON

```json
{
  "exportedAt": "2025-12-06T14:30:00Z",
  "totalAlbums": 127,
  "albums": [
    {
      "title": "Dark Side of the Moon",
      "artist": "Pink Floyd",
      "year": 1973,
      "label": "Harvest",
      "format": "LP",
      "condition": "vg_plus",
      "tags": ["rock", "progressive", "favorite"],
      "notes": "Edição UK original",
      "discogsId": 123456,
      "addedAt": "2025-11-15T10:00:00Z"
    }
  ]
}
```

### Coleção - CSV

```csv
title,artist,year,label,format,condition,tags,notes,discogsId,addedAt
"Dark Side of the Moon","Pink Floyd",1973,"Harvest","LP","vg_plus","rock;progressive;favorite","Edição UK original",123456,"2025-11-15"
```

### Histórico - JSON

```json
{
  "exportedAt": "2025-12-06T14:30:00Z",
  "period": { "from": "2025-11-01", "to": "2025-12-06" },
  "totalSessions": 52,
  "sessions": [
    {
      "date": "2025-12-06",
      "startedAt": "2025-12-06T14:00:00Z",
      "endedAt": "2025-12-06T16:30:00Z",
      "durationMinutes": 150,
      "albumsPlayed": [
        { "title": "Dark Side of the Moon", "artist": "Pink Floyd" },
        { "title": "Abbey Road", "artist": "The Beatles" }
      ]
    }
  ]
}
```

### Histórico - CSV

```csv
date,startedAt,endedAt,durationMinutes,albumTitle,albumArtist
"2025-12-06","14:00:00","16:30:00",150,"Dark Side of the Moon","Pink Floyd"
"2025-12-06","14:00:00","16:30:00",150,"Abbey Road","The Beatles"
```

*Nota: No CSV, cada álbum por sessão gera uma linha (formato "flat").*

---

## Design da UI

### Botão na Collection

```
┌─────────────────────────────────────────────────────────────────┐
│  💿 Minha Coleção                      [+ Adicionar] [Exportar ▼]│
│                                         ┌──────────────┐        │
│                                         │ 📄 JSON      │        │
│                                         │ 📊 CSV       │        │
│                                         └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Botão nas Sessions

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Sessões de Escuta                              [Exportar ▼] │
│                                         ┌──────────────┐        │
│                                         │ 📄 JSON      │        │
│                                         │ 📊 CSV       │        │
│                                         └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementação Técnica

### Backend - export.ts (novo router)

```typescript
router.get('/collection', async (req, res) => {
  const format = req.query.format || 'json';
  const includeArchived = req.query.archived === 'true';
  
  const albums = await prisma.album.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { artist: 'asc' }
  });
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="collection.csv"');
    return res.send(albumsToCSV(albums));
  }
  
  res.setHeader('Content-Disposition', 'attachment; filename="collection.json"');
  return res.json({ exportedAt: new Date(), totalAlbums: albums.length, albums });
});
```

---

## i18n Keys

```json
{
  "export": {
    "exportCollection": "Exportar Coleção",
    "exportHistory": "Exportar Histórico",
    "formatJson": "JSON",
    "formatCsv": "CSV",
    "downloading": "Baixando...",
    "includeArchived": "Incluir arquivados"
  }
}
```

---

## Pré-requisitos

- [x] V2-09 - Histórico de Escuta Expandido (dados de álbuns por sessão)
- [x] V2-10 - Estatísticas da Coleção (opcional, mas faz sentido ter stats antes de export)

---

## Estimativa

- **Complexidade:** Baixa
- **Pontos:** 2
- **Tempo estimado:** 1-2 horas

---

## Referências

- [PRD v3.0](../prd-v3.md) - Seção 5.2.4 (UI Expandida - Histórico de Escuta)
- [Epics](../epics.md) - Epic V2

---

## Histórico

| Data | Ação | Motivo |
|------|------|--------|
| 2025-12-06 | Expansão | Detalhar formatos e UI |
| 2025-12-06 | Implementação | Story completa - Backend e Frontend |
