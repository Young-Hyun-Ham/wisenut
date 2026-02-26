# 제안서: 사용자 입력 필요 노드 처리 방식

## 대상 노드
- `type == "form"`
- `type == "branch"` 이면서 `data["evaluationType"] == "BUTTON"`

## 목표
- 위 노드에 도달하면 **사용자 입력 대기** 상태로 전환
- 다음 요청에서 입력을 받아 워크플로우를 진행

## 제안 흐름 (LangGraph interrupt 기반)
1) `form` 또는 `branch+BUTTON` 노드에서 `interrupt(payload)` 호출  
2) 서버는 `__interrupt__` 이벤트를 감지해 SSE로 전송하고 **스트림을 종료**  
3) 클라이언트는 `payload`로 입력 UI 표시  
4) 사용자가 입력하면 같은 `conversation_id`로 `/api/v1/chat/{scenario_id}` 재호출  
5) `Command(resume=...)`로 입력값을 그래프에 주입해 재개

## 입력 데이터 구조 제안
- Request Body 확장
  - `conversation_id: string`
  - `user_input: string`
  - `user_action: string` (버튼 선택값 또는 form 제출 데이터)
- Output 확장
  - `output: { type, data, requires_input: boolean, input_schema?: object }`
  - `input_schema`: 폼 필드, 버튼 선택 리스트 등

## 구현 포인트
- `GraphFactory`의 `node_factory`에서 `interrupt`로 입력 대기 유도
- `branch` + `BUTTON`일 때 `data["replies"]`를 `interrupt` payload로 전달
- `form` 노드의 `data`를 폼 필드 정의로 간주하여 `interrupt` payload 구성
- `chat` 핸들러는 `__interrupt__` 이벤트를 SSE로 전달 후 종료

## 상태 관리
- `conversation_id`를 LangGraph `thread_id`로 사용 (이미 적용)
- 입력값은 `Command(resume=...)`로 주입
- 필요 시 외부 저장소(캐시/DB)로 state 보존

## 테스트 케이스
- `form` 노드 도달 시 `requires_input` 플래그 확인
- `branch` + `BUTTON` 노드 도달 시 `input_schema` 내용 검증
- 입력 후 다음 노드로 정상 진행 확인
