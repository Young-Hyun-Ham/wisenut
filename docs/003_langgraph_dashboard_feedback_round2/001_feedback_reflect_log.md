# 003_langgraph_dashboard_feedback_round2 작업 이력 001

## 기준 문서
- `docs/003_langgraph_dashboard_feedback_round2.md`

## 반영 일시
- 2026-03-05

## 반영 범위
1. P0: Completed 오판정 수정
2. P1: node_type 실행 이력/필터 추가
3. P1: 노드별 실행 횟수 집계(전체/선택 run) 추가

## 변경 파일
- `scenario-chatbot-with-langgraph/controller/api/v1/chat.py`
- `scenario-chatbot-with-langgraph/lib/trace_logger.py`
- `clt-chatbot/app/lib/langgraphTraceServer.js`
- `clt-chatbot/app/admin/langgraph-trace/page.js`
- `clt-chatbot/app/admin/langgraph-trace/page.module.css`

## 상세 변경
### 1) completed 오판정 수정 (백엔드)
- `_sse_stream()`에서 interrupt로 중단된 경우 `completed`를 쓰지 않도록 수정
  - interrupt 발생 시:
    - trace: `status=running`
    - event: `stream_pause`
  - 정상 종료(run 종료) 시에만:
    - trace: `status=completed`
    - event: `run_end`
- 결과: 분기/interrupt 중간 상태에서 completed 전이 차단

### 2) 이벤트 데이터 계약 보강
- 이벤트 로그에 `node_type`, `status` 필드 추가
- 로거 시그니처 확장:
  - `append_event(..., node_type, status, ...)`
- 기존 이벤트 기록 지점 모두 `node_type/status` 전달 반영

### 3) 정규화 계층 보강 (프론트 서버 어댑터)
- `normalizeTraceRecord()`에 `event_type`, `node_type` 기본값 추가
- `normalizeEventRecord()`에 `node_type`, `status` 정규화 추가
- `node_type` 미존재 시 유도 규칙 + 최종 `unknown` 명시

### 4) 상태 전이 집계 재구성 (대시보드)
- run별 스냅샷 집계 함수 도입:
  - `deriveRunSnapshots(...)`
  - 상태 전이 규칙: `started -> running -> completed|failed|cancelled`
  - terminal 상태 이후 역전이 금지
  - run 종료 판단 함수: `isRunCompleted(...)`
- trace 테이블은 raw trace row가 아니라 run 스냅샷 기반으로 표시

### 5) node_type 가시화 및 집계 UI
- 필터 바에 `node_type` 필터 추가
- 이벤트 테이블/타임라인/trace 스냅샷에 `node_type` 표시
- 노드별 집계 2종 추가:
  1. 현재 필터 범위 Top N
  2. 선택한 run_id 내부 Top N
- 노드 실행 이력 테이블 추가:
  - `node_type`, `node_name`, `run_id`, `first_ts`, `last_ts`

## 검증
- `python -m unittest tests.test_graph_factory -v` 통과 (5 tests)
- `npm run build` (`clt-chatbot`) 통과

## 수용 기준 대응
1. 분기 노드/interrupt 상태에서는 completed로 전이되지 않음: 반영 완료
2. run 종료 이벤트 기준 completed 전이: 반영 완료
3. node_type 필터/이력 조회: 반영 완료
4. 노드별 실행 횟수(전체/선택 run): 반영 완료
5. 실패/취소 상태 회귀 방지(terminal 상태 전이 규칙): 반영 완료
