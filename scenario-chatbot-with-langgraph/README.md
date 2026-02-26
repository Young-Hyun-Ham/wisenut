# scenario-chatbot-mk1

## 개요
이 프로젝트는 **FastAPI + LangGraph** 기반의 시나리오 챗봇 서버입니다. JSON 시나리오 데이터를 로딩해 그래프를 생성하고, **SSE(Server-Sent Events)**로 실행 결과를 스트리밍합니다. 버튼/폼 인터럽트가 발생하면 클라이언트가 액션을 보내 재개(resume)하는 구조로 동작합니다.

## FastAPI 구현 범위

### 서버 엔트리
- `main.py`
  - FastAPI 앱 생성
  - CORS 전체 허용
  - 라우터 등록: `/api/v1/auth`, `/api/v1/chat`

### 인증 API (더미)
- `POST /api/v1/auth/login`
  - 입력: `{ "user_id": "...", "password": "..." }`
  - 출력: `{ "access_token": "dummy-token", "token_type": "bearer" }`
- `POST /api/v1/auth/logout`
  - 출력: `{ "result": "ok" }`
- `GET /api/v1/auth/me`
  - 출력: `{ "user_id": "dummy", "display_name": "dummy", "roles": ["user"] }`

### 챗봇 실행 API
- `POST /api/v1/chat/{scenario_id}`
  - 입력:
    - `conversation_id`: 문자열
    - `user_action`: 버튼 선택값 또는 폼 입력 객체 (선택)
  - 출력: **SSE 스트림**
    - `event: message`로 이벤트 전송
    - 인터럽트 발생 시: `{ output: { type: "interrupt", data: ... } }`
    - 종료 시: `event: end`

## 시나리오 로딩 및 그래프 생성
- `ScenarioRepository` (`lib/scenario_repo.py`)
  - `data/{scenario_id}.json` 로드
  - mtime 기반 변경 감지
- `GraphRegistry` (`lib/graph_registry.py`)
  - 시나리오별 그래프 캐시
  - mtime 변경 시 그래프 재생성
- `GraphFactory` (`lib/graph_factory.py`)
  - React Flow 데이터를 LangGraph 노드로 변환
  - 버튼/폼 인터럽트를 지원

## 스트리밍 처리 흐름
- `controller/api/v1/chat.py`의 `_sse_stream()`이 LangGraph 이벤트를 순회
- `__interrupt__` 이벤트를 만나면 즉시 인터럽트 payload 전송 후 중단
- 이후 클라이언트가 `user_action`을 보내면 **마지막 인터럽트 노드**부터 재개

## Mermaid 시각화

### 요청 → 응답 흐름
```mermaid
flowchart TD
  A[Client POST /api/v1/chat/{scenario_id}] --> B[ScenarioRepository 로드]
  B --> C[GraphRegistry 캐시 확인]
  C --> D[GraphFactory 그래프 생성/재사용]
  D --> E[LangGraph stream 실행]
  E --> F{Interrupt 발생?}
  F -- 예 --> G[SSE: interrupt payload 전송]
  F -- 아니오 --> H[SSE: 일반 이벤트 전송]
  H --> I[끝까지 스트리밍]
```

### 인터럽트 재개 흐름
```mermaid
flowchart TD
  A[Client user_action 전송] --> B[resume_from_node_id 조회]
  B --> C[LangGraph Command(resume=...)]
  C --> D[해당 노드부터 실행 재개]
  D --> E[SSE 이벤트 스트리밍]
```

## 관련 파일
- `main.py`
- `controller/api/v1/chat.py`
- `controller/api/v1/auth.py`
- `lib/scenario_repo.py`
- `lib/graph_registry.py`
- `lib/graph_factory.py`

## 실행
```sh
# root 폴더에서
# 1. .venv 라는 이름으로 가상 환경 생성
python -m venv .venv

# 2. 가상 환경 활성화 (PowerShell 보안 정책 적용)
.\.venv\Scripts\Activate.ps1

# 3. 의존성 설치
pip install -r ./requirements.txt

# 4. 실행
uvicorn main:app --reload
```

클라이언트 예시는 `client/index.html`에 있습니다.
