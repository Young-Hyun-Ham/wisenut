"use client";

import dynamic from "next/dynamic";
// 👇 React Query 훅 임포트
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useUpdateTitle,
  usePinConversation,
} from "../hooks/useQueries";
import { useChatStore } from "../store";
import { useTranslations } from "../hooks/useTranslations";
import styles from "./HistoryPanel.module.css";
import ConversationItem from "./ConversationItem";
import MenuIcon from "./icons/MenuIcon";
import BellIcon from "./icons/BellIcon";
import SearchIcon from "./icons/SearchIcon";
import EditIcon from "./icons/EditIcon";
import ManualIcon from "./icons/ManualIcon";
import NoHistoryIcon from "./icons/NoHistoryIcon";
import HistoryIcon from "./icons/HistoryIcon";
import NewChatIcon from "./icons/NewChatIcon";

const ProfileModal = dynamic(() => import("./ProfileModal"));
const SearchModal = dynamic(() => import("./SearchModal"));
const NotificationModal = dynamic(() => import("./NotificationModal"));
const ManualModal = dynamic(() => import("./ManualModal"));

export default function HistoryPanel() {
  const {
    user,
    // conversations,       // [제거] React Query로 대체
    loadConversation,
    // createNewConversation, // [제거] Mutation으로 대체
    currentConversationId,
    clearCurrentConversation,
    // deleteConversation,    // [제거] Mutation으로 대체
    // updateConversationTitle, // [제거] Mutation으로 대체
    // pinConversation,       // [제거] Mutation으로 대체
    isHistoryPanelOpen,
    toggleHistoryPanel,
    isSearchModalOpen,
    openSearchModal,
    isProfileModalOpen,
    openProfileModal,
    isNotificationModalOpen,
    openNotificationModal,
    hasUnreadNotifications,
    isManualModalOpen,
    openManualModal,
    scenariosForConversation,
    expandedConversationId,
    toggleConversationExpansion,
    handleScenarioItemClick,
    openConfirmModal,
    unreadScenarioSessions,
    unreadConversations,
    pendingResponses,
    completedResponses,
  } = useChatStore();
  const { t } = useTranslations();

  // 👇 React Query: 데이터 조회 및 변경 훅 사용
  const { data: conversations = [], isLoading, isError } = useConversations();
  const createMutation = useCreateConversation();
  const deleteMutation = useDeleteConversation();
  const updateTitleMutation = useUpdateTitle();
  const pinMutation = usePinConversation();

  // 핸들러: 대화 생성
  const handleCreate = () => {
    createMutation.mutate("New Chat", {
      onSuccess: (newConvo) => {
        // 생성 후 해당 대화로 자동 이동
        if (newConvo && newConvo.id) {
          loadConversation(newConvo.id);
        }
      },
      onError: (error) => {
        console.error("Failed to create conversation:", error);
      },
    });
  };

  // 핸들러: 대화 삭제
  const handleDeleteRequest = (e, convoId) => {
    e.stopPropagation();
    openConfirmModal({
      title: "Alert",
      message: t("deleteConvoConfirm"),
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: () => {
        deleteMutation.mutate(convoId, {
            onSuccess: () => {
                if (convoId === currentConversationId) {
                  clearCurrentConversation?.();
                }
            }
        });
      },
      confirmVariant: "danger",
    });
  };

  // 핸들러: 제목 수정
  const handleUpdateTitle = (id, newTitle) => {
    updateTitleMutation.mutate({ id, title: newTitle });
  };

  // 핸들러: 고정 토글
  const handlePin = (id, isPinned) => {
    pinMutation.mutate({ id, isPinned });
  };

  if (isLoading) return <div className={styles.loadingState}>로딩 중...</div>;
  if (isError) return <div className={styles.errorState}>목록을 불러올 수 없습니다.</div>;

  if (!user) return null;

  return (
    <>
      <svg
        width="0"
        height="0"
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id="spbIconGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#3051ea" />
            <stop offset="100%" stopColor="#7f30c5" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className={`${styles.historyPanel} ${
          isHistoryPanelOpen ? styles.open : styles.closed
        }`}
      >
        <button
          className={`${styles.toggleButton} ${
            !isHistoryPanelOpen ? styles.floatingToggleButton : ""
          }`}
          onClick={toggleHistoryPanel}
        >
          <MenuIcon />
        </button>

        {/* 상단 새 대화 버튼 */}
        <button
          className={styles.newChatButton}
          onClick={handleCreate}
        >
          <NewChatIcon />
        </button>
        <button className={styles.historyButton} onClick={toggleHistoryPanel}>
          <HistoryIcon />
        </button>

        <div className={styles.panelContentWrapper}>
          <div className={styles.header}>
            <div className={styles.headerTopRow}>
              <div className={styles.headerIconGroup}>
                <button
                  className={`${styles.iconButton} ${
                    hasUnreadNotifications ? styles.unread : ""
                  }`}
                  onClick={openNotificationModal}
                >
                  <BellIcon />
                </button>
                <button className={styles.iconButton} onClick={openSearchModal}>
                  <SearchIcon />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.panelContent}>
            {/* 리스트 내부 새 대화 버튼 */}
            <button
              className={styles.sidePanelButton}
              onClick={handleCreate}
            >
              <EditIcon />
              <span className={styles.newChatText}>{t("newChat")}</span>
            </button>
            <span className={styles.commonText}>{t("History")}</span>
            
            <div className={styles.conversationList}>
              {conversations.length > 0 &&
                conversations.map((convo) => {
                  const scenarios = scenariosForConversation[convo.id] || [];
                  const hasUnread = unreadConversations.has(convo.id);
                  const isPending = pendingResponses.has(convo.id);
                  const hasCompleted = completedResponses.has(convo.id);

                  return (
                    <ConversationItem
                      key={convo.id}
                      convo={convo}
                      isActive={convo.id === currentConversationId}
                      onClick={loadConversation}
                      onDelete={handleDeleteRequest} // 변경된 핸들러 전달
                      onUpdateTitle={handleUpdateTitle} // 변경된 핸들러 전달
                      onPin={handlePin} // 변경된 핸들러 전달
                      isExpanded={convo.id === expandedConversationId}
                      scenarios={scenarios}
                      onToggleExpand={toggleConversationExpansion}
                      onScenarioClick={handleScenarioItemClick}
                      unreadScenarioSessions={unreadScenarioSessions}
                      hasUnreadScenarios={hasUnread}
                      isPending={isPending}
                      hasCompletedResponse={hasCompleted}
                    />
                  );
                })}
              {conversations.length === 0 && (
                <div className={styles.historyTileWrapper}>
                  <div className={styles.noHistoryBox}>
                    <NoHistoryIcon />
                    <span className={styles.noHistoryText}>
                      {t("noHistory")}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.footer}>
              <div className={styles.avatarWrapper} onClick={openProfileModal}>
                <img
                  src={user.photoURL}
                  alt="User Avatar"
                  className={styles.userAvatar}
                />
              </div>
              <button className={styles.iconButton} onClick={openManualModal}>
                <ManualIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isProfileModalOpen && <ProfileModal />}
      {isSearchModalOpen && <SearchModal />}
      {isNotificationModalOpen && <NotificationModal />}
      {isManualModalOpen && <ManualModal />}
    </>
  );
}
