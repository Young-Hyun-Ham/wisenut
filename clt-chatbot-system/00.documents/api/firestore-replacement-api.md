# Firestore 제거 우선 API 디자인

## 목표
- `reference/clt-chatbot`, `reference/react-flow`에서 사용 중인 Firestore 의존성을 백엔드 API로 대체한다.
- 기능 우선순위: 인증/사용자 → 대화/메시지 → 시나리오/노드 → 사용자 설정 → 알림/즐겨찾기 → 운영 보조 기능.

## 범위(주요 Firestore 사용 영역)
- 인증/사용자 정보
- 대화/메시지/시나리오 세션
- 시나리오/카테고리/노드/템플릿
- 즐겨찾기/알림
- UI/사용자 개인설정 및 글로벌 설정
- 검색/개발보드(DevBoard)

## API 디자인 원칙
- 모든 데이터는 백엔드(PostgreSQL)에서 관리한다.
- 클라이언트는 Firebase SDK를 사용하지 않고 REST API만 호출한다.
- 메인 채팅은 `/api/chat` 단일 경로로 유지하되, 나머지 데이터 관리 기능은 별도 리소스로 분리한다.
- 실시간 동기화가 필요하면 SSE 또는 폴링으로 대체한다.

---

# 1) 인증/사용자

### POST /auth/login
- 정식 인증(SSO 또는 ID/PW) 시 사용

### GET /auth/dev-login?id={user_id}
- PoC 임시 로그인(환경 제한)

### GET /users/me
- 현재 로그인 사용자 정보

### PATCH /users/me
- 사용자 프로필 업데이트

---

# 2) 대화/메시지

### GET /conversations
- 대화 목록(핀/정렬 포함)

### POST /conversations
- 대화 생성

### PATCH /conversations/{id}
- 제목 변경, 핀 토글

### DELETE /conversations/{id}
- 대화 삭제

### GET /conversations/{id}/messages?skip=0&limit=15
- 메시지 페이지네이션

### POST /conversations/{id}/messages
- 메시지 저장(사용자 입력/시스템 메시지)

---

# 3) 시나리오/노드/카테고리

### GET /scenarios
- 시나리오 카테고리/목록

### GET /scenarios/{scenarioId}
- 시나리오 상세(노드 포함)

### POST /scenarios
- 시나리오 생성 (Admin)

### PATCH /scenarios/{scenarioId}
- 시나리오 수정 (Admin)

### DELETE /scenarios/{scenarioId}
- 시나리오 삭제 (Admin)

### GET /scenario-categories
- 시나리오 카테고리 조회 (Admin)

### PUT /scenario-categories
- 시나리오 카테고리 저장 (Admin)

---

# 4) 시나리오 세션(진행 상태)

### POST /scenario-sessions
- 시나리오 시작 시 세션 생성

### GET /scenario-sessions/{id}
- 진행 상태 조회

### PATCH /scenario-sessions/{id}
- 상태 업데이트(슬롯/노드 진행)

### POST /scenario-sessions/{id}/end
- 세션 종료

---

# 5) 즐겨찾기

### GET /favorites
- 즐겨찾기 목록

### POST /favorites
- 즐겨찾기 추가

### DELETE /favorites/{id}
- 즐겨찾기 삭제

---

# 6) 알림

### GET /notifications
- 알림 목록

### PATCH /notifications/{id}
- 읽음 처리

### POST /notifications/read-all
- 전체 읽음 처리

---

# 7) 개인설정/글로벌 설정

### GET /settings/user
- 개인 설정 조회

### PUT /settings/user
- 개인 설정 저장

### GET /settings/global
- 글로벌 설정 조회

### PUT /settings/global
- 글로벌 설정 저장 (Admin)

---

# 8) 검색/DevBoard

### GET /search?q=...
- 검색(시나리오/대화/메시지 등)

### GET /dev-board
- 운영/개발 보조 정보(필요 시)

### PUT /dev-board
- 운영/개발 보조 정보 업데이트(필요 시)

---

# 9) 메인 채팅

### POST /api/chat
- 시나리오/LLM 통합 처리
- 스트리밍 응답(SSE) 지원

### PoC 응답 포맷(임시 호환)
- 단계: PoC 응답 포맷으로 화면 표시를 먼저 확인한 뒤 정식 스펙으로 개선
- 응답 예시 요약
  - `type: "scenario_start"`
  - `nextNode`(버튼/텍스트/노드 메타 포함)
  - `scenarioState`(scenarioId, currentNodeId, awaitingInput)
  - `slots`
- 유의: PoC 응답은 임시 호환이며 정식 스펙 확정 시 필드명/구조가 변경될 수 있음

---

## 클라이언트 교체 포인트 요약
- Firebase SDK 초기화 제거
- Firestore 읽기/쓰기 → 위 REST API 호출로 전환
- 실시간 리스너(onSnapshot) → SSE 또는 주기적 fetch로 대체(아래 구체안 참고)

### 실시간 교체 구체안

#### 옵션 A) SSE + PostgreSQL LISTEN/NOTIFY (권장)
- 개요: DB에서 이벤트 발생 → NOTIFY → 백엔드가 수신 → SSE로 클라이언트 푸시
- 구성 흐름
  1) 트랜잭션 내에서 INSERT/UPDATE 후 `pg_notify('chatbot_events', payload)`
  2) FastAPI가 `LISTEN chatbot_events`로 이벤트 수신
  3) 관련 사용자/세션 필터링 후 SSE 채널로 전송
- 장점: 실시간성 우수, 폴링 비용 감소, Firestore onSnapshot 유사
- 주의: NOTIFY는 이벤트 “신호”용이며 누락 대비 재조회 필요

#### 옵션 B) 주기적 fetch(폴링)
- 개요: 클라이언트가 `GET /notifications`, `GET /conversations` 등을 일정 주기로 호출
- 장점: 구현 단순
- 단점: 트래픽 증가, 실시간성 저하

### 구현 원칙(옵션 A 기준)
- 이벤트 테이블/상태는 DB에 저장(정합성 단일화)
- NOTIFY payload는 최소 정보(리소스 타입, id, user_id, action)만 포함
- SSE 초기 연결 시 최신 데이터 스냅샷 1회 제공
- SSE 끊김 대비 재연결 시 최신 상태 재조회

### 이벤트 예시
- 채팅 메시지 신규 생성 → `pg_notify('chatbot_events', '{"type":"message","id":"...","user_id":"..."}')`
- 알림 생성 → `pg_notify('chatbot_events', '{"type":"notification","id":"...","user_id":"..."}')`

### 알림 이벤트 소스 추상화(교체 가능 구조)
- 프론트는 `GET /notifications/stream` SSE만 사용(소스 변경과 무관)
- 백엔드는 이벤트 소스를 인터페이스로 분리하여 교체 가능
  - 구현 A: PostgreSQL LISTEN/NOTIFY
  - 구현 B: 고객사 알림 시스템(Webhook/Queue 연계)
  - 구현 C: 주기적 폴링 + DB diff
- 모든 이벤트는 `notification` 테이블에 저장 후 SSE로 전달

---

## 다음 결정 필요 사항
1) 개인설정/글로벌설정 스키마 확정
2) 시나리오/노드 데이터 구조 확정
3) 알림/즐겨찾기/검색의 범위
4) 실시간 동기화 방식(SSE vs 폴링)
