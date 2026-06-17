function toggleSidebar() {
  document.getElementById("sidebarMenu").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebarMenu").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

var _deleteProductId = null;

function openDeleteModal(btn) {
  _deleteProductId = btn.dataset.productId;
  document.getElementById("delete-modal-name").textContent = btn.dataset.productName;
  document.getElementById("delete-modal").classList.remove("hidden");
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

        products.forEach(function (p) {
          var tr = document.createElement("tr");
          tr.className = "hover:bg-white/[0.02] transition-colors";
          var qrCount = p.childQRCount || 0;
          var qrCell =
            qrCount > 0
              ? qrCount + " unit" + (qrCount !== 1 ? "s" : "")
              : '<span class="text-muted/50">\u2014</span>';
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
            '<td class="px-6 py-4 font-body text-white text-[13px]">' +
            (p.description || "N/A") +
            "</td>" +
            '<td class="px-6 py-4 font-mono text-muted text-[13px]">' +
            qrCell +
            "</td>" +
            '<td class="px-6 py-4">' +
            '<button class="text-danger/60 hover:text-danger transition-colors p-1 rounded hover:bg-danger/10"' +
            ' title="Delete product" data-product-id="' +
            p.productID +
            '" data-product-name="' +
            p.productName +
            '"' +
            ' onclick="openDeleteModal(this)">' +
            '<span class="material-symbols-outlined text-[18px]">delete</span>' +
            "</button>" +
            "</td>";
          tbody.appendChild(tr);
        });
      });
    })
    .catch(function (error) {
      console.error(error);
      showToast("Failed to load products. Please refresh.", "error");
    });

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
        var row = document.querySelector('[data-product-id="' + _deleteProductId + '"]');
        if (row) row.closest("tr").remove();
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
