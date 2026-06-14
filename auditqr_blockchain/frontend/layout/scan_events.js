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
  pending: { label: "Pending", badge: "text-muted bg-muted/10 border-muted/30" },
  transit: { label: "In Transit", badge: "text-blue bg-blue/10 border-blue/30" },
  delivered: { label: "Delivered", badge: "text-green bg-green/10 border-green/30" },
};

var filterMap = {
  all: null,
  pending: ["pending"],
  transit: ["transit"],
  delivered: ["delivered"],
};

var _allItems = [];
var _activeFilter = "all";

function setStatusFilter(btn) {
  _activeFilter = btn.dataset.status;
  document.querySelectorAll(".status-pill").forEach(function (p) {
    p.classList.remove("border-blue", "bg-blue/10", "text-blue");
    p.classList.add("border-outline-variant", "text-muted");
  });
  btn.classList.add("border-blue", "bg-blue/10", "text-blue");
  btn.classList.remove("border-outline-variant", "text-muted");
  renderItems();
}

function renderItems() {
  var tbody = document.getElementById("scan-events-tbody");
  var stages = filterMap[_activeFilter];
  var filtered = stages
    ? _allItems.filter(function (it) {
        return stages.indexOf(it.currentStage) !== -1;
      })
    : _allItems;

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="px-6 py-10 text-center text-muted text-sm">No items found.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  filtered.forEach(function (it) {
    var s = statusMap[it.currentStage] || statusMap.unscanned;
    var lastScan = it.lastScanAt
      ? new Date(it.lastScanAt).toLocaleString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "\u2014";
    tbody.innerHTML +=
      '<tr class="hover:bg-white/[0.02] transition-colors cursor-pointer" onclick="window.location.href=\'journey.html?id=' +
      it.childQRID +
      "'\">" +
      '<td class="px-6 py-4 font-body text-white text-[14px] font-medium">' +
      it.productName +
      "</td>" +
      '<td class="px-6 py-4 font-body text-muted text-[13px]">Unit ' +
      it.itemNumber +
      "</td>" +
      '<td class="px-6 py-4"><span class="px-2 py-0.5 rounded text-[10px] font-medium uppercase border ' +
      s.badge +
      '">' +
      s.label +
      "</span></td>" +
      '<td class="px-6 py-4 font-body text-muted text-[13px]">' +
      lastScan +
      "</td>" +
      "</tr>";
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var token = localStorage.getItem("auditqr_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  apiFetch("/api/sme/items")
    .then(function (res) {
      if (!res || !res.ok) {
        document.getElementById("scan-events-empty").textContent =
          "Could not load items.";
        return;
      }
      res.json().then(function (body) {
        _allItems = body.items || [];
        // Sort: most recently scanned first, then by item number
        _allItems.sort(function (a, b) {
          if (a.lastScanAt && b.lastScanAt)
            return new Date(b.lastScanAt) - new Date(a.lastScanAt);
          if (a.lastScanAt) return -1;
          if (b.lastScanAt) return 1;
          return a.itemNumber - b.itemNumber;
        });
        renderItems();
      });
    })
    .catch(function () {
      document.getElementById("scan-events-empty").textContent = "Could not load items.";
    });
});
