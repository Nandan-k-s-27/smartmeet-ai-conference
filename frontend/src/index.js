import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

const RootApp = () => {
  if (!googleClientId) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#f00' }}>
        <h3>Error: REACT_APP_GOOGLE_CLIENT_ID not configured</h3>
        <p>Please set the environment variable REACT_APP_GOOGLE_CLIENT_ID to enable Google OAuth.</p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
};

root.render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);