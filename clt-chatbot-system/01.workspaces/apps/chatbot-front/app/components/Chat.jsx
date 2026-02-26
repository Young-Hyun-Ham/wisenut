// app/components/Chat.jsx
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useChatStore } from "../store";
import { useTranslations } from "../hooks/useTranslations";
import { useShortcuts } from "../hooks/useQueries";
import { useAutoScroll } from "../hooks/useAutoScroll"; // [추가] 훅 임포트
import styles from "./Chat.module.css";
import FavoritePanel from "./FavoritePanel";
import ScenarioBubble from "./ScenarioBubble";
import CheckCircle from "./icons/CheckCircle";
import MoonIcon from "./icons/MoonIcon";
import LogoIcon from "./icons/LogoIcon";
import CopyIcon from "./icons/CopyIcon";
import MarkdownRenderer from "./MarkdownRenderer";
import LikeIcon from "./icons/LikeIcon";
import DislikeIcon from "./icons/DislikeIcon";
import mainMarkdownStyles from "./MainChatMarkdown.module.css";

// --- 👇 [유지] 대체할 URL과 문구 정의 ---
const TARGET_AUTO_OPEN_URL = "http://172.20.130.91:9110/oceans/BPM_P1002.do?tenId=2000&stgId=TST&pgmNr=BKD_M3201";
const REPLACEMENT_TEXT = "e-SOP 링크 호출 완료했습니다.";
// --- 👆 [유지] ---

// --- 👇 [추가] 정규식 특수문자 이스케이프 함수 ---
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
};
// --- 👆 [추가] ---

const ChartRenderer = dynamic(() => import("./ChartRenderer"), {
  loading: () => <p>Loading chart...</p>,
  ssr: false,
});

