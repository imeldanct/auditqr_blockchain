document.addEventListener("DOMContentLoaded", function () {
  var checkbox = document.getElementById("confirm-saved-checkbox");
  var doneBtn = document.getElementById("done-btn");

  checkbox.addEventListener("change", function () {
    doneBtn.disabled = !checkbox.checked;
  });
  doneBtn.addEventListener("click", function () {
    window.location.href = "products_list.html";
  });

  var _childQRs = [];
  var _productName = "";
  var _parentDataURL = "";
  var _parentQRText = "";

  // qrcodejs renders into a div; extract canvas data URL from it
  function makeQRDataURL(text, size, cb) {
    var tmp = document.createElement("div");
    tmp.style.cssText = "position:absolute;left:-9999px;top:-9999px;";
    document.body.appendChild(tmp);
    var qr = new QRCode(tmp, {
      text: text,
      width: size,
      height: size,
      correctLevel: QRCode.CorrectLevel.M,
    });
    // qrcodejs renders synchronously via canvas internally
    setTimeout(function () {
      var canvas = tmp.querySelector("canvas");
      var url = canvas ? canvas.toDataURL("image/png") : "";
      document.body.removeChild(tmp);
      cb(url);
    }, 50);
  }

  var parentQRID = localStorage.getItem("parent_qr_id");
  if (!parentQRID) {
    showToast("No QR data found. Please generate again.", "error");
    return;
  }

  // Poll for genesis txHash until it appears (background Solana write).
  // Gives up after ~30 seconds and shows a warning — silent failure means
  // the SME would never know the blockchain write didn't happen.
  var _genesisPollTimer = null;
  var _genesisPollAttempts = 0;
  var GENESIS_POLL_MAX = 10; // 10 × 3s = 30 seconds

  function pollGenesisTx() {
    _genesisPollAttempts++;
    apiFetch("/api/scan/history/" + parentQRID)
      .then(function (res) { return res && res.ok ? res.json() : null; })
      .then(function (data) {
        var el = document.getElementById("genesis-tx-display");
        if (data && data.genesisTxHash && el) {
          var h = data.genesisTxHash;
          el.textContent = "Solana · " + h.slice(0, 16) + "…" + h.slice(-8);
          el.classList.add("text-blue");
          el.classList.remove("text-muted");
        } else if (_genesisPollAttempts >= GENESIS_POLL_MAX) {
          // Timed out — write probably failed
          if (el) {
            el.textContent = "Blockchain write failed";
            el.classList.add("text-danger");
            el.classList.remove("text-muted");
          }
          showToast("Blockchain record not written. Check that the Solana validator is running and funded, then restart the backend.", "error");
        } else {
          _genesisPollTimer = setTimeout(pollGenesisTx, 3000);
        }
      })
      .catch(function () {
        if (_genesisPollAttempts < GENESIS_POLL_MAX) {
          _genesisPollTimer = setTimeout(pollGenesisTx, 5000);
        }
      });
  }

  apiFetch("/api/qr/" + parentQRID)
    .then(function (res) {
      if (!res || !res.ok) {
        showToast("Failed to load QR data.", "error");
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      pollGenesisTx();
      _productName = data.productName;
      _childQRs = data.childQRs || [];
      localStorage.removeItem("product_quantity");

      var nameEl = document.getElementById("qr-product-name");
      if (nameEl) nameEl.textContent = data.productName;
      var nameLabelEl = document.getElementById("qr-product-name-label");
      if (nameLabelEl) nameLabelEl.textContent = data.productName;
      var countEl = document.getElementById("qr-item-count");
      if (countEl) countEl.textContent = data.quantity + " Items";
      var badge = document.getElementById("child-count-badge");
      if (badge) badge.textContent = data.quantity + " Items";

      // Parent QR — preview at 180px, download at 512px
      _parentQRText = FRONTEND_BASE + "/layout/handoff.html?parentId=" + data.parentQRID;
      makeQRDataURL(_parentQRText, 180, function (url) {
        _parentDataURL = url;
        var img = document.getElementById("parent-qr-img");
        if (img && url) {
          img.src = url;
          img.style.display = "block";
        }
      });

      // Child QR grid
      var grid = document.getElementById("child-qr-grid");
      if (!grid) return;
      grid.innerHTML = "";
      _childQRs.forEach(function (child) {
        var childQRText = FRONTEND_BASE + "/layout/journey.html?childId=" + child.childQRID;
        makeQRDataURL(childQRText, 90, function (url) {
          var wrapper = document.createElement("div");
          wrapper.className =
            "aspect-square bg-white rounded flex items-center justify-center p-1";
          var img = document.createElement("img");
          img.src = url;
          img.style.cssText = "width:100%;height:100%;display:block;";
          img.alt = "Child QR " + child.itemNumber;
          wrapper.appendChild(img);
          grid.appendChild(wrapper);
        });
      });
    })
    .catch(function (e) {
      console.error(e);
      showToast("Error: " + e.message, "error");
    });

  function triggerDownload(blobURL, filename) {
    var a = document.createElement("a");
    a.href = blobURL;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    // Delay revoke so the browser has time to start the download
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobURL);
    }, 2000);
  }

  function dataURLtoBlob(dataURL) {
    var parts = dataURL.split(",");
    var mime = parts[0].match(/:(.*?);/)[1];
    var binary = atob(parts[1]);
    var arr = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  document.getElementById("download-parent-btn").addEventListener("click", function (e) {
    e.preventDefault();
    if (!_parentQRText) {
      showToast("QR not ready yet.", "error");
      return;
    }
    makeQRDataURL(_parentQRText, 512, function (highResUrl) {
      if (!highResUrl) { showToast("Failed to generate QR.", "error"); return; }
      var blob = dataURLtoBlob(highResUrl);
      var blobURL = URL.createObjectURL(blob);
      triggerDownload(blobURL, "ParentQR_" + (_productName || "AuditQR") + ".png");
    });
  });

  document
    .getElementById("download-all-children-btn")
    .addEventListener("click", async function () {
      if (!_childQRs.length) {
        showToast("No child QR data loaded yet.", "error");
        return;
      }

      var btn = document.getElementById("download-all-children-btn");
      btn.disabled = true;
      btn.textContent = "Building ZIP…";

      try {
        var zip = new JSZip();
        var folder = zip.folder(_productName || "AuditQR");

        // Generate all QR images in parallel
        var promises = _childQRs.map(function (child, idx) {
          return new Promise(function (resolve) {
            var childQRText = FRONTEND_BASE + "/layout/journey.html?childId=" + child.childQRID;
            makeQRDataURL(childQRText, 300, function (url) {
              if (url) {
                // strip data:image/png;base64, prefix
                var base64 = url.split(",")[1];
                folder.file("ChildQR_" + (idx + 1) + ".png", base64, { base64: true });
              }
              resolve();
            });
          });
        });

        await Promise.all(promises);

        var blob = await zip.generateAsync({ type: "blob" });
        var url = URL.createObjectURL(blob);
        triggerDownload(url, (_productName || "AuditQR") + "_QRCodes.zip");
        showToast("ZIP downloaded!", "success");
      } catch (e) {
        console.error(e);
        showToast("Failed to build ZIP. Please try again.", "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML =
          '<span class="material-symbols-outlined text-[16px]">download</span> Download All (ZIP)';
      }
    });
});
