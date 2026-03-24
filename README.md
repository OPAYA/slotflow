# SlotFlow

SlotFlow는 Solana 앱이 트랜잭션을 보낼 때 fee knob를 직접 조합하는 대신,
원하는 execution quality(FAST / PROTECTED / RELIABLE)를 선언해서 전송하도록 해주는
**policy-driven execution layer**다.

> 지금: `sendTransaction + fee 튜닝 + 운`
>
> SlotFlow: **"이건 빠르게 / 이건 보호되게 / 이건 안정적으로"**를 선택해서 보냄

## 핵심 약속

- **Fee-first → Policy-first**: 수수료 숫자 대신 제품 수준의 실행 의도를 선택한다.
- **Route-aware execution**: public RPC / protected path / fast path를 정책에 맞게 선택한다.
- **Explainable receipt**: signature만 주는 대신 route, fee, retry, status를 설명 가능한 receipt로 돌려준다.
- **Honest claims**: guaranteed, perfect protection 같은 표현을 피하고 optimized / enhanced / focused language만 쓴다.
- **Off-chain control plane first**: 핵심 가치는 체인 도달 전 라우팅과 상태 관리에 있다.

## MVP 정책

| Policy | 목적 | 대표 사용처 |
| --- | --- | --- |
| `FAST` | landed latency 최소화 | bot, urgent action, latency-sensitive UX |
| `PROTECTED` | 나쁜 실행 위험 완화 | retail swap, aggregator, consumer wallet |
| `RELIABLE` | ambiguous state 없이 안정적 완료 추적 | payment, payroll, settlement |

## 문서 맵

개발 시작 전 아래 순서로 읽으면 된다.

1. `.omx/plans/prd-slotflow-mvp.md` — 제품 정의, 범위, acceptance criteria
2. `docs/architecture.md` — 시스템 구조, execution lifecycle, state machine
3. `docs/api-contracts.md` — SDK/HTTP/data contracts
4. `.omx/plans/test-spec-slotflow-mvp.md` — 테스트 전략, demo 검증 기준
5. `docs/implementation-plan.md` — 7일 빌드 플랜, 파일 구조, 우선순위 티켓

## MVP 산출물

- Policy-based send SDK
- Routing engine + route adapters
- Retry / confirmation state machine
- Receipt + observability dashboard
- Demo app 2종 이상 (swap / payment / fast action 중 최소 2개)

## 절대 과장하지 말 것

**금지 표현**
- 완벽한 MEV 방지
- 실행 보장
- 모든 tx 품질 보장
- 모든 path에서 private
- BAM integrated and production-ready

**권장 표현**
- policy-driven
- route-aware
- quality-optimized
- protection-enhanced
- reliability-focused

## 바로 시작할 때의 추천 순서

1. pnpm workspace / TypeScript monorepo bootstrap
2. shared contracts + receipt/status enum 확정
3. policy engine / adapter interface 구현
4. API send endpoint + tx monitor worker
5. dashboard + comparison demo 연결

자세한 개발 순서는 `docs/implementation-plan.md`에 정리돼 있다.
