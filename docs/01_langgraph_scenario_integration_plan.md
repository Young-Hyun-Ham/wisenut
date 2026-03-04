# CLT Chatbot ↔ LangGraph 시나리오 연동 구현 가이드 (PM 방향성 문서)

## 📌 목적
- 본 문서는 **코드 수정 전에 개발자가 그대로 구현 착수할 수 있는 수준의 작업 가이드**를 제공한다.
- 범위는 다음 두 프로젝트만 사용한다.
  - `clt-chatbot`
  - `scenario-chatbot-with-langgraph`
- 목표는 다음과 같다.
  1. 로딩 시 shortcut 메뉴는 기존처럼 backend endpoint에서 시나리오 액션 정보를 조회한다.
  2. 사용자가 shortcut 시나리오를 실행하면, 프론트의 로컬 노드 실행 대신 `scenario-chatbot-with-langgraph`를 호출한다.
  3. LangGraph 실행 결과를 `clt-chatbot` 메시지 구조로 주입하여 기존 UI를 재활용한다.

---

## 🧱 현재 구조 요약 (기준선)

### 1) clt-chatbot
- shortcut 카테고리 로드는 `/shortcut` endpoint를 호출한다.
- 시나리오 시작/진행은 현재 프론트 로컬 로직(`getNextNode`, `continueScenarioIfNeeded`) 비중이 크다.
- `app/api/chat/route.js`에서 `runScenario(...)`를 통해 시나리오를 직접 실행하는 경로도 존재한다.

### 2) scenario-chatbot-with-langgraph
- React Flow 시나리오 JSON을 LangGraph로 컴파일 후 실행한다.
- 버튼/폼 입력은 interrupt로 중단하고, 다음 호출에서 resume한다.
- `POST /api/v1/chat/{scenario_id}`는 SSE 스트리밍으로 이벤트를 전달한다.

---

## 🎯 TO-BE 목표 아키텍처

```text
[clt-chatbot]
  ├─ (초기 로딩) GET /shortcut --------------> [기존 backend]
  └─ (시나리오 실행) POST /api/v1/chat/{scenario_id} --> [scenario-chatbot-with-langgraph]
       ├─ SSE event: message (node 출력)
       ├─ SSE event: message (interrupt: button/form)
       └─ SSE event: end

[clt-chatbot UI]
  ├─ 수신 이벤트를 기존 scenarioStates/messages 구조로 적재
  ├─ interrupt 타입이면 입력 UI(버튼/폼) 렌더링
  └─ 사용자 입력 시 user_action으로 재호출(resume)
```

핵심 원칙:
- **메뉴 조회는 유지**, **실행 엔진만 LangGraph로 교체**한다.
- UI 컴포넌트 대수술 없이 데이터 주입 포맷만 맞춘다.

---

## 🔌 API 설계 (MVP)

## 1) Shortcut 조회 (현행 유지)
- `GET /shortcut`
- 응답에서 `subCategories[].items[].action.type === "scenario"` 항목만 시나리오 실행 대상으로 취급.

## 2) LangGraph 실행 API (신규 사용)
- `POST {LANGGRAPH_BASE_URL}/api/v1/chat/{scenario_id}`
- 요청 body
```json
{
  "conversation_id": "conv-123",
  "user_action": null
}
```
- 버튼/폼 입력 재개 시
```json
{
  "conversation_id": "conv-123",
  "user_action": "선택값 또는 폼객체"
}
```

## 3) SSE 이벤트 매핑 규칙
- `event: message` + `output.type !== interrupt`
  - bot 메시지로 누적
- `event: message` + `output.type === interrupt`
  - `button/form` 입력 대기 상태로 전환
- `event: end`
  - 로딩 종료 및 세션 상태 갱신

---

## 🗂 구현 변경 포인트 (개발자가 수정할 파일 가이드)

## A. clt-chatbot

### A-1) 실행 진입점 정리
- 대상: `app/store/slices/scenarioHandlers.js`
- 목적: `openScenarioPanel` 이후 로컬 `getNextNode` 기반 자동 진행 대신 LangGraph 호출 루틴으로 분기.
- 구현 포인트:
  1. `startLangGraphScenario(scenarioId, conversationId)` 액션 추가
  2. SSE 파서(이벤트 수신기) 추가
  3. 수신 이벤트를 `scenarioStates[sessionId].messages`로 주입

