#!/usr/bin/env bash
# Respaldo diario de la base de datos y de los archivos subidos
# (documentos de trámites y foto del alcalde).
#
# Guarda los respaldos en /home/muni/respaldos (así se pueden descargar con
# WinSCP usando el mismo usuario) y borra los de más de 14 días.
# Se programa con cron (ver DESPLIEGUE.md, paso 11).
#
# IMPORTANTE: un respaldo que solo vive en el mismo servidor no sirve si el
# servidor se pierde. Descarga una copia periódicamente a otro lugar.

set -euo pipefail

APP_DIR="/var/www/muni/anam-pg2-back"
DESTINO="/home/muni/respaldos"
DIAS_A_CONSERVAR=14
FECHA="$(date +%Y-%m-%d_%H%M)"

# Lee un valor del .env del backend (sin ejecutar el archivo).
leer_env() {
  grep -E "^$1=" "$APP_DIR/.env" | tail -n 1 | cut -d '=' -f 2- | sed -e 's/^"//' -e 's/"$//'
}

DB_HOST="$(leer_env DB_HOST)"
DB_PORT="$(leer_env DB_PORT)"
DB_USER="$(leer_env DB_USER)"
DB_PASSWORD="$(leer_env DB_PASSWORD)"
DB_NAME="$(leer_env DB_NAME)"

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"

# Base de datos (estructura + datos). --single-transaction evita bloquear
# las tablas mientras la gente sigue usando el sistema.
MYSQL_PWD="$DB_PASSWORD" mysqldump \
  -h "${DB_HOST:-localhost}" -P "${DB_PORT:-3306}" -u "$DB_USER" \
  --single-transaction --routines --triggers --no-tablespaces \
  "$DB_NAME" | gzip > "$DESTINO/bd_$FECHA.sql.gz"

# Archivos subidos
tar -czf "$DESTINO/uploads_$FECHA.tar.gz" -C "$APP_DIR" uploads

# Limpieza de respaldos viejos
find "$DESTINO" -type f -mtime +"$DIAS_A_CONSERVAR" -delete

echo "[$(date '+%F %T')] Respaldo completado: bd_$FECHA.sql.gz y uploads_$FECHA.tar.gz"
