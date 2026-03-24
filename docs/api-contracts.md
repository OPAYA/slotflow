# SlotFlow API & Data Contracts

이 문서는 SDK, HTTP API, receipt model, persistence model의 최소 계약을 정의한다.

---

## 1. 설계 규칙

1. 앱은 항상 **signed tx + policy**만 넘긴다.
2. 서버는 private key를 다루지 않는다.
3. 응답은 가능하면 signature보다 **receipt 중심**으로 설계한다.
4. 정책 차이는 contract shape가 아니라 **plan/result data**로 드러나야 한다.
5. explanation은 optional이 아니라 필수 필드다.

---

## 2. Core TypeScript Contracts

```ts
export type SlotFlowPolicy = "FAST" | "PROTECTED" | "RELIABLE";

export type ConfirmationTarget = "processed" | "confirmed" | "finalized";

export type ReceiptStatus =
  | "accepted"
  | "planned"
  | "submitted"
  | "relayed"
  | "processed"
  | "confirmed"
  | "finalized"
  | "expired"
  | "failed";

export type RouteKind = "public_rpc" | "protected" | "fast";

export interface SlotFlowSendOptions {
  policy: SlotFlowPolicy;
  appId?: string;
  maxFeeLamports?: number;
  confirmationTarget?: ConfirmationTarget;
  metadata?: Record<string, string | number | boolean | null>;
  tags?: string[];
}

export interface SlotFlowSendRequest {
  signedTransaction: string; // base64
  options: SlotFlowSendOptions;
}

export interface QualityEstimate {
  score: number; // 0-100
  label: "latency-optimized" | "protection-enhanced" | "reliability-focused";
  signals: string[];
}

export interface RouteExplanation {
  title: string;
  bullets: string[];
}

export interface FeeSummary {
  estimatedAdditionalLamports: number;
  actualAdditionalLamports?: number;
  computeUnitLimit?: number;
  computeUnitPriceMicroLamports?: number;
  capApplied: boolean;
}

export interface AttemptSummary {
  id: string;
  routeKind: RouteKind;
  routeId: string;
  startedAt: string;
  endedAt?: string;
  result: "submitted" | "rejected" | "observed" | "failed";
  reason?: string;
}

export interface ReceiptEvent {
  id: string;
  status: ReceiptStatus;
  at: string;
  reason?: string;
  detail?: Record<string, unknown>;
}

export interface SlotFlowReceipt {
  receiptId: string;
  traceId: string;
  signature?: string;
  policy: SlotFlowPolicy;
  routeKind?: RouteKind;
  routeId?: string;
  status: ReceiptStatus;
  confirmationTarget: ConfirmationTarget;
  qualityEstimate: QualityEstimate;
  fee: FeeSummary;
  attempts: AttemptSummary[];
  events: ReceiptEvent[];
  explanation: RouteExplanation;
  preflight?: {
    mode: "on" | "off" | "adaptive";
    passed?: boolean;
    error?: string;
  };
  timestamps: {
    createdAt: string;
    submittedAt?: string;
    landedAt?: string;
    confirmedAt?: string;
    finalizedAt?: string;
    expiredAt?: string;
  };
  terminalReason?: string;
}
```

---

## 3. SDK Surface

```ts
export interface SlotFlowClient {
  send(
    signedTransaction: Uint8Array | string,
    options: SlotFlowSendOptions,
  ): Promise<SlotFlowReceipt>;

  getReceipt(receiptId: string): Promise<SlotFlowReceipt>;

  listExecutions(query?: ListExecutionsQuery): Promise<ListExecutionsResponse>;

  subscribe(
    receiptId: string,
    onUpdate: (receipt: SlotFlowReceipt) => void,
    options?: { intervalMs?: number },
  ): () => void;
}
```

### SDK rules

- `send`는 base64 serialization을 내부에서 맞춰준다.
- `subscribe`는 MVP에서는 polling 구현으로 충분하다.
- SDK는 route/provider 디테일을 숨기고 policy semantics만 노출한다.

---

## 4. HTTP API

### `POST /v1/executions`

실행 요청 생성 + 즉시 receipt 반환

**Request**

```json
{
  "signedTransaction": "BASE64_TX",
  "options": {
    "policy": "PROTECTED",
    "appId": "demo-swap",
    "maxFeeLamports": 50000,
    "confirmationTarget": "confirmed",
    "metadata": {
      "flow": "swap",
      "actionGroup": "swap-demo-001"
    }
  }
}
```

**Response**

