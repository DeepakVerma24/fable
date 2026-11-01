'use client';

import { useQuery } from '@tanstack/react-query';

import { api, ApiError } from '@/lib/api-client';
import type { SessionResponse, WalletSummary } from '@/lib/types';

export function useSession() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<SessionResponse>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

export function useWallet(enabled: boolean) {
  return useQuery({
    queryKey: ['wallet'],
    enabled,
    queryFn: () => api<WalletSummary>('/wallet'),
  });
}
