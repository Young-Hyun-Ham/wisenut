# 개발보드 제거 계획서

## 목적
- PoC 전용 기능인 개발보드(DevBoard)를 제품 코드에서 제거한다.

## 범위
- 프론트: DevBoard UI/상태/데이터 로딩 제거
- 백엔드: /dev-board API 및 스펙 제거
- 문서: 관련 스펙/테스트 정리

---

## 1) 프론트 제거 대상

- 상태/슬라이스
  - `01.workspaces/apps/chatbot-front/app/store/index.js`  
    - `createDevBoardSlice` 주입 제거
  - `01.workspaces/apps/chatbot-front/app/store/slices/devBoardSlice.js`  
    - 파일 삭제 또는 슬라이스 제거
  - `01.workspaces/apps/chatbot-front/app/store/slices/uiSlice.js`  
    - `isDevBoardModalOpen`, `openDevBoardModal`, `closeDevBoardModal` 제거
  - `01.workspaces/apps/chatbot-front/app/store/slices/authSlice.js`  
    - 초기 상태 내 dev board 관련 필드 정리

- UI 컴포넌트
  - `01.workspaces/apps/chatbot-front/app/components/DevBoardModal.jsx` 삭제
  - `01.workspaces/apps/chatbot-front/app/components/HistoryPanel.jsx`  
    - `DevBoardModal` import/렌더 제거
  - `01.workspaces/apps/chatbot-front/app/components/ProfileModal.jsx`  
    - dev board 버튼/핸들러 흔적 제거
    - dev board 관련 주석 정리

---

## 2) 백엔드 제거 대상

- mock 라우터
  - `01.workspaces/apps/chatbot-backend/app/routers/mock.py`  
    - `/dev-board` 관련 라우트 제거

- OpenAPI 스펙
  - `01.workspaces/apps/chatbot-backend/openapi.yaml`  
    - DevBoard 태그/엔드포인트/스키마 제거

- 테스트 스크립트
  - `01.workspaces/apps/chatbot-backend/scripts/mock_api_test.py`  
    - `/dev-board` 테스트 분기 제거

---

## 3) 검증 체크리스트

- 프론트 빌드/런타임 에러 없음
- DevBoard 관련 상태/액션 참조 없음
- `/dev-board` 호출 경로 없음
- OpenAPI에서 DevBoard 스펙 제거 확인

---

## 4) 리스크 및 대응

- 모달/상태 제거 시 다른 UI의 조건부 렌더가 깨질 수 있음
  - 제거 전 `isDevBoardModalOpen` 참조 전체 확인 필요
- 테스트/문서 불일치 가능
  - 스펙/테스트 파일 동시 정리
