// app/lib/api.js
import { apiFetch } from "./apiClient";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export async function fetchConversations() {
  const res = await apiFetch(`${BASE_URL}/conversations`);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function fetchMessages({ queryKey, pageParam = 0 }) {
  const [_, conversationId] = queryKey;
  // FastAPI의 페이지네이션 방식에 맞춰 수정 (예: skip/limit 또는 cursor)
  const res = await apiFetch(
    `${BASE_URL}/conversations/${conversationId}/messages?skip=${pageParam}&limit=15`
  );
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function fetchShortcuts() {
  const res = await apiFetch(`${BASE_URL}/shortcuts`);
  if (!res.ok) throw new Error("Failed to fetch shortcuts");
  return res.json();
}

export async function fetchScenarios() {
  const res = await apiFetch(`${BASE_URL}/scenarios`);
  if (!res.ok) throw new Error("Failed to fetch scenarios");
  return res.json();
}
