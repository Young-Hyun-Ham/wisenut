# 제안서: Command(resume=...) 기반 재개 처리

## 목적
- interrupt 발생 시 사용자 입력을 받아 중단 지점 이후부터 정확히 재개
- 재호출 시 이전 노드를 재전송하지 않도록 흐름 분리

## 핵심 원리
- `interrupt(payload)`로 실행을 중단
- 다음 요청에서 `Command(resume=...)`를 전달해 동일 `thread_id`로 재개
- `stream_mode="updates"`로 재개 이후 이벤트만 전송

## 처리 흐름
1) `/api/v1/chat/{scenario_id}` 호출  
2) 그래프 스트리밍 중 `__interrupt__` 감지  
3) SSE로 `output.type = "interrupt"` 전송 후 스트림 종료  
4) 클라이언트가 `user_action`(버튼 value 또는 form 입력)을 포함해 재호출  
5) 서버에서 `Command(resume=user_action)`로 그래프 재개  
6) 재개 이후 이벤트만 SSE로 전송

## 요청/응답 예시
### 1) 최초 호출 (interrupt 발생)
Request:
```
POST /api/v1/chat/scenario99
{
  "conversation_id": "conv-99",
  "user_input": "hi"
}
```
Response (SSE):
```
event: message
data: {"conversation_id":"conv-99","output":{"type":"interrupt","data":{"type":"button","replies":[...]}}}
```

### 2) 재개 호출
Request:
```
POST /api/v1/chat/scenario99
{
  "conversation_id": "conv-99",
  "user_input": "hi",
  "user_action": "cond_1766973458673-399k6bv"
}
```
Response (SSE):
```
event: message
data: {"conversation_id":"conv-99","output":{"type":"message","data":{...}}}
```

## 구현 포인트
- `chat` 핸들러에서 `user_action`이 있으면 `Command(resume=...)` 사용
- `graph.stream`는 `stream_mode="updates"`로 변경 권장
- `conversation_id`를 `thread_id`로 유지해 동일 체크포인트에서 이어짐

## 기대 효과
- 중단 지점 이후부터 자연스럽게 재개
- 중복 메시지 전송 감소
- 프론트엔드에서 상태 관리 단순화
