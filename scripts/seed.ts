// ── Seed Script: demo용 3가지 정책 실행 데이터 생성 ──

const API = process.env.SLOTFLOW_API_URL ?? "http://localhost:3001";

const dummyTx = btoa(String.fromCharCode(1, 2, 3, 4, 5, 6, 7, 8));
const actionGroup = `seed-${Date.now()}`;

const requests = [
  {
    signedTransaction: dummyTx,
    options: {
      policy: "FAST",
      appId: "seed",
      metadata: { flow: "fast-action", actionGroup },
    },
  },
  {
    signedTransaction: dummyTx,
    options: {
      policy: "PROTECTED",
      appId: "seed",
      maxFeeLamports: 50000,
      confirmationTarget: "confirmed",
      metadata: { flow: "swap", actionGroup },
    },
  },
  {
    signedTransaction: dummyTx,
    options: {
      policy: "RELIABLE",
      appId: "seed",
      confirmationTarget: "confirmed",
      metadata: { flow: "payment", actionGroup },
    },
  },
];

console.log(`Seeding ${requests.length} executions (actionGroup: ${actionGroup})...\n`);

for (const body of requests) {
  try {
    const res = await fetch(`${API}/v1/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  FAIL [${body.options.policy}]: ${res.status} ${err}`);
      continue;
    }

    const receipt = await res.json();
    console.log(`  OK [${receipt.policy}] ${receipt.receiptId} → route=${receipt.routeKind} status=${receipt.status}`);
  } catch (err) {
    console.error(`  ERROR [${body.options.policy}]: ${err}`);
  }
}

console.log("\nSeed complete. Open dashboard to verify.");
