#!/usr/bin/env bash
# Close OSSRH staging repos and push deployments to Central Portal (same CI job / IP as Gradle upload).
set -euo pipefail

if [[ -z "${OSSRH_USER:-}" || -z "${OSSRH_PASS:-}" ]]; then
  echo "OSSRH_USER/OSSRH_PASS not set — skip Central Portal upload"
  exit 0
fi

AUTH=$(printf '%s:%s' "$OSSRH_USER" "$OSSRH_PASS" | base64 -w0)
API="https://ossrh-staging-api.central.sonatype.com"
PUBLISHING_TYPE="${SONATYPE_PUBLISHING_TYPE:-user_managed}"

search_json=$(curl -sfS -H "Authorization: Bearer $AUTH" "$API/manual/search/repositories")
open_keys=$(echo "$search_json" | jq -r '.repositories[]? | select(.state == "open") | .key')

if [[ -z "$open_keys" ]]; then
  echo "No open staging repositories — trying namespace default upload"
  http_code=$(curl -sS -o /tmp/sonatype-upload-body.txt -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $AUTH" \
    -H "Content-Type: application/json" \
    "$API/manual/upload/defaultRepository/com.fluxychat?publishing_type=${PUBLISHING_TYPE}")
  if [[ "$http_code" != "200" && "$http_code" != "204" ]]; then
    echo "defaultRepository upload failed HTTP $http_code:"
    cat /tmp/sonatype-upload-body.txt || true
    exit 1
  fi
  echo "Uploaded via defaultRepository (HTTP $http_code)"
  exit 0
fi

while IFS= read -r repo_key; do
  [[ -z "$repo_key" ]] && continue
  encoded_key=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$repo_key")
  echo "Uploading staging repository: $repo_key"
  http_code=$(curl -sS -o /tmp/sonatype-upload-body.txt -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $AUTH" \
    -H "Content-Type: application/json" \
    "$API/manual/upload/repository/${encoded_key}?publishing_type=${PUBLISHING_TYPE}")
  if [[ "$http_code" != "200" && "$http_code" != "204" ]]; then
    echo "upload/repository failed HTTP $http_code for $repo_key:"
    cat /tmp/sonatype-upload-body.txt || true
    exit 1
  fi
  echo "Uploaded $repo_key (HTTP $http_code)"
done <<< "$open_keys"

echo "All open staging repositories uploaded to Central Portal ($PUBLISHING_TYPE)."
