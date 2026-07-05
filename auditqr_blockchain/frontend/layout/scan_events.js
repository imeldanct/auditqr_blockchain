function toggleSidebar() {
  document.getElementById("sidebarMenu").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebarMenu").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}
function logout() {
  localStorage.removeItem("auditqr_token");
  window.location.href = "login.html";
}

var statusMap = {
  pending: {
    label: "Pending",
    badge: "text-muted bg-muted/10 border-muted/30",
    accentColor: "rgba(119,134,127,0.35)",
    dotColor: "#77867F",
  },
  transit: {
    label: "In Transit",
    badge: "text-blue bg-blue/10 border-blue/30",
    accentColor: "#3185FC",
    dotColor: "#3185FC",
  },
  delivered: {
    label: "Delivered",
    badge: "text-blue bg-blue/10 border-blue/30",
    accentColor: "#3185FC",
    dotColor: "#3185FC",
  },
};

var _allProducts = [];
var _activeFilter = "all";

function deriveParentStage(stages) {
  if (stages.every(function (s) { return s === "pending"; })) return "pending";
  if (stages.every(function (s) { return s === "delivered"; })) return "delivered";
  return "transit";
}

function setStatusFilter(btn) {
  _activeFilter = btn.dataset.status;
  document.querySelectorAll(".status-pill").forEach(function (p) {
    p.classList.remove("border-blue", "bg-blue/10", "text-blue");
    p.classList.add("border-outline-variant", "text-muted");
  });
  btn.classList.add("border-blue", "bg-blue/10", "text-blue");
  btn.classList.remove("border-outline-variant", "text-muted");
  renderProducts();
}

function renderProducts() {
  var tbody = document.getElementById("scan-events-tbody");
  var filtered = _activeFilter === "all"
    ? _allProducts
    : _allProducts.filter(function (p) { return p.currentStage === _activeFilter; });

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="px-6 py-10 text-center text-muted text-sm">No products found.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  filtered.forEach(function (p) {
    var s = statusMap[p.currentStage] || statusMap.pending;
    var lastEvent = p.lastScanAt
      ? new Date(p.lastScanAt).toLocaleString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
    tbody.innerHTML +=
      '<tr class="hover:bg-white/[0.02] transition-colors">' +
      '<td class="px-6 py-4 border-l-2" style="border-left-color:' + s.accentColor + '">' +
        '<div class="font-body text-white text-[14px] font-medium">' + p.productName + '</div>' +
        '<div class="font-mono text-muted text-[11px] mt-0.5">' + p.productID.split("-")[0] + '</div>' +
      '</td>' +
      '<td class="px-6 py-4 font-body text-muted text-[13px]">' +
        p.unitCount + ' unit' + (p.unitCount !== 1 ? 's' : '') +
      '</td>' +
      '<td class="px-6 py-4">' +
        '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border rounded-full ' + s.badge + '">' +
          '<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:' + s.dotColor + '"></span>' +
          s.label +
        '</span>' +
      '</td>' +
      '<td class="px-6 py-4 font-body text-muted text-[13px]">' + lastEvent + '</td>' +
      '</tr>';
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var token = localStorage.getItem("auditqr_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  function showError(msg) {
    var tbody = document.getElementById("scan-events-tbody");
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-10 text-center text-muted text-sm">' + msg + '</td></tr>';
  }

  apiFetch("/api/sme/items")
    .then(function (res) {
      if (!res || !res.ok) {
        showError("Could not load items. Please refresh.");
        return;
      }
      res.json().then(function (body) {
        var items = body.items || [];

        // Group children by parent product
        var productMap = {};
        items.forEach(function (it) {
          if (!productMap[it.productID]) {
            productMap[it.productID] = {
              productID: it.productID,
              productName: it.productName,
              stages: [],
              lastScanAt: null,
              unitCount: 0,
            };
          }
          var entry = productMap[it.productID];
          entry.stages.push(it.currentStage);
          entry.unitCount++;
          if (it.lastScanAt) {
            if (!entry.lastScanAt || new Date(it.lastScanAt) > new Date(entry.lastScanAt)) {
              entry.lastScanAt = it.lastScanAt;
            }
          }
        });

        // Derive aggregate stage per product and sort
        _allProducts = Object.values(productMap).map(function (p) {
          return Object.assign({}, p, { currentStage: deriveParentStage(p.stages) });
        });

        // Most recently active first, then alphabetical
        _allProducts.sort(function (a, b) {
          if (a.lastScanAt && b.lastScanAt)
            return new Date(b.lastScanAt) - new Date(a.lastScanAt);
          if (a.lastScanAt) return -1;
          if (b.lastScanAt) return 1;
          return a.productName.localeCompare(b.productName);
        });

        renderProducts();
      });
    })
    .catch(function () {
      showError("Could not load items. Please refresh.");
    });
});
