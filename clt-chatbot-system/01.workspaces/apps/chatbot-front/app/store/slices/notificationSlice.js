// app/store/slices/notificationSlice.js

'use client';
import { apiFetch } from '../../lib/apiClient';
import { getAuthToken } from '../../lib/authToken';
import { openLinkThroughParent } from '../../lib/parentMessaging';

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

export const createNotificationSlice = (set, get) => ({
  // State
  toast: {
    visible: false,
    message: '',
    type: 'info',
  },
  toastHistory: [],
  hasUnreadNotifications: false,
  unreadScenarioSessions: new Set(),
  unreadConversations: new Set(),
  notificationStream: null,


  // Actions
  deleteNotification: async (notificationId) => {
    if (typeof notificationId !== 'string' || !notificationId) {
        console.error("Delete failed: Invalid notificationId provided.", notificationId);
        get().showToast("Failed to delete notification due to an invalid ID.", "error");
        return;
    }

    try {
        const response = await apiFetch(`${BASE_URL}/notifications/${encodeURIComponent(notificationId)}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete notification.");
        set((state) => ({
          toastHistory: state.toastHistory.filter((item) => item.id !== notificationId),
        }));
    } catch (error) {
        console.error("Error deleting notification from API:", error);
        get().showToast("Failed to delete notification.", "error");
    }
  },

  showToast: (message, type = 'info', scenarioSessionId = null, conversationId = null) => {
    set({ toast: { id: Date.now(), message, type, visible: true } });

    get().saveNotification({
      message,
      type,
      scenario_session_id: isUuid(scenarioSessionId) ? scenarioSessionId : null,
      conversation_id: isUuid(conversationId) ? conversationId : null,
    });

    setTimeout(() => set(state => ({ toast: { ...state.toast, visible: false } })), 3000);
  },

  saveNotification: async (toastData) => {
    try {
      const response = await apiFetch(`${BASE_URL}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toastData),
      });
      if (!response.ok) {
        throw new Error("Failed to save notification.");
      }
    } catch (error) {
      console.error("Error saving notification to API:", error);
    }
  },

  loadNotificationHistory: async () => {
    try {
      const response = await apiFetch(`${BASE_URL}/notifications?limit=50`);
      if (!response.ok) throw new Error("Failed to load notifications.");
      const data = await response.json();
      set({ toastHistory: data.items || [] });
      get().syncUnreadState(data.items || []);
    } catch (error) {
      console.error("Error loading notification history:", error);
    }
  },

  subscribeToNotificationStream: () => {
    if (get().notificationStream) return;
    const token = getAuthToken() || "";
    if (!token) return;
    const url = `${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);
    source.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const items = payload.items || [];
        set({ toastHistory: items });
        get().syncUnreadState(items);
      } catch (error) {
        console.error("Failed to parse notification snapshot:", error);
      }
    });
    source.addEventListener("notification", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const nextItems = [payload, ...get().toastHistory];
        set({ toastHistory: nextItems });
        get().syncUnreadState(nextItems);
      } catch (error) {
        console.error("Failed to parse notification event:", error);
      }
    });
    source.onerror = (error) => {
      console.error("Notification stream error:", error);
    };
    set({ notificationStream: source });
  },

  unsubscribeNotificationStream: () => {
    const source = get().notificationStream;
    if (source) {
      source.close();
    }
    set({ notificationStream: null });
  },

  markNotificationAsRead: async (notificationId) => {
    try {
      const response = await apiFetch(`${BASE_URL}/notifications/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notificationId] }),
      });
      if (!response.ok) throw new Error("Failed to mark notification as read.");
      set((state) => ({
        toastHistory: state.toastHistory.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item
        ),
      }));
      get().syncUnreadState(get().toastHistory);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  handleEvents: (events, scenarioSessionId = null, conversationId = null) => {
      if (!events || !Array.isArray(events)) return;
      events.forEach(event => {
        if (event.type === 'toast') {
          get().showToast(event.message, event.toastType, scenarioSessionId, conversationId);
        } else if (event.type === 'open_link' && event.url) {
          if (typeof window === 'undefined') {
             console.warn("[handleEvents] Cannot open link: window object not available.");
             return;
          }
          const didSend = openLinkThroughParent(event.url);
          if (!didSend) {
            console.warn('[handleEvents] Parent window not reachable. Opened link in a new tab.');
          }
          console.log(`[handleEvents] Opened link: ${event.url}`);
        }
      });
  },

  syncUnreadState: (items) => {
    const unreadSessions = new Set();
    const unreadConvos = new Set();
    let hasUnread = false;
    items.forEach((item) => {
      if (!item.read) {
        hasUnread = true;
        if (item.scenario_session_id) {
          unreadSessions.add(item.scenario_session_id);
          if (item.conversation_id) {
            unreadConvos.add(item.conversation_id);
          }
        }
      }
    });
    set({
      hasUnreadNotifications: hasUnread,
      unreadScenarioSessions: unreadSessions,
      unreadConversations: unreadConvos,
    });
  },

  openNotificationModal: () => {
    get().loadNotificationHistory();
    set({ isNotificationModalOpen: true });
  },

  closeNotificationModal: () => {
    set({ isNotificationModalOpen: false });
  },

  // --- 👇 [추가] index.js에서 이동된 복합 액션 ---
  handleNotificationNavigation: async (notification) => {
    // 알림 클릭 시 대화 로드 및 스크롤 처리
    get().closeNotificationModal(); // uiSlice
    get().markNotificationAsRead(notification.id); // notificationSlice

    if (notification.conversation_id) { // 대화 ID가 있는 경우
      if (get().currentConversationId !== notification.conversation_id) { // conversationSlice 상태 참조
        await get().loadConversation(notification.conversation_id); // conversationSlice 액션 호출
      }
      // 시나리오 세션 ID가 있으면 해당 메시지로 스크롤
      if (notification.scenario_session_id) {
        // 약간의 지연 후 스크롤 시도 (대화 로딩 완료 시간 확보)
        setTimeout(() => { get().setScrollToMessageId(notification.scenario_session_id); }, 300); // uiSlice 액션 호출
      }
    }
  },
  // --- 👆 [추가] ---
});
