import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { SEVERITY_CONFIG } from '@/config/constants'; // Access to baseline keys

// Base configurations mapping global severities array explicitly
const allSeverities = Object.keys(SEVERITY_CONFIG);

export const useMapStore = create(
  devtools(
    (set, get) => ({
      // State
      siteMapData: null,
      eventPins: [],
      droneRoute: null,
      droneCurrentPosition: null,
      timelinePosition: 0,
      timelineTime: null,
      selectedPinId: null,
      selectedIncidentId: null,
      activeSeverityFilters: [...allSeverities],
      isMapLoaded: false,
      followUpLocations: [],

      // Actions
      setSiteMapData: (data) => set({ siteMapData: data, isMapLoaded: true }, false, "setSiteMapData"),
      
      setEventPins: (pins) => set({ eventPins: pins }, false, "setEventPins"),
      
      updatePinSeverity: (eventId, severity) =>
        set((state) => ({
          eventPins: state.eventPins.map((pin) =>
            pin.incidentId === eventId || pin.id === eventId
              ? { ...pin, severity }
              : pin
          ),
        }), false, "updatePinSeverity"),

      setDroneRoute: (route) => set({ droneRoute: route }, false, "setDroneRoute"),
      
      setDronePosition: (positionData) => set({ droneCurrentPosition: positionData }, false, "setDronePosition"),
      
      setTimelinePosition: (percent) => set({ timelinePosition: percent }, false, "setTimelinePosition"),
      
      setTimelineTime: (timeString) => set({ timelineTime: timeString }, false, "setTimelineTime"),

      selectPin: (pinId) => {
        const pin = get().eventPins.find((p) => p.id === pinId);
        set({
          selectedPinId: pinId,
          selectedIncidentId: pin ? (pin.incidentId || pinId) : null,
        }, false, "selectPin");
        
        // Note: Cross store communication to ReviewStore is typically handled in components or hooks
        // rather than blindly coupling stores, but if required dynamically, it can be bridged where this action is hooked.
      },

      deselectPin: () => set({ selectedPinId: null, selectedIncidentId: null }, false, "deselectPin"),

      toggleSeverityFilter: (severity) =>
        set((state) => {
          const isActive = state.activeSeverityFilters.includes(severity);
          if (isActive) {
             return { activeSeverityFilters: state.activeSeverityFilters.filter((s) => s !== severity) };
          }
          return { activeSeverityFilters: [...state.activeSeverityFilters, severity] };
        }, false, "toggleSeverityFilter"),

      setAllFiltersActive: () => set({ activeSeverityFilters: [...allSeverities] }, false, "setAllFiltersActive"),

      addFollowUpLocation: (location) =>
        set((state) => ({
          followUpLocations: [...state.followUpLocations, location],
        }), false, "addFollowUpLocation"),

      removeFollowUpLocation: (locationName) =>
        set((state) => ({
          followUpLocations: state.followUpLocations.filter((loc) => loc.name !== locationName),
        }), false, "removeFollowUpLocation"),

      clearFollowUpLocations: () => set({ followUpLocations: [] }, false, "clearFollowUpLocations"),

      // Computed selectors internally wrapped
      getVisiblePins: () => {
        const { eventPins, activeSeverityFilters } = get();
        return eventPins.filter((pin) => {
          const pinSeverity = pin.severity || 'unknown';
          return activeSeverityFilters.includes(pinSeverity);
        });
      },

      getSelectedPin: () => {
        const { eventPins, selectedPinId } = get();
        return eventPins.find((p) => p.id === selectedPinId) || null;
      },
      
    }),
    { name: "MapStore" }
  )
);
