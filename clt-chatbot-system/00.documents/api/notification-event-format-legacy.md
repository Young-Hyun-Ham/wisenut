# 기존 알림 이벤트 포맷 정리(프론트 기준)

## 목적
- PoC 단계에서 사용 중인 알림 이벤트 구조를 문서화
- Firestore 의존을 제거하고 SSE/REST로 이관하기 위한 기준 확보

## 발생 위치(이벤트 생성 경로)
- `/api/chat` 응답의 `events` 배열
- 프론트 `notificationSlice.handleEvents()`가 이벤트 처리

## 처리 흐름 요약
1) `/api/chat` 응답 → `data.events`
2) `handleEvents(data.events, scenarioSessionId, conversationId)`
3) `event.type === "toast"` → `showToast()` 호출
4) `showToast()`가 Firestore에 알림 저장 + UI 토스트 표시

---

# 1) 이벤트 배열 포맷(`/api/chat` 응답)

## events (Array)
```json
[
  {
    "type": "toast",
    "message": "알림 메시지",
    "toastType": "info"
  }
]
```

### 필드 설명
- `type`: 이벤트 타입 (`toast`, `open_link` 등)
- `message`: 사용자에게 노출할 메시지
- `toastType`: 알림 스타일(`info`, `success`, `error`)

---

# 2) Firestore 저장 포맷(알림 문서)

## collection
```
users/{userId}/notifications/{notificationId}
```

## document payload
```json
{
  "message": "알림 메시지",
  "type": "info",
  "createdAt": "serverTimestamp()",
  "read": false,
  "scenarioSessionId": "optional",
  "conversationId": "optional"
}
```

### 필드 설명
- `message`: 알림 메시지 본문
- `type`: 알림 유형(토스트 스타일)
- `createdAt`: 서버 타임스탬프
- `read`: 읽음 여부
- `scenarioSessionId`: 시나리오 세션 참조(있을 경우)
- `conversationId`: 대화 참조(있을 경우)

---

# 3) 알림 UI/네비게이션 연계 필드
- `conversationId`: 알림 클릭 시 해당 대화 로드
- `scenarioSessionId`: 알림 클릭 시 해당 메시지로 스크롤

---

# 4) 관련 소스 경로
- 이벤트 처리: `01.workspaces/apps/chatbot-front/app/store/slices/notificationSlice.js`
- 이벤트 발생: `01.workspaces/apps/chatbot-front/app/store/slices/scenarioSlice.js`
- 알림 UI: `01.workspaces/apps/chatbot-front/app/components/NotificationModal.jsx`

---

# 5) SSE 전환 매핑표(기존 → 신규)

## 개요
- 기존 Firestore 문서/이벤트 필드를 SSE payload로 매핑
- SSE 이벤트 이름은 `notification` 사용
- 신규 스펙 기준: `00.documents/api/notification-realtime-spec.md`

## 매핑 표

| 기존 필드 | 신규 SSE 필드 | 비고 |
| --- | --- | --- |
| `message` | `message` | 동일 |
| `type` | `type` | 동일 |
| `createdAt` | `created_at` | ISO8601 문자열로 변환 |
| `read` | `read` | 동일 |
| `scenarioSessionId` | `scenario_session_id` | snake_case로 변환 |
| `conversationId` | `conversation_id` | snake_case로 변환 |
| Firestore `doc.id` | `id` | UUID 기준(백엔드 생성) |

## 이벤트 배열 → SSE 변환 규칙
- 기존 `/api/chat` 응답 `events[]` 중 `type === "toast"`만 알림으로 전환
- 변환 후 SSE로 전달되는 payload 예시:
```json
{
  "id": "uuid",
  "type": "info",
  "message": "알림 메시지",
  "read": false,
  "created_at": "2026-01-21T12:00:00Z",
  "scenario_session_id": "optional",
  "conversation_id": "optional"
}
```

## 프론트 처리 변경 요약
- Firestore `onSnapshot` → SSE 구독(`GET /notifications/stream`)
- Firestore 저장/수정/삭제 → REST API 호출로 전환
  - `GET /notifications`
  - `POST /notifications/read`
