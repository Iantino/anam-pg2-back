# Guía de despliegue — Sistema Municipal de San Pablo Jocopilas

Esta guía instala el sistema completo (sitio público, panel administrativo, API y base de datos) en un servidor VPS con Ubuntu 24.04, con HTTPS, arranque automático y respaldos diarios.

En toda la guía, reemplaza:

- `TU_DOMINIO` por el dominio real (por ejemplo `munisanpablojocopilas.gob.gt`).
- `IP_DEL_SERVIDOR` por la IP que te da el proveedor del VPS.

Tiempo estimado la primera vez: 2 a 3 horas.

---

## 0. Lo que necesitas

- **Un VPS** con Ubuntu 24.04 LTS, mínimo **2 GB de RAM** y 25 GB de disco (DigitalOcean, Hetzner, Vultr, Contabo, Hostinger VPS, etc.).
- **Un dominio** y acceso a su configuración de DNS.
- En tu computadora con Windows:
  - **PowerShell** (ya viene con Windows) para conectarte por SSH.
  - **WinSCP** (gratuito, winscp.net) para subir y descargar archivos.

La arquitectura queda así:

| Dirección | Qué es | Puerto interno |
|---|---|---|
| `https://TU_DOMINIO` | Sitio público y panel `/admin` (Next.js) | 3000 |
| `https://api.TU_DOMINIO` | API (Express) | 4000 |
| (solo interno) | MySQL | 3306 |

---

## 1. Preparar la base de datos en tu computadora

Se exporta la **estructura** y los **catálogos** (roles, estados, tipos de trámite, datos de la institución). Los trámites, usuarios y mensajes de prueba **no** se pasan: producción empieza limpia.

Abre CMD y ejecuta (cada comando pide la contraseña de root):

```
"C:\Program Files\MySQL\MySQL Server 26.7\bin\mysqldump.exe" -u root -p --set-gtid-purged=OFF --no-data municipalidad_sanpablojocopilas > "D:\U\10 Semestre\pg2\01_estructura.sql"
```

```
"C:\Program Files\MySQL\MySQL Server 26.7\bin\mysqldump.exe" -u root -p --set-gtid-purged=OFF --no-create-info municipalidad_sanpablojocopilas roles permisos rol_permiso estados_tramite tipos_tramite institucion > "D:\U\10 Semestre\pg2\03_catalogos.sql"
```

Copia también `anam-pg2-back\sql\002_biografia_alcalde.sql` junto a esos dos archivos. Ya tienes los tres scripts: `01_estructura.sql`, `002_biografia_alcalde.sql` y `03_catalogos.sql`.

---

## 2. Contratar el VPS y apuntar el dominio

1. Crea el VPS con **Ubuntu 24.04** y anota su IP.
2. En el panel DNS del dominio crea tres registros tipo **A** apuntando a esa IP:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` (el dominio solo) | IP_DEL_SERVIDOR |
| A | `www` | IP_DEL_SERVIDOR |
| A | `api` | IP_DEL_SERVIDOR |

Los cambios de DNS pueden tardar desde minutos hasta unas horas. Mientras tanto puedes seguir con los pasos 3 al 9.

---

## 3. Primer ingreso y seguridad básica

Desde PowerShell:

```bash
ssh root@IP_DEL_SERVIDOR
```

Ya dentro del servidor:

```bash
# Actualizar el sistema
apt update && apt upgrade -y

# Zona horaria de Guatemala (afecta las fechas de auditoría y trámites)
timedatectl set-timezone America/Guatemala

# Crear el usuario que correrá el sistema (no usar root para todo)
adduser muni
usermod -aG sudo muni

# Firewall: solo SSH y web
ufw allow OpenSSH
ufw allow 'Nginx Full' 2>/dev/null || true
ufw --force enable

# Memoria de intercambio (evita que "npm run build" se quede sin memoria)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Cierra la sesión (`exit`) y a partir de aquí entra siempre con el usuario nuevo:

```bash
ssh muni@IP_DEL_SERVIDOR
```

---

## 4. Instalar Node.js, MySQL, Nginx, PM2 y Certbot

```bash
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL, Nginx y Certbot (certificados HTTPS gratuitos)
sudo apt install -y mysql-server nginx certbot python3-certbot-nginx

# PM2 (mantiene encendido el sistema)
sudo npm install -g pm2

# Ahora que Nginx existe, permitirlo en el firewall
sudo ufw allow 'Nginx Full'

# Verificar versiones
node -v && mysql --version && nginx -v
```

---

## 5. Crear la base de datos

Genera una contraseña fuerte para la base de datos y guárdala (la usarás en el paso 7):

