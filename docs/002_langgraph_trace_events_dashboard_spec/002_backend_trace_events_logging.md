# 002_langgraph_trace_events_dashboard_spec 작업 이력 002

## 목적
- 사용자 피드백 반영: `scenario-chatbot-with-langgraph` 백엔드에서 trace/events 적재 누락 보완

## 변경 파일
- `scenario-chatbot-with-langgraph/lib/trace_logger.py`
- `scenario-chatbot-with-langgraph/controller/api/v1/chat.py`

## 구현 내용
1. JSONL 파일 로거 추가 (`trace_logger.py`)
- `append_trace(...)`: `run_trace.jsonl` 포맷으로 기록
- `append_event(...)`: `run_events.jsonl` 포맷으로 기록
- 환경변수 지원:
  - `LANGGRAPH_TRACE_PATH`
  - `LANGGRAPH_EVENTS_PATH`
- 기본 경로:
  - `scenario-chatbot-with-langgraph/data/run_trace.jsonl`
  - `scenario-chatbot-with-langgraph/data/run_events.jsonl`
- 로깅 실패가 서비스 오류로 전파되지 않도록 예외 삼킴 처리

2. 시나리오 로드 시 trace 기록 (`chat.py`)
- 요청 시작 시 `status=started`
- 시나리오 소스 로드 완료 시 `status=running`
  - source: `scenario_repo` 또는 `request.scenario_data`
- 잘못된 입력/미존재/파싱 실패 시 `status=failed` + `error`

3. UI 응답(SSE) 시 events 기록 (`chat.py`)
- 스트림 시작: `event_type=stream_start`
- 일반 메시지: `event_type=<output.type>`
- 인터럽트: `event_type=interrupt`
- 스트림 종료: `event_type=stream_end`
- 예외 발생: `event_type=error`, `level=error`

4. 실행 종료 시 trace 완료/실패 기록 (`chat.py`)
- 정상 종료: `status=completed`, `duration_ms`, `last node`
- 예외 종료: `status=failed`, `duration_ms`, `error`, `last node`

## 검증
- 실행: `python -m unittest tests.test_graph_factory -v`
- 결과: 5건 통과
