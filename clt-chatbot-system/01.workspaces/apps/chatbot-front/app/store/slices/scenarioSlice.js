// app/store/slices/scenarioSlice.js
import { locales } from "../../lib/locales";
import { apiFetch } from "../../lib/apiClient";
import { getErrorKey } from "../../lib/errorHandler";

const FASTAPI_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:8000";

const parseSseEvents = (rawText) => {
  if (!rawText || typeof rawText !== "string") return [];

  // 브라우저/프록시 환경에 따라 CRLF(\r\n)로 내려올 수 있어 정규화한다.
  const normalized = rawText.replace(/\r\n/g, "\n");
  const blocks = normalized
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const event = lines
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim();
      const dataLine = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n")
        .trim();
      return { event, data: dataLine };
    })
    .filter((item) => item.event === "message" && item.data);
};

const mapLangGraphOutputToNode = (output) => {
  if (!output) return null;

  if (output.type === "interrupt") {
    const data = output.data || {};
    if (data.type === "button") {
      return {
        id: data.node_id || `branch-${Date.now()}`,
        type: "branch",
        data: {
          evaluationType: "BUTTON",
          replies: data.replies || [],
        },
      };
    }

    if (data.type === "form") {
      return {
        id: data.node_id || `form-${Date.now()}`,
        type: "form",
        data: data.data || {},
      };
    }

    return null;
  }

  if (!output.type) return null;
  return {
    id: output.data?.id || `${output.type}-${Date.now()}`,
    type: output.type,
    data: output.data || {},
  };
};

