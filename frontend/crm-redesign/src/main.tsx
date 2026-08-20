import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouteErrorState, RouteNotFoundState } from '@/components/error-state';
import { queryClient } from '@/lib/query-client';
import { routeTree } from './routeTree.gen';
import './index.css';

const router = createRouter({
  routeTree,
  defaultErrorComponent: RouteErrorState,
  defaultNotFoundComponent: RouteNotFoundState,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// See core-crm/src/main.tsx: a tab open since before a deploy holds stale
// route-chunk hashes; reload once to recover, guarded so a genuinely broken
// deploy doesn't reload-loop.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('reloaded-after-preload-error')) {
    sessionStorage.setItem('reloaded-after-preload-error', '1');
    window.location.reload();
  }
});

// biome-ignore lint/style/noNonNullAssertion: root element is guaranteed by index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
