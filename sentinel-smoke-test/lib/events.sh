#!/usr/bin/env bash

# Event Seeding module
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/http.sh"
source "$LIB_DIR/utils.sh"

seed_events() {
    HTTP_EXIT_CODE=4
    
    local count="${COUNT:-8}"
    local date_str="${NIGHT_DATE:-$(get_today_night_date)}"
    
    info "Seeding $count events for night $date_str..."
    
    local payload
    payload=$(printf '{"count":%d,"nightDate":"%s","orgId":"%s"}' "$count" "$date_str" "$ORG_ID")
    
    local response
    response=$(http_post "/test/seed-events" "$payload")
    
    local res_count
    res_count=$(json_extract ".data.count" "$response")
    
    if [[ -z "$res_count" || "$res_count" == "null" || "$res_count" -ne "$count" ]]; then
        error "Event seeding failed: expected $count seeded events, got $res_count"
        exit 4
    fi
    
    success "Successfully seeded $res_count events in database."
    
    # Validate event details in the response
    local allowed_types="motion_detected badge_swipe_fail vehicle_entry fence_alert environmental"
    local allowed_severities="serious minor harmless uncertain"
    
    for ((i=0; i<res_count; i++)); do
        local event_json
        event_json=$(json_extract ".data.events[$i]" "$response")
        
        local type
        type=$(json_extract ".type" "$event_json")
        local severity
        severity=$(json_extract ".severity" "$event_json")
        local timestamp
        timestamp=$(json_extract ".timestamp" "$event_json")
        local location
        location=$(json_extract ".location" "$event_json")
        
        # 1. Validate Type
        if [[ ! " $allowed_types " =~ " $type " ]]; then
            error "Event validation failed: event index $i has invalid type '$type'"
            exit 4
        fi
        
        # 2. Validate Severity
        if [[ ! " $allowed_severities " =~ " $severity " ]]; then
            error "Event validation failed: event index $i has invalid severity '$severity'"
            exit 4
        fi
        
        # 3. Validate Timestamp
        if [[ -z "$timestamp" || "$timestamp" == "null" ]]; then
            error "Event validation failed: event index $i has missing timestamp"
            exit 4
        fi
        
        # 4. Validate Location
        if [[ -z "$location" || "$location" == "null" ]]; then
            error "Event validation failed: event index $i has missing location"
            exit 4
        fi
        
        debug "Valid Event [$i]: Type=$type, Severity=$severity, Location=$location, Time=$timestamp"
    done
    
    success "Verified all seeded event fields: timestamps, severities, types, and locations."
    
    # Store events count for reports
    export SEEDED_EVENTS_COUNT="$res_count"
}
