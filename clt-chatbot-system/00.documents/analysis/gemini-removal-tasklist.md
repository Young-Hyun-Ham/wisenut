# Gemini 제거 작업리스트

## 목적
- 프론트/백엔드에서 Gemini 의존을 완전히 제거
- Flowise 단일 LLM 경로로 통합

---

# 1) 코드 제거 대상

## 프론트
- [V] `01.workspaces/apps/chatbot-front/app/lib/gemini.js` 삭제
- [V] `01.workspaces/apps/chatbot-front/app/lib/llm.js` Gemini 관련 분기 제거
- [V] `01.workspaces/apps/chatbot-front/app/lib/nodeHandlers.js` Gemini 호출 제거
- [V] `01.workspaces/apps/chatbot-front/app/store/actions/chatResponseHandler.js` Gemini 분기 제거
- [V] `01.workspaces/apps/chatbot-front/app/store/slices/uiSlice.js` 기본 LLM 값 변경(`gemini` → `flowise`)
- [V] `01.workspaces/apps/chatbot-front/app/admin/general/page.js` Gemini 선택 UI 제거

## 문서
- [V] `01.workspaces/apps/chatbot-front/README.md` Gemini 언급 제거(이미 반영됐는지 재확인)
- [V] `00.documents/analysis/external-dependency-analysis.md` Gemini 제거 상태 반영
- [V] `00.documents/analysis/next-steps.md` Gemini 관련 항목 제거/갱신

---

# 2) 설정/환경 변수 정리
- [V] `.env`/문서에서 `GOOGLE_GEMINI_API_KEY` 제거
- [V] 관리자 설정에서 LLM Provider 기본값 `flowise` 고정

---

# 3) 검증 체크
- [V] `rg -n "gemini" 01.workspaces/apps/chatbot-front` 결과 0건
- [V] `rg -n "GOOGLE_GEMINI_API_KEY" 00.documents 01.workspaces` 결과 0건
- [ ] 기본 LLM 호출이 Flowise로 정상 수행

---

# 4) 완료 기준
- [V] Gemini 관련 파일/분기 제거
- [V] UI에서 Gemini 선택 옵션 제거
- [V] 문서/환경변수에서 Gemini 흔적 제거
