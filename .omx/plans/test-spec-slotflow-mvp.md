# Test Spec — SlotFlow MVP

- Status: Draft v1
- Scope: Hackathon MVP verification
- Related PRD: `.omx/plans/prd-slotflow-mvp.md`

---

## 1. 테스트 목표

SlotFlow의 테스트는 단순히 "tx를 보낼 수 있다"를 넘어서,
**policy가 실제로 다른 execution behavior와 설명 가능한 receipt를 만든다**는 것을 증명해야 한다.

핵심 검증 포인트:

1. policy별 execution plan 차이
2. route selection / fallback correctness
3. retry / confirmation state machine correctness
4. dashboard observability completeness
5. demo narrative reproducibility

---

## 2. 테스트 원칙

1. **정책 차이를 테스트한다** — 단순 성공/실패만 보지 않는다.
2. **send success를 success로 간주하지 않는다** — terminal state 중심으로 본다.
3. **mock + integration을 병행한다** — 실제 네트워크 변동성을 흡수한다.
4. **receipt와 explanation도 계약이다** — API payload shape를 고정한다.
5. **demo-friendly evidence를 남긴다** — 스크린샷/로그/metrics를 발표 자료로도 재사용한다.

---

## 3. 테스트 레이어

| Layer | 목적 | 도구 예시 |
| --- | --- | --- |
| Unit | policy, fee, state transition 순수 로직 검증 | Vitest/Jest |
| Integration | API ↔ adapter ↔ DB ↔ worker 연결 검증 | local DB + mocked adapter |
| E2E | dashboard + demo app 사용자 흐름 검증 | Playwright |
| Smoke | 실제 Solana endpoint 대상 기본 송신 확인 | guarded manual/smoke script |
| Observability | logs, receipt, metrics completeness 검증 | SQL assertions + API checks |

---

## 4. 테스트 환경

### Env A — Pure unit

- 외부 네트워크 없음
- mocked adapter / mocked clock 사용
- deterministic fixture 중심

### Env B — Integration sandbox

- local Postgres 또는 Supabase local
- mocked route adapters
- mocked status poller
- API server + worker 동시 실행

### Env C — Solana smoke

- 제한된 devnet 또는 선택된 endpoint 대상
- 소액 / 비위험 tx만 사용
- demo 직전 health check 용도

> MVP 핵심은 Env A + Env B에서 안정적으로 검증하고,
> Env C는 발표 전 smoke 수준으로만 다룬다.

---

## 5. Unit Test Matrix

### 5.1 Policy engine

파일 후보:
- `packages/policy-engine/src/**/*.test.ts`

케이스:
- `FAST`는 low-latency route를 최우선으로 정렬한다.
- `PROTECTED`는 protected-capable adapter에 가산점을 준다.
- `RELIABLE`는 retry-enabled plan을 생성한다.
- `maxFeeLamports` cap 적용 시 상한을 넘지 않는다.
- confirmation target override가 기본 정책을 덮는다.

### 5.2 Fee strategy

케이스:
- compute unit limit heuristic이 최소/최대 guardrail을 지킨다.
- fee posture multiplier가 policy별로 다르다.
- estimated fee와 actual fee summary 구조가 깨지지 않는다.

### 5.3 State machine

파일 후보:
- `workers/tx-monitor/src/state-machine.test.ts`

케이스:
- `submitted -> processed -> confirmed -> finalized`
- `submitted -> expired`
- `submitted -> failed`
- retry 후 success
- retry exhaustion 후 failed
- terminal state 이후 추가 transition 차단

### 5.4 Receipt serialization

케이스:
- 모든 receipt에 `receiptId`, `policy`, `route`, `status`, `explanation` 존재
- status timeline event ordering 유지
- human-readable explanation 2개 이상 반환

---

## 6. Integration Test Matrix

### 6.1 Send flow

대상:
- SDK → API → policy engine → adapter stub → DB insert

검증:
- send 호출 후 receipt row 생성
- selected route가 policy와 일치
- trace id가 attempt/event/log 전체에 전파

### 6.2 Retry / monitor flow

대상:
- API → worker → status poller → DB update

