# 외부 의존성 제거 분석서 (clt-chatbot, react-flow)

## 작성 목적
제품화 단계에서 외부 의존성을 제거하고 자체 백엔드(FastAPI + PostgreSQL)로 전환하기 위한 영향을 정리한다.

## 분석 범위
- `reference/clt-chatbot` (chatbot-front 대상)
- `reference/react-flow` (chatbot-admin 대상)

## 외부 의존성 목록 및 사용 위치

### 1) Firebase (Auth, Firestore, Storage)

#### clt-chatbot
- Firebase 초기화/인증/DB 접근: `reference/clt-chatbot/app/lib/firebase.js`
- Firestore 사용(시나리오 관련):
  - `reference/clt-chatbot/app/store/slices/scenarioSlice.js`
  - `reference/clt-chatbot/app/lib/chatbotEngine.js`
- Firestore 사용(시나리오 외):
  - `reference/clt-chatbot/app/store/index.js`
  - `reference/clt-chatbot/app/store/slices/authSlice.js`
  - `reference/clt-chatbot/app/store/slices/chatSlice.js`
  - `reference/clt-chatbot/app/store/slices/favoritesSlice.js`
  - `reference/clt-chatbot/app/store/slices/notificationSlice.js`
  - `reference/clt-chatbot/app/store/slices/devBoardSlice.js`
  - `reference/clt-chatbot/app/store/slices/uiSlice.js`
  - `reference/clt-chatbot/app/store/slices/searchSlice.js`
  - `reference/clt-chatbot/app/store/slices/conversationSlice.js`

#### clt-chatbot 대화 저장 방식(Firestore)
- 대화 문서 경로: `chats/{user.uid}/conversations/{conversationId}`
- 메시지 서브컬렉션: `chats/{user.uid}/conversations/{conversationId}/messages`
- 시나리오 세션 서브컬렉션: `chats/{user.uid}/conversations/{conversationId}/scenario_sessions`
- 저장/갱신 로직:
  - 메시지 저장: `addDoc(messages, { ...message, createdAt: serverTimestamp() })`
  - 대화 갱신: `updateDoc(conversation, { updatedAt: serverTimestamp() })`
- 로딩 방식:
  - `messages`를 `orderBy("createdAt", "desc")` + `limit(15)`로 `onSnapshot` 구독
- 관련 파일:
  - `reference/clt-chatbot/app/store/slices/chatSlice.js`
  - `reference/clt-chatbot/app/store/slices/scenarioSlice.js`
- Firestore/Storage 관련 이미지 접근 허용: `reference/clt-chatbot/next.config.mjs`
- 패키지 의존: `reference/clt-chatbot/package.json` (`firebase`)

#### react-flow
- Firebase 초기화/인증/스토리지/DB: `reference/react-flow/src/firebase.js`
- 시나리오/템플릿/설정 CRUD: `reference/react-flow/src/firebaseApi.js`
- 백엔드 전환 스위치에 Firebase 경로 포함: `reference/react-flow/src/backendService.js`
- 패키지 의존: `reference/react-flow/package.json` (`firebase`)

#### 제거 영향
- 사용자 인증(구글 OAuth 기반), 시나리오/노드/템플릿/설정 저장소 전부 영향.
- Storage 사용 시 파일/이미지 저장 경로 변경 필요.

---

### 2) LLM SDK 직접 호출(제거 대상)

#### clt-chatbot
- LLM SDK 직접 호출: `reference/clt-chatbot/app/lib/llm.js`

#### react-flow
- 시뮬레이터 LLM 노드 직접 호출: `reference/react-flow/src/hooks/useChatFlow.js`

#### 제거 영향
- LLM 호출 엔드포인트를 내부 백엔드로 프록시/대체 필요.
- 스트리밍 응답(ReadableStream/SSE) 유지 필요.

---

### 3) Flowise (외부 LLM API)

#### clt-chatbot
- Flowise API 직접 호출: `reference/clt-chatbot/app/lib/llm.js` (사용자 입력 URL 기반)

#### 제거 영향
- 외부 Flowise 사용을 허용하지 않을 경우, 내부 LLM 서비스 URL로 제한하거나 백엔드에서 중계 필요.

---

### 4) 외부 HTTP API/프록시

