import 'virtual:phosphene-tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

// Start downloading the rendering engine in parallel with the first route.
void import('./engine/Engine.ts');

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root container');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
