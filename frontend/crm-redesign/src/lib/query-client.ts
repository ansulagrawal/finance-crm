import { QueryClient } from '@tanstack/react-query';

/** Short staleTime — this is an internal ops tool with multiple staff
 * editing the same leads concurrently, don't let a stale list linger. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});
