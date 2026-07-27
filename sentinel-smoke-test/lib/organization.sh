#!/usr/bin/env bash

# Organization Resolution module
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/http.sh"
source "$LIB_DIR/utils.sh"

resolve_organization() {
    HTTP_EXIT_CODE=3
    
    info "Resolving organization..."
    
    # Respect pre-configured ORG_ID if available
    if [[ -n "${ORG_ID:-}" ]]; then
        success "Using pre-configured ORG_ID: $ORG_ID"
        export ORG_ID
        return 0
    fi
    
    # Get current user profile to inspect role and orgId
    local user_resp
    user_resp=$(http_get "/auth/current-user")
    
    local role
    role=$(json_extract ".data.role" "$user_resp")
    local user_org_id
    user_org_id=$(json_extract ".data.orgId" "$user_resp")
    
    if [[ -z "$role" || "$role" == "null" ]]; then
        # Fallback to checking nested data.user
        role=$(json_extract ".data.user.role" "$user_resp")
        user_org_id=$(json_extract ".data.user.orgId" "$user_resp")
    fi
    
    debug "User Role: $role, User Org ID: $user_org_id"
    
    if [[ "$role" == "super_admin" ]]; then
        info "User is Super Admin. Automatically discovering active organization..."
        
        local orgs_resp
        orgs_resp=$(http_get "/admin/orgs?limit=1")
        
        # Check listOrgs response structure
        # Matches: .data.data[0]._id
        local first_org_id
        first_org_id=$(json_extract ".data.data[0]._id" "$orgs_resp")
        
        if [[ -z "$first_org_id" || "$first_org_id" == "null" ]]; then
            # Try fallback without nested data
            first_org_id=$(json_extract ".data[0]._id" "$orgs_resp")
        fi
        
        if [[ -z "$first_org_id" || "$first_org_id" == "null" ]]; then
            error "Organization resolution failed: No active organizations found on backend."
            exit 3
        fi
        
        ORG_ID="$first_org_id"
        local org_name
        org_name=$(json_extract ".data.data[0].name" "$orgs_resp")
        success "Discovered organization: $org_name (ID: $ORG_ID)"
    else
        if [[ -z "$user_org_id" || "$user_org_id" == "null" ]]; then
            error "Organization resolution failed: User is Operator but has no orgId associated."
            exit 3
        fi
        
        ORG_ID="$user_org_id"
        success "Using Operator organization ID: $ORG_ID"
    fi
    
    export ORG_ID
}
