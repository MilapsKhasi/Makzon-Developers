
/**
 * Entry Point for Vercel Deployment
 * This file bootstraps the TypeScript React application.
 */

import './index.tsx';

// Log environment status for debugging Vercel deployment
console.log('Purchase Master: Application initializing...');

// Simple health check for the DOM
window.addEventListener('load', () => {
  const root = document.getElementById('root');
  if (!root) {
    console.error('Critical Error: Root element not found.');
  } else {
    console.log('DOM Ready: Application mounted.');
  }
});

// Handle any global unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});
