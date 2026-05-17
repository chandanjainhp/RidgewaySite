#!/bin/bash

BASE="http://localhost:8000/api/v1"
EMAIL="iamchandanjainhp@gmail.com"
PASSWORD=""  # ← set your password here

echo "=== STEP 1: Login ==="
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" |
  jq '{role:.data.role, orgId:.data.orgId}'

echo ""
echo "=== STEP 2: Create drone API key ==="
DRONE_KEY=$(curl -s -X POST $BASE/org/api-keys \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Test Drone","scopes":["events:write"]}' |
  jq -r '.data.key')
echo "Drone key: $DRONE_KEY"

echo ""
echo "=== STEP 3: Send 5 events ==="
for TYPE in motion_detected badge_swipe_fail vehicle_entry fence_alert environmental; do
  curl -s -X POST $BASE/events \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DRONE_KEY" \
    -d "{
      \"type\": \"$TYPE\",
      \"timestamp\": \"2026-04-18T0$((RANDOM % 6 + 1)):$((RANDOM % 60)):00.000Z\",
      \"location\": {
        \"name\": \"Test Zone\",
        \"zone\": \"perimeter\",
        \"coordinates\": { \"lat\": 51.5074, \"lng\": -0.1278 }
      },
      \"severity\": \"minor\",
      \"rawData\": {}
    }" | jq '{type:.data.type, id:.data._id}'
done

echo ""
echo "=== STEP 4: Start investigation ==="
JOB_ID=$(curl -s -X POST $BASE/investigations/start \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"nightDate":"2026-04-18"}' |
  jq -r '.data.jobId')
echo "Job ID: $JOB_ID"

echo ""
echo "=== STEP 5: Poll status (30 seconds) ==="
for i in {1..6}; do
  sleep 5
  STATUS=$(curl -s -X GET $BASE/investigations/$JOB_ID \
    -b cookies.txt | jq -r '.data.status')
  echo "[$i] Status: $STATUS"
  if [ "$STATUS" = "complete" ]; then break; fi
done

echo ""
echo "=== STEP 6: Get briefing ==="
curl -s -X GET $BASE/briefings/latest \
  -b cookies.txt |
  jq '{status:.data.status, summary:.data.sections.executive_summary}'
