// app/lib/llm.js
import { locales } from "./locales";
import { apiFetch } from "./apiClient";

/**
 * Flowise 스트리밍 응답을 반환합니다.
 * @param {string} prompt - 사용자 입력 메시지
 * @param {string} language - 응답 언어 ('ko' 또는 'en')
 * @param {Array} shortcuts - 숏컷 목록(현재 미사용)
 * @param {string} llmProvider - 사용할 LLM (flowise 고정)
 * @param {string} flowiseApiUrl - Flowise API URL
 * @returns {Promise<ReadableStream|object>} - Flowise SSE 스트림 또는 표준 에러 객체
 */
export async function getLlmResponse(
  prompt,
  language = "ko",
  shortcuts = [],
  llmProvider,
  flowiseApiUrl
) {
  console.log(`[getLlmResponse] Provider selected: ${llmProvider}`);
  return getFlowiseStreamingResponse(prompt, flowiseApiUrl, language);
}


/**
 * Flowise API에 스트리밍 요청을 보내고, 응답 스트림(ReadableStream)을 반환합니다.
 * @param {string} prompt - 사용자 입력 메시지
 * @param {string} apiUrl - Flowise API URL
 * @param {string} language - 오류 메시지 언어 설정용
 * @returns {Promise<ReadableStream|object>} - Flowise의 SSE 스트림 또는 표준 에러 객체 { type: 'error', message: '...' }
 */
async function getFlowiseStreamingResponse(prompt, apiUrl, language = 'ko') {
    console.log(`[getFlowiseStreamingResponse] Called with apiUrl: ${apiUrl}`);

    if (!apiUrl) {
        console.error("[getFlowiseStreamingResponse] Error: Flowise API URL is not set.");
        // --- 👇 [수정] URL 부재 시 errorLLMFail 메시지 사용 ---
        const message = locales[language]?.['errorLLMFail'] || 'Flowise API is not configured. Please try again later.';
        return {
            type: 'error',
            message: message
        };
        // --- 👆 [수정] ---
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃 설정

    try {
        const requestBody = { question: prompt, streaming: true };
        console.log(`[getFlowiseStreamingResponse] Sending request to Flowise: ${apiUrl}`, requestBody);

        const response = await apiFetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log(`[getFlowiseStreamingResponse] Received response status: ${response.status}`);

        if (!response.ok) {
            let errorBody = await response.text();
            try {
                const errorJson = JSON.parse(errorBody);
                errorBody = errorJson.message || errorBody;
            } catch (e) { /* ignore json parse error */ }
            console.error(`[getFlowiseStreamingResponse] Flowise API Error (${response.status}):`, errorBody);
            // --- 👇 [수정] HTTP 오류 시 errorLLMFail 메시지 사용 ---
            const message = locales[language]?.['errorLLMFail'] || 'Flowise API request failed. Please try again later.';
            return {
                type: 'error',
                message: message
            };
            // --- 👆 [수정] ---
        }

        console.log("[getFlowiseStreamingResponse] Response OK. Returning response body (stream).");
        return response.body;

    } catch (error) {
        clearTimeout(timeoutId);
        console.error("[getFlowiseStreamingResponse] API call failed:", error);

        // --- 👇 [수정] fetch 오류 시 errorLLMFail 메시지 사용 ---
        const message = locales[language]?.['errorLLMFail'] || 'Failed to call Flowise API. Please try again later.';
        return {
            type: 'error',
            message: message
        };
        // --- 👆 [수정] ---
    }
}
