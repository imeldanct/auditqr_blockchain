# AuditQR — Blockchain-Backed Supply Chain Verification for SMEs

## Contents

- [Overview](#overview)
- [Core Problem: The Oracle Problem](#core-problem-the-oracle-problem)
- [Supply Chain Flow](#supply-chain-flow)
- [Scan Stage Logic](#scan-stage-logic)
- [Design Decisions](#design-decisions)
  - [Why not participant accounts?](#why-not-participant-accounts)
  - [Stage-based logic + handoff code gate](#chosen-approach-stage-based-logic--handoff-code-gate)
  - [Tailwind CSS: CDN → CLI Build](#tailwind-css-cdn--cli-build)
  - [Account Settings: Scope Decision](#account-settings-scope-decision)
- [Blockchain Architecture (Solana)](#blockchain-architecture-solana)
- [Architecture](#architecture)
- [QR Code Structure](#qr-code-structure)
  - [Why the scanner only accepts child QRs](#why-the-scanner-only-accepts-child-qrs)
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
      │ generates QR codes → genesis event recorded
      │   ├── Parent QR (carton label, 1 per batch)  → affixed to the outer carton
      │   └── Child QRs (item stickers, N per batch) → affixed to individual units
      │
Transporter
      │ scans Parent QR with any camera → ScanEvent saved to DB → lands on handoff.html
      │ confirms pickup → blockchain write → sees 4-digit handoff code on handoff_code.html
      │ shares code with retailer
      │
Retailer
      │ scans Parent QR with any camera → lands on code.html
      │ enters 4-digit code + confirms receipt → ScanEvent saved to DB + blockchain write
      │ batch stage advances to `delivered` → retailer_confirmed.html
      │
Customer
        scans Child QR with any camera → journey.html (read-only)
                                          no API write, no record stored, ever.
```

### Two QR types, two different scan paths

| QR Type | Format | Who scans it | What happens |
|---------|--------|-------------|--------------|
| **Parent QR** (carton label) | `<frontendBase>/layout/journey.html?parentId=<uuid>` | Transporter, then Retailer — any scanner | Stage-based flow — recorded in DB and blockchain, advances `currentStage` on the batch |
| **Child QR** (item sticker) | `<frontendBase>/layout/journey.html?childId=<uuid>` | Customer — any scanner | Opens `journey.html` directly — read-only, nothing recorded |

Both QR types encode real HTTPS URLs. Any phone camera can scan them without a dedicated app — no dedicated scanner app required.

**Parent QR** encodes `<frontendBase>/layout/handoff.html?parentId=<uuid>`. When opened (by any camera), `handoff.html` checks the batch's current stage and routes accordingly:
- `pending` → show transporter content (confirm pickup → generate handoff code)
- `transit` → redirect to `code.html` (enter handoff code → confirm receipt)
- `delivered` → redirect to `journey.html?parentId=<uuid>` (read-only audit trail)

**Child QR** encodes `<frontendBase>/layout/journey.html?childId=<uuid>`. Opens the journey page directly with no routing step — always read-only.

### Scan Role Determination (Parent QR only)

The system determines the participant's role automatically based on the `currentStage` of the **batch** (ParentQRCode):

| Current Stage | Role        | Landing page | Action |
| ------------- | ----------- | ------------ | ------ |
| `pending`     | Transporter | `handoff.html` | `ScanEvent` saved to DB at scan time; transporter confirms pickup → blockchain write fires → sees 4-digit handoff code on `handoff_code.html` to share with retailer |
| `transit`     | Retailer    | `code.html` (redirected from `handoff.html`) | Retailer enters the transporter's code and confirms receipt → `POST /api/handoff/confirm` → retailer `ScanEvent` saved to DB + blockchain write → stage advances to `delivered` → `retailer_confirmed.html` |
| `delivered`   | Anyone      | `journey.html?parentId=<uuid>` (redirected from `handoff.html`) | No further stage change — read-only audit trail shown |

### Two-step recording logic

Every scan event is recorded in two places: the database and the blockchain. The timing differs deliberately:

- **Database write — at scan time (transporter) or at code confirmation (retailer).** The DB record is fast and captures the event the moment it happens. For the transporter, this is when the QR is scanned. For the retailer, the DB record is only created once the handoff code is validated — because the code is the proof that the handover actually happened.

- **Blockchain write — at confirmation for both roles.** The transporter's blockchain write fires when they tap confirm on `handoff.html`. The retailer's fires when they enter the code and tap confirm on `code.html`. The confirmation is a deliberate physical action — tapping that button is the participant saying "I acknowledge this." That consent is what the blockchain record represents, not just the presence of a scan.

---

## Data Model Decisions

### What is stored

- `ScanEvent`: references `parentQRID`, scanner role (transporter/retailer), IP address, timestamp, optional blockchain tx hash
- `HandoffCode`: a 4-digit confirmation code generated at the transporter scan, required to be entered by the retailer — this is the multiparty confirmation step

### What is NOT stored

- Customer/consumer scans — no tracking, no identity, no record
- Any personally identifying information about supply chain participants

### Stage on the batch, not the unit

Stage tracking (`currentStage: pending | transit | delivered`) lives on **`ParentQRCode`**, not on individual `ChildQRCode` records. This matches physical reality: the transporter picks up the whole carton, not individual items. Scan events reference `parentQRID` and reflect the state of the whole batch. Individual Child QRs are read-only windows into that same journey.

### Optional product fields

The `Product` model includes three optional fields that SMEs can supply at creation time:

| Field | Type | Purpose |
|-------|------|---------|
| `weight` | `Float?` | Unit weight in kg — displayed on handoff.html and code.html for supply chain participants |
| `mfgDate` | `DateTime?` | Manufacture date — displayed alongside product info; expiry date must be after this date (validated on the frontend before submission) |
| `expDate` | `DateTime?` | Expiry date — displayed alongside product info |

All three are nullable. Products created without them still work normally; the fields simply don't render on the handoff/verification pages. The `productPayload` helper in `scanController.ts` always includes them in the scan response so the frontend can show or hide them based on null checks.

---

### Genesis event

Every product journey begins with the QR generation itself. The genesis event is not a `ScanEvent` — it is the `ParentQRCode.createdAt` timestamp, always shown as the first entry in `journey.html`. This gives customers visibility that the product was registered and verified before it even moved.

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

The system uses `currentStage` on the **batch** (`ParentQRCode`) to determine role explicitly. The enum has three values: `pending`, `transit`, `delivered`.

The critical guard is: **a `transit` batch only advances to `delivered` when the retailer enters the transporter's handoff code.** The retailer's scan alone changes nothing — it simply routes them to the code-entry screen. Confirmation (`POST /api/handoff/confirm`) validates the entered code against the `HandoffCode` linked to that batch's transporter `ScanEvent`, then atomically marks it used, records the retailer `ScanEvent`, and advances the stage. The code is never matched globally, so 4-digit codes may safely collide across different batches.

This means:

- The transporter cannot accidentally trigger the retailer stage (advancing requires the code, which only the retailer can enter)
- A random person who scans a Parent QR early gets treated as a transporter — but cannot advance further without the code
- Two parties must physically coordinate at each handoff — the code is the proof of that coordination
- The batch advances and the retailer scan is recorded in a single transaction, so the chain can never be left half-confirmed
- Customer-facing Child QRs are always read-only; scanning a Child QR never changes any stage

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

The Tailwind CDN has since been replaced with a proper CLI build (see below) — the runtime recompilation cost no longer applies.

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

### Tailwind CSS: CDN → CLI Build

The frontend originally used **Tailwind Play CDN** — a single `<script>` tag that compiles Tailwind in the browser at runtime. This was fine for early prototyping.

It has two real costs that became problems as the project grew:

1. **Runtime overhead** — The CDN recompiles the entire stylesheet on every page load. On a slow mobile connection this adds visible delay.
2. **Config duplication** — Because the CDN requires the theme config (custom colours, fonts, sizes) to be defined inline as a `tailwind.config` object, every HTML file had to carry its own copy of the full design token block. Any change had to be replicated across 20+ files.
3. **No responsive prefixes in style blocks** — Media query overrides (e.g. making a heading smaller on mobile) had to live in `<style>` blocks rather than Tailwind's `sm:` / `md:` prefixes, because the CDN couldn't pick them up from outside the HTML attributes it scanned.

**What changed:**

| File | Role |
|------|------|
| `frontend/tailwind.config.js` | Single source of truth for all design tokens — colours, fonts, font sizes, border radii |
| `frontend/tailwind.input.css` | Source file — just the three `@tailwind` directives |
| `frontend/tailwind.css` | Compiled output. Never hand-edited. Committed before deploy. |
| `frontend/package.json` | Defines `watch:css` and `build:css` scripts |

**Development workflow:** run `npm run watch:css` inside `/frontend` alongside Live Server. The watcher rebuilds `tailwind.css` whenever any HTML file changes, keeping responsive prefixes (`sm:`, `md:`) and arbitrary values (`pt-[max(18vh,90px)]`) in sync.

**Production:** run `npm run build:css` once before deploying. This produces a minified `tailwind.css` with only the classes actually used in the HTML — no unused rules shipped.

The CDN `<script>` block and its inline config were removed from all 20 HTML pages. Every page now links `../tailwind.css` and `../design-tokens.css` in `<head>`.

---

### Account Settings: Scope Decision

The SME dashboard sidebar includes an **Account Settings** page. The scope of what's editable was a deliberate decision.

**What is editable:**
- **Business display name** — pre-filled from the API on load; the SME can update it if their trading name changes
- **Contact email** — pre-filled; used for login and notifications
- **Password** — both the current password field and the new password field are left empty intentionally. The user must type their current password to prove identity before a change is accepted. This is standard security practice — never pre-fill passwords, never skip the current-password check

**What is not editable:**
- **RC number (CAC number)** — this is the verified identity anchor of the business record. It was confirmed against the CAC registry at registration and cannot be changed through the UI. Changing it would mean the account is no longer tied to the same legal entity.

**Why no team/staff access:**
Only SMEs have accounts in this system. Distributors and retailers scan QR codes without logging in — they are participants in the supply chain, not platform users. There is no multi-user access pattern to support in v1, so team management was ruled out entirely rather than built as a stub.

**How updates work:**
The settings page fetches the current SME profile from `GET /api/sme/profile` on load. On load, the Business Name, Contact Email, and RC Number fields display a skeleton shimmer animation while the request is in flight. Once the response arrives the real values replace the skeleton. Password fields are intentionally left empty — the user must type their current password to prove identity before a change is accepted. On save, a `PATCH /api/sme/profile` call updates only the changed fields. Password changes go through `PATCH /api/sme/password`, which verifies the current password server-side before hashing and storing the new one.

---

## Architecture

- **Frontend**: Static HTML + Tailwind CSS (CLI build) + vanilla JS, served via Live Server
- **Backend**: Node.js + TypeScript + Express + Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **Blockchain**: Transaction hashes stored against scan events (`txHash` field on `ScanEvent`)
- **Auth**: JWT stored in `localStorage` as `auditqr_token`; `apiFetch()` helper attaches token to all API calls
- **QR Generator**: `qrcodejs` from cdnjs — generates QR code images on the client
- **QR Scanner**: `jsQR 1.4.0` from cdnjs — decodes QR codes from camera frames in `qr_scanner.html`
- **ZIP Library**: `JSZip` from cdnjs — used for client-side ZIP generation on the QR download page
- **Icon Font**: `material-symbols` npm package (self-hosted) — the `.woff2` variable font file is copied from `node_modules/material-symbols/` into `frontend/fonts/material-symbols-outlined.woff2` and referenced via `@font-face` in `design-tokens.css`; no CDN dependency at runtime. The copy step is necessary because `node_modules/` is not served as a web path by Live Server or Outray tunnels
- **Skeleton loading states**: all pages that fetch data on load show a shimmer placeholder animation while the API request is in flight. The `.skeleton` utility class is defined in `design-tokens.css`. Setting `textContent` or `innerHTML` on the element automatically clears the skeleton and shows real data once it arrives. This was extended to `handoff.html` (transporter page) and `code.html` (retailer code-entry page) after the initial "—" dash placeholder was identified as poor UX — a blank dash gives no visual feedback that content is actually loading, whereas a skeleton shimmer communicates that the page is working

---

## QR Code Structure

**The Parent QR is the supply chain actor (changes product state), and the Child QR is the verification tool (read-only journey view for whoever holds the product).**

- **Parent QR** (carton label): Represents a batch. Encodes a real URL — `<frontendBase>/layout/handoff.html?parentId=<parentQRID>`. Affixed to the outer shipping carton. Scanned by **transporters and retailers** using any camera — `handoff.html` checks the current stage on load and routes to the correct page for that role.
- **Child QR** (item sticker): Represents a single unit within that batch. Encodes a real URL — `<frontendBase>/layout/journey.html?childId=<childQRID>`. Affixed to individual items. Scanned by **customers** — any native camera or the AuditQR scanner opens the read-only journey page directly. No stage data is changed when a Child QR is scanned.
- `currentStage` lives on `ParentQRCode` (the batch), not on individual units: `pending` → `transit` → `delivered`
- The SME dashboard shows **Units** (total child QRs) per product, not batches; stage counts reflect how many units belong to a batch at each stage

Both QR types encode real HTTPS URLs so that a native phone camera can open them without a dedicated app. The AuditQR scanner (`qr_scanner.html`) is limited to Child QRs only — scanning a `childId` opens `journey.html` with no API write. Parent QRs are meant for supply chain actors (transporters, retailers) who use any phone camera; the encoded `handoff.html?parentId=` URL opens directly and `handoff.html` handles all stage-based routing itself.

**Why Child QRs are read-only:** The Child QR is an item-level proof of authenticity for the customer. By the time a customer has the product in hand and scans their individual item, the supply chain handoffs have already been recorded via the Parent QR (carton) scans. The Child QR simply surfaces that history. Scanning a Child QR triggers no API write — it resolves through the parent to display the journey.

**Why transporters and retailers scan the Parent QR, not each Child QR:** The transporter picks up and delivers the whole carton, not individual items. Stage tracking at the batch level reflects this physical reality — one scan confirms the entire shipment changed hands. If tracking were per-item (via Child QRs), the transporter would need to scan every single unit before it left the warehouse, which is impractical. The batch scan is one action that advances the entire consignment.

---

## Sprint Implementation Log

Documents how each sprint was built and what files were touched. Sprint 5 includes a step-by-step guide for completion.

---

### Sprint 1 — SME Registration and Authentication

**What was built:** Business registration form, CAC verification, JWT login and session management.

**How it was achieved:**

1. Created `backend/src/services/cacService.ts` — `lookupCAC()` function that checks an RC number against `src/data/cac-mock-db.json`. Returns a typed result with field-specific errors (e.g. `field: "businessName"`) so the UI highlights the exact wrong input.
2. Created `backend/src/controllers/smeController.ts` — `verifyCac`, `register`, `login`, `getProfile`, `updateProfile`, `updatePassword` endpoints.
3. Created `backend/src/routes/smeRoutes.ts` — wires routes to controller. Auth-protected routes go through `authMiddleware.ts`.
4. Created `backend/src/middleware/authMiddleware.ts` — verifies the JWT from the `Authorization` header and attaches `req.smeId` to the request.
5. JWT secret generated once via `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and stored in `.env` as `JWT_SECRET`.
6. Frontend pages built: `register.html` (CAC check → passes verified details to next page), `create_account.html` (completes registration), `login.html` (login → stores token in `localStorage` as `auditqr_token`).
7. `frontend/config.js` created — exports `API_BASE`, `FRONTEND_BASE`, and `apiFetch()` (attaches JWT to every API call, redirects to login on 401).

---

### Sprint 2 — QR Code Generation

**What was built:** Create product form, Parent and Child QR code generation, QR download page.

**How it was achieved:**

1. Created `backend/src/controllers/productController.ts` — `createProduct`, `getProducts`, `deleteProduct` endpoints. Product has optional fields: `weight`, `mfgDate`, `expDate`.
2. Created `backend/src/controllers/qrController.ts` — `generateQR` endpoint. Takes a `quantity`, creates one `ParentQRCode` row and N `ChildQRCode` rows via `createMany`. Parent encodes `handoff.html?parentId=<uuid>`, each child encodes `journey.html?childId=<uuid>` — both as full HTTPS URLs using `FRONTEND_BASE` from `.env`.
3. Frontend pages built: `create_product.html` (form with validation — expiry must be after manufacture date), `qr_ready.html` (shows parent QR + all child QRs, downloads child QRs as a single ZIP using JSZip).

---

### Sprint 3 — Handoff Protocol

**What was built:** Camera-based QR scanner, handoff code generation, supply chain stage progression.

**How it was achieved:**

1. Extended `backend/src/controllers/scanController.ts`:
   - `recordScan` — called when a Parent QR is scanned. If `currentStage` is `pending`, creates a `ScanEvent` with `scannerRole: "transporter"` and advances stage to `transit`. If `transit`, checks a handoff code exists and returns `needsConfirmation: true`.
   - `generateHandoffCode` — creates a 4-digit `HandoffCode` record linked to the transporter's `ScanEvent`. Idempotent — returns existing code if already generated.
   - `confirmHandoff` — validates the entered code against the stored `HandoffCode`, marks it used, creates a `ScanEvent` with `scannerRole: "retailer"`, advances stage to `delivered`. All three DB writes happen atomically in sequence.
2. Frontend pages built: `handoff.html` (entry point for any Parent QR scan — routes by stage), `handoff_code.html` (displays 4-digit code to transporter), `code.html` (retailer enters code), `retailer_confirmed.html` (retailer success screen).
3. `qr_scanner.html` built — uses `jsQR` to decode Child QR codes from camera frames and redirect to `journey.html`. Restricted to Child QRs only.

---

### Sprint 4 — Customer Journey Display

**What was built:** Customer-facing product journey timeline, SME dashboard, full products list, account settings.

**How it was achieved:**

1. Extended `scanController.ts`:
   - `getScanHistory` — returns all scan events for a Parent QR, ordered by timestamp, alongside product details.
   - `getJourneyForChildQR` — looks up a Child QR, walks up to its Parent QR, and returns the same scan history. This is what the customer-facing journey page calls.
2. Extended `smeController.ts`:
   - `getStats` — returns pending, in-transit, and delivered counts for the SME's dashboard stat cards.
   - `getItems` — returns all Child QR codes grouped by product, with current stage and last scan time, for the activity table.
3. Frontend pages built:
   - `journey.html` — customer-facing, read-only. Shows genesis event (QR creation), then each transporter/retailer scan event in a timeline. Opened by Child QR.
   - `dashboard.html` — SME overview. Three stat cards (pending/transit/delivered), recent products table, recent activity table. All show skeleton shimmer while loading.
   - `products_list.html` — full product list with live search and date filter. Delete product via modal.
   - `account_settings.html` — business name and email editable (pre-filled from API on load with skeleton states). RC number read-only. Password change requires current password.
   - `scan_events.html` — per-unit item tracking page for the SME.

---

### Sprint 5 — Blockchain Logging

**What was built:** Three events in a product's lifecycle are permanently recorded as memo transactions on a local Solana validator — QR code generation (genesis), transporter pickup, and retailer handoff confirmation. Transaction hashes are stored in the database and surfaced as "View on blockchain explorer" links on the customer-facing journey page, giving every product an immutable, three-point audit trail from creation to delivery.

**Decision — Local test validator, not Devnet**

Two options were considered:

- **Solana Devnet** — public test network requiring a funded wallet and active internet per transaction. Rejected because the RPC returned connection errors during development, and Nigerian mobile hotspot networks block the Devnet RPC endpoint (same network-level blocking as the Supabase port 6543 issue).
- **Local test validator** (`solana-test-validator`) — runs on `localhost:8899`, no internet dependency, unlimited SOL, near-instant confirmations.

The local validator was chosen for reliability. Switching to Devnet later is a one-line change in `solanaService.ts` (change the `Connection` URL) and a one-word change in `config.js` (change `SOLANA_CLUSTER`).

**How it was achieved:**

1. **Solana CLI installed** via Ubuntu (WSL). The CLI runs inside WSL; because WSL2 exposes its ports to Windows via `localhost`, the Windows backend can reach the validator at `http://localhost:8899`.

2. **Keypair generated** using `@solana/web3.js` — no CLI needed:
   ```bash
   node -e "const {Keypair} = require('@solana/web3.js'); const kp = Keypair.generate(); console.log('SECRET:', Buffer.from(kp.secretKey).toString('base64')); console.log('ADDRESS:', kp.publicKey.toBase58());"
   ```
   The secret key (64 bytes, base64-encoded) and public key (wallet address) were added to `.env` as `SOLANA_KEYPAIR` and `SOLANA_PUBLIC_KEY`.

3. **`src/services/solanaService.ts` created** — two exported functions:
   - `writeGenesisToChain(parentQRID)` — writes `AUDITQR|parentQRID|genesis|timestamp` to the SPL Memo program. Called after every QR batch is created.
   - `writeScanToChain(parentQRID, role, ip)` — writes `AUDITQR|parentQRID|role|ip|timestamp`. Called after transporter and retailer scan events.
   Both return the transaction signature on success, `null` on failure — a Solana outage never blocks a scan or QR generation.

4. **`qrController.ts` updated** — after `prisma.parentQRCode.create()`, `writeGenesisToChain()` is fired in the background without `await`. When it resolves, `prisma.parentQRCode.update()` saves the `genesisTxHash`. The QR generation endpoint responds immediately.

5. **`scanController.ts` updated** — after each `prisma.scanEvent.create()` in `recordScan` (transporter) and `confirmHandoff` (retailer), `writeScanToChain()` is fired in the background without `await`. When it resolves, `prisma.scanEvent.update()` saves the `txHash`. The scan endpoint responds immediately — blockchain write never adds latency.

6. **Schema migration** — `genesisTxHash String?` added to `ParentQRCode`. Migration applied via `npx prisma migrate deploy` (not `migrate dev`, to avoid triggering a database reset prompt on a live database with existing records).

7. **API responses updated** — both `getScanHistory` and `getJourneyForChildQR` now include `genesisTxHash: parentQR.genesisTxHash ?? null` alongside each scan event's `txHash: e.txHash ?? null`.

8. **`journey.html` updated** — the genesis entry and each scan event entry show a "View on blockchain explorer" link if a `txHash` exists, or a muted "Recording to chain…" if still in flight. Both use `solanaExplorerTx()` from `config.js` (see below) so the link always points to the correct cluster.

9. **`qr_ready.html` updated** — after QR codes are generated, the page polls `GET /api/scan/history/:parentQRID` every 3 seconds until `genesisTxHash` appears, then displays it in green. This gives the manufacturer immediate feedback that their batch has been recorded on-chain.

**Decision — Cluster-aware explorer links via `config.js`**

Every "View on blockchain explorer" link in the frontend uses the transaction hash directly in the URL. The correct URL format differs per environment:

- **Local validator:** `https://explorer.solana.com/tx/{hash}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
- **Devnet:** `https://explorer.solana.com/tx/{hash}?cluster=devnet`
- **Mainnet:** `https://explorer.solana.com/tx/{hash}`

Rather than hardcode one URL format in every file that links to the explorer, a `solanaExplorerTx(txHash)` helper function was added to `frontend/config.js`. It reads a `SOLANA_CLUSTER` constant (also in `config.js`) and constructs the correct URL.

This means moving from local to Devnet is a single line change in `config.js`:
```js
const SOLANA_CLUSTER = "devnet"; // was "custom"
```

Every explorer link across `journey.html`, `products_list.js`, and any future page automatically inherits the new cluster without touching those files. Hardcoding the URL in each file would require finding and updating every occurrence each time the environment changes.

**Decision — `confirm_parentQRID` in localStorage**

The retailer confirmation page (`retailer_confirmed.html`) needs to show a "View on blockchain explorer" link for the retailer's scan event. The problem: that txHash is written to the database *after* the confirmation response returns, in the background. By the time the page loads, the txHash does not exist yet.

The page needs to poll `GET /api/scan/history/:parentQRID` until the txHash appears — but it has no way to know which `parentQRID` to poll for, because `retailer_confirmed.html` is a static success screen with no URL parameters.

The fix: in `code.html`, immediately before navigating to `retailer_confirmed.html`, save the `parentQRID` to `localStorage` under the key `confirm_parentQRID`. On `retailer_confirmed.html`, read that key and start polling. Once the retailer txHash is found, the "View on blockchain explorer" link replaces the "Recording to chain…" placeholder and the key is removed from `localStorage`.

This is the same pattern used for the genesis txHash on `qr_ready.html` — poll until the background write resolves, then update the UI. The alternative (waiting for the blockchain write before responding) would add 1–3 seconds of latency to every retailer confirmation and block the page from loading. That is not acceptable.

**To run the validator (every session):**

Open Ubuntu terminal, **from the home directory**:
```bash
cd ~
solana-test-validator
```
In a second Ubuntu terminal, fund the wallet once per fresh validator instance:
```bash
solana airdrop 10 6hj8FdphtVYKGpN8Q3J1zAcFkmeqwruCZzr1LgvgqHT5 --url localhost
```
Then start the backend as normal. The validator must stay running alongside the backend.

---

## Key Pages

| Page                  | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `landing.html`           | Public landing page — product scan button, feature overview  |
| `dashboard.html`         | SME overview — stats, recent scan activity, date filters     |
| `products_list.html`     | All products with unit counts                                |
| `create_product.html`    | Create a new product and generate QR batch                   |
| `qr_ready.html`          | Download generated QR codes                                  |
| `qr_scanner.html`        | Website QR scanner — Child QRs only, opens journey.html      |
| `journey.html`           | Customer-facing product verification page (read-only)        |
| `handoff.html`           | Entry point for any Parent QR scan — checks stage and routes to transporter UI (pending), code.html (transit), or journey.html (delivered) |
| `handoff_code.html`      | Transporter success page — displays 4-digit handoff code to pass to retailer |
| `code.html`              | Retailer entry page — enter handoff code to confirm receipt  |
| `retailer_confirmed.html`| Retailer success screen after confirmed delivery             |
| `scan_events.html`       | Full item tracking page for the SME                          |
| `account_settings.html`  | Change business name, email, and password                    |

---

## Testing QR Scanning on Mobile (Outray)

QR scanning must be tested on a real phone. Since the backend runs on `localhost:3000`, phones on a different network (or even the same one) can't reach it directly. Outray creates a temporary HTTPS tunnel that exposes your local servers to the internet via a public URL any device can hit.

### How the QR codes work

Both Parent and Child QR codes encode real HTTPS URLs pointing to the frontend tunnel. A native phone camera can open them directly — Child QRs open `journey.html` immediately (read-only, no API write). Parent QRs open `handoff.html?parentId=` directly; `handoff.html` calls `GET /api/scan/stage/:parentQRID` on load and routes to the correct page based on the current stage. The AuditQR website scanner (`qr_scanner.html`) is restricted to Child QRs only.

### Setup

**1. Install Outray and log in**

```bash
npm install -g outray
npx outray login
```

Use `npx outray` instead of `outray` directly — Git Bash on Windows doesn't always add npm's global bin folder to its PATH, so the bare `outray` command may not be found. `npx` bypasses that.

Logging in opens a browser tab. Authenticate there, then return to the terminal.

**2. Start the backend**

```bash
# In the backend directory
cd backend
npm run dev
```

Confirm it's listening on port 3000 before moving on.

**3. Expose the backend via a tunnel**

```bash
# In a new terminal
npx outray http 3000
```

Outray prints a public URL like `https://a1b2-xxx.outray.app`. This punches through your local network and makes your Express backend reachable from any device. Copy the URL.

**4. Update the frontend config**

In [frontend/config.js](../frontend/config.js), update both URLs — they change every Outray session:
```js
const API_BASE = "https://a1b2-xxx.outray.app";      // backend tunnel (port 3000)
const FRONTEND_BASE = "https://b3c4-xxx.outray.app/auditqr_blockchain/frontend"; // frontend tunnel (port 5500)
```

`API_BASE` is used for all backend API calls. `FRONTEND_BASE` is embedded inside the QR codes themselves — it must be a URL reachable from the scanning device, so localhost won't work here.

**5. Start Live Server in VS Code**

Click **Go Live** in VS Code's bottom status bar. This serves the frontend on port 5500. Live Server must be running before the next step — the tunnel has nothing to connect to otherwise.

**6. Expose the frontend via a second tunnel**

```bash
# In another new terminal
npx outray http 5500
```

Outray prints a second public URL. Open that URL on your phone and append the path to the scanner page:

```
https://b3c4-xxx.outray.app/auditqr_blockchain/frontend/layout/qr_scanner.html
```

**7. Scan**

On your phone: allow camera access → scan a printed or on-screen child QR code → the scan is submitted to the backend through the first tunnel.

**8. Revert after testing**

Set `API_BASE` back to `"http://localhost:3000"` in `config.js` when done. Both tunnel URLs change every session.

### Why two tunnels?

Two servers are running locally — the Express backend on port 3000 and Live Server on port 5500. Each needs its own tunnel. The backend tunnel URL goes into `config.js` so API calls reach Express. The frontend tunnel URL is what you open on your phone to load the HTML pages.

```
Phone browser
  → frontend tunnel (5500) → Live Server → HTML/JS files
  → JS calls API_BASE      → backend tunnel (3000) → Express → Supabase
```

### Known issues

**Supabase port 6543 blocked on mobile hotspot (Nigeria)**

Nigerian mobile carriers block port 6543, which is the default PgBouncer transaction pooler port in Supabase connection strings. The backend will start but every database query fails with a `P1001: Can't reach database server` error.

Fix: in `.env`, change `DATABASE_URL` from port `6543` to port `5432` on the same host:

```
# Wrong (blocked on mobile hotspot)
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-eu-west-2.pooler.supabase.com:6543/postgres"

# Correct (session pooler — same host, different port)
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-eu-west-2.pooler.supabase.com:5432/postgres"
```

Port 5432 uses the session pooler instead of the transaction pooler. Both are on the same Supabase pooler host — only the port differs. This fix is only needed when running over a mobile hotspot; a standard broadband connection works on either port.

**Live Server reloading constantly when Solana validator is running**

Running `solana-test-validator` from inside the project directory creates a `test-ledger/` folder at that location. The validator writes to this folder continuously as it processes slots. Live Server watches the entire project directory for file changes, so every validator write triggers a page reload — making the frontend unusable while the validator is running.

Fix: always start `solana-test-validator` from the Ubuntu home directory, not from within the project:

```bash
cd ~
solana-test-validator
```

This places `test-ledger/` in the home directory where Live Server cannot see it. If `test-ledger/` was already created inside the project directory, delete it:

```bash
rm -rf /mnt/c/Users/user/Documents/Dev-ing/qr-code-blockchain/test-ledger
```

---

## Blockchain Architecture (Solana)

The target chain is **Solana** — chosen for low transaction fees and high throughput, which matters when writing a scan event per supply chain handoff.

### Development Environment: Local Test Validator (not Devnet)

During development, blockchain writes target a **local Solana test validator** (`solana-test-validator`) running on `http://localhost:8899` rather than the public Solana Devnet.

**Why local over Devnet:**

- **No internet dependency** — Devnet RPC endpoints are blocked on Nigerian mobile hotspot networks (same class of issue as the Supabase port 6543 problem). The local validator has no network dependency at all.
- **Unlimited SOL** — Devnet requires requesting free SOL from a public faucet, which has rate limits and requires an internet connection. The local validator funds wallets instantly with no limits.
- **Faster confirmation** — Devnet transactions confirm in 1–3 seconds over the internet. Local validator confirmations are near-instant.
- **Demo reliability** — The system works regardless of network conditions during presentations or testing. Devnet introduces an external point of failure.

The tradeoff is that transactions are not publicly visible on a block explorer during development. This is acceptable for testing. Before final submission, change the connection string in `solanaService.ts` from `http://localhost:8899` to `https://api.devnet.solana.com` to switch to the public Devnet in one line.

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
