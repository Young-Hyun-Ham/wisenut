# 업무일지

## 운영 원칙
- 매 요청/결정/산출물 변경 시 이 문서에 기록
- 문서 경로는 `00.documents` 기준으로 표기
- 변경된 파일은 가능한 한 목록화

---

## 2026-01-21

### 요청/결정
- DB 연동 계획서 작성 및 스키마 생성 원칙 추가(ORM + Alembic 자동 생성, SQL 리뷰)
- ERD 테이블명 snake_case(소문자) 규칙 확정
- Postgres에 초기 테이블 생성 확인 요청
- dev-login 사용자 자동 생성/조회 DB 연동 진행

### 수행 내용
- DB 연동 계획서 작성 및 중복 정리
  - 00.documents/plan/backend-db-integration-plan.md
- ERD 테이블명 snake_case로 변경
  - 00.documents/analysis/erd.md
- Firestore 실시간 리스너 대체안 구체화(SSE + LISTEN/NOTIFY)
  - 00.documents/api/firestore-replacement-api.md
- 알림 이벤트 소스 추상화 구조 추가(교체 가능)
  - 00.documents/api/firestore-replacement-api.md
- 알림 실시간 전송 스펙 문서화(SSE + 소스 추상화)
  - 00.documents/api/notification-realtime-spec.md
- 알림 API/SSE 기본 구현 시작
  - 01.workspaces/apps/chatbot-backend/app/routers/notifications.py
  - 01.workspaces/apps/chatbot-backend/app/notifications/bus.py
  - 01.workspaces/apps/chatbot-backend/app/notifications/sources.py
  - 01.workspaces/apps/chatbot-backend/app/main.py
- 기존 알림 이벤트 포맷 문서화
  - 00.documents/api/notification-event-format-legacy.md
- SSE 전환 매핑표 추가(기존 → 신규 필드)
  - 00.documents/api/notification-event-format-legacy.md
- Firestore 제거 체크리스트 작성(파일/기능 단위)
  - 00.documents/analysis/firestore-removal-checklist.md
- 알림 기능 Firestore → REST/SSE 전환 착수(프론트/백엔드)
  - 01.workspaces/apps/chatbot-backend/app/routers/notifications.py
  - 01.workspaces/apps/chatbot-backend/app/core/security.py
  - 01.workspaces/apps/chatbot-backend/app/notifications/sources.py
  - 01.workspaces/apps/chatbot-backend/app/db/models.py
  - 01.workspaces/infra/alembic/versions/1f33a8c5d2b1_add_notification_links.py
  - 01.workspaces/apps/chatbot-front/app/store/slices/notificationSlice.js
  - 01.workspaces/apps/chatbot-front/app/components/NotificationModal.jsx
  - 01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/index.js
- Firestore 의존 제거(대화/시나리오/메시지/설정/즐겨찾기/검색/DevBoard)
  - 01.workspaces/apps/chatbot-front/app/store/slices/chatSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/scenarioSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/conversationSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/favoritesSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/searchSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/uiSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/devBoardSlice.js
  - 01.workspaces/apps/chatbot-front/app/lib/chatbotEngine.js
  - 01.workspaces/apps/chatbot-front/app/store/index.js
- Firebase Auth 제거 및 로그인 UI 정리
  - 01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/index.js
  - 01.workspaces/apps/chatbot-front/app/components/Login.jsx
  - 01.workspaces/apps/chatbot-front/app/components/Login.module.css
  - 01.workspaces/apps/chatbot-front/app/lib/firebase.js
  - 01.workspaces/apps/chatbot-front/package.json
- Gemini 제거 작업리스트 작성
  - 00.documents/analysis/gemini-removal-tasklist.md
- Gemini 제거 적용(프론트/문서)
  - 01.workspaces/apps/chatbot-front/app/lib/gemini.js
  - 01.workspaces/apps/chatbot-front/app/lib/llm.js
  - 01.workspaces/apps/chatbot-front/app/lib/nodeHandlers.js
  - 01.workspaces/apps/chatbot-front/app/lib/streamProcessors.js
  - 01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/uiSlice.js
  - 01.workspaces/apps/chatbot-front/app/admin/general/page.js
  - 01.workspaces/apps/chatbot-front/package.json
  - 00.documents/analysis/external-dependency-analysis.md
  - 00.documents/analysis/next-steps.md
  - 00.documents/analysis/clt-chatbot-features.md
  - 00.documents/analysis/gemini-removal-tasklist.md
  - 01.workspaces/apps/chatbot-front/README.md
