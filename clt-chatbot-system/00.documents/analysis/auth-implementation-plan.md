# 인증 처리 방안(구현 계획)

## 목표
- Firebase 인증 제거
- PoC 방식(dev-login) 유지
- 향후 정식 인증(SSO/사내 인증)으로 교체 가능한 구조 확보

## 범위
- `chatbot-backend`: 사용자용 인증/세션
- `chatbot-admin-backend`: 관리자 인증
- `chatbot-front`: 토큰 기반 요청
- `chatbot-admin`: 관리자 토큰 기반 요청

## 공통 원칙
- Authorization: `Bearer <JWT>` 사용
- 토큰 만료: 30~60분
- 최소 권한(role) 포함: `user`, `admin`
- 환경별 허용(DEV/QA/POC): dev-login on/off

---

## 1) chatbot-backend (사용자용)

### API
- `GET /auth/dev-login?id={user_id}`
  - DEV/QA/POC 환경에서만 동작
  - 사용자 조회/자동 생성 후 JWT 발급

### 백엔드 처리
- JWT 발급/검증 모듈
- 미인증 요청 차단(인증 필요 경로)
- 허용 경로(예: `/health`, `/auth/dev-login`)

### 프론트 연동
- 접속 URL에 `?id=xxx`가 있으면 `dev-login` 호출
- 응답 토큰을 저장하고 모든 API 요청 헤더에 추가
- 토큰 만료 시 재로그인(간단 재시도 또는 로그인 유도)

---

## 2) chatbot-admin-backend (관리자용)

### API
- `POST /auth/admin-login`
  - 정식 인증 연계 전까지 임시 계정 테이블 기반

### 어드민 연동
- 로그인 성공 시 JWT 저장
- 관리자 API 요청에 Bearer 토큰 적용

---

## 3) 프론트 구현 체크리스트

### 토큰 저장 위치
- PoC: `localStorage` 우선
- 운영: `httpOnly cookie` 고려

### 공통 API 호출
- fetch 래퍼에서 Authorization 자동 주입
- 에러 코드 401 처리 (재로그인 흐름)

### mock 모드 연동
- `APP_MODE=mock`일 때:
  - Firebase 초기화/인증 스킵
  - `API_BASE_URL`로 호출
  - dev-login 대신 테스트 토큰 사용 가능

---

## 4) 환경변수(초안)

- `ENABLE_DEV_LOGIN=true|false`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=3600`
- `API_BASE_URL=...`
- `APP_MODE=mock` (mock 모드용)

---

## 5) 테스트 시나리오

1. `/?id=test` 접속 → `dev-login` 호출 → 토큰 저장
2. `/conversations` 등 보호 리소스 호출 시 Authorization 헤더 확인
3. 토큰 만료 시 401 → 재로그인 처리

---

## 후속 결정 필요
- 정식 인증 방식(SSO/사내 인증/ID-PW)
- 토큰 저장 방식(쿠키 vs 로컬스토리지)
- dev-login 허용 환경 범위
