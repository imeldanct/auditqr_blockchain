/**
 * AuditQR – shared frontend config
 * Update both URLs when Outray tunnels change between sessions.
 */
// const API_BASE = "http://localhost:3000";
const API_BASE = "https://tall-turtle.outray.app";

// Frontend tunnel URL — used to embed real URLs inside QR codes.
// Must be reachable from the scanning device (phone). Use the Outray tunnel, not localhost.
// const FRONTEND_BASE = "https://introverted-copper.outray.app";
const FRONTEND_BASE = "https://introverted-copper.outray.app/auditqr_blockchain/frontend";

// const FRONTEND_BASE = "http://127.0.0.1:5500";

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
