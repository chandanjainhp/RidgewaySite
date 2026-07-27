#!/usr/bin/env bash

# Test suite for HTTP client (retries, backoff, errors)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/lib/colors.sh"

# Mock globals and dependencies
export API_BASE="http://mock-api/v1"
export TOKEN="mock-token"
export HTTP_NO_EXIT="true" # Prevent exiting during tests

# Use a temporary file to keep track of curl calls across subshells
CURL_CALLS_FILE=$(mktemp "/tmp/sentinel_mock_curl_calls.XXXXXX")
echo "0" > "$CURL_CALLS_FILE"

cleanup_test_http() {
    rm -f "$CURL_CALLS_FILE"
}
trap cleanup_test_http EXIT

# Mock curl command
curl() {
    # Parse arguments to find output file (-o)
    local output_file=""
    local args=("$@")
    for ((i=0; i<${#args[@]}; i++)); do
        if [[ "${args[i]}" == "-o" ]]; then
            output_file="${args[i+1]}"
            break
        fi
    done
    
    # Read and increment calls counter from file
    local calls
    calls=$(cat "$CURL_CALLS_FILE")
    calls=$(( calls + 1 ))
    echo "$calls" > "$CURL_CALLS_FILE"
    
    # Check target URL
    local target_url="${args[-1]}"
    
    if [[ "$target_url" == *"transient"* ]]; then
        if (( calls < 2 )); then
            echo "Transient Error" > "$output_file"
            echo "500"
        else
            echo '{"status":"ok"}' > "$output_file"
            echo "200"
        fi
    elif [[ "$target_url" == *"client-error"* ]]; then
        echo '{"error":"Bad Request"}' > "$output_file"
        echo "400"
    else
        # Permanent 500
        echo "Permanent Server Error" > "$output_file"
        echo "500"
    fi
}

# Export mock curl so http.sh uses it
export -f curl

# Source HTTP client AFTER exporting mock curl
# shellcheck disable=SC1091
source "$ROOT/lib/http.sh"

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

echo "=== Running HTTP Client Tests ==="

# 1. Test transient error (retry succeeds)
echo "0" > "$CURL_CALLS_FILE"
response=$(make_request "GET" "/transient" "" 2)
assert_equals '{"status":"ok"}' "$response" "HTTP Client transient retry success"
assert_equals 2 "$(cat "$CURL_CALLS_FILE")" "HTTP Client retried exactly once"

# 2. Test immediate client error (no retries)
echo "0" > "$CURL_CALLS_FILE"
set +e
make_request "POST" "/client-error" '{"val":1}' 2
exit_val=$?
set -e
assert_equals 1 "$exit_val" "HTTP Client failed on 400 Client Error"
assert_equals 1 "$(cat "$CURL_CALLS_FILE")" "HTTP Client did not retry on 400"

# 3. Test permanent server error (exhausts retries)
echo "0" > "$CURL_CALLS_FILE"
set +e
make_request "GET" "/permanent" "" 2
exit_val=$?
set -e
assert_equals 1 "$exit_val" "HTTP Client failed on permanent 500"
assert_equals 3 "$(cat "$CURL_CALLS_FILE")" "HTTP Client retried max times (1 initial + 2 retries)"

# Summary
echo "--------------------------------"
if (( TESTS_FAILED == 0 )); then
    echo -e "${GREEN}All $TESTS_RUN HTTP tests passed.${RESET}"
    exit 0
else
    echo -e "${RED}$TESTS_FAILED of $TESTS_RUN HTTP tests failed.${RESET}"
    exit 1
fi
