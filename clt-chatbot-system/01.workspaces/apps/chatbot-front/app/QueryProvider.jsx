// app/QueryProvider.jsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './queryClient';

export default function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 개발 모드에서만 보이는 디버깅 툴 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
