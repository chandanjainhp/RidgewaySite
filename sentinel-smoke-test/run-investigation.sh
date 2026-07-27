#!/usr/bin/env bash

# Sentinel E2E Smoke Testing Workflow Runner
# Coordinates: Prerequisites -> Auth -> Org -> Seed -> Correlate -> Investigation -> Poll -> Briefing -> Cleanup

set -euo pipefail

# Record script start time
export SCRIPT_START_TIME
SCRIPT_START_TIME=$(date +%s)

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Source all required modules
# shellcheck disable=SC1091
source "$ROOT/lib/colors.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/config.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/logger.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/utils.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/checks.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/http.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/auth.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/organization.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/events.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/investigation.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/polling.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/briefing.sh"
# shellcheck disable=SC1091
source "$ROOT/lib/cleanup.sh"

# Set script parameters from arguments
DO_CLEANUP=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-cleanup)
            DO_CLEANUP=false
            shift
            ;;
        --count)
            COUNT="$2"
            export COUNT
            shift 2
            ;;
        --date)
            NIGHT_DATE="$2"
            export NIGHT_DATE
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Set default date if not provided
export NIGHT_DATE="${NIGHT_DATE:-$(get_today_night_date)}"

# Exit handler for automatic failure report generation
on_exit_handler() {
    local exit_code=$?
    # Restore cursor in case spinner was running
    printf "\e[?25h" >&2
    if (( exit_code != 0 )); then
        error "Smoke test workflow terminated with exit code $exit_code"
        # Generate failure report
        generate_markdown_report "FAILURE" "Workflow failed at exit code $exit_code."
    fi
}
trap on_exit_handler EXIT

# ==============================================================================
# WORKFLOW EXECUTION
# ==============================================================================

# Step 1: Preflight checks (Exit Code 1)
check_dependencies

# Step 2: Authenticate (Exit Code 2)
authenticate

# Step 3: Resolve Organization (Exit Code 3)
resolve_organization

# Step 4: Seed Events (Exit Code 4)
seed_events

# Step 5 & 6: Trigger & Poll Investigation (Exit Code 5)
trigger_investigation
poll_investigation

# Step 7: Verify Briefing (Exit Code 6)
verify_briefing

# Step 8: Cleanup (Exit Code 7)
if [[ "$DO_CLEANUP" == "true" ]]; then
    cleanup_test_data
else
    warn "Skipping cleanup as requested. Test data remains in database."
fi

# ==============================================================================
# WORKFLOW COMPLETION
# ==============================================================================

# Disable trap on success
trap - EXIT

# Generate success report
generate_markdown_report "SUCCESS"

success "E2E Smoke test workflow passed successfully."
exit 0
