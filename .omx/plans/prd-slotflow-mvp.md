# PRD — SlotFlow MVP

- Status: Draft v1
- Product: SlotFlow
- Scope: Hackathon MVP
- Mode: Off-chain control plane first
- Primary audience: Solana 앱 개발자, 데모 심사위원, 초기 integration 파트너

---

## 1. 제품 한 줄 정의

SlotFlow는 Solana 앱이 트랜잭션을 보낼 때 **원하는 execution quality를 정책으로 선언**하면,
현재 사용 가능한 전송 경로와 보호 수단을 조합해 **fast / protected / reliable** 방식으로 라우팅해주는 실행 레이어다.

---

## 2. Requirements Summary

SlotFlow MVP는 아래 다섯 가지를 반드시 제공한다.

1. 앱이 `policy` 중심으로 트랜잭션을 전송할 수 있는 SDK
2. 정책에 따라 서로 다른 route/fee/retry 전략을 만드는 routing engine
3. `submitted → ... → terminal` 상태를 추적하는 receipt + monitor worker
4. 어떤 route와 이유로 실행됐는지 보여주는 dashboard
5. 동일 액션을 서로 다른 policy로 비교할 수 있는 데모 플로우

---

## 3. 문제 정의

현재 Solana 개발자는 execution quality를 원하지만, 기본 인터페이스는 주로 execution knobs만 제공한다.

개발자가 직접 조합해야 하는 것:

- priority fee
- compute unit limit
- public/private/protected route 선택
- preflight on/off
- retry 횟수와 backoff
- confirmation polling 및 expiration 처리
- 실패 시 fallback 정책

하지만 앱이 실제로 원하는 것은 아래 세 가지다.

- **빨리 들어가야 한다**
- **나쁘게 실행되면 안 된다**
- **실패 없이 상태를 끝까지 추적할 수 있어야 한다**

문제의 본질:

> 개발자는 execution quality를 원하지만,
> 현재 Solana 인터페이스는 execution knobs 위주다.

---

## 4. 왜 지금 중요한가

1. 저수준 부품은 이미 존재한다.
   - priority fee
   - route-specific relay/path
   - protected execution path
   - generic retry / confirmation
2. 하지만 앱 개발자가 원하는 결과를 한 번에 표현하는 상위 인터페이스가 부족하다.
3. send success ≠ landed / confirmed / finalized 이므로, 앱은 delivery 이후 상태관리까지 떠안는다.
4. 미래 execution market이 더 정교해질수록, 앱이 직접 low-level integration을 조합하는 비용은 더 커진다.

SlotFlow의 기회는 **더 빠른 RPC가 아니라, 더 높은 수준의 execution control abstraction**이다.

---

## 5. 타깃 사용자와 JTBD

| 세그먼트 | 핵심 JTBD | 가장 중요한 정책 |
| --- | --- | --- |
| Wallet / consumer app | "사용자가 tx가 그냥 잘 되길 바란다" | `FAST`, `PROTECTED` |
| DEX / Aggregator / swap UI | "나쁜 실행으로 손해 보지 않게 하고 싶다" | `PROTECTED` |
| Payment / Payroll / Treasury | "애매한 상태 없이 상태를 끝까지 추적하고 싶다" | `RELIABLE` |
| Trading bot / latency-sensitive app | "가장 빠르게 landed 되고 싶다" | `FAST` |

### 사용자별 가치

- **Wallet**: knob를 숨기고 품질 선택만 남긴다.
- **DEX**: swap 전송을 policy + explanation + receipt로 감싼다.
- **Payment**: retry / expiration / confirmation ambiguity를 줄인다.
- **Bot**: latency-first execution plan을 명시적으로 선택할 수 있다.

---

## 6. 제품 원칙

