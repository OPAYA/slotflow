// ── Demo Transfer: devnet SOL 전송 트랜잭션 생성 ──

import {
  Connection,
  type Keypair,
  type PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

/**
 * devnet에서 소액 SOL transfer tx를 생성하고 서명한다.
 * SlotFlow API에 보낼 base64 signed tx를 반환.
 */
export async function createDemoTransfer(opts: {
  connection: Connection;
  payer: Keypair;
  to: PublicKey;
  lamports: number;
}): Promise<{ signedTxBase64: string; blockhash: string }> {
  const { connection, payer, to, lamports } = opts;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: to,
      lamports,
    }),
  );

  tx.sign(payer);

  const serialized = tx.serialize();
  const signedTxBase64 = serialized.toString("base64");

  return { signedTxBase64, blockhash };
}

/**
 * devnet에서 airdrop이 필요하면 요청한다.
 * 잔액이 threshold 미만이면 1 SOL airdrop.
 */
export async function airdropIfNeeded(opts: {
  connection: Connection;
  publicKey: PublicKey;
  thresholdLamports?: number;
}): Promise<void> {
  const { connection, publicKey, thresholdLamports = 0.5 * LAMPORTS_PER_SOL } = opts;
  const balance = await connection.getBalance(publicKey);

  if (balance < thresholdLamports) {
    console.log(`Balance ${balance / LAMPORTS_PER_SOL} SOL — requesting airdrop...`);
    try {
      const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`Airdrop confirmed. New balance: ${(await connection.getBalance(publicKey)) / LAMPORTS_PER_SOL} SOL`);
    } catch (err) {
      console.warn(`Airdrop failed (devnet may be rate-limited): ${err}`);
      console.warn(`Manual faucet: https://faucet.solana.com/ — paste ${publicKey.toBase58()}`);
      throw new Error("Airdrop failed — fund the wallet manually and retry");
    }
  } else {
    console.log(`Balance ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL — sufficient.`);
  }
}
