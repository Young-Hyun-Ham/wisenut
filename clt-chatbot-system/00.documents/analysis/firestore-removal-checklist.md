# Firestore 제거 체크리스트(파일 단위/기능 단위)

## 목적
- Firestore 의존 제거 범위를 기능/파일 기준으로 정리
- 단계별 전환 작업의 우선순위를 명확히 함

---

# 1) 기능 단위 체크리스트

## 알림(Notifications)
- [V] 알림 목록 조회 API 준비 (`GET /notifications`)
- [V] 알림 읽음 처리 API 준비 (`POST /notifications/read`)
- [V] SSE 스트림 연결 (`GET /notifications/stream`)
- [ ] 알림 생성 흐름 정의(`/api/chat` events → DB 저장)
- [V] 프론트 onSnapshot 제거 및 SSE 구독 전환

## 대화(Conversations)
- [ ] 대화 목록/상세 조회 API 정의 및 구현
- [ ] 대화 생성/삭제 API 구현
- [ ] 실시간 메시지 갱신 방식 결정(SSE/폴링)
- [V] Firestore conversation 저장/조회 제거

## 시나리오 세션(Scenario Sessions)
- [ ] 시나리오 세션 CRUD API 구현
- [ ] 세션 상태/슬롯 저장 API 구현
- [V] onSnapshot 기반 세션 구독 제거

## 메시지(Messages)
- [ ] 메시지 저장/조회 API 구현
- [ ] 메시지 스토리지 스키마 확정
- [V] Firestore 메시지 저장 제거

## 즐겨찾기(Favorites)
- [ ] 즐겨찾기 CRUD API 구현
- [V] onSnapshot 제거 및 REST 전환

## 설정(Settings)
- [ ] 사용자 설정 API 구현
- [V] Firestore 설정 로드/저장 제거

## 검색(Search)
- [ ] 검색 API 구현(서버 검색)
- [V] Firestore 검색 제거

## 개발보드(Dev Board)
- [ ] DevBoard 데이터 API 구현
- [V] Firestore DevBoard 저장/조회 제거

---

# 2) 파일 단위 체크리스트(프론트)

## Firebase 초기화/유틸
- [V] `01.workspaces/apps/chatbot-front/app/lib/firebase.js`
- [V] `01.workspaces/apps/chatbot-front/app/lib/chatbotEngine.js`

## Firebase Auth 제거
- [V] Firebase Auth 제거 완료

## 알림
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/notificationSlice.js`
- [V] `01.workspaces/apps/chatbot-front/app/components/NotificationModal.jsx`
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js` (구독 시작부)

## 대화/메시지
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/chatSlice.js`
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/conversationSlice.js`

## 시나리오
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/scenarioSlice.js`

## 즐겨찾기/검색/설정
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/favoritesSlice.js`
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/searchSlice.js`
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/uiSlice.js`

## 개발보드
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/devBoardSlice.js`

## 스토어/공통
- [V] `01.workspaces/apps/chatbot-front/app/store/index.js`
- [V] `01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js`

---

# 3) 백엔드/API 체크리스트(대체 준비)

## 기본 인프라
- [ ] DB 스키마 마이그레이션 유지/검증
- [ ] 모델/리포지토리 계층 정리

## 알림
- [V] 알림 저장 API 추가
- [V] 알림 조회/읽음 처리 API 연결
- [V] SSE 이벤트 소스 연동(PgNotify/Webhook)

## 대화/시나리오/메시지
- [ ] 대화/세션/메시지 API 구현
- [ ] `/api/chat` 이벤트 → DB 저장 연결

---

# 4) 프론트/백엔드 분리 요약

## 프론트(완료)
- [DONE] Firebase 초기화/유틸 제거
- [DONE] 알림 REST/SSE 전환
- [DONE] 대화/메시지 REST 전환
- [DONE] 시나리오 세션 REST 전환
- [DONE] 즐겨찾기/검색/설정/DevBoard REST 전환
- [DONE] Firebase Auth 제거

## 백엔드(잔여)
- [ ] DB 스키마 마이그레이션 유지/검증
- [ ] 모델/리포지토리 계층 정리
- [ ] 대화/세션/메시지 API 구현
- [ ] `/api/chat` 이벤트 → DB 저장 연결

---

# 5) 제거 완료 기준
- Firebase SDK 사용 코드가 0건
- Firestore onSnapshot 사용 코드가 0건
- 동일 기능이 REST/SSE로 동작 확인
- 프론트/백엔드 모두 에러 로그 없이 실행
