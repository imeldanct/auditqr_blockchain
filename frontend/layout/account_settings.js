// Auth guard
if (!localStorage.getItem("auditqr_token")) {
  window.location.href = "login.html";
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
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

// ── Profile state ─────────────────────────────────────────────────────────────
var _originalName = "";
var _originalEmail = "";

function startEditProfile() {
  document.getElementById("business-name").value = _originalName;
  document.getElementById("email").value = _originalEmail;
  document.getElementById("profile-display").classList.add("hidden");
  document.getElementById("profile-edit").classList.remove("hidden");
  document.getElementById("edit-profile-btn").classList.add("hidden");
}
function cancelEditProfile() {
  document.getElementById("profile-display").classList.remove("hidden");
  document.getElementById("profile-edit").classList.add("hidden");
  document.getElementById("edit-profile-btn").classList.remove("hidden");
}

async function saveProfile() {
  var btn = document.getElementById("save-profile-btn");
  var businessName = document.getElementById("business-name").value.trim();
  var email = document.getElementById("email").value.trim();
  if (!businessName || !email) {
    showToast("Business name and email cannot be empty.", "error");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    var res = await apiFetch("/api/sme/profile", {
      method: "PATCH",
      body: JSON.stringify({ businessName, email }),
    });
    if (!res) return; // apiFetch already redirected (token expired)
    var data = await res.json();
    if (res.ok) {
      _originalName = businessName;
      _originalEmail = email;
      document.getElementById("display-business-name").textContent = businessName;
      document.getElementById("display-email").textContent = email;
      cancelEditProfile();
      showToast("Profile updated.", "success");
    } else {
      showToast(data.error || "Could not update profile.", "error");
    }
  } catch (err) {
    showToast("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save changes";
  }
}

async function savePassword() {
  var btn = document.getElementById("save-password-btn");
  var currentPassword = document.getElementById("current-password").value;
  var newPassword = document.getElementById("new-password").value;
  var confirmPassword = document.getElementById("confirm-password").value;
  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast("All three password fields are required.", "error");
    return;
  }
  if (newPassword.length < 8) {
    showToast("New password must be at least 8 characters.", "error");
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast("Passwords do not match.", "error");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Updating…";
  try {
    var res = await apiFetch("/api/sme/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res) return;
    var data = await res.json();
    if (res.ok) {
      showToast("Password updated.", "success");
      document.getElementById("current-password").value = "";
      document.getElementById("new-password").value = "";
      document.getElementById("confirm-password").value = "";
    } else {
      showToast(data.error || "Could not update password.", "error");
    }
  } catch (err) {
    showToast("Network error. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Update password";
  }
}

// ── Eye toggles ───────────────────────────────────────────────────────────────
// defer guarantees DOM is ready when this runs — no DOMContentLoaded needed
[
  ["btn-toggle-current", "current-password", "cur-eye-open",  "cur-eye-closed"],
  ["btn-toggle-new",     "new-password",     "new-eye-open",  "new-eye-closed"],
  ["btn-toggle-confirm", "confirm-password", "conf-eye-open", "conf-eye-closed"],
].forEach(function (quad) {
  var btn = document.getElementById(quad[0]);
  if (!btn) return;
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    var inp = document.getElementById(quad[1]);
    if (!inp) return;
    var show = inp.getAttribute("type") === "password";
    inp.setAttribute("type", show ? "text" : "password");
    document.getElementById(quad[2]).style.display = show ? "none" : "block";
    document.getElementById(quad[3]).style.display = show ? "block" : "none";
  });
});

// ── Load profile ──────────────────────────────────────────────────────────────
apiFetch("/api/sme/profile")
  .then(function (res) {
    if (!res || !res.ok) throw new Error("HTTP " + (res ? res.status : "null"));
    return res.json();
  })
  .then(function (data) {
    _originalName = data.businessName || "";
    _originalEmail = data.email || "";
    document.getElementById("display-business-name").textContent = _originalName || "—";
    document.getElementById("display-email").textContent = _originalEmail || "—";
    document.getElementById("display-rc-number").textContent = data.rcNumber || "—";
    document.getElementById("rc-number").textContent = data.rcNumber || "—";
  })
  .catch(function (e) {
    console.error("loadProfile failed:", e);
    document.getElementById("display-business-name").textContent = "—";
    document.getElementById("display-email").textContent = "—";
    document.getElementById("display-rc-number").textContent = "—";
    showToast("Could not load profile.", "error");
  });