1. **Policy-first** — 사용자는 fee 숫자보다 실행 의도를 표현한다.
2. **Explainable** — 모든 전송은 왜 그 route를 썼는지 설명 가능해야 한다.
3. **Honest** — optimized / enhanced / focused language만 사용하고 guarantee는 약속하지 않는다.
4. **Observable** — signature 하나로 끝내지 않고 receipt와 상태 이벤트를 남긴다.
5. **Composable** — 정책, route adapter, fee strategy는 교체 가능해야 한다.
6. **Off-chain first** — 핵심 가치는 오프체인 control plane에서 낸다.

---

## 7. Goals / Non-goals

### Goals

- 정책 기반 send API를 실제로 동작시킨다.
- FAST / PROTECTED / RELIABLE 세 정책의 결과 차이를 시각적으로 보여준다.
- tx별 route, fee, retry, status, explanation을 dashboard에서 확인할 수 있게 한다.
- 최소 2개 이상의 실사용 시나리오 데모를 성공시킨다.

### Non-goals

- 새로운 sequencer 제작
- validator 인프라 직접 운영
- Jito/BAM 대체
- 완벽한 MEV 방지 보장
- 무조건 실행 보장
- 멀티체인 확장
- 자동 policy 추천 AI

---

## 8. MVP 범위

### 8.1 반드시 포함할 것

1. **SDK**
   - `slotflow.send(...)`
   - `slotflow.getReceipt(...)`
   - 상태 polling / subscription helper
2. **Routing Engine**
   - policy → execution plan 변환
   - route scoring
   - fallback order 적용
3. **Route Adapters (3종)**
   - public RPC path
   - protected path
   - fast path
4. **Retry & Confirmation State Machine**
   - expiration 감지
   - retry policy 적용
   - terminal state 판정
5. **Dashboard / Developer Console**
   - policy, route, fee, retries, latency, status, explanation
6. **Demo App 2개 이상**
   - swap / payment / fast action 중 최소 2개

### 8.2 넣으면 좋은 것

- fee estimator 정교화
- memo trace id
- simulation result 저장
- per-policy aggregate metrics

### 8.3 stretch goal

- Policy Registry Program (온체인 policy template registry)

---

## 9. 정책 정의

### 9.1 정책 요약 테이블

| Policy | 1차 목표 | Route 우선순위 | 기본 preflight | 기본 confirmation | Retry posture | 설명 포인트 |
| --- | --- | --- | --- | --- | --- | --- |
| `FAST` | 최초 landed latency 최소화 | fast → protected(if low latency) → public | off 또는 adaptive | `processed` 또는 `confirmed` | 최소화 | 왜 이 route가 가장 빠른지 |
| `PROTECTED` | harmful execution risk 완화 | protected → public(safe config) → fast(last resort) | on | `confirmed` | 제한적 | 어떤 protection-enhanced path를 택했는지 |
| `RELIABLE` | ambiguous state 최소화 + terminal tracking | public/reliable → protected fallback → fast(last resort) | on | `confirmed` 또는 `finalized` | 보수적 | retry/expiration/receipt가 어떻게 관리되는지 |

### 9.2 FAST

**목적**
- time-to-first-landed 최소화

**권장 사용처**
- bot
- urgent user action
- latency-sensitive trigger

**동작 원칙**
- 가장 빠른 route 우선
- aggressive fee posture
- confirmation wait 최소화
- retry는 최소화하되 blockhash 만료 직전 안전장치만 둔다

**기본 UX 문구**
- "Optimized for low-latency delivery"

**비보장 사항**
- best price 보장 안 함
- protection 보장 안 함
- terminal success 보장 안 함

### 9.3 PROTECTED

**목적**
- sandwich / bad execution / avoidable mis-execution risk 완화

**권장 사용처**
- retail swap
- DEX / aggregator user flow
- user-initiated value transfer with price sensitivity

**동작 원칙**
- protected path 선호
- slippage sanity check 유지
- preflight 유지
- explanation에 protection rationale 노출

**기본 UX 문구**
- "Protection-enhanced route requested"

**비보장 사항**
- 완벽한 MEV 방지 아님
- 모든 route가 private인 것 아님
- 항상 최적 가격을 보장하지 않음

