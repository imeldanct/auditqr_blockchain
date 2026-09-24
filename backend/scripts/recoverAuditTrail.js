/**
 * Recover AuditQR audit events from Solana Devnet using only the platform
 * wallet address. This utility exists to demonstrate that the blockchain
 * audit record can be rebuilt even if the PostgreSQL database is unavailable
 * or compromised. It does not connect to a database and does not import Prisma.
 *
 * getSignaturesForAddress returns at most 1,000 signatures per call. The
 * pagination loop below uses the oldest signature in each page as "before" to
 * continue backwards until Solana returns an empty page.
 *
 * Usage:
 *   node scripts/recoverAuditTrail.js <wallet-address>
 *   node scripts/recoverAuditTrail.js
 */

const fs = require("fs");
const path = require("path");
const { Connection, PublicKey } = require("@solana/web3.js");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const RPC_RETRY_ATTEMPTS = 5;
const MINIMUM_RPC_REQUEST_INTERVAL_MS = 500;
let lastRpcRequestAt = 0;

/**
 * Decodes the Base58 instruction data returned by getTransaction().
 * This is kept here to avoid a database dependency or an additional package.
 */
function decodeBase58(value) {
  if (!value) return Buffer.alloc(0);

  let number = 0n;
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit === -1) {
      throw new Error("Memo instruction contains invalid Base58 data.");
    }
    number = number * 58n + BigInt(digit);
  }

  let leadingZeroes = 0;
  while (value[leadingZeroes] === "1") leadingZeroes += 1;

  const hex = number.toString(16);
  const payload =
    number === 0n
      ? Buffer.alloc(0)
      : Buffer.from(hex.length % 2 === 0 ? hex : "0" + hex, "hex");

  return Buffer.concat([Buffer.alloc(leadingZeroes), payload]);
}

function getMemoText(transaction) {
  const message = transaction.transaction.message;
  const accountKeys = message.staticAccountKeys || message.accountKeys || [];
  const instructions = message.compiledInstructions || message.instructions || [];

  for (const instruction of instructions) {
    if (typeof instruction.programIdIndex !== "number") continue;

    const programId = accountKeys[instruction.programIdIndex];
    if (programId && programId.equals(MEMO_PROGRAM_ID)) {
      const data = instruction.data;
      if (typeof data === "string") {
        return decodeBase58(data).toString("utf8");
      }
      return Buffer.from(data).toString("utf8");
    }
  }

  return null;
}

function parseAuditMemo(memo, signature) {
  const fields = memo.split("|");
  if (fields[0] !== "AuditQR") return null;

  if (fields[1] === "QR Generation" && fields.length === 7) {
    return {
      signature,
      timestamp: fields[6],
      eventType: "QR Generation",
      parentQRID: fields[2],
      productName: fields[3],
      location: fields[5],
      businessName: fields[4],
    };
  }

  if (
    (fields[3] === "Transporter Scan" || fields[3] === "Retailer Scan") &&
    fields.length === 6
  ) {
    return {
      signature,
      timestamp: fields[5],
      eventType: fields[3],
      parentQRID: fields[1],
      productName: fields[2],
      location: fields[4],
      scannerRole:
        fields[3] === "Transporter Scan" ? "Transporter" : "Retailer",
    };
  }

  return null;
}

async function withRpcRetry(operation, description) {
  let lastError;

  for (let attempt = 1; attempt <= RPC_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const elapsedSinceLastRequest = Date.now() - lastRpcRequestAt;
      const waitBeforeRequest = Math.max(
        0,
        MINIMUM_RPC_REQUEST_INTERVAL_MS - elapsedSinceLastRequest
      );
      if (waitBeforeRequest > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitBeforeRequest));
      }
      lastRpcRequestAt = Date.now();
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < RPC_RETRY_ATTEMPTS) {
        const retryDelay = 1_000 * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    "Unable to " +
      description +
      " from Solana Devnet after " +
      RPC_RETRY_ATTEMPTS +
      " attempts: " +
      reason
  );
}

async function main() {
  const walletAddress = process.argv[2] || process.env.SOLANA_PUBLIC_KEY;
  if (!walletAddress) {
    throw new Error(
      "Missing wallet address. Pass it as the first argument or set SOLANA_PUBLIC_KEY in the environment."
    );
  }

  let wallet;
  try {
    wallet = new PublicKey(walletAddress);
  } catch (_) {
    throw new Error("The supplied wallet address is not a valid Solana public key.");
  }

  const connection = new Connection(DEVNET_RPC_URL, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
  const signatures = [];
  let before;

  while (true) {
    const page = await withRpcRetry(
      () =>
        connection.getSignaturesForAddress(
        wallet,
        { before, limit: 1000 },
        "confirmed"
        ),
      "retrieve transaction signatures"
    );

    if (page.length === 0) break;

    signatures.push(...page);
    before = page[page.length - 1].signature;
  }

  const events = [];

  for (const entry of signatures) {
    const transaction = await withRpcRetry(
      () =>
        connection.getTransaction(entry.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        }),
      "retrieve transaction " + entry.signature
    );

    if (!transaction) continue;

    const memo = getMemoText(transaction);
    if (!memo) continue;

    const event = parseAuditMemo(memo, entry.signature);
    if (event) events.push(event);
  }

  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  console.table(events);

  const outputPath = path.resolve(process.cwd(), "recovered-audit.json");
  fs.writeFileSync(outputPath, JSON.stringify(events, null, 2) + "\n", "utf8");

  const genesisEvents = events.filter((event) => event.eventType === "QR Generation").length;
  const transporterScans = events.filter(
    (event) => event.eventType === "Transporter Scan"
  ).length;
  const retailerScans = events.filter(
    (event) => event.eventType === "Retailer Scan"
  ).length;

  console.log(
    "\nSummary: " +
      signatures.length +
      " total transactions found; " +
      genesisEvents +
      " genesis events; " +
      transporterScans +
      " transporter scans; " +
      retailerScans +
      " retailer scans; wallet " +
      wallet.toBase58()
  );
  console.log("Recovered audit trail written to " + outputPath);
}

main().catch((error) => {
  console.error("Audit trail recovery failed: " + error.message);
  process.exitCode = 1;
});
