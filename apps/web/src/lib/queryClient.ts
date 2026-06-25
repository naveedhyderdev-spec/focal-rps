import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Central query-key registry so invalidation stays consistent. */
export const qk = {
  settings: ['settings'] as const,
  resources: ['resources'] as const,
  projects: ['projects'] as const,
  stages: ['stages'] as const,
  allocations: ['allocations'] as const,
  locations: ['locations'] as const,
  disciplines: ['disciplines'] as const,
  grades: ['grades'] as const,
  teams: ['teams'] as const,
  stageTypes: ['stageTypes'] as const,
  holidays: ['holidays'] as const,
  users: ['users'] as const,
  activity: ['activity'] as const,
  lookAhead: ['lookAhead'] as const,
};
