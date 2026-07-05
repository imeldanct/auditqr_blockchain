/**
 * AuditQR – shared frontend config
 * For local dev: set API_BASE to "http://localhost:3000" and FRONTEND_BASE to your Outray tunnel.
 */
const API_BASE = "https://auditqr.onrender.com";

// Solana cluster for explorer links.
// local:   "custom"  → uses customUrl below
// devnet:  "devnet"
// mainnet: "mainnet-beta"
const SOLANA_CLUSTER = "devnet";

function solanaExplorerTx(txHash) {
  if (!txHash) return "#";
  if (SOLANA_CLUSTER === "custom") {
    const LOCAL_URL = "http%3A%2F%2Flocalhost%3A8899";
    return "https://explorer.solana.com/tx/" + txHash + "?cluster=custom&customUrl=" + LOCAL_URL;
  }
  return "https://explorer.solana.com/tx/" + txHash + "?cluster=" + SOLANA_CLUSTER;
}

// Frontend base URL — embedded inside QR codes. Must be reachable from the scanning device.
const FRONTEND_BASE = "https://auditqr-blockchain.vercel.app";

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(API_BASE + path, { ...options, headers, signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 401) {
      localStorage.removeItem("auditqr_token");
      window.location.href = "login.html";
      return null;
    }

    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
