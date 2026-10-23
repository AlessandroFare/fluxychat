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

# Audit F-94: score/grade come from the scanned repo's audit.json. Writing them
# raw into $GITHUB_OUTPUT let a crafted value (newline + "key=value") inject
# extra step outputs. Validate the shapes instead of trusting the JSON.
if [[ ! "$SCORE" =~ ^[0-9]+$ ]]; then SCORE=0; fi
if [[ ! "$GRADE" =~ ^[A-Fa-f][+-]?$ ]]; then GRADE="F"; fi
if [[ ! "$CRITICAL" =~ ^[0-9]+$ ]]; then CRITICAL=0; fi
if [[ ! "$HIGH" =~ ^[0-9]+$ ]]; then HIGH=0; fi

{
  echo "score=$SCORE"
  echo "grade=$GRADE"
  echo "critical=$CRITICAL"
  echo "high=$HIGH"
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT not set}"
