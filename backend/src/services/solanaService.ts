import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

function getKeypair(): Keypair {
  const raw = process.env.SOLANA_KEYPAIR;
  if (!raw) throw new Error("SOLANA_KEYPAIR not set in environment");
  return Keypair.fromSecretKey(Buffer.from(raw, "base64"));
}

export async function writeGenesisToChain(
  parentQRID: string,
  productName: string,
  businessName: string,
  businessAddress?: string | null
): Promise<string | null> {
  try {
    const keypair = getKeypair();
    const location = businessAddress ?? "address-unavailable";
    const memo = `AuditQR|genesis|${parentQRID}|${productName}|${businessName}|${location}|${new Date().toISOString()}`;
    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, "utf-8"),
      })
    );
    const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
    return signature;
  } catch (err) {
    console.error("Solana genesis write failed:", err);
    return null;
  }
}

export async function writeScanToChain(
  parentQRID: string,
  productName: string,
  scannerRole: string,
  gpsLocation: string | null
): Promise<string | null> {
  try {
    const keypair = getKeypair();
    const roleLabel = scannerRole === "transporter" ? "Transporter Scan" : "Retailer Scan";
    const location = gpsLocation ?? "location-unavailable";
    const memo = `AuditQR|${parentQRID}|${productName}|${roleLabel}|${location}|${new Date().toISOString()}`;

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, "utf-8"),
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
    return signature;
  } catch (err) {
    console.error("Solana write failed:", err);
    return null;
  }
}