const tryParseJson = (text) => {
  try {
    if (
      typeof text === "string" &&
      text.startsWith("{") &&
      text.endsWith("}")
    ) {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
};

const MessageWithButtons = ({ msg }) => {
  // --- 👇 [유지] sender 추가 ---
  const { text, id: messageId, isStreaming, chartData, sender } = msg; 
  // --- 👆 [유지] ---
  const { handleShortcutClick, selectedOptions } = useChatStore();
  const { data: scenarioCategories = [] } = useShortcuts();
  const enableMainChatMarkdown = useChatStore(
    (state) => state.enableMainChatMarkdown
  );
  const selectedOption = selectedOptions[messageId];

  const findShortcutByTitle = useCallback(
    (title) => {
      if (!scenarioCategories) return null;
      for (const category of scenarioCategories) {
        for (const subCategory of category.subCategories) {
          const item = subCategory.items.find((i) => i.title === title);
          if (item) return item;
        }
      }
      return null;
    },
    [scenarioCategories]
  );

  if (text === null || text === undefined) return null;

  const showLoadingGifForLoopback =
    typeof text === "string" && text.includes("Loop back to Supervisor");
  if (showLoadingGifForLoopback) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <span>init flow..</span>
        <img
          src="/images/Loading.gif"
          alt="Loading..."
          style={{ width: "60px", height: "45px", marginTop: "8px" }}
        />
      </div>
    );
  }

  const jsonContent = tryParseJson(text);
  if (jsonContent && jsonContent.next && jsonContent.instructions) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <span>{jsonContent.instructions}</span>
        <img
          src="/images/Loading.gif"
          alt="Loading..."
          style={{ width: "60px", height: "45px", marginTop: "8px" }}
        />
      </div>
    );
  }

  // --- 👇 [수정] 텍스트 치환 로직 강화 (중복 제거 로직 추가) ---
  let processedText = text;

  // 봇 메시지이고 URL이 포함된 경우에만 로직 수행 (성능 최적화)
  if (sender === 'bot' && typeof processedText === "string" && 
     (processedText.includes('172.20.130.91') || processedText.includes('BPM_P1002'))) {
    
    const replacement = REPLACEMENT_TEXT;

    // 1. URL 자체를 문구로 치환 (HTML 엔티티 &amp; 대응)
    const escapedUrl = escapeRegExp(TARGET_AUTO_OPEN_URL);
    const flexibleUrlPattern = escapedUrl.replace(/&/g, '(&|&amp;)'); // & 또는 &amp; 허용
    const urlRegex = new RegExp(flexibleUrlPattern, 'g');
    
    // 먼저 URL을 문구로 바꿉니다.
    // 예: "링크는 http://... 입니다" -> "링크는 완료문구 입니다"
    // 예: "[http://...](http://...)" -> "[완료문구](완료문구)"
    processedText = processedText.replace(urlRegex, replacement);

    // 2. Markdown 링크 형태 [텍스트](완료문구) 감지 및 제거
    // URL 치환 후 남은 마크다운 래퍼([SomeText](Replacement))를 제거하여 Replacement만 남김
    const escapedReplacement = escapeRegExp(replacement);
    // \[.*?\] : 대괄호 안의 임의 텍스트 (Link Title)
    // \(escapedReplacement\) : 소괄호 안의 치환된 문구 (Link URL 자리)
    const markdownWrapperRegex = new RegExp(`\\[.*?\\]\\(${escapedReplacement}\\)`, 'g');
    
    if (markdownWrapperRegex.test(processedText)) {
        processedText = processedText.replace(markdownWrapperRegex, replacement);
    }
    
    // 3. "NN" 잔여 텍스트 제거 (이전 요청사항)
    const nnTarget = `${replacement}NN`;
    if (processedText.includes(nnTarget)) {
       processedText = processedText.replaceAll(nnTarget, replacement);
    }
  }
  // --- 👆 [수정] ---

  const regex = /\[BUTTON:(.+?)\]/g;
  const textParts = [];
  const buttonParts = [];
  let lastIndex = 0;
  let match;

  if (typeof processedText === "string") {
    while ((match = regex.exec(processedText)) !== null) {
      if (match.index > lastIndex) {
        textParts.push(processedText.substring(lastIndex, match.index));
      }
      buttonParts.push(match[1]);
      lastIndex = regex.lastIndex;
    }
    textParts.push(processedText.substring(lastIndex));
  } else {
    try {
      textParts.push(JSON.stringify(processedText));
    } catch (e) {
      textParts.push(String(processedText));
    }
  }

  const allTextContent = textParts.map(s => s.trim()).filter(Boolean).join("\n");

  return (
    <div>
      {chartData && (
        <ChartRenderer chartJsonString={chartData} />
      )}

      <MarkdownRenderer
        content={allTextContent}
        renderAsMarkdown={enableMainChatMarkdown}
        wrapperClassName={mainMarkdownStyles.mainChatMarkdown}
      />

      {buttonParts.map((buttonText, index) => {
        const shortcutItem = findShortcutByTitle(buttonText);
        const isSelected = selectedOption === buttonText;
        const isDimmed = selectedOption && !isSelected;

        if (shortcutItem) {
          return (
            <button
              key={`button-${index}`}
              className={`${styles.optionButton} ${
                isSelected ? styles.selected : ""
              } ${isDimmed ? styles.dimmed : ""}`}
              style={{ margin: "4px 4px 4px 0", display: "block" }}
              onClick={() => handleShortcutClick(shortcutItem, messageId)}
              disabled={!!selectedOption}
            >
              {buttonText}
            </button>
          );
        }
        return <span key={`button-text-${index}`}>{`[BUTTON:${buttonText}]`}</span>;
      })}

      {isStreaming && (
        <img
          src="/images/Loading.gif"
          alt="Loading..."
          style={{
            width: "60px",
            height: "45px",
            marginLeft: "8px",
            verticalAlign: "middle",
          }}
        />
      )}
    </div>
  );
};

