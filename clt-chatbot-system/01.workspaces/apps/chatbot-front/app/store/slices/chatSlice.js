// app/store/slices/chatSlice.js
import { locales } from "../../lib/locales";
import { apiFetch } from "../../lib/apiClient";
import { getErrorKey } from "../../lib/errorHandler";
import { handleResponse } from "../actions/chatResponseHandler";
import { queryClient } from "../../queryClient";
import { fetchScenarios } from "../../lib/api";

const MESSAGE_LIMIT = 15;
const FASTAPI_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:8000";

const SCENARIOS_QUERY_KEY = ["scenarios"];

const extractScenarioItems = (scenarios) => {
  if (!Array.isArray(scenarios)) return [];
  const items = [];

  const pushIfValid = (candidate) => {
    if (candidate && typeof candidate === "object" && candidate.id && candidate.title) {
      items.push(candidate);
    }
  };

  scenarios.forEach((category) => {
    if (!category || typeof category !== "object") return;
    if (Array.isArray(category.items)) {
      category.items.forEach(pushIfValid);
      return;
    }
    if (Array.isArray(category.subCategories)) {
      category.subCategories.forEach((subCat) => {
        if (Array.isArray(subCat.items)) {
          subCat.items.forEach(pushIfValid);
        }
      });
      return;
    }
    pushIfValid(category);
  });

  return items;
};

const resolveScenarioId = (scenarios, scenarioRef) => {
  const items = extractScenarioItems(scenarios);
  if (items.length === 0) {
    console.warn(
      `[handleShortcutClick] Scenario list is empty while matching ref: ${scenarioRef}`
    );
    return null;
  }

  // 1) shortcut value가 이미 scenario id인 경우 우선 매칭
  const byId = items.find((item) => item.id === scenarioRef);
  if (byId?.id) return byId.id;

  // 2) 구버전 데이터 호환: value가 title인 경우 title 매칭
  const byTitleMatches = items.filter((item) => item.title === scenarioRef);
  if (byTitleMatches.length > 1) {
    console.warn(
      `[handleShortcutClick] Duplicate scenario title detected: ${scenarioRef}`,
      byTitleMatches
    );
  }
  return byTitleMatches[0]?.id || null;
};

// 초기 메시지 함수 (chatSlice가 관리)
const getInitialMessages = (lang = "ko") => {
  const initialText =
    locales[lang]?.initialBotMessage ||
    locales["en"]?.initialBotMessage ||
    "Hello! How can I help you?";
  return [{ id: "initial", sender: "bot", text: initialText }];
};

