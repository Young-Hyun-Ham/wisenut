# 대화(/conversations) DB 처리 설계서

## 목적
- `/conversations` 및 메시지 저장/조회 흐름을 PostgreSQL 기준으로 설계한다.
- Firestore 기반 구조를 대체하면서도 PoC/스트리밍 요구를 충족한다.

## 전제
- 백엔드: FastAPI + PostgreSQL
- 테이블명 snake_case(소문자)
- 메시지 저장은 서버에서 수행(정합성 기준)

---

## 1) 데이터 모델(핵심)

### conversation
- `id` (uuid, PK)
- `user_id` (uuid, FK: user.id)
- `title` (string, nullable)
- `pinned` (bool, default false)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### message
- `id` (uuid, PK)
- `conversation_id` (uuid, FK: conversation.id)
- `user_id` (uuid, FK: user.id)
- `sender` (string: user/assistant/system)
- `content` (text)
- `type` (string: text/llm/llm_stream/scenario 등)
- `scenario_session_id` (uuid, nullable)
- `meta` (jsonb, nullable)
- `created_at` (timestamptz)

---

## 2) API 처리 흐름

### 2-1) 대화 생성
- `POST /conversations`
- 입력: `{ title }`
- 처리:
  1) `conversation` 레코드 생성
  2) 생성 결과 반환

### 2-2) 대화 목록 조회
- `GET /conversations?offset&limit`
- 처리:
  1) `conversation`을 `updated_at desc`로 조회
  2) 필요 시 마지막 메시지/미읽음 플래그 조인 고려

### 2-3) 대화 상세/메시지 조회
- `GET /conversations/{id}`
- `GET /conversations/{id}/messages?skip&limit`
- 처리:
  1) `message`를 `created_at desc`로 페이징
  2) 프론트는 시간 역순을 뒤집어 표시

---

## 3) 메인 채팅 저장 규칙

### 일반 응답(JSON)
1) 사용자 메시지 저장
2) LLM 응답 수신
3) 응답 메시지 저장
4) `conversation.updated_at` 갱신

### 스트리밍 응답
- 서버에서 토큰을 수집하고 종료 시 1회 저장
- 저장 실패 시에도 응답은 유지 (저장 재시도는 백엔드 정책으로 처리)

---

## 4) 정합성/중복 방지

- 메시지 저장 시 `idempotency_key` 도입 고려
- 동일 요청 재전송 대비:
  - `(conversation_id, idempotency_key)` 유니크 인덱스 옵션

---

## 5) 인덱스 제안

- `conversation(user_id, updated_at desc)`
- `message(conversation_id, created_at desc)`
- `message(scenario_session_id, created_at desc)` (시나리오 조회용)

---

## 6) 마이그레이션 기준

- Firestore 구조와 매핑
  - `chats/{user.uid}/conversations/{conversationId}` → `conversation`
  - `.../messages` → `message`
- 필드 매핑
  - `createdAt` → `created_at`
  - `updatedAt` → `updated_at`
  - `sender/role` → `sender`

---

## 7) 추가 결정 필요 사항

- 메시지 타입 분류 기준(`type` enum)
- `meta` 필드 저장 범위(원본 LLM 응답 전체 vs 요약)
- 대화 제목 자동 생성 규칙(첫 질문 기준 등)

---

## 8) 계층 분리(Repository/Service)

### 목적
- 라우터에서 DB/LLM 로직을 분리해 복잡도를 낮춘다.
- 향후 LLM 교체 및 DB 정책 변경에 유연하게 대응한다.

### 권장 구조
- `routers/chat.py` → `services/chat_service.py` → `repositories/chat_repository.py`
- `services/llm_service.py`에서 LLM 인터페이스를 정의
- `services/flowise_client.py`는 LLM 구현체로 분리(Flowise 전용)

### Repository 단일 파일(초기안)
- `repositories/chat_repository.py` 하나로 시작
- 포함 범위:
  - 대화 생성/조회/갱신
  - 메시지 저장/조회
  - (선택) 시나리오 세션 관련 저장
