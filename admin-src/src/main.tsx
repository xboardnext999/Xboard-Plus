import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App';
import { router } from '@/router';
import { clearAuthTokens } from '@/services/http';
import '@/index.css';

window.addEventListener('admin:unauthorized', () => {
  clearAuthTokens();
  void router.navigate('/login', { replace: true });
});

const root = document.getElementById('root');
if (!root) throw new Error('Admin root element was not found.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
