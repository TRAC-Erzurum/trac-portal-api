module.exports = {
  apps: [
    {
      name: 'trac-api',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 3000,
      wait_ready: true,
      listen_timeout: 50000,

      env: {
        NODE_ENV: 'production',
      },
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',

      source_map_support: false,
      instance_var: 'INSTANCE_ID',
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: 30000,
    },
  ],
}; 