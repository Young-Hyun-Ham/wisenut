# Finance 영향도 분석 시나리오 TO-BE 적용 검토

## 1. 요청 정리
- PoC에서 사용하던 `tmp/Finance_영향도_분석.json`과 해당 흐름을 그대로 담은 요청/응답 캡처(`tmp/Finance_영향도_분석_REQ_RES.txt`)를 새 TO-BE 스택에서도 정상 실행하고 싶음.
- TO-BE는 백엔드(FastAPI)가 시나리오 세션/이벤트를 주관하고, 프론트가 `runScenario`/`nodeHandlers`를 통해 PoC와 유사한 흐름을 유지하도록 설계되어 있음(참조: `01.workspaces/apps/chatbot-front/app/lib/chatbotEngine.js:406`).

## 2. TO-BE 현황
1. 프론트는 `getScenario` → `runScenario` → `nodeHandlers`를 따라 노드를 순회하므로, `nodes`/`edges`를 포함한 JSON이 그대로 내려오면 PoC처럼 `nextNode`를 재생할 수 있음(`01.workspaces/apps/chatbot-front/app/lib/chatbotEngine.js:140`).
2. 백엔드 `mock` 라우터는 현재 세션을 단순 `phase` 값만 순환시키고, 실제 시나리오 구조를 평가하지 않음(정상 동작을 위한 로직 부족). 시작 이벤트도 항상 `continue` 폼만 내려줌(`01.workspaces/apps/chatbot-backend/app/routers/mock.py:318`).
3. 시나리오 데이터를 저장하는 `scenario` 테이블에는 `nodes`/`edges` JSONB 컬럼이 존재하므로(`01.workspaces/apps/chatbot-backend/app/db/models.py:22`), 실제 JSON을 그대로 적재하면 TO-BE 엔진에서 사용할 수 있는 여건은 마련되어 있음.
4. `00.documents/analysis/scenario-implementation-plan.md:1` 등에서 정리한 TO-BE 흐름은 PoC와 동일한 `scenario_start`/`scenario`/`scenario_end` 포맷을 목표로 하며, 현재 STUB 코드를 진짜 엔진으로 교체해야 함.

## 3. 기존 파일과의 적합성
- `tmp/Finance_영향도_분석.json`은 `nodes`/`edges` + `startNodeId`/`job`/`description` 등 PoC가 기대하는 데이터 구조를 그대로 갖추고 있어(참조: `tmp/Finance_영향도_분석.json:1`), 동일한 형태로 DB의 `nodes`/`edges` 컬럼에 넣기만 하면 프론트 로직으로 전달 가능.
- 제공된 요청/응답 순서(`tmp/Finance_영향도_분석_REQ_RES.txt:1`)는 대화 흐름(시나리오 시작 → 버튼 선택 → 자동 메시지 → ... 종료)을 그대로 보여주므로, 백엔드가 실제 `runScenario` 루프를 구현했는지 검증하는 회귀 테스트로 활용 가능.

## 4. 남은 작업
1. **시나리오 JSON 적재**: `scenario` 테이블에 새로운 레코드를 추가하고 `shortcuts`/카테고리 테이블에서 `Finance 영향도 분석` 제목을 대응하는 ID로 연결.
2. **시나리오 엔진 구현**: `mock` 라우터(`01.workspaces/apps/chatbot-backend/app/routers/mock.py:318`)를 실제 시나리오 흐름 처리로 대체(`getNextNode`/`runScenario`를 백엔드로 이관, `nodeHandlers` 기능 재구현). 요구 사항은 `00.documents/plan/scenario-processing-plan.md:1`에 정리돼 있음.
3. **상태/슬롯 관리**: 서버가 `scenario_sessions`에서 `current_node_id`, `slots`, `context`를 유지하면서 `build scenario_state`를 업데이트해야 하며, 이는 PoC에서 프론트가 기대하는 `scenarioState` 구조에 맞춰야 함(참조: `01.workspaces/apps/chatbot-backend/app/routers/mock.py:376`).
4. **테스트**: `tmp/Finance_영향도_분석_REQ_RES.txt`을 바탕으로 `/scenario-sessions/{id}/events`가 PoC와 같은 `type`/`nextNode`/`scenarioState`를 순차적으로 반환하는지 확인.

## 5. 결론
- 주어진 JSON/요청 캡처는 format-wise로 TO-BE 엔진이 요구하는 구조와 1:1 대응 가능하므로, `scenario` 테이블에 적절히 저장하고 실제 run 로직을 구현하면 그대로 재사용 가능.
- 현재 구현은 placeholder 상태이므로, 위 4단계 작업(특히 runScenario 이관과 슬롯/세션 유지)이 선행돼야 함.
- 추가로 리그레션 검증을 위해 `tmp/Finance_영향도_분석_REQ_RES.txt`를 시나리오 회귀 테스트 데이터로 등록하면 효과적임.
