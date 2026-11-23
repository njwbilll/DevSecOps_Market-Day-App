#!/usr/bin/env bash
# Backup database Market Day (format custom pg_dump) dan simpan N backup terakhir.
# Jadwal harian (crontab -e):  0 2 * * * /opt/market-day/backup-db.sh >> /opt/market-day/backups/backup.log 2>&1
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/market-day}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_DIR/backups}"
KEEP="${KEEP:-7}"
CONTAINER="${CONTAINER:-md_postgres}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/marketday-$(date +%Y%m%d-%H%M%S).dump"
trap 'rm -f "$file.tmp"' EXIT

docker exec "$CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file.tmp"
[ -s "$file.tmp" ] || { echo "Backup kosong, dibatalkan"; exit 1; }

# pastikan arsip dapat dibaca sebelum dianggap berhasil
docker exec -i "$CONTAINER" pg_restore -l < "$file.tmp" > /dev/null
mv "$file.tmp" "$file"

# hapus backup lama, sisakan KEEP terbaru
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/marketday-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "$(date -Is) backup selesai: $file ($(du -h "$file" | cut -f1))"
