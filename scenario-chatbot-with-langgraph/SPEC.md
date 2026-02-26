# 시나리오 챗봇 스펙

## 개요
- 목적: 시나리오 데이터 기반으로 대화 흐름을 진행하는 챗봇 서버 제공
- 프로토콜: HTTP POST 요청, 응답은 Server-Sent Events(SSE)
- 환경: Python, FastAPI, LangGraph

## 데이터 및 시나리오 리포지토리
- 시나리오 파일: JSON
- 주요 필드(예시):
  - nodes: 노드 목록
  - edges: 노드 간 연결
  - startNodeId: 시작 노드 ID
- 시나리오 로딩
  - `ScenarioRepository.get_scenario(scenario_id) -> dict`
  - 파일/DB/원격스토리지 등 소스 추상화
  - 캐시(TTL) 옵션

## 그래프 구성
- `GraphFactory.build_graph(raw_scenario) -> graph`
  - `lib/workflow.py`의 `parse_workflow`로 `WorkflowNode` 생성 재사용
  - 노드 타입별 함수 생성은 `node_factory`로 캡슐화
- `GraphRegistry`
  - `{scenario_id: compiled_graph}` 캐시
  - 시나리오 변경 감지 시 재컴파일

## 슬롯 처리 규칙
- form `interrupt`로 받은 사용자 입력은 `slot`에 병합
- 입력 키 이름과 동일한 슬롯 키로 저장
- 기존 슬롯 값이 있으면 덮어쓰기
  - form 요소의 `defaultValue`에 템플릿(`{{ }}`)이 있으면 `slot`으로 치환해 전달

## setSlot 처리 규칙
- `data.assignments`의 `key/value`로 `slot`을 갱신
- `value`는 템플릿 치환 후 저장
- 동일 키가 있으면 덮어쓰기

## 메시지 템플릿 규칙
- message `content`는 `{{변수}}` 형태의 더블 머스태시 템플릿 지원
- 템플릿 치환 기본 컨텍스트는 `slot`
- 치환 실패 시 기본은 빈 문자열(정책 변경 가능)
- `content`에 `{{`/`}}`가 있을 때만 템플릿 렌더링을 수행
  - link/branch도 `data.content`에 템플릿이 있으면 동일 규칙으로 렌더링

## API 응답 매핑 규칙
- `application/json` 응답일 때 `responseMapping`으로 `slot`에 저장
- `path`는 `a.b.c` 및 `a[0].b` 형태 지원
- 매핑 실패 시 기본은 스킵(정책 변경 가능)

## 브랜치 조건 분기 규칙
- `evaluationType == "CONDITION"`인 경우 `data.conditions`로 분기
- `slot`, `operator`, `value`를 비교해 첫 번째로 참인 조건의 경로 사용
- 모두 실패 시 기본 경로(else) 또는 첫 번째 경로 사용
- 연산자 범위
  - 기본: `==`, `!=`, `in`, `exists`
  - 확장: `<`, `<=`, `>`, `>=`, `contains`, `regex`

## API
### POST /api/v1/chat/{scenario_id}
- 설명: 사용자 입력을 받아 다음 메시지를 스트리밍으로 전달
- Request Headers
  - Content-Type: application/json
- Request Body
  - conversation_id: string
  - user_input: string
  - user_action: object (optional, 버튼 value 또는 폼 입력 데이터)
- Path Variables
  - scenario_id: string
- Response
  - Content-Type: text/event-stream
  - 이벤트 형식: `data: <payload>\n\n`
  - payload (event: message)
    - conversation_id: string
    - output: object
      - type: string (예: message, api, branch, form, delay, link, setSlot)
      - data: object (scenario 파일의 node.data 원문)
      - type: "interrupt" 인 경우 data에 입력 스키마 포함
        - node_id: string (interrupt 발생 노드 ID)
        - type: string ("button" | "form")
        - replies: array (button일 때)
        - data: object (form일 때)
          - title: string
          - elements: array
            - name: string
            - type: string ("input" | "date" | "grid")
            - label: string
            - placeholder: string
            - defaultValue: string
            - validation: object

### POST /api/v1/auth/login
- 설명: 사용자 인증 및 토큰 발급
- Request Headers
  - Content-Type: application/json
- Request Body
  - user_id: string
  - password: string
- Response
  - access_token: string
  - token_type: string (예: "bearer")

### POST /api/v1/auth/logout
- 설명: 토큰 무효화
- Request Headers
  - Authorization: Bearer <access_token>
- Response
  - result: string (예: "ok")

### GET /api/v1/auth/me
- 설명: 현재 사용자 정보 조회
- Request Headers
  - Authorization: Bearer <access_token>
- Response
  - user_id: string
  - display_name: string
  - roles: string[]

## SSE 이벤트 정의
- event: message
  - data: 시나리오 노드 단건(JSON) 또는 interrupt(JSON)
- event: end
  - data: 종료 신호 (예: "done")
- event: error
  - data: 오류 메시지

## 처리 흐름
1. `/api/v1/chat/{scenario_id}` 호출
2. `ScenarioRepository.get_scenario(scenario_id)`로 시나리오 로드
3. `GraphRegistry`에서 그래프 조회
   - 없으면 `GraphFactory.build_graph`로 생성 후 캐시
4. `graph.stream(..., stream_mode="values")`으로 이벤트 생성
5. `form` 또는 `branch+BUTTON` 노드에서 `interrupt` 발생 시 SSE로 전달 후 스트림 종료
6. 클라이언트는 `user_action`으로 재호출해 `Command(resume=...)`로 재개
7. 재개 호출에서는 마지막 interrupt 노드 이전 이벤트를 스킵하고 이후만 전송

## 캐시 전략
- 기본: `scenario_id` 기준 LRU 캐시
- 시나리오 파일 mtime 비교로 변경 감지
- 갱신 시 해당 scenario_id의 graph 재컴파일

## 오류 처리
- 시나리오 없음: 404
- 시나리오 파싱 실패: 422
- 그래프 실행 실패: SSE `event: error`
- 그 외
  - 4xx: 잘못된 요청(필수 필드 누락 등)
  - 5xx: 서버 내부 오류

## 로깅
- 요청/응답 메타데이터 기록
- 시나리오 로딩 오류 및 파싱 오류 기록

## 다음 액션
1) `scenario_id -> 파일 경로` 매핑 규칙 결정
2) 캐시 무효화 정책(TTL, mtime, 수동 리로드) 확정
3) 노드 타입별 응답 스키마 확정 (message/api/branch 등)
