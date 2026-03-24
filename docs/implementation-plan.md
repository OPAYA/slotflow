# SlotFlow Implementation Plan

이 문서는 SlotFlow MVP를 실제로 빌드할 때의 순서, 파일 구조, 작업 분할, 7일 일정표를 정의한다.

---

## 1. 개발 원칙

1. **계약부터 고정**: policy / receipt / state enum을 먼저 고정한다.
2. **mock-first integration**: 외부 route provider보다 adapter interface와 state machine을 먼저 만든다.
3. **dashboard early**: 제품 설득력은 observability에서 나오므로 로그 스키마를 초반에 고정한다.
4. **2개 데모 우선**: swap + payment를 우선, fast-action은 여유 시 추가한다.
5. **recorded fallback 준비**: 해커톤 네트워크 변동성을 대비한다.

---

## 2. MVP에서 고정할 기술 선택

바로 개발을 시작하기 위해 MVP에서는 아래 결정을 **고정**한다.

- Package manager: `pnpm`
- Runtime: Node.js 20
- Language: TypeScript
- Frontend: Next.js App Router
- API server: Fastify
- Storage: Supabase Postgres
- ORM: Prisma
- Validation: Zod
- Test: Vitest + Playwright
- Realtime: polling only

> 핵심은 framework 취향보다 **shared contract + execution event model**을 먼저 고정하는 것이다.

---

## 3. Phase Plan

### Phase 0 — Workspace bootstrap

목표:
- monorepo 뼈대 생성
- TypeScript shared config 고정

산출물:
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `apps/`, `packages/`, `services/`, `workers/` 디렉터리

### Phase 1 — Shared contracts + SDK skeleton

목표:
- PRD와 API 계약을 코드 타입으로 고정

산출물:
- `packages/shared/src/contracts/*.ts`
- `packages/sdk/src/client.ts`
- `packages/sdk/src/index.ts`

완료 기준:
- mocked HTTP server에 대해 SDK contract test 통과

### Phase 2 — Policy engine + adapters

목표:
- policy별 derived execution plan 생성
- 3개 adapter stub 구현

산출물:
- `packages/policy-engine/src/**`
- `packages/route-adapters/src/**`

완료 기준:
- policy unit tests green
- adapter selection tests green

### Phase 3 — API + persistence + monitor worker

목표:
- send endpoint에서 receipt 생성
- worker가 상태 변화를 업데이트

산출물:
- `services/api/src/routes/executions.ts`
- `services/api/src/lib/execution-service.ts`
- `workers/tx-monitor/src/monitor.ts`
- DB schema / migration

완료 기준:
- execution request → receipt persisted
- state machine integration test green

### Phase 4 — Dashboard + demos

목표:
- execution list / receipt detail / compare 화면 구현
- swap / payment demo 연결

산출물:
- `apps/dashboard`
- `apps/demo-swap`
- `apps/demo-payments`

완료 기준:
- compare UI에 policy 차이 표시
- 최소 2개 demo e2e green

### Phase 5 — Polish + pitch hardening

목표:
- copy guardrail 점검
- demo 안정화
- fallback narrative 준비

산출물:
- seed/demo data
- smoke scripts
- 발표용 screenshot / metrics 캡처

---

## 4. 추천 파일 트리

```text
apps/
  dashboard/
  demo-swap/
  demo-payments/
packages/
  shared/
    src/contracts/
  sdk/
    src/
  policy-engine/
    src/policies/
  route-adapters/
    src/
  solana-utils/
    src/
services/
  api/
    src/routes/
    src/lib/
workers/
  tx-monitor/
    src/
```

### 필수 환경변수

- `DATABASE_URL`
- `SLOTFLOW_PUBLIC_RPC_URL`
- `SLOTFLOW_PROTECTED_RPC_URL`
- `SLOTFLOW_FAST_RPC_URL`
- `SLOTFLOW_DEFAULT_CONFIRMATION_TARGET`
- `SLOTFLOW_MAX_FEE_LAMPORTS_DEFAULT`
- `SLOTFLOW_POLL_INTERVAL_MS`
- `SLOTFLOW_APP_BASE_URL`

### Bootstrap checklist

