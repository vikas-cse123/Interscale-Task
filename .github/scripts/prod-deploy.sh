#!/usr/bin/env bash
#
# prod-deploy.sh — selective production deploy for Worklenz (EC2 side).
#
# Invoked by .github/workflows/deploy-production.yaml AFTER CI gates passed.
# It only ever touches the services named in --services (frontend | backend |
# client-portal). It NEVER:
#   - runs database migrations or touches production data,
#   - writes to production .env files (checksummed before/after as proof),
#   - edits docker-compose.yml / nginx configuration,
#   - rebuilds, pulls, prunes, or upgrades any other service/container/image.
#
# On health-check failure it restores the pre-deploy image tag captured at the
# start of the run (only when such a backup exists) and reports clearly.
#
# Usage:
#   prod-deploy.sh --dir ~/worklenz --services "frontend backend"
#                  --sha <full-commit-sha>
#                  --frontend-image worklenz-frontend:3.2.0-clientportal
#                  --backend-image worklenz-backend:3.2.0-tzfix-digestfix1
#                  --client-portal-image worklenz-client-portal:3.2.0-local
#                  --incoming ~/prod-deploy-incoming
#                  [--dry-run]
set -euo pipefail

DIR=""
SERVICES=""
SHA=""
FRONTEND_IMAGE=""
BACKEND_IMAGE=""
CLIENT_PORTAL_IMAGE=""
INCOMING=""
DRY_RUN=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --services) SERVICES="$2"; shift 2 ;;
    --sha) SHA="$2"; shift 2 ;;
    --frontend-image) FRONTEND_IMAGE="$2"; shift 2 ;;
    --backend-image) BACKEND_IMAGE="$2"; shift 2 ;;
    --client-portal-image) CLIENT_PORTAL_IMAGE="$2"; shift 2 ;;
    --incoming) INCOMING="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -n "$DIR" ] || { echo "ERROR: --dir is required" >&2; exit 2; }
[ -n "$SERVICES" ] || { echo "ERROR: --services is required" >&2; exit 2; }
[ -n "$SHA" ] || { echo "ERROR: --sha is required" >&2; exit 2; }
# Expand a leading ~ (callers pass --dir '~/worklenz' quoted, which the shell
# would otherwise leave unexpanded inside the quoted test below).
DIR="${DIR/#\~/$HOME}"
INCOMING="${INCOMING/#\~/$HOME}"
[ -d "$DIR" ] || { echo "ERROR: compose dir not found: $DIR" >&2; exit 2; }
[ -f "$DIR/docker-compose.yml" ] || { echo "ERROR: no docker-compose.yml in $DIR" >&2; exit 2; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found" >&2; exit 2; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose plugin not found" >&2; exit 2; }

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$HOME/prod-backups/ci"
mkdir -p "$BACKUP_ROOT"
COMPOSE_BACKUP="$BACKUP_ROOT/docker-compose.yml.$TS"

image_for() {
  case "$1" in
    frontend) echo "$FRONTEND_IMAGE" ;;
    backend) echo "$BACKEND_IMAGE" ;;
    client-portal) echo "$CLIENT_PORTAL_IMAGE" ;;
    *) echo "ERROR: unknown service: $1" >&2; exit 2 ;;
  esac
}

container_for() {
  case "$1" in
    frontend) echo "worklenz_frontend" ;;
    backend) echo "worklenz_backend" ;;
    client-portal) echo "worklenz_client_portal" ;;
  esac
}

check_container_running() {
  local container="$1"
  local state
  state="$(docker inspect -f '{{.State.Status}} {{.State.Restarting}}' "$container" 2>/dev/null || echo MISSING)"
  [ "$state" = "running false" ]
}

# Service-specific readiness probe. Prints body/code for diagnostics.
check_service_ready() {
  local svc="$1"
  case "$svc" in
    frontend)
      [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:5000/)" = "200" ]
      ;;
    backend)
      curl -s --max-time 15 http://127.0.0.1:3000/public/health | grep -q '"status":"ok"'
      ;;
    client-portal)
      [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:5174/)" = "200" ]
      ;;
  esac
}

wait_healthy() {
  local svc="$1"
  local container
  container="$(container_for "$svc")"
  for _ in $(seq 1 24); do
    if check_container_running "$container" && check_service_ready "$svc"; then
      echo "OK: $svc healthy (container $container)"
      return 0
    fi
    sleep 5
  done
  echo "FAIL: $svc did not become healthy within ~120s" >&2
  return 1
}

rollback_service() {
  local svc="$1" backup_ref="$2" stable="$3"
  if [ -z "$backup_ref" ]; then
    echo "ROLLBACK-SKIPPED: no pre-deploy backup captured for $svc; manual intervention required." >&2
    return 1
  fi
  echo "Rolling back $svc to $backup_ref ..."
  docker tag "$backup_ref" "$stable"
  (cd "$DIR" && docker compose up -d --no-deps "$svc")
  sleep 8
  if wait_healthy "$svc"; then
    echo "ROLLED-BACK: $svc restored to pre-deploy image."
    return 0
  fi
  echo "ROLLBACK-FAILED: $svc still unhealthy after restore - manual intervention required." >&2
  return 1
}