```bash
openssl rand -base64 24
```

Entra a MySQL:

```bash
sudo mysql
```

Dentro de MySQL (cambia `CONTRASEÑA_BD` por la que generaste):

```sql
CREATE DATABASE municipalidad_sanpablojocopilas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'muni_app'@'localhost' IDENTIFIED BY 'CONTRASEÑA_BD';
GRANT ALL PRIVILEGES ON municipalidad_sanpablojocopilas.* TO 'muni_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

El usuario `muni_app` solo tiene acceso a esta base de datos y solo desde el propio servidor; MySQL no queda expuesto a internet.

---

## 6. Subir el código y los scripts SQL

En el servidor, crea la carpeta:

```bash
sudo mkdir -p /var/www/muni
sudo chown muni:muni /var/www/muni
```

Con **WinSCP** (protocolo SFTP, usuario `muni`), sube a `/var/www/muni/`:

- La carpeta `anam-pg2-back`
- La carpeta `pagina-anam-pg`
- Los tres scripts SQL del paso 1

**No subas** estas carpetas/archivos (se generan en el servidor o tienen datos locales):

- `node_modules` (en ambos proyectos)
- `.next` (frontend)
- `.env` (backend)
- el contenido de `anam-pg2-back/uploads` (deja la carpeta vacía)

Importa la base de datos, **en este orden**:

```bash
cd /var/www/muni
sudo mysql municipalidad_sanpablojocopilas < 01_estructura.sql
sudo mysql < 002_biografia_alcalde.sql
sudo mysql municipalidad_sanpablojocopilas < 03_catalogos.sql

# Verificar
sudo mysql municipalidad_sanpablojocopilas -e "SHOW TABLES; SELECT * FROM roles; SELECT * FROM estados_tramite;"
```

Deben aparecer las tablas, los roles **Administrador** y **Operativo**, y los estados de trámite.

---

## 7. Configurar y arrancar el backend

```bash
cd /var/www/muni/anam-pg2-back
npm ci --omit=dev
cp .env.example .env
nano .env
```

Deja el `.env` así (con tus valores):

```
PORT=4000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=3306
DB_USER=muni_app
DB_PASSWORD=CONTRASEÑA_BD
DB_NAME=municipalidad_sanpablojocopilas

SESSION_SECRET=PEGA_AQUI_EL_SECRETO
FRONTEND_ORIGIN=https://TU_DOMINIO

MAX_INTENTOS_FALLIDOS=5
BLOQUEO_MINUTOS=15
```

Para generar `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

(En nano: `Ctrl+O`, Enter para guardar, `Ctrl+X` para salir.)

Protege el archivo y crea el primer Administrador:

```bash
chmod 600 .env
npm run crear-admin
```

El script pide usuario, nombre y contraseña (no se muestra al escribirla). Ese será el usuario del encargado de la Municipalidad. Este mismo comando sirve más adelante para **restablecer la contraseña** si alguien la olvida.

> Si el backend se niega a arrancar con el mensaje "Define SESSION_SECRET…", es a propósito: en producción no se permite la clave de ejemplo.

---

## 8. Compilar el frontend

```bash
cd /var/www/muni/pagina-anam-pg
cp .env.production.example .env.production
nano .env.production      # pon: NEXT_PUBLIC_API_URL=https://api.TU_DOMINIO
npm ci
npm run build
```

La compilación tarda unos minutos. Debe terminar con la lista de rutas (`/`, `/alcalde`, `/admin`, etc.) sin errores.

> Si en el futuro cambias `.env.production`, debes volver a ejecutar `npm run build`: Next.js incrusta ese valor al compilar.

---

## 9. Encender todo con PM2

```bash
pm2 start /var/www/muni/anam-pg2-back/deploy/ecosystem.config.js
pm2 status          # muni-api y muni-web deben decir "online"
pm2 logs --lines 20 # debe verse "Conexión a MySQL establecida" y "(producción)"

# Arranque automático cuando el servidor se reinicie:
pm2 startup         # copia y ejecuta el comando "sudo env PATH=..." que te muestra
pm2 save
```

---

## 10. Nginx y HTTPS

```bash
cd /var/www/muni/anam-pg2-back/deploy
sed 's/TU_DOMINIO/munisanpablojocopilas.gob.gt/g' nginx-muni.conf | sudo tee /etc/nginx/sites-available/muni > /dev/null
```

(Cambia `munisanpablojocopilas.gob.gt` por tu dominio real en el comando anterior.)

```bash
sudo ln -s /etc/nginx/sites-available/muni /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Cuando el DNS del paso 2 ya apunte al servidor (compruébalo abriendo `http://TU_DOMINIO`), activa HTTPS:

