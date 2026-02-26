// app/store/slices/uiSlice.js
import { apiFetch } from "../../lib/apiClient";
import { getAuthToken } from "../../lib/authToken";
import { locales } from "../../lib/locales";
import {
  postToParent,
  PARENT_ORIGIN,
  SCENARIO_PANEL_WIDTH,
  delayParentAnimationIfNeeded,
} from "../../lib/parentMessaging";

const getInitialMessages = (lang = "ko") => {
  return [
    { id: "initial", sender: "bot", text: locales[lang].initialBotMessage },
  ];
};

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export const createUISlice = (set, get) => ({
  // State
  theme: "light",
  fontSize: "default", // 'default' or 'small'
  language: "ko",
  maxFavorites: 10,
  hideCompletedScenarios: false,
  hideDelayInHours: 0,
  contentTruncateLimit: 10, // 봇 답변 줄임 줄 수 (기본값 10)
  fontSizeDefault: "16px", // 기본값
  isDevMode: false,
  sendTextShortcutImmediately: false,
  // --- 👇 [추가] FastAPI 사용 여부 상태 ---
  useFastApi: false, 
  // --- 👆 [추가] ---
  dimUnfocusedPanels: true,
  enableFavorites: true, // 즐겨찾기 기능 활성화 여부 (기본값 true)
  showHistoryOnGreeting: false, // 초기 화면 히스토리 표시 여부
  mainInputPlaceholder: "", // 메인 입력창 플레이스홀더
  headerTitle: "AI Chatbot", // 기본값
  enableMainChatMarkdown: true, // 메인 챗 마크다운 활성화 여부
  mainInputValue: "", // 메인 입력창의 제어되는 값
  showScenarioBubbles: true, // 시나리오 버블 표시 여부 (기본값 true)
  llmProvider: "flowise",
  flowiseApiUrl: "",
  isProfileModalOpen: false,
  isSearchModalOpen: false,
  isScenarioModalOpen: false,
  isNotificationModalOpen: false,
  isManualModalOpen: false,
  isHistoryPanelOpen: false,
  isScenarioPanelExpanded: false,
  confirmModal: {
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: () => {},
    confirmVariant: "default",
  },
  activePanel: "main",
  lastFocusedScenarioSessionId: null,
  focusRequest: 0,
  shortcutMenuOpen: null,
  ephemeralToast: {
    visible: false,
    message: "",
    type: "info",
  },
  scrollToMessageId: null,
  forceScrollToBottom: false,
  scrollAmount: 0,
  isInitializing: false,

  // Actions
  setIsInitializing: (value) => set({ isInitializing: value }),
  setMainInputValue: (value) => set({ mainInputValue: value }),

  loadGeneralConfig: async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const response = await apiFetch(`${BASE_URL}/settings/global`);
      if (!response.ok) throw new Error("Failed to load general config.");
      const config = await response.json();
      set({
        maxFavorites:
          typeof config.maxFavorites === "number" ? config.maxFavorites : 10,
        dimUnfocusedPanels:
          typeof config.dimUnfocusedPanels === "boolean"
            ? config.dimUnfocusedPanels
            : true,
        enableFavorites:
          typeof config.enableFavorites === "boolean"
            ? config.enableFavorites
            : true,
        showHistoryOnGreeting:
          typeof config.showHistoryOnGreeting === "boolean"
            ? config.showHistoryOnGreeting
            : false,
        mainInputPlaceholder: config.mainInputPlaceholder || "",
        headerTitle: config.headerTitle || "AI Chatbot",
        enableMainChatMarkdown:
          typeof config.enableMainChatMarkdown === "boolean"
            ? config.enableMainChatMarkdown
            : true,
        showScenarioBubbles:
          typeof config.showScenarioBubbles === "boolean"
            ? config.showScenarioBubbles
            : true,
        llmProvider: config.llmProvider || "flowise",
        flowiseApiUrl: config.flowiseApiUrl || "",
      });
    } catch (error) {
      console.error("Error loading general config:", error);
    }
  },

  saveGeneralConfig: async (settings) => {
    try {
      const response = await apiFetch(`${BASE_URL}/settings/global`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to save general config.");
      set(settings);
      return true;
    } catch (error) {
      console.error("Error saving general config:", error);
      return false;
    }
  },

  savePersonalSettings: async (settings) => {
    const { showEphemeralToast, language } = get();

    // 롤백을 위한 이전 설정 백업
    const previousSettings = {};
    Object.keys(settings).forEach((key) => {
      if (get()[key] !== undefined) {
        previousSettings[key] = get()[key];
      }
    });

    try {
      set(settings); // 1. 낙관적 업데이트 (UI 즉시 반영)

      const response = await apiFetch(`${BASE_URL}/settings/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to save settings.");
      return true;
    } catch (error) {
      console.error("Error saving personal settings:", error);
      const errorMsg =
        locales[language]?.errorUnexpected || "Failed to save settings.";
      showEphemeralToast(errorMsg, "error");

      // 저장 실패 시 롤백
      console.log("Rolling back settings due to error...", previousSettings);
      set(previousSettings);
      
      return false;
    }
  },

  setScrollToMessageId: (id) => set({ scrollToMessageId: id }),
  setForceScrollToBottom: (value) => set({ forceScrollToBottom: value }),

  scrollBy: (amount) => set({ scrollAmount: amount }),
  resetScroll: () => set({ scrollAmount: 0 }),

  setShortcutMenuOpen: (menuName) => set({ shortcutMenuOpen: menuName }),

  showEphemeralToast: (message, type = "info") => {
    set({ ephemeralToast: { visible: true, message, type } });
    setTimeout(() => {
      set((state) => ({
        ephemeralToast: { ...state.ephemeralToast, visible: false },
      }));
    }, 3000);
  },
  hideEphemeralToast: () => {
    set((state) => ({
      ephemeralToast: { ...state.ephemeralToast, visible: false },
    }));
  },

  setTheme: async (newTheme) => {
    set({ theme: "light" });
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", "light");
    }
  },

  toggleTheme: async () => {
    console.log("Theme toggling is disabled.");
  },

  setFontSize: async (size) => {
    set({ fontSize: size });
    if (typeof window !== "undefined") {
      localStorage.setItem("fontSize", size);
    }
    try {
      await apiFetch(`${BASE_URL}/settings/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontSize: size }),
      });
    } catch (error) {
      console.error("Error saving font size:", error);
    }
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang);
    }
    try {
      await apiFetch(`${BASE_URL}/settings/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
    } catch (error) {
      console.error("Error saving language:", error);
    }
    const { currentConversationId, messages } = get();
    if (!currentConversationId || messages.length <= 1) {
      set({ messages: getInitialMessages(lang) });
    }
  },

  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),
  openSearchModal: () =>
    set({ isSearchModalOpen: true, searchResults: [], isSearching: false }),
  closeSearchModal: () => set({ isSearchModalOpen: false }),
  openScenarioModal: () => set({ isScenarioModalOpen: true }),
  closeScenarioModal: () => set({ isScenarioModalOpen: false }),
  openNotificationModal: () => set({ isNotificationModalOpen: true }),
  closeNotificationModal: () => set({ isNotificationModalOpen: false }),
  openManualModal: () => set({ isManualModalOpen: true }),
  closeManualModal: () => set({ isManualModalOpen: false }),

  openConfirmModal: (config) =>
    set((state) => ({
      confirmModal: { ...state.confirmModal, isOpen: true, ...config },
    })),
  closeConfirmModal: () =>
    set((state) => ({
      confirmModal: { ...state.confirmModal, isOpen: false },
    })),

  toggleHistoryPanel: async () => {
    const isCurrentlyOpen = get().isHistoryPanelOpen;
    const willBeOpen = !isCurrentlyOpen;
    const width = willBeOpen ? 264 : -264;
    console.log(
      `[Call Window Method] callChatbotResize(width: ${width}) to ${PARENT_ORIGIN} with ${
        willBeOpen ? "Open" : "Close"
      } History Panel`
    );
    postToParent("callChatbotResize", { width });
    await delayParentAnimationIfNeeded();
    set({ isHistoryPanelOpen: willBeOpen });
  },

  openHistoryPanel: async () => {
    if (get().isHistoryPanelOpen) return;
    const width = 264;
    console.log(
      `[Call Window Method] callChatbotResize(width: ${width}) to ${PARENT_ORIGIN} with Open History Panel`
    );
    postToParent("callChatbotResize", { width });
    await delayParentAnimationIfNeeded();
    set({ isHistoryPanelOpen: true });
  },

  closeHistoryPanel: async () => {
    if (!get().isHistoryPanelOpen) return;
    const width = -264;
    console.log(
      `[Call Window Method] callChatbotResize(width: ${width}) to ${PARENT_ORIGIN} with Close History Panel`
    );
    postToParent("callChatbotResize", { width });
    await delayParentAnimationIfNeeded();
    set({ isHistoryPanelOpen: false });
  },

  toggleScenarioPanelExpanded: async () => {
    if (get().activePanel !== "scenario") return;
    const wasExpanded = get().isScenarioPanelExpanded;
    const willBeExpanded = !wasExpanded;
    const widthDelta = willBeExpanded ? 280 : -280;
    console.log(
      `[Call Window Method] callChatbotResize(width: ${widthDelta}) to ${PARENT_ORIGIN} with Toggle Scenario Panel Expanded`
    );
    postToParent("callChatbotResize", { width: widthDelta });
    await delayParentAnimationIfNeeded();
    set({ isScenarioPanelExpanded: willBeExpanded });
  },

  resetScenarioPanelExpansion: () => set({ isScenarioPanelExpanded: false }),

  setActivePanel: async (panel, sessionId = null) => {
    const previousActivePanel = get().activePanel;
    const wasScenarioPanelActive = previousActivePanel === "scenario";
    const wasExpanded = get().isScenarioPanelExpanded;
    if (panel === "scenario") {
      if (!wasScenarioPanelActive) {
        console.log(
          `[Call Window Method] callChatbotResize(width: ${SCENARIO_PANEL_WIDTH}) to ${PARENT_ORIGIN} with Activate Scenario Panel`
        );
        postToParent("callChatbotResize", { width: SCENARIO_PANEL_WIDTH });
        await delayParentAnimationIfNeeded();
      }
      set({
        activePanel: panel,
        activeScenarioSessionId: sessionId,
        lastFocusedScenarioSessionId: sessionId,
        isScenarioPanelExpanded: wasScenarioPanelActive ? wasExpanded : false,
      });
    } else {
      set({
        activePanel: "main",
        activeScenarioSessionId: null,
        isScenarioPanelExpanded: false,
      });
    }
    get().focusChatInput();
  },

  focusChatInput: () =>
    set((state) => ({ focusRequest: state.focusRequest + 1 })),
  
  clearUserAndData: () => {
    set({
      theme: "light",
      fontSize: "default",
      language: "ko",
      maxFavorites: 10,
      hideCompletedScenarios: false,
      hideDelayInHours: 0,
      contentTruncateLimit: 10,
      fontSizeDefault: "16px",
      isDevMode: false,
      sendTextShortcutImmediately: false,
      // --- 👇 [추가] 초기화 시 false ---
      useFastApi: false, 
      // --- 👆 [추가] ---
      dimUnfocusedPanels: true,
      enableFavorites: true,
      showHistoryOnGreeting: false,
      mainInputPlaceholder: "",
      headerTitle: "AI Chatbot", 
      enableMainChatMarkdown: true,
      showScenarioBubbles: true,
      mainInputValue: "",
      llmProvider: "flowise",
      flowiseApiUrl: "",
      isProfileModalOpen: false,
      isSearchModalOpen: false,
      isScenarioModalOpen: false,
      isNotificationModalOpen: false,
      isManualModalOpen: false,
      isHistoryPanelOpen: false,
      isScenarioPanelExpanded: false,
      confirmModal: {
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        onConfirm: () => {},
        confirmVariant: "default",
      },
      activePanel: "main",
      lastFocusedScenarioSessionId: null,
      focusRequest: 0,
      shortcutMenuOpen: null,
      ephemeralToast: {
        visible: false,
        message: "",
        type: "info",
      },
      scrollToMessageId: null,
      forceScrollToBottom: false,
      scrollAmount: 0,
      isInitializing: false,
    });
  },
});
