// ── Smoke Test: API health + send + receipt 확인 ──

const API = process.env.SLOTFLOW_API_URL ?? "http://localhost:3001";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

console.log("SlotFlow Smoke Test\n");

// 1. Health check
await check("API health endpoint", async () => {
  const res = await fetch(`${API}/health`);
  assert(res.ok, `health returned ${res.status}`);
  const data = await res.json();
  assert(data.status === "ok", `unexpected health status: ${data.status}`);
});

// 2. Send with each policy
const receiptIds: string[] = [];
for (const policy of ["FAST", "PROTECTED", "RELIABLE"] as const) {
  await check(`POST /v1/executions (${policy})`, async () => {
    const res = await fetch(`${API}/v1/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signedTransaction: btoa(String.fromCharCode(1, 2, 3)),
        options: { policy },
      }),
    });
    assert(res.status === 201, `expected 201, got ${res.status}`);
    const receipt = await res.json();
    assert(receipt.receiptId, "missing receiptId");
    assert(receipt.policy === policy, `policy mismatch: ${receipt.policy}`);
    assert(receipt.explanation?.bullets?.length >= 2, "insufficient explanation");
    receiptIds.push(receipt.receiptId);
  });
}

// 3. Get receipt
await check("GET /v1/executions/:receiptId", async () => {
  const res = await fetch(`${API}/v1/executions/${receiptIds[0]}`);
  assert(res.ok, `got ${res.status}`);
  const receipt = await res.json();
  assert(receipt.receiptId === receiptIds[0], "receipt ID mismatch");
});

// 4. List executions
await check("GET /v1/executions (list)", async () => {
  const res = await fetch(`${API}/v1/executions`);
  assert(res.ok, `got ${res.status}`);
  const data = await res.json();
  assert(data.executions.length >= 3, `expected >= 3 executions, got ${data.executions.length}`);
});

// 5. 404 for unknown receipt
await check("GET unknown receipt returns 404", async () => {
  const res = await fetch(`${API}/v1/executions/rcpt_nonexistent`);
  assert(res.status === 404, `expected 404, got ${res.status}`);
});

// 6. Invalid policy returns 400
await check("POST invalid policy returns 400", async () => {
  const res = await fetch(`${API}/v1/executions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedTransaction: btoa("abc"),
      options: { policy: "INVALID" },
    }),
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
});

// 7. Content guardrail — no guarantee language
await check("No guarantee language in responses", async () => {
  const res = await fetch(`${API}/v1/executions`);
  const text = await res.text();
  const forbidden = ["guaranteed", "perfect protection", "ensures success", "100% safe"];
  for (const word of forbidden) {
    assert(!text.toLowerCase().includes(word), `found forbidden term: "${word}"`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
