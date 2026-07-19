import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // 60s stale time (served from cache, no background refetch within 60s)
      gcTime: 5 * 60_000,          // 5 minutes garbage collection
      refetchOnWindowFocus: false, // avoid surprise refetch storms
      retry: 1,                    // retry once on failure
    },
  },
});
