const path = require('node:path');
const appRoot = __dirname;

module.exports = {
  apps: [{
    name: 'content-planner',
    cwd: appRoot,
    script: path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
    args: ['start', '--hostname', '127.0.0.1', '--port', process.env.PORT || '3006'],
    interpreter: process.execPath,
    exec_mode: 'fork',
    instances: 1,
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 3000,
    exp_backoff_restart_delay: 100,
    kill_timeout: 10000,
    listen_timeout: 15000,
    max_memory_restart: '1G',
    time: true,
    merge_logs: true,
    out_file: path.join(appRoot, 'logs', 'content-planner.out.log'),
    error_file: path.join(appRoot, 'logs', 'content-planner.error.log'),
    env: { NODE_ENV: 'production', PORT: process.env.PORT || '3006', NEXT_TELEMETRY_DISABLED: '1' },
  }],
};
