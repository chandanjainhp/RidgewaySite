#!/usr/bin/env bash

# Investigation & Incident Correlation module
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/http.sh"
source "$LIB_DIR/utils.sh"

correlate_events() {
    local date_str="${NIGHT_DATE:-$(get_today_night_date)}"
    info "Triggering incident correlation for Org: $ORG_ID, Date: $date_str..."
    
    local server_dir
    server_dir="$(cd "$LIB_DIR/../../server" && pwd)"
    
    # Run the correlation service directly via bun
    if ! (cd "$server_dir" && bun -e "
        import { connectDatabases } from './src/db/index.js';
        import { correlateNightEvents } from './src/services/correlation.service.js';
        await connectDatabases();
        await correlateNightEvents('$ORG_ID', '$date_str');
        process.exit(0);
    "); then
        error "Incident correlation execution failed."
        exit 5
    fi
    
    # Get the number of correlated incidents from database
    local incident_count
    incident_count=$(cd "$server_dir" && bun -e "
        import { connectDatabases } from './src/db/index.js';
        import Incident from './src/models/incident.model.js';
        await connectDatabases();
        const count = await Incident.countDocuments({
            orgId: '$ORG_ID',
            nightDate: '$date_str'
        });
        console.log(count);
        process.exit(0);
    " 2>/dev/null || echo "0")
    
    incident_count=$(echo "$incident_count" | tail -n 1 | tr -d '[:space:]')
    
    if [[ -z "$incident_count" || "$incident_count" == "0" ]]; then
        error "Incident correlation failed: 0 incidents created."
        exit 5
    fi
    
    success "Incident Correlation completed. Total Incidents: $incident_count"
    export CREATED_INCIDENTS_COUNT="$incident_count"
}

trigger_investigation() {
    HTTP_EXIT_CODE=5
    
    # Perform event correlation first
    correlate_events
    
    local date_str="${NIGHT_DATE:-$(get_today_night_date)}"
    info "Triggering Argus investigation for date $date_str..."
    
    local payload
    payload=$(printf '{"nightDate":"%s"}' "$date_str")
    
    local response
    response=$(http_post "/test/trigger-investigation" "$payload")
    
    local status
    status=$(json_extract ".data.status" "$response")
    local job_id
    job_id=$(json_extract ".data.jobId" "$response")
    local total_jobs
    total_jobs=$(json_extract ".data.totalJobs" "$response")
    
    if [[ "$status" == "no_incidents" ]]; then
        error "Failed to trigger investigation: No incidents found."
        exit 5
    fi
    
    if [[ "$status" == "already_running" ]]; then
        # Re-use first job ID if already running
        local job_ids
        job_ids=$(json_extract ".data.jobIds[0]" "$response")
        if [[ -n "$job_ids" && "$job_ids" != "null" ]]; then
            job_id="$job_ids"
        fi
        warn "Investigation already running. Re-using active job ID: $job_id"
    elif [[ -z "$job_id" || "$job_id" == "null" ]]; then
        error "Failed to trigger investigation: jobId not returned from server."
        exit 5
    fi
    
    success "Argus investigation triggered (Status: $status, Job ID: $job_id, Total Jobs: ${total_jobs:-1})"
    
    export ACTIVE_JOB_ID="$job_id"
    export TOTAL_INVESTIGATION_JOBS="${total_jobs:-1}"
}
