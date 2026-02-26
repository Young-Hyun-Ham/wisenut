# 시나리오 처리 구현방안 계획서

## 목표
- 시나리오 시작/진행/종료를 `/api/chat`과 분리된 전용 엔드포인트로 처리한다.
- PoC 동작을 유지하면서 제품화에 맞는 데이터 정합성과 확장성을 확보한다.

## 전제/제약
- 백엔드: FastAPI + PostgreSQL
- 테이블명은 snake_case(소문자)
- Firebase, Gemini 제거
- 메인 채팅(LLM)은 `chatbot-front -> chatbot-backend -> flowise` 흐름 유지

## 범위
- 시나리오 카테고리/시나리오 조회
- 시나리오 세션 생성/진행/종료
- 시나리오 노드 결과(버튼/입력) 처리

---

## 1) API 구조(시나리오 전용)

### 시나리오 조회
- `GET /scenarios`
  - 시나리오 카테고리/목록 제공
- `GET /scenarios/{scenarioId}`
  - 시나리오 상세(노드 포함)

### 시나리오 세션
- `POST /scenario-sessions`
  - 시나리오 시작(세션 생성)
  - 요청: `{ scenario_id, conversation_id, language, slots }`
  - 응답: `{ id, next_node, scenario_state, slots }`
- `GET /scenario-sessions/{sessionId}`
  - 현재 진행 상태 조회
- `POST /scenario-sessions/{sessionId}/events`
  - 버튼 선택/사용자 입력 반영
  - 요청: `{ input_type, input_value, source_handle, scenario_state, slots }`
  - 응답: `{ next_node, scenario_state, slots }`
- `POST /scenario-sessions/{sessionId}/end`
  - 시나리오 종료

### (옵션) 시나리오와 채팅 통합 포인트
- `/api/chat`은 LLM 처리 전용으로 유지
- 시나리오 결과 메시지는 별도 메시지 저장 API로 기록

---

## 2) 처리 흐름(요약)

1) 프론트가 `/scenarios`로 목록을 받아 시나리오 버튼 표시
2) 버튼 클릭 시 `/scenario-sessions`로 세션 생성
3) 응답의 `next_node`를 화면에 표시(버튼/입력폼)
4) 사용자 입력/선택 시 `/scenario-sessions/{id}/events` 호출
5) 서버가 자동 진행 가능한 노드라 판단하면 연속 응답을 제공
6) `next_node`가 없으면 `/scenario-sessions/{id}/end` 호출
7) 모든 진행 로그는 메시지/시나리오 세션 테이블에 저장

---

## 3) 데이터 모델(초안)

- `scenario` (시나리오 메타)
- `scenario_category` (카테고리)
- `scenario_session` (진행 세션)
  - `scenario_id`, `conversation_id`, `current_node_id`, `status`, `slots(json)`
- `message` (사용자/시스템/시나리오 메시지)
  - `scenario_session_id`는 선택적 FK

---

## 4) PoC 호환 전략

- PoC 응답 구조를 우선 지원하고, 화면 동작 확인 후 정식 스펙으로 개선
- PoC 응답: `type: "scenario_start"`, `nextNode`, `scenarioState`, `slots`
- 정식 스펙에서는 snake_case 필드로 정리 (`next_node`, `scenario_state`, `scenario_id` 등)

## 4-1) PoC 자동 진행 패턴(관찰)

- 최초 버튼 입력 이후에도 클라이언트가 동일 세션으로 연속 요청을 전송
- 요청에 `scenarioState`와 `scenarioSessionId`를 포함해 다음 노드를 이어받음
- 서버는 `type: "scenario"`를 여러 번 반환하고, 최종적으로 `type: "scenario_end"`로 종료
- 의미상 "자동 진행 가능 노드"를 클라이언트가 폴링하듯 요청해 받는 패턴

## 4-2) PoC → 정식 스펙 필드 매핑

| PoC 필드 (camelCase) | 정식 필드 (snake_case) | 비고 |
| --- | --- | --- |
| `nextNode` | `next_node` | 응답 공통 |
| `scenarioState` | `scenario_state` | 응답 공통 |
| `scenarioState.scenarioId` | `scenario_state.scenario_id` | 시나리오 식별 |
| `scenarioState.currentNodeId` | `scenario_state.current_node_id` | 진행 노드 |
| `scenarioState.awaitingInput` | `scenario_state.awaiting_input` | 입력 대기 |
| `scenarioSessionId` | `scenario_session_id` | PoC 요청 기준(정식은 path `id` 사용) |

---

## 5) 개발 단계

1) 스키마 확정(시나리오/세션/메시지)
2) 시나리오 조회 API 구현
3) 시나리오 세션 시작/진행/종료 API 구현
4) 프론트: 시나리오 버튼 → 세션 API 호출 전환
5) PoC 호환 여부 확인 후 스펙 정리

---

## 6) 리스크/확인사항

- 시나리오 입력 타입(버튼/폼/자유 텍스트) 규격 확정 필요
- 세션 재진입/중복 요청 처리 정책 필요
- LLM 응답과 시나리오 응답의 UI 병합 규칙 정리 필요

---

## 7) 폴링 우선 + 스트리밍 전환 로드맵

### 7-1) 1차(폴링)
- 클라이언트가 `/scenario-sessions/{id}/events`를 주기적으로 호출
- 서버는 다음 노드가 준비되면 `type: "scenario"`로 응답
- `type: "scenario_end"` 수신 시 폴링 종료

### 7-2) 2차(스트리밍)
- SSE 또는 서버 스트리밍으로 전환
- 클라이언트 인터페이스는 동일(이벤트 수신부만 교체)
- 전환 조건: 응답 지연/트래픽/사용자 수 증가 시점에 적용