### 9.4 RELIABLE

**목적**
- landed / confirmed / expired / failed 중 어떤 상태인지 끝까지 추적 가능하게 만들기

**권장 사용처**
- payment
- payroll
- transfer / settlement

**동작 원칙**
- preflight 유지
- retry/backoff/expiration 체크
- 명시적 terminal state
- receipt 중심 UX

**기본 UX 문구**
- "Reliability-focused delivery with tracked confirmation"

**비보장 사항**
- 무조건 실행 보장 아님
- chain-level finality보다 높은 약속을 하지 않음

---

## 10. 사용자 경험 정의

### Flow A — Swap (PROTECTED)

1. 사용자가 swap 요청
2. 앱이 signed tx 생성
3. SDK가 `policy = PROTECTED`로 SlotFlow API 호출
4. SlotFlow가 protected-preferred execution plan 생성
5. receipt 반환: policy, route, estimated fee, status = `submitted`
6. dashboard에서 protection rationale + final status 추적

### Flow B — Payment (RELIABLE)

1. 결제 tx 생성
2. `policy = RELIABLE`
3. preflight, retry, expiration tracking 활성화
4. merchant는 receipt ID 기준으로 상태를 추적
5. terminal status가 `confirmed` / `finalized` / `expired` / `failed`로 명확히 남음

### Flow C — Fast Action (FAST)

1. 긴급 tx 생성
2. `policy = FAST`
3. latency-first route와 fee posture 적용
4. 비교 화면에서 다른 policy보다 짧은 landed time을 보여줌

---

## 11. Functional Requirements

### FR-1. Policy-based send

시스템은 signed transaction과 policy를 받아 execution request를 생성해야 한다.

**입력**
- signed transaction (`Uint8Array` 또는 base64)
- `policy`
- optional `appId`
- optional `maxFeeLamports`
- optional `confirmationTarget`
- optional `metadata`

**출력**
- `receiptId`
- 현재 `status`
- 선택된 `route`
- `signature` (available 시)
- `qualityEstimate`
- `explanation`

### FR-2. Policy engine

시스템은 policy, tx metadata, route health snapshot을 바탕으로 derived execution plan을 생성해야 한다.

포함 요소:
- route priority
- fee posture
- preflight mode
- retry rules
- confirmation target
- fallback order

### FR-3. Route abstraction

시스템은 최소 3개의 adapter를 동일한 interface로 다뤄야 한다.

- public RPC adapter
- protected adapter
- fast adapter

각 adapter는 아래 기능을 제공해야 한다.
- readiness / health check
- estimate
- send
- optional poll / observe
- route explanation fragment

### FR-4. Fee policy

시스템은 tx마다 fee posture를 계산하고 `maxFeeLamports` cap을 넘지 않도록 해야 한다.

MVP에서 필요한 것:
- compute unit limit heuristic 또는 simulation-based estimate
- compute unit price band
- estimated vs actual fee 기록

### FR-5. Retry & confirmation orchestration

시스템은 send success를 terminal success로 간주하지 않아야 한다.

요구사항:
- polling / recheck
- expiration 판정
- retry attempt log
- terminal states: `finalized`, `expired`, `failed`

### FR-6. Receipt model

시스템은 signature 문자열 대신 실행 영수증 모델을 제공해야 한다.

최소 필드:
- receipt id
- request id / trace id
- policy
- route used
- status timeline
- latency fields
- fee summary
- retry count
- explanation

### FR-7. Dashboard / Developer Console

dashboard는 아래를 보여줘야 한다.

- chosen policy
- route used
- estimated fee / actual fee
- submitted at / landed at / confirmed at
- retry count
- preflight result
- current status / terminal reason
- why this route?

### FR-8. Comparison demo

시스템은 같은 액션 유형에 대해 FAST / PROTECTED / RELIABLE 결과를 한 화면에서 비교할 수 있어야 한다.

