import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouteErrorState, RouteNotFoundState } from '@/components/error-state';
import { queryClient } from '@/lib/query-client';
import { routeTree } from './routeTree.gen';
import './index.css';

// Set once here rather than per route: without these two defaults, any thrown
// render/loader error drops the user on TanStack Router's bare built-in
// overlay, which prints the raw exception ("Cannot read properties of null…")
// with no way back. Opting in route by route would not have helped — the
// failure can come from any of them, including ones added later.
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

// A tab open since before a deploy holds route chunk hashes (e.g.
// `routes-*.js`) the new deploy no longer serves — TanStack Router's
// code-split lazy imports then fail with "Failed to fetch dynamically
// imported module". Reload once to pick up the fresh build; the session
// flag stops a reload loop if the failure isn't actually stale-deploy related.
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
