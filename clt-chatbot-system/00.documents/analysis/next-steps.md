# 제품화 진행을 위한 다음 스텝 제안

## 배경 요약
- PoC는 완료되었으며, 제품화를 위해 소스 개선이 필요함.
- `chatbot-front`는 `reference/clt-chatbot`을 기반으로 개선.
- `chatbot-admin`은 `reference/react-flow`를 기반으로 개선.
- `chatbot-backend`, `chatbot-admin-backend`는 신규 개발.
- Firebase 제거, `/api/chat` 기반으로 백엔드 연계.
- 인증은 `00.documents/analysis/auth-login-proposal.md` 참고.

## 다음 스텝(우선순위)
1) 외부 의존성 제거 분석서 확정
- 기존 분석서(`00.documents/analysis/external-dependency-analysis.md`)를 기준으로 PM 리뷰 반영.
- Firebase 제거 범위와 대체 경로를 명시.

2) 백엔드 아키텍처/경로 정의
- `chatbot-backend`(FastAPI + PostgreSQL) 핵심 API 목록 정의.
- `/api/chat` 단일 경로로 프론트/어드민 시뮬레이터 연계.
- Flowise 연계 방식(직접 호출 vs 백엔드 프록시) 결정.

3) 인증/권한 정책 확정
- `auth-login-proposal.md` 기반으로 인증 방식 결정.
- 프론트/어드민 세션, 권한(Role) 구조 확정.

4) 데이터 모델 및 마이그레이션 계획
- ERD(`00.documents/analysis/erd.md`) 기준으로
  시나리오/노드/템플릿/대화/사용자 테이블 확정.
- 기존 Firebase 데이터 이관 필요 범위 확인.

5) 프론트/어드민 전환 작업 설계
- Firebase 제거 후 API 호출로 교체되는 파일 목록 확정.
- 환경변수/프록시/스토리지 경로 통일.
- 스트리밍 응답(SSE/ReadableStream) 유지 여부 확인.

6) 개발 범위/일정 산정(WBS)
- 4개 컴포넌트(`front`, `backend`, `admin`, `admin-backend`) 기준
  마일스톤/리스크/의존성 정리.

## 요청사항
- 위 스텝에 대해 PM의 우선순위와 제약사항(기간/리소스)을 알려주면
  상세 작업계획서(WBS)로 전개하겠음.
