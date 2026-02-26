import { getAuthToken, clearAuthToken } from "./authToken";
import { locales } from "./locales";

let hasNotifiedSessionExpired = false;

export const apiFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Authorization")) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else if (process.env.APP_MODE === "mock") {
      headers.set("Authorization", "Bearer test");
    }
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.includes("/auth/")) {
      clearAuthToken();
      if (typeof window !== "undefined") {
        if (!hasNotifiedSessionExpired) {
          hasNotifiedSessionExpired = true;
          import("../store").then(({ useChatStore }) => {
            const { showEphemeralToast } = useChatStore.getState();
            showEphemeralToast?.(
              locales[useChatStore.getState().language || "ko"]
                ?.errorSessionExpired || "세션이 만료되었습니다. 다시 로그인해주세요.",
              "error"
            );
          });
        }
        window.location.href = "/";
      }
    }
  }
  return response;
};
