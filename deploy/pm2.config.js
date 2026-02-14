module.exports = {
    apps: [{
        name: 'ai-companion',
        script: 'virtual-home/server/server.js',
        cwd: __dirname + '/..',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '256M',
        env: {
            NODE_ENV: 'production'
        }
    }]
};
