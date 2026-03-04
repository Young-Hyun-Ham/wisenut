// app/store/slices/scenarioStateSlice.js
// 기본 상태 정의 및 간단한 setter 함수들

export const createScenarioStateSlice = (set, get) => ({
  scenarioStates: {},
  activeScenarioSessionId: null,
  activeScenarioSessions: [],
  scenarioCategories: [],
  availableScenarios: [],
  unsubscribeScenariosMap: {},
  isDelayLoading: false,
  activeLangGraphStreams: {},

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

  setDelayLoading: (isLoading) => {
    set({ isDelayLoading: isLoading });
  },

  setScenarioEngine: (sessionId, engine) => {
    set(state => {
      if (!sessionId || !state.scenarioStates[sessionId]) return state;
      return {
        scenarioStates: {
          ...state.scenarioStates,
          [sessionId]: {
            ...state.scenarioStates[sessionId],
            engine,
          }
        }
      };
    });
  },

  setPendingInterrupt: (sessionId, pendingInterrupt = null) => {
    set(state => {
      if (!sessionId || !state.scenarioStates[sessionId]) return state;
      return {
        scenarioStates: {
          ...state.scenarioStates,
          [sessionId]: {
            ...state.scenarioStates[sessionId],
            pendingInterrupt,
          }
        }
      };
    });
  },

});
