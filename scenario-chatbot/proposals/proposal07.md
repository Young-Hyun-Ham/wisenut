# 제안서: delay 노드 처리 방식(클라이언트 알림 + 지연 실행)

## 배경
- 현재 delay 노드는 duration 동안 sleep 해야 하지만, node function 내부에서 sleep 하면 클라이언트는 지연 원인을 알 수 없고 응답이 늦게 도착하는 것처럼 보인다.
- 목표: delay 노드를 먼저 내려 클라이언트에 "지연 발생"을 알려준 뒤, 다음 노드로 넘어가기 전에 지정 시간만큼 대기한다.

## 목표
- delay 노드가 스트림으로 먼저 전달되어 클라이언트가 지연 상태를 인지하도록 한다.
- 지연은 delay 노드 이후, 다음 노드로 넘어가기 직전에 수행한다.
- 기존 그래프 흐름과 SSE 스트리밍 구조를 최소 변경으로 유지한다.

## 제안 처리 흐름
1) delay 노드 도달 시, 즉시 SSE로 delay 이벤트를 전송한다.
2) 서버는 delay duration만큼 대기한다.
3) 대기 후 다음 노드 실행을 재개한다.

## 구현 옵션
### 옵션 A: delay 노드 함수에서 duration만 state로 전달하고, 스트림 레이어에서 sleep
- delay 노드 결과에 `delay_ms`(또는 `delay_seconds`)를 포함한다.
- 스트리밍 루프에서 delay 노드 출력이 관측되면 즉시 이벤트 전송 후 sleep 수행.
- 장점: node function 내부 블로킹 제거, 지연 타이밍 제어가 중앙 집중화.
- 단점: 스트리밍 루프가 delay 의미를 알아야 함(결합 증가).

### 옵션 B: delay 노드 반환 시 "delay 이후 재개" 메타를 반환, 라우터/runner가 처리
- delay 노드가 `{"type":"delay","data":..., "delay": duration, "resume": True}` 같은 메타를 포함.
- 실행 엔진이 delay 후 다음 노드로 넘어가도록 처리.
- 장점: 실행 엔진의 책임으로 명확화.
- 단점: 엔진 쪽 수정 범위가 더 큼.

### 옵션 C: delay 노드를 "interrupt"처럼 처리하고 클라이언트가 재호출
- delay 노드를 interrupt로 내려보내고, 클라이언트가 duration 후 재호출.
- 장점: 서버 리소스 점유 최소화.
- 단점: 클라이언트 구현 복잡도 증가, 타이밍 보장 어려움.

## 권장안
- 옵션 A 권장.
  - 현재 구조에서 변경 범위를 최소화하면서, 지연 알림과 실제 대기 위치를 분리 가능.
  - delay 노드의 payload에 duration을 포함하고, SSE 스트리밍 루프에서 대기 처리.

## 구체 설계(권장안)
- delay 노드 처리:
  - `node_type == "delay"` 시 `{"type": "delay", "data": _data, "slot": slot, "delay_ms": duration}` 반환
  - duration은 `data.duration` 또는 `data.durationMs` 등 기존 시나리오 키를 따른다.
- 스트리밍 처리:
  - delay 이벤트는 즉시 SSE로 전송.
  - 이벤트 전송 직후 `time.sleep(delay_ms / 1000)` 수행.
  - 이후 다음 이벤트를 계속 스트리밍.

## 인터페이스 영향
- SSE payload에 `type: "delay"` 노드가 그대로 전달됨.
- 추가 필드: `delay_ms`(또는 `delay_seconds`)를 포함할 수 있음.
- 클라이언트는 delay 이벤트를 수신해 UI에 “잠시 대기” 표시 가능.

## 테스트 시나리오
1) duration이 있는 delay 노드 단독 실행 시, delay 이벤트 즉시 수신 후 지정 시간 대기.
2) delay 뒤 message 노드가 있는 경우, message가 지연 후 도착하는지 확인.
3) duration이 0이거나 누락된 경우, 지연 없이 다음 노드 진행.

## 리스크 및 고려사항
- 서버 블로킹으로 인해 동시 요청 처리량 감소 가능성.
  - 필요 시 비동기 sleep 또는 작업 큐로 분리하는 확장 여지 고려.
- duration 값 단위(ms/sec) 명확화 필요.

## 다음 액션
1) delay duration의 단위/키 정의 확정.
2) 스트리밍 루프 수정 지점 확정.
3) delay 이벤트 스키마 문서화(SPEC 업데이트).