```json
{
  "receiptId": "rcpt_123",
  "traceId": "trace_123",
  "signature": "5abc...",
  "policy": "PROTECTED",
  "routeKind": "protected",
  "status": "submitted",
  "confirmationTarget": "confirmed",
  "qualityEstimate": {
    "score": 82,
    "label": "protection-enhanced",
    "signals": [
      "protected adapter healthy",
      "preflight enabled",
      "fee cap respected"
    ]
  },
  "fee": {
    "estimatedAdditionalLamports": 18000,
    "capApplied": false,
    "computeUnitLimit": 250000,
    "computeUnitPriceMicroLamports": 72
  },
  "attempts": [
    {
      "id": "att_1",
      "routeKind": "protected",
      "routeId": "protected-default",
      "startedAt": "2026-03-25T00:00:00.000Z",
      "result": "submitted"
    }
  ],
  "events": [
    {
      "id": "evt_1",
      "status": "submitted",
      "at": "2026-03-25T00:00:00.000Z"
    }
  ],
  "explanation": {
    "title": "Protected execution requested",
    "bullets": [
      "Preferred a protection-enhanced route.",
      "Kept preflight enabled for safer execution.",
      "Used a moderate fee posture within the configured cap."
    ]
  },
  "timestamps": {
    "createdAt": "2026-03-25T00:00:00.000Z",
    "submittedAt": "2026-03-25T00:00:00.000Z"
  }
}
```

### `GET /v1/executions/:receiptId`

최신 receipt 조회

### `GET /v1/executions`

실행 목록 조회

지원 query:

- `policy`
- `status`
- `appId`
- `actionGroup`
- `limit`
- `cursor`

### `GET /v1/executions/:receiptId/events`

status timeline / attempts 세부 조회

### `GET /v1/metrics/compare?actionGroup=...`

같은 logical action group의 policy별 비교 metrics 반환

**Response shape**

```ts
interface PolicyComparisonRow {
  policy: SlotFlowPolicy;
  routeKind?: RouteKind;
  landedLatencyMs?: number;
  retryCount: number;
  estimatedAdditionalLamports: number;
  actualAdditionalLamports?: number;
  finalStatus: ReceiptStatus;
}
```

---

## 5. Persistence Model

### 5.1 `execution_requests`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | internal execution id |
| receipt_id | text | public id |
| trace_id | text | cross-system trace |
| app_id | text | app 식별자 |
| policy | text | FAST/PROTECTED/RELIABLE |
| signed_tx_b64 | text | serialized tx |
| plan_snapshot | jsonb | derived execution plan |
| created_at | timestamptz | 생성 시각 |

### 5.2 `execution_attempts`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | attempt id |
| execution_id | uuid | FK |
| route_kind | text | public/protected/fast |
| route_id | text | adapter instance |
| result | text | submitted/failed/... |
| reason | text | 실패/우회 이유 |
| started_at | timestamptz | 시작 |
| ended_at | timestamptz | 종료 |

### 5.3 `receipt_events`

append-only status timeline

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid | event id |
| execution_id | uuid | FK |
| status | text | receipt status |
| reason | text | optional reason |
| detail | jsonb | provider/raw info |
| at | timestamptz | event time |

### 5.4 `receipts`

현재 상태 snapshot + dashboard projection

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| receipt_id | text | PK/public id |
| execution_id | uuid | FK |
| status | text | current status |
| signature | text | optional |
| route_kind | text | selected route |
| confirmation_target | text | processed/confirmed/finalized |
| fee_summary | jsonb | estimated/actual fee |
| explanation | jsonb | title + bullets |
| terminal_reason | text | optional |
| updated_at | timestamptz | last change |

---

## 6. Error Model

```ts
interface ApiError {
  error: {
    code:
      | "INVALID_REQUEST"
      | "UNSUPPORTED_POLICY"
      | "FEE_CAP_EXCEEDED"
      | "NO_HEALTHY_ROUTE"
      | "ADAPTER_SEND_FAILED"
      | "RECEIPT_NOT_FOUND";
    message: string;
    retryable?: boolean;
    detail?: Record<string, unknown>;
  };
}
```

### 에러 원칙

- 개발자가 고칠 수 있는 입력 문제는 4xx
- provider / route 불안정은 retryable 플래그 포함
- receipt 기반 follow-up 가능한 경우 `receiptId`를 함께 반환 가능

---

## 7. Quality Score Contract

MVP의 `qualityEstimate.score`는 정밀한 market-wide benchmark가 아니라,
**현재 선택된 정책과 route가 의도에 얼마나 부합하는지**를 보여주는 heuristic score다.

예시 입력 신호:
- selected route health
- fee cap 충족 여부
- preflight mode
- confirmation target 적합도
- fallback 발생 여부

> 이 score는 절대적인 체인 품질 점수가 아니라 explanation-friendly product metric이다.

---

## 8. Event Ordering Rules

1. `accepted` 이후에만 `planned`
2. `submitted` 이전에는 signature가 없어도 된다.
3. terminal status(`finalized`/`expired`/`failed`) 이후 새 non-terminal event 금지
4. `attempts`와 `events`는 시간순 정렬을 기본으로 한다.

---

## 9. Comparison Contract

동일 액션 비교를 위해 `actionGroup` 개념을 metadata에 넣는다.

예:

- `swap-demo-001-fast`
- `swap-demo-001-protected`
- `swap-demo-001-reliable`

API는 내부적으로 같은 `actionGroup`으로 묶인 실행들을 policy별 row로 반환한다.

---

## 10. Future-safe Extension Points

- `policy = CUSTOM` 추가 가능
- `routeKind` 확장 가능
- SSE/WebSocket receipt streaming 추가 가능
- on-chain policy registry ID 연결 가능