- Flowise 서비스 기반 /api/chat 연결
  - 01.workspaces/apps/chatbot-backend/app/services/flowise_service.py
  - 01.workspaces/apps/chatbot-backend/app/schemas.py
  - 01.workspaces/apps/chatbot-backend/app/routers/chat.py
  - 01.workspaces/apps/chatbot-backend/app/routers/mock.py
  - 01.workspaces/apps/chatbot-backend/app/main.py
  - 01.workspaces/apps/chatbot-backend/requirements.txt
- /api/chat에서 PredictionData 생성 후 전달 방식으로 변경
  - 01.workspaces/apps/chatbot-backend/app/services/flowise_service.py
  - 01.workspaces/apps/chatbot-backend/app/routers/chat.py
- Alembic/SQLAlchemy 기반 DB 연동 스켈레톤 추가
  - 01.workspaces/apps/chatbot-backend/app/db/base.py
  - 01.workspaces/apps/chatbot-backend/app/db/session.py
  - 01.workspaces/apps/chatbot-backend/app/db/models.py
  - 01.workspaces/apps/chatbot-backend/app/db/__init__.py
  - 01.workspaces/apps/chatbot-backend/app/db/deps.py
  - 01.workspaces/infra/alembic.ini
  - 01.workspaces/infra/alembic/env.py
  - 01.workspaces/infra/alembic/script.py.mako
  - 01.workspaces/infra/alembic/versions/593b60579981_init_schema.py
  - 01.workspaces/apps/chatbot-backend/requirements.txt
- dev-login 사용자 조회/자동 생성 DB 연동
  - 01.workspaces/apps/chatbot-backend/app/routers/auth.py
- DB 연결 URL 드라이버 변경
  - 01.workspaces/infra/docker-compose.yml

### 확인 포인트
- Postgres에서 테이블 생성 확인 완료(`\dt` 기준)
- 생성 테이블: api_template, conversation, dev_memo, favorite, form_template, message,
  node_visibility_setting, notification, scenario, scenario_category, scenario_session,
  shortcut, user, user_setting, alembic_version

### 다음 할 일(제안)
- chat/message 흐름에 conversation/message 저장 연동
- dev-login 사용자 식별 키 분리 여부 결정

## 2026-01-20

### 요청/결정
- Firebase 제거 최우선 방향 확정
- Gemini 제거, `/api/chat` 단일 경로로 메인채팅 진행
- 마이그레이션은 진행하지 않음
- swagger(OpenAPI) 정의는 `chatbot-backend` / `chatbot-admin-backend`로 분리

### 수행 내용(수정 파일 포함)
- 외부 의존성 제거 분석서 확인 및 정리
  - 00.documents/analysis/external-dependency-analysis.md (기존 참고)
- 다음 스텝 제안서 작성
  - 00.documents/analysis/next-steps.md
- OpenAPI 초안 작성 및 보강 (backend/admin 분리)
  - 00.documents/api/chatbot-backend-openapi.md
  - 00.documents/api/chatbot-admin-backend-openapi.md
  - 00.documents/api/firestore-replacement-api.md
- 백엔드 스켈레톤 생성
  - 01.workspaces/apps/chatbot-backend/
  - 01.workspaces/apps/chatbot-admin-backend/
- 프로젝트 기본 문서/설정 정리
  - README.md
  - .gitignore
  - AGENTS.md
- backlog 001 재정리/백업
  - __backlog__/001.md
  - __backlog__/backup/001.md
- 인프라/Mock 구성
  - 01.workspaces/infra/docker-compose.yml
  - 01.workspaces/apps/chatbot-backend/scripts/mock_api_test.py
  - 01.workspaces/apps/chatbot-admin-backend/scripts/mock_api_test.py
- admin OpenAPI 오류 수정
  - 00.documents/api/chatbot-admin-backend-openapi.md
  - 01.workspaces/apps/chatbot-admin-backend/openapi.yaml
- `chatbot-front` 준비 및 mock 모드
  - 01.workspaces/apps/chatbot-front/
  - 01.workspaces/apps/chatbot-front/app/lib/firebase.js
  - 01.workspaces/apps/chatbot-front/app/store/index.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js
  - 01.workspaces/apps/chatbot-front/README.md
