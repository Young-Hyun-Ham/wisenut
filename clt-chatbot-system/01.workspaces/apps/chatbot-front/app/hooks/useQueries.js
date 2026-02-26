// app/hooks/useQueries.js
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { fetchConversations, fetchMessages, fetchShortcuts, fetchScenarios } from '../lib/api';
import { apiFetch } from "../lib/apiClient";

// 👇 여기에 BASE_URL이 꼭 있어야 합니다.
const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// [대화 목록] 불러오기
export const useConversations = () => {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });
};

// [메시지 목록] 무한 스크롤
export const useMessages = (conversationId) => {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam = 0 }) => fetchMessages({ queryKey: [null, conversationId], pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 15 ? allPages.length * 15 : undefined;
    },
    enabled: !!conversationId,
  });
};

// [숏컷 목록] 불러오기
export const useShortcuts = () => {
  return useQuery({
    queryKey: ['shortcuts'],
    queryFn: fetchShortcuts,
    staleTime: 5 * 60 * 1000,
  });
};

// [시나리오 목록] 불러오기
export const useScenarios = () => {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: fetchScenarios,
    staleTime: 5 * 60 * 1000,
  });
};

// [대화 생성]
export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title) => {
      const res = await apiFetch(`${BASE_URL}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

// [대화 삭제]
export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId) => {
      const res = await apiFetch(`${BASE_URL}/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

// [제목 수정]
export const useUpdateTitle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }) => {
      const res = await apiFetch(`${BASE_URL}/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to update title");
      return { id, title };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

// [고정 토글]
export const usePinConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isPinned }) => {
      const res = await apiFetch(`${BASE_URL}/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: isPinned }),
      });
      if (!res.ok) throw new Error("Failed to pin conversation");
      return { id, isPinned };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};