비교 항목:
- landed latency
- retries
- route used
- fee
- final status

### FR-9. Human-readable route explanation

모든 execution receipt는 최소 2~4개의 explanation bullet을 반환해야 한다.

예:
- "FAST policy selected the lowest-latency healthy adapter."
- "PROTECTED policy kept preflight on and preferred a protection-enhanced path."
- "RELIABLE policy enabled conservative retries until expiration or confirmation."

### FR-10. Policy-safe language

UI / API docs / pitch deck 어디에서도 guarantee 표현을 쓰지 않아야 한다.

---

## 12. Non-functional Requirements

| ID | 요구사항 |
| --- | --- |
| NFR-1 | 모든 execution은 traceable해야 한다. |
| NFR-2 | policy 결정 이유를 사람이 읽을 수 있어야 한다. |
| NFR-3 | route adapter 장애 시 fallback 가능한 구조여야 한다. |
| NFR-4 | dashboard 데이터는 polling 기반으로도 동작해야 한다. |
| NFR-5 | hackathon MVP는 운영 자동화보다 demo determinism을 우선한다. |
| NFR-6 | 비밀키를 서버가 보관하지 않는다. signed tx만 다룬다. |
| NFR-7 | adapter 추가가 정책 엔진 전체 재작성 없이 가능해야 한다. |

---

## 13. 성공 지표

### MVP success conditions

- policy 기반 API 호출이 실제 tx lifecycle과 연결된다.
- 3개 policy가 서로 다른 execution plan을 만든다.
- dashboard에서 route / fee / status / retry를 확인할 수 있다.
- payment / swap / fast action 중 최소 2개 데모가 동작한다.

### 정량 지표

- submission success rate
- landed rate
- confirmed rate
- median landed latency
- retry count per policy
- average additional fee per policy
- expired / failed rate

---

## 14. 핵심 리스크와 완화

| 리스크 | 설명 | 완화 방안 |
| --- | --- | --- |
| Route variance | 네트워크 상황 따라 fast/protected 특성이 달라질 수 있음 | adapter health + explanation을 함께 노출 |
| Overclaim risk | 보호/신뢰성 표현이 과장될 수 있음 | copy guardrail 강제 |
| Demo instability | 실제 네트워크 결과가 매번 동일하지 않음 | mockable adapter + replayable dashboard data 준비 |
| Confirmation ambiguity | send success를 성공으로 오해할 수 있음 | receipt state machine + terminal reason 분리 |
| Fee overspend | aggressive policy가 비용을 과도하게 올릴 수 있음 | `maxFeeLamports` cap 강제 |

---

## 15. Open Questions

1. protected path adapter를 어떤 공급자 abstraction으로 감쌀 것인가?
2. FAST에서 기본 preflight를 완전히 끌지, adaptive로 둘지?
3. RELIABLE의 기본 terminal target을 `confirmed`로 둘지 `finalized`로 둘지?
4. fee estimator를 network sample 기반으로 시작할지 fixed band로 시작할지?
5. dashboard 실시간 업데이트를 polling만으로 충분히 할지, SSE/WebSocket을 넣을지?

> 권장 기본값:
> - FAST = adaptive preflight
> - RELIABLE = `confirmed` default, `finalized` optional
> - dashboard = polling first

---

## 16. Acceptance Criteria

| ID | 기준 | 검증 방식 |
| --- | --- | --- |
| AC-1 | SDK가 signed tx + policy를 받아 receipt를 반환한다. | contract test |
| AC-2 | `FAST`, `PROTECTED`, `RELIABLE`가 서로 다른 execution plan을 생성한다. | policy engine unit test |
| AC-3 | execution마다 route explanation이 기록된다. | API response test |
| AC-4 | receipt가 `submitted` 이후 terminal state까지 추적된다. | worker integration test |
| AC-5 | expiration 시 `expired` terminal reason이 남는다. | state machine integration test |
| AC-6 | dashboard에서 policy / route / fee / retries / status / timestamps를 볼 수 있다. | UI e2e |
| AC-7 | comparison demo 한 화면에서 세 policy 결과를 비교할 수 있다. | demo e2e |
| AC-8 | PROTECTED 흐름은 protection-enhanced explanation과 preflight result를 보여준다. | swap demo verification |
| AC-9 | RELIABLE 흐름은 receipt ID 기준 상태 추적이 가능하다. | payment demo verification |
| AC-10 | 모든 public copy가 guarantee language를 피한다. | content review checklist |

