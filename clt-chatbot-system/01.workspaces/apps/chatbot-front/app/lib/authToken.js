const TOKEN_KEY = "chatbot_access_token";

export const getAuthToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token) => {
  if (typeof window === "undefined") return;
  if (!token) return;
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
};
