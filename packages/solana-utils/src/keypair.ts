// ── Keypair 관리: 데모용 키페어 로드/생성 ──

import { Keypair } from "@solana/web3.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * 파일에서 keypair를 로드하거나, 없으면 새로 생성하여 저장한다.
 * 데모/devnet 전용 — production에서 사용 금지.
 */
export function loadOrCreateKeypair(path: string): Keypair {
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }

  const kp = Keypair.generate();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}