1. pnpm workspace 초기화
2. Next.js dashboard / demo app 생성
3. Fastify API 서비스 생성
4. Prisma schema + Supabase 연결
5. shared contracts 패키지 생성
6. Vitest / Playwright 기본 러너 연결

---

## 5. 우선순위 백로그 (권장 순서)

### Epic A — Contracts first

1. policy / receipt / route enum 정의
2. execution request/response schema 정의
3. DB schema 초안 작성

### Epic B — SDK & API skeleton

4. `POST /v1/executions` stub 반환
5. SDK `send()` / `getReceipt()` 구현
6. mocked receipt polling 구현

### Epic C — Policy engine

7. policy defaults 테이블 구현
8. route scoring 함수 구현
9. fee cap 적용 로직 구현
10. explanation generator 구현

### Epic D — Execution runtime

11. public/protected/fast adapter stub 구현
12. execution service에서 attempt 저장
13. monitor worker state transition 구현
14. expiration / retry logic 구현

### Epic E — Dashboard / demos

15. execution list 페이지
16. receipt detail 페이지
17. compare 페이지
18. swap demo 연결
19. payment demo 연결

### Epic F — Verification / polish

20. e2e 및 smoke scripts
21. demo seed data
22. content guardrail review

---

## 6. 7일 빌드 플랜

| Day | 목표 | 산출물 |
| --- | --- | --- |
| Day 1 | 정책/계약 확정 | shared contracts, DB draft, API shape |
| Day 2 | SDK + send skeleton | SDK client, API stub, mocked receipt |
| Day 3 | FAST path | fast adapter, latency-first plan, basic polling |
| Day 4 | PROTECTED path | protected adapter, swap demo, explanation UI |
| Day 5 | RELIABLE path | retry/expiration state machine, payment demo |
| Day 6 | Dashboard | execution list, receipt detail, compare metrics |
| Day 7 | Demo hardening | smoke checks, recorded fallback, pitch narrative |

---

## 7. 병렬 작업 분할 예시

### 2인 팀

- Builder A: backend / policy engine / worker
- Builder B: dashboard / SDK / demo apps

### 3인 팀

- Builder A: contracts + API + DB
- Builder B: adapters + policy engine + worker
- Builder C: dashboard + demos + pitch metrics

### 4인 팀

- Builder A: shared contracts + SDK
- Builder B: policy engine + adapters
- Builder C: API + worker + DB
- Builder D: dashboard + demos + content polish

---

## 8. 첫 구현에서 단순화해야 할 것

해커톤 MVP에서는 아래를 일부러 단순화한다.

- adapter provider는 환경변수 기반 1개씩만 연결
- WebSocket 대신 polling 우선
- auth는 `appId` + local secret 수준으로 최소화
- fee estimator는 복잡한 ML/forecast 대신 heuristic band 사용
- compare metrics는 batch aggregate보다 receipt 기반 계산으로 시작

---

## 9. 데모 우선순위

1. **Payment (RELIABLE)**
   - 상태 추적이 명확해 제품 메시지가 잘 드러남
2. **Swap (PROTECTED)**
   - policy explanation이 직관적임
3. **Fast action (FAST)**
   - 수치 비교용으로 좋지만 네트워크 변동성이 큼

> 추천: payment + swap을 primary demo로 만들고,
> FAST는 compare panel 데이터로 설득하는 구성을 우선한다.

---

## 10. 위험 관리 체크리스트

- [ ] adapter unavailable 시 fallback path 존재
- [ ] receipt가 terminal state를 표시
- [ ] compare 화면이 빈 화면이 아님
- [ ] 최소 2개 데모 flow 기록 영상/스크린샷 확보
- [ ] pitch copy에서 guarantee 표현 제거

---

## 11. Definition of Done

아래 조건을 만족하면 MVP를 "완료"로 본다.

- SDK → API → adapter → worker → dashboard가 연결됨
- FAST / PROTECTED / RELIABLE 모두 contract 상 동작
- swap / payment 중 최소 2개 데모가 실행 가능
- compare dashboard가 정책별 차이를 보여줌
- 핵심 테스트 스위트와 smoke checklist 완료
