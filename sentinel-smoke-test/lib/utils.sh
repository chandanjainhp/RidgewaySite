#!/usr/bin/env bash

# Utility functions for JSON parsing, date formatting, and suggested fixes
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$LIB_DIR/.." && pwd)"

# Extract a value from a JSON string using jq or python3 fallback
# Usage: json_extract <dot_path> <json_string>
json_extract() {
    local path="$1"
    local json="$2"
    
    if [[ -z "$json" || "$json" == "null" ]]; then
        echo ""
        return 0
    fi

    if command -v jq >/dev/null 2>&1; then
        local val
        val=$(echo "$json" | jq -r "$path" 2>/dev/null || echo "")
        if [[ "$val" == "null" ]]; then
            echo ""
        else
            echo "$val"
        fi
    else
        python3 - "$json" "$path" <<'PY'
import sys, json
try:
    d = json.loads(sys.argv[1])
    keys = sys.argv[2].lstrip('.').split('.')
    for k in keys:
        if isinstance(d, dict):
            d = d.get(k)
        elif isinstance(d, list):
            try:
                d = d[int(k)]
            except (ValueError, IndexError):
                d = None
        else:
            d = None
    print(d if d is not None else "")
except Exception:
    print("")
PY
    fi
}

# Return today's night date in YYYY-MM-DD format
get_today_night_date() {
    date +%Y-%m-%d
}

# Provide suggested fixes based on endpoint path, HTTP status, and response content
# Usage: suggest_fix <url> <status> <response_content>
suggest_fix() {
    local url="$1"
    local status="$2"
    local resp="${3:-}"
    
    if [[ "$status" == "000" ]]; then
        echo "The backend server is not running or unreachable. Please run 'bun run dev' or 'bun start' in the server directory, or check your API_BASE URL."
        return 0
    fi
    
    case "$url" in
        */auth/login*)
            if [[ "$status" == "401" || "$status" == "400" ]]; then
                echo "Check if API_EMAIL and API_PASSWORD in .env are correct. Make sure the user has been registered/seeded in MongoDB."
            else
                echo "Ensure the authentication backend service is functional and database connectivity is up."
            fi
            ;;
        */org/me*)
            if [[ "$status" == "403" ]]; then
                echo "The authenticated user may not have the required permissions or membership in this organization."
            else
                echo "Ensure that organizations have been seeded and the user is properly scoped."
            fi
            ;;
        */test/seed-events*)
            echo "Verify that the request payload is valid JSON and count is between 1 and 50. Ensure the organization is seeded in the database."
            ;;
        */test/trigger-investigation*)
            if echo "$resp" | grep -q "no_incidents"; then
                echo "Seed some events first using /test/seed-events. Event correlation needs raw events to form incidents."
            else
                echo "Ensure BullMQ and Redis are running ('docker-compose up redis' or check REDIS_URL in server/.env)."
            fi
            ;;
        */test/investigation-status*)
            echo "Check if the Job ID exists in Redis/BullMQ. Ensure the queue worker is running."
            ;;
        */test/briefing*)
            echo "Ensure that the investigation is completed. Check if the Briefing collection has a record for the current nightDate."
            ;;
        *)
            if [[ "$status" == "404" ]]; then
                echo "Endpoint not found. Ensure you are running in a development environment where test routes are enabled (NODE_ENV !== 'production')."
            elif [[ "$status" == "403" ]]; then
                echo "Verify JWT token validation and ensure proper roles/permissions are assigned to the user."
            else
                echo "Inspect backend server logs for the specific stack trace or uncaught exception."
            fi
            ;;
    esac
}

# Generate a beautiful Markdown report for the smoke test execution
# Usage: generate_markdown_report <SUCCESS|FAILURE> [error_message]
generate_markdown_report() {
    local result_status="$1"
    local error_msg="${2:-}"
    
    local reports_dir="$ROOT_DIR/reports"
    mkdir -p "$reports_dir"
    
    local ts_filename
    ts_filename=$(date +%Y%m%d-%H%M%S)
    local report_file="$reports_dir/smoke-test-$ts_filename.md"
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - ${SCRIPT_START_TIME:-end_time}))
    
    # Query environment mode from server if possible, or fallback to dev
    local server_env="${NODE_ENV:-development}"
    
    # Write report
    {
        echo "# Sentinel Smoke Test Execution Report"
        echo ""
        echo "## Execution Metadata"
        echo ""
        echo "| Parameter | Value |"
        echo "| :--- | :--- |"
        echo "| **Final Result** | **$result_status** |"
        echo "| **Run Timestamp** | $(date -d "@${SCRIPT_START_TIME:-end_time}" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -d "@${SCRIPT_START_TIME:-end_time}" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "N/A") |"
        echo "| **Total Duration** | ${duration}s |"
        echo "| **Environment** | $server_env |"
        echo "| **API Base** | $API_BASE |"
        echo "| **Authenticated User** | ${AUTH_USER:-N/A} (Role: ${AUTH_ROLE:-N/A}) |"
        echo "| **Resolved Organization** | ${ORG_ID:-N/A} |"
        echo ""
        echo "## Workflow Execution Metrics"
        echo ""
        echo "| Stage | Metric | Value |"
        echo "| :--- | :--- | :--- |"
        echo "| **Event Seeding** | Events Seeded | ${SEEDED_EVENTS_COUNT:-0} |"
        echo "| **Incident Correlation** | Incidents Grouped | ${CREATED_INCIDENTS_COUNT:-0} |"
        echo "| **Argus Investigation** | Investigation Duration | ${INVESTIGATION_DURATION:-0}s |"
        echo "| **Argus Investigation** | Tool Calls Executed | ${FINAL_TOOL_CALLS_COUNT:-0} |"
        echo "| **Briefing Generation** | Briefing ID | ${BRIEFING_ID:-N/A} (Status: ${BRIEFING_STATUS:-N/A}) |"
        
        if [[ "$result_status" == "FAILURE" && -n "$error_msg" ]]; then
            echo ""
            echo "## Error Information"
            echo ""
            echo "> [!WARNING]"
            echo "> **Workflow Error Details:**"
            echo "> $error_msg"
        fi
    } > "$report_file"
    
    success "Generated execution report: reports/$(basename "$report_file")"
}
