# 003_langgraph_dashboard_feedback_round2 작업 이력 002

## 이슈
- 동일 `conversation_id`에서 시나리오를 여러 번 호출해도 `run_id`가 동일하게 기록됨
- 결과적으로 대시보드에서 서로 다른 실행(run)이 1개 run으로 합쳐져 보임

## 요구 반영
- `run_id = conv_id + msg_id` 형태로 생성
- 호출마다 `msg_id`가 달라지므로 run_id도 매번 새로 생성

## 변경 파일
- `scenario-chatbot-with-langgraph/controller/api/v1/chat.py`
- `clt-chatbot/app/store/slices/scenarioAPI.js`
- `clt-chatbot/app/store/slices/scenarioHandlers.js`

## 상세 변경
1. 백엔드 요청 스키마 확장
- `ChatRequest`에 `msg_id: str | None` 필드 추가
- `run_id` 생성식 변경:
  - 기존: `run_id = body.conversation_id`
  - 변경: `run_id = f"{body.conversation_id}:{msg_id}"`
  - `msg_id` 미전달 시 서버에서 `uuid4`로 생성

2. 프론트 LangGraph 호출 시 `msg_id` 전달
- `streamScenario(...)` 시그니처에 `msgId` 추가
- 요청 body에 `msg_id` 추가
- `startLangGraphScenario(...)` 호출 시 매 요청마다 `msgId` 생성
  - 우선 `crypto.randomUUID()`
  - fallback: `msg-${Date.now()}-${random}`

## 검증
- `python -m unittest tests.test_graph_factory -v` 통과
- `npm run build` (`clt-chatbot`) 통과

## 기대 효과
- 동일 conversation 내 연속 3회 호출 시 `run_id` 3개 생성
- 대시보드에서 실행 단위가 정상 분리되어 표시됨
