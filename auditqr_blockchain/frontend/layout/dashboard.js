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
            var recent = products.slice(0, 5);
            if (recent.length === 0) {
              tbody.innerHTML =
                '<tr><td colspan="4" class="text-center text-muted text-sm py-8 px-4">' +
                'No products yet. <a href="create_product.html" class="text-blue hover:underline">Create your first product.</a></td></tr>';
            } else {
              recent.forEach(function (p) {
                var date = new Date(p.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                var units = p.childQRCount || 0;
                var unitsCell =
                  units > 0 ? units + " unit" + (units !== 1 ? "s" : "") : "\u2014";
                tbody.innerHTML +=
                  '<tr class="hover:bg-muted/5 transition-colors cursor-pointer" onclick="window.location.href=\'products_list.html\'">' +
                  '<td class="px-6 py-4 text-[14px] text-white font-medium">' +
                  p.productName +
                  "</td>" +
                  '<td class="px-6 py-4 text-[13px] text-muted">' +
                  date +
                  "</td>" +
                  '<td class="px-6 py-4 text-[13px] text-muted">' +
                  unitsCell +
                  "</td>" +
                  '<td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-[11px] font-medium bg-green/10 border border-green/30 text-green">Active</span></td>' +
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

  // Load recent item activity
  apiFetch("/api/sme/items").then(function (res) {
    var tbody = document.getElementById("activity-tbody");
    var empty = document.getElementById("activity-empty");
    if (!res || !res.ok) {
      if (empty) empty.textContent = "Could not load activity.";
      return;
    }
    res.json().then(function (body) {
      var items = (body.items || []).filter(function (it) {
        return it.lastScanAt;
      });
      items.sort(function (a, b) {
        return new Date(b.lastScanAt) - new Date(a.lastScanAt);
      });
      if (items.length === 0) {
        if (empty) empty.textContent = "No item activity yet.";
        return;
      }
      if (tbody) tbody.innerHTML = "";
      items.slice(0, 5).forEach(function (it) {
        var s = statusMap[it.currentStage] || statusMap.unscanned;
        tbody.innerHTML +=
          '<tr class="hover:bg-muted/5 transition-colors cursor-pointer" onclick="window.location.href=\'journey.html?id=' +
          it.childQRID +
          "'\">" +
          '<td class="px-6 py-4 text-[14px] text-white font-medium">' +
          it.productName +
          "</td>" +
          '<td class="px-6 py-4 text-[13px] text-muted">Unit ' +
          it.itemNumber +
          "</td>" +
          '<td class="px-6 py-4"><span class="px-2 py-0.5 rounded text-[10px] font-medium uppercase border ' +
          s.badge +
          '">' +
          s.label +
          "</span></td>" +
          "</tr>";
      });
    });
  });
});
