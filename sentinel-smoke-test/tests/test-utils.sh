#!/usr/bin/env bash

# Test suite for utility functions

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/lib/colors.sh"
source "$ROOT/lib/utils.sh"

TESTS_RUN=0
TESTS_FAILED=0

assert_equals() {
    local expected="$1"
    local actual="$2"
    local name="$3"
    
    TESTS_RUN=$(( TESTS_RUN + 1 ))
    if [[ "$expected" == "$actual" ]]; then
        echo -e "  ${GREEN}✓${RESET} PASS: $name"
    else
        echo -e "  ${RED}✗${RESET} FAIL: $name (Expected '$expected', got '$actual')"
        TESTS_FAILED=$(( TESTS_FAILED + 1 ))
    fi
}

echo "=== Running Utility Tests ==="

# 1. Test json_extract
json_data='{"name":"Sentinel","status":"active","metrics":{"count":10},"items":["first","second"]}'

assert_equals "Sentinel" "$(json_extract ".name" "$json_data")" "json_extract string key"
assert_equals "active" "$(json_extract ".status" "$json_data")" "json_extract key status"
assert_equals "10" "$(json_extract ".metrics.count" "$json_data")" "json_extract nested key"
assert_equals "first" "$(json_extract ".items[0]" "$json_data")" "json_extract array index"
assert_equals "" "$(json_extract ".nonexistent" "$json_data")" "json_extract missing key"

# 2. Test get_today_night_date
today_date=$(date +%Y-%m-%d)
assert_equals "$today_date" "$(get_today_night_date)" "get_today_night_date format"

# 3. Test suggest_fix
assert_equals "The backend server is not running or unreachable. Please run 'bun run dev' or 'bun start' in the server directory, or check your API_BASE URL." \
              "$(suggest_fix "/auth/login" "000" "")" \
              "suggest_fix unreachable status"

assert_equals "Check if API_EMAIL and API_PASSWORD in .env are correct. Make sure the user has been registered/seeded in MongoDB." \
              "$(suggest_fix "/auth/login" "401" "")" \
              "suggest_fix auth login 401"

# Summary
echo "--------------------------------"
if (( TESTS_FAILED == 0 )); then
    echo -e "${GREEN}All $TESTS_RUN utility tests passed.${RESET}"
    exit 0
else
    echo -e "${RED}$TESTS_FAILED of $TESTS_RUN utility tests failed.${RESET}"
    exit 1
fi
