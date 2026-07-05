document.addEventListener("DOMContentLoaded", function() {
  var token = localStorage.getItem("auditqr_token");
  if (!token) { window.location.href = "login.html"; return; }

  // Restore fields if user came back to edit
  var restoreMap = [
    ["product-name",        "product_name"],
    ["product-description", "product_description"],
    ["items-per-carton",    "product_quantity"],
    ["category",            "product_category"],
    ["unit-weight",         "product_weight"],
    ["mfg-date",            "product_mfg_date"],
    ["exp-date",            "product_exp_date"]
  ];
  restoreMap.forEach(function(pair) {
    var val = localStorage.getItem(pair[1]);
    if (val !== null && val !== "") {
      var el = document.getElementById(pair[0]);
      if (el) el.value = val;
    }
  });

  var btn = document.getElementById("confirm-details-btn");
  if (!btn) { return; }

  var expDateInput = document.getElementById("exp-date");
  var mfgDateInput = document.getElementById("mfg-date");
  function clearExpError() {
    var expErrEl = document.getElementById("exp-date-error");
    if (expErrEl) expErrEl.classList.add("hidden");
  }
  if (expDateInput) expDateInput.addEventListener("change", clearExpError);
  if (mfgDateInput) mfgDateInput.addEventListener("change", clearExpError);

  btn.addEventListener("click", function() {
    var nameEl = document.getElementById("product-name");
    var productName = nameEl ? nameEl.value.trim() : "";
    if (!productName) {
      showToast("Please enter a product name.", "error");
      return;
    }

    var qtyEl = document.getElementById("items-per-carton");
    var qtyRaw = qtyEl ? qtyEl.value : "";
    var qty = (qtyRaw === "") ? 0 : parseInt(qtyRaw, 10);
    if (isNaN(qty) || qty < 0) {
      showToast("Enter 0 or more for child packs.", "error");
      return;
    }

    var descEl = document.getElementById("product-description");
    var catEl  = document.getElementById("category");
    var wtEl   = document.getElementById("unit-weight");
    var mfgEl  = document.getElementById("mfg-date");
    var expEl  = document.getElementById("exp-date");

    var desc = descEl ? descEl.value.trim() : "";
    var cat  = catEl  ? catEl.value         : "";
    var wt   = wtEl   ? wtEl.value          : "";
    var mfg  = mfgEl  ? mfgEl.value         : "";
    var exp  = expEl  ? expEl.value         : "";

    var expErrEl = document.getElementById("exp-date-error");
    if (mfg && exp && new Date(exp) < new Date(mfg)) {
      if (expErrEl) expErrEl.classList.remove("hidden");
      if (expEl) expEl.focus();
      return;
    }
    if (expErrEl) expErrEl.classList.add("hidden");

    localStorage.setItem("product_name",        productName);
    localStorage.setItem("product_description", desc);
    localStorage.setItem("product_quantity",    String(qty));
    localStorage.setItem("product_category",    cat);
    localStorage.setItem("product_weight",      wt);
    localStorage.setItem("product_mfg_date",    mfg);
    localStorage.setItem("product_exp_date",    exp);
    localStorage.removeItem("product_id");

    window.location.href = "confirm_product.html";
  });
});