- 인증 구현(backend/admin + 프론트 연동)
  - 00.documents/analysis/auth-implementation-plan.md
  - 01.workspaces/apps/chatbot-backend/app/core/security.py
  - 01.workspaces/apps/chatbot-backend/app/routers/auth.py
  - 01.workspaces/apps/chatbot-backend/app/routers/users.py
  - 01.workspaces/apps/chatbot-backend/app/main.py
  - 01.workspaces/apps/chatbot-backend/requirements.txt
  - 01.workspaces/apps/chatbot-backend/.env.example
  - 01.workspaces/apps/chatbot-admin-backend/app/core/security.py
  - 01.workspaces/apps/chatbot-admin-backend/app/routers/auth.py
  - 01.workspaces/apps/chatbot-admin-backend/app/main.py
  - 01.workspaces/apps/chatbot-admin-backend/requirements.txt
  - 01.workspaces/apps/chatbot-admin-backend/.env.example
  - 01.workspaces/apps/chatbot-front/app/lib/authToken.js
  - 01.workspaces/apps/chatbot-front/app/lib/apiClient.js
  - 01.workspaces/apps/chatbot-front/app/lib/api.js
  - 01.workspaces/apps/chatbot-front/app/store/index.js
  - 01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/chatSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/scenarioSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/conversationSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js
- 프론트 API 호출 apiFetch 통일
  - 01.workspaces/apps/chatbot-front/app/lib/nodeHandlers.js
  - 01.workspaces/apps/chatbot-front/app/lib/llm.js
  - 01.workspaces/apps/chatbot-front/app/components/ScenarioChat.jsx
- 프론트 mock 환경변수 보강
  - 01.workspaces/infra/docker-compose.yml
- 프론트 환경변수 프리픽스 제거(NEXT_PUBLIC_ -> 일반 변수)
  - 01.workspaces/apps/chatbot-front/app/lib/firebase.js
  - 01.workspaces/apps/chatbot-front/app/lib/parentMessaging.js
  - 01.workspaces/apps/chatbot-front/app/lib/nodeHandlers.js
  - 01.workspaces/apps/chatbot-front/app/hooks/useQueries.js
  - 01.workspaces/apps/chatbot-front/app/lib/api.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js
  - 01.workspaces/infra/docker-compose.yml
  - 01.workspaces/apps/chatbot-front/README.md
  - 00.documents/analysis/auth-implementation-plan.md
  - 01.workspaces/apps/chatbot-front/next.config.mjs
- mock 서버 기준 API_BASE_URL 변경
  - 01.workspaces/infra/docker-compose.yml
- mock 모드에서 Authorization 헤더 기본 주입
  - 01.workspaces/apps/chatbot-front/app/lib/apiClient.js
- mock 서버 경로 기준 /api/chat 사용으로 수정
  - 01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js
- 프론트 Firebase export 누락 보완
  - 01.workspaces/apps/chatbot-front/app/lib/firebase.js
- docker-compose에서 Prism mock 제거 및 backend 직접 연동 전환
  - 01.workspaces/infra/docker-compose.yml
- APP_MODE mock 유지 및 API_BASE_URL localhost 설정
  - 01.workspaces/infra/docker-compose.yml
- chatbot-backend OpenAPI 전체 엔드포인트 스텁 구현
  - 01.workspaces/apps/chatbot-backend/app/routers/mock.py
  - 01.workspaces/apps/chatbot-backend/app/main.py

### 추가 진행(오류 대응/개선)
- 프론트 CORS 및 dev-login 오류 대응
  - 01.workspaces/apps/chatbot-backend/.env.example
  - 01.workspaces/infra/docker-compose.yml
- 하드코딩된 FastAPI URL 제거 및 API_BASE_URL 통일
  - 01.workspaces/apps/chatbot-front/app/store/slices/chatSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/slices/scenarioSlice.js
  - 01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js
  - 01.workspaces/apps/chatbot-front/app/lib/api.js
  - 01.workspaces/apps/chatbot-front/app/hooks/useQueries.js
- mock 모드에서 Firestore 미사용 오류 회피(일반설정 로컬 저장소 저장)
  - 01.workspaces/apps/chatbot-front/app/store/slices/uiSlice.js

### 확인 포인트(누락 점검 결과)
- 사용자/대화/메시지/시나리오/세션/즐겨찾기/알림/설정/검색/DevBoard: API로 대체 가능하도록 반영됨
- 관리자(react-flow) 기능: 시나리오/템플릿/노드 설정/게시판/파일 업로드까지 API로 대체 가능하도록 반영됨

### 다음 할 일(제안)
- Mock 서버(Prism 등) 구성
- OpenAPI 기반 라우터 스텁 자동 생성
- 프론트/어드민 연동용 base URL/환경변수 확정

---

## 템플릿 (새 항목 추가용)

### 2026-01-22

#### 요청/결정
- /conversations 실구현 전환
- 프론트 메시지 저장은 백엔드 저장으로 일원화
- /api/chat 서비스/리포지토리 계층 분리

#### 수행 내용
- conversations 라우터 추가(DB 기반 CRUD/메시지/시나리오 세션 조회)
- mock 라우터에서 대화/메시지/시나리오 세션 제거
- /api/chat 저장 로직을 서비스/리포지토리 구조로 분리
- 프론트 saveMessage 경로 제거로 중복 저장 차단

