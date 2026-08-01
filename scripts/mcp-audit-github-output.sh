#!/usr/bin/env bash
# Shared jq helpers for mcp-audit CI output (score may be object or number).
set -euo pipefail

audit_json="${1:-audit.json}"

if [[ ! -s "$audit_json" ]] || ! jq empty "$audit_json" 2>/dev/null; then
  echo '{"score":{"numeric":0,"grade":"F"},"findings":[]}' > "$audit_json"
fi

SCORE=$(jq -r '
  if (.score | type) == "object" then (.score.value // .score.numeric // 0)
  elif (.score | type) == "number" then .score
  else 0 end
' "$audit_json")

GRADE=$(jq -r '
  if (.score | type) == "object" then (.score.grade // "F")
  else "F" end
' "$audit_json")

CRITICAL=$(jq '[.findings[]? | select(.severity == "critical" or .severity == "CRITICAL")] | length' "$audit_json")
HIGH=$(jq '[.findings[]? | select(.severity == "high" or .severity == "HIGH")] | length' "$audit_json")

{
  echo "score=$SCORE"
  echo "grade=$GRADE"
  echo "critical=$CRITICAL"
  echo "high=$HIGH"
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT not set}"
