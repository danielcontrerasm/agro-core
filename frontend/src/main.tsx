import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './dashboard-mock.css';
import './maps-mock.css';
import './fields-mock.css';
import './fields-overrides.css';
import './crop-management.css';
import './real-map.css';
import './farm-operations.css';
import './fertilization-overview.css';
import './irrigation.css';
import './readability.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
