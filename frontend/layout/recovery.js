(function () {
  var events = [];
  var recoverButton = document.getElementById("recover-button");
  var recoverLabel = document.getElementById("recover-button-label");
  var idleState = document.getElementById("idle-state");
  var loadingState = document.getElementById("loading-state");
  var errorState = document.getElementById("error-state");
  var results = document.getElementById("results");
  var eventsBody = document.getElementById("events-body");
  var emptyState = document.getElementById("empty-state");
  var recoverIcon = document.getElementById("recover-icon");
  var filters = ["search-filter", "type-filter", "location-filter", "from-filter", "to-filter"];

  function showState(name) {
    idleState.classList.toggle("hidden", name !== "idle");
    loadingState.classList.toggle("hidden", name !== "loading");
    errorState.classList.toggle("hidden", name !== "error");
    results.classList.toggle("hidden", name !== "results");
  }

  function formatDate(value) {
    var date = new Date(value);
    return isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("en-NG", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: false
        }).format(date);
  }

  function truncate(value, start, end) {
    return value.length > start + end + 3
      ? value.slice(0, start) + "..." + value.slice(-end)
      : value;
  }

  function createCell(text, className) {
    var cell = document.createElement("td");
    cell.className = "px-5 py-4 text-sm align-top " + (className || "");
    cell.textContent = text;
    return cell;
  }

  function locationIsUnavailable(location) {
    return location === "location-unavailable" || location === "address-unavailable";
  }

  function buildLocationOptions() {
    var select = document.getElementById("location-filter");
    var previous = select.value;
    var locations = Array.from(new Set(events.map(function (event) { return event.location; })))
      .filter(function (location) { return !locationIsUnavailable(location); })
      .sort();

    while (select.options.length > 3) select.remove(3);
    locations.forEach(function (location) {
      var option = document.createElement("option");
      option.value = "exact:" + location;
      option.textContent = location;
      select.appendChild(option);
    });
    select.value = Array.from(select.options).some(function (option) { return option.value === previous; })
      ? previous
      : "all";
  }

  function matchesFilters(event) {
    var query = document.getElementById("search-filter").value.trim().toLowerCase();
    var type = document.getElementById("type-filter").value;
    var location = document.getElementById("location-filter").value;
    var from = document.getElementById("from-filter").value;
    var to = document.getElementById("to-filter").value;
    var eventDate = event.timestamp.slice(0, 10);

    if (query && !(event.productName + " " + event.parentQRID).toLowerCase().includes(query)) return false;
    if (type !== "all" && event.eventType !== type) return false;
    if (location === "recorded" && locationIsUnavailable(event.location)) return false;
    if (location === "unavailable" && !locationIsUnavailable(event.location)) return false;
    if (location.indexOf("exact:") === 0 && event.location !== location.slice(6)) return false;
    if (from && eventDate < from) return false;
    if (to && eventDate > to) return false;
    return true;
  }

  function render() {
    var filtered = events.filter(matchesFilters);
    eventsBody.replaceChildren();
    emptyState.classList.toggle("hidden", filtered.length !== 0);

    filtered.forEach(function (event) {
      var row = document.createElement("tr");
      row.className = "border-b border-outline-variant/20 last:border-0";
      row.appendChild(createCell(formatDate(event.timestamp), "text-muted whitespace-nowrap"));

      var eventCell = document.createElement("td");
      eventCell.className = "px-5 py-4 align-top";
      var badge = document.createElement("span");
      badge.className = "inline-flex rounded-full border border-blue/40 bg-blue/10 px-2.5 py-1 text-[11px] font-medium text-blue";
      badge.textContent = event.eventType;
      eventCell.appendChild(badge);
      row.appendChild(eventCell);

      var productCell = document.createElement("td");
      productCell.className = "px-5 py-4 align-top";
      var product = document.createElement("p");
      product.className = "text-sm font-medium text-white";
      product.textContent = event.productName;
      var batch = document.createElement("p");
      batch.className = "font-mono text-[11px] text-muted mt-1";
      batch.textContent = truncate(event.parentQRID, 8, 6);
      productCell.append(product, batch);
      row.appendChild(productCell);

      row.appendChild(createCell(
        locationIsUnavailable(event.location) ? "Location unavailable" : event.location,
        locationIsUnavailable(event.location) ? "text-warning" : "text-white"
      ));
      row.appendChild(createCell(event.businessName || event.scannerRole || "—", "text-muted"));

      var txCell = document.createElement("td");
      txCell.className = "px-5 py-4 align-top";
      var link = document.createElement("a");
      link.href = "https://explorer.solana.com/tx/" + encodeURIComponent(event.signature) + "?cluster=devnet";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.className = "font-mono text-[11px] text-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue";
      link.textContent = truncate(event.signature, 7, 5) + " ↗";
      txCell.appendChild(link);
      row.appendChild(txCell);
      eventsBody.appendChild(row);
    });

    document.getElementById("result-count").textContent =
      filtered.length + " of " + events.length + " recovered audit events";
  }

  function renderSummary(data) {
    var genesis = events.filter(function (event) { return event.eventType === "QR Generation"; }).length;
    var transporter = events.filter(function (event) { return event.eventType === "Transporter Scan"; }).length;
    var retailer = events.filter(function (event) { return event.eventType === "Retailer Scan"; }).length;
    document.getElementById("stat-events").textContent = String(events.length);
    document.getElementById("stat-genesis").textContent = String(genesis);
    document.getElementById("stat-transporter").textContent = String(transporter);
    document.getElementById("stat-retailer").textContent = String(retailer);
    document.getElementById("wallet-summary").textContent =
      "Wallet " + truncate(data.walletAddress, 8, 6) +
      " · " + data.totalTransactionsFound + " wallet transactions checked" +
      (data.cached ? " · cached result" : "");
  }

  async function recover() {
    recoverButton.disabled = true;
    recoverButton.setAttribute("aria-busy", "true");
    recoverLabel.textContent = "Recovering…";
    recoverIcon.classList.add("is-spinning");
    showState("loading");

    try {
      var response = await fetch(API_BASE + "/api/internal/recover-audit");
      var data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Devnet recovery failed.");
      events = Array.isArray(data.events) ? data.events : [];
      buildLocationOptions();
      renderSummary(data);
      render();
      showState("results");
    } catch (error) {
      document.getElementById("error-detail").textContent =
        error instanceof Error ? error.message : "Try again in a moment.";
      showState("error");
    } finally {
      recoverButton.disabled = false;
      recoverButton.removeAttribute("aria-busy");
      recoverLabel.textContent = "Recover audit trail";
      recoverIcon.classList.remove("is-spinning");
    }
  }

  filters.forEach(function (id) {
    document.getElementById(id).addEventListener("input", render);
    document.getElementById(id).addEventListener("change", render);
  });

  document.getElementById("clear-filters").addEventListener("click", function () {
    document.getElementById("search-filter").value = "";
    document.getElementById("type-filter").value = "all";
    document.getElementById("location-filter").value = "all";
    document.getElementById("from-filter").value = "";
    document.getElementById("to-filter").value = "";
    render();
  });
  recoverButton.addEventListener("click", recover);
  document.getElementById("retry-button").addEventListener("click", recover);
}());
