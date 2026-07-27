#!/usr/bin/env bash

# Authentication module
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/http.sh"
source "$LIB_DIR/utils.sh"

authenticate() {
    # Set the HTTP exit code to 2 for this step
    HTTP_EXIT_CODE=2
    
    info "Authenticating user: $API_EMAIL..."
    
    if [[ -z "$API_EMAIL" || -z "$API_PASSWORD" ]]; then
        error "API_EMAIL and API_PASSWORD must be configured in .env"
        exit 2
    fi
    
    local login_payload
    login_payload=$(printf '{"email":"%s","password":"%s"}' "$API_EMAIL" "$API_PASSWORD")
    
    local response
    response=$(http_post "/auth/login" "$login_payload")
    
    local token
    token=$(json_extract ".data.accessToken" "$response")
    local role
    role=$(json_extract ".data.user.role" "$response")
    local username
    username=$(json_extract ".data.user.username" "$response")
    
    if [[ -z "$token" || "$token" == "null" ]]; then
        error "Authentication failed: accessToken not found in response."
        exit 2
    fi
    
    # Export TOKEN for subsequent HTTP requests
    export TOKEN="$token"
    
    # Verify JWT expiration
    # Decode payload (part 2)
    local jwt_payload_b64
    jwt_payload_b64=$(echo "$token" | cut -d'.' -f2)
    local padding=$(( 4 - (${#jwt_payload_b64} % 4) ))
    if (( padding < 4 )); then
        for ((i=0; i<padding; i++)); do jwt_payload_b64="${jwt_payload_b64}="; done
    fi
    
    local decoded_payload
    decoded_payload=$(echo "$jwt_payload_b64" | tr '_-' '/+' | base64 -d 2>/dev/null || echo "")
    
    local exp
    exp=$(json_extract ".exp" "$decoded_payload")
    
    if [[ -z "$exp" ]]; then
        error "Authentication failed: exp (expiration) claim not found in JWT token."
        exit 2
    fi
    
    local current_time
    current_time=$(date +%s)
    
    if (( exp <= current_time )); then
        error "Authentication failed: JWT token has already expired."
        exit 2
    fi
    
    success "Authenticated successfully as $username (Role: $role)"
    debug "Token: ${TOKEN:0:20}... (Expires: $(date -d "@$exp" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -d "@$exp" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$exp"))"
    
    # Store auth details for reports
    export AUTH_ROLE="$role"
    export AUTH_USER="$username"
}