---

## 17. ADR (Architecture / Product Decision Record)

### Decision

SlotFlow MVP는 **오프체인 policy control plane**으로 구현한다.

### Drivers

- 해커톤 기간 안에 end-to-end demo를 완성해야 한다.
- 제품의 본질은 sequencing이 아니라 execution orchestration이다.
- 개발자가 원하는 것은 validator 운영이 아니라 route / fee / retry / confirmation abstraction이다.

### Alternatives considered

1. **온체인 program 중심 접근**
   - 장점: on-chain story가 명확함
   - 단점: 핵심 가치와 직접 연결되지 않음, 일정 리스크 큼
2. **단일 fast RPC product**
   - 장점: 구현 단순
   - 단점: 정책 abstraction이 사라지고 차별점이 약함
3. **오프체인 policy control plane + optional registry stretch**
   - 장점: 핵심 가치와 일정이 가장 잘 맞음
   - 단점: on-chain novelty가 약할 수 있음

### Why chosen

세 번째 옵션이 제품 본질과 MVP deliverable 모두에 가장 부합한다.

### Consequences

- dashboard, receipt, state machine 품질이 제품 설득력의 핵심이 된다.
- adapter 설계가 future-proof해야 한다.
- 온체인 registry는 stretch goal로 남긴다.

### Follow-ups

- adapter capability schema 고도화
- policy registry program feasibility 검토
- per-policy recommendation engine 검토

---

## 18. Implementation Steps (proposed file refs)

아래 경로는 **권장 monorepo 구조** 기준이다.

1. Workspace bootstrap
   - `package.json`
   - `pnpm-workspace.yaml`
   - `tsconfig.base.json`
2. Shared contracts
   - `packages/shared/src/contracts/policy.ts`
   - `packages/shared/src/contracts/receipt.ts`
   - `packages/shared/src/contracts/routes.ts`
3. SDK
   - `packages/sdk/src/client.ts`
   - `packages/sdk/src/send.ts`
   - `packages/sdk/src/subscribe.ts`
4. Policy engine
   - `packages/policy-engine/src/index.ts`
   - `packages/policy-engine/src/policies/fast.ts`
   - `packages/policy-engine/src/policies/protected.ts`
   - `packages/policy-engine/src/policies/reliable.ts`
5. Route adapters
   - `packages/route-adapters/src/public-rpc.ts`
   - `packages/route-adapters/src/protected.ts`
   - `packages/route-adapters/src/fast.ts`
6. API server
   - `services/api/src/routes/executions.ts`
   - `services/api/src/routes/metrics.ts`
   - `services/api/src/lib/execution-service.ts`
7. Monitor worker
   - `workers/tx-monitor/src/monitor.ts`
   - `workers/tx-monitor/src/state-machine.ts`
8. Dashboard
   - `apps/dashboard/app/executions/page.tsx`
   - `apps/dashboard/app/compare/page.tsx`
9. Demo apps
   - `apps/demo-swap/`
   - `apps/demo-payments/`
   - `apps/demo-fast-action/` (optional third)

---

## 19. Shipping Definition of Done

SlotFlow MVP는 아래를 만족하면 shipping 가능하다.

- SDK → API → adapter → monitor → dashboard 흐름이 end-to-end로 이어짐
- 최소 2개 데모가 재현 가능하게 동작함
- receipt model이 terminal state를 명확히 구분함
- comparison UI가 정책 차이를 보여줌
- copy guardrail 위반이 없음