const callLangGraph = async (scenarioId, conversationId, userAction = null) => {
  const response = await apiFetch(`${FASTAPI_BASE_URL}/langgraph/chat/${scenarioId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: conversationId,
      user_action: userAction,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to call langgraph endpoint.");
  }

  const sseText = await response.text();
  const parsedEvents = parseSseEvents(sseText);
  if (parsedEvents.length === 0) {
    console.warn("[callLangGraph] SSE message 이벤트가 파싱되지 않았습니다.", sseText);
  }

  const outputs = parsedEvents
    .map((evt) => {
      try {
        return JSON.parse(evt.data)?.output;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return outputs;
};

export const createScenarioSlice = (set, get) => ({
  scenarioStates: {},
  activeScenarioSessionId: null,
  activeScenarioSessions: [],
  unsubscribeScenariosMap: {},

  _updateScenarioState: (sessionId, patch = {}) => {
    if (!sessionId) return;
    set((state) => ({
      scenarioStates: {
        ...state.scenarioStates,
        [sessionId]: {
          ...(state.scenarioStates[sessionId] || {}),
          ...patch,
          isLoading: false,
        },
      },
    }));
  },

  setScenarioSlots: (sessionId, newSlots) => {
    set(state => {
      if (!sessionId || !state.scenarioStates[sessionId]) {
        console.warn(`[setScenarioSlots] Invalid or non-existent scenario session ID: ${sessionId}`);
        return state;
      }
      
      const updatedScenarioState = {
        ...state.scenarioStates[sessionId],
        slots: newSlots,
      };

      return {
        scenarioStates: {
          ...state.scenarioStates,
          [sessionId]: updatedScenarioState,
        }
      };
    });
  },

  updateScenarioSession: async (sessionId, payload) => {
    if (!sessionId) return null;
    try {
      const response = await apiFetch(
        `${FASTAPI_BASE_URL}/scenario-sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error("Failed to update scenario session.");
      return await response.json();
    } catch (error) {
      console.error("Error updating scenario session:", error);
      return null;
    }
  },

  openScenarioPanel: async (scenarioId, initialSlots = {}) => {
    const {
      user,
      currentConversationId,
      handleEvents,
      language,
      setActivePanel,
      addMessage,
      setForceScrollToBottom,
      showEphemeralToast,
      showScenarioBubbles,
      updateScenarioSession,
    } = get();
    if (!user) return;

    let conversationId = currentConversationId;
    let newScenarioSessionId = null;

    try {
      if (!conversationId) {
        const response = await apiFetch(`${FASTAPI_BASE_URL}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });
        if (!response.ok) {
          throw new Error(
            "Failed to ensure conversation ID for starting scenario."
          );
        }
        const newConversation = await response.json();
        if (!newConversation?.id) {
          throw new Error(
            "Failed to ensure conversation ID for starting scenario."
          );
        }
        conversationId = newConversation.id;
        await get().loadConversation?.(conversationId);
      }
      console.log(`[openScenarioPanel] Starting scenario ${scenarioId} in conversation ${conversationId} with initial slots:`, initialSlots)
      const sessionResponse = await apiFetch(`${FASTAPI_BASE_URL}/scenario-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenarioId,
          conversationId: conversationId,
          slots: initialSlots,
        }),
      });
      if (!sessionResponse.ok) {
        throw new Error("Failed to create scenario session.");
      }
      const sessionData = await sessionResponse.json();
      newScenarioSessionId = sessionData.id;
      console.log('[newScenarioSessionId]'+newScenarioSessionId)

      setActivePanel("main");
      setForceScrollToBottom(true);

      if (showScenarioBubbles) {
        await addMessage("user", {
          type: "scenario_bubble",
          scenarioSessionId: newScenarioSessionId,
        });
      }

      get().subscribeToScenarioSession(newScenarioSessionId);

      setTimeout(() => {
        setActivePanel("scenario", newScenarioSessionId);
      }, 100);

      const outputs = await callLangGraph(scenarioId, conversationId);
      const messages = [];
      const ended = outputs.length > 0 && outputs[outputs.length - 1]?.type !== "interrupt";
      const latestNode = mapLangGraphOutputToNode(outputs[outputs.length - 1]);

      outputs.forEach((output) => {
        const mappedNode = mapLangGraphOutputToNode(output);
        if (!mappedNode || mappedNode.type === "setSlot" || mappedNode.type === "set-slot" || mappedNode.type === "delay" || mappedNode.type === "api") {
          return;
        }
        messages.push({
          id: mappedNode.id,
          sender: "bot",
          node: mappedNode,
        });
      });

      const updatePayload = {
        messages,
        slots: initialSlots,
        state: ended
          ? null
          : {
              scenarioId,
              currentNodeId: latestNode?.id,
              awaitingInput: true,
            },
        status: ended ? "completed" : "active",
      };

      get()._updateScenarioState(newScenarioSessionId, {
        scenarioId,
        ...updatePayload,
      });

      await updateScenarioSession(newScenarioSessionId, updatePayload);
    } catch (error) {
      console.error(`Error opening scenario panel for ${scenarioId}:`, error);
      const errorKey = getErrorKey(error);
      const message =
        locales[language]?.[errorKey] || "Failed to start scenario.";
      showEphemeralToast(message, "error");

      if (showScenarioBubbles && newScenarioSessionId) {
        set((state) => ({
          messages: state.messages.filter(
            (msg) =>
              !(
                msg.type === "scenario_bubble" &&
                msg.scenarioSessionId === newScenarioSessionId
              )
          ),
        }));
      }
      setActivePanel("main");
    }
  },

  setScenarioSelectedOption: async (scenarioSessionId, messageNodeId, selectedValue) => {
    const { scenarioStates, language, showEphemeralToast, updateScenarioSession } = get();
    if (!scenarioSessionId) return;

    const scenarioState = scenarioStates[scenarioSessionId];
    if (!scenarioState) return;

    const originalMessages = Array.isArray(scenarioState.messages) ? scenarioState.messages : [];
    const updatedMessages = originalMessages.map(msg => {
        if (msg.node && msg.node.id === messageNodeId) {
            return { ...msg, selectedOption: selectedValue };
        }
        return msg;
    });

    set(state => ({
        scenarioStates: {
            ...state.scenarioStates,
            [scenarioSessionId]: {
                ...state.scenarioStates[scenarioSessionId],
                messages: updatedMessages,
            },
        },
    }));

    try {
        await updateScenarioSession(scenarioSessionId, { messages: updatedMessages });
    } catch (error) {
        console.error("Error updating scenario selected option:", error);
        const errorKey = getErrorKey(error);
        const message = locales[language]?.[errorKey] || 'Failed to save selection in scenario.';
        showEphemeralToast(message, 'error');
        set(state => ({
            scenarioStates: {
                ...state.scenarioStates,
                [scenarioSessionId]: {
                  ...state.scenarioStates[scenarioSessionId],
                  messages: originalMessages,
                }
            },
        }));
    }
  },

  subscribeToScenarioSession: (sessionId) => {
    const { unsubscribeScenariosMap, language, showEphemeralToast } = get();
    if (unsubscribeScenariosMap[sessionId]) return;

    apiFetch(`${FASTAPI_BASE_URL}/scenario-sessions/${sessionId}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load scenario session.");
        return response.json();
      })
      .then((scenarioData) => {
        set((state) => {
          const currentLocalState = state.scenarioStates[sessionId];
          const newScenarioStates = {
            ...state.scenarioStates,
            [sessionId]: {
              ...(currentLocalState || {}),
              ...scenarioData,
            },
          };
          const newActiveSessions = Object.keys(newScenarioStates);
          return {
            scenarioStates: newScenarioStates,
            activeScenarioSessions: newActiveSessions,
          };
        });
      })
      .catch((error) => {
        console.error(`Error loading scenario session ${sessionId}:`, error);
        const errorKey = getErrorKey(error);
        const message = locales[language]?.[errorKey] || "Error syncing scenario state.";
        showEphemeralToast(message, "error");
      });

    set((state) => ({
      unsubscribeScenariosMap: {
        ...state.unsubscribeScenariosMap,
        [sessionId]: () => {},
      },
    }));
  },

  unsubscribeFromScenarioSession: (sessionId) => {
      set(state => {
          const newUnsubscribeMap = { ...state.unsubscribeScenariosMap };
          if (newUnsubscribeMap[sessionId]) {
              newUnsubscribeMap[sessionId]();
              delete newUnsubscribeMap[sessionId];
          }

          const updatedStates = { ...state.scenarioStates };
          delete updatedStates[sessionId];
          const updatedActiveSessions = Object.keys(updatedStates);

          const shouldResetActivePanel = state.activeScenarioSessionId === sessionId || state.lastFocusedScenarioSessionId === sessionId;

          return {
              unsubscribeScenariosMap: newUnsubscribeMap,
              scenarioStates: updatedStates,
              activeScenarioSessions: updatedActiveSessions,
              ...(shouldResetActivePanel ? {
                  activeScenarioSessionId: null,
                  lastFocusedScenarioSessionId: null,
                  activePanel: 'main'
              } : {})
          };
      });
  },

  unsubscribeAllScenarioListeners: () => {
    const { unsubscribeScenariosMap } = get();
    Object.keys(unsubscribeScenariosMap).forEach(sessionId => {
      get().unsubscribeFromScenarioSession(sessionId);
    });
  },

  endScenario: async (scenarioSessionId, status = 'completed') => {
    const { language, showEphemeralToast } = get(); 
    if (!scenarioSessionId) return;
    
    try {
        const response = await apiFetch(`${FASTAPI_BASE_URL}/scenario-sessions/${scenarioSessionId}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error("Failed to end scenario.");
        
        set(state => {
            const updatedState = state.scenarioStates[scenarioSessionId]
                ? { ...state.scenarioStates[scenarioSessionId], status: status, state: null } 
                : { status: status, state: null }; 

            return {
                scenarioStates: {
                    ...state.scenarioStates,
                    [scenarioSessionId]: updatedState
                },
            };
        });

        console.log(`[endScenario] Scenario ${scenarioSessionId} marked as ${status}. Panel will remain open.`);

    } catch (error) {
        console.error(`Error ending scenario ${scenarioSessionId} with status ${status}:`, error);
        const errorKey = getErrorKey(error);
        const message = locales[language]?.[errorKey] || 'Failed to update scenario status.';
        showEphemeralToast(message, 'error');
    }
  },

  handleScenarioResponse: async (payload) => {
    const { scenarioSessionId } = payload;
    const { handleEvents, showToast, user, currentConversationId, language, endScenario, showEphemeralToast, updateScenarioSession } = get();
    if (!user || !currentConversationId || !scenarioSessionId) return;

    const currentScenario = get().scenarioStates[scenarioSessionId];
    if (!currentScenario) {
        console.warn(`handleScenarioResponse called for non-existent session: ${scenarioSessionId}`);
        showEphemeralToast(locales[language]?.errorUnexpected || 'An unexpected error occurred.', 'error');
        return;
    }
    const existingMessages = Array.isArray(currentScenario.messages) ? currentScenario.messages : [];

    set(state => ({
        scenarioStates: { ...state.scenarioStates, [scenarioSessionId]: { ...currentScenario, isLoading: true } }
    }));

    try {
        let newMessages = [...existingMessages];

        if (payload.userInput) {
            newMessages.push({ id: `user-${Date.now()}`, sender: 'user', text: payload.userInput });
            try {
                await updateScenarioSession(scenarioSessionId, { messages: newMessages });
            } catch (error) {
                console.error("Error updating user message:", error);
                const errorKey = getErrorKey(error);
                const message = locales[language]?.[errorKey] || 'Failed to send message.';
                showEphemeralToast(message, 'error');
                set(state => ({
                  scenarioStates: { ...state.scenarioStates, [scenarioSessionId]: { ...state.scenarioStates[scenarioSessionId], isLoading: false } }
                }));
                return;
            }
        }

        const baseSlots = payload.slots ?? currentScenario.slots ?? {};
        const userAction = payload.formData || payload.sourceHandle || payload.userInput || null;
        const outputs = await callLangGraph(currentScenario.scenarioId, currentConversationId, userAction);
        const latestOutput = outputs[outputs.length - 1];

        outputs.forEach((output) => {
          const mappedNode = mapLangGraphOutputToNode(output);
          if (!mappedNode || mappedNode.type === 'setSlot' || mappedNode.type === 'set-slot' || mappedNode.type === 'delay' || mappedNode.type === 'api') {
            return;
          }
          newMessages.push({ id: mappedNode.id, sender: 'bot', node: mappedNode });
        });

        let updatePayload = { messages: newMessages };
        const isInterrupted = latestOutput?.type === 'interrupt';

        if (!isInterrupted) {
          updatePayload.status = 'completed';
          updatePayload.state = null;
          updatePayload.slots = { ...baseSlots, ...(payload.formData || {}) };
          get()._updateScenarioState(scenarioSessionId, {
            messages: newMessages,
            slots: updatePayload.slots,
            state: null,
            status: 'completed',
          });
          await updateScenarioSession(scenarioSessionId, updatePayload);
          endScenario(scenarioSessionId, 'completed');
          return;
        }

        const latestNode = mapLangGraphOutputToNode(latestOutput);
        updatePayload.status = 'active';
        updatePayload.state = {
          scenarioId: currentScenario.scenarioId,
          currentNodeId: latestNode?.id,
          awaitingInput: true,
        };
        updatePayload.slots = { ...baseSlots, ...(payload.formData || {}) };

        get()._updateScenarioState(scenarioSessionId, {
            messages: newMessages,
            slots: updatePayload.slots || currentScenario.slots,
            state: updatePayload.state ?? currentScenario.state,
            status: updatePayload.status || currentScenario.status,
        });

        await updateScenarioSession(scenarioSessionId, updatePayload);

    } catch (error) {
        console.error(`Error handling scenario response for ${scenarioSessionId}:`, error);
        const errorKey = getErrorKey(error);
        const errorMessage = locales[language]?.[errorKey] || 'An error occurred during the scenario.';
        showEphemeralToast(errorMessage, 'error');

        const errorMessages = [...existingMessages, { id: `bot-error-${Date.now()}`, sender: 'bot', text: errorMessage }];
        try {
            await updateScenarioSession(scenarioSessionId, { messages: errorMessages, status: 'failed', state: null });
            endScenario(scenarioSessionId, 'failed');
        } catch (updateError) {
             console.error(`Failed to update scenario status to failed for ${scenarioSessionId}:`, updateError);
              set(state => ({
                scenarioStates: {
                    ...state.scenarioStates,
                    [scenarioSessionId]: {
                        ...(state.scenarioStates[scenarioSessionId] || {}),
                        messages: errorMessages,
                        status: 'failed',
                        state: null,
                        isLoading: false
                    }
                }
             }));
             endScenario(scenarioSessionId, 'failed');
        }
    } finally {
      set(state => {
         if(state.scenarioStates[scenarioSessionId]) {
            return {
                scenarioStates: { ...state.scenarioStates, [scenarioSessionId]: { ...state.scenarioStates[scenarioSessionId], isLoading: false } }
            };
         }
         return state;
      });
    }
  },

  continueScenarioIfNeeded: async (
    lastNode,
    scenarioSessionId,
    scenarioStateOverride,
    slotsOverride
  ) => {
    if (!lastNode || !scenarioSessionId) {
      console.warn("continueScenarioIfNeeded: lastNode or scenarioSessionId is missing.");
      return;
    }

    const isInteractive = lastNode.type === 'slotfilling' ||
                          lastNode.type === 'form' ||
                          (lastNode.type === 'branch' && lastNode.data?.evaluationType !== 'CONDITION');

    if (!isInteractive && lastNode.id !== 'end') {
      console.log(`Node ${lastNode.id} (${lastNode.type}) is not interactive, continuing...`);
      try {
          await new Promise(resolve => setTimeout(resolve, 300));
        const sessionState = get().scenarioStates[scenarioSessionId];
        const scenarioStateToSend =
          scenarioStateOverride ?? sessionState?.state;
        const slotsToSend =
          slotsOverride ?? sessionState?.slots ?? {};
        await get().handleScenarioResponse({
            scenarioSessionId: scenarioSessionId,
            currentNodeId: lastNode.id,
            sourceHandle: null,
            userInput: null,
            scenarioState: scenarioStateToSend,
            slots: slotsToSend,
        });
      } catch (error) {
          console.error(`[continueScenarioIfNeeded] Unexpected error during auto-continue for session ${scenarioSessionId}:`, error);
          const { language, showEphemeralToast, endScenario } = get();
          const errorKey = getErrorKey(error);
          const message = locales[language]?.[errorKey] || 'Scenario auto-continue failed.';
          showEphemeralToast(message, 'error');
          endScenario(scenarioSessionId, 'failed');
      }
    } else {
        console.log(`Node ${lastNode.id} (${lastNode.type}) is interactive or end node, stopping auto-continue.`);
    }
  },
});