#### 산출물/변경 파일
- 01.workspaces/apps/chatbot-backend/app/routers/conversations.py
- 01.workspaces/apps/chatbot-backend/app/routers/mock.py
- 01.workspaces/apps/chatbot-backend/app/routers/chat.py
- 01.workspaces/apps/chatbot-backend/app/services/chat_service.py
- 01.workspaces/apps/chatbot-backend/app/services/llm_service.py
- 01.workspaces/apps/chatbot-backend/app/services/flowise_client.py
- 01.workspaces/apps/chatbot-backend/app/repositories/chat_repository.py
- 01.workspaces/apps/chatbot-backend/app/main.py
- 01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js
- 01.workspaces/apps/chatbot-front/app/store/slices/chatSlice.js

#### 확인 포인트
- /conversations에서 UUID 기반 대화 생성 후 /api/chat 정상 동작
- 메시지 중복 저장 발생 여부 제거 확인

#### 다음 할 일(제안)
- conversation.updated_at 갱신 로직 추가
- 스트리밍 저장 정책(빈 응답 처리) 확정

### YYYY-MM-DD

#### 요청/결정
- 

#### 수행 내용
- 

#### 산출물/변경 파일
- 

#### 확인 포인트
- 

#### 다음 할 일(제안)
- 

### 2026-01-23

#### 요청/결정
- 백엔드에 선택 엔드포인트 req/res 로깅 미들웨어 추가

#### 수행 내용
- req/res 로깅 미들웨어 추가 및 선택 엔드포인트만 로깅하도록 설정
- 로깅 미들웨어 오류(TypeError) 수정

#### 산출물/변경 파일
- 01.workspaces/apps/chatbot-backend/app/middleware/reqres_logger.py
- 01.workspaces/apps/chatbot-backend/app/main.py

#### 확인 포인트
- LOG_ENDPOINTS 설정 시 선택 엔드포인트만 로그 출력되는지

#### 다음 할 일(제안)
- 

### 2026-01-23 (시나리오 이벤트)

#### 요청/결정
- 시나리오 이벤트 엔드포인트/흐름 점검 및 호출 경로 정리

#### 수행 내용
- mock 시나리오 이벤트 엔드포인트 추가
- 시나리오 이벤트 호출을 `/scenario-sessions/{id}/events`로 정리

#### 산출물/변경 파일
- 01.workspaces/apps/chatbot-backend/app/routers/mock.py
- 01.workspaces/apps/chatbot-front/app/store/slices/scenarioSlice.js

#### 확인 포인트
- /scenario-sessions/{id}/events 호출 200 및 응답 처리 정상인지

#### 다음 할 일(제안)
- 시나리오 이벤트 응답 포맷을 실제 백엔드 스펙과 정합성 맞추기

### 2026-01-23 (세션 만료 처리)

#### 요청/결정
- 토큰 만료 시 로그인 화면 이동 및 토스트 안내 추가
- 로그인 화면에서 설정 호출로 인한 401 루프 방지

#### 수행 내용
- 401 응답 시 세션 만료 토스트(다국어) 노출 후 로그인 화면 이동
- 토큰 없으면 /settings/global 호출을 생략하도록 방어 로직 추가

#### 산출물/변경 파일
- 01.workspaces/apps/chatbot-front/app/lib/apiClient.js
- 01.workspaces/apps/chatbot-front/app/lib/locales.js
- 01.workspaces/apps/chatbot-front/app/store/slices/uiSlice.js

#### 확인 포인트
- 로그인 화면에서 /settings/global 호출이 발생하지 않는지
- 토큰 만료 시 토스트가 1회만 노출되고 로그인 화면으로 이동하는지

#### 다음 할 일(제안)
- 

### 2026-01-26

#### 요청/결정
- 프론트엔드 개발 시 발생하는 정보 비대칭(에러 상황 파악 어려움) 해결을 위해 트래픽 관찰 도구 도입
- 소스 코드 수정 없이 `mitmproxy`를 이용한 프록시 방식 채택

#### 수행 내용
- `docker-compose.override.yml` 추가하여 개발 환경에서만 프록시가 동작하도록 설정
- `chatbot-front`가 백엔드 대신 `mitmproxy`를 바라보도록 환경변수 오버라이딩
- 브라우저 접근을 위해 `API_BASE_URL`을 `mitmproxy` 호스트에서 `localhost`로 변경

#### 산출물/변경 파일
- 01.workspaces/infra/docker-compose.override.yml

#### 확인 포인트
- `docker compose up` 시 `mitmproxy` 컨테이너가 함께 실행되는지
- `http://localhost:8081`에서 트래픽이 관찰되는지
