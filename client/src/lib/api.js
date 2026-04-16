import axios from "axios";

// Instantiate the core instance
const api = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_URL || "") + "/api/v1",
  timeout: 30000, // 30s timeout explicitly requested due to heavy agent computation
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach authorization context securely if accessible on client
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("ridgeway_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Automatically peel back ApiResponse wrapper layers or normalize error streams.
api.interceptors.response.use(
  (response) => {
    // Return exclusively the data unwrapped payload
    return response.data;
  },
  (error) => {
    const message =
      error.response?.data?.message || error.message || "An unknown network error occurred";
    // Bubble the clean error string out to hooks seamlessly
    throw new Error(message);
  }
);

/* =========================================
             EXPORTED API CALLS
========================================= */

// Investigations
export const startInvestigation = async (nightDate) => api.post("/investigations", { nightDate });
export const getInvestigation = async (id) => api.get(`/investigations/${id}`);

// Events
export const getEventsForNight = async (nightDate) => api.get(`/events`, { params: { nightDate } });
export const getEventById = async (id) => api.get(`/events/${id}`);
export const applyMayaReview = async (eventId, { decision, override, flagDetails }) => 
  api.post(`/events/${eventId}/review`, { decision, override, flagDetails });

// Incidents
export const getIncidents = async ({ nightDate, status, severity }) => 
  api.get(`/incidents`, { params: { nightDate, status, severity } });
export const getIncidentById = async (id) => api.get(`/incidents/${id}`);
export const getIncidentEvidenceGraph = async (id) => api.get(`/incidents/${id}/evidence-graph`);

// Briefing
export const getLatestBriefing = async (nightDate) => api.get(`/briefings/latest`, { params: { nightDate } });
export const updateBriefingSection = async (briefingId, { sectionName, content }) => 
  api.patch(`/briefings/${briefingId}/sections/${sectionName}`, { content });
export const approveBriefing = async (briefingId) => api.post(`/briefings/${briefingId}/approve`);

// Reviews
export const createReview = async (reviewData) => api.post("/reviews", reviewData);
export const getReviewsForNight = async (date) => api.get("/reviews", { params: { date } });

// Map
export const getSiteMapData = async () => api.get("/map/geometry");
export const getDroneRouteGeometry = async (patrolId) => api.get(`/map/drones/route/${patrolId}`);
export const getEventPins = async (nightDate) => api.get("/map/events", { params: { nightDate } });
export const getDroneStateAtTime = async (patrolId, targetTime) => 
  api.get(`/map/drones/${patrolId}/state`, { params: { time: targetTime } });
export const simulateFollowUpMission = async (flaggedLocations) => 
  api.post("/map/drones/simulate-mission", { locations: flaggedLocations });

export default api;