검증:
- RELIABLE 정책에서 retry row 증가
- expiration detection 시 terminal state 기록
- final status가 dashboard query에 반영

### 6.3 Fallback flow

검증:
- preferred adapter unhealthy 시 다음 adapter로 전환
- fallback 이유가 explanation에 반영
- terminal receipt에 attempts 배열이 남음

### 6.4 Dashboard query flow

검증:
- executions list API가 policy / route / status filter를 지원
- compare API가 policy별 latency / fee / retries aggregate를 반환

---

## 7. E2E Scenarios

### E2E-1. FAST comparison

목표:
- 동일 액션에서 FAST가 latency-first execution plan을 노출

검증 포인트:
- compare 화면에 `FAST` row 표시
- route label이 fast-preferred
- status가 `submitted` 이후 진행됨
- latency metric이 다른 정책과 함께 나란히 비교됨

### E2E-2. PROTECTED swap flow

목표:
- 사용자에게 protection-enhanced copy와 explanation 제공

검증 포인트:
- swap demo에서 `PROTECTED` 선택 가능
- result panel에 protection rationale 표시
- preflight result / route / fee 표시

### E2E-3. RELIABLE payment flow

목표:
- receipt ID 기반 상태 추적

검증 포인트:
- payment demo에서 `RELIABLE` 선택 가능
- 결제 후 receipt ID 표시
- 상태 페이지에서 terminal state 확인 가능

### E2E-4. Comparison dashboard

목표:
- 한 화면에서 세 정책 비교

검증 포인트:
- latency, retries, fee, route, final status 컬럼 존재
- 같은 logical action group으로 묶여 보임

---

## 8. Observability Verification

모든 execution은 아래 증거를 남겨야 한다.

- request log
- selected execution plan
- adapter send attempt log
- receipt status events
- terminal reason
- dashboard aggregate inclusion

검증 SQL/API 예시:

- execution 1건당 `execution_requests` row 1개
- attempt 1회 이상
- status event 2개 이상
- terminal state 존재 또는 active reason 존재

---

## 9. Demo-day Manual Checklist

발표 직전 최소 체크:

1. adapter health check 통과
2. smoke tx 1건 성공
3. dashboard compare 페이지 로드 확인
4. swap demo / payment demo 데이터 초기화
5. fallback narrative 준비
6. network variance 발생 시 보여줄 recorded screenshot/log 준비

---

## 10. 비기능 테스트

### Content guardrail

- UI / docs / API response example에서 `guaranteed`, `perfect protection` 표현 금지

### Performance sanity

- compare dashboard 쿼리 p95가 demo 환경에서 체감상 즉시(<2s) 로드
- receipt detail 조회는 1초 내 응답 목표

### Failure UX

- expired / failed 상태도 정상 화면으로 렌더링
- 사용자가 ambiguous blank state를 보지 않음

---

## 11. MVP Exit Criteria

아래를 만족해야 테스트 완료로 본다.

- Unit: policy/state machine/receipt core suite green
- Integration: send / retry / fallback / dashboard API suite green
- E2E: FAST comparison + PROTECTED swap + RELIABLE payment 중 최소 2개 green
- Smoke: 발표 환경에서 최소 1건 실제 송신 확인
- Manual: content guardrail checklist 완료

---

## 12. 권장 테스트 파일 구조

- `packages/policy-engine/src/__tests__/policy-engine.test.ts`
- `packages/policy-engine/src/__tests__/fee-strategy.test.ts`
- `workers/tx-monitor/src/__tests__/state-machine.test.ts`
- `services/api/src/__tests__/executions.integration.test.ts`
- `services/api/src/__tests__/fallback.integration.test.ts`
- `apps/dashboard/e2e/compare.spec.ts`
- `apps/demo-swap/e2e/protected-flow.spec.ts`
- `apps/demo-payments/e2e/reliable-flow.spec.ts`

---

## 13. Known Gaps We Accept For Hackathon

- real MEV protection efficacy benchmarking은 범위 밖
- 모든 provider 조합에 대한 exhaustive adapter certification은 범위 밖
- mainnet long-run soak test는 범위 밖
- on-chain registry program tests는 stretch goal
