#!/usr/bin/env bash
# scripts/backup_db.sh - Dump running MySQL database to ./backups/
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
OUT="$(cd "$(dirname "$0")/.." && pwd)/backups/attendance_${TS}.sql.gz"
mkdir -p "$(dirname "$OUT")"
echo "[backup] writing $OUT"
docker exec attendance_db mysqldump -u "${MYSQL_USER:-attendance_user}" -p"${MYSQL_PASSWORD:-ChangeMe_MySQL_2024!_mY8s}" "${MYSQL_DATABASE:-attendance_db}" | gzip > "$OUT"
echo "[backup] done ($OUT)"
