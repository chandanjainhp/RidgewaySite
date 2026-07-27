#!/usr/bin/env bash
# Delegate to the modular Sentinel E2E Smoke Testing Workflow Runner
exec "$(dirname "$0")/sentinel-smoke-test/run-investigation.sh" "$@"
