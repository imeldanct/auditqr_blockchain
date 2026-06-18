/**
 * AuditQR – shared frontend config
 * Single source of truth for the API base URL.
 */
// const API_BASE = "http://localhost:3000";
const API_BASE = "https://tall-turtle.outray.app";

/**
 * Drop-in fetch wrapper.
 * - Injects Authorization header automatically.
 * - Redirects to login.html on 401 (expired / missing token).
 */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("auditqr_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("auditqr_token");
    window.location.href = "login.html";
    return null; // never resolves
  }

  return res;
}
