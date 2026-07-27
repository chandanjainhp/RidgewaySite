#!/usr/bin/env bash

# Polling and progress tracking module
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/http.sh"
source "$LIB_DIR/utils.sh"
source "$LIB_DIR/timer.sh"
source "$LIB_DIR/spinner.sh"

poll_investigation() {
    HTTP_EXIT_CODE=5
    
    local job_id="${ACTIVE_JOB_ID:?No active job ID to poll}"
    local poll_interval="${POLL_INTERVAL:-5}"
    local max_polls="${MAX_POLLS:-72}"
    local timeout_seconds=$((max_polls * poll_interval))
    
    info "Polling investigation progress (Interval: ${poll_interval}s, Max Wait: ${timeout_seconds}s)..."
    
    start_timer
    local attempt=0
    local is_complete=false
    
    while (( attempt < max_polls )); do
        attempt=$((attempt + 1))
        
        # Check timeout explicitly
        local elapsed
        elapsed=$(elapsed_seconds)
        if (( elapsed >= timeout_seconds )); then
            error "Investigation polling timed out after ${elapsed}s."
            exit 5
        fi
        
        local response
        response=$(http_get "/test/investigation-status/$job_id")
        
        local status
        status=$(json_extract ".data.status" "$response")
        local tool_calls
        tool_calls=$(json_extract ".data.progress.toolCallsExecuted" "$response")
        local briefing_status
        briefing_status=$(json_extract ".data.briefingStatus" "$response")
        
        [[ -z "$tool_calls" || "$tool_calls" == "null" ]] && tool_calls=0
        
        # Map current phase based on status and briefing status
        local phase="Unknown"
        case "$status" in
            queued)
                phase="Queue Standby"
                ;;
            running)
                phase="Argus Investigation"
                ;;
            complete)
                if [[ "$briefing_status" == "not_started" ]]; then
                    phase="Finalizing Investigation"
                elif [[ "$briefing_status" == "generating" ]]; then
                    phase="Generating Morning Briefing"
                elif [[ "$briefing_status" == "draft" || "$briefing_status" == "pending_review" || "$briefing_status" == "approved" ]]; then
                    phase="Morning Briefing Ready"
                else
                    phase="Completing"
                fi
                ;;
            failed)
                phase="Failed"
                ;;
            *)
                phase="$status"
                ;;
        esac
        
        local elapsed_fmt
        elapsed_fmt=$(format_elapsed)
        
        # Build status update line
        local status_line
        status_line=$(printf "[%s] Status: %s | Phase: %s | Tools: %s | Briefing: %s" \
            "$elapsed_fmt" "$status" "$phase" "$tool_calls" "$briefing_status")
        
        # Check termination condition
        if [[ "$status" == "complete" || "$briefing_status" == "draft" || "$briefing_status" == "pending_review" || "$briefing_status" == "approved" ]]; then
            is_complete=true
            echo "" >&2 # Clear the line after spinner
            success "Investigation completed! Elapsed Time: $elapsed_fmt"
            export INVESTIGATION_DURATION="$elapsed"
            export FINAL_TOOL_CALLS_COUNT="$tool_calls"
            break
        fi
        
        if [[ "$status" == "failed" ]]; then
            echo "" >&2
            error "Investigation failed on backend server."
            exit 5
        fi
        
        # Sleep with spinner animation
        sleep_with_spinner "$poll_interval" "$status_line"
    done
    
    if [[ "$is_complete" != "true" ]]; then
        error "Investigation failed to complete within the maximum timeout of ${timeout_seconds}s."
        exit 5
    fi
}
