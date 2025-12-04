import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vinyl-OS API',
      version: '1.5.0',
      description: 'API para controle e monitoramento do sistema Vinyl-OS - streaming de áudio para Icecast com detecção de eventos',
      contact: {
        name: 'Vinyl-OS',
        url: 'https://github.com/user/vinyl-os'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de desenvolvimento'
      }
    ],
    tags: [
      { name: 'Status', description: 'Status do sistema e streaming' },
      { name: 'Settings', description: 'Configurações do sistema' },
      { name: 'Sessions', description: 'Sessões de escuta de vinil' },
      { name: 'Events', description: 'Eventos de áudio detectados' },
      { name: 'Health', description: 'Verificação de saúde do serviço' }
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Mensagem de erro legível'
                },
                code: {
                  type: 'string',
                  description: 'Código de erro para identificação programática'
                }
              },
              required: ['message']
            }
          },
          example: {
            error: {
              message: 'Recurso não encontrado',
              code: 'NOT_FOUND'
            }
          }
        },
        Session: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Identificador único da sessão'
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data/hora de início da sessão'
            },
            endedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Data/hora de término da sessão (null se ativa)'
            },
            durationSeconds: {
              type: 'integer',
              description: 'Duração da sessão em segundos'
            },
            eventCount: {
              type: 'integer',
              description: 'Quantidade de eventos detectados na sessão'
            }
          },
          example: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            startedAt: '2025-12-03T10:00:00.000Z',
            endedAt: '2025-12-03T11:30:00.000Z',
            durationSeconds: 5400,
            eventCount: 12
          }
        },
        AudioEvent: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Identificador único do evento'
            },
            sessionId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID da sessão associada'
            },
            eventType: {
              type: 'string',
              enum: ['silence.start', 'silence.end', 'clipping.detected', 'session.start', 'session.end'],
              description: 'Tipo do evento de áudio'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Momento em que o evento ocorreu'
            },
            metadata: {
              type: 'object',
              nullable: true,
              description: 'Metadados adicionais do evento',
              additionalProperties: true
            }
          },
          example: {
            id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            eventType: 'silence.start',
            timestamp: '2025-12-03T10:15:30.000Z',
            metadata: { levelDb: -55, durationMs: 10500 }
          }
        },
        Setting: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Chave única da configuração'
            },
            value: {
              oneOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'boolean' }
              ],
              description: 'Valor atual da configuração'
            },
            type: {
              type: 'string',
              enum: ['string', 'number', 'boolean'],
              description: 'Tipo do valor'
            }
          },
          example: {
            key: 'silence.threshold',
            value: -50,
            type: 'number'
          }
        },
        AudioStatus: {
          type: 'object',
          properties: {
            session: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                started_at: { type: 'string', format: 'date-time' },
                duration: { type: 'integer', description: 'Duração em segundos' },
                event_count: { type: 'integer' }
              }
            },
            streaming: {
              type: 'object',
              properties: {
                active: { type: 'boolean', description: 'Se streaming está ativo' },
                listeners: { type: 'integer', description: 'Número de ouvintes conectados' },
                bitrate: { type: 'integer', description: 'Bitrate em kbps' },
                mount_point: { type: 'string', description: 'Mount point do Icecast' }
              }
            },
            audio: {
              type: 'object',
              properties: {
                level_db: { type: 'number', nullable: true, description: 'Nível de áudio em dB' },
                clipping_detected: { type: 'boolean', description: 'Se clipping foi detectado' },
                clipping_count: { type: 'integer', description: 'Contagem de clippings' },
                silence_detected: { type: 'boolean', description: 'Se silêncio foi detectado' }
              }
            }
          },
          example: {
            session: {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              started_at: '2025-12-03T10:00:00.000Z',
              duration: 1800,
              event_count: 5
            },
            streaming: {
              active: true,
              listeners: 2,
              bitrate: 192,
              mount_point: '/stream'
            },
            audio: {
              level_db: -25.5,
              clipping_detected: false,
              clipping_count: 0,
              silence_detected: false
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ok', 'degraded', 'error'],
              description: 'Status geral do serviço'
            },
            message: {
              type: 'string',
              description: 'Mensagem descritiva'
            }
          },
          example: {
            status: 'ok',
            message: 'Vinyl-OS Backend is running'
          }
        },
        SystemInfo: {
          type: 'object',
          properties: {
            device: {
              type: 'string',
              description: 'Dispositivo de áudio ALSA'
            },
            sampleRate: {
              type: 'integer',
              description: 'Taxa de amostragem em Hz'
            },
            version: {
              type: 'string',
              description: 'Versão do Vinyl-OS'
            },
            icecastUrl: {
              type: 'string',
              description: 'URL completa do stream Icecast'
            }
          },
          example: {
            device: 'plughw:1,0',
            sampleRate: 48000,
            version: 'v1.19',
            icecastUrl: 'http://localhost:8000/stream'
          }
        },
        PaginatedSessions: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              items: { $ref: '#/components/schemas/Session' }
            },
            total: {
              type: 'integer',
              description: 'Total de sessões encontradas'
            },
            hasMore: {
              type: 'boolean',
              description: 'Se há mais resultados disponíveis'
            }
          }
        },
        PaginatedEvents: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/AudioEvent' }
            },
            total: {
              type: 'integer',
              description: 'Total de eventos encontrados'
            },
            hasMore: {
              type: 'boolean',
              description: 'Se há mais resultados disponíveis'
            }
          }
        },
        SettingsResponse: {
          type: 'object',
          properties: {
            settings: {
              type: 'array',
              items: { $ref: '#/components/schemas/Setting' }
            }
          }
        },
        SettingsUpdateRequest: {
          type: 'object',
          description: 'Objeto com chaves de configuração e novos valores',
          additionalProperties: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' }
            ]
          },
          example: {
            'silence.threshold': -45,
            'silence.duration': 15,
            'stream.bitrate': 256
          }
        },
        SettingsUpdateResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            settings: {
              type: 'array',
              items: { $ref: '#/components/schemas/Setting' }
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/config/swagger-routes.ts']
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Vinyl-OS API Docs'
  }));

  // Endpoint para obter spec JSON
  app.get('/api/docs.json', (_req, res) => {
    res.json(specs);
  });
}

export { specs };
