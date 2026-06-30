/**
 * AuditQR – shared frontend config
 * Update both URLs when Outray tunnels change between sessions.
 */
// const API_BASE = "http://localhost:3000";
const API_BASE = "https://cautious-port.outray.app";

// Solana cluster for explorer links.
// local:   "custom"  → uses customUrl below
// devnet:  "devnet"
// mainnet: "mainnet-beta"
const SOLANA_CLUSTER = "custom";
const SOLANA_LOCAL_URL = "http%3A%2F%2Flocalhost%3A8899"; // URL-encoded localhost:8899

function solanaExplorerTx(txHash) {
  if (!txHash) return "#";
  if (SOLANA_CLUSTER === "custom") {
    return "https://explorer.solana.com/tx/" + txHash + "?cluster=custom&customUrl=" + SOLANA_LOCAL_URL;
  }
  return "https://explorer.solana.com/tx/" + txHash + "?cluster=" + SOLANA_CLUSTER;
}

// Frontend tunnel URL — used to embed real URLs inside QR codes.
// Must be reachable from the scanning device (phone). Use the Outray tunnel, not localhost.
// const FRONTEND_BASE = "https://introverted-copper.outray.app";
const FRONTEND_BASE = "https://ambitious-orchard.outray.app/auditqr_blockchain/frontend";

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
