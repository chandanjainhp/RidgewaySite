#!/usr/bin/env bash

# Structured logging with color output and file log mirroring
LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LIB_DIR/colors.sh"

LOG_DIR="$(cd "$LIB_DIR/.." && pwd)/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/smoke-test.log"

timestamp() {
    date +"%H:%M:%S"
}

log_message() {
    local level="$1"
    local color="$2"
    shift 2
    local msg="$*"
    
    # Print to stderr to not interfere with stdout capturing in subshells
    printf "${color}[$(timestamp)] %-8s${RESET} %s\n" "$level" "$msg" >&2
    
    # Append to log file
    printf "[$(date +'%Y-%m-%d %H:%M:%S')] %-8s %s\n" "$level" "$msg" >> "$LOG_FILE"
}

info() {
    log_message "INFO" "$BLUE" "$@"
}

success() {
    log_message "SUCCESS" "$GREEN" "$@"
}

warn() {
    log_message "WARN" "$YELLOW" "$@"
}

error() {
    log_message "ERROR" "$RED" "$@"
}

debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        log_message "DEBUG" "$MAGENTA" "$@"
    fi
}
