#!/usr/bin/env python3
"""Seed a synthetic overnight investigation through Sentinel's public HTTP API.

Required environment variables (unless --dry-run is used):
    EMAIL, PASSWORD, DRONE_API_KEY

Optional environment variables:
    BASE_URL   (default: http://localhost:8000/api/v1)
    NIGHT_DATE (YYYY-MM-DD; default: today's local date)
"""

import argparse
import json
import os
import sys
import time
import uuid
from collections import Counter
from datetime import datetime, time as clock_time

import requests


BASE_URL = os.getenv("BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
EMAIL = os.getenv("chandanjaincj93@gmail.com")
PASSWORD = os.getenv("GStR$mYwVB45naBvsMET")
DRONE_API_KEY = os.getenv("")
REQUEST_TIMEOUT_SECONDS = 10


def response_body(response):
    """Return a readable response body even when it is not JSON."""
    try:
        return json.dumps(response.json(), indent=2, default=str)
    except ValueError:
        return response.text or "<empty response body>"


def api_data(payload):
    """Unwrap the standard Sentinel API response while tolerating raw responses."""
    return payload.get("data", payload) if isinstance(payload, dict) else payload


def request_json(method, url, *, session=None, headers=None, payload=None):
    """Make one API call and report connection/non-success failures explicitly."""
    client = session if session is not None else requests
    try:
        response = client.request(
            method,
            url,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        print(f"{method} {url} connection error: {exc}", file=sys.stderr)
        return None, None

    try:
        body = response.json()
    except ValueError:
        body = None

    if not 200 <= response.status_code < 300:
        print(
            f"{method} {url} returned HTTP {response.status_code}:\n{response_body(response)}",
            file=sys.stderr,
        )
        return None, response
    return body, response


def synthetic_events(night_date):
    """Return 18 deterministic, clustered events for a single patrol night."""
    base = datetime.combine(night_date, clock_time(19, 8))
    # Clusters intentionally join related activity near the north perimeter and loading yard.
    specs = [
        (0, "motion_detected", "minor", "North Perimeter Camera 03", "perimeter", 51.50742, -0.12781, "Motion along the north fence line."),
        (3, "fence_alert", "serious", "North Fence Sensor N-04", "perimeter", 51.50747, -0.12776, "Fence vibration detected near service path."),
        (6, "motion_detected", "serious", "North Perimeter Camera 04", "perimeter", 51.50751, -0.12771, "Two figures detected moving eastbound."),
        (10, "badge_swipe_fail", "minor", "North Gate Reader", "access_point", 51.50735, -0.12794, "Three denied badge attempts at North Gate."),
        (16, "vehicle_entry", "uncertain", "North Service Road ANPR", "road", 51.50730, -0.12802, "Unrecognised white utility van entered service road."),
        (23, "motion_detected", "serious", "Loading Yard Camera 01", "yard", 51.50708, -0.12749, "Motion detected beside loading bay doors."),
        (27, "badge_swipe_fail", "serious", "Loading Dock Reader", "access_point", 51.50702, -0.12742, "Badge swipe rejected after-hours."),
        (31, "vehicle_entry", "minor", "Loading Yard ANPR", "yard", 51.50698, -0.12736, "White utility van observed at loading yard."),
        (38, "environmental", "minor", "Generator Enclosure", "yard", 51.50715, -0.12730, "Generator enclosure temperature above normal range."),
        (52, "motion_detected", "minor", "East Block Camera 02", "block", 51.50772, -0.12712, "Single motion event at east block walkway."),
        (67, "fence_alert", "minor", "East Fence Sensor E-02", "perimeter", 51.50783, -0.12702, "Brief fence vibration near east corner."),
        (81, "environmental", "harmless", "Weather Station", "road", 51.50761, -0.12820, "Light rain and increasing wind recorded."),
        (97, "vehicle_entry", "minor", "South Gate ANPR", "access_point", 51.50670, -0.12790, "Approved maintenance vehicle exited site."),
        (113, "badge_swipe_fail", "minor", "Admin Block Reader", "block", 51.50736, -0.12725, "Expired contractor badge presented."),
        (130, "motion_detected", "uncertain", "West Perimeter Camera 01", "perimeter", 51.50748, -0.12848, "Intermittent motion obscured by rain."),
        (149, "environmental", "minor", "Fuel Store Sensor", "yard", 51.50700, -0.12762, "Fuel-store humidity threshold exceeded."),
        (171, "fence_alert", "minor", "West Fence Sensor W-01", "perimeter", 51.50755, -0.12855, "Fence vibration cleared after 12 seconds."),
        (193, "motion_detected", "minor", "North Perimeter Camera 03", "perimeter", 51.50744, -0.12779, "Follow-up motion event; area then clear."),
    ]
    events = []
    for index, (minutes, event_type, severity, name, zone, lat, lng, description) in enumerate(specs, start=1):
        timestamp = base.timestamp() + minutes * 60
        events.append(
            {
                "eventId": f"DEMO-{night_date:%Y%m%d}-{index:02d}-{uuid.uuid4().hex[:8]}",
                "type": event_type,
                "timestamp": datetime.fromtimestamp(timestamp).astimezone().isoformat(),
                "severity": severity,
                "description": description,
                "location": {"name": name, "zone": zone, "coordinates": {"lat": lat, "lng": lng}},
                "rawData": {"source": "seed_investigation_demo", "confidence": 0.82 + (index % 4) * 0.04},
            }
        )
    return events


def poll_incidents(session, night_date):
    deadline = time.monotonic() + 30
    delay = 1
    url = f"{BASE_URL}/incidents?nightDate={night_date}"
    while time.monotonic() < deadline:
        body, _ = request_json("GET", url, session=session)
        incidents = api_data(body) if body else None
        if isinstance(incidents, list) and incidents:
            return incidents
        print(f"Waiting for correlation ({delay}s)...")
        time.sleep(delay)
        delay = min(delay * 2, 5)
    print("Timed out after 30s waiting for incidents.", file=sys.stderr)
    return []


def poll_investigation(session, investigation_id):
    deadline = time.monotonic() + 120
    delay = 1
    url = f"{BASE_URL}/investigations/{investigation_id}"
    while time.monotonic() < deadline:
        body, _ = request_json("GET", url, session=session)
        investigation = api_data(body) if body else None
        if isinstance(investigation, dict) and investigation.get("status") in {"complete", "failed"}:
            return investigation
        print(f"Waiting for investigation {investigation_id} ({delay}s)...")
        time.sleep(delay)
        delay = min(delay * 2, 10)
    print(f"Timed out after 120s waiting for investigation {investigation_id}.", file=sys.stderr)
    return None


def print_dry_run(night_date, events):
    print(f"DRY RUN — no HTTP requests will be sent. BASE_URL={BASE_URL}")
    print(f"POST {BASE_URL}/auth/login {{'email': '<EMAIL>', 'password': '<PASSWORD>'}}")
    for event in events:
        print(f"POST {BASE_URL}/events?nightDate={night_date} {json.dumps(event, default=str)}")
    print(f"POST {BASE_URL}/investigations/start {{'nightDate': '{night_date}'}} (once per correlated incident)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print POST requests without sending HTTP requests.")
    args = parser.parse_args()

    try:
        night_date = datetime.strptime(os.getenv("NIGHT_DATE", datetime.now().date().isoformat()), "%Y-%m-%d").date()
    except ValueError:
        print("NIGHT_DATE must use YYYY-MM-DD.", file=sys.stderr)
        return 2

    events = synthetic_events(night_date)
    if args.dry_run:
        print_dry_run(night_date, events)
        return 0

    missing = [name for name, value in (("EMAIL", EMAIL), ("PASSWORD", PASSWORD), ("DRONE_API_KEY", DRONE_API_KEY)) if not value]
    if missing:
        print(f"Missing required environment variable(s): {', '.join(missing)}", file=sys.stderr)
        return 2

    session = requests.Session()
    login_body, _ = request_json("POST", f"{BASE_URL}/auth/login", session=session, payload={"email": EMAIL, "password": PASSWORD})
    login_data = api_data(login_body) if login_body else None
    token = login_data.get("accessToken") if isinstance(login_data, dict) else None
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    if not login_body or (not token and not session.cookies.get("accessToken")):
        print("Login did not provide a usable JWT cookie or access token.", file=sys.stderr)
        return 1

    event_url = f"{BASE_URL}/events?nightDate={night_date}"
    drone_headers = {"Authorization": f"Bearer {DRONE_API_KEY}", "Content-Type": "application/json"}
    for event in events:
        headers = {**drone_headers, "Idempotency-Key": event["eventId"]}
        body, _ = request_json("POST", event_url, headers=headers, payload=event)
        if body is None:
            return 1
    print(f"Posted {len(events)} synthetic events for {night_date}.")

    incidents = poll_incidents(session, night_date)
    if not incidents:
        return 1
    print(f"Correlation produced {len(incidents)} incident(s).")

    # The public endpoint starts work for the night. Repeating it per incident is harmless:
    # after the first call Sentinel returns the same active jobs as already_running.
    investigation_ids = set()
    for incident in incidents:
        body, _ = request_json("POST", f"{BASE_URL}/investigations/start", session=session, payload={"nightDate": str(night_date)})
        start_data = api_data(body) if body else None
        if not isinstance(start_data, dict):
            return 1
        investigation_ids.update(str(job_id) for job_id in start_data.get("jobIds", []) if job_id)

    if not investigation_ids:
        print("Investigation start returned no job IDs.", file=sys.stderr)
        return 1

    completed = []
    for investigation_id in sorted(investigation_ids):
        investigation = poll_investigation(session, investigation_id)
        if not investigation:
            return 1
        completed.append(investigation)
        print(
            "incident id={incident_id} severity={severity} confidence={confidence} tool call count={tool_calls}".format(
                incident_id=investigation.get("incidentId", "unknown"),
                severity=investigation.get("severity", "uncertain"),
                confidence=investigation.get("confidence", 0),
                tool_calls=investigation.get("toolCallCount", 0),
            )
        )

    briefing_body, _ = request_json("GET", f"{BASE_URL}/briefings/latest?nightDate={night_date}", session=session)
    if briefing_body is None:
        return 1
    briefing = api_data(briefing_body)
    if isinstance(briefing, dict):
        sections = briefing.get("sections", {})
        section_count = len(sections) if isinstance(sections, (dict, list)) else 0
        print(f"Briefing: section count={section_count} status={briefing.get('status', 'unknown')}")
    else:
        print("Briefing: section count=0 status=not_available")

    severity_counts = Counter(item.get("severity", "uncertain") for item in completed)
    total_tool_calls = sum(int(item.get("toolCallCount", 0) or 0) for item in completed)
    print("\nSummary")
    print("total incidents | severity breakdown | total tool calls")
    print(f"{len(incidents)} | {dict(sorted(severity_counts.items()))} | {total_tool_calls}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
