import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// vite-plugin-pwa's auto-injected registration performs no periodic update
// check, and this is a hash-routed SPA, so after first load the browser may go
// a long time without a navigation to trigger one. Observed 2026-11-21: a
// worker received 16 Nov was still serving a shell that predated the Requests
// page four days later, through repeated reloads.
//
// immediate: true registers without waiting for the load event; the interval
// asks the browser to re-check sw.js every hour the app is open.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      void registration.update();
    }, 60 * 60 * 1000);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
