import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { APP_BUILD, APP_VERSION } from './version';

// Log the running build so you can confirm which version is live (e.g. on Vercel).
console.log(`%cShowForge Studio v${APP_VERSION} (${APP_BUILD})`, 'color:#22d3ee;font-weight:bold');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
