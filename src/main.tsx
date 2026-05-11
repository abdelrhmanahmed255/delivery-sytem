import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/notifications';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Best-effort service worker registration so Android system-tray notifications
// can fire as soon as the driver opens the app. Production-only by default
// (Vite serves /sw.js fine in dev too, but registering in dev can interfere
// with HMR — we still register since this app's dev value is small).
registerServiceWorker();
