document.addEventListener("DOMContentLoaded", function () {
  var token = localStorage.getItem("auditqr_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  var productName = localStorage.getItem("product_name") || "";
  if (!productName) {
    window.location.href = "create_product.html";
    return;
  }

  var description = localStorage.getItem("product_description") || "";
  var rawQty = localStorage.getItem("product_quantity");
  var childCount = rawQty === null || rawQty === "" ? 0 : parseInt(rawQty, 10);
  if (isNaN(childCount)) childCount = 0;

  var category = localStorage.getItem("product_category") || "";
  var weight = localStorage.getItem("product_weight") || "";
  var mfgDate = localStorage.getItem("product_mfg_date") || "";
  var expDate = localStorage.getItem("product_exp_date") || "";

  function fmtDate(d) {
    if (!d) return "\u2014";
    var dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  setText("confirm-product-name", productName);
  setText("confirm-category", category || "\u2014");
  setText("confirm-weight", weight ? weight + " KG" : "\u2014");
  setText("confirm-mfg-date", fmtDate(mfgDate));
  setText("confirm-exp-date", fmtDate(expDate));
  setText("confirm-description", description || "No description provided.");
  setText("confirm-child-count", String(childCount));

  var btn = document.getElementById("confirm-and-generate-btn");
  if (!btn) {
    return;
  }
  btn.removeAttribute("onclick");

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    btn.textContent = "Creating product\u2026";
    try {
      var res = await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          productName: productName,
          description: description,
          category: category,
        }),
      });
      if (!res || !res.ok) throw new Error("Failed to create product");
      var data = await res.json();
      localStorage.setItem("product_id", data.product.productID);

      // Clear most draft keys — keep product_quantity so generate.html can read it
      [
        "product_name",
        "product_description",
        "product_category",
        "product_weight",
        "product_mfg_date",
        "product_exp_date",
      ].forEach(function (k) {
        localStorage.removeItem(k);
      });

      window.location.href = "generate.html";
    } catch (err) {
      console.error(err);
      showToast("Error: " + err.message, "error");
      btn.disabled = false;
      btn.innerHTML =
        '<span class="material-symbols-outlined text-[18px]">' +
        "verified_user</span> Confirm &amp; generate QR codes";
    }
  });
});
