#!/bin/bash
# Vercel Environment Variable Setup Script
# Usage: bash scripts/setup-vercel-env.sh YOUR_VERCEL_TOKEN
#
# Get Vercel token at: https://vercel.com/account/tokens
# Replace placeholders below with your actual values before running.

TOKEN=$1
PROJECT_ID="prj_IO6CjVxyiyCsLirMwrGCvBqf4DUk"

if [ -z "$TOKEN" ]; then
  echo "Usage: bash scripts/setup-vercel-env.sh YOUR_VERCEL_TOKEN"
  exit 1
fi

set_env() {
  local key=$1
  local value=$2
  echo "Setting $key..."
  curl -s -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$key\",\"value\":\"$value\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✓' if d.get('key') else '  ✗ ' + str(d.get('error','?')))" 2>/dev/null
}

# ── Fill in your values below ──────────────────────────────────────────────
set_env "APP_PASSWORD"                 "REPLACE_WITH_YOUR_PASSWORD"
set_env "APP_PASSWORD_HASH"            "REPLACE_WITH_YOUR_PASSWORD"
set_env "NEXT_PUBLIC_SUPABASE_URL"     "https://YOUR_PROJECT_REF.supabase.co"
set_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "REPLACE_WITH_ANON_KEY"
set_env "SUPABASE_SERVICE_ROLE_KEY"    "REPLACE_WITH_SERVICE_ROLE_KEY"
set_env "DATABASE_URL"                 "postgresql://postgres:PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"
set_env "GOOGLE_AI_API_KEY"            "REPLACE_WITH_GOOGLE_AI_KEY"
set_env "NEXT_PUBLIC_APP_URL"          "https://YOUR_VERCEL_DOMAIN.vercel.app"

echo "Done!"