#### clt-chatbot
- FastAPI 기반 외부 API 호출:
  - `reference/clt-chatbot/app/lib/api.js` (대화/메시지 조회)
  - `reference/clt-chatbot/app/hooks/useQueries.js` (대화 CRUD/핀/제목 변경)
  - `reference/clt-chatbot/app/store/actions/chatResponseHandler.js` (LLM/시나리오 처리 요청)
  - `reference/clt-chatbot/app/store/slices/chatSlice.js` (메시지 로드)
  - `reference/clt-chatbot/app/store/slices/conversationSlice.js` (대화 목록/생성/삭제/핀/제목 변경)
  - `reference/clt-chatbot/app/store/slices/scenarioSlice.js` (시나리오 목록)

#### react-flow
- FastAPI Mock 서버(외부): `reference/react-flow/src/fastApi.js` (`https://musclecat-api.vercel.app/api/v1/chat`)
- Vercel/로컬 프록시:
  - `reference/react-flow/api/proxy.js` (`http://202.20.84.65:8082/api/v1`)
  - `reference/react-flow/vite.config.js` (dev proxy 설정)
- 랜덤 단어 API: `reference/react-flow/vite.config.js` (`https://random-word-api.herokuapp.com`)

#### 제거 영향
- 실제 제품 백엔드로 모든 경로 치환 필요.
- 프록시 설정/베이스 URL 하드코딩 제거 필요.

---

### 5) 기타 외부 서비스/라이브러리 관련

#### clt-chatbot
- PWA 관련: `@ducanh2912/next-pwa` → Workbox 사용 (Google Analytics 연계 가능성 존재)
- 데이터 패칭/캐싱: `@tanstack/react-query`, `@tanstack/react-query-devtools`
- 배포 환경 가정: `reference/clt-chatbot/README.md` (Vercel 언급)

#### 제거 영향
- 실제 배포/분석 도구가 별도면 설정 교체 필요.

---

## 제거/대체 방향 제안 (PM 의견 반영)

### 백엔드 전환 기준
- 신규 백엔드: FastAPI + PostgreSQL (PM 의견)
- Firebase 전면 제거, 내부 인증/권한 + DB/스토리지 제공

### 필수 전환 대상
1) 인증: Firebase Auth → 자체 사용자/세션(JWT 등)로 교체
2) 시나리오/노드/템플릿/설정 데이터: Firestore → PostgreSQL
3) 파일/이미지 저장: Firebase Storage → 자체 오브젝트 스토리지(S3 호환 등) 또는 DB/서버 저장소
4) LLM 호출: 직접 호출 → 백엔드 프록시/통합 LLM 서비스
5) 프록시/베이스 URL 하드코딩 제거: 환경변수/설정 기반으로 변경

---

## 모듈별 영향 범위 요약

### chatbot-front (clt-chatbot 활용)
- 영향 큼: 인증/시나리오/대화/알림/즐겨찾기/개발보드/검색/설정
- LLM 스트리밍 API 인터페이스 유지 필요
- 이미지 리소스 로딩 경로 변경 필요

### chatbot-admin (react-flow 활용)
- 영향 큼: 시나리오 CRUD/템플릿 CRUD/노드 표시 설정/로그인
- FastAPI/Firestore 선택 분기 제거 후 단일 백엔드 기준 재정의 필요
- 시뮬레이터 LLM 호출 경로 백엔드 연계 필요

---

## 우선 확인/결정 필요 사항
1) 제품화 백엔드의 인증 방식(SSO, 사내 인증, 자체 ID/PW)
2) LLM 제공 정책(내부 LLM 게이트웨이 여부)
3) 데이터 마이그레이션 대상(기존 Firebase 데이터 이관 필요 종류)
4) 외부 API 호출 허용 범위(랜덤 단어 API 등 제거 여부)

---

## 참고 파일
- `reference/clt-chatbot/package.json`
- `reference/clt-chatbot/app/lib/firebase.js`
- `reference/clt-chatbot/app/lib/llm.js`
- `reference/clt-chatbot/app/api/chat/route.js`
- `reference/clt-chatbot/next.config.mjs`
- `reference/react-flow/package.json`
- `reference/react-flow/src/firebase.js`
- `reference/react-flow/src/firebaseApi.js`
- `reference/react-flow/src/fastApi.js`
- `reference/react-flow/src/backendService.js`
- `reference/react-flow/src/hooks/useChatFlow.js`
- `reference/react-flow/api/proxy.js`
- `reference/react-flow/vite.config.js`
