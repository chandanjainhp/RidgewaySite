#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# run-investigation.sh
# Full agentic loop smoke test:
#   1. Login  →  2. Seed events  →  3. Trigger Argus  →  4. Poll  →  5. Report
#
# Usage:
#   chmod +x run-investigation.sh
#   ./run-investigation.sh [--count N] [--date YYYY-MM-DD] [--cleanup]
#
# Defaults:
#   --count  8               events to seed
#   --date   today           nightDate (YYYY-MM-DD)
#   --cleanup                delete test data after report prints
#
# Required env vars (or set at top of this file):
#   API_EMAIL      login email
#   API_PASSWORD   login password
#   API_BASE       server base URL (default: http://localhost:8000/api/v1)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── config ────────────────────────────────────────────────────────────────────
API_BASE="${API_BASE:-http://localhost:8000/api/v1}"
API_EMAIL="${API_EMAIL:-iamchandanjainhp@gmail.com}"
API_PASSWORD="${API_PASSWORD:-dfdf#!21243eweE@1}"
COUNT=8
NIGHT_DATE="$(date +%Y-%m-%d)"
DO_CLEANUP=false
POLL_INTERVAL=5   # seconds between status polls
MAX_POLLS=72      # 72 × 5s = 6 minutes max wait

# ── arg parse ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --count)   COUNT="$2";      shift 2 ;;
    --date)    NIGHT_DATE="$2"; shift 2 ;;
    --cleanup) DO_CLEANUP=true; shift   ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── helpers ───────────────────────────────────────────────────────────────────
BOLD="\033[1m"
DIM="\033[2m"
RED="\033[31m"
GRN="\033[32m"
YLW="\033[33m"
BLU="\033[34m"
RST="\033[0m"

banner() { echo -e "\n${BOLD}${BLU}▶ $1${RST}"; }
ok()     { echo -e "  ${GRN}✓${RST} $1"; }
warn()   { echo -e "  ${YLW}⚠${RST} $1"; }
fail()   { echo -e "  ${RED}✗${RST} $1"; }
dim()    { echo -e "  ${DIM}$1${RST}"; }

# jq fallback — use python if jq not installed
jq_cmd() {
  if command -v jq &>/dev/null; then
    jq -r "$1" <<< "$2"
  else
    python3 -c "import sys,json; d=json.loads(sys.argv[1]); print($1)" "$2" 2>/dev/null || echo ""
  fi
}

extract() {
  # extract a dot-path from JSON using jq or python
  local path="$1" json="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "$path" 2>/dev/null || echo ""
  else
    python3 - "$json" "$path" <<'PY'
import sys, json
try:
    d = json.loads(sys.argv[1])
    keys = sys.argv[2].lstrip('.').split('.')
    for k in keys:
        d = d[k] if isinstance(d, dict) else d[int(k)]
    print(d if d is not None else "")
except Exception:
    print("")
PY
  fi
}

post() {
  local path="$1" body="$2"
  curl -s -X POST "${API_BASE}${path}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$body"
}

get() {
  local path="$1"
  curl -s -X GET "${API_BASE}${path}" \
    -H "Authorization: Bearer ${TOKEN}"
}

# ── step 0: preflight ─────────────────────────────────────────────────────────
banner "Preflight"
if ! curl -sf "${API_BASE}/health" >/dev/null 2>&1; then
  fail "Server not reachable at ${API_BASE}  (is 'bun run dev' running?)"
  exit 1
fi
ok "Server reachable: ${API_BASE}"
dim "night date : ${NIGHT_DATE}"
dim "event count: ${COUNT}"

# ── step 1: login ─────────────────────────────────────────────────────────────
banner "Login"
LOGIN_RESP=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${API_EMAIL}\",\"password\":\"${API_PASSWORD}\"}")

TOKEN=$(extract '.data.accessToken' "$LOGIN_RESP")
ROLE=$(extract '.data.user.role' "$LOGIN_RESP")

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  fail "Login failed:"
  echo "$LOGIN_RESP" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESP"
  exit 1
fi

ok "Logged in as ${API_EMAIL}"
dim "role: ${ROLE}"
dim "token: ${TOKEN:0:40}…"

# ── step 2: seed events ───────────────────────────────────────────────────────
banner "Seeding ${COUNT} events for ${NIGHT_DATE}"
SEED_RESP=$(post "/test/seed-events" "{\"count\":${COUNT},\"nightDate\":\"${NIGHT_DATE}\"}")
SEED_MSG=$(extract '.data.message' "$SEED_RESP")
SEED_COUNT=$(extract '.data.count' "$SEED_RESP")

if [[ -z "$SEED_COUNT" || "$SEED_COUNT" == "null" ]]; then
  fail "Seed failed:"
  echo "$SEED_RESP" | python3 -m json.tool 2>/dev/null || echo "$SEED_RESP"
  exit 1
fi

ok "${SEED_MSG}"

# Show event summary table
if command -v jq &>/dev/null; then
  echo ""
  echo "$SEED_RESP" | jq -r '
    .data.events[] |
    "    \(.severity | ascii_upcase | .[0:8]) \(.type | .[0:20]) @ \(.location)"
  ' 2>/dev/null | head -20
fi

# ── step 3: trigger investigation ─────────────────────────────────────────────
banner "Triggering Argus investigation"
TRIG_RESP=$(post "/test/trigger-investigation" "{\"nightDate\":\"${NIGHT_DATE}\"}")
TRIG_STATUS=$(extract '.data.status' "$TRIG_RESP")
JOB_ID=$(extract '.data.jobId' "$TRIG_RESP")
JOB_IDS=$(extract '.data.jobIds' "$TRIG_RESP")
TOTAL_JOBS=$(extract '.data.totalJobs' "$TRIG_RESP")

