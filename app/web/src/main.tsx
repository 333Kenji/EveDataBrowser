import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StatusAnalyticsProvider } from './analytics/status-events';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StatusAnalyticsProvider>
      <App />
    </StatusAnalyticsProvider>
  </React.StrictMode>,
);