echo "=== Worklenz production deploy ==="
echo "dir=$DIR services=[$SERVICES] sha=$SHA dry_run=$DRY_RUN"

# Prove .env files are never modified by this script: checksum before/after.
ENV_BEFORE=""
if [ -f "$DIR/.env" ]; then
  ENV_BEFORE="$(sha256sum "$DIR/.env" | awk '{print $1}')"
fi

cp "$DIR/docker-compose.yml" "$COMPOSE_BACKUP"
echo "Compose backup: $COMPOSE_BACKUP"

# ---- Dry run: validate only, change nothing ----
if [ "$DRY_RUN" = true ]; then
  echo "--- DRY RUN: validating only ---"
  ls -la "$INCOMING"/*.tar.gz
  for f in "$INCOMING"/*.tar.gz; do gzip -t "$f" && echo "tarball OK: $f"; done
  for svc in $SERVICES; do
    stable="$(image_for "$svc")"
    echo "Service $svc -> stable tag $stable"
    docker image inspect "$stable" --format "current: {{.Id}} ({{.Created}})" 2>/dev/null || echo "current: image $stable NOT PRESENT locally"
    (cd "$DIR" && docker compose ps "$svc")
  done
  echo "DRY RUN COMPLETE: no images loaded, no containers recreated."
  exit 0
fi

[ -n "$INCOMING" ] || { echo "ERROR: --incoming is required (unless --dry-run)" >&2; exit 2; }
ls "$INCOMING"/*.tar.gz >/dev/null 2>&1 || { echo "ERROR: no image tarballs in $INCOMING" >&2; exit 2; }

# Preserve running images BEFORE docker load can move the stable tags.
declare -A ROLLBACK_REFS
for svc in $SERVICES; do
  stable="$(image_for "$svc")"
  container="$(container_for "$svc")"
  running_image="$(docker inspect -f '{{.Image}}' "$container")"
  docker image inspect "$running_image" >/dev/null
  repo="${stable%%:*}"
  backup_ref="$repo:ci-backup-$TS"
  docker tag "$running_image" "$backup_ref"
  ROLLBACK_REFS["$svc"]="$backup_ref"
  echo "Backup: running $svc image $running_image -> $backup_ref"
done

# Load CI-built images once up front (each carries its stable tag).
# Services are still recreated one by one below, so an image for service B
# sitting loaded while service A deploys changes nothing until A is recreated.
for tar in "$INCOMING"/*.tar.gz; do
  echo "Loading $tar ..."
  docker load -i "$tar"
done

FAILED=""
for svc in $SERVICES; do
  stable="$(image_for "$svc")"
  [ -n "$stable" ] || { echo "ERROR: no stable image tag configured for $svc" >&2; FAILED="$FAILED $svc"; continue; }

  # 1. Use the pre-load snapshot of the actually running image.
  BACKUP_REF="${ROLLBACK_REFS[$svc]}"

  # 2. Recreate ONLY this service (dependencies are only health-checked, never recreated).
  echo "Recreating service: $svc"
  (cd "$DIR" && docker compose up -d --no-deps "$svc")

  # 3. Verify health; roll back only when a backup was preserved.
  if wait_healthy "$svc"; then
    echo "DEPLOYED: $svc now runs $(docker image inspect -f '{{.Id}}' "$stable")"
  else
    echo "ERROR: health check failed for $svc" >&2
    if ! rollback_service "$svc" "$BACKUP_REF" "$stable"; then
      FAILED="$FAILED $svc(rollback-unsafe-or-failed)"
    else
      FAILED="$FAILED $svc(rolled-back)"
    fi
  fi
done

# 4. Final proof that .env was untouched.
if [ -n "$ENV_BEFORE" ]; then
  ENV_AFTER="$(sha256sum "$DIR/.env" | awk '{print $1}')"
  if [ "$ENV_BEFORE" != "$ENV_AFTER" ]; then
    echo "ERROR: production .env checksum changed during deploy - investigate immediately." >&2
    FAILED="$FAILED env-changed"
  else
    echo "Verified: production .env untouched ($ENV_BEFORE)"
  fi
fi

# 5. Record provenance (source of truth for what is deployed; git checkout untouched).
{
  echo "sha=$SHA"
  echo "timestamp=$TS"
  echo "services=$SERVICES"
  if [ -z "$FAILED" ]; then echo "result=SUCCESS"; else echo "result=FAILURE:$FAILED"; fi
} > "$DIR/.ci-deploy-state"
echo "Deploy state recorded in $DIR/.ci-deploy-state"

if [ -n "$FAILED" ]; then
  echo "DEPLOYMENT FAILED for:$FAILED" >&2
  exit 1
fi
echo "=== Deployment successful: [$SERVICES] @ $SHA ==="
