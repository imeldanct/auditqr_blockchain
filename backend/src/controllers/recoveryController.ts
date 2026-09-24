import { Request, Response } from "express";
import { Connection, PublicKey } from "@solana/web3.js";

const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const REQUEST_INTERVAL_MS = 500;
const RETRY_ATTEMPTS = 5;
const CACHE_DURATION_MS = 5 * 60 * 1000;

type AuditEvent = {
  signature: string;
  timestamp: string;
  eventType: "QR Generation" | "Transporter Scan" | "Retailer Scan";
  parentQRID: string;
  productName: string;
  location: string;
  businessName?: string;
  scannerRole?: "Transporter" | "Retailer";
};

type RecoveryResult = {
  walletAddress: string;
  totalTransactionsFound: number;
  events: AuditEvent[];
  recoveredAt: string;
};

let lastRequestAt = 0;
let cachedRecovery: RecoveryResult | null = null;
let cachedAt = 0;
let activeRecovery: Promise<RecoveryResult> | null = null;

function decodeBase58(value: string): Buffer {
  if (!value) return Buffer.alloc(0);

  let number = 0n;
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit === -1) throw new Error("Memo instruction contains invalid Base58 data.");
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

function parseAuditMemo(memo: string, signature: string): AuditEvent | null {
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
      scannerRole: fields[3] === "Transporter Scan" ? "Transporter" : "Retailer",
    };
  }

  return null;
}

function getMemoText(transaction: any): string | null {
  const message = transaction.transaction.message;
  const accountKeys: PublicKey[] = message.staticAccountKeys || message.accountKeys || [];
  const instructions = message.compiledInstructions || message.instructions || [];

  for (const instruction of instructions) {
    if (typeof instruction.programIdIndex !== "number") continue;

    const programId = accountKeys[instruction.programIdIndex];
    if (programId?.equals(MEMO_PROGRAM_ID)) {
      return typeof instruction.data === "string"
        ? decodeBase58(instruction.data).toString("utf8")
        : Buffer.from(instruction.data).toString("utf8");
    }
  }

  return null;
}

async function waitForRpcSlot(): Promise<void> {
  const waitMs = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestAt = Date.now();
}

async function withRpcRetry<T>(operation: () => Promise<T>, description: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      await waitForRpcSlot();
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    "Unable to " +
      description +
      " from Solana Devnet after " +
      RETRY_ATTEMPTS +
      " attempts: " +
      reason
  );
}

async function recoverFromDevnet(): Promise<RecoveryResult> {
  const walletAddress = process.env.SOLANA_PUBLIC_KEY;
  if (!walletAddress) {
    throw new Error("SOLANA_PUBLIC_KEY is missing from the backend environment.");
  }

  const wallet = new PublicKey(walletAddress);
  const connection = new Connection(DEVNET_RPC_URL, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
  const signatures = [];
  let before: string | undefined;

  while (true) {
    const page = await withRpcRetry(
      () => connection.getSignaturesForAddress(wallet, { before, limit: 1000 }, "confirmed"),
      "retrieve transaction signatures"
    );
    if (!page.length) break;
    signatures.push(...page);
    before = page[page.length - 1].signature;
  }

  const events: AuditEvent[] = [];
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

  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    walletAddress: wallet.toBase58(),
    totalTransactionsFound: signatures.length,
    events,
    recoveredAt: new Date().toISOString(),
  };
}

export const recoverAuditTrail = async (_req: Request, res: Response): Promise<void> => {
  try {
    const cacheIsFresh = cachedRecovery && Date.now() - cachedAt < CACHE_DURATION_MS;
    if (cacheIsFresh) {
      res.status(200).json({ ...cachedRecovery, cached: true });
      return;
    }

    if (!activeRecovery) {
      activeRecovery = recoverFromDevnet()
        .then((result) => {
          cachedRecovery = result;
          cachedAt = Date.now();
          return result;
        })
        .finally(() => {
          activeRecovery = null;
        });
    }

    const result = await activeRecovery;
    res.status(200).json({ ...result, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({
      error: "Could not recover the Solana Devnet audit trail.",
      detail: message,
    });
  }
};
