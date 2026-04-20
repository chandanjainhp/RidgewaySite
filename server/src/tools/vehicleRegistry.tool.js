const VEHICLE_REGISTRY = {
  category1AuthorizedPreLogged: {
    vehicleId: 'V-09',
    registration: 'CONTRACTOR-FLEET-3',
    contractor: 'Apex Maintenance Ltd',
    contact: 'site-ops@apexmaint.co.uk',
    jobReference: 'JOB-2026-0892',
    expectedLocation: 'Storage Yard B',
    expectedTimeWindow: {
      start: '03:00',
      end: '05:00',
    },
    notes:
      'Regular contractor, valid DBS check, site induction completed 2025-11-14',
  },
  category2KnownFleetNotPreLoggedTonight: {
    vehicleId: 'V-14',
    registration: 'CONTRACTOR-FLEET-3',
    contractor: 'Apex Maintenance Ltd',
    notes: 'Known fleet but no advance notice for tonight',
    confidence: 'medium',
  },
  category3PreviouslySeenUnregistered: {
    vehicleId: 'V-UNKNOWN-PREV-01',
    description: 'dark colored saloon',
    previousAppearances: 3,
    lastSeen: 'Storage Yard B perimeter road',
    contractorAffiliation: 'none',
  },
  category4CompletelyUnknown: {
    vehicleId: 'UNTAGGED-01',
    description: 'no readable registration',
    location: 'Block C loading bay',
    fleetAffiliation: 'none',
    authorization: 'none found',
    previousAppearances: 0,
  },
};

const normalizeVehicleId = (vehicleId) =>
  typeof vehicleId === 'string' ? vehicleId.trim().toUpperCase() : '';

const normalizeLocation = (locationName) =>
  typeof locationName === 'string' ? locationName.trim().toLowerCase() : '';

const buildContractorDetails = (entry) => {
  if (!entry) return null;

  return {
    registration: entry.registration || null,
    contractor: entry.contractor || null,
    contact: entry.contact || null,
    jobReference: entry.jobReference || null,
    expectedLocation: entry.expectedLocation || null,
    expectedTimeWindow: entry.expectedTimeWindow || null,
    notes: entry.notes || null,
  };
};

export async function queryVehicleRegistry({
  vehicleId,
  locationName,
  timeRange,
} = {}) {
  console.log('[VehicleRegistry] Queried for:', vehicleId || locationName);

  const normalizedVehicleId = normalizeVehicleId(vehicleId);
  const normalizedLocation = normalizeLocation(locationName);

  if (normalizedVehicleId === 'V-09') {
    return {
      found: true,
      vehicleId: 'V-09',
      confidence: 'high',
      contractorDetails: buildContractorDetails(
        VEHICLE_REGISTRY.category1AuthorizedPreLogged
      ),
      authorization: 'authorized',
      previousAppearances: 0,
      gaps: [
        'No live gate-camera confirmation included in query context',
      ],
      suggestedNextStep:
        'Allow access and verify observed route against JOB-2026-0892 and Storage Yard B task scope.',
    };
  }

  if (
    normalizedVehicleId === 'UNTAGGED-01' ||
    (!normalizedVehicleId && normalizedLocation === 'block c') ||
    (!normalizedVehicleId && normalizedLocation === 'block c loading bay')
  ) {
    return {
      found: false,
      vehicleId: normalizedVehicleId || 'UNTAGGED-01',
      confidence: 'low',
      contractorDetails: null,
      authorization: 'unauthorized',
      previousAppearances:
        VEHICLE_REGISTRY.category4CompletelyUnknown.previousAppearances,
      gaps: [
        'No readable registration captured',
        'No fleet or contractor affiliation found',
        'No authorization record found for Block C loading bay presence',
      ],
      suggestedNextStep:
        'Escalate immediately to site security and preserve CCTV/ANPR evidence for identification.',
    };
  }

  if (normalizedVehicleId === 'V-14') {
    return {
      found: true,
      vehicleId: 'V-14',
      confidence: 'medium',
      contractorDetails: buildContractorDetails(
        VEHICLE_REGISTRY.category2KnownFleetNotPreLoggedTonight
      ),
      authorization: 'unknown',
      previousAppearances: 0,
      gaps: [
        'Known fleet, but no pre-log entry for tonight',
        'No confirmed work order for current timestamp/location',
      ],
      suggestedNextStep:
        'Call contractor dispatch to validate whether this unscheduled movement is legitimate before granting full access.',
    };
  }

  if (normalizedVehicleId === 'V-UNKNOWN-PREV-01') {
    return {
      found: true,
      vehicleId: 'V-UNKNOWN-PREV-01',
      confidence: 'medium',
      contractorDetails: null,
      authorization: 'unknown',
      previousAppearances:
        VEHICLE_REGISTRY.category3PreviouslySeenUnregistered.previousAppearances,
      gaps: [
        'Vehicle identity could not be definitively confirmed',
        'No contractor affiliation found in records',
      ],
      suggestedNextStep:
        'Cross-reference prior sightings and request clearer identifiers from camera feeds before making an authorization decision.',
    };
  }

  const unresolvedTimeRange =
    timeRange && (timeRange.start || timeRange.end)
      ? ` between ${timeRange.start || 'unknown'} and ${timeRange.end || 'unknown'}`
      : '';

  return {
    found: false,
    vehicleId: normalizedVehicleId || 'UNSPECIFIED',
    confidence: 'medium',
    contractorDetails: null,
    authorization: 'unknown',
    previousAppearances: 0,
    gaps: [
      'Vehicle could not be definitively identified',
      'No positive contractor match found',
      `No verified authorization record${unresolvedTimeRange}`,
    ],
    suggestedNextStep:
      'Collect better plate/vehicle evidence, confirm gate logs, and re-run registry lookup with stronger identifiers.',
  };
}
