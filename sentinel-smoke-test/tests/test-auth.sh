#!/usr/bin/env bash

# Test suite for Authentication module

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/lib/colors.sh"

# Mock globals
export API_BASE="http://mock-api/v1"
export API_EMAIL="test@example.com"
export API_PASSWORD="password"
export HTTP_NO_EXIT="true"

# Mock curl command at the lowest level to return a valid simulated JWT response
curl() {
    local output_file=""
    local args=("$@")
    for ((i=0; i<${#args[@]}; i++)); do
        if [[ "${args[i]}" == "-o" ]]; then
            output_file="${args[i+1]}"
            break
        fi
    done
    
    # Simulated JWT payload: {"exp": 2147483647, "role": "super_admin", "user": {"username": "test_user"}}
    # Base64 payload is: eyJleHAiOjIxNDc0ODM2NDcsInJvbGUiOiJzdXBlcl9hZG1pbiIsInVzZXIiOnsidXNlcm5hbWUiOiJ0ZXN0X3VzZXIifX0
    local mock_token="header.eyJleHAiOjIxNDc0ODM2NDcsInJvbGUiOiJzdXBlcl9hZG1pbiIsInVzZXIiOnsidXNlcm5hbWUiOiJ0ZXN0X3VzZXIifX0.signature"
    
    echo "{\"success\":true,\"data\":{\"accessToken\":\"$mock_token\",\"user\":{\"username\":\"test_user\",\"role\":\"super_admin\",\"orgId\":\"mock_org_123\"}}}" > "$output_file"
    echo "200"
}
export -f curl

# Source Auth module
# shellcheck disable=SC1091
source "$ROOT/lib/auth.sh"

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

echo "=== Running Authentication Tests ==="

# Execute authentication using mock
authenticate

# Validate expected exports
expected_token="header.eyJleHAiOjIxNDc0ODM2NDcsInJvbGUiOiJzdXBlcl9hZG1pbiIsInVzZXIiOnsidXNlcm5hbWUiOiJ0ZXN0X3VzZXIifX0.signature"
assert_equals "$expected_token" "$TOKEN" "Authentication exports TOKEN"
assert_equals "super_admin" "$AUTH_ROLE" "Authentication exports AUTH_ROLE"
assert_equals "test_user" "$AUTH_USER" "Authentication exports AUTH_USER"

# Summary
echo "--------------------------------"
if (( TESTS_FAILED == 0 )); then
    echo -e "${GREEN}All $TESTS_RUN authentication tests passed.${RESET}"
    exit 0
else
    echo -e "${RED}$TESTS_FAILED of $TESTS_RUN authentication tests failed.${RESET}"
    exit 1
fi
