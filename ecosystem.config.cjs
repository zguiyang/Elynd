module.exports = {
  apps: [
    {
      name: 'elynd-backend',
      script: './bin/server.js',
      cwd: './backend/build',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3335
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'elynd-jobs',
      script: './ace.js',
      args: 'jobs:listen',
      cwd: './backend/build',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/jobs-error.log',
      out_file: './logs/jobs-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'elynd-web',
      script: 'serve',
      args: './web/dist --port 3336 --spa',
      interpreter: 'none',
      cwd: __dirname,
      autorestart: true,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
