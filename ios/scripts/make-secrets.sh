#!/usr/bin/env bash
# Writes ios/Config/Secrets.xcconfig from env vars (never commit the output).
#   SUPABASE_URL=... SUPABASE_ANON_KEY=... MAPBOX_PUBLIC_TOKEN=... ios/scripts/make-secrets.sh
set -euo pipefail
: "${SUPABASE_URL:?}" "${SUPABASE_ANON_KEY:?}" "${MAPBOX_PUBLIC_TOKEN:?}"
case "$SUPABASE_ANON_KEY" in *service_role*|sb_secret_*) echo "Refusing: that is a secret key" >&2; exit 1;; esac
case "$MAPBOX_PUBLIC_TOKEN" in pk.*) ;; *) echo "Refusing: Mapbox token must be a public pk. token" >&2; exit 1;; esac
out="$(dirname "$0")/../Config/Secrets.xcconfig"
{
  echo "SUPABASE_URL = ${SUPABASE_URL/:\/\//:/\$()/}"
  echo "SUPABASE_ANON_KEY = $SUPABASE_ANON_KEY"
  echo "MAPBOX_PUBLIC_TOKEN = $MAPBOX_PUBLIC_TOKEN"
} > "$out"
echo "Wrote $out"
