import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // We'll create this in the next step
import App from './TimeManagerApp'; // Assuming TimeManagerApp.js is the main app component
// import reportWebVitals from './reportWebVitals'; // Optional: for measuring performance

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
