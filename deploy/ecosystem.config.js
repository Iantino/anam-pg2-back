// PM2: mantiene encendidos el backend y el frontend, los reinicia si fallan
// y los vuelve a levantar cuando el servidor se reinicia.
//
// Uso (en el servidor):
//   pm2 start /var/www/muni/anam-pg2-back/deploy/ecosystem.config.js
//   pm2 save
//
// Si instalaste el sistema en otra carpeta, cambia las rutas de "cwd".

module.exports = {
  apps: [
    {
      name: "muni-api",
      cwd: "/var/www/muni/anam-pg2-back",
      script: "server.js",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
      time: true, // agrega fecha y hora a cada línea del log
    },
    {
      name: "muni-web",
      cwd: "/var/www/muni/pagina-anam-pg",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      time: true,
    },
  ],
};
