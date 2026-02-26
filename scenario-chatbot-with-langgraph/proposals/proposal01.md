# 제안서: langgraph를 시나리오 동적 리포지토리로 활용하기

## 목표
- `scenario01.json` 같은 시나리오 파일을 **동적으로 로드/교체**하며 LangGraph 그래프를 실행
- FastAPI 요청 단위로 시나리오를 선택해 **그래프를 생성/캐시**하고 SSE로 스트리밍

## 핵심 아이디어
1) 시나리오 로더/레포지토리 계층을 분리  
2) scenario_id 기반으로 그래프를 **빌드 또는 캐시**  
3) 실행 시점엔 graph.invoke/stream만 호출하도록 설계

## 제안 아키텍처
- `ScenarioRepository`
  - `get_scenario(scenario_id) -> dict`
  - 파일/DB/원격스토리지 등 소스 추상화
  - 캐시(TTL) 옵션
- `GraphFactory`
  - `build_graph(raw_scenario) -> graph`
  - `lib/workflow.py`의 `parse_workflow`로 `WorkflowNode` 생성 재사용
  - 노드 타입별 함수 생성은 `node_factory`로 캡슐화
- `GraphRegistry`
  - `{scenario_id: compiled_graph}` 캐시
  - 시나리오 변경 감지 시 재컴파일

## 적용 흐름(요청 처리)
1. `/api/v1/chat/{scenario_id}` 호출
2. `ScenarioRepository.get_scenario(scenario_id)`로 시나리오 로드
3. `GraphRegistry`에서 그래프 조회
   - 없으면 `GraphFactory.build_graph`로 생성 후 캐시
4. `graph.stream(...)`으로 이벤트 생성
5. SSE로 `event: message` 전송 (node.data 중심)

## 구현 포인트(샘플 코드와 연결)
- `sample4.py`의 핵심을 모듈화
  - `node_factory`, `create_router` 재사용
  - `parse_workflow`는 `lib/workflow.py`에서 그대로 호출
- `scenarioFile` 하드코딩 제거
  - `scenario_id` -> 파일 경로 매핑
- `InMemorySaver`는 테스트 용도, 실제 환경에서는 외부 저장소 고려

## 파일 구조 제안
- `lib/scenario_repo.py`
- `lib/graph_factory.py`
- `lib/graph_registry.py`
- `lib/workflow.py` (이미 존재, 파싱 로직 재사용)
- `controller/chat.py` (graph 실행 및 SSE 스트림)

## 캐시 전략 제안
- 기본: `scenario_id` 기준 LRU 캐시
- 시나리오 파일 mtime 비교로 변경 감지
- 갱신 시 해당 scenario_id의 graph 재컴파일

## 오류 처리
- 시나리오 없음: 404
- 시나리오 파싱 실패: 422
- 그래프 실행 실패: SSE `event: error`

## 다음 액션
1) `scenario_id -> 파일 경로` 매핑 규칙 결정  
2) 캐시 무효화 정책(TTL, mtime, 수동 리로드) 확정  
3) 노드 타입별 응답 스키마 확정 (message/api/branch 등)