```bash
sudo certbot --nginx -d TU_DOMINIO -d www.TU_DOMINIO -d api.TU_DOMINIO
```

Certbot pide un correo (para avisos de vencimiento) y configura todo solo. El certificado se renueva automáticamente; puedes comprobarlo con:

```bash
sudo certbot renew --dry-run
```

---

## 11. Respaldos automáticos

```bash
chmod +x /var/www/muni/anam-pg2-back/deploy/respaldo.sh

# Probarlo una vez a mano:
/var/www/muni/anam-pg2-back/deploy/respaldo.sh
ls -lh ~/respaldos

# Programarlo todos los días a las 2:30 a. m.:
crontab -e
```

Al final del archivo que se abre, agrega esta línea y guarda:

```
30 2 * * * /var/www/muni/anam-pg2-back/deploy/respaldo.sh >> /home/muni/respaldos/respaldo.log 2>&1
```

Los respaldos quedan en `/home/muni/respaldos` y se conservan 14 días.

> **Muy importante:** descarga con WinSCP una copia de `/home/muni/respaldos` al menos una vez por semana a una computadora o disco de la Municipalidad. Si el servidor se pierde, los respaldos que están dentro de él se pierden también.

### Restaurar un respaldo (si algún día hace falta)

```bash
gunzip < ~/respaldos/bd_FECHA.sql.gz | sudo mysql municipalidad_sanpablojocopilas
tar -xzf ~/respaldos/uploads_FECHA.tar.gz -C /var/www/muni/anam-pg2-back
pm2 restart all
```

---

## 12. Verificación final

- [ ] `https://TU_DOMINIO` abre el sitio con candado (HTTPS).
- [ ] `https://www.TU_DOMINIO` redirige a `https://TU_DOMINIO`.
- [ ] `https://api.TU_DOMINIO` muestra `{"mensaje":"API - Sistema Municipal San Pablo Jocopilas"}`.
- [ ] Iniciar sesión en `/admin/login` con el Administrador del paso 7.
- [ ] Recargar la página del panel: la sesión se mantiene.
- [ ] Completar **Institución**, **Alcalde** (con foto) e **Información pública**.
- [ ] Crear un usuario Operativo, asignarle un trámite y entrar con él.
- [ ] Enviar una solicitud de trámite desde el sitio público y subir un documento de más de 1 MB desde el panel.
- [ ] Enviar un mensaje desde Contacto y verlo en el panel.
- [ ] `sudo reboot`, esperar un minuto y confirmar que el sitio volvió a funcionar solo.

---

## 13. Actualizar el sistema en el futuro

Sube con WinSCP los archivos modificados (sin `node_modules`, `.next`, `.env` ni `uploads`) y luego:

```bash
# Si cambió el backend
cd /var/www/muni/anam-pg2-back && npm ci --omit=dev && pm2 restart muni-api

# Si cambió el frontend
cd /var/www/muni/pagina-anam-pg && npm ci && npm run build && pm2 restart muni-web
```

Si el cambio trae un script SQL nuevo, ejecútalo antes de reiniciar (`sudo mysql < archivo.sql`) y haz un respaldo primero.

---

## 14. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "502 Bad Gateway" | El backend o el frontend no está corriendo | `pm2 status` y `pm2 logs` para ver el error |
| Inicias sesión pero te regresa al login | `FRONTEND_ORIGIN` no coincide exactamente con el dominio, o no hay HTTPS todavía | Revisa el `.env` (con `https://`, sin barra final) y que Certbot se haya ejecutado; luego `pm2 restart muni-api` |
| El sitio no carga datos (trámites, alcalde) | `NEXT_PUBLIC_API_URL` incorrecto | Corrige `.env.production`, `npm run build` y `pm2 restart muni-web` |
| Subir archivos de más de 1 MB falla | Falta `client_max_body_size` en Nginx | Revisa `/etc/nginx/sites-available/muni` y `sudo systemctl reload nginx` |
| Nadie puede entrar como Administrador | Contraseña olvidada o usuario bloqueado | `cd /var/www/muni/anam-pg2-back && npm run crear-admin` con el mismo usuario |
| `npm run build` se detiene sin explicación | Falta de memoria | Verifica que el swap del paso 3 esté activo: `free -h` |
| Las fechas aparecen con horas de diferencia | Zona horaria del servidor | `sudo timedatectl set-timezone America/Guatemala` y `sudo systemctl restart mysql` |

Para ver los logs en vivo: `pm2 logs`. Para ver solo el backend: `pm2 logs muni-api`.
