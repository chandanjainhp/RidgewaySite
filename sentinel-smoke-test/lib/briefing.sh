#!/usr/bin/env bash

# Briefing Verification module
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/http.sh"
source "$LIB_DIR/utils.sh"

extract_section() {
    local json="$1"
    local name="$2"
    
    # Try array select first, then fallback to object key
    if command -v jq >/dev/null 2>&1; then
        echo "$json" | jq -r "
            .data.briefing.sections | 
            if type == \"array\" then 
                (.[] | select(.name == \"$name\") | .content) 
            else 
                (.$name.agentDraft // .$name.content // .$name // empty) 
            end
        " 2>/dev/null || echo ""
    else
        python3 - "$json" "$name" <<'PY'
import sys, json
try:
    d = json.loads(sys.argv[1])
    name = sys.argv[2]
    sections = d.get('data', {}).get('briefing', {}).get('sections', {})
    if isinstance(sections, list):
        for s in sections:
            if s.get('name') == name:
                print(s.get('content') or "")
                sys.exit(0)
    elif isinstance(sections, dict):
        val = sections.get(name, {})
        if isinstance(val, dict):
            print(val.get('agentDraft') or val.get('content') or "")
        else:
            print(val or "")
        sys.exit(0)
    print("")
except Exception:
    print("")
PY
    fi
}

verify_briefing() {
    HTTP_EXIT_CODE=6
    
    info "Fetching morning briefing..."
    
    local response
    response=$(http_get "/test/briefing")
    
    local briefing_id
    briefing_id=$(json_extract ".data.briefing.briefingId" "$response")
    local status
    status=$(json_extract ".data.briefing.status" "$response")
    
    if [[ -z "$briefing_id" || "$briefing_id" == "null" ]]; then
        error "Briefing validation failed: briefingId not found."
        exit 6
    fi
    
    # Extract sections
    local exec_summary
    exec_summary=$(extract_section "$response" "executive_summary")
    local incidents
    incidents=$(extract_section "$response" "incidents")
    local recs
    recs=$(extract_section "$response" "recommendations")
    local follow_up
    follow_up=$(extract_section "$response" "follow_up")
    local anomalies
    anomalies=$(extract_section "$response" "anomalies")
    
    # Extract metrics
    local inv_count
    inv_count=$(json_extract ".data.briefing.metadata.investigationCount" "$response")
    local tokens
    tokens=$(json_extract ".data.briefing.metadata.totalTokensUsed" "$response")
    
    # Validate required sections are present and not empty
    local missing_sections=()
    [[ -z "${exec_summary//[[:space:]]/}" ]] && missing_sections+=("Executive Summary")
    [[ -z "${incidents//[[:space:]]/}" ]] && missing_sections+=("Incidents")
    [[ -z "${recs//[[:space:]]/}" ]] && missing_sections+=("Recommendations")
    [[ -z "${follow_up//[[:space:]]/}" ]] && missing_sections+=("Follow Up")
    
    if (( ${#missing_sections[@]} > 0 )); then
        error "Briefing validation failed: missing or empty sections: ${missing_sections[*]}"
        exit 6
    fi
    
    success "Morning briefing verified successfully (ID: $briefing_id)"
    
    # Print formatted briefing report to console
    echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${BOLD}${GREEN}                 SENTINEL MORNING BRIEFING REPORT${RESET}"
    echo -e "  Briefing ID: ${CYAN}$briefing_id${RESET} | Night: ${CYAN}${NIGHT_DATE:-$(get_today_night_date)}${RESET} | Status: ${CYAN}$status${RESET}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    
    echo -e "\n${BOLD}${YELLOW}[ 1. EXECUTIVE SUMMARY ]${RESET}"
    echo "$exec_summary"
    
    echo -e "\n${BOLD}${YELLOW}[ 2. INCIDENTS DETAIL ]${RESET}"
    echo "$incidents"
    
    echo -e "\n${BOLD}${YELLOW}[ 3. RECOMMENDATIONS ]${RESET}"
    echo "$recs"
    
    echo -e "\n${BOLD}${YELLOW}[ 4. FOLLOW-UP ACTIONS ]${RESET}"
    echo "$follow_up"
    
    if [[ -n "$anomalies" && "$anomalies" != "null" ]]; then
        echo -e "\n${BOLD}${YELLOW}[ 5. DRONE PATROL FINDINGS ]${RESET}"
        echo "$anomalies"
    fi
    
    echo -e "\n${BOLD}${YELLOW}[ METRICS ]${RESET}"
    echo "  Investigations Conducted: ${inv_count:-0}"
    echo "  Total LLM Tokens Used:    ${tokens:-0}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
    
    # Save values for the final markdown report
    export BRIEFING_ID="$briefing_id"
    export BRIEFING_STATUS="$status"
    export BRIEFING_METADATA_COUNT="${inv_count:-0}"
    export BRIEFING_METADATA_TOKENS="${tokens:-0}"
}