if [[ "$TRIG_STATUS" == "no_incidents" ]]; then
  fail "No incidents to investigate (events not yet correlated into incidents)."
  warn "Wait a few seconds for the event-correlation worker, then re-run."
  exit 1
fi

if [[ "$TRIG_STATUS" == "already_running" ]]; then
  warn "Investigation already running  (jobIds: ${JOB_IDS})"
  # re-use first job ID for polling
  JOB_ID=$(echo "$JOB_IDS" | tr -d '[]"' | cut -d',' -f1 | tr -d ' ')
elif [[ -z "$JOB_ID" || "$JOB_ID" == "null" ]]; then
  fail "Trigger failed:"
  echo "$TRIG_RESP" | python3 -m json.tool 2>/dev/null || echo "$TRIG_RESP"
  exit 1
else
  ok "Investigation queued — ${TOTAL_JOBS} job(s)"
  dim "first jobId: ${JOB_ID}"
  dim "SSE stream : ${API_BASE}/investigations/${JOB_ID}/stream"
fi

# ── step 4: poll status ────────────────────────────────────────────────────────
banner "Polling Argus (every ${POLL_INTERVAL}s, up to $((MAX_POLLS * POLL_INTERVAL))s)"
POLLS=0
FINAL_STATUS=""

while [[ $POLLS -lt $MAX_POLLS ]]; do
  POLLS=$((POLLS + 1))
  STATUS_RESP=$(get "/test/investigation-status/${JOB_ID}")
  STATUS=$(extract '.data.status' "$STATUS_RESP")
  TOOL_CALLS=$(extract '.data.progress.toolCallsExecuted' "$STATUS_RESP")
  BRIEFING_STATUS=$(extract '.data.briefingStatus' "$STATUS_RESP")

  printf "\r  [%02d/%02d] status=%-18s tools=%-4s briefing=%-16s" \
    "$POLLS" "$MAX_POLLS" "$STATUS" "${TOOL_CALLS:-0}" "${BRIEFING_STATUS:-not_started}"

  if [[ "$STATUS" == "complete" || "$BRIEFING_STATUS" == "draft" || "$BRIEFING_STATUS" == "pending_review" ]]; then
    FINAL_STATUS="complete"
    echo ""
    ok "Investigation complete (${TOOL_CALLS} tool calls)"
    break
  fi

  if [[ "$STATUS" == "failed" ]]; then
    echo ""
    fail "Investigation failed — check server logs"
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done

if [[ "$FINAL_STATUS" != "complete" ]]; then
  echo ""
  warn "Timed out after $((MAX_POLLS * POLL_INTERVAL))s — Argus still running"
  warn "Check: curl -H \"Authorization: Bearer \$TOKEN\" ${API_BASE}/test/investigation-status/${JOB_ID}"
  exit 1
fi

# ── step 5: fetch and print briefing ─────────────────────────────────────────
banner "Fetching briefing"
BRF_RESP=$(get "/test/briefing")
BRF_STATUS=$(extract '.data.briefing.status' "$BRF_RESP")
BRF_ID=$(extract '.data.briefing.briefingId' "$BRF_RESP")
BRF_DATE=$(extract '.data.briefing.nightDate' "$BRF_RESP")

if [[ -z "$BRF_STATUS" || "$BRF_STATUS" == "null" ]]; then
  fail "No briefing found"
  echo "$BRF_RESP" | python3 -m json.tool 2>/dev/null || echo "$BRF_RESP"
  exit 1
fi

ok "Briefing fetched"
dim "id:     ${BRF_ID}"
dim "date:   ${BRF_DATE}"
dim "status: ${BRF_STATUS}"

# ── print full report ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
echo -e "${BOLD}  SENTINEL OVERNIGHT BRIEFING  //  ${NIGHT_DATE}${RST}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"

print_section() {
  local label="$1" key="$2"
  if command -v jq &>/dev/null; then
    local content
    content=$(echo "$BRF_RESP" | jq -r ".data.briefing.sections.${key}.agentDraft // \"(no content)\"" 2>/dev/null)
    if [[ -n "$content" && "$content" != "null" && "$content" != "(no content)" ]]; then
      echo ""
      echo -e "${BOLD}${YLW}[ ${label} ]${RST}"
      # If it's a string, print directly; if object/array, pretty-print
      if echo "$content" | python3 -c "import sys,json; d=json.load(sys.stdin); print('obj')" 2>/dev/null | grep -q obj; then
        echo "$content" | python3 -m json.tool 2>/dev/null || echo "$content"
      else
        echo "$content"
      fi
    fi
  fi
}

print_section "EXECUTIVE SUMMARY"   "executive_summary"
print_section "INCIDENTS"           "incidents"
print_section "RECOMMENDATIONS"     "recommendations"
print_section "ANOMALIES"           "anomalies"
print_section "FOLLOW-UP ACTIONS"   "follow_up"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
echo -e "  Review in browser: ${BLU}http://localhost:3000/briefing${RST}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"

# ── optional cleanup ──────────────────────────────────────────────────────────
if [[ "$DO_CLEANUP" == "true" ]]; then
  banner "Cleanup"
  CLEAN_RESP=$(post "/test/cleanup" "{\"nightDate\":\"${NIGHT_DATE}\"}")
  CLEAN_MSG=$(extract '.data.message' "$CLEAN_RESP")
  ok "${CLEAN_MSG}"
  if command -v jq &>/dev/null; then
    echo "$CLEAN_RESP" | jq '.data.deleted' 2>/dev/null
  fi
fi

echo ""
ok "Done."
