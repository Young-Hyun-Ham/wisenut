# 시나리오 패널 디버깅 정리

## 배경
- 앞단에서 `action[type=scenario].value=jwjun_test`로 시나리오를 띄우면 우측 캔버스에 노드가 표시되지 않아 정상 실행 여부 확인이 어려웠습니다.
- 백엔드 로그에서는 `scenario_start`/`scenario` 응답은 오지만 프론트 상태에 반영되지 않거나 `None` 반환으로 인해 `currentNodeId`가 누락되었다는 에러가 있었습니다.

## 조치 내역
1. **백엔드**
   - `/scenario-sessions/{sessionId}/events`에 요청/응답/예외를 기록하는 `@log_request_response` 데코레이터 추가.
   - `run_scenario` 호출 결과가 `dict`가 아닌 경우 500 에러로 처리하고 `scenarioState` 접근 전에 `scenario_state_payload`를 가진 점검을 추가.
   - `run_scenario` 로그를 남기는 헬퍼(`@log_scenario_run`) 유지하면서 호출 흐름을 분리해 추후 재사용 가능하도록 정리.
2. **프론트**
   - `scenarioSlice`에 `_updateScenarioState` 헬퍼를 추가하고 시나리오 시작/응답 시 선언적으로 상태를 갱신하여 `scenarioStates`에 메시지와 상태가 누락되지 않도록 함.
   - 자동 이어받기(`continueScenarioIfNeeded`)와 `handleScenarioResponse`가 백엔드 상태/슬롯을 일관되게 전달하도록 변수를 조정.

## 결과 확인
- `scenarioSlice`의 실시간 `scenarioStates`가 메시지/슬롯/상태를 유지하게 되어 우측 시나리오 캔버스가 비어 있지 않고 바로 렌더링됨.
- `docker logs chatbot-backend`에서 debug 레벨로 log를 확인하면 요청/응답 payload가 출력되어 문제 재발 시 원인 추적이 쉬워짐.

## 추후 권장
- 우측 캔버스에서 출력되는 메시지/노드가 없을 경우 `scenarioStates[sessionId]`의 `messages` 값을 체크하고, `result`가 `dict`가 아닐 때의 입력(노드/slots)도 추가 로깅 필요.
