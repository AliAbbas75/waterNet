import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, err) => {
        if (err?.status === 401 || err?.status === 403 || err?.status === 404) return false;
        return failureCount < 2;
      }
    },
    mutations: {
      retry: false
    }
  }
});
