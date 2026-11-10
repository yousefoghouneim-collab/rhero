import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import './index.css';
import App from './App';
import { startOutbox } from './lib/outbox';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 24 * 3600_000, retry: 1, refetchOnWindowFocus: true, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
});
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'rhero-query-cache', throttleTime: 1500 });

startOutbox();
if ('serviceWorker' in navigator && import.meta.env.PROD) registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 3600_000, buster: 'rhero-v1' }} onSuccess={() => void queryClient.invalidateQueries()}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
