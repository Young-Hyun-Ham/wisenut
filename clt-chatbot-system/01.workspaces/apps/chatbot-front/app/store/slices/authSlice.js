import { locales } from "../../lib/locales";
import { apiFetch } from "../../lib/apiClient";
import { getAuthToken, setAuthToken, clearAuthToken } from "../../lib/authToken";
import { queryClient } from "../../queryClient";
import { fetchScenarios, fetchShortcuts } from "../../lib/api";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";
export const createAuthSlice = (set, get) => ({
  user: null,

  loginWithTestId: (userId) => {
    if (!userId || !userId.trim()) {
      console.error("Test User ID cannot be empty.");
      return;
    }
    get().loginWithDevId(userId.trim());
  },

  logout: async () => {
    try {
      clearAuthToken();
      get().clearUserAndData();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },

  restoreSession: async () => {
    if (get().user) return;
    const token = getAuthToken();
    if (!token) return;
    try {
      const response = await apiFetch(`${BASE_URL}/users/me`);
      if (!response.ok) throw new Error("Failed to restore session.");
      const data = await response.json();
      const user = {
        uid: data?.id,
        displayName: data?.name || "User",
        email: "",
        photoURL: "/images/avatar.png",
        isTestUser: true,
      };
      await get().setUserAndLoadData(user);
    } catch (error) {
      console.error("Restore session failed:", error);
      clearAuthToken();
    }
  },

  setUserAndLoadData: async (user) => {
    set({ user, isInitializing: true });

    // 1. 개인 설정 로드 (Await)
    let fontSize = "default",
      language = "ko",
      contentTruncateLimit = 10,
      hideCompletedScenarios = false,
      hideDelayInHours = 0,
      fontSizeDefault = "16px",
      isDevMode = false,
      sendTextShortcutImmediately = false,
      useFastApi = true; // [수정] 백엔드 전환을 위해 기본값을 true로 권장

    try {
      const response = await apiFetch(`${BASE_URL}/settings/user`);
      const settings = response.ok ? await response.json() : {};

      fontSize = settings.fontSize || localStorage.getItem("fontSize") || fontSize;
      language = settings.language || localStorage.getItem("language") || language;
      contentTruncateLimit =
        typeof settings.contentTruncateLimit === "number"
          ? settings.contentTruncateLimit
          : contentTruncateLimit;
      hideCompletedScenarios =
        typeof settings.hideCompletedScenarios === "boolean"
          ? settings.hideCompletedScenarios
          : hideCompletedScenarios;
      hideDelayInHours =
        typeof settings.hideDelayInHours === "number"
          ? settings.hideDelayInHours
          : hideDelayInHours;
      fontSizeDefault = settings.fontSizeDefault || fontSizeDefault;
      isDevMode =
        typeof settings.isDevMode === "boolean" ? settings.isDevMode : isDevMode;
      
      sendTextShortcutImmediately =
        typeof settings.sendTextShortcutImmediately === "boolean"
          ? settings.sendTextShortcutImmediately
          : sendTextShortcutImmediately;
      
      // useFastApi =
      //   typeof settings.useFastApi === "boolean"
      //     ? settings.useFastApi
      //     : useFastApi;
      
      // [수정] 과도기 동안 DB 설정을 무시하고 true로 강제 (필요시 주석 해제하여 원래대로 복구)
      useFastApi = true;

    } catch (error) {
      console.error("Error loading settings from API:", error);
      fontSize = localStorage.getItem("fontSize") || fontSize;
      language = localStorage.getItem("language") || language;
    } finally {
      set({
        theme: "light",
        fontSize,
        language,
        contentTruncateLimit,
        hideCompletedScenarios,
        hideDelayInHours,
        fontSizeDefault,
        isDevMode,
        sendTextShortcutImmediately,
        useFastApi,
      });
      get().resetMessages?.(language);
    }

    await queryClient.prefetchQuery({
      queryKey: ["shortcuts"],
      queryFn: fetchShortcuts,
      staleTime: 5 * 60 * 1000,
    });
    await queryClient.prefetchQuery({
      queryKey: ["scenarios"],
      queryFn: fetchScenarios,
      staleTime: 5 * 60 * 1000,
    });

    // 3. 리스너 구독 시작 (No Await)
    get().unsubscribeAll();
    
    // 👇 [삭제됨] loadConversations는 이제 React Query가 컴포넌트 마운트 시 알아서 수행합니다.
    // get().loadConversations(user.uid); 

    // 아직 React Query로 이전하지 않은 나머지 데이터 로드 함수들은 유지
    get().subscribeToNotificationStream();
    get().loadFavorites();

    // 2초 타이머 (Await)
    console.log("Starting 2-second splash screen timer...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log("Timer finished. Hiding splash screen.");

    // 4. 초기화 완료
    set({ isInitializing: false });
  },

  loginWithDevId: async (userId) => {
    const apiBase = process.env.API_BASE_URL;
    if (!apiBase) {
      console.error("API_BASE_URL is required for dev-login.");
      return;
    }
    try {
      const response = await apiFetch(`${apiBase}/auth/dev-login?id=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error("dev-login failed");
      }
      const data = await response.json();
      if (data?.access_token) {
        setAuthToken(data.access_token);
      }
      const user = {
        uid: data?.user?.id || userId,
        displayName: data?.user?.name || userId,
        email: `${userId}@local`,
        photoURL: "/images/avatar.png",
        isTestUser: true,
      };
      await get().setUserAndLoadData(user);
    } catch (error) {
      console.error("dev-login failed:", error);
    }
  },

  clearUserAndData: () => {
    clearAuthToken();
    get().unsubscribeAll();

    let fontSize = "default",
      language = "ko";
    if (typeof window !== "undefined") {
      fontSize = localStorage.getItem("fontSize") || "default";
      language = localStorage.getItem("language") || "ko";
    }

    set({
      user: null,
      theme: "light",
      fontSize,
      language,
      contentTruncateLimit: 10,
      hideCompletedScenarios: false,
      hideDelayInHours: 0,
      fontSizeDefault: "16px",
      isDevMode: false,
      sendTextShortcutImmediately: false,
      useFastApi: false, 
      // conversations: [], // [참고] conversationSlice에서 이미 삭제했으므로 여기서도 불필요하지만, 안전하게 두거나 삭제 가능
      currentConversationId: null,
      expandedConversationId: null,
      scenariosForConversation: {},
      favorites: [],
      devMemos: [],
      toastHistory: [],
      hasUnreadNotifications: false,
      unreadScenarioSessions: new Set(),
      unreadConversations: new Set(),
      scenarioStates: {},
      activeScenarioSessionId: null,
      activeScenarioSessions: [],
      lastFocusedScenarioSessionId: null,
      isSearching: false,
      searchResults: [],
      isLoading: false,
      slots: {},
      extractedSlots: {},
      llmRawResponse: null,
      selectedOptions: {},
      lastVisibleMessage: null,
      hasMoreMessages: true,
      isProfileModalOpen: false,
      isSearchModalOpen: false,
      isScenarioModalOpen: false,
      isNotificationModalOpen: false,
      isManualModalOpen: false,
      confirmModal: {
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        onConfirm: () => {},
        confirmVariant: "default",
      },
      isInitializing: false, 
      activePanel: "main",
    });
    get().resetMessages?.(language);
  },
});
