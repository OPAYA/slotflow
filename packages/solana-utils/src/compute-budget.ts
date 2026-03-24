// ── Compute Budget: tx에 priority fee instruction을 inject ──

import {
  ComputeBudgetProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * 서명 전 transaction에 compute budget instructions를 prepend한다.
 * 이미 있으면 교체하고, 없으면 추가한다.
 *
 * 주의: 서명 전에만 호출해야 한다. 서명 후 호출하면 서명이 무효화된다.
 */
export function injectComputeBudget(
  tx: Transaction,
  opts: {
    computeUnitLimit: number;
    computeUnitPriceMicroLamports: number;
  },
): Transaction {
  // 기존 compute budget instructions 제거
  const CB_PROGRAM_ID = ComputeBudgetProgram.programId.toBase58();
  tx.instructions = tx.instructions.filter(
    (ix) => ix.programId.toBase58() !== CB_PROGRAM_ID,
  );

  // prepend: SetComputeUnitLimit + SetComputeUnitPrice
  const limitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: opts.computeUnitLimit,
  });
  const priceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: opts.computeUnitPriceMicroLamports,
  });

  tx.instructions = [limitIx, priceIx, ...tx.instructions];
  return tx;
}

/**
 * base64 serialized tx를 deserialize → compute budget inject → re-serialize.
 * 서명이 이미 포함된 tx에는 사용 불가 (서명 무효화됨).
 *
 * SlotFlow의 설계상 이 함수는 SDK 레벨에서 서명 전에 호출해야 한다.
 * API 서버에서는 signed tx를 받으므로 변경 불가.
 */
export function isVersionedTransaction(
  raw: Buffer,
): boolean {
  // versioned tx는 첫 바이트의 MSB가 1
  return (raw[0]! & 0x80) !== 0;
}
