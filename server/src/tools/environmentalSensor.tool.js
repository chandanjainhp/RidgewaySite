const ENVIRONMENTAL_RECORDS = {
  "GATE 3": {
    conditions: {
      observedAt: "02:14",
      windSpeedKmh: 28,
      windGustKmh: 34,
      windDirection: "north-northwest",
      temperatureC: 7,
      humidityPercent: 82,
      visibility: "good",
    },
    sensorHealth: {
      sensorId: "FENCE-SENSOR-G3-04",
      type: "vibration and tension sensor",
      lastCalibration: "2026-01-22",
      knownIssue:
        "Documented sensitivity in winds above 25 km/h, particularly from north-northwest direction",
      falsePositiveRatePerMonth: 2.3,
      lastFalsePositive: "2026-03-28 under similar conditions",
      batteryLevelPercent: 94,
    },
    environmentalExplanation:
      "Sustained wind and higher gusts from north-northwest can create fence vibration patterns consistent with non-intrusion triggers.",
    sensorExplanation:
      "This sensor has a known wind-related sensitivity above 25 km/h, matching current conditions and prior false-positive history.",
    confidence: "high",
    gaps: [],
    suggestedNextStep:
      "Cross-check CCTV at Gate 3 and review raw vibration waveform to distinguish wind oscillation from tampering.",
  },
  CANTEEN: {
    conditions: {
      observedAt: "04:30",
      windSpeedKmh: 12,
      temperatureC: 6,
      notes:
        "Temperature dropped 3 degrees between 03:00 and 04:30, causing food waste odors to intensify",
    },
    sensorHealth: {
      sensorId: "MOTION-SENSOR-CAN-01",
      type: "passive infrared",
      coverageArea: "external waste compound adjacent to fence",
      wildlifeIntrusionFrequencyPerWeek: 1.8,
      lastWildlifeTriggeredEvent: "2026-04-11 at 03:47",
      notes:
        "Foxes from adjacent green belt regularly trigger this sensor in cold temperatures",
    },
    environmentalExplanation:
      "Cooling temperatures and intensified food-waste odors can increase wildlife activity near the canteen perimeter.",
    sensorExplanation:
      "No hardware fault is documented, but this sensor has repeated wildlife-trigger patterns under similar cold conditions.",
    confidence: "high",
    gaps: [],
    suggestedNextStep:
      "Review thermal footage around the external waste compound and confirm if movement signature matches small wildlife.",
  },
  "ADMIN BLOCK": {
    conditions: {
      observedAt: "03:15",
      notes:
        "No significant weather anomaly recorded for this location/time in the current dataset",
    },
    sensorHealth: {
      sensorId: "LIGHT-TIMER-ADM-03",
      knownFault: "Timer relay malfunction logged 2026-04-10 by facilities team",
      faultDescription:
        "Timer cycles incorrectly causing lights to activate outside schedule",
      workOrder: "WO-2026-0318 pending repair",
      faultRecurrenceRate: "3 to 4 times per week",
    },
    environmentalExplanation: null,
    sensorExplanation:
      "A known recurring timer relay malfunction provides a direct non-security explanation for unexpected light activation events.",
    confidence: "high",
    gaps: [
      "No detailed weather telemetry attached to Admin Block at 03:15 in source dataset",
    ],
    suggestedNextStep:
      "Validate against facilities maintenance logs and prioritize closure of work order WO-2026-0318.",
  },
  "BLOCK C": {
    conditions: {
      observedAt: "02:50",
      windSpeedKmh: 14,
      temperatureC: 7,
    },
    sensorHealth: {
      sensorId: "MOTION-SENSOR-BLC-02",
      type: "vehicle detection radar",
      falsePositiveRatePerMonth: 0.1,
      knownFaults: "none",
      lastCalibration: "2026-04-01",
    },
    environmentalExplanation: null,
    sensorExplanation:
      "Sensor shows low false-positive history, recent calibration, and no known faults, so a genuine trigger remains plausible.",
    confidence: "medium",
    gaps: [
      "No corroborating secondary sensor evidence included in this tool response",
    ],
    suggestedNextStep:
      "Correlate Block C trigger with nearby camera, vehicle access logs, and adjacent sensor events.",
  },
};

const LOCATION_ALIASES = {
  "GATE 3": ["gate 3", "gate3", "g3", "gate-3"],
  CANTEEN: ["canteen", "waste compound", "compound"],
  "ADMIN BLOCK": ["admin block", "admin", "administration"],
  "BLOCK C": ["block c", "blockc", "blk c", "c block"],
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreAliasMatch(input, alias) {
  if (!input || !alias) return 0;
  if (input === alias) return 100;
  if (input.includes(alias) || alias.includes(input)) return 80;

  const inputTokens = new Set(input.split(" "));
  const aliasTokens = alias.split(" ");
  let overlap = 0;

  for (const token of aliasTokens) {
    if (inputTokens.has(token)) overlap += 1;
  }

  return overlap * 10;
}

function resolveClosestLocation(locationName) {
  const input = normalize(locationName);

  if (!input) return "GATE 3";

  let bestLocation = "GATE 3";
  let bestScore = -1;

  for (const [location, aliases] of Object.entries(LOCATION_ALIASES)) {
    const candidates = [normalize(location), ...aliases.map(normalize)];
    for (const candidate of candidates) {
      const score = scoreAliasMatch(input, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestLocation = location;
      }
    }
  }

  return bestLocation;
}

export async function queryEnvironmentalData(locationName, timeRange) {
  console.log('[EnvSensor] Queried:', locationName, timeRange);

  const resolvedLocation = resolveClosestLocation(locationName);
  const record = ENVIRONMENTAL_RECORDS[resolvedLocation];

  return {
    locationName: resolvedLocation,
    conditions: record.conditions,
    sensorHealth: record.sensorHealth,
    environmentalExplanation: record.environmentalExplanation,
    sensorExplanation: record.sensorExplanation,
    confidence: record.confidence,
    gaps: record.gaps,
    suggestedNextStep: record.suggestedNextStep,
  };
}
