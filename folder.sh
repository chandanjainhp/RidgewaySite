#!/usr/bin/env bash

set -euo pipefail

PROJECT="sentinel-smoke-test"

mkdir -p "$PROJECT"
cd "$PROJECT"

mkdir -p lib
mkdir -p logs
mkdir -p reports
mkdir -p tests
mkdir -p tmp

touch README.md
touch .env.example
touch .gitignore
touch run-investigation.sh

touch lib/config.sh
touch lib/colors.sh
touch lib/logger.sh
touch lib/checks.sh
touch lib/http.sh
touch lib/auth.sh
touch lib/events.sh
touch lib/investigation.sh
touch lib/polling.sh
touch lib/briefing.sh
touch lib/cleanup.sh
touch lib/spinner.sh
touch lib/timer.sh
touch lib/utils.sh

touch tests/test-http.sh
touch tests/test-auth.sh
touch tests/test-utils.sh

touch logs/.gitkeep
touch reports/.gitkeep
touch tmp/.gitkeep

chmod +x run-investigation.sh
chmod +x tests/*.sh

cat > .env.example <<EOF
API_BASE=http://localhost:8000/api/v1
API_EMAIL=your-email@example.com
API_PASSWORD=your-password

COUNT=8
POLL_INTERVAL=5
MAX_POLLS=72

ORG_ID=
EOF

cat > .gitignore <<EOF
.env

logs/*
!logs/.gitkeep

reports/*
!reports/.gitkeep

tmp/*
!tmp/.gitkeep
EOF

echo "Project structure created successfully."

find .
