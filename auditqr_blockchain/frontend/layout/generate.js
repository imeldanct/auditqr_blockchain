var token = localStorage.getItem("auditqr_token");
var productId = localStorage.getItem("product_id");
var rawQty = localStorage.getItem("product_quantity");
var quantity = rawQty !== null && rawQty !== "" ? parseInt(rawQty, 10) : 0;

var step3Label = document.getElementById("step3-label");
if (step3Label) {
  step3Label.textContent =
    quantity > 0
      ? "Generating " + quantity + " Child QR codes"
      : "No child QR codes (parent only)";
}

if (!token || !productId) {
  window.location.href = "login.html";
}

var stepEls = document.querySelectorAll(".text-left.space-y-5 > div");

function completeStep(i) {
  var el = stepEls[i];
  el.classList.remove("progress-active", "opacity-40");
  var icon = el.querySelector("span:first-child");
  icon.textContent = "check_circle";
  icon.className = "material-symbols-outlined text-green text-[20px]";
  icon.style.fontVariationSettings = "'FILL' 1";
  var label = el.querySelector("span:last-child");
  label.className = "text-white text-[14px]";
}

function activateStep(i, text) {
  var el = stepEls[i];
  el.classList.remove("opacity-40");
  el.classList.add("progress-active");
  var icon = el.querySelector("span:first-child");
  icon.textContent = "progress_activity";
  icon.className = "material-symbols-outlined text-blue text-[20px] animate-spin-slow";
  var label = el.querySelector("span:last-child");
  if (text) label.textContent = text;
  label.className = "text-blue text-[14px] font-medium";
}

function showGenerationError(msg) {
  document.querySelector("h1.font-headline").textContent = "Generation failed";
  document.querySelector("p.text-muted.text-sm").innerHTML =
    (msg || "Something went wrong.") +
    ' <a href="confirm_product.html" class="text-blue underline">Go back</a>';
}

async function runGeneration() {
  completeStep(0);
  setTimeout(function () {
    activateStep(1);
  }, 300);

  try {
    var res = await fetch(API_BASE + "/api/products/" + productId + "/generate-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ quantity: quantity }),
    });

    if (!res.ok) {
      var errData = await res.json().catch(function () {
        return {};
      });
      throw new Error(errData.error || "QR generation failed");
    }

    var data = await res.json();
    localStorage.setItem("parent_qr_id", data.parentQRID);

    setTimeout(function () {
      completeStep(1);
      if (quantity > 0) {
        activateStep(2, "Generating " + quantity + " Child QR codes...");
      } else {
        completeStep(2);
      }
    }, 800);

    setTimeout(function () {
      completeStep(2);
      activateStep(3);
    }, 1800);

    setTimeout(function () {
      completeStep(3);
      setTimeout(function () {
        window.location.href = "qr_ready.html";
      }, 500);
    }, 2800);
  } catch (err) {
    console.error(err);
    showGenerationError(err.message);
  }
}

runGeneration();
