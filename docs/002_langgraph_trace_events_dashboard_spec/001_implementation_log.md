# 002_langgraph_trace_events_dashboard_spec 작업 이력 001

## 기준 문서
- `docs/002_langgraph_trace_events_dashboard_spec.md`
- `docs/00_data_schema_information.md`

## 반영 일시
- 2026-03-05

## 구현 요약
1. JSONL 로그 어댑터(파서/정규화/증분 읽기) 구현
2. SSE 스트림 API 구현 (`/api/langgraph/trace/stream`)
3. 실시간 대시보드 UI 구현 (`/admin/langgraph-trace`)
4. 운영 문서 추가 (`clt-chatbot/LANGGRAPH_TRACE_DASHBOARD.md`)

## 상세 변경
### 1) 서버 어댑터 계층
- 파일: `clt-chatbot/app/lib/langgraphTraceServer.js`
- 내용:
  - Trace/Event JSONL 정규화 함수 구현
  - 최근 2,000라인 tail 로딩 구현
  - 파일 오프셋 기반 증분(delta) 읽기 구현
  - malformed JSON line skip + parse error 카운트 집계
  - 파일 누락/읽기 실패 warning 메시지 반환
  - 환경변수 지원:
    - `LANGGRAPH_TRACE_PATH`
    - `LANGGRAPH_EVENTS_PATH`

### 2) 전달 방식 (SSE)
- 파일: `clt-chatbot/app/api/langgraph/trace/stream/route.js`
- 내용:
  - SSE 우선 적용
  - 초기 snapshot 이벤트 전송
  - 1초 주기 delta 이벤트 전송
  - keepalive/comment 이벤트 전송
  - warning 이벤트 전송
  - 10분 타임아웃 및 스트림 정리 처리

### 3) 대시보드 UI
- 파일:
  - `clt-chatbot/app/admin/langgraph-trace/page.js`
  - `clt-chatbot/app/admin/langgraph-trace/page.module.css`
- 내용:
  - KPI 카드:
    - 최근 5분 run 수
    - 진행 중 수
    - 실패/실패율
    - 평균/95p duration
    - events/min
    - parse error 수
  - 최근 10분 events 추세 바 차트(CSS 기반)
  - 필터:
    - 시간 범위(5분/15분/1시간/사용자 지정)
    - status/event_type/level
    - run_id 검색
    - errors only
  - 목록:
    - Trace/Event 탭 테이블
    - 페이지네이션(50행)
  - 상세:
    - run_id 선택 시 타임라인 표시
    - error payload 원문(JSON) 확인 가능
  - 자동 갱신 제어:
    - Auto-refresh On/Off
    - Off 상태 누적 데이터 `new N` 배지 표시
    - On 전환 시 누적 배치 반영
  - 파일 경고 배너 표시

### 4) 운영 문서
- 파일: `clt-chatbot/LANGGRAPH_TRACE_DASHBOARD.md`
- 내용:
  - 대시보드 경로/API 경로
  - 환경변수
  - 실행 방법
  - 동작/방어 정책 요약

## 수용 기준 대응 체크
- [x] JSONL 라인 추가 시 1초 내 반영(SSE 1초 delta)
- [x] 상태/이벤트/시간 필터 동작 구현
- [x] run_id 상세 타임라인 + payload 조회 구현
- [x] 파일 누락/손상 방어 및 경고 UI 구현
- [x] 운영 문서 작성

## 검증 결과
- 실행: `npm run build` (`clt-chatbot`)
- 결과:
  - 빌드 성공
  - 라우트 확인:
    - `/admin/langgraph-trace`
    - `/api/langgraph/trace/stream`

## 남은 항목
1. 실제 운영 로그 파일을 사용한 수동 검증(실시간 append 시나리오)
2. 문서의 캡처 산출물(스크린샷/GIF 2종) 추가
