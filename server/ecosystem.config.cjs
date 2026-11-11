module.exports = {
  apps: [
    {
      name: "ticknote-timeline",
      cwd: "/opt/ticknote-timeline",
      script: "src/index.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 3015,
        TIMELINE_DATA_DIR: "/opt/ticknote-timeline/data",
        JWT_SECRET:
          process.env.TIMELINE_JWT_SECRET ||
          process.env.JWT_SECRET ||
          "ticknote-timeline-change-me",
      },
    },
  ],
};
