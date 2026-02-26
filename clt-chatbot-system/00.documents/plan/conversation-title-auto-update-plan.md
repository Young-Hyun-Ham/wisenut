# 대화 제목 자동 업데이트 계획서

## 목적
- LLM 스트리밍 응답의 `metadata.question`을 활용해 대화 제목을 자동 갱신한다.
- 기본값(`New Chat`)인 경우에만 갱신하여 사용자 커스텀 제목을 보호한다.

## 범위
- 메인 채팅 스트리밍 응답 처리
- 대화 제목 1회 자동 업데이트

---

## 0) 처리 위치(결정)
- **프론트엔드에서 처리** (스트리밍 `metadata` 이벤트를 클라이언트가 직접 수신)

---

## 1) 동작 조건

- **첫 번째 `metadata` 이벤트만 사용**
- `data.question` 값이 존재할 때만 처리
- 현재 대화 제목이 **기본값(`New Chat`)일 때만** 업데이트
- 한 대화당 1회만 적용

---

## 2) 처리 흐름(요약)

1) 스트리밍 중 `metadata` 이벤트 감지
2) `data.question` 추출
3) 현재 대화 제목이 기본값인지 확인
4) 기본값이면 `PATCH /conversations/{id}`로 제목 업데이트
5) PATCH 후 대화 목록 캐시 무효화(React Query invalidate)
6) 동일 대화에 대해 재호출되지 않도록 플래그 처리

---

## 3) 구현 위치(후보)

- `01.workspaces/apps/chatbot-front/app/lib/streamProcessors.js`
  - `metadata` 이벤트 처리 로직 추가
- `01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js`
  - 제목 업데이트 API 호출/플래그 처리

---

## 4) API 스펙

### PATCH /conversations/{conversationId}
- Request Body: `{ "title": "<question>" }`
- Response: `{ id, title, ... }`

---

## 5) 예외/정책

- 질문 길이가 너무 길 경우(예: 100자 이상) 절삭
- 이미 사용자 편집된 제목은 변경하지 않음
- `metadata`가 누락되면 업데이트하지 않음

---

## 6) 검증 체크리스트

- 첫 `metadata`에서만 제목이 변경되는지 확인
- `New Chat`이 아닌 제목은 유지되는지 확인
- 스트리밍 종료 후에도 제목이 유지되는지 확인
