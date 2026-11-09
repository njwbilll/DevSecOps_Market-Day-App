#!/usr/bin/env bash
# Deploy Market Day di VM. Dipanggil oleh job deploy pada GitHub Actions (runner self-hosted).
# Variabel wajib: IMAGE_TAG (tag image yang lolos pemeriksaan) dan GHCR_OWNER (pemilik repositori, huruf kecil).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/market-day}"
HEALTH_URL="${HEALTH_URL:-https://localhost/api/health}"
HEALTH_TRIES="${HEALTH_TRIES:-30}"
HEALTH_WAIT="${HEALTH_WAIT:-5}"

: "${IMAGE_TAG:?IMAGE_TAG wajib diisi}"
: "${GHCR_OWNER:?GHCR_OWNER wajib diisi}"

cd "$DEPLOY_DIR"
[ -f .env ] || { echo "Berkas .env tidak ditemukan di $DEPLOY_DIR"; exit 1; }
[ -f docker-compose.prod.yml ] || { echo "docker-compose.prod.yml tidak ditemukan di $DEPLOY_DIR"; exit 1; }

COMPOSE=(docker compose -f docker-compose.prod.yml)
PREVIOUS_TAG="$(cat .current_tag 2>/dev/null || true)"

deploy() {
  export IMAGE_TAG="$1" GHCR_OWNER
  "${COMPOSE[@]}" pull nginx backend
  "${COMPOSE[@]}" up -d --no-build --remove-orphans
}

healthy() {
  local i
  for ((i = 1; i <= HEALTH_TRIES; i++)); do
    if curl -ksf --max-time 5 "$HEALTH_URL" >/dev/null; then
      return 0
    fi
    sleep "$HEALTH_WAIT"
  done
  return 1
}

echo "Deploy ${IMAGE_TAG} (sebelumnya: ${PREVIOUS_TAG:-tidak ada})"
deploy "$IMAGE_TAG"

if healthy; then
  echo "$IMAGE_TAG" > .current_tag
  docker image prune -f >/dev/null || true
  echo "Deploy berhasil"
  exit 0
fi

echo "Pemeriksaan kesehatan gagal"
"${COMPOSE[@]}" logs --tail 50 backend || true

if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$IMAGE_TAG" ]; then
  echo "Rollback ke ${PREVIOUS_TAG}"
  deploy "$PREVIOUS_TAG"
  if healthy; then
    echo "Rollback berhasil"
  else
    echo "Rollback juga gagal, periksa VM secara manual"
  fi
fi
exit 1
