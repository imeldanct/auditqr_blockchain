import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const connection = new Connection("http://localhost:8899", "confirmed");

function getKeypair(): Keypair {
  const raw = process.env.SOLANA_KEYPAIR;
  if (!raw) throw new Error("SOLANA_KEYPAIR not set in environment");
  return Keypair.fromSecretKey(Buffer.from(raw, "base64"));
}

export async function writeGenesisToChain(parentQRID: string, productName: string): Promise<string | null> {
  try {
    const keypair = getKeypair();
    const memo = `AuditQR|${parentQRID}|${productName}|QR Generation|${new Date().toISOString()}`;
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
  ipLocation: string
): Promise<string | null> {
  try {
    const keypair = getKeypair();
    const roleLabel = scannerRole === "transporter" ? "Transporter Scan" : "Retailer Scan";
    const memo = `AuditQR|${parentQRID}|${productName}|${roleLabel}|${ipLocation}|${new Date().toISOString()}`;

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
