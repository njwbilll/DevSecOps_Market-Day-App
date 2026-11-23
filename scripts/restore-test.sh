#!/usr/bin/env bash
# Uji pemulihan: pulihkan backup terbaru ke database sementara, hitung isinya, lalu hapus.
# Tidak menyentuh database produksi.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/market-day}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_DIR/backups}"
CONTAINER="${CONTAINER:-md_postgres}"

# shellcheck disable=SC2012
latest="$(ls -1t "$BACKUP_DIR"/marketday-*.dump 2>/dev/null | head -n 1 || true)"
[ -n "$latest" ] || { echo "Tidak ada backup di $BACKUP_DIR"; exit 1; }
echo "Memulihkan: $latest"

docker exec "$CONTAINER" sh -c 'dropdb -U "$POSTGRES_USER" --if-exists restore_test && createdb -U "$POSTGRES_USER" restore_test'
docker exec -i "$CONTAINER" sh -c 'pg_restore -U "$POSTGRES_USER" -d restore_test --no-owner' < "$latest"

echo "Jumlah baris hasil pemulihan:"
docker exec -i "$CONTAINER" sh -c 'psql -U "$POSTGRES_USER" -d restore_test -At -F " : "' <<'SQL'
SELECT 'User', count(*) FROM "User";
SELECT 'Wallet', count(*) FROM "Wallet";
SELECT 'Transaction', count(*) FROM "Transaction";
SELECT 'WebhookLog', count(*) FROM "WebhookLog";
SELECT 'AdminLog', count(*) FROM "AdminLog";
SQL

docker exec "$CONTAINER" sh -c 'dropdb -U "$POSTGRES_USER" restore_test'
echo "Uji pemulihan selesai"
