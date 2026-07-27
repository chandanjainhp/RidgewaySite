#!/usr/bin/env bash

# Reusable HTTP client with retries, exponential backoff, timeout, and error formatting
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/utils.sh"

# Default failure exit code (1 = general infrastructure / other)
HTTP_EXIT_CODE="${HTTP_EXIT_CODE:-1}"
HTTP_NO_EXIT="${HTTP_NO_EXIT:-false}"

# Temporary files to store response and headers
HTTP_RESPONSE_FILE=$(mktemp "/tmp/sentinel_http_resp.XXXXXX")
HTTP_HEADERS_FILE=$(mktemp "/tmp/sentinel_http_head.XXXXXX")

# Cleanup temporary files on exit
cleanup_http_temp() {
    rm -f "$HTTP_RESPONSE_FILE" "$HTTP_HEADERS_FILE"
}
trap cleanup_http_temp EXIT

# Format and display API errors detailed with HTTP Request, Response, Status, Stack Trace, and Suggested Fix
handle_api_error() {
    local method="$1"
    local url="$2"
    local body="$3"
    local status="$4"
    local detail="$5"
    
    error "HTTP Request Failed!"
    echo "========================================================================" >&2
    echo -e "${BOLD}HTTP REQUEST:${RESET}" >&2
    echo "  Method: $method" >&2
    echo "  URL:    $url" >&2
    if [[ -n "$body" ]]; then
        echo "  Body:   $body" >&2
    fi
    echo "========================================================================" >&2
    echo -e "${BOLD}STATUS CODE:${RESET} $status" >&2
    echo "========================================================================" >&2
    
    local resp_content=""
    if [[ -f "$HTTP_RESPONSE_FILE" ]]; then
        resp_content=$(cat "$HTTP_RESPONSE_FILE")
    fi
    
    echo -e "${BOLD}RESPONSE BODY:${RESET}" >&2
    if [[ -n "$resp_content" ]]; then
        if jq . <<<"$resp_content" >/dev/null 2>&1; then
            jq . <<<"$resp_content" >&2
        else
            echo "$resp_content" >&2
        fi
    else
        echo "(empty response)" >&2
    fi
    
    if [[ -n "$detail" ]]; then
        echo "========================================================================" >&2
        echo -e "${BOLD}ERROR DETAIL:${RESET} $detail" >&2
    fi
    
    # Try to extract stack trace if response is JSON
    local stack=""
    if [[ -n "$resp_content" ]] && jq . <<<"$resp_content" >/dev/null 2>&1; then
        stack=$(jq -r '.stack // .error.stack // empty' <<<"$resp_content" 2>/dev/null)
    fi
    
    if [[ -n "$stack" ]]; then
        echo "========================================================================" >&2
        echo -e "${BOLD}STACK TRACE:${RESET}" >&2
        echo "$stack" >&2
    fi
    
    echo "========================================================================" >&2
    echo -e "${BOLD}SUGGESTED FIX:${RESET}" >&2
    suggest_fix "$url" "$status" "$resp_content" >&2
    echo "========================================================================" >&2
    
    if [[ "$HTTP_NO_EXIT" == "true" ]]; then
        return 1
    else
        exit "$HTTP_EXIT_CODE"
    fi
}

# Perform HTTP request
# Usage: make_request <METHOD> <PATH> [BODY_JSON] [MAX_RETRIES]
make_request() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    local max_retries="${4:-3}"
    
    local url="${API_BASE}${path}"
    local attempt=0
    local delay=1
    local status_code="000"
    
    # Ensure temporary files are empty before starting
    true > "$HTTP_RESPONSE_FILE"
    true > "$HTTP_HEADERS_FILE"

    while (( attempt <= max_retries )); do
        (( attempt++ ))
        
        local curl_opts=(
            -s
            -X "$method"
            -w "%{http_code}"
            -o "$HTTP_RESPONSE_FILE"
            -H "Content-Type: application/json"
            --max-time 15
        )
        
        if [[ -n "${TOKEN:-}" ]]; then
            curl_opts+=(-H "Authorization: Bearer $TOKEN")
        fi
        
        if [[ -n "$body" ]]; then
            curl_opts+=(-d "$body")
        fi
        
        # Execute curl and capture status
        status_code=$(curl "${curl_opts[@]}" "$url" 2>/dev/null || echo "000")
        
        # If success (2xx), validate JSON (if content exists)
        if [[ "$status_code" =~ ^2[0-9][0-9]$ ]]; then
            if [[ -s "$HTTP_RESPONSE_FILE" ]]; then
                if jq . "$HTTP_RESPONSE_FILE" >/dev/null 2>&1; then
                    cat "$HTTP_RESPONSE_FILE"
                    return 0
                else
                    # Retrying if it is not valid JSON (could be a gateway error / half-written response)
                    if (( attempt > max_retries )); then
                        handle_api_error "$method" "$url" "$body" "$status_code" "Response is not valid JSON"
                        return 1
                    fi
                fi
            else
                echo "{}"
                return 0
            fi
        fi
        
        # If 4xx (except 408/429), fail immediately without retrying
        if [[ "$status_code" =~ ^4[0-9][0-9]$ ]] && [[ "$status_code" != "408" && "$status_code" != "429" ]]; then
            handle_api_error "$method" "$url" "$body" "$status_code" "Client error"
            return 1
        fi
        
        # Wait and backoff
        if (( attempt <= max_retries )); then
            warn "API Request failed ($status_code) at $path. Retrying in ${delay}s (Attempt $attempt/$max_retries)..."
            sleep "$delay"
            delay=$((delay * 2))
        fi
    done
    
    handle_api_error "$method" "$url" "$body" "$status_code" "Max retries reached"
    return 1
}

# HTTP GET helper
http_get() {
    local path="$1"
    make_request "GET" "$path"
}

# HTTP POST helper
http_post() {
    local path="$1"
    local body="${2:-}"
    make_request "POST" "$path" "$body"
}
