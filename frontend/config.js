/**
 * AuditQR – shared frontend config
 * For local dev: set API_BASE to "http://localhost:3000" and FRONTEND_BASE to your Outray tunnel.
 */
const API_BASE = "https://api.auditqr.site";

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
const FRONTEND_BASE = "https://auditqr.site";

/**
 * Request GPS location from the browser, then reverse-geocode to a human-readable
 * area name (e.g. "Ikeja, Lagos, Nigeria") via OpenStreetMap Nominatim.
 * Falls back to raw "lat,lng" if geocoding fails; returns null if location is denied.
 */
function getGpsLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(
            "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lng + "&format=json",
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const a = data.address || {};
          const parts = [
            a.suburb || a.neighbourhood || a.village || a.town,
            a.city || a.county,
            a.state,
            a.country,
          ].filter(Boolean);
          resolve(parts.length ? parts.join(", ") : lat.toFixed(6) + "," + lng.toFixed(6));
        } catch (_) {
          resolve(lat.toFixed(6) + "," + lng.toFixed(6));
        }
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

// On bfcache restore (browser back button), re-check auth for protected pages.
// bfcache bypasses normal JS execution, so without this the page stays visible
// even after logout or account deletion.
(function () {
  var PROTECTED = [
    "dashboard.html", "products_list.html", "account_settings.html",
    "scan_events.html", "create_product.html", "qr_ready.html",
    "generate.html", "confirm_product.html",
  ];
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && !localStorage.getItem("auditqr_token")) {
      var page = window.location.pathname.split("/").pop();
      if (PROTECTED.indexOf(page) !== -1) {
        window.location.replace("login.html");
      }
    }
  });
})();

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
