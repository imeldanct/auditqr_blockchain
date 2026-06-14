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
  pending:   { label: "Pending",    badge: "text-muted bg-muted/10 border-muted/30", accentColor: "rgba(119,134,127,0.35)", dotColor: "#77867F" },
  transit:   { label: "In Transit", badge: "text-blue bg-blue/10 border-blue/30",    accentColor: "#3185FC",                dotColor: "#3185FC" },
  delivered: { label: "Delivered",  badge: "text-green bg-green/10 border-green/30", accentColor: "#D6FFB7",                dotColor: "#D6FFB7" },
};

function loadStats() {
  apiFetch("/api/sme/stats").then(function (res) {
    if (!res || !res.ok) return;
    res.json().then(function (stats) {
      var el;
      el = document.getElementById("stat-pending");
      if (el) el.textContent = stats.pendingCount != null ? stats.pendingCount : "—";
      el = document.getElementById("stat-transit");
      if (el) el.textContent = stats.inTransitCount != null ? stats.inTransitCount : "—";
      el = document.getElementById("stat-delivered");
      if (el) el.textContent = stats.deliveredCount != null ? stats.deliveredCount : "—";
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var token = localStorage.getItem("auditqr_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  Promise.all([apiFetch("/api/sme/profile"), apiFetch("/api/products")])
    .then(function (results) {
      var profileRes = results[0];
      var productsRes = results[1];

      if (!profileRes || !profileRes.ok) return;

      profileRes.json().then(function (profile) {
        var titleEl = document.getElementById("dashboard-title");
        if (titleEl) titleEl.textContent = "Welcome, " + profile.businessName;
      });

      // Load stats
      loadStats();

      if (productsRes && productsRes.ok) {
        productsRes.json().then(function (products) {
          var tbody = document.getElementById("products-table-body");
          if (tbody) {
            tbody.innerHTML = "";
            var recent = products.slice(0, 3);
            if (recent.length === 0) {
              tbody.innerHTML =
                '<tr><td colspan="5" class="text-center text-muted text-sm py-8 px-4">' +
                'No products yet. <a href="create_product.html" class="text-blue hover:underline">Create your first product.</a></td></tr>';
            } else {
              recent.forEach(function (p) {
                var date = new Date(p.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                var units = p.childQRCount || 0;
                var unitsCell = units > 0 ? units + " unit" + (units !== 1 ? "s" : "") : "\u2014";
                tbody.innerHTML +=
                  '<tr class="hover:bg-white/[0.02] transition-colors cursor-pointer" onclick="window.location.href=\'products_list.html\'">' +
                  '<td class="px-6 py-4 font-body text-white text-[14px] font-medium">' + p.productName + "</td>" +
                  '<td class="px-6 py-4 font-mono text-muted text-[11px]">' + p.productID.split("-")[0] + "</td>" +
                  '<td class="px-6 py-4 font-body text-muted text-[13px]">' + date + "</td>" +
                  '<td class="px-6 py-4 font-body text-muted text-[13px]">' + (p.description || "N/A") + "</td>" +
                  '<td class="px-6 py-4 font-mono text-muted text-[13px]">' + unitsCell + "</td>" +
                  "</tr>";
              });
            }
          }
        });
      }
    })
    .catch(function (error) {
      console.error(error);
      localStorage.removeItem("auditqr_token");
      window.location.href = "login.html";
    });

  // Load recent item activity — grouped by parent product, same as item tracking page
  apiFetch("/api/sme/items").then(function (res) {
    var tbody = document.getElementById("activity-tbody");
    var empty = document.getElementById("activity-empty");
    if (!res || !res.ok) {
      if (empty) empty.textContent = "Could not load activity.";
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

      var products = Object.values(productMap).map(function (p) {
        var allPending = p.stages.every(function (s) { return s === "pending"; });
        var allDelivered = p.stages.every(function (s) { return s === "delivered"; });
        return Object.assign({}, p, {
          currentStage: allPending ? "pending" : allDelivered ? "delivered" : "transit",
        });
      });

      // Most recently active first
      products.sort(function (a, b) {
        if (a.lastScanAt && b.lastScanAt) return new Date(b.lastScanAt) - new Date(a.lastScanAt);
        if (a.lastScanAt) return -1;
        if (b.lastScanAt) return 1;
        return a.productName.localeCompare(b.productName);
      });

      if (products.length === 0) {
        if (empty) empty.textContent = "No item activity yet.";
        return;
      }

      if (tbody) tbody.innerHTML = "";
      products.slice(0, 3).forEach(function (p) {
        var s = statusMap[p.currentStage] || statusMap.pending;
        var lastEvent = p.lastScanAt
          ? new Date(p.lastScanAt).toLocaleString("en-NG", {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : "—";
        tbody.innerHTML +=
          '<tr class="hover:bg-white/[0.02] transition-colors">' +
          '<td class="px-6 py-4 border-l-2" style="border-left-color:' + s.accentColor + '">' +
            '<div class="font-body text-white text-[14px] font-medium">' + p.productName + '</div>' +
            '<div class="font-mono text-muted text-[11px] mt-0.5">' + p.productID.split("-")[0] + '</div>' +
          '</td>' +
          '<td class="px-6 py-4 font-body text-muted text-[13px]">' + p.unitCount + ' unit' + (p.unitCount !== 1 ? 's' : '') + '</td>' +
          '<td class="px-6 py-4">' +
            '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border rounded-full ' + s.badge + '">' +
              '<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:' + s.dotColor + '"></span>' +
              s.label +
            '</span>' +
          '</td>' +
          '<td class="px-6 py-4 font-body text-muted text-[13px]">' + lastEvent + '</td>' +
          '</tr>';
      });
    });
  });
});
