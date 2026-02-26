# 알림 실시간 전송 스펙 (SSE + 교체형 이벤트 소스)

## 목적
- Firestore onSnapshot 대체를 위해 SSE 기반 알림 스트림 제공
- 알림 이벤트 원천을 교체 가능한 구조로 분리
- DB를 단일 진실원으로 유지

## 범위
- 알림 저장/조회/실시간 스트림 API
- 이벤트 소스 추상화(PL/LISTEN/NOTIFY/외부 시스템)
- SSE 재연결 및 초기 스냅샷 정책

## 비범위
- 모바일 푸시(APNS/FCM)
- 알림 템플릿/디자인 상세
- 외부 고객사 시스템의 구체 구현

## 주요 원칙
- 프론트는 `SSE`만 사용한다(소스 변경 무관)
- 이벤트는 **DB 저장 후 SSE 전송**이 기본 흐름
- SSE 끊김 대비 **재연결 시 최신 상태 재조회**
- 테이블명은 `snake_case` 소문자 사용

---

# 1) 데이터 모델

## notification (기본)
- `id` (uuid, PK)
- `user_id` (uuid, FK -> user.id)
- `type` (string, 예: `chat`, `system`, `admin`)
- `message` (text)
- `read` (boolean, default false)
- `created_at` (timestamptz)

## notification_event (선택, 이벤트 로그)
- `id` (uuid, PK)
- `notification_id` (uuid, FK)
- `source` (string, 예: `db`, `webhook`, `polling`)
- `payload` (jsonb)
- `created_at` (timestamptz)

---

# 2) API 스펙

## GET /notifications
- 설명: 알림 목록 조회
- 쿼리:
  - `limit` (default 20, max 100)
  - `cursor` (optional, last id or created_at)
  - `unread_only` (bool)
- 응답(200):
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "system",
      "message": "공지",
      "read": false,
      "created_at": "2026-01-21T12:00:00Z"
    }
  ],
  "next_cursor": "..."
}
```

## POST /notifications/read
- 설명: 알림 읽음 처리(단건/다건)
- 요청:
```json
{
  "ids": ["uuid1", "uuid2"]
}
```
- 응답(200):
```json
{ "updated": 2 }
```

## GET /notifications/stream
- 설명: SSE 실시간 알림 스트림
- 헤더:
  - `Authorization: Bearer <token>`
- 이벤트 포맷:
```
event: notification
data: {"id":"uuid","type":"system","message":"...","read":false,"created_at":"..."}
```
- 초기 스냅샷 이벤트(연결 직후 1회):
```
event: snapshot
data: {"items":[...]}
```

---

# 3) SSE 동작 정책

## 연결 시나리오
1) 클라이언트가 `GET /notifications/stream` 연결
2) 서버가 최신 알림 스냅샷 1회 전송
3) 이후 신규 알림 발생 시 `event: notification` 전송

## 재연결 처리
- 클라이언트는 연결 끊김 시 즉시 재연결 시도
- 서버는 재연결 시에도 스냅샷 1회 제공
- `Last-Event-ID` 사용은 옵션(서버 구현 여건에 따라)

---

# 4) 이벤트 소스 추상화

## 인터페이스(개념)
- `NotificationEventSource.start()`
- `NotificationEventSource.stop()`
- `NotificationEventSource.on_event(callback)`

## 구현체
- `PgNotifySource`:
  - `LISTEN chatbot_events`
  - payload 예: `{"type":"notification","id":"...","user_id":"..."}`
- `WebhookSource`:
  - 고객사 시스템에서 웹훅 수신
  - 수신 데이터 -> DB 저장 -> SSE 전송
- `PollingSource`:
  - 일정 주기로 외부 시스템/테이블 diff

---

# 5) NOTIFY 규격(권장)

## 채널명
- `chatbot_events`

## payload 규칙
- 최소 필드만 포함
```json
{
  "type": "notification",
  "id": "uuid",
  "user_id": "uuid",
  "action": "created"
}
```

## DB 트리거 예시(개념)
- `notification` insert 시 `pg_notify('chatbot_events', payload)`

---

# 6) 보안/권한
- SSE/REST 모두 JWT 인증 필요
- `user_id` 기준으로 필터링 전송
- 관리자 알림은 role 기반 정책 적용 가능

---

# 7) 장애/복구
- NOTIFY 누락 대비: SSE 재연결 시 스냅샷 제공
- 이벤트 소스 다운: `notification` 저장 API는 독립 유지
- 대량 이벤트 시: 배치 전송/압축 고려

---

# 8) 테스트 시나리오
- 신규 알림 생성 → SSE 수신 확인
- SSE 재연결 시 최신 알림 스냅샷 확인
- 읽음 처리 후 목록 반영 확인
- 외부 소스(Webhook) 입력 → DB 저장 및 SSE 전파 확인

---

# 9) 결정 필요 사항
- 스냅샷 기본 개수(예: 20)
- 알림 타입 표준화 목록
- 이벤트 소스 기본값(PgNotify vs Webhook)
