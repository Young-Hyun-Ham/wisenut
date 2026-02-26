# 시나리오 nextNode 구성 근거 정리

## 결론 요약
- PoC 응답의 `nextNode`는 **시나리오 JSON의 `nodes[]` 아이템 그대로** 반환된 것으로 보는 게 맞다.
- 로직에서 새로 만드는 키는 거의 없고, **문자열 보간/폼 기본값 슬롯 반영/iframe URL 세션 파라미터 추가** 정도만 수행한다.
- 따라서 서버 구현에서는 **저장된 시나리오 노드 객체 전체를 그대로 반환**하는 것이 PoC와 가장 가깝다.

## 설계서/문서 기준
- `00.documents/plan/scenario-processing-plan.md`에 PoC 응답 구조가 간략히만 있음
  - `type: "scenario_start" | "scenario" | "scenario_end"`
  - `nextNode`, `scenarioState`, `slots`만 언급
  - **nextNode 내부 스키마 상세는 없음**
- `00.documents/api/chatbot-backend-openapi.md`에서도 `next_node`는 `additionalProperties: true`로만 정의
  - 즉, **상세 필드는 스펙에 고정되어 있지 않음**
- 상세 스키마는 참고 프로젝트에 존재
  - `reference/clt-chatbot/SCENARIO_SCHEMA.md`

## PoC 캡처와 실제 시나리오 데이터 비교(핵심 포인트)
- `reference/scenario_start_req_res.md`의 `nextNode`는 `tmp/DEV_1000_7.json`의 `nodes[]` 항목과 **필드 구성이 일치**
- `nextNode`에 포함된 필드 예시
  - `id`, `type`, `data`, `position`, `positionAbsolute`, `width`, `height`, `selected`, `dragging`, `zIndex`
- 위 필드들은 **시나리오 저장 데이터(React Flow node)** 에 이미 존재
  - 로직에서 새로 만드는 값이 아님

## 로직에서 실제로 하는 일(참고 구현 기준)
참고 구현: `reference/clt-chatbot/app/lib/chatbotEngine.js`

1) **다음 노드 선택**
- `getNextNode()`가 `edges` + `sourceHandle` + branch 조건을 기준으로 다음 노드를 찾음
- 시작 노드는 `startNodeId` 우선, 없으면 **incoming edge 없는 노드**

2) **자동 진행(비대화형 노드) 처리 후 대화형 노드에서 정지**
- delay/api/llm 등은 자동 진행 후 다음 노드로 이동
- 최종적으로 대화형 노드에서 `nextNode` 반환

3) **응답 전 가공(최소한)**
- **문자열 보간**: `content`, `title`, `reply.display`, `form element` label/placeholder 등
- **폼 기본값 슬롯 반영**: `defaultValue`가 있는 element는 slots에 채움
- **iframe URL 세션 파라미터 추가**: `scenario_session_id` 없으면 추가
- 위 외에는 노드 구조에 **새 키를 추가하지 않음**

## 구현 가이드(백엔드 관점)
- `nextNode`는 **DB에 저장된 노드 객체 그대로 반환**
- 필요한 가공은 아래만 최소 적용
  1) 텍스트/URL 보간
  2) (필요 시) iframe의 `scenario_session_id` 자동 부착
  3) form 기본값을 slots에 반영
- UI 표시용 필드(`positionAbsolute`, `selected`, `dragging`, `zIndex` 등)도 **PoC와 동일성을 위해 포함하는 것을 권장**

## 관련 파일
- PoC 캡처: `reference/scenario_start_req_res.md`
- 실제 시나리오 데이터: `tmp/DEV_1000_7.json`
- PoC 응답 구조 언급: `00.documents/plan/scenario-processing-plan.md`
- API 스펙 요약: `00.documents/api/chatbot-backend-openapi.md`
- 참고 엔진 로직: `reference/clt-chatbot/app/lib/chatbotEngine.js`
- 스키마 문서: `reference/clt-chatbot/SCENARIO_SCHEMA.md`
