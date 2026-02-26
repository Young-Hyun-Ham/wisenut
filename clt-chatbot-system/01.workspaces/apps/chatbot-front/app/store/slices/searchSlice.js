// app/store/slices/searchSlice.js
import { apiFetch } from "../../lib/apiClient";
import { locales } from "../../lib/locales"; // 오류 메시지용
import { getErrorKey } from "../../lib/errorHandler"; // 오류 처리용

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export const createSearchSlice = (set, get) => ({
  // State
  isSearching: false, // 검색 진행 상태
  searchResults: [], // 검색 결과 배열

  // Actions
  searchConversations: async (searchQuery) => {
    // 입력값 공백 제거 및 유효성 검사
    const trimmedQuery = searchQuery?.trim() ?? '';
    if (!trimmedQuery) {
      set({ searchResults: [], isSearching: false }); // 쿼리 없으면 결과 초기화
      return;
    }

    set({ isSearching: true, searchResults: [] }); // 검색 시작, 이전 결과 초기화

    try {
      const response = await apiFetch(`${BASE_URL}/search?q=${encodeURIComponent(trimmedQuery)}`);
      if (!response.ok) throw new Error("Search failed.");
      const results = await response.json();
      set({ searchResults: results });
    } catch (error) {
      console.error("Error during conversation search process:", error);
      const { language, showEphemeralToast } = get();
      const errorKey = getErrorKey(error);
      const message = locales[language]?.[errorKey] || locales['en']?.errorUnexpected || 'Search failed.';
      showEphemeralToast(message, 'error');
      set({ searchResults: [] }); // 오류 시 결과 초기화
    } finally {
      set({ isSearching: false }); // 검색 상태 종료 (성공/실패 무관)
    }
  }, // end searchConversations
});
