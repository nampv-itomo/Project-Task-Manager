module.exports = {
  apps: [
    {
      name: "project-task-manager",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3600",
      // db.ts dùng process.cwd()/data → cwd phải là thư mục dự án
      cwd: __dirname,
      instances: 1, // SQLite (better-sqlite3) → không chạy cluster
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3600,
      },
    },
  ],
};
