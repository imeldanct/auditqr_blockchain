import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function getKeypair(): Keypair {
  const raw = process.env.SOLANA_KEYPAIR;
  if (!raw) throw new Error("SOLANA_KEYPAIR not set in environment");
  return Keypair.fromSecretKey(Buffer.from(raw, "base64"));
}

// Retries a transient send failure (RPC blip, momentary congestion) a few times
// before giving up. Rebuilds the transaction fresh each attempt — reusing one
// across retries risks sending a transaction with a stale blockhash.
async function sendMemoWithRetry(memo: string): Promise<string | null> {
  let keypair: Keypair;
  try {
    keypair = getKeypair();
  } catch (err) {
    console.error("Solana write failed — keypair not configured:", err);
    return null;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tx = new Transaction().add(
        new TransactionInstruction({
          keys: [],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(memo, "utf-8"),
        })
      );
      return await sendAndConfirmTransaction(connection, tx, [keypair]);
    } catch (err) {
      console.error(`Solana write attempt ${attempt}/${MAX_RETRIES} failed:`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  return null;
}

export async function writeGenesisToChain(
  parentQRID: string,
  productName: string,
  businessName: string,
  businessAddress?: string | null
): Promise<string | null> {
  const location = businessAddress ?? "address-unavailable";
  const memo = `AuditQR|QR Generation|${parentQRID}|${productName}|${businessName}|${location}|${new Date().toISOString()}`;
  return sendMemoWithRetry(memo);
}

export async function writeScanToChain(
  parentQRID: string,
  productName: string,
  scannerRole: string,
  gpsLocation: string | null
): Promise<string | null> {
  const roleLabel = scannerRole === "transporter" ? "Transporter Scan" : "Retailer Scan";
  const location = gpsLocation ?? "location-unavailable";
  const memo = `AuditQR|${parentQRID}|${productName}|${roleLabel}|${location}|${new Date().toISOString()}`;
  return sendMemoWithRetry(memo);
}

// Sweeps for genesis/scan records whose blockchain write never landed — even
// after the inline retries above — and attempts them again. Meant to be hit
// periodically (e.g. by an external uptime pinger) so an outage that outlasts
// the inline retries still gets recorded once Solana is reachable again.
export async function retryPendingBlockchainWrites(): Promise<{
  genesisRetried: number;
  scanRetried: number;
}> {
  const pendingGenesis = await prisma.parentQRCode.findMany({
    where: { genesisTxHash: null },
    include: { product: { include: { sme: true } } },
  });

  for (const parentQR of pendingGenesis) {
    const txHash = await writeGenesisToChain(
      parentQR.parentQRID,
      parentQR.product.productName,
      parentQR.product.sme.businessName,
      parentQR.product.sme.businessAddress
    );
    if (txHash) {
      await prisma.parentQRCode.update({
        where: { parentQRID: parentQR.parentQRID },
        data: { genesisTxHash: txHash },
      });
    }
  }

  const pendingScans = await prisma.scanEvent.findMany({
    where: { txHash: null },
    include: { parentQR: { include: { product: true } } },
  });

  for (const scan of pendingScans) {
    const txHash = await writeScanToChain(
      scan.parentQRID,
      scan.parentQR.product.productName,
      scan.scannerRole,
      scan.gpsLocation
    );
    if (txHash) {
      await prisma.scanEvent.update({ where: { scanID: scan.scanID }, data: { txHash } });
    }
  }

  return { genesisRetried: pendingGenesis.length, scanRetried: pendingScans.length };
}
