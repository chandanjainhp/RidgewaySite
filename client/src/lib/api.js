import axios from "axios";

const getApiBaseUrl = () => {
  // In the browser, always use same-origin API paths so Next rewrites/proxy handle routing.
  if (typeof window !== "undefined") {
    return "/api/v1";
  }

  const upstream = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${upstream}/api/v1`;
};

const API_BASE_URL = getApiBaseUrl();
const SHOULD_LOG_API =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_DEBUG_API === "1";

/* =========================================
     TOKEN HELPERS & ERROR TYPES
========================================= */

// Token management helpers
export const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ridgeway_token");
};

export const setStoredToken = (token) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("ridgeway_token", token);
  }
};

export const clearStoredToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("ridgeway_token");
    localStorage.removeItem("ridgeway_refresh_token");
  }
};

const clearClientAuthSession = () => {
  clearStoredToken();
  if (typeof window !== "undefined") {
    document.cookie = "ridgeway_auth=; path=/; max-age=0; SameSite=Lax";
  }
};

// Error type constants for client-side error handling
export const ERROR_TYPES = {
  NETWORK_ERROR: "NETWORK_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  SERVER_ERROR: "SERVER_ERROR",
};

/* =========================================
     AXIOS INSTANCE & INTERCEPTORS
========================================= */

// Instantiate the core instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s timeout explicitly requested due to heavy agent computation
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

if (SHOULD_LOG_API && typeof window !== "undefined") {
  console.info("[API] baseURL", API_BASE_URL || "(same-origin)/api/v1");
}

// Token refresh state management
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Attach authorization context securely if accessible on client
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getStoredToken();
    const isRefreshRequest = String(config.url || "").includes("/auth/refresh-token");

    if (token && !isRefreshRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (SHOULD_LOG_API) {
      const method = (config.method || "GET").toUpperCase();
      console.info("[API] request", method, config.baseURL + config.url);
    }
  }
  return config;
});

// Automatically peel back ApiResponse wrapper layers or normalize error streams.
api.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === "object" &&
      "data" in response.data
    ) {
      return response.data.data;
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    const statusCode = error.response?.status;
    const method = (originalRequest?.method || "UNKNOWN").toUpperCase();
    const url = `${originalRequest?.baseURL || ""}${originalRequest?.url || ""}` || "(unknown-url)";
    const isNetworkFailure = !error.response;
    const message =
      error.response?.data?.message ||
      (isNetworkFailure
        ? `Network error while contacting API at ${url}. Check server availability and client API proxy configuration.`
        : error.message) ||
      "An unknown error occurred";
    const errors =
      error.response?.data?.errors ||
      (Array.isArray(error.response?.data?.data) ? error.response.data.data : []);

    if (SHOULD_LOG_API && typeof window !== "undefined") {
      console.error(`[API] error ${method} ${url} ${statusCode ?? "NO_STATUS"}: ${message}`, {
        method,
        url,
        statusCode,
        message,
        code: error?.code,
        name: error?.name,
        isAxiosError: Boolean(error?.isAxiosError),
        details: errors,
      });
    }

    // Determine error type
    let errorType = ERROR_TYPES.NETWORK_ERROR;
    if (statusCode === 401) errorType = ERROR_TYPES.UNAUTHORIZED;
    else if (statusCode === 403) errorType = ERROR_TYPES.FORBIDDEN;
    else if (statusCode === 404) errorType = ERROR_TYPES.NOT_FOUND;
    else if (statusCode === 400 && Array.isArray(errors) && errors.length > 0)
      errorType = ERROR_TYPES.VALIDATION_ERROR;
    else if (statusCode >= 500) errorType = ERROR_TYPES.SERVER_ERROR;

    // Check if response has 'data' property (ApiResponse wrapper)
    const responseData = error.response?.data?.data || error.response?.data;

    // Second 401 means the refresh itself failed — clear session and redirect.
    if (statusCode === 401 && originalRequest._retry) {
      clearClientAuthSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      const expiredError = new Error("Session expired — please log in again");
      expiredError.type = ERROR_TYPES.UNAUTHORIZED;
      expiredError.statusCode = 401;
      throw expiredError;
    }

    // Attempt token refresh on 401 (only if not already retrying)
    if (statusCode === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            const enrichedError = new Error(message);
            enrichedError.type = errorType;
            enrichedError.statusCode = statusCode;
            enrichedError.errors = errors;
            throw enrichedError;
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("ridgeway_refresh_token");
      if (!refreshToken) {
        processQueue(new Error("No refresh token available"), null);
        isRefreshing = false;
        clearClientAuthSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        const enrichedError = new Error("Session expired — please log in again");
        enrichedError.type = ERROR_TYPES.UNAUTHORIZED;
        enrichedError.statusCode = 401;
        throw enrichedError;
      }

      try {
        const response = await api.post("/auth/refresh-token", { refreshToken });
        const newToken = response.accessToken || response.data?.accessToken;
        const newRefreshToken = response.refreshToken || response.data?.refreshToken;

        if (!newToken) {
          throw new Error("No token in refresh response");
        }

        setStoredToken(newToken);
        if (newRefreshToken) {
          localStorage.setItem("ridgeway_refresh_token", newRefreshToken);
        }
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearClientAuthSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        const enrichedError = new Error("Failed to refresh session");
        enrichedError.type = ERROR_TYPES.UNAUTHORIZED;
        enrichedError.statusCode = 401;
        throw enrichedError;
      } finally {
        isRefreshing = false;
      }
    }

    // Attach error type information and throw enriched error
    const enrichedError = new Error(message);
    enrichedError.type = errorType;
    enrichedError.statusCode = statusCode;
    enrichedError.errors = errors;
    throw enrichedError;
  }
);

/* =========================================
             EXPORTED API CALLS
========================================= */

// Authentication
export const loginUser = async (email, password) =>
  api.post("/auth/login", { email, password });

export const registerUser = async ({ email, username, password }) =>
  api.post("/auth/register", { email, username, password });

export const logoutUser = async () => {
  try {
    await api.post("/auth/logout");
  } finally {
    clearStoredToken();
  }
};

export const refreshAccessToken = async (refreshToken) =>
  api.post("/auth/refresh-token", { refreshToken });

// Investigations
export const startInvestigation = async (nightDate) =>
  api.post("/investigations/start", { nightDate });
export const getInvestigation = async (id) => api.get(`/investigations/${id}`);

// Events
export const getEventsForNight = async (nightDate) => api.get(`/events`, { params: { nightDate } });
export const getEventById = async (id) => api.get(`/events/${id}`);
export const applyMayaReview = async (eventId, reviewData) => {
  const payload = {
    decision: reviewData?.decision,
    overrideSeverity: reviewData?.overrideSeverity || reviewData?.override?.newSeverity,
    note: reviewData?.note || reviewData?.override?.reason || reviewData?.flagDetails?.note || "",
  };

  return api.patch(`/events/${eventId}/review`, payload);
};

// Incidents
export const getIncidents = async ({ nightDate, status, severity }) =>
  api.get(`/incidents`, { params: { nightDate, status, severity } });
export const getIncidentById = async (id) => api.get(`/incidents/${id}`);
export const getIncidentEvidenceGraph = async (id) => api.get(`/incidents/${id}/graph`);

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
