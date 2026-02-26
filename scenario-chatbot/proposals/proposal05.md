# 제안서: 운영 환경용 인터럽트 상태 저장 개선

## 배경 및 문제
- 현재 `_last_interrupt_node`는 프로세스 메모리 기반이라 서버 재기동 시 유실됨
- 멀티 인스턴스/스케일 아웃 환경에서 일관성이 보장되지 않음
- 운영 환경에서는 대화 상태를 외부 저장소에 보관해야 안정적임

## 목표
- 재기동/스케일 아웃에도 안정적인 상태 복원
- 저장소 변경에 강한 구조(메모리 -> Redis/DB)
- 최소한의 코드 변경으로 확장 가능

## 대안 비교
1) Redis 저장
- 장점: 속도 빠름, TTL 관리 쉬움, 운영 패턴 보편적
- 단점: 인프라 의존성 추가

2) Postgres 저장
- 장점: 이미 DB가 있으면 인프라 재사용 가능, 영속성 강함
- 단점: 부하 증가, TTL/만료 관리 번거로움

3) LangGraph Checkpointer(Postgres) 활용
- 장점: 그래프 상태 자체와 연계 가능
- 단점: 인터럽트 노드 기록만 따로 쓰기엔 복잡

## 추천안 (1차)
- Redis 기반 `conversation_id -> last_interrupt_node` 저장
- TTL 적용 (예: 24h)로 오래된 상태 자동 정리

## 설계 개요
- 인터페이스
  - `LastInterruptStore.get(conversation_id) -> node_id | None`
  - `LastInterruptStore.set(conversation_id, node_id) -> None`
- 구현체
  - `MemoryLastInterruptStore` (개발용)
  - `RedisLastInterruptStore` (운영용)

## 적용 흐름
1) 인터럽트 발생 시 `store.set(conversation_id, node_id)`
2) resume 요청 시 `store.get(conversation_id)`로 재개 지점 확인
3) 성공적으로 처리되면 필요 시 상태 갱신/삭제

## 데이터 모델(예시)
- Key: `chat:last_interrupt:{conversation_id}`
- Value: `{ "node_id": "node-123", "updated_at": "2024-01-01T12:00:00Z" }`

## 단계적 적용 계획
1) Store 인터페이스 도입 및 메모리 구현 추가
2) FastAPI Depends로 Store 주입
3) Redis 구현 추가 및 환경변수로 선택
4) 운영 적용 및 모니터링

## 리스크 및 대응
- Redis 장애 시: 메모리 fallback 또는 요청 오류 처리 정책 정의
- 상태 누락 시: 클라이언트에 재시작 유도 메시지 제공
