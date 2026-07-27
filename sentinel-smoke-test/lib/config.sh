#!/usr/bin/env bash

# Load and resolve configuration variables
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$LIB_DIR/.." && pwd)"

ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
    # Load env file variables
    # shellcheck disable=SC1090
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Ignore comments and empty lines
        if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
            key=$(echo "$line" | cut -d'=' -f1 | tr -d '[:space:]')
            value=$(echo "$line" | cut -d'=' -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            # Only set if key is not empty
            if [[ -n "$key" ]]; then
                declare -g "$key"="$value"
                export "$key"
            fi
        fi
    done < "$ENV_FILE"
fi

# Set defaults
export API_BASE="${API_BASE:-http://localhost:8000/api/v1}"
export COUNT="${COUNT:-8}"
export POLL_INTERVAL="${POLL_INTERVAL:-5}"
export MAX_POLLS="${MAX_POLLS:-72}"
export API_EMAIL="${API_EMAIL:-}"
export API_PASSWORD="${API_PASSWORD:-}"
export ORG_ID="${ORG_ID:-}"

# Resolve MONGODB_URL from server .env if not set in smoke test .env
if [[ -z "${MONGODB_URL:-}" && -f "$ROOT_DIR/../server/.env" ]]; then
    MONGODB_URL=$(grep "^MONGODB_URL=" "$ROOT_DIR/../server/.env" | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    export MONGODB_URL
fi

export MONGODB_URL="${MONGODB_URL:-}"
