const EMPLOYEE_RECORDS = {
  'BDG-7741': {
    employeeId: 'E-112',
    name: 'Arjun Mehra',
    badgeId: 'BDG-7741',
    role: 'Night maintenance crew',
    shift: {
      start: '22:00',
      end: '06:00',
    },
    usualEntryGate: 'Gate 5',
    authorizationLevel: ['A', 'B', 'C', 'maintenance areas'],
    recentChanges: 'none',
    accessHistory: {
      successfulEntries: 847,
      priorFailedAttempts: 2,
      failedAttemptReason: 'badge reader faults',
    },
    notes: 'reliable employee, 6 years on site',
  },
};

const INFRASTRUCTURE_LOG = {
  gate5: {
    gateId: 'Gate 5',
    status: 'offline',
    offlineFrom: '22:30',
    expectedOnlineAt: '06:00',
    reason: 'scheduled maintenance',
    maintenanceTeam: 'Ridgeway Facilities',
    workOrder: 'WO-2026-0341',
  },
  ap7: {
    gateId: 'AP7',
    status: 'operational',
    knownFaults: 'none',
    badgeReaderLastCalibrated: '2026-03-15',
  },
};

const normalizeBadgeId = (badgeId) =>
  typeof badgeId === 'string' ? badgeId.trim().toUpperCase() : '';

const normalizeGateId = (gateId) =>
  typeof gateId === 'string' ? gateId.trim().toUpperCase() : '';

const buildEmployeeDetails = (employee) => {
  if (!employee) return null;

  return {
    employeeId: employee.employeeId,
    name: employee.name,
    badgeId: employee.badgeId,
    role: employee.role,
    shift: employee.shift,
    usualEntryGate: employee.usualEntryGate,
    authorizationLevel: employee.authorizationLevel,
    recentChanges: employee.recentChanges,
    accessHistory: employee.accessHistory,
    notes: employee.notes,
  };
};

export async function queryAccessControl({ badgeId, gateId, timeRange } = {}) {
  console.log('[AccessControl] Queried:', badgeId, 'at', gateId);

  const normalizedBadgeId = normalizeBadgeId(badgeId);
  const normalizedGateId = normalizeGateId(gateId);

  const employee = EMPLOYEE_RECORDS[normalizedBadgeId] || null;

  if (!employee) {
    return {
      employeeFound: false,
      employeeDetails: null,
      isAuthorizedForGate: false,
      usualGate: null,
      infrastructureContext:
        'No matching employee record found for this badge in site HR/badge systems.',
      failureExplanation: null,
      confidence: 'low',
      gaps: [
        'Badge ID does not map to an internal employee record',
        'Contractor access records were not included in this system query',
      ],
      suggestedNextStep:
        'Check contractor badge registry separately and verify temporary access passes for the same time window.',
    };
  }

  if (normalizedBadgeId === 'BDG-7741' && normalizedGateId === 'AP7') {
    const timeHint =
      timeRange && (timeRange.start || timeRange.end)
        ? ` Query window: ${timeRange.start || 'unknown'} to ${timeRange.end || 'unknown'}.`
        : '';

    return {
      employeeFound: true,
      employeeDetails: buildEmployeeDetails(employee),
      isAuthorizedForGate: true,
      usualGate: employee.usualEntryGate,
      infrastructureContext:
        'Gate 5 was offline from 22:30 to 06:00 for scheduled maintenance under WO-2026-0341. AP7 remained operational all night with no known faults.' +
        timeHint,
      failureExplanation:
        'Employee is authorized, and attempts are consistent with using an alternate gate during Gate 5 maintenance redirect.',
      confidence: 'high',
      gaps: [
        'Exact signage/redirect instructions shown to staff were not included in this query',
      ],
      suggestedNextStep:
        'Classify as harmless wrong-gate behavior due to maintenance redirect and annotate incident with WO-2026-0341 context.',
    };
  }

  return {
    employeeFound: true,
    employeeDetails: buildEmployeeDetails(employee),
    isAuthorizedForGate: false,
    usualGate: employee.usualEntryGate,
    infrastructureContext:
      'Gate 5 was offline from 22:30 to 06:00 for WO-2026-0341; AP7 was operational and calibrated on 2026-03-15.',
    failureExplanation:
      'Employee is known, but this specific badge/gate combination is not confirmed by this simulation branch.',
    confidence: 'medium',
    gaps: [
      'No explicit gate permission matrix for the provided gateId in this query',
      'No per-attempt reader diagnostics included',
    ],
    suggestedNextStep:
      'Correlate raw badge reader telemetry for this gate and confirm gate-level authorization policy for the shift window.',
  };
}
