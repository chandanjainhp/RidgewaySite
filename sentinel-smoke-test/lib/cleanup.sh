#!/usr/bin/env bash

# Cleanup module
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/http.sh"
source "$LIB_DIR/utils.sh"

cleanup_test_data() {
    HTTP_EXIT_CODE=7
    
    local date_str="${NIGHT_DATE:-$(get_today_night_date)}"
    info "Initiating cleanup of test data for night $date_str..."
    
    local payload
    payload=$(printf '{"nightDate":"%s"}' "$date_str")
    
    local response
    response=$(http_post "/test/cleanup" "$payload")
    
    local message
    message=$(json_extract ".message" "$response")
    local deleted_events
    deleted_events=$(json_extract ".data.deleted.events" "$response")
    local deleted_incidents
    deleted_incidents=$(json_extract ".data.deleted.incidents" "$response")
    local deleted_investigations
    deleted_investigations=$(json_extract ".data.deleted.investigations" "$response")
    local deleted_briefings
    deleted_briefings=$(json_extract ".data.deleted.briefings" "$response")
    
    if [[ -z "$message" || "$message" == "null" ]]; then
        error "Cleanup failed: invalid response from server."
        exit 7
    fi
    
    success "Cleanup complete: $message"
    info "Deleted Items -> Events: ${deleted_events:-0}, Incidents: ${deleted_incidents:-0}, Investigations: ${deleted_investigations:-0}, Briefings: ${deleted_briefings:-0}"
}
