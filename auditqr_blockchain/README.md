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

| Current Stage | Role        | Action                                                                              |
| ------------- | ----------- | ----------------------------------------------------------------------------------- |
| `pending`     | Transporter | `ScanEvent` created, stage → `transit`, handoff code generated                      |
| `transit`     | Retailer    | Handoff code checked first — if confirmed, `ScanEvent` created, stage → `delivered` |
| `delivered`   | Customer    | Redirected to `journey.html` — no data stored                                       |

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

The critical guard is: **the retailer scan is rejected if the transporter's handoff code has not been confirmed.** Before advancing from `transit` → `delivered`, the backend checks that the `HandoffCode` linked to the transporter's `ScanEvent` has `isUsed: true`.

This means:

- The transporter cannot accidentally trigger the retailer stage (they'd need the handoff code confirmed first)
- A random person who scans early gets treated as a transporter — but cannot advance further without the code
- Two parties must physically coordinate at each handoff — the code is the proof of that coordination

This gives 80% of the security benefit of participant accounts at a fraction of the scope cost. It fits the SME context where participants are known business contacts, not anonymous actors.

### Child QR Download: Single ZIP vs. Individual Files

**Rejected**: Triggering a separate browser download for each child QR image (one `<a>.click()` per image with a 150ms delay between each).

**Problem**: This causes the browser to show a separate save dialog for every single unit. A product with 50 units means 50 save dialogs. Unusable in practice.

**Chosen**: Use **JSZip** (client-side, CDN) to generate all child QR images in parallel via `Promise.all`, bundle them into a single `.zip` file in memory, then trigger one download using `URL.createObjectURL`. The user gets one file: `ProductName_QRCodes.zip` containing all individual PNGs.

The parent QR download was also patched — the anchor element must be appended to `document.body` before `.click()` and removed after, otherwise some browsers interpret the click as a navigation event and reload the page.

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
