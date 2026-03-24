// ── Devnet Seed: 실제 Solana devnet에서 3개 정책으로 전송 ──

import {
  Connection, Keypair, LAMPORTS_PER_SOL,
  loadOrCreateKeypair, createDemoTransfer, airdropIfNeeded,
} from "@slotflow/solana-utils";

const API = process.env.SLOTFLOW_API_URL ?? "http://localhost:3001";
const RPC = process.env.SLOTFLOW_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

const connection = new Connection(RPC, "confirmed");
const payer = loadOrCreateKeypair(".keys/demo-payer.json");
const receiver = Keypair.generate().publicKey;

console.log(`Payer:    ${payer.publicKey.toBase58()}`);
console.log(`Receiver: ${receiver.toBase58()}`);
console.log(`RPC:      ${RPC}`);
console.log(`API:      ${API}\n`);

// 1. Airdrop if needed
try {
  await airdropIfNeeded({ connection, publicKey: payer.publicKey });
} catch {
  console.log("Continuing without airdrop — wallet may already have funds.\n");
}

// 2. 3개 정책으로 실제 tx 생성 + send
const actionGroup = `devnet-${Date.now()}`;
const policies = ["FAST", "PROTECTED", "RELIABLE"] as const;

for (const policy of policies) {
  try {
    // 매번 새 tx 생성 (각각 다른 blockhash)
    const { signedTxBase64 } = await createDemoTransfer({
      connection,
      payer,
      to: receiver,
      lamports: 0.001 * LAMPORTS_PER_SOL,
    });

    const res = await fetch(`${API}/v1/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signedTransaction: signedTxBase64,
        options: {
          policy,
          appId: "devnet-seed",
          metadata: { flow: "devnet-demo", actionGroup },
        },
      }),
    });

    if (!res.ok) {
      console.error(`  FAIL [${policy}]: ${res.status} ${await res.text()}`);
      continue;
    }

    const receipt = await res.json();
    console.log(`  OK [${receipt.policy}] ${receipt.receiptId}`);
    console.log(`     route=${receipt.routeKind} status=${receipt.status} sig=${receipt.signature?.slice(0, 20)}...`);
  } catch (err) {
    console.error(`  ERROR [${policy}]: ${err}`);
  }
}

console.log(`\nDone. actionGroup: ${actionGroup}`);