### A-2) 상태 모델 최소 추가
- 대상: `app/store/slices/scenarioStateSlice.js`, `scenarioSessionSlice.js`
- 목적: interrupt/resume 제어를 위한 최소 상태를 추가.
- 권장 필드:
  - `engine: "legacy" | "langgraph"`
  - `langgraphThreadId` (conversation_id 재사용 가능)
  - `pendingInterrupt` (node_id, type, replies/elements)

### A-3) API 통신 레이어 분리
- 대상: `app/store/slices/scenarioAPI.js` 또는 신규 `app/lib/langgraphClient.js`
- 목적: fetch/SSE 구현을 한 파일로 집중.
- 함수 권장:
  - `streamScenario({scenarioId, conversationId, userAction, onMessage, onInterrupt, onEnd, onError})`

### A-4) 기존 route.js 경로 정리
- 대상: `app/api/chat/route.js`
- 목적: 시나리오를 local runScenario로 실행하는 분기를 점진 제거 또는 feature flag로 우회.
- 권장 전략:
  - `SCENARIO_ENGINE=langgraph` 시, route 내부 runScenario 호출을 사용하지 않음.

---

## B. scenario-chatbot-with-langgraph

### B-1) 시나리오 식별자 매핑 명확화
- 대상: `controller/api/v1/chat.py`, `lib/scenario_repo.py`
- 목적: `shortcut.action.value`와 `scenario_id` 연결 규칙 고정.
- 선택지:
  1. action.value를 직접 scenario_id로 사용
  2. title→id 매핑 레이어 추가 (권장: 별도 맵 테이블/파일)

### B-2) 출력 이벤트 표준화
- 대상: `lib/graph_factory.py`, `controller/api/v1/chat.py`
- 목적: clt-chatbot에서 파싱하기 쉬운 최소 공통 포맷 유지.
- 규칙:
  - message 노드: `{type:"message", data:{...}}`
  - interrupt 노드: `{type:"interrupt", data:{type:"button|form", node_id, ...}}`

### B-3) 안정성 보강
- 목적: 운영 시 세션 충돌/중복호출 방지.
- 권장:
  - `conversation_id` 기준 실행 잠금(짧은 TTL)
  - 오류 이벤트 표준화 (`event:error`)

---

## 🪜 단계별 적용 계획 (MVP → 확장)

## Step 1 (MVP, 1~2일)
- shortcut 로딩은 현행 유지
- 시나리오 실행 시 LangGraph 호출만 붙임
- 버튼/폼 interrupt 처리
- 로컬 runScenario는 fallback으로 남김

완료 기준:
- shortcut으로 시작한 시나리오 1개가 시작→입력→종료까지 정상 동작

## Step 2 (안정화, 2~3일)
- title/id 매핑 정책 확정
- 에러/타임아웃/중복클릭 처리
- 로그 추적키 통일(conversation_id)

완료 기준:
- 3개 이상의 시나리오 회귀 테스트 통과

## Step 3 (확장)
- SSE UI 개선(노드별 스트리밍)
- 필요 시 시나리오 실행 기록 저장 API 연동
- legacy 엔진 제거

---

## 🧪 테스트 시나리오

## 기능 테스트
1. shortcut 메뉴 로드 성공 (`/shortcut`)
2. scenario action 클릭 시 LangGraph 호출 발생
3. 첫 message 이벤트 UI 출력
4. interrupt(button) 표시 및 클릭 후 resume
5. interrupt(form) 제출 후 resume
6. end 이벤트 수신 후 상태 completed

## 예외 테스트
1. 잘못된 scenario_id(404)
2. LangGraph 서버 다운(네트워크 실패)
3. user_action 형식 오류(422)
4. 중복 클릭(동일 세션 동시 요청)

---

## ⚠ 주의사항
- 본 단계에서는 **UI 컴포넌트 구조를 크게 바꾸지 않는다**.
- 핵심은 "엔진 교체"이며, 렌더링 데이터 구조는 기존을 최대한 유지한다.
- `conversation_id`는 재진입/새로고침 시 동일하게 복원 가능해야 한다.
- feature flag 없이 바로 전환하지 말고, 최소 1주일 병행 운영 권장.

---

## ✅ 개발 착수 체크리스트
- [ ] `LANGGRAPH_BASE_URL` 환경변수 정의
- [ ] `streamScenario` 클라이언트 유틸 구현
- [ ] `scenarioHandlers.openScenarioPanel`에서 LangGraph 실행 분기 추가
- [ ] interrupt 상태 저장 및 입력 submit 핸들러 연결
- [ ] 에러 fallback(legacy 엔진 또는 사용자 안내) 적용
- [ ] QA 테스트 케이스 문서화

