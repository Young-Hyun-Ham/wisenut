// app/store/slices/scenarioSlice.js
import { locales } from "../../lib/locales";
import { apiFetch } from "../../lib/apiClient";
import { getErrorKey } from "../../lib/errorHandler";

const FASTAPI_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:8000";

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

      const response = await apiFetch(`${FASTAPI_BASE_URL}/scenario-sessions/${newScenarioSessionId}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: { text: scenarioId },
            scenarioSessionId: newScenarioSessionId,
            slots: initialSlots,
            language: language,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Server error: ${response.statusText}` }));
        throw new Error(
          errorData.message || `Server error: ${response.statusText}`
        );
      }
      const data = await response.json();

      handleEvents(data.events, newScenarioSessionId, conversationId);

      let updatePayload = {};

      if (data.type === "scenario_start" || data.type === "scenario") {
        updatePayload.slots = { ...initialSlots, ...(data.slots || {}) };
        updatePayload.messages = [];
        updatePayload.state = null;

        if (data.nextNode) {
          if (data.nextNode.type !== "setSlot" && data.nextNode.type !== "set-slot") {
            updatePayload.messages.push({
              id: data.nextNode.id,
              sender: "bot",
              node: data.nextNode,
            });
          }
          const isFirstNodeSlotFillingOrForm =
            data.nextNode.type === "slotfilling" ||
            data.nextNode.type === "form" ||
            (data.nextNode.type === "branch" &&
              data.nextNode.data?.evaluationType !== "CONDITION");
          updatePayload.state = {
            scenarioId: scenarioId,
            currentNodeId: data.nextNode.id,
            awaitingInput: isFirstNodeSlotFillingOrForm,
          };
        } else if (data.message) {
          updatePayload.messages.push({
            id: "end-message",
            sender: "bot",
            text: data.message,
          });
          updatePayload.status = data.status || "completed";
        }
        updatePayload.status = data.status || "active";

        get()._updateScenarioState(newScenarioSessionId, {
          scenarioId,
          messages: updatePayload.messages,
          slots: updatePayload.slots,
          state: updatePayload.state,
          status: updatePayload.status,
        });

        await updateScenarioSession(newScenarioSessionId, updatePayload);

        if (
          data.nextNode &&
          data.nextNode.type !== "slotfilling" &&
          data.nextNode.type !== "form" &&
          !(
            data.nextNode.type === "branch" &&
            data.nextNode.data?.evaluationType !== "CONDITION"
          )
        ) {
          await get().continueScenarioIfNeeded(
            data.nextNode,
            newScenarioSessionId,
            data.scenarioState,
            data.slots
          );
        }
      } else if (data.type === "error") {
        throw new Error(data.message || "Failed to start scenario from API.");
      } else {
        throw new Error(`Unexpected response type from API: ${data.type}`);
      }
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

        const scenarioStateToSend = payload.scenarioState ?? currentScenario.state;
        const baseSlots = payload.slots ?? currentScenario.slots ?? {};
        const response = await apiFetch(`${FASTAPI_BASE_URL}/scenario-sessions/${scenarioSessionId}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: {
                sourceHandle: payload.sourceHandle,
                text: payload.userInput
              },
              scenarioState: scenarioStateToSend,
              slots: { ...baseSlots, ...(payload.formData || {}) },
              language: language,
              scenarioSessionId: scenarioSessionId,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Server error: ${response.statusText}` }));
            throw new Error(errorData.message || `Server error: ${response.statusText}`);
        }
        const data = await response.json();

        handleEvents(data.events, scenarioSessionId, currentConversationId);

        if (data.nextNode && data.nextNode.type !== 'setSlot' && data.nextNode.type !== 'set-slot') {
            newMessages.push({ id: data.nextNode.id, sender: 'bot', node: data.nextNode });
        } else if (data.message && data.type !== 'scenario_validation_fail') {
            newMessages.push({ id: `bot-end-${Date.now()}`, sender: 'bot', text: data.message });
        }

        let updatePayload = {
            messages: newMessages,
        };

        console.log('data.type>>>>>>>>>>>', data.type)

        if (data.type === 'scenario_validation_fail') {
            showEphemeralToast(data.message, 'error');
            updatePayload.status = 'active';
        } else if (data.type === 'scenario_end') {
            const finalStatus = data.slots?.apiFailed ? 'failed' : 'completed';
            updatePayload.status = finalStatus;
            updatePayload.state = null;
            updatePayload.slots = data.slots || currentScenario.slots;
            get()._updateScenarioState(scenarioSessionId, {
                messages: newMessages,
                slots: updatePayload.slots,
                state: null,
                status: finalStatus,
            });
            await updateScenarioSession(scenarioSessionId, updatePayload);
            
            endScenario(scenarioSessionId, finalStatus); 
            
            return;
        } else if (data.type === 'scenario') {
            updatePayload.status = 'active';
            updatePayload.state = data.scenarioState;
            updatePayload.slots = data.slots || currentScenario.slots;
        } else if (data.type === 'error') {
            throw new Error(data.message || "Scenario step failed.");
        } else {
            throw new Error(`Unexpected response type from API: ${data.type}`);
        }

        get()._updateScenarioState(scenarioSessionId, {
            messages: newMessages,
            slots: updatePayload.slots || currentScenario.slots,
            state: updatePayload.state ?? currentScenario.state,
            status: updatePayload.status || currentScenario.status,
        });

        await updateScenarioSession(scenarioSessionId, updatePayload);

        if (data.type === 'scenario' && data.nextNode) {
            const isInteractive = data.nextNode.type === 'slotfilling' ||
                                  data.nextNode.type === 'form' ||
                                  (data.nextNode.type === 'branch' && data.nextNode.data?.evaluationType !== 'CONDITION');
            if (!isInteractive) {
            await get().continueScenarioIfNeeded(
              data.nextNode,
              scenarioSessionId,
              data.scenarioState,
              data.slots
            );
            }
        }

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
