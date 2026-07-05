import axios from "axios";
import { toast } from "sonner";

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

    // Attach org ID for server-side logging (not used for security)
    try {
      const { useAuthStore } = require("@/store/authStore");
      const orgId = useAuthStore.getState().orgId;
      if (orgId) config.headers["X-Org-ID"] = orgId;
    } catch (_) {}

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
      const isClientError = statusCode >= 400 && statusCode < 500;
      const log = isClientError ? console.warn : console.error;
      log(`[API] ${method} ${url} ${statusCode ?? "NO_STATUS"}: ${message}`, {
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

    const isAdminGateAuthError =
      statusCode === 401 &&
      message.toLowerCase().includes("admin settings session required");

    if (isAdminGateAuthError && typeof window !== "undefined") {
      const from = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/settings-access?from=${from}`;
      const gateError = new Error("Admin settings access required");
      gateError.type = ERROR_TYPES.UNAUTHORIZED;
      gateError.statusCode = 401;
      throw gateError;
    }

    // 403 handling: only suspended orgs force a redirect. For regular forbidden
    // responses, surface a toast and let the calling code decide what to do —
    // the /forbidden page is reached only via middleware route protection.
    if (statusCode === 403 && typeof window !== "undefined") {
      const code = error.response?.data?.code;
      if (code === 'ORG_SUSPENDED') {
        window.location.href = "/suspended";
      } else {
        const action = error.config?.method?.toUpperCase() || 'request';
        const path = error.config?.url || 'resource';
        toast.error(`You don't have permission for that ${action} on ${path}`);
      }
    }

    // Network error: toast + retry once after 5s
    if (isNetworkFailure && !originalRequest._retried && typeof window !== "undefined") {
      originalRequest._retried = true;
      toast.error("Connection lost. Trying to reconnect…");
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          api.request(originalRequest).then(resolve).catch(reject);
        }, 5000);
      });
    }

    // Check if response has 'data' property (ApiResponse wrapper)
    const responseData = error.response?.data?.data || error.response?.data;

    // Second 401 means the refresh itself failed — clear session and redirect.
    if (statusCode === 401 && originalRequest._retry) {
      clearClientAuthSession();
      if (typeof window !== "undefined") {
        const isSessionEnded = message.toLowerCase().includes('invalidated') || message.toLowerCase().includes('expired');
        window.location.href = `/login?reason=${isSessionEnded ? 'session_ended' : 'expired'}`;
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
      if (!refreshToken || message.toLowerCase().includes('invalid access token')) {
        // If the token itself is invalid (not just expired), don't try to refresh
        processQueue(new Error("No refresh token available or token invalid"), null);
        isRefreshing = false;
        clearClientAuthSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login?reason=session_ended";
        }
        const enrichedError = new Error("Session ended — please log in again");
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

export const getCurrentUser = async () => api.get("/auth/current-user");

export const changePassword = async ({ currentPassword, newPassword }) =>
  api.post("/auth/change-password", { currentPassword, newPassword });

export const registerUser = async ({ email, username, password }) =>
  api.post("/auth/register", { email, username, password });

export const verifyEmail = async (otp) => api.post("/auth/verify-email", { otp });

export const forgotPassword = async (email) => api.post("/auth/forgot-password", { email });

export const resetPassword = async (otp, newPassword) => api.post("/auth/reset-password", { otp, newPassword });

export const resendEmailVerification = async () => api.post("/auth/resend-email-verification");
export const loginAdminGate = async (email, password) => api.post("/auth/admin-gate/login", { email, password });
export const getAdminGateStatus = async () => api.get("/auth/admin-gate/status");
export const logoutAdminGate = async () => api.post("/auth/admin-gate/logout");

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

// Auth / Invite
export const getInviteDetails = (token) => api.get(`/auth/invite/${token}`);
export const acceptInvite = (token, password) => api.post("/auth/accept-invite", { token, password });

// Admin — Orgs
export const listAdminOrgs = (params) => api.get("/admin/orgs", { params });
export const createAdminOrg = (data) => api.post("/admin/orgs", data);
export const updateAdminOrgStatus = (orgId, status) => api.patch(`/admin/orgs/${orgId}/status`, { status });
export const getAdminOrg = (orgId) => api.get(`/admin/orgs/${orgId}`);
export const updateAdminOrg = (orgId, data) => api.patch(`/admin/orgs/${orgId}`, data);
export const updateAdminOrgConfig = (orgId, data) => api.patch(`/admin/orgs/${orgId}/config`, data);
export const inviteToOrg = (orgId, data) => api.post(`/admin/orgs/${orgId}/invite`, data);
export const resendOrgInvite = (orgId, userId) => api.post(`/admin/orgs/${orgId}/resend-invite/${userId}`);

// Admin — Users
export const listAdminUsers = (params) => api.get("/admin/users", { params });
export const updateUserRole = (userId, role) => api.patch(`/admin/users/${userId}/role`, { role });
export const updateUserStatus = (userId, isActive) => api.patch(`/admin/users/${userId}/status`, { isActive });
export const deleteUserSessions = (userId) => api.post(`/admin/users/${userId}/force-logout`);

// Admin — API Keys
export const listAdminApiKeys = (params) => api.get("/admin/apikeys", { params });
export const revokeAdminApiKey = (keyId) => api.delete(`/admin/apikeys/${keyId}/revoke`);

// Admin — Jobs
export const getAdminJobStats = () => api.get("/admin/jobs/stats");
export const listFailedJobs = () => api.get("/admin/jobs/failed");
export const retryAdminJob = (queueName, jobId) => api.post(`/admin/jobs/${queueName}/${jobId}/retry`);
export const deleteAdminJob = (queueName, jobId) => api.delete(`/admin/jobs/${queueName}/${jobId}`);

// Admin — Audit
export const getAuditLog = (params) => api.get("/admin/audit", { params });
export const exportAuditLog = (params) =>
  api.get("/admin/audit", { params: { ...params, format: "csv" }, responseType: "blob" });

// Org Settings
export const getOrgMe = () => api.get("/org/me");
export const updateOrgConfig = (data) => api.patch("/org/me/config", data);
export const completeSetup = () => api.post("/org/setup/complete");
export const listOrgUsers = () => api.get("/org/users");
export const inviteOrgUser = (data) => api.post("/org/users/invite", data);
export const deactivateOrgUser = (userId) => api.patch(`/admin/users/${userId}/status`, { isActive: false });
export const resendOrgUserInvite = (userId) => api.post(`/org/users/${userId}/resend-invite`);

// Org API Keys
export const listOrgApiKeys = () => api.get("/org/api-keys");
export const createOrgApiKey = (data) => api.post("/org/api-keys", data);
export const revokeOrgApiKey = (keyId) => api.delete(`/org/api-keys/${keyId}`);
export const getIngestionStatus = () => api.get("/org/ingestion-status");

// Org Webhooks
export const getOrgWebhooks = () => api.get("/org/webhooks");
export const getWebhookDeliveries = (params) => api.get("/org/webhooks/deliveries", { params });
export const testWebhook = () => api.post("/org/webhooks/test");
export const rotateWebhookSecret = () => api.post("/org/webhooks/rotate-secret");
export const retryWebhookDelivery = (id) => api.post(`/org/webhooks/deliveries/${id}/retry`);

// MCP
export const getMcpHealth = () => api.get("/mcp/health");
export const getMcpActivity = (params) => api.get("/org/mcp/activity", { params });

// Org RAG Documents
export const getOrgDocuments = () => api.get("/org/documents");
export const uploadOrgDocument = (formData, onProgress) =>
  api.post("/org/documents/upload", formData, {
    onUploadProgress: onProgress,
  });
export const deleteOrgDocument = (docId) => api.delete(`/org/documents/${docId}`);
export const approveOrgDocument = (docId) => api.post(`/org/documents/${docId}/approve`);
export const rejectOrgDocument = (docId, reason) =>
  api.post(`/org/documents/${docId}/reject`, { reason });

export default api;
