// app/store/index.js
import { create } from "zustand";
import { locales } from "../lib/locales";

// 슬라이스 임포트
import { createAuthSlice } from "./slices/authSlice";
import { createUISlice } from "./slices/uiSlice";
import { createChatSlice } from "./slices/chatSlice";
import { createScenarioSlice } from "./slices/scenarioSlice";
import { createNotificationSlice } from "./slices/notificationSlice";
import { createFavoritesSlice } from "./slices/favoritesSlice";
import { createConversationSlice } from "./slices/conversationSlice";
import { createSearchSlice } from "./slices/searchSlice";

// 초기 메시지 함수 (chatSlice 또는 유틸리티로 이동 고려)
const getInitialMessages = (lang = "ko") => {
    const initialText = locales[lang]?.initialBotMessage || locales['en']?.initialBotMessage || "Hello! How can I help you?";
    // chatSlice에서 초기 메시지를 관리하므로 여기서는 빈 배열 반환 또는 chatSlice 호출
    // return [{ id: "initial", sender: "bot", text: initialText }];
    // chatSlice의 초기 상태를 직접 참조하기 어려우므로, chatSlice 내부에서 관리하도록 위임
    return []; // chatSlice에서 처리하도록 비움
};

// 메인 스토어 생성
export const useChatStore = create((set, get) => ({
  // 각 슬라이스 결합
  ...createAuthSlice(set, get),
  ...createUISlice(set, get),
  ...createChatSlice(set, get),
  ...createScenarioSlice(set, get),
  ...createNotificationSlice(set, get),
  ...createFavoritesSlice(set, get),
  ...createConversationSlice(set, get),
  ...createSearchSlice(set, get),

  // --- 👇 [제거] 복합 액션들을 각 슬라이스로 이동 ---
  // handleNotificationNavigation: (notificationSlice.js로 이동)
  // setUserAndLoadData: (authSlice.js로 이동)
  // clearUserAndData: (authSlice.js로 이동)
  // handleScenarioItemClick: (conversationSlice.js로 이동)
  // --- 👆 [제거] ---

  // 스토어 전체 초기화 및 구독 관리 (최상위 로직 유지)
  initAuth: () => {
    get().restoreSession?.();
    // 초기 설정 로드
    get().loadGeneralConfig?.(); // uiSlice (또는 별도 configSlice)

    // URL 파라미터 테스트 로그인
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const testId = urlParams.get("id");
      if (testId) {
        console.log(`Attempting auto login with test ID: ${testId}`);
        setTimeout(() => {
          if (!get().user) {
            get().loginWithTestId?.(testId); // authSlice
          }
        }, 0);
      }
    }
  },

  unsubscribeAll: () => {
    // 모든 슬라이스의 구독 해제 함수 호출
    get().unsubscribeConversations?.(); // conversationSlice
    get().unsubscribeMessages?.(); // chatSlice
    get().unsubscribeAllScenarioListeners?.(); // scenarioSlice
    get().unsubscribeDevMemos?.(); // devBoardSlice
    get().unsubscribeNotificationStream?.(); // notificationSlice
    get().unsubscribeFavorites?.(); // favoritesSlice

    // 각 슬라이스의 해제 함수 상태 초기화
    set({
      unsubscribeConversations: null, // conversationSlice
      unsubscribeMessages: null, // chatSlice
      // unsubscribeScenariosMap는 scenarioSlice에서 관리/초기화
      unsubscribeDevMemos: null, // devBoardSlice
      notificationStream: null, // notificationSlice
      unsubscribeFavorites: null, // favoritesSlice
    });
  },
}));

// 초기화 로직 호출 (애플리케이션 시작 시 한 번 실행)
useChatStore.getState().initAuth();
