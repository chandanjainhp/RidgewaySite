#!/usr/bin/env bash

# Spinner animation utility for polling states
# Usage: sleep_with_spinner <seconds> <prefix_text>
sleep_with_spinner() {
    local seconds="$1"
    local prefix="${2:-}"
    
    # Premium braille spinner characters
    local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local delay=0.1
    
    # Calculate total loops based on delay
    local loops
    loops=$(python3 -c "print(int($seconds / $delay))" 2>/dev/null || echo "$((seconds * 10))")
    
    # Hide cursor
    printf "\e[?25l" >&2
    
    for ((i=0; i<loops; i++)); do
        local frame=$((i % ${#spinner[@]}))
        # Print spinner frame and prefix
        printf "\r  ${BOLD}${CYAN}%s${RESET} %s" "${spinner[frame]}" "$prefix" >&2
        sleep "$delay"
    done
    
    # Clear line and restore cursor
    printf "\r\e[K\e[?25h" >&2
}