export const createChatSlice = (set, get) => {

  return {
    // State
    messages: getInitialMessages("ko"),
    isLoading: false,
    pendingResponses: new Set(),
    completedResponses: new Set(),
    slots: {},
    setSlots: (newSlots) => set({ slots: newSlots }),
    extractedSlots: {},
    llmRawResponse: null,
    selectedOptions: {},
    unsubscribeMessages: null,
    lastVisibleMessage: null,
    hasMoreMessages: true,

    // Actions
    resetMessages: (language) => {
      set({
        messages: getInitialMessages(language),
        lastVisibleMessage: null,
        hasMoreMessages: true,
        selectedOptions: {},
        isLoading: false,
      });
      get().unsubscribeMessages?.();
      set({ unsubscribeMessages: null });
      get().setMainInputValue(""); // 입력창 초기화
    },

    loadInitialMessages: async (conversationId) => {
      const { user, language, showEphemeralToast } = get();
      if (!user || !conversationId) return;

      const initialMessage = getInitialMessages(language)[0];
      set({
        isLoading: true,
        messages: [initialMessage],
        lastVisibleMessage: null,
        hasMoreMessages: true,
        selectedOptions: {},
        mainInputValue: "", // 대화 로드 시 입력창 초기화
      });

      try {
        const response = await apiFetch(`${FASTAPI_BASE_URL}/conversations/${conversationId}`);
        if (!response.ok) throw new Error("Failed to load messages");

        const data = await response.json();
        const apiMessagesRaw = data.messages || [];
        const mappedMessages = apiMessagesRaw.map((msg) => ({
          id: msg.id,
          sender: msg.role === "user" ? "user" : "bot",
          text: msg.content,
          createdAt: msg.created_at,
        }));

        set({
          messages: [initialMessage, ...mappedMessages],
          isLoading: false,
          hasMoreMessages: false,
        });
      } catch (error) {
        console.error("loadInitialMessages error:", error);
        showEphemeralToast("Failed to load messages (API).", "error");
        set({ isLoading: false });
      }
    },

    updateLastMessage: (payload) => {
      set((state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        if (
          !lastMessage ||
          lastMessage.sender !== "bot" ||
          !lastMessage.isStreaming
        ) {
          return state; 
        }

        let updatedMessage = { ...lastMessage };

        switch (payload.type) {
          case "text":
            updatedMessage.text = payload.replace
              ? payload.data
              : (lastMessage.text || "") + payload.data;
            break;
          case "button":
            updatedMessage.text = (lastMessage.text || "") + payload.data;
            break;
          case "chart":
            updatedMessage.chartData = payload.data;
            updatedMessage.hasRichContent = true;
            break;
          default:
            console.warn(
              "updateLastMessage received unknown payload type:",
              payload.type
            );
            return state; 
        }

        return {
          messages: [...state.messages.slice(0, -1), updatedMessage],
        };
      });
    },

    setSelectedOption: async (messageId, optionValue) => {
      const isTemporaryId = String(messageId).startsWith("temp_");
      if (isTemporaryId) {
        console.warn(
          "setSelectedOption called with temporary ID, skipping Firestore update for now:",
          messageId
        );
        set((state) => ({
          selectedOptions: { ...state.selectedOptions, [messageId]: optionValue },
        }));
        return;
      }

      const previousSelectedOptions = get().selectedOptions;
      set((state) => ({
        selectedOptions: { ...state.selectedOptions, [messageId]: optionValue },
      }));

      const { language, showEphemeralToast, currentConversationId } = get();
      if (!currentConversationId || !messageId) return;

      try {
        const response = await apiFetch(
          `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/messages/${messageId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedOption: optionValue }),
          }
        );
        if (!response.ok) throw new Error("Failed to save selection.");
      } catch (error) {
        console.error("Error updating selected option:", error);
        const errorKey = getErrorKey(error);
        const message =
          locales[language]?.[errorKey] ||
          locales["en"]?.errorUnexpected ||
          "Failed to save selection.";
        showEphemeralToast(message, "error");
        set({ selectedOptions: previousSelectedOptions });
      }
    },

    setMessageFeedback: async (messageId, feedbackType) => {
      const { language, showEphemeralToast, currentConversationId, messages } =
        get();
      if (!currentConversationId || !messageId) {
        console.warn(
          "[setMessageFeedback] Missing user, conversationId, or messageId."
        );
        return;
      }

      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) {
        console.warn(`[setMessageFeedback] Message not found: ${messageId}`);
        return;
      }

      const message = messages[messageIndex];
      const originalFeedback = message.feedback || null;
      const newFeedback = originalFeedback === feedbackType ? null : feedbackType;

      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = { ...message, feedback: newFeedback };
      set({ messages: updatedMessages });

      try {
        const response = await apiFetch(
          `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/messages/${messageId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback: newFeedback }),
          }
        );
        if (!response.ok) throw new Error("Failed to save feedback.");
        console.log(`Feedback set to '${newFeedback}' for message ${messageId}`);
      } catch (error) {
        console.error("Error updating message feedback:", error);
        const errorKey = getErrorKey(error);
        const errorMessage =
          locales[language]?.[errorKey] ||
          locales["en"]?.errorUnexpected ||
          "Failed to save feedback.";
        showEphemeralToast(errorMessage, "error");

        const rollbackMessages = [...get().messages];
        const rollbackMessageIndex = rollbackMessages.findIndex(
          (m) => m.id === messageId
        );
        if (rollbackMessageIndex !== -1) {
          rollbackMessages[rollbackMessageIndex] = {
            ...rollbackMessages[rollbackMessageIndex],
            feedback: originalFeedback,
          };
          set({ messages: rollbackMessages });
        }
      }
    },

    setExtractedSlots: (newSlots) => {
      console.log("[ChatStore] Setting extracted slots:", newSlots);
      set((state) => ({
        extractedSlots: { ...state.extractedSlots, ...newSlots },
      }));
    },

    clearExtractedSlots: () => {
      set({ extractedSlots: {} });
    },

    unsubscribeAllMessagesAndScenarios: () => {
      get().unsubscribeMessages?.();
      set({ unsubscribeMessages: null });
      get().unsubscribeAllScenarioListeners?.();
    },

    handleShortcutClick: async (item, messageId) => {
      if (!item || !item.action) return;
      const {
        extractedSlots,
        clearExtractedSlots,
        setSelectedOption,
        openScenarioPanel,
        handleResponse,
        language,
        showEphemeralToast,
        setMainInputValue,
        focusChatInput,
        sendTextShortcutImmediately,
      } = get();

      if (messageId) {
        set((state) => ({
          selectedOptions: { ...state.selectedOptions, [messageId]: item.title },
        }));
        get().setSelectedOption(messageId, item.title);
      }

      if (item.action.type === "custom") {
        await handleResponse({
          text: item.action.value,
          displayText: item.title,
        });
      } else if (item.action.type === "text") {
        // 설정에 따른 분기 로직
        if (sendTextShortcutImmediately) {
           // 즉시 전송 (설정 ON)
           await handleResponse({
            text: item.action.value,
            displayText: item.action.value, 
          });
        } else {
           // 입력창 채우기 (설정 OFF - 기본값)
           setMainInputValue(item.action.value); 
           focusChatInput();
        }
      } else if (item.action.type === "scenario") {
        const scenarioTitle = item.action.value;
        if (!scenarioTitle || typeof scenarioTitle !== "string") {
          const errorMessage =
            locales[language]?.["errorScenarioNotFound"] ||
            "The linked scenario could not be found. Please contact an administrator.";
          showEphemeralToast(
            `${errorMessage} (value: ${scenarioTitle || "empty"})`,
            "error"
          );
          clearExtractedSlots();
          return;
        }

        let scenarios = queryClient.getQueryData(SCENARIOS_QUERY_KEY);
        if (!scenarios) {
          try {
            scenarios = await queryClient.fetchQuery({
              queryKey: SCENARIOS_QUERY_KEY,
              queryFn: fetchScenarios,
              staleTime: 5 * 60 * 1000,
            });
          } catch (error) {
            console.error(
              "[handleShortcutClick] Failed to load scenarios:",
              error
            );
            const errorMessage =
              locales[language]?.["errorScenarioNotFound"] ||
              "The linked scenario could not be found. Please contact an administrator.";
            showEphemeralToast(
              `${errorMessage} (value: ${scenarioTitle})`,
              "error"
            );
            clearExtractedSlots();
            return;
          }
        }
        if (!Array.isArray(scenarios)) {
          console.warn(
            "[handleShortcutClick] Invalid scenarios payload:",
            scenarios
          );
          const errorMessage =
            locales[language]?.["errorScenarioNotFound"] ||
            "The linked scenario could not be found. Please contact an administrator.";
          showEphemeralToast(
            `${errorMessage} (value: ${scenarioTitle})`,
            "error"
          );
          clearExtractedSlots();
          return;
        }

        const mappedScenarioId = resolveScenarioId(
          scenarios,
          scenarioTitle
        );
        if (!mappedScenarioId) {
          console.warn(
            `[handleShortcutClick] Scenario title not found: ${scenarioTitle}. Shortcut title: "${item.title}"`
          );
          const errorMessage =
            locales[language]?.["errorScenarioNotFound"] ||
            "The linked scenario could not be found. Please contact an administrator.";
          showEphemeralToast(
            `${errorMessage} (value: ${scenarioTitle})`,
            "error"
          );
        } else {
          get().openScenarioPanel?.(mappedScenarioId, extractedSlots);
        }
      } else {
        console.warn(`Unsupported shortcut action type: ${item.action.type}`);
      }
      clearExtractedSlots();
    },

    addMessage: async (sender, messageData) => {
      let newMessage;
      const temporaryId = `temp_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;

      if (sender === "user") {
        newMessage = { id: temporaryId, sender, ...messageData };
      } else {
        newMessage = {
          id: messageData.id || temporaryId,
          sender: "bot",
          text: messageData.text,
          scenarios: messageData.scenarios,
          isStreaming: messageData.isStreaming || false,
          type: messageData.type,
          scenarioId: messageData.scenarioId,
          scenarioSessionId: messageData.scenarioSessionId,
          feedback: null,
          chartData: messageData.chartData || null,
        };
      }

      set((state) => ({ messages: [...state.messages, newMessage] }));

    },

    loadMoreMessages: async () => {
      const {
        language,
        showEphemeralToast,
        currentConversationId,
        hasMoreMessages,
        messages,
      } = get();
      if (
        !currentConversationId ||
        !hasMoreMessages ||
        get().isLoading
      )
        return;

      set({ isLoading: true });

      try {
        const offset = Math.max(messages.length - 1, 0);
        const response = await apiFetch(
          `${FASTAPI_BASE_URL}/conversations/${currentConversationId}/messages?skip=${offset}&limit=${MESSAGE_LIMIT}`
        );
        if (!response.ok) throw new Error("Failed to load more messages.");
        const newMessages = await response.json();
        if (!newMessages.length) {
          set({ hasMoreMessages: false });
          return;
        }

        const initialMessage = messages[0];
        const existingMessages = messages.slice(1);

        const newSelectedOptions = { ...get().selectedOptions };
        newMessages.forEach((msg) => {
          if (msg.selectedOption) newSelectedOptions[msg.id] = msg.selectedOption;
        });

        set({
          messages: [
            initialMessage,
            ...newMessages.map((msg) => ({
              id: msg.id,
              sender: msg.role === "user" ? "user" : "bot",
              text: msg.content,
              createdAt: msg.created_at,
            })),
            ...existingMessages,
          ],
          hasMoreMessages: newMessages.length === MESSAGE_LIMIT,
          selectedOptions: newSelectedOptions,
        });
      } catch (error) {
        console.error("Error loading more messages:", error);
        const errorKey = getErrorKey(error);
        const message =
          locales[language]?.[errorKey] ||
          locales["en"]?.errorUnexpected ||
          "Failed to load more messages.";
        showEphemeralToast(message, "error");
        set({ hasMoreMessages: false });
      } finally {
        set({ isLoading: false });
      }
    },

    handleResponse: (messagePayload) => handleResponse(get, set, messagePayload),
  };
};
