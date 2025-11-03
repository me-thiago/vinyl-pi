module.exports = {
  apps: [
    {
      name: 'vinyl-os-icecast',
      script: '/usr/bin/icecast2',
      args: '-c /home/thiago/projects/vinyl-os/config/icecast.xml',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/vinyl-os-icecast-error.log',
      out_file: './logs/vinyl-os-icecast-out.log',
      log_file: './logs/vinyl-os-icecast-combined.log',
      time: true,
    },
    {
      name: 'vinyl-backend',
      cwd: './backend',
      script: 'npm',
      args: 'run dev',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
    {
      name: 'vinyl-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
    },
  ],
};
