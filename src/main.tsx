import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { RadixEmailProvider } from './lib/RadixEmailProvider';

// Request persistent storage
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    if (persistent) {
      console.log("Storage will not be cleared except by explicit user action");
    } else {
      console.log("Storage may be cleared by the UA under storage pressure.");
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RadixEmailProvider>
      <App />
    </RadixEmailProvider>
  </StrictMode>,
);
