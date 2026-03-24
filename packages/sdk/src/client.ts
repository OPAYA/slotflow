// ── SlotFlow SDK Client ──

import type {
  SlotFlowReceipt,
  SlotFlowSendOptions,
  SlotFlowSendRequest,
  ApiError,
} from "@slotflow/shared";

export interface SlotFlowClientConfig {
  baseUrl: string;
  /** default poll interval for subscribe() */
  pollIntervalMs?: number;
}

export interface ListExecutionsQuery {
  policy?: string;
  status?: string;
  appId?: string;
  actionGroup?: string;
  limit?: number;
  cursor?: string;
}

export interface ListExecutionsResponse {
  executions: SlotFlowReceipt[];
  nextCursor?: string;
}

export class SlotFlowClient {
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;

  constructor(config: SlotFlowClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
  }

  /**
   * signed tx + policy → receipt
   */
  async send(
    signedTransaction: Uint8Array | string,
    options: SlotFlowSendOptions,
  ): Promise<SlotFlowReceipt> {
    const txBase64 =
      typeof signedTransaction === "string"
        ? signedTransaction
        : btoa(String.fromCharCode(...signedTransaction));

    const body: SlotFlowSendRequest = { signedTransaction: txBase64, options };

    const res = await fetch(`${this.baseUrl}/v1/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = (await res.json()) as ApiError;
      throw new Error(`SlotFlow send failed: ${err.error.code} — ${err.error.message}`);
    }

    return (await res.json()) as SlotFlowReceipt;
  }

  /**
   * receipt 최신 상태 조회
   */
  async getReceipt(receiptId: string): Promise<SlotFlowReceipt> {
    const res = await fetch(`${this.baseUrl}/v1/executions/${receiptId}`);
    if (!res.ok) {
      const err = (await res.json()) as ApiError;
      throw new Error(`SlotFlow getReceipt failed: ${err.error.code}`);
    }
    return (await res.json()) as SlotFlowReceipt;
  }

  /**
   * execution 목록 조회
   */
  async listExecutions(query?: ListExecutionsQuery): Promise<ListExecutionsResponse> {
    const params = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v != null) params.set(k, String(v));
      }
    }
    const qs = params.toString();
    const url = `${this.baseUrl}/v1/executions${qs ? `?${qs}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SlotFlow listExecutions failed: ${res.status}`);
    return (await res.json()) as ListExecutionsResponse;
  }

  /**
   * polling 기반 receipt 구독.
   * 반환값은 unsubscribe 함수.
   */
  subscribe(
    receiptId: string,
    onUpdate: (receipt: SlotFlowReceipt) => void,
    options?: { intervalMs?: number },
  ): () => void {
    const interval = options?.intervalMs ?? this.pollIntervalMs;
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const receipt = await this.getReceipt(receiptId);
          onUpdate(receipt);
          // terminal이면 자동 종료
          if (["finalized", "expired", "failed"].includes(receipt.status)) {
            active = false;
            return;
          }
        } catch {
          // polling 실패는 무시하고 다음 cycle
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    };

    poll();
    return () => { active = false; };
  }
}
