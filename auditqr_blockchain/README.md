# AuditQR — Blockchain-Backed Supply Chain Verification for SMEs

## Contents

- [Overview](#overview)
- [Core Problem: The Oracle Problem](#core-problem-the-oracle-problem)
- [Supply Chain Flow](#supply-chain-flow)
- [Scan Stage Logic](#scan-stage-logic)
- [Design Decisions](#design-decisions)
- [Blockchain Architecture (Solana)](#blockchain-architecture-solana)
- [Architecture](#architecture)
- [QR Code Structure](#qr-code-structure)
- [Key Pages](#key-pages)

---

## Overview

AuditQR is a product authentication and supply chain tracking system built for Nigerian SMEs. It allows small businesses to generate QR codes for their products, track movement through their supply chain, and give end customers a way to verify product authenticity — all backed by an immutable blockchain record.

---

## Core Problem: The Oracle Problem

Blockchain data is only as trustworthy as the real-world data fed into it. The classic "oracle problem" is that there is no way to technically guarantee that what is recorded on-chain actually reflects what happened in the physical world.

### How AuditQR Mitigates It

AuditQR does **not** attempt to make fraud technically impossible. Instead, it makes fraud **economically and socially costly** through **multiparty verification**.

Every participant in the supply chain — transporter and retailer — must independently scan the same QR code at their stage. Each scan creates a public, timestamped record. No single actor can falsify the chain without the next participant either corroborating or contradicting their claim.

Because SMEs operate in real business relationships (they know their transporters, they know their retailers), the cost of being caught falsifying a record is the loss of that business relationship. This social and economic deterrent is the primary trust mechanism.

---

## Supply Chain Flow

```
SME (Manufacturer)
      │
      │ generates QR codes → prints & attaches to products
      │
Transporter
      │ scans QR → Scan 1 recorded → redirected to handoff confirmation page
      │
Retailer
      │ scans QR → Scan 2 recorded → retailer confirmed as receiver
      │
Customer
        scans QR → Scan 3 → redirected to journey.html (read-only verification)
                             NO data stored. Customer is not tracked.
```

### Scan Role Determination

All three participants use the **same QR code** — any phone camera or QR scanning app works. The system determines the participant's role automatically based on the `currentStage` of that specific child QR code:

| Current Stage | Role        | Action                                                                                                                            |
| ------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pending`     | Transporter | `ScanEvent` created, stage → `transit`; the transporter then generates a handoff code to share                                     |
| `transit`     | Retailer    | Routed to code entry. Entering the transporter's code (validated against _that specific unit_) records the retailer `ScanEvent` and advances stage → `delivered` |
| `delivered`   | Customer    | Redirected to `journey.html` — no data stored                                                                                     |

`qr_scanner.html` is an optional landing page on the website for anyone browsing — it is **not** the core scanning mechanism. The QR code URL itself carries the logic.

---

## Data Model Decisions

### What is stored

- `ScanEvent`: childQR ID, scanner role (transporter/retailer), IP address, timestamp, optional blockchain tx hash
- `HandoffCode`: a confirmation code generated at the transporter scan, required to be entered by the retailer — this is the multiparty confirmation step

### What is NOT stored

- Customer/consumer scans — no tracking, no identity, no record
- Any personally identifying information about supply chain participants

### Why the retailer scan is the terminal event

The retailer is the last business participant before the product reaches the customer. Their scan is the final confirmation that the product moved through a legitimate supply chain. After that, the customer's job is only to verify — not to participate in the chain.

---

## Design Decisions

### Why not participant accounts?

The most complete solution would give transporters and retailers their own accounts, so every scan is cryptographically tied to an authenticated identity. This fully solves the "who scanned" trust problem.

However, this expands the scope significantly — it means building onboarding, authentication, and UX for three distinct user types instead of one. For v1, this is out of scope.

### Why not scan count for role determination?

An earlier approach inferred the participant's role from the scan count (scan #1 = transporter, scan #2 = retailer). This is simple but fragile — the role is inferred from position, not verified. A test scan by the SME after printing, or a double-scan by the transporter, would corrupt the chain.

### Chosen approach: Stage-based logic + handoff code gate

The system uses `currentStage` on each child QR to determine role explicitly. The enum has three values: `pending`, `transit`, `delivered`.

The critical guard is: **a `transit` unit only advances to `delivered` when the retailer enters the transporter's handoff code.** The retailer's scan alone changes nothing — it simply routes them to the code-entry screen. Confirmation (`POST /api/handoff/confirm`) validates the entered code against the `HandoffCode` linked to _that specific unit's_ transporter `ScanEvent`, then atomically marks it used, records the retailer `ScanEvent`, and advances the stage. The code is never matched globally, so 4-digit codes may safely collide across different units.

This means:

- The transporter cannot accidentally trigger the retailer stage (advancing requires the code, which only the retailer can enter)
- A random person who scans early gets treated as a transporter — but cannot advance further without the code
- Two parties must physically coordinate at each handoff — the code is the proof of that coordination
- The unit is advanced and the retailer scan recorded in a single transaction, so the chain can never be left half-confirmed

This gives 80% of the security benefit of participant accounts at a fraction of the scope cost. It fits the SME context where participants are known business contacts, not anonymous actors.

### JWT Secret: Dynamic Generation via Node.js `crypto`

The backend signs all JWT tokens with a `JWT_SECRET` loaded from `.env`. For a professional app, this secret must be:

1. **Unique per deployment** — not a shared constant that leaks through source control
2. **Cryptographically strong** — too long and random to brute-force even if the token format is known

The secret is generated once using Node.js's built-in `crypto` module:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

This produces 64 bytes (512 bits) of OS-level entropy, encoded as a 128-character hex string. `crypto` is part of Node.js — no package install required. The result goes into `.env` as `JWT_SECRET="..."` and is never committed to the repository.

**Why not `Math.random()`**: It is not cryptographically secure. Its output can be predicted from a seed, making it unsuitable for signing tokens.

**Why not a hardcoded fallback**: Code constants leak into git history and are visible to anyone who forks or reads the repo. The codebase previously fell back to `"super_secret_auditqr_key_2026"` — this has been replaced by the env value. If `JWT_SECRET` is missing at startup, the server will error rather than silently use a known default.

**Why not bcrypt**: bcrypt is a password hashing algorithm — it takes a known input and produces a slow, salted digest to resist brute-force attacks on a leaked password database. A JWT secret is not a hash of anything; it is a random key used directly as an HMAC-SHA256 signing input. bcrypt would require an arbitrary input to hash (defeating the point), its output is only 60 characters with a structured `$2b$12$...` prefix (less entropy than 128 hex chars), and its intentional slowness is irrelevant when a secret is generated once at setup time. `crypto.randomBytes()` is the correct primitive: it generates a raw key, not a hash of a key.

**Rotation warning**: Changing `JWT_SECRET` immediately invalidates all issued tokens — every logged-in user is logged out. Rotate only intentionally (e.g. after a suspected secret leak).

`.env` is listed in `backend/.gitignore` and must never be committed.

---

### Item Tracking Shows Units, Not Products

The Item Tracking page (`scan_events.html`) lists every **child QR code** (individual unit) across the supply chain — not every product. One product with 50 units generates 50 rows, each showing the product name alongside its unit number and current stage.

This is intentional. The SME needs per-unit visibility — knowing that "Vitamin C" has 50 units tells you nothing about which ones are in transit and which are pending. The dashboard gives aggregate counts per product; item tracking gives granular unit-level status so the SME can identify exactly which physical unit is at which point in the supply chain.

If the list appears to show duplicate products, it is because multiple units of the same product are being tracked simultaneously. The unit number column distinguishes them.

---

### Page Load Performance: Preconnect + Single Font Request

Every page previously made **two separate requests** to Google Fonts — one for text fonts (Space Grotesk, Noto Serif, JetBrains Mono) and one for Material Symbols Outlined. Each request is a full DNS lookup + TCP connection + TLS handshake, which on a 4G connection adds 200–400ms per request.

Two changes were applied across all pages:

1. **`preconnect` hints** added to `<head>` for `fonts.googleapis.com` and `fonts.gstatic.com`. The browser opens the connection to Google's font servers in parallel with HTML parsing, rather than waiting to discover the `<link>` tags.

2. **Both requests merged into one** by combining all font families into a single Google Fonts URL.

The remaining significant CDN load is Tailwind's play CDN, which recompiles the stylesheet at runtime in the browser on every page load. This is acceptable in development. Before production, run a Tailwind build (`npx tailwindcss -o style.css --minify`) and serve the compiled CSS file — this removes the runtime compilation cost entirely.

---

### Child QR Download: Single ZIP vs. Individual Files

**Rejected**: Triggering a separate browser download for each child QR image (one `<a>.click()` per image with a 150ms delay between each).

**Problem**: This causes the browser to show a separate save dialog for every single unit. A product with 50 units means 50 save dialogs. Unusable in practice.

**Chosen**: Use **JSZip** (client-side, CDN) to generate all child QR images in parallel via `Promise.all`, bundle them into a single `.zip` file in memory, then trigger one download using `URL.createObjectURL`. The user gets one file: `ProductName_QRCodes.zip` containing all individual PNGs.

The parent QR download was also patched — the anchor element must be appended to `document.body` before `.click()` and removed after, otherwise some browsers interpret the click as a navigation event and reload the page.

---

## Business Verification (CAC)

SME registration is gated on a **Corporate Affairs Commission (CAC)** check. A business cannot create an account unless its RC number resolves to an active CAC record whose business name matches what they entered. This is what makes the `isVerified` badge shown to customers meaningful — every registered SME has been checked against the registry.

### Flow

1. `register.html` collects business name, RC number, and (optionally) type/address, then calls `POST /api/sme/verify-cac`.
2. The backend looks up the RC number and validates each submitted field, returning a **field-specific** error (e.g. `field: "businessName"`) so the UI can highlight the exact wrong input without revealing the correct value.
3. On success the verified details are carried to `create_account.html`, which calls `POST /api/sme/register`. Registration re-runs the lookup server-side before persisting the SME with `isVerified: true`.

### Mock vs. production

The CAC integration is currently a **mock**, because direct CAC API access was not available. The implementation isolates this cleanly:

- `src/services/cacService.ts` — `lookupCAC()` is the only thing controllers call. It simulates network latency and returns a typed `LookupResult`.
- `src/data/cac-mock-db.json` — the seeded registry (10 sample Nigerian businesses).

To go live, swap the JSON lookup inside `cacService.ts` for an HTTP call to a real provider (e.g. Mono, Dojah) with credentials in `.env`. **No controller code changes** — the service boundary is the swap point.

---

## Architecture

- **Frontend**: Static HTML + Tailwind CSS + vanilla JS, served via Live Server
- **Backend**: Node.js + TypeScript + Express + Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **Blockchain**: Transaction hashes stored against scan events (`txHash` field on `ScanEvent`)
- **Auth**: JWT stored in `localStorage` as `auditqr_token`; `apiFetch()` helper attaches token to all API calls
- **QR Library**: `qrcodejs` from cdnjs
- **ZIP Library**: `JSZip` from cdnjs — used for client-side ZIP generation on the QR download page

---

## QR Code Structure

- **Parent QR**: Represents a batch (e.g. 100 units of Paracetamol)
- **Child QR**: Represents a single unit/item within that batch
- Each child QR tracks its own `currentStage`: `pending` → `transit` → `delivered`
- The SME dashboard shows **Units** (total child QRs) per product, not batches

---

## Key Pages

| Page                  | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `dashboard.html`      | SME overview — stats, recent scan activity, date filters |
| `products_list.html`  | All products with unit counts                            |
| `create_product.html` | Create a new product and generate QR batch               |
| `qr_ready.html`       | Download generated QR codes                              |
| `qr_scanner.html`     | Landing page for website QR scanning                     |
| `journey.html`        | Customer-facing product verification page                |
| `handoff.html`        | Transporter handoff confirmation flow                    |
| `scan_events.html`    | Full item tracking page for the SME                      |

---

## Testing QR Scanning on Mobile (Outray)

QR scanning must be tested on a real phone. Since the backend runs on `localhost:3000`, phones on a different network (or even the same one) can't reach it directly. Outray creates a temporary HTTPS tunnel to your local backend that any device can hit.

### How the QR codes work

Child QR codes encode a custom URI: `auditqr://verify?id=<childQRID>`. When a phone camera scans this, nothing happens — it's not an HTTP URL. Scanning only works through the in-app `qr_scanner.html` page, which parses the `auditqr://` scheme and submits the scan to the backend API.

### Setup

**1. Expose the backend via Outray**

```bash
# In the backend directory
npm run dev

# In a separate terminal
outray http 3000
```

Outray will print a forwarding URL like `https://a1b2-xxx.outray.app`. Copy it.

**2. Update the frontend API base**

In [frontend/config.js](../frontend/config.js), change:
```js
const API_BASE = "http://localhost:3000";
```
to:
```js
const API_BASE = "https://a1b2-xxx.outray.app";
```

**3. Access the frontend from your phone**

Live Server serves the frontend at `http://localhost:5500`, but your phone needs to reach it. Two options:

- **Same WiFi (simplest):** Find your laptop's LAN IP (`ipconfig` → IPv4 address). Open `http://192.168.x.x:5500/layout/qr_scanner.html` on the phone. Both devices must be on the same network.
- **Anywhere:** Run a second Outray tunnel: `outray http 5500`. Use that URL on the phone instead.

**4. Scan**

Open `qr_scanner.html` on the phone browser → allow camera → scan a printed or on-screen child QR code → the backend receives the scan via the Outray tunnel.

**5. Revert after testing**

Set `API_BASE` back to `"http://localhost:3000"` in `config.js` when done. The tunnel URL changes every session.

### Testing notes

_This section will be updated as live mobile testing progresses with Outray._

---

## Blockchain Architecture (Solana)

The target chain is **Solana** — chosen for low transaction fees and high throughput, which matters when writing a scan event per supply chain handoff.

### Two Types of On-Chain Writes

**1. QR Generation → Batch Registration Transaction**

When a parent QR (batch) is created, a single Solana transaction is written containing:

- The `parentQRID`
- An array of all child QR hashes (the individual units)
- The SME's identifier
- Timestamp

This is the **product registration proof** — one transaction covers an entire carton of N units. The aggregation keeps costs low and anchors every child unit to a single verifiable on-chain record.

The resulting `txHash` needs to be stored on `ParentQRCode` in the database (field not yet in schema — needs migration).

**2. Every Scan Event → Custody Transaction**

When a transporter or retailer scans, a lightweight Solana transaction is written:

```json
{
  "childQRID": "...",
  "parentQRID": "...",
  "timestamp": "...",
  "location": "...",
  "scanCount": 1
}
```

The `txHash` from this write is stored on the `ScanEvent` record (field already exists in schema).

The `parentQRID` reference ties every scan back to the original batch registration — giving a complete, independently verifiable chain of custody.

### What a Customer Can Verify

Opening the block explorer for a unit's scan tx, a customer can see:

> _"Unit #7 was scanned at Lagos, 2026-05-29, and it belongs to Parent Carton [hash], which was registered by SME [address] on [date]."_

This is the oracle proof — verifiable without trusting the AuditQR backend at all.

### Schema Changes Needed for Blockchain Integration

| Model          | Field to Add     | Purpose                                           |
| -------------- | ---------------- | ------------------------------------------------- |
| `ParentQRCode` | `txHash String?` | Stores the Solana tx hash from batch registration |
| `ScanEvent`    | `txHash String?` | Already exists ✓                                  |
