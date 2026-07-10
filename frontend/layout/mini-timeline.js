// Shared timeline-row builder for handoff.html and code.html's in-page journey preview.
// Both pages fetch the same /api/scan/history response as journey.html, so this keeps
// their mini timeline in sync with it (business name, address, GPS, blockchain tx link)
// instead of each page hand-rolling its own copy that silently drifts out of date.

const MINI_ROLE_LABELS = { transporter: "Transporter", retailer: "Retailer", unknown: "Unknown handler" };

function miniTxRow(txHash) {
  return txHash
    ? '<div class="flex items-center gap-1.5 mt-1">' +
        '<a href="' + solanaExplorerTx(txHash) + '" target="_blank" rel="noopener noreferrer" class="text-blue text-[11px] hover:underline inline-flex items-center gap-1">' +
          'View on blockchain explorer' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="text-[11px]"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h7v2H5v14h14v-7h2v7q0 .825-.587 1.413T19 21zm4.7-5.3l-1.4-1.4L17.6 5H14V3h7v7h-2V6.4z"/></svg>' +
        '</a>' +
      '</div>'
    : '<div class="flex items-center gap-1.5 mt-1">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class="text-[12px] text-muted/50"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="m15.3 16.7l1.4-1.4l-3.7-3.7V7h-2v5.4zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.325 0 5.663-2.337T20 12t-2.337-5.663T12 4T6.337 6.338T4 12t2.338 5.663T12 20"/></svg>' +
        '<span class="font-mono text-[10px] text-muted/50">Recording to chain…</span>' +
      '</div>';
}

function buildMiniGenesisRow(fmt, genesisAt, genesisTxHash, businessName, businessAddress, hasMore) {
  return (
    '<div class="flex gap-4">' +
      '<div class="flex flex-col items-center">' +
        '<div class="w-[9px] h-[9px] rounded-full bg-blue mt-1.5"></div>' +
        (hasMore ? '<div class="timeline-line"></div>' : '') +
      '</div>' +
      '<div class="pb-2">' +
        '<p class="text-white font-medium text-[14px]">' + (businessName || "Manufacturer") + '</p>' +
        '<p class="text-blue text-[12px] font-medium mt-0.5">QR codes generated</p>' +
        (businessAddress ? '<p class="text-muted/60 text-[11px] mt-0.5">' + businessAddress + '</p>' : '') +
        '<p class="text-muted text-[11px] mt-1">' + fmt(genesisAt) + '</p>' +
        miniTxRow(genesisTxHash) +
      '</div>' +
    '</div>'
  );
}

function buildMiniEventRow(fmt, event, isLast) {
  const label = MINI_ROLE_LABELS[event.scannerRole] || event.scannerRole;
  const actionLabel = event.scannerRole === "transporter" ? "Picked up" : "Handoff recorded";
  const location = event.gpsLocation && event.gpsLocation !== "location-unavailable" ? event.gpsLocation : null;
  return (
    '<div class="flex gap-4 ' + (isLast ? "" : "mb-4") + '">' +
      '<div class="flex flex-col items-center">' +
        '<div class="w-[9px] h-[9px] rounded-full bg-blue mt-1.5"></div>' +
        (isLast ? '' : '<div class="timeline-line"></div>') +
      '</div>' +
      '<div class="pb-2">' +
        '<p class="text-white font-medium text-[14px]">' + label + '</p>' +
        '<p class="text-blue text-[12px] font-medium mt-0.5">' + actionLabel + '</p>' +
        '<p class="text-muted text-[11px] mt-1">' + fmt(event.timestamp) + '</p>' +
        (location ? '<p class="text-muted/60 text-[11px] mt-0.5">' + location + '</p>' : '') +
        miniTxRow(event.txHash) +
      '</div>' +
    '</div>'
  );
}

function renderMiniTimeline(containerEl, fmt, data) {
  const events = data.events || [];
  const product = data.product || {};
  const genesisRow = buildMiniGenesisRow(
    fmt, data.genesisAt, data.genesisTxHash, product.businessName, product.businessAddress, events.length > 0
  );
  const eventRows = events.map((e, i) => buildMiniEventRow(fmt, e, i === events.length - 1)).join("");
  containerEl.innerHTML = genesisRow + eventRows;
}
