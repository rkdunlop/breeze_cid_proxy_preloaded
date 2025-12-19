module.exports = {
  apps: [
    {
      name: 'breeze-cid-proxy',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 6,
      restart_delay: 10000,
      min_uptime: 15000,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
