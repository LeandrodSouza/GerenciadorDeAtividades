// frontend/src/index.js
// (Conteúdo padrão do Create React App)
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Se você tiver um arquivo CSS global (ex: para Tailwind)
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();