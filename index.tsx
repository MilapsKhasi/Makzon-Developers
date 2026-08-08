import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : (reason?.message || reason?.details || '');
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch failed')) {
      console.warn('[Network Handler] Suppressed unhandled fetch error:', msg);
      event.preventDefault();
      localStorage.setItem('use_offline_mode', 'true');
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch failed')) {
      console.warn('[Network Handler] Suppressed fetch error:', msg);
      event.preventDefault();
      localStorage.setItem('use_offline_mode', 'true');
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);