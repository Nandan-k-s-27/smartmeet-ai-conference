import React, { useState, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, detectedAccounts, setDetectedAccounts } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect') || '/';
  const hasGoogleClientId = Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID);

  const handleGoogleSuccess = useCallback(
    async (credentialResponse) => {
      try {
        setError('');
        setLoading(true);
        if (!credentialResponse?.credential) {
          throw new Error('Google authentication failed');
        }
        await loginWithGoogle(credentialResponse.credential);
        navigate(redirect === '/' ? '/' : decodeURIComponent(redirect), { replace: true });
      } catch (err) {
        setError(err.message || 'Google login failed');
      } finally {
        setLoading(false);
        setShowGooglePicker(false);
      }
    },
    [loginWithGoogle, navigate, redirect]
  );

  const handleGoogleError = () => {
    setError('Google login failed');
  };

  if (!hasGoogleClientId) {
    return (
      <div className="app-container">
        <div className="lobby-container clean-landing clean-flat-surface">
          <div className="clean-landing-content">
            <div className="lobby-header clean-landing-header">
              <i className="fas fa-lock"></i>
              <h1>Sign In Required</h1>
              <p>Google OAuth is not configured. Please set REACT_APP_GOOGLE_CLIENT_ID.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="lobby-container clean-landing clean-flat-surface">
        <div className="clean-landing-content">
          <div className="lobby-header clean-landing-header">
            <i className="fas fa-lock"></i>
            <h1>Sign In to SmartMeet</h1>
            <p>Secure video meetings with AI-powered summaries</p>
          </div>

          {error && (
            <div className="error-message" style={{ position: 'relative', marginBottom: '16px' }}>
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {!showGooglePicker ? (
            <>
              <div className="clean-landing-auth-row">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signin_with"
                  shape="pill"
                  width="320"
                  useOneTap={false}
                />
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setShowGooglePicker(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#5b6ef5',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textDecoration: 'underline',
                  }}
                >
                  Use another account
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="clean-landing-auth-row">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="signin_with"
                  shape="pill"
                  width="320"
                  useOneTap={false}
                />
              </div>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setShowGooglePicker(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#5b6ef5',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