export default function Chat() {
  const {
    messages,
    isLoading,
    openScenarioPanel,
    loadMoreMessages,
    hasMoreMessages,
    theme,
    setTheme,
    fontSize,
    setFontSize,
    scrollToMessageId,
    setScrollToMessageId,
    activePanel,
    focusChatInput,
    forceScrollToBottom,
    setForceScrollToBottom,
    scrollAmount,
    resetScroll,
    selectedOptions,
    setSelectedOption,
    dimUnfocusedPanels,
    setMessageFeedback,
    enableFavorites,
    showScenarioBubbles,
  } = useChatStore();
  
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [animatedButton, setAnimatedButton] = useState(null);
  const containerRef = useRef(null);
  const { t } = useTranslations();

  // [리팩토링] 커스텀 스크롤 훅 사용 (기존 historyRef, wasAtBottomRef 대체)
  const { scrollRef, scrollToBottom, enableSmoothScroll } = useAutoScroll(messages, isLoading);

  const handleHistoryClick = () => {
    if (activePanel === "scenario") {
      focusChatInput();
    }
  };

  // [리팩토링] '이전 메시지 불러오기' 전용 스크롤 핸들러
  const handleFetchMoreScroll = useCallback(async () => {
    if (
      scrollRef.current?.scrollTop === 0 &&
      hasMoreMessages &&
      !isFetchingMore
    ) {
      setIsFetchingMore(true);
      const initialHeight = scrollRef.current.scrollHeight;
      await loadMoreMessages();
      // 메시지 로드 후 스크롤 위치 복원
      if (scrollRef.current) {
        const newHeight = scrollRef.current.scrollHeight;
        scrollRef.current.scrollTop = newHeight - initialHeight;
      }
      setIsFetchingMore(false);
    }
  }, [hasMoreMessages, isFetchingMore, loadMoreMessages, scrollRef]);

  // [리팩토링] Fetch More 핸들러 연결
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', handleFetchMoreScroll);
    return () => {
        scrollContainer.removeEventListener('scroll', handleFetchMoreScroll);
    };
  }, [handleFetchMoreScroll, scrollRef]);


  // [리팩토링] Force Scroll to Bottom 처리 (Store 상태 연동)
  useEffect(() => {
    if (forceScrollToBottom) {
        enableSmoothScroll();
        scrollToBottom("smooth");
        setForceScrollToBottom(false);
    }
  }, [forceScrollToBottom, setForceScrollToBottom, scrollToBottom, enableSmoothScroll]);

  // [리팩토링] Store의 scrollAmount 처리 (수동 스크롤 조정)
  useEffect(() => {
    if (scrollAmount && scrollRef.current) {
      scrollRef.current.scrollBy({ top: scrollAmount, behavior: "smooth" });
      resetScroll();
    }
  }, [scrollAmount, resetScroll, scrollRef]);

  // [리팩토링] 특정 메시지로 스크롤 (검색 결과 등)
  useEffect(() => {
    if (scrollToMessageId && scrollRef.current) {
      const element = scrollRef.current.querySelector(
        `[data-message-id="${scrollToMessageId}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add(styles.highlightedMessage);
        setTimeout(() => {
          element.classList.remove(styles.highlightedMessage);
        }, 800);
        setScrollToMessageId(null);
      } else {
        console.warn(
          `Element with data-message-id="${scrollToMessageId}" not found in main chat.`
        );
        setScrollToMessageId(null);
      }
    }
  }, [scrollToMessageId, messages, setScrollToMessageId, scrollRef]);

  // 채팅 영역 외부 스크롤 시 채팅 내용 스크롤 (마우스 휠)
  useEffect(() => {
    const container = containerRef.current;
    const scrollTarget = scrollRef.current; // historyRef 대신 scrollRef 사용
    if (!container || !scrollTarget) return;

    const handleWheelOutsideHistory = (event) => {
      if (event.defaultPrevented) return;
      const withinHistory = event.target.closest(`.${styles.history}`);
      if (withinHistory) return;

      scrollTarget.scrollBy({
        top: event.deltaY,
        left: event.deltaX,
        behavior: "auto",
      });
      // 훅 내부에서 scroll 이벤트를 감지하여 updateWasAtBottom을 수행하므로 별도 호출 불필요
      event.preventDefault();
    };

    container.addEventListener("wheel", handleWheelOutsideHistory, {
      passive: false,
    });
    return () => {
      container.removeEventListener("wheel", handleWheelOutsideHistory);
    };
  }, [scrollRef]);


  const handleCopy = (text, id) => {
    let textToCopy = text;
    if (typeof text === "object" && text !== null) {
      try {
        textToCopy = JSON.stringify(text, null, 2);
      } catch (e) {
        console.error("Failed to stringify object for copying:", e);
        return;
      }
    }
    if (
      !textToCopy ||
      (typeof textToCopy === "string" && textToCopy.trim() === "")
    )
      return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 1500);
    });
  };

  const handleFeedbackClick = (messageId, type) => {
    setAnimatedButton({ messageId, type });
    setMessageFeedback(messageId, type);
    setTimeout(() => {
      setAnimatedButton(null);
    }, 300);
  };

  const hasMessages = messages.some((m) => m.id !== "initial");

  return (
    <div className={styles.chatContainer} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.headerButtons}>
          <div className={styles.settingControl} style={{ display: "none" }}>
            <span className={styles.settingLabel}>Large text</span>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={fontSize === "default"}
                onChange={() =>
                  setFontSize(fontSize === "default" ? "small" : "default")
                }
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div className={styles.separator} style={{ display: "none" }}></div>
          <div style={{ display: "none" }}>
            <button
              className={styles.themeToggleButton}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <MoonIcon />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`${styles.history} ${
          activePanel === "scenario" && dimUnfocusedPanels
            ? styles.mainChatDimmed
            : ""
        }`}
        ref={scrollRef} // [리팩토링] 훅에서 반환된 ref 연결
        onClick={handleHistoryClick}
      >
        {!hasMessages ? (
          enableFavorites ? (
            <FavoritePanel />
          ) : null
        ) : (
          <>
            {isFetchingMore && (
              <div className={styles.messageRow}>
                <div className={`${styles.message} ${styles.botMessage}`}>
                  <div className={styles.messageContentWrapper}>
                    <LogoIcon />
                    <div className={styles.messageContent}>
                      <img
                        src="/images/Loading.gif"
                        alt={"loading"}
                        style={{ width: "60px", height: "45px" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {messages.map((msg, index) => {
              if (msg.id === "initial") return null;

              if (msg.type === "scenario_bubble") {
                if (!showScenarioBubbles) {
                  return null;
                }
                return (
                  <ScenarioBubble
                    key={msg.id || msg.scenarioSessionId}
                    scenarioSessionId={msg.scenarioSessionId}
                  />
                );
              } else {
                const selectedOption = selectedOptions[msg.id];
                const currentFeedback = msg.feedback || null;
                const isStreaming =
                  index === messages.length - 1 &&
                  msg.sender === "bot" &&
                  msg.isStreaming === true;
                const isBotMessage = msg.sender === "bot";
                const hasRichContent =
                  isBotMessage &&
                  ((Array.isArray(msg.scenarios) && msg.scenarios.length > 0) ||
                    msg.hasRichContent === true ||
                    msg.contentLayout === "rich" ||
                    msg.containsRichContent === true ||
                    msg.type === "rich_content" ||
                    (Array.isArray(msg.contentBlocks) &&
                      msg.contentBlocks.length > 0) ||
                    (Array.isArray(msg.attachments) &&
                      msg.attachments.length > 0) ||
                    msg.chartData);
                const richContentMinWidthRaw =
                  msg.minWidth ??
                  msg.contentMinWidth ??
                  msg.richContentMinWidth;
                const shouldApplyMinWidth =
                  richContentMinWidthRaw !== null &&
                  richContentMinWidthRaw !== undefined &&
                  richContentMinWidthRaw !== "";
                const resolvedMinWidth = shouldApplyMinWidth
                  ? typeof richContentMinWidthRaw === "number"
                    ? `${richContentMinWidthRaw}px`
                    : richContentMinWidthRaw
                  : undefined;
                const messageClassName = [
                  "GlassEffect",
                  styles.message,
                  isBotMessage ? styles.botMessage : styles.userMessage,
                  isBotMessage && hasRichContent
                    ? styles.botMessageRichContent
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const messageInlineStyle =
                  isBotMessage &&
                  hasRichContent &&
                  shouldApplyMinWidth &&
                  resolvedMinWidth
                    ? { minWidth: resolvedMinWidth }
                    : undefined;
                return (
                  <div
                    key={msg.id}
                    className={`${styles.messageRow} ${
                      msg.sender === "user" ? styles.userRow : ""
                    }`}
                    data-message-id={msg.id}
                  >
                    <div
                      className={messageClassName}
                      style={messageInlineStyle}
                    >
                      {copiedMessageId === msg.id && (
                        <div className={styles.copyFeedback}>{t("copied")}</div>
                      )}
                      <div className={styles.messageContentWrapper}>
                        {msg.sender === "bot" && <LogoIcon />}
                        <div className={styles.messageContent}>
                          <MessageWithButtons
                            msg={msg}
                          />
                          {msg.sender === "bot" && msg.scenarios && (
                            <div className={styles.scenarioList}>
                              {msg.scenarios.map((name) => {
                                const isSelected = selectedOption === name;
                                const isDimmed = selectedOption && !isSelected;
                                return (
                                  <button
                                    key={name}
                                    className={`${styles.optionButton} ${
                                      isSelected ? styles.selected : ""
                                    } ${isDimmed ? styles.dimmed : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOption(msg.id, name);
                                      openScenarioPanel(name);
                                    }}
                                    disabled={!!selectedOption}
                                  >
                                    <span className={styles.optionButtonText}>
                                      {name}
                                    </span>
                                    <CheckCircle />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      {msg.sender === "bot" && msg.text && !isStreaming && (
                        <div className={styles.messageActionArea}>
                          <button
                            className={styles.actionButton}
                            onClick={() => handleCopy(msg.text, msg.id)}
                          >
                            <CopyIcon />
                          </button>
                          <button
                            className={`${styles.actionButton} ${
                              currentFeedback === "like"
                                ? styles.activeFeedback
                                : ""
                            } ${
                              animatedButton?.messageId === msg.id &&
                              animatedButton?.type === "like"
                                ? styles.popAnimation
                                : ""
                            }`}
                            onClick={() => handleFeedbackClick(msg.id, "like")}
                          >
                            <LikeIcon />
                          </button>
                          <button
                            className={`${styles.actionButton} ${
                              currentFeedback === "dislike"
                                ? styles.activeFeedback
                                : ""
                            } ${
                              animatedButton?.messageId === msg.id &&
                              animatedButton?.type === "dislike"
                                ? styles.popAnimation
                                : ""
                            }`}
                            onClick={() =>
                              handleFeedbackClick(msg.id, "dislike")
                            }
                          >
                            <DislikeIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            })}
            {isLoading && !messages[messages.length - 1]?.isStreaming && (
              <div className={styles.messageRow}>
                <div className={`${styles.message} ${styles.botMessage}`}>
                  <div className={styles.messageContentWrapper}>
                    <LogoIcon />
                    <div className={styles.messageContent}>
                      <img
                        src="/images/Loading.gif"
                        alt={"loading"}
                        style={{ width: "60px", height: "45px" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
