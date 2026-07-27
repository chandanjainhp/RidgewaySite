#!/usr/bin/env bash

# Prerequisites and dependency checks
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/logger.sh"
source "$LIB_DIR/config.sh"

check_dependencies() {
    info "Running preflight checks..."
    
    local missing=()
    for cmd in curl jq python3 bun; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing+=("$cmd")
        fi
    done
    
    if (( ${#missing[@]} > 0 )); then
        error "Missing required dependencies: ${missing[*]}"
        exit 1
    fi
    success "CLI dependencies verified: curl, jq, python3, bun"
    
    # Check if API server is reachable
    info "Verifying API server reachability..."
    if ! curl -sf "${API_BASE}/health" >/dev/null 2>&1; then
        error "API server not reachable at ${API_BASE}."
        error "Is the backend server running? (Run 'bun run dev' or 'bun start' in the server directory)."
        exit 1
    fi
    success "API server is reachable: ${API_BASE}"
    
    # Check MongoDB connection
    info "Verifying MongoDB connection..."
    if [[ -z "${MONGODB_URL:-}" ]]; then
        error "MONGODB_URL not found in environment or server configuration."
        exit 1
    fi
    
    local server_dir
    server_dir="$(cd "$LIB_DIR/../../server" && pwd)"
    
    if ! (cd "$server_dir" && bun -e "const mongoose = require('mongoose'); mongoose.connect('$MONGODB_URL').then(() => process.exit(0)).catch(() => process.exit(1))") >/dev/null 2>&1; then
        error "Failed to connect to MongoDB using connection URL: $MONGODB_URL"
        exit 1
    fi
    
    success "MongoDB connection verified"
}
