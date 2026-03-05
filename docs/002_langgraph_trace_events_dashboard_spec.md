# 002. LangGraph Trace/Events 실시간 대시보드 구현 지시서

## 1) 배경/목표
- LangGraph 실행 내역을 운영 중 실시간으로 확인할 수 있는 관측 대시보드를 구축한다.
- 입력 소스는 JSONL 로그 파일 2종이다.
  - `run_trace.jsonl`: 실행 단위(trace) 중심 로그
  - `run_events.jsonl`: 실행 중 발생 이벤트(events) 로그
- 실행 로그 파일 위치는 `/data` 폴더에 존재 한다.
- 목표는 "현재 어떤 run이 진행 중이고, 어디서 지연/실패가 발생했는지"를 즉시 파악할 수 있는 UI를 제공하는 것이다.

## 2) 구현 범위
### In Scope
- 파일 기반(JSONL) 실시간 수집
- 대시보드 UI(요약 지표 + 목록 + 상세)
- 필터/검색/정렬
- 최근 N분 추세 시각화(간단 차트)
- 최소 1초 단위 갱신(폴링 또는 스트리밍)

### Out of Scope
- 외부 APM 연동 (Datadog, Grafana Cloud 등)
- 인증/권한 체계 고도화
- 장기 보관용 DB 적재 파이프라인

## 3) 대상 프로젝트/기술 가정
- 프론트엔드/서버 구현 위치: `c:/workspace/wisenut/clt-chatbot`
- Next.js App Router 기준으로 구현
- 서버 측에서 JSONL 파일 접근 후 API 또는 SSE로 프론트에 전달

## 4) 데이터 계약 (초안)
아래 필드는 실제 로그 필드와 매핑해 구현한다. 필드명이 다르면 어댑터에서 정규화한다.

### Trace 레코드(`run_trace.jsonl`) 권장 스키마
- `ts` (string, ISO8601): 기록 시각
- `run_id` (string): LangGraph 실행 ID
- `thread_id` (string|null)
- `status` (string): `started | running | completed | failed | cancelled`
- `duration_ms` (number|null)
- `node` (string|null): 현재/마지막 노드
- `input_tokens` (number|null)
- `output_tokens` (number|null)
- `model` (string|null)
- `error` (string|null)

### Event 레코드(`run_events.jsonl`) 권장 스키마
- `ts` (string, ISO8601)
- `run_id` (string)
- `event_type` (string): 예) `node_start`, `node_end`, `tool_call`, `llm_start`, `llm_end`, `error`
- `node` (string|null)
- `payload` (object|null)
- `latency_ms` (number|null)
- `level` (string): `info | warn | error`

## 5) 기능 요구사항
### A. 실시간 수집
- JSONL append를 추적해 신규 라인만 반영한다.
- 파싱 실패 라인은 skip하고, 파싱 에러 카운트를 별도 집계한다.
- 대용량 파일에서도 UI가 멈추지 않도록 초기 로딩 개수 제한(예: 최근 2,000라인) 적용.

### B. 요약 카드(KPI)
- 최근 5분 run 수
- 진행 중(run status=running) 개수
- 실패 개수 및 실패율
- 평균/95p duration
- 이벤트 처리량(events/min)

### C. 목록/상세
- Trace 테이블: `ts, run_id, status, duration_ms, node, model, error`
- Event 테이블: `ts, run_id, event_type, node, latency_ms, level`
- run_id 클릭 시 우측 패널(또는 모달)에서 해당 run 타임라인 표시
  - 시작/종료 시각
  - 노드별 처리 순서
  - 에러 이벤트 원문(payload 포함)

### D. 필터/검색
- 시간 범위 (최근 5분/15분/1시간/사용자 지정)
- status/event_type/level 필터
- run_id 부분 검색
- `errors only` 토글

### E. 자동 갱신 제어
- Auto-refresh On/Off
- 새 데이터 도착 시 화면 상단에 "new N" 배지 표시
- 사용자가 스크롤 중일 때 강제 점프 금지

## 6) 비기능 요구사항
- 초기 진입 3초 이내 첫 렌더(로컬 환경 기준)
- 1초 주기 갱신 시 브라우저 CPU 급증 방지 (불필요 리렌더 최소화)
- 잘못된 JSON 라인, 필드 누락, 파일 미존재에 대한 방어 코드 필수
- 로그 파일 경로는 환경변수로 분리
  - 예: `LANGGRAPH_TRACE_PATH`, `LANGGRAPH_EVENTS_PATH`

## 7) 구현 가이드
1. 서버 어댑터 계층 구현
- JSONL line parser + schema normalizer 작성
- tail 방식으로 신규 라인만 읽는 리더 구현

2. 전달 방식 선택
- 우선순위: SSE(Server-Sent Events)
- 대안: 1초 polling API
- 선택 사유를 PR 본문에 명시

3. 프론트 대시보드 구성
- 상단 KPI 카드
- 중단 Trace/Event 탭 테이블
- 우측 상세 패널(run timeline)
- 필터 바(시간/status/type/run_id)

4. 성능 최적화
- 리스트 가상화 또는 페이지네이션 적용
- 집계 계산 메모이제이션

## 8) 수용 기준(Definition of Done)
- `run_trace.jsonl`, `run_events.jsonl`에 라인 추가 시 1초 내 화면 반영
- 상태/이벤트/시간 필터 동작 검증 완료
- run_id 상세 타임라인에서 error payload 확인 가능
- 파일 누락/손상 상황에서 앱이 죽지 않고 경고 UI 노출
- README 또는 운영 문서에 실행 방법과 환경변수 설명 추가

## 9) 테스트 체크리스트
- 정상 케이스: started → running → completed 흐름
- 실패 케이스: error 이벤트 포함 run
- 대량 케이스: 이벤트 10,000라인 이상
- 데이터 품질 케이스: malformed JSON line 포함
- 경계 케이스: duration/null 필드 누락

## 10) 작업 산출물
- 대시보드 화면 구현 코드
- JSONL 리더/파서/정규화 코드
- 환경변수/설정 문서
- 동작 캡처(스크린샷 또는 gif) 2종
  - 실시간 업데이트 장면
  - 실패 run 상세 조회 장면
