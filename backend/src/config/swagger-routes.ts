/**
 * @openapi
 * /api/status:
 *   get:
 *     tags:
 *       - Status
 *     summary: Obtém status completo do sistema
 *     description: |
 *       Retorna informações sobre:
 *       - Sessão ativa (se houver)
 *       - Status do streaming (ativo, listeners, bitrate)
 *       - Análise de áudio (nível dB, silêncio, clipping)
 *     responses:
 *       200:
 *         description: Status do sistema obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AudioStatus'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/status/audio:
 *   get:
 *     tags:
 *       - Status
 *     summary: Obtém status detalhado de análise de áudio
 *     description: Retorna dados detalhados do AudioAnalyzer e EventDetector
 *     responses:
 *       200:
 *         description: Status de áudio obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 capture:
 *                   type: object
 *                   description: Status da captura de áudio
 *                 analyzer:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     levelDb:
 *                       type: number
 *                       description: Nível atual em dB
 *                     rms:
 *                       type: number
 *                       description: Valor RMS atual
 *                     isActive:
 *                       type: boolean
 *                 detector:
 *                   type: object
 *                   nullable: true
 *                   description: Status do detector de eventos
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Verifica saúde do serviço
 *     description: Endpoint simples para verificar se o backend está respondendo
 *     responses:
 *       200:
 *         description: Serviço funcionando
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */

/**
 * @openapi
 * /api/settings:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Lista todas as configurações
 *     description: Retorna todas as configurações do sistema com valores atuais e metadados
 *     responses:
 *       200:
 *         description: Lista de configurações
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SettingsResponse'
 *             example:
 *               settings:
 *                 - key: silence.threshold
 *                   value: -50
 *                   type: number
 *                 - key: silence.duration
 *                   value: 10
 *                   type: number
 *                 - key: stream.bitrate
 *                   value: 192
 *                   type: number
 *       500:
 *         description: Erro ao buscar configurações
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     tags:
 *       - Settings
 *     summary: Atualiza uma ou mais configurações
 *     description: |
 *       Atualiza configurações do sistema. As mudanças são aplicadas em tempo real
 *       aos componentes relevantes (detector de silêncio, streaming, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SettingsUpdateRequest'
 *           examples:
 *             silence:
 *               summary: Ajustar detecção de silêncio
 *               value:
 *                 silence.threshold: -45
 *                 silence.duration: 15
 *             bitrate:
 *               summary: Alterar bitrate do stream
 *               value:
 *                 stream.bitrate: 256
 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SettingsUpdateResponse'
 *       400:
 *         description: Erro de validação ou corpo vazio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/settings/reset:
 *   post:
 *     tags:
 *       - Settings
 *     summary: Restaura todas as configurações para valores padrão
 *     description: Reseta todas as configurações para os valores default do sistema
 *     responses:
 *       200:
 *         description: Configurações restauradas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SettingsUpdateResponse'
 *       500:
 *         description: Erro ao restaurar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/settings/{key}/reset:
 *   post:
 *     tags:
 *       - Settings
 *     summary: Restaura uma configuração específica
 *     description: Reseta uma configuração específica para seu valor padrão
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Chave da configuração (ex. silence.threshold)
 *         example: silence.threshold
 *     responses:
 *       200:
 *         description: Configuração restaurada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SettingsUpdateResponse'
 *       400:
 *         description: Chave inválida ou não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/system/info:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Informações do sistema (somente leitura)
 *     description: Retorna informações de configuração do sistema que são somente leitura
 *     responses:
 *       200:
 *         description: Informações do sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemInfo'
 *       500:
 *         description: Erro ao obter informações
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/sessions:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Lista sessões de escuta
 *     description: Retorna lista paginada de sessões de escuta de vinil
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Número máximo de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Offset para paginação
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtrar sessões a partir desta data
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtrar sessões até esta data
 *     responses:
 *       200:
 *         description: Lista de sessões
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedSessions'
 *       500:
 *         description: Erro ao buscar sessões
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/sessions/active:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Obtém sessão ativa
 *     description: Retorna a sessão de escuta atualmente ativa, se houver
 *     responses:
 *       200:
 *         description: Status da sessão ativa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active:
 *                   type: boolean
 *                   description: Se há sessão ativa
 *                 session:
 *                   $ref: '#/components/schemas/Session'
 *                   nullable: true
 *             examples:
 *               active:
 *                 summary: Sessão ativa
 *                 value:
 *                   active: true
 *                   session:
 *                     id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                     startedAt: "2025-12-03T10:00:00.000Z"
 *                     durationSeconds: 1800
 *                     eventCount: 5
 *               inactive:
 *                 summary: Sem sessão ativa
 *                 value:
 *                   active: false
 *                   session: null
 *       503:
 *         description: SessionManager não configurado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/sessions/{id}:
 *   get:
 *     tags:
 *       - Sessions
 *     summary: Obtém detalhes de uma sessão
 *     description: Retorna detalhes de uma sessão específica incluindo todos os eventos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sessão
 *     responses:
 *       200:
 *         description: Detalhes da sessão
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Session'
 *                 - type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AudioEvent'
 *       404:
 *         description: Sessão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro ao buscar sessão
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/events:
 *   get:
 *     tags:
 *       - Events
 *     summary: Lista eventos de áudio
 *     description: Retorna lista paginada de eventos de áudio detectados
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de sessão
 *       - in: query
 *         name: event_type
 *         schema:
 *           type: string
 *           enum: [silence.start, silence.end, clipping.detected, session.start, session.end]
 *         description: Filtrar por tipo de evento
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Número máximo de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Offset para paginação
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtrar eventos a partir desta data
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filtrar eventos até esta data
 *     responses:
 *       200:
 *         description: Lista de eventos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedEvents'
 *       500:
 *         description: Erro ao buscar eventos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/events/stats:
 *   get:
 *     tags:
 *       - Events
 *     summary: Estatísticas do serviço de eventos
 *     description: Retorna estatísticas do serviço de persistência de eventos
 *     responses:
 *       200:
 *         description: Estatísticas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eventsQueued:
 *                   type: integer
 *                   description: Eventos na fila de persistência
 *                 eventsPersisted:
 *                   type: integer
 *                   description: Total de eventos persistidos
 *                 isRunning:
 *                   type: boolean
 *                   description: Se o serviço está ativo
 *       503:
 *         description: EventPersistence não configurado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Este arquivo existe apenas para documentação Swagger
// As rotas reais estão em seus respectivos arquivos de router
export {};
