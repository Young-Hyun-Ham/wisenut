# 01_langgraph_scenario_integration_plan 작업 이력 001

## 기준 문서
- `docs/01_langgraph_scenario_integration_plan.md`
- `docs/00_data_schema_information.md`

## 반영 일시
- 2026-03-05

## 작업 요약
1. `clt-chatbot`의 LangGraph SSE 수신 로직에서 `event:error`를 처리하도록 보강
2. `scenario-chatbot-with-langgraph`의 conversation 동시 실행 잠금을 TTL 기반에서 실행 중 고정 잠금으로 변경
3. `clt-chatbot`의 `app/api/chat/route.js`에서 `SCENARIO_ENGINE=langgraph`일 때 legacy `runScenario` 분기 차단
4. LangGraph 테스트 코드(`test_chat.py`)를 현재 `ChatRequest` 스키마에 맞게 정리

## 상세 변경 내역
### 1) 프론트 SSE 에러 이벤트 처리
- 파일: `clt-chatbot/app/store/slices/scenarioAPI.js`
- 변경:
  - `event:error` 수신 시 payload의 `error` 메시지를 파싱
  - `onError(new Error(message), message)` 콜백 호출
  - 스트림 마지막 버퍼 처리 구간에서도 동일 규칙 적용

### 2) LangGraph 서버 동시 실행 제어
- 파일: `scenario-chatbot-with-langgraph/controller/api/v1/chat.py`
- 변경:
  - `_conversation_locks`를 `dict + TTL`에서 `set` 기반 실행 잠금으로 변경
  - 동일 `conversation_id`의 중복 호출 시 `409` 유지
  - 스트림 종료/예외 시 `discard()`로 잠금 정리
  - `scenario_data` 경로의 그래프 캐시 mtime은 `time.time()`으로 유지

### 3) Legacy 경로 차단 (Feature Flag)
- 파일: `clt-chatbot/app/api/chat/route.js`
- 변경:
  - `SCENARIO_ENGINE` import 추가
  - 시나리오 진행 요청에서 `SCENARIO_ENGINE === 'langgraph'`면 legacy `runScenario` 실행 대신 400 에러 반환

### 4) 테스트 코드 정합성 보정
- 파일: `scenario-chatbot-with-langgraph/test_chat.py`
- 변경:
  - `ChatRequest`에서 제거된 `user_input` 필드 사용 제거
  - 인터럽트/재개 테스트를 `conversation_id`, `user_action` 중심으로 정리

## 검증 결과
- 실행: `python -m unittest tests.test_graph_factory -v`
- 결과: 5건 통과
- 비고: `pytest` 미설치(`No module named pytest`)로 `pytest` 기반 테스트는 미실행

## 리스크 및 후속 권장
1. `test_chat.py`는 `pytest` 실행 환경에서 최종 확인 필요
2. 실제 통합 환경에서 LangGraph `event:error` 발생 시 UI 토스트/상태 전이 동작 재확인 필요
