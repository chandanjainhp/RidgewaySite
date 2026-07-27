#!/usr/bin/env bash

# Execution timer utility
start_timer() {
    export TIMER_START=$(date +%s)
}

elapsed_seconds() {
    local now
    now=$(date +%s)
    echo $((now - ${TIMER_START:-now}))
}

format_elapsed() {
    local sec
    sec=$(elapsed_seconds)
    printf "%02d:%02d" $((sec / 60)) $((sec % 60))
}
