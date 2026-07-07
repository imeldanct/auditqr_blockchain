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

var CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="text-blue text-[20px]"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="m10.6 16.6l7.05-7.05l-1.4-1.4l-5.65 5.65l-2.85-2.85l-1.4 1.4zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"/></svg>';
var SPINNER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="text-blue text-[20px] animate-spin-slow"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="M8.125 21.213q-1.825-.788-3.187-2.15t-2.15-3.188T2 11.988t.788-3.875t2.15-3.175t3.187-2.15T12 2q.425 0 .713.288T13 3t-.288.713T12 4Q8.675 4 6.337 6.338T4 12t2.338 5.663T12 20t5.663-2.337T20 12q0-.425.288-.712T21 11t.713.288T22 12q0 2.05-.788 3.875t-2.15 3.188t-3.175 2.15t-3.875.787t-3.887-.787"/></svg>';

function completeStep(i) {
  var el = stepEls[i];
  el.classList.remove("progress-active", "opacity-40");
  el.firstElementChild.outerHTML = CHECK_SVG;
  var label = el.querySelector("span");
  label.className = "text-white text-[14px]";
}

function activateStep(i, text) {
  var el = stepEls[i];
  el.classList.remove("opacity-40");
  el.classList.add("progress-active");
  el.firstElementChild.outerHTML = SPINNER_SVG;
  var label = el.querySelector("span");
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
    // Clean up the orphaned product so it doesn't show in the list
    if (productId) {
      fetch(API_BASE + "/api/products/" + productId, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      }).catch(function () {});
      localStorage.removeItem("product_id");
    }
    showGenerationError(err.message);
  }
}

runGeneration();
