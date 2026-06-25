import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
// HashRouter so deep links & refresh work on static hosts (GitHub Pages) with no
// server rewrites. Swap to BrowserRouter behind a real server if desired.
import { HashRouter } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { initData } from './data';
import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

async function bootstrap() {
  // First-run seed of removable demo data (spec §8) before the first render.
  try {
    await initData();
  } catch (err) {
    // Non-fatal: app still works against an empty store.
    console.error('Data init failed', err);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
