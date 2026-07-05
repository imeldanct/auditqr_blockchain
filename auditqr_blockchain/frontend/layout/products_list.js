function toggleSidebar() {
  document.getElementById("sidebarMenu").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebarMenu").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

var _deleteProductId = null;
var _allProducts = [];

function openDeleteModal(btn) {
  _deleteProductId = btn.dataset.productId;
  document.getElementById("delete-modal-name").textContent = btn.dataset.productName;
  document.getElementById("delete-modal").classList.remove("hidden");
}

function closeRowMenu() {
  var m = document.getElementById("row-menu");
  if (m) m.remove();
}

function openRowMenu(btn) {
  closeRowMenu();
  var productId = btn.dataset.productId;
  var productName = btn.dataset.productName;
  var parentQRID = btn.dataset.parentQrid;
  var rect = btn.getBoundingClientRect();

  var menu = document.createElement("div");
  menu.id = "row-menu";
  menu.style.cssText =
    "position:fixed;" +
    "top:" + (rect.bottom + 4) + "px;" +
    "right:" + (window.innerWidth - rect.right) + "px;" +
    "width:220px;z-index:9999;";
  menu.className = "bg-surface border border-outline-variant/40 rounded-lg shadow-2xl overflow-hidden";
  menu.innerHTML =
    '<button class="w-full text-left px-4 py-3 text-[13px] text-blue hover:bg-blue/5 transition-colors flex items-center justify-between"' +
    ' onclick="closeRowMenu(); viewBlockchainRecords(\'' + (parentQRID || "") + '\', \'' + productName.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + '\')">' +
    '<span>View on blockchain explorer</span>' +
    '<span class="material-symbols-outlined text-[14px]">open_in_new</span></button>' +
    '<div class="border-t border-outline-variant/20"></div>' +
    '<button class="w-full text-left px-4 py-3 text-[13px] text-danger/70 hover:bg-danger/5 hover:text-danger transition-colors flex items-center gap-2"' +
    ' onclick="closeRowMenu(); _deleteProductId=\'' + productId + '\'; document.getElementById(\'delete-modal-name\').textContent=\'' + productName.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + '\'; document.getElementById(\'delete-modal\').classList.remove(\'hidden\')">' +
    '<span class="material-symbols-outlined text-[16px]">delete</span><span>Delete</span></button>';

  document.body.appendChild(menu);

  setTimeout(function () {
    document.addEventListener("click", closeRowMenu, { once: true });
  }, 0);
}

function viewBlockchainRecords(parentQRID, productName) {
  if (!parentQRID) {
    showToast("No QR batch found for this product.", "error");
    return;
  }

  apiFetch("/api/scan/history/" + parentQRID)
    .then(function (res) {
      if (!res || !res.ok) {
        showToast("Could not load blockchain records.", "error");
        return;
      }
      res.json().then(function (data) {
        var hashes = [];
        if (data.genesisTxHash) hashes.push(data.genesisTxHash);
        (data.events || []).forEach(function (e) { if (e.txHash) hashes.push(e.txHash); });

        if (hashes.length === 0) {
          showToast("No blockchain records for " + productName + ". The Solana validator may not have been running when this product was created.", "error");
          return;
        }

        hashes.forEach(function (hash) {
          window.open(solanaExplorerTx(hash), "_blank", "noopener,noreferrer");
        });
      });
    })
    .catch(function () {
      showToast("Could not load blockchain records.", "error");
    });
}

function renderProducts(products) {
  var tbody = document.getElementById("products-table-body");
  var countEl = document.getElementById("products-count");

  if (countEl) {
    countEl.textContent =
      "Showing " +
      products.length +
      " product" +
      (products.length !== 1 ? "s" : "");
  }

  if (products.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="px-6 py-4 text-center text-muted">No products found.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  products.forEach(function (p) {
    var tr = document.createElement("tr");
    tr.className = "hover:bg-white/[0.02] transition-colors";
    var qrCount = p.childQRCount || 0;
    var qrCell =
      qrCount > 0
        ? qrCount + " unit" + (qrCount !== 1 ? "s" : "")
        : '<span class="text-muted/50">—</span>';
    tr.innerHTML =
      '<td class="px-6 py-4 font-body text-white text-[14px] font-medium">' +
      p.productName +
      "</td>" +
      '<td class="px-6 py-4 font-mono text-muted text-[11px]">' +
      p.productID.split("-")[0] +
      "</td>" +
      '<td class="px-6 py-4 font-body text-muted text-[13px]">' +
      new Date(p.createdAt).toLocaleDateString() +
      "</td>" +
      '<td class="px-6 py-4 font-body text-muted text-[13px]">' +
      (p.description || "N/A") +
      "</td>" +
      '<td class="px-6 py-4 font-mono text-muted text-[13px]">' +
      qrCell +
      "</td>" +
      '<td class="px-6 py-4 text-right">' +
      '<button class="text-muted/60 hover:text-white transition-colors p-1 rounded hover:bg-white/5"' +
      ' title="Options" data-product-id="' + p.productID + '"' +
      ' data-product-name="' + (p.productName || "").replace(/"/g, "&quot;") + '"' +
      ' data-parent-qrid="' + (p.parentQRID || "") + '"' +
      ' onclick="event.stopPropagation(); openRowMenu(this)">' +
      '<span class="material-symbols-outlined text-[20px]">more_vert</span>' +
      "</button>" +
      "</td>";
    tbody.appendChild(tr);
  });
}

function applyFilters() {
  var query = (document.getElementById("search-input").value || "").toLowerCase().trim();
  var dateFilter = document.getElementById("date-filter").value;

  var now = new Date();
  var cutoff = null;
  if (dateFilter === "Last 7 days") {
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (dateFilter === "Last 30 days") {
    cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (dateFilter === "Last year") {
    cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  var filtered = _allProducts.filter(function (p) {
    var matchesQuery =
      !query ||
      p.productName.toLowerCase().includes(query) ||
      p.productID.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query));

    var matchesDate = !cutoff || new Date(p.createdAt) >= cutoff;

    return matchesQuery && matchesDate;
  });

  renderProducts(filtered);
}

document.addEventListener("DOMContentLoaded", function () {
  var token = localStorage.getItem("auditqr_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // ── Skeleton rows while products load ─────────────────────────────
  (function () {
    function skRow(widths) {
      var html = "<tr>";
      for (var i = 0; i < widths.length; i++) {
        html += '<td class="px-6 py-4"><span class="skeleton block rounded" style="height:0.75rem;width:' + widths[i] + '"></span></td>';
      }
      return html + "</tr>";
    }
    var tb = document.getElementById("products-table-body");
    if (tb) tb.innerHTML =
      skRow(["65%", "45%", "55%", "75%", "30%", "15%"]) +
      skRow(["50%", "38%", "60%", "85%", "25%", "15%"]) +
      skRow(["70%", "42%", "50%", "65%", "35%", "15%"]);
  })();

  Promise.all([apiFetch("/api/sme/profile"), apiFetch("/api/products")])
    .then(function (results) {
      var profileRes = results[0];
      var response = results[1];

      if (profileRes && profileRes.ok) {
        profileRes.json().then(function (profile) {
          var label = document.getElementById("business-name-label");
          if (label) label.textContent = profile.businessName;
        });
      }

      if (!response || !response.ok) {
        showToast("Failed to load products. Please refresh.", "error");
        return;
      }

      response.json().then(function (products) {
        _allProducts = products;
        renderProducts(_allProducts);
      });
    })
    .catch(function (error) {
      console.error(error);
      showToast("Failed to load products. Please refresh.", "error");
    });

  document.getElementById("search-input").addEventListener("input", applyFilters);
  document.getElementById("date-filter").addEventListener("change", applyFilters);

  document.getElementById("cancel-delete-btn").addEventListener("click", function () {
    document.getElementById("delete-modal").classList.add("hidden");
    _deleteProductId = null;
  });

  document.getElementById("confirm-delete-btn").addEventListener("click", function () {
    if (!_deleteProductId) return;
    var btn = document.getElementById("confirm-delete-btn");
    btn.disabled = true;
    btn.textContent = "Deleting...";

    apiFetch("/api/products/" + _deleteProductId, { method: "DELETE" })
      .then(function (res) {
        if (!res || !res.ok) throw new Error("Delete failed");
        document.getElementById("delete-modal").classList.add("hidden");
        showToast("Product deleted.", "success");
        _allProducts = _allProducts.filter(function (p) {
          return p.productID !== _deleteProductId;
        });
        applyFilters();
        _deleteProductId = null;
      })
      .catch(function (err) {
        console.error(err);
        showToast("Failed to delete product.", "error");
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Yes, delete";
      });
  });
});
