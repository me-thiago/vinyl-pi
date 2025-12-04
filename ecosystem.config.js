/**
 * PM2 Ecosystem Configuration for Vinyl-OS
 *
 * Este arquivo configura todos os processos gerenciados pelo PM2:
 * - vinyl-os-icecast: Servidor de streaming Icecast2
 * - vinyl-backend: API Node.js/Express
 * - vinyl-frontend: Interface React (Vite preview)
 *
 * Comandos úteis:
 *   npm run pm2:start    - Iniciar todos os serviços
 *   npm run pm2:stop     - Parar todos os serviços
 *   npm run pm2:restart  - Reiniciar todos os serviços
 *   npm run pm2:logs     - Ver logs em tempo real
 *   npm run pm2:status   - Ver status dos processos
 *
 * Para auto-start no boot:
 *   pm2 save && pm2 startup
 *
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
  apps: [
    // =========================================================================
    // Icecast2 - Servidor de Streaming de Áudio
    // =========================================================================
    {
      name: 'vinyl-os-icecast',
      script: '/usr/bin/icecast2',
      // Usar arquivo de configuração customizado (não o do sistema)
      args: '-c /home/thiago/projects/vinyl-os/config/icecast.xml',
      // Executar binário diretamente (não via Node.js)
      interpreter: 'none',
      // Reiniciar automaticamente se falhar
      autorestart: true,
      // Não monitorar mudanças em arquivos
      watch: false,
      // Reiniciar se usar mais de 100MB (Icecast deve usar ~15-20MB)
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'development',
      },
      // Logs separados para debug
      error_file: './logs/vinyl-os-icecast-error.log',
      out_file: './logs/vinyl-os-icecast-out.log',
      log_file: './logs/vinyl-os-icecast-combined.log',
      // Incluir timestamp nos logs
      time: true,
    },

    // =========================================================================
    // Backend - API Node.js/Express + Audio Processing
    // =========================================================================
    {
      name: 'vinyl-backend',
      cwd: './backend',
      script: 'npm',
      // Em produção, use 'run start' ao invés de 'run dev'
      args: 'run dev',
      watch: false,
      env: {
        NODE_ENV: 'development',
        // Porta da API REST e WebSocket
        PORT: 3001,
        // Dispositivo ALSA para captura de áudio
        // Use 'arecord -l' para listar dispositivos disponíveis
        // Formato: plughw:CARD,DEVICE (ex: plughw:0,0, plughw:1,0)
        AUDIO_DEVICE: 'plughw:0,0',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },

    // =========================================================================
    // Frontend - Interface React (Vite)
    // =========================================================================
    {
      name: 'vinyl-frontend',
      cwd: './frontend',
      script: 'npm',
      // preview:prod serve o build de produção na porta 5173
      args: 'run preview:prod',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
    },
  ],
};
