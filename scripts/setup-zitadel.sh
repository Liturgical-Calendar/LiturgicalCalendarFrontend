#!/bin/bash
# Wrapper that delegates to the canonical setup-zitadel.sh baked into the
# litcal-api Docker image. The authoritative copy lives in the
# LiturgicalCalendarAPI repo (scripts/setup-zitadel.sh) and is COPYed into the
# image at build time. Extracting it here at runtime keeps this Frontend repo
# from carrying a parallel copy that can drift out of sync.
#
# Usage is identical to the upstream script — all arguments are forwarded:
#   ./scripts/setup-zitadel.sh                    # display credentials only
#   ./scripts/setup-zitadel.sh --update-env       # update .env files
#   ./scripts/setup-zitadel.sh --docker-init      # bring stack up + configure
#   ./scripts/setup-zitadel.sh --update-env --docker-init
#   ./scripts/setup-zitadel.sh --force-secrets
#   ./scripts/setup-zitadel.sh --show-secrets

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
API_IMAGE="${API_IMAGE:-litcal-api:latest}"

if ! docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
    echo "API image $API_IMAGE not found locally — building..."
    (cd "$PROJECT_DIR" && docker compose build litcal-api)
fi

# Extract next to this wrapper so the canonical script's BASH_SOURCE[0]-based
# PROJECT_DIR resolution (SCRIPT_DIR/..) still points at this Frontend repo.
EXTRACTED="${SCRIPT_DIR}/.setup-zitadel.canonical.sh"
trap 'rm -f "$EXTRACTED"' EXIT

cid=$(docker create "$API_IMAGE")
trap 'docker rm -v "$cid" >/dev/null 2>&1 || true; rm -f "$EXTRACTED"' EXIT
docker cp "${cid}:/var/www/html/scripts/setup-zitadel.sh" "$EXTRACTED" >/dev/null
docker rm -v "$cid" >/dev/null

# Run (don't exec) so the EXIT trap fires and removes the extracted file. set -e
# propagates a non-zero exit; on success the wrapper falls through and exits 0.
bash "$EXTRACTED" "$@"
